#!/bin/bash

# scope-based-changeset.sh
# Creates changesets based on commit scopes rather than file changes
# If a commit has no scope, all packages will be incremented

set -e

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

# Get all package directories and names
PACKAGE_DIRS=$(find . -type f -name "package.json" -not -path "*/node_modules/*" -not -path "*/.changeset/*" | xargs dirname | sed 's|^\./||')
PACKAGE_DIRS=$(echo "$PACKAGE_DIRS" | grep -E '^(packages/|apps/)' || true)

# Store package information in arrays instead of associative arrays
SCOPE_NAMES=()
PACKAGE_NAMES=()
PACKAGE_DIRS=()

# Map scope identifiers to package names
for dir in $PACKAGE_DIRS; do
  PKG_NAME=$(grep -o '"name": *"[^"]*"' "$dir/package.json" | cut -d'"' -f4)
  if [ -n "$PKG_NAME" ]; then
    # Get the package name without scope
    SHORT_NAME=$(echo "$PKG_NAME" | sed 's/@[^/]*\///')
    
    # Store in parallel arrays
    SCOPE_NAMES+=("$SHORT_NAME")
    PACKAGE_NAMES+=("$PKG_NAME")
    PACKAGE_DIRS+=("$dir")
    
    echo "Mapped scope $SHORT_NAME to package $PKG_NAME in directory $dir" >&2
  fi
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
  
  # Extract scope from conventional commit format
  if [[ "$commit_msg" =~ ^[a-z]+\(([^)]+)\): ]]; then
    scope="${BASH_REMATCH[1]}"
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
  
  # Skip if we've already processed this package
  if is_package_processed "$pkg_name"; then
    echo "  Package $pkg_name already processed, skipping" >&2
    return
  fi
  
  echo "  Creating changeset for package $pkg_name with $version_type version bump" >&2
  
  # Create changeset
  if [ "$DRY_RUN" != "true" ]; then
    # Create changeset directory if it doesn't exist
    mkdir -p .changeset
    
    # Generate a unique changeset ID
    CHANGESET_ID="${AUTO_CHANGESET_PREFIX}$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)"
    
    # Create the changeset file
    cat > ".changeset/$CHANGESET_ID.md" << EOF
---
"$pkg_name": $version_type
---

Auto-generated changeset for $pkg_name with $version_type version bump based on commit: $commit_msg
EOF
    
    echo "  Created changeset for $pkg_name: .changeset/$CHANGESET_ID.md" >&2
    CHANGESETS_CREATED=$((CHANGESETS_CREATED + 1))
    mark_package_processed "$pkg_name"
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
      echo "  No package found for scope $SCOPE, skipping" >&2
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

# Set output variables
echo "packages_changed=$PACKAGES_CHANGED"
echo "changesets_created=$CHANGESETS_CREATED"
echo "changeset_created=$([ $CHANGESETS_CREATED -gt 0 ] && echo true || echo false)" 