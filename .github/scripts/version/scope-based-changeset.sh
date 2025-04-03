#!/bin/bash

# scope-based-changeset.sh
# Creates changesets based on commit scopes rather than file changes
# If a commit has no scope, all packages will be incremented

set -e

# Add a safeguard timeout - exit after 5 minutes (300 seconds) to prevent hanging
TIMEOUT=300
(
  sleep $TIMEOUT
  echo "ERROR: Script execution timed out after $TIMEOUT seconds" >&2
  # Force exit the entire process group to ensure cleanup
  kill -9 0
) &
TIMEOUT_PID=$!

# Make sure to clean up the timeout process when the script exits normally
trap "kill $TIMEOUT_PID 2>/dev/null || true" EXIT

# Add environment diagnostics
echo "=== Environment Diagnostics ===" >&2
echo "Bash Version: ${BASH_VERSION}" >&2
echo "Operating System: $(uname -a)" >&2
echo "Current User: $(whoami)" >&2
echo "Current Directory: $(pwd)" >&2
echo "Directory permissions: $(ls -ld .)" >&2
echo ".changeset directory exists: $([ -d .changeset ] && echo "Yes" || echo "No")" >&2
if [ -d .changeset ]; then
  echo ".changeset permissions: $(ls -ld .changeset)" >&2
  echo ".changeset contents: $(ls -la .changeset)" >&2
fi
echo "=== End Environment Diagnostics ===" >&2

# Parse command line arguments
BASE_COMMIT=""
AUTO_CHANGESET_PREFIX="auto-"
DEFAULT_VERSION_TYPE="patch"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --base-commit)
            BASE_COMMIT="$2"
            shift 2
            ;;
        --auto-changeset-prefix)
            AUTO_CHANGESET_PREFIX="$2"
            shift 2
            ;;
        --default-version)
            DEFAULT_VERSION_TYPE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 [--base-commit <sha>] [--auto-changeset-prefix <prefix>] [--default-version <patch|minor|major>] [--dry-run <true|false>]" >&2
            exit 1
            ;;
    esac
done

echo "Creating scope-based changesets..." >&2

# Determine base commit to check from if not provided
if [ -z "$BASE_COMMIT" ]; then
  # Auto-detect the most recent reference point
  LATEST_CHANGESET_COMMIT=$(git log -1 --format=%H -- .changeset/)
  LATEST_TAG_COMMIT=$(git rev-list --tags --max-count=1)
  
  if [ -n "$LATEST_CHANGESET_COMMIT" ]; then
    BASE_COMMIT=$LATEST_CHANGESET_COMMIT
    echo "Using latest changeset commit as base: $BASE_COMMIT" >&2
  elif [ -n "$LATEST_TAG_COMMIT" ]; then
    BASE_COMMIT=$LATEST_TAG_COMMIT
    echo "Using latest tag commit as base: $BASE_COMMIT" >&2
  else
    # If no base commit can be determined, use the first commit in the repo
    BASE_COMMIT=$(git rev-list --max-parents=0 HEAD)
    echo "No changesets or tags found, using first commit in repo: $BASE_COMMIT" >&2
  fi
fi

# Get all package directories and names - improved package detection
PACKAGE_DIRS=""
for PKG_DIR in "packages/blorkboard" "packages/blorkpack" "packages/blorktools" "apps/portfolio"; do
  if [ -f "$PKG_DIR/package.json" ]; then
    PACKAGE_DIRS="$PACKAGE_DIRS $PKG_DIR"
  fi
done

echo "Explicitly checking these directories: $PACKAGE_DIRS" >&2

# Store package information in arrays instead of associative arrays
SCOPE_NAMES=()
PACKAGE_NAMES=()
PACKAGE_DIRS_ARR=()

# Map scope identifiers to package names
for dir in $PACKAGE_DIRS; do
  PKG_NAME=$(grep -o '"name": *"[^"]*"' "$dir/package.json" | cut -d'"' -f4)
  if [ -n "$PKG_NAME" ]; then
    # Get the package name without scope
    SHORT_NAME=$(echo "$PKG_NAME" | sed 's/@[^/]*\///')
    
    # Store in parallel arrays
    SCOPE_NAMES+=("$SHORT_NAME")
    PACKAGE_NAMES+=("$PKG_NAME")
    PACKAGE_DIRS_ARR+=("$dir")
    
    echo "Mapped scope $SHORT_NAME to package $PKG_NAME in directory $dir" >&2
  else
    echo "WARNING: Could not extract package name from $dir/package.json" >&2
  fi
done

# Debug output
echo "Found ${#PACKAGE_NAMES[@]} packages:" >&2
for i in "${!PACKAGE_NAMES[@]}"; do
  echo "  Package: ${PACKAGE_NAMES[$i]}, Scope: ${SCOPE_NAMES[$i]}, Dir: ${PACKAGE_DIRS_ARR[$i]}" >&2
done

# Get all commits since base commit
echo "Getting commits since $BASE_COMMIT..." >&2
COMMITS=$(git log --format="%H %s" $BASE_COMMIT..HEAD)

# Initialize counters
PACKAGES_CHANGED=0
CHANGESETS_CREATED=0

# Track packages for which we've already created changesets
PROCESSED_PACKAGES=""

# Determine version type based on commit message
determine_version_type() {
  local commit_msg="$1"
  local version_type="$DEFAULT_VERSION_TYPE"
  
  # Check for breaking changes (major)
  if echo "$commit_msg" | grep -E '(BREAKING CHANGE:|feat!:|fix!:|refactor!:)' > /dev/null; then
    version_type="major"
  # Check for features (minor)
  elif echo "$commit_msg" | grep -E '^feat(\([^)]+\))?:' > /dev/null; then
    version_type="minor"
  # Otherwise use patch (for fixes, refactors, etc.)
  fi
  
  echo "$version_type"
}

# Extract scope from commit message
extract_scope() {
  local commit_msg="$1"
  local scope=""
  
  # Extract scope from conventional commit format using a safer approach
  if echo "$commit_msg" | grep -E '^[a-z]+\(([^)]+)\):' > /dev/null; then
    scope=$(echo "$commit_msg" | sed -E 's/^[a-z]+\(([^)]+)\):.*/\1/')
  fi
  
  echo "$scope"
}

# Check if a package has already been processed
is_package_processed() {
  local pkg_name="$1"
  if [[ "$PROCESSED_PACKAGES" == *"|$pkg_name|"* ]]; then
    return 0  # true - package has been processed
  else
    return 1  # false - package has not been processed
  fi
}

# Mark a package as processed
mark_package_processed() {
  local pkg_name="$1"
  PROCESSED_PACKAGES="${PROCESSED_PACKAGES}|${pkg_name}|"
}

# Find package by scope
find_package_by_scope() {
  local scope="$1"
  local i=0
  
  for s in "${SCOPE_NAMES[@]}"; do
    if [[ "$s" == "$scope" ]]; then
      echo "${PACKAGE_NAMES[$i]}"
      return 0
    fi
    i=$((i+1))
  done
  
  echo ""  # Return empty string if not found
}

# Create a changeset for a single package
create_package_changeset() {
  local pkg_name="$1"
  local version_type="$2"
  local commit_msg="$3"
  
  echo "  DEBUG: Starting changeset creation for $pkg_name" >&2
  
  # Skip if we've already processed this package
  if is_package_processed "$pkg_name"; then
    echo "  Package $pkg_name already processed, skipping" >&2
    return
  fi
  
  echo "  Creating changeset for package $pkg_name with $version_type version bump" >&2
  
  # Create changeset
  if [ "$DRY_RUN" != "true" ]; then
    echo "  DEBUG: Creating changeset directory" >&2
    # Create changeset directory if it doesn't exist
    mkdir -p .changeset
    
    echo "  DEBUG: Generating changeset ID" >&2
    # Generate a unique changeset ID using date and nanoseconds instead of /dev/urandom
    TIMESTAMP=$(date +%s)
    RANDOM_PART="${TIMESTAMP}${RANDOM}${pkg_name}"
    # Take the last 8 characters to make it shorter
    RANDOM_PART="${RANDOM_PART: -8}"
    CHANGESET_ID="${AUTO_CHANGESET_PREFIX}${RANDOM_PART}"
    
    echo "  DEBUG: Writing changeset file $CHANGESET_ID.md" >&2
    # Create the changeset file
    cat > ".changeset/$CHANGESET_ID.md" << EOF
---
"$pkg_name": $version_type
---

Auto-generated changeset for $pkg_name with $version_type version bump based on commit: $commit_msg
EOF
    
    echo "  Created changeset for $pkg_name: .changeset/$CHANGESET_ID.md" >&2
    CHANGESETS_CREATED=$((CHANGESETS_CREATED + 1))
    echo "  DEBUG: Marking package as processed" >&2
    mark_package_processed "$pkg_name"
    echo "  DEBUG: Changeset creation completed" >&2
  else
    echo "  [DRY RUN] Would create changeset for $pkg_name with $version_type version bump" >&2
  fi
  
  PACKAGES_CHANGED=$((PACKAGES_CHANGED + 1))
}

# Process each commit to find packages to version
while read -r commit; do
  HASH=$(echo "$commit" | cut -d' ' -f1)
  MESSAGE=$(echo "$commit" | cut -d' ' -f2-)
  
  # Skip merge commits
  if [[ "$MESSAGE" == Merge* ]]; then
    continue
  fi
  
  # Get the scope from the commit message
  SCOPE=$(extract_scope "$MESSAGE")
  VERSION_TYPE=$(determine_version_type "$MESSAGE")
  
  echo "Processing commit $HASH: $MESSAGE" >&2
  echo "  Scope: $SCOPE, Version type: $VERSION_TYPE" >&2
  
  # If we have an explicit scope, use it to find the package
  if [ -n "$SCOPE" ]; then
    # Check if scope corresponds to a package
    PKG_NAME=$(find_package_by_scope "$SCOPE")
    
    if [ -n "$PKG_NAME" ]; then
      create_package_changeset "$PKG_NAME" "$VERSION_TYPE" "$MESSAGE"
    else
      # Special case: If scope doesn't match any package but is a "special" scope
      # Examples: pipeline, release, etc. - treat as if it was scopeless
      # List of special scopes that should apply to all packages
      SPECIAL_SCOPES="pipeline release common core docs tests"
      if echo "$SPECIAL_SCOPES" | grep -w "$SCOPE" > /dev/null; then
        echo "  Special scope '$SCOPE' detected - incrementing ALL packages" >&2
        
        # Increment ALL packages for special scopes
        for PKG_NAME in "${PACKAGE_NAMES[@]}"; do
          create_package_changeset "$PKG_NAME" "$VERSION_TYPE" "$MESSAGE"
        done
      else
        echo "  No package found for scope $SCOPE, skipping" >&2
      fi
    fi
  else
    echo "  No scope specified in commit - incrementing ALL packages" >&2
    
    # Increment ALL packages for scopeless commits
    for PKG_NAME in "${PACKAGE_NAMES[@]}"; do
      create_package_changeset "$PKG_NAME" "$VERSION_TYPE" "$MESSAGE"
    done
  fi
done <<< "$COMMITS"

echo "Summary:" >&2
echo "- Processed $(echo "$COMMITS" | wc -l) commits" >&2
echo "- Found $PACKAGES_CHANGED packages with changes" >&2
echo "- Created $CHANGESETS_CREATED changesets" >&2

# Debug the outputs that will be returned
echo "DEBUG: Setting output variables:" >&2
echo "DEBUG: packages_changed=$PACKAGES_CHANGED" >&2
echo "DEBUG: changesets_created=$CHANGESETS_CREATED" >&2
echo "DEBUG: changeset_created=$([ $CHANGESETS_CREATED -gt 0 ] && echo true || echo false)" >&2

# Set output variables - only to stdout and in the correct format
# Each variable on its own line, no extra output
echo "packages_changed=$PACKAGES_CHANGED"
echo "changesets_created=$CHANGESETS_CREATED"
echo "changeset_created=$([ $CHANGESETS_CREATED -gt 0 ] && echo true || echo false)"

# Force process termination for both background processes
kill $TIMEOUT_PID 2>/dev/null || true
echo "DEBUG: Script completed successfully" >&2
exit 0 