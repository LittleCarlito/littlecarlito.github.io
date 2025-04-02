#!/bin/bash
set -e

# Script to create tags using direct Git commands instead of GitHub API
# Usage: create-git-tags.sh --package-paths "path1,path2" --package-names "name1,name2" [--debug true] [--token TOKEN]

PACKAGE_PATHS=""
PACKAGE_NAMES=""
DEBUG="false"
TOKEN=${GITHUB_TOKEN}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --package-paths)
      PACKAGE_PATHS="$2"
      shift 2
      ;;
    --package-names)
      PACKAGE_NAMES="$2"
      shift 2
      ;;
    --debug)
      DEBUG="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$PACKAGE_PATHS" ] || [ -z "$PACKAGE_NAMES" ]; then
  echo "ERROR: package-paths and package-names are required arguments"
  echo "Usage: create-git-tags.sh --package-paths 'path1,path2' --package-names 'name1,name2' [--debug true] [--token TOKEN]"
  exit 1
fi

# Set GitHub token in environment if provided
if [ -n "$TOKEN" ]; then
  export GH_TOKEN="$TOKEN"
fi

# Debug information
if [ "$DEBUG" == "true" ]; then
  echo "DEBUG MODE ENABLED"
  echo "Package paths: $PACKAGE_PATHS"
  echo "Package names: $PACKAGE_NAMES"
  echo "Current directory: $(pwd)"
  echo "Git status:"
  git status
  echo "Latest commits:"
  git log -n 3 --oneline
fi

# Convert comma-separated lists to arrays
IFS=',' read -ra PATHS <<< "$PACKAGE_PATHS"
IFS=',' read -ra NAMES <<< "$PACKAGE_NAMES"

# Initialize counters
SUCCESS_COUNT=0
FAIL_COUNT=0

# Configure git
git config user.name "GitHub Actions"
git config user.email "actions@github.com"

# Loop through packages and create tags
for i in "${!PATHS[@]}"; do
  PATH_ITEM="${PATHS[$i]}"
  NAME_ITEM="${NAMES[$i]}"
  
  if [ "$DEBUG" == "true" ]; then
    echo "DEBUG: Processing package $NAME_ITEM at path $PATH_ITEM"
  fi
  
  if [ -f "$PATH_ITEM/package.json" ]; then
    VERSION=$(node -p "require('./$PATH_ITEM/package.json').version")
    TAG_NAME="$NAME_ITEM@$VERSION"
    
    echo "Creating tag: $TAG_NAME"
    
    # Delete existing tag if it exists (locally)
    git tag -d "$TAG_NAME" 2>/dev/null || true
    
    # Delete existing tag from remote if it exists
    git push --delete origin "$TAG_NAME" 2>/dev/null || true
    
    # Create new tag pointing to the latest commit
    if git tag -a "$TAG_NAME" -m "Release $VERSION" HEAD; then
      echo "✅ Successfully created tag $TAG_NAME"
      SUCCESS_COUNT=$((SUCCESS_COUNT+1))
    else
      echo "❌ Failed to create tag $TAG_NAME"
      FAIL_COUNT=$((FAIL_COUNT+1))
    fi
  else
    echo "⚠️ Warning: package.json not found at $PATH_ITEM"
    FAIL_COUNT=$((FAIL_COUNT+1))
  fi
done

# Push all tags at once
echo "Pushing all tags to remote..."
if git push --tags; then
  echo "✅ Successfully pushed tags to remote"
else
  echo "❌ Failed to push tags to remote"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi

echo "Tags created: $SUCCESS_COUNT"
echo "Tags failed: $FAIL_COUNT"
echo "success_count=$SUCCESS_COUNT"
echo "fail_count=$FAIL_COUNT"

# Return error code if any tags failed
if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
fi

exit 0 