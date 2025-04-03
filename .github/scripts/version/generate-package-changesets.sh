#!/bin/bash
# generate-package-changesets.sh
# Automatically detects changes in packages and generates appropriate changesets
# This is an enhanced version that doesn't require manual pnpm change

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

echo "Auto-generating changesets for package changes..." >&2

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

# Detect package directories
PACKAGE_DIRS=$(find . -type f -name "package.json" -not -path "*/node_modules/*" -not -path "*/.changeset/*" | xargs dirname | sed 's|^\./||')

# Filter out the root package - only include packages and apps directories
PACKAGE_DIRS=$(echo "$PACKAGE_DIRS" | grep -E '^(packages/|apps/)' || true)

# Initialize counters
PACKAGES_CHANGED=0
CHANGESETS_CREATED=0

# Function to determine version type based on commit messages
determine_version_type() {
  local pkg_path=$1
  local version_type=$DEFAULT_VERSION_TYPE
  
  # Get commit messages for this package
  local commit_msgs=$(git log --format=%s $BASE_COMMIT..HEAD -- "$pkg_path")
  
  # Check for breaking changes (major)
  if echo "$commit_msgs" | grep -E '(BREAKING CHANGE:|feat!:|fix!:|refactor!:)' > /dev/null; then
    version_type="major"
  # Check for features (minor)
  elif echo "$commit_msgs" | grep -E '^feat(\([^)]+\))?:' > /dev/null; then
    version_type="minor"
  # Otherwise use patch (for fixes, refactors, etc.)
  fi
  
  echo $version_type
}

# Process each package directory
for dir in $PACKAGE_DIRS; do
  # Check if package has changes
  if git diff --name-only $BASE_COMMIT..HEAD -- "$dir" | grep -q .; then
    echo "Detected changes in package: $dir" >&2
    
    # Get package name from package.json
    PKG_NAME=$(grep -o '"name": *"[^"]*"' "$dir/package.json" | cut -d'"' -f4)
    
    if [ -n "$PKG_NAME" ]; then
      # Determine version type based on commit messages
      VERSION_TYPE=$(determine_version_type "$dir")
      
      echo "Package $PKG_NAME will receive a $VERSION_TYPE version bump" >&2
      
      if [ "$DRY_RUN" != "true" ]; then
        # Create changeset directory if it doesn't exist
        mkdir -p .changeset
        
        # Generate a unique changeset ID
        CHANGESET_ID="${AUTO_CHANGESET_PREFIX}$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)"
        
        # Create the changeset file
        cat > ".changeset/$CHANGESET_ID.md" << EOF
---
"$PKG_NAME": $VERSION_TYPE
---

Auto-generated changeset for $PKG_NAME with $VERSION_TYPE version bump
EOF
        
        echo "Created changeset for $PKG_NAME: .changeset/$CHANGESET_ID.md" >&2
        CHANGESETS_CREATED=$((CHANGESETS_CREATED + 1))
      else
        echo "[DRY RUN] Would create changeset for $PKG_NAME with $VERSION_TYPE version bump" >&2
      fi
      
      PACKAGES_CHANGED=$((PACKAGES_CHANGED + 1))
    else
      echo "WARNING: Could not determine package name for $dir" >&2
    fi
  fi
done

# Output results
if [ $PACKAGES_CHANGED -eq 0 ]; then
  echo "No package changes detected since $BASE_COMMIT" >&2
  echo "packages_changed=0" 
  echo "changesets_created=0"
  echo "changeset_created=false"
else
  echo "$PACKAGES_CHANGED packages have changes, created $CHANGESETS_CREATED changesets" >&2
  echo "packages_changed=$PACKAGES_CHANGED" 
  echo "changesets_created=$CHANGESETS_CREATED"
  if [ $CHANGESETS_CREATED -gt 0 ]; then
    echo "changeset_created=true"
  else
    echo "changeset_created=false"
  fi
fi 