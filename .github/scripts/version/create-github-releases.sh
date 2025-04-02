#!/bin/bash
set -e

# Script to create GitHub releases for existing tags
# Usage: create-github-releases.sh --package-paths "path1,path2" --package-names "name1,name2" [--debug true] [--token TOKEN]

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
  echo "Usage: create-github-releases.sh --package-paths 'path1,path2' --package-names 'name1,name2' [--debug true] [--token TOKEN]"
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
  echo "Git tags:"
  git tag -l
fi

# Convert comma-separated lists to arrays
IFS=',' read -ra PATHS <<< "$PACKAGE_PATHS"
IFS=',' read -ra NAMES <<< "$PACKAGE_NAMES"

# Initialize counters
SUCCESS_COUNT=0
FAIL_COUNT=0

# Loop through packages and create releases
for i in "${!PATHS[@]}"; do
  PATH_ITEM="${PATHS[$i]}"
  NAME_ITEM="${NAMES[$i]}"
  
  if [ "$DEBUG" == "true" ]; then
    echo "DEBUG: Processing package $NAME_ITEM at path $PATH_ITEM"
  fi
  
  if [ -f "$PATH_ITEM/package.json" ]; then
    VERSION=$(node -p "require('./$PATH_ITEM/package.json').version")
    TAG_NAME="$NAME_ITEM@$VERSION"
    
    echo "Checking for tag: $TAG_NAME"
    
    # Verify tag exists in repository
    if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
      echo "Found tag $TAG_NAME, creating release"
      
      # Check if CHANGELOG.md exists
      CHANGELOG_PATH="$PATH_ITEM/CHANGELOG.md"
      RELEASE_NOTES=""
      
      if [ -f "$CHANGELOG_PATH" ]; then
        # Extract release notes for this version from CHANGELOG.md
        RELEASE_NOTES=$(awk -v ver="$VERSION" '
          $0 ~ "^## " ver {
            flag=1;
            next
          }
          flag && $0 ~ "^## " {
            flag=0
          }
          flag {
            print
          }
        ' "$CHANGELOG_PATH")
      fi
      
      if [ -z "$RELEASE_NOTES" ]; then
        RELEASE_NOTES="Release of $NAME_ITEM version $VERSION"
      fi
      
      # Check if release already exists and delete it
      if gh release view "$TAG_NAME" &>/dev/null; then
        if [ "$DEBUG" == "true" ]; then
          echo "DEBUG: Release for $TAG_NAME already exists, deleting it"
        fi
        gh release delete "$TAG_NAME" --yes
      fi
      
      # Create GitHub release
      if [ "$DEBUG" == "true" ]; then
        echo "DEBUG: Creating release with title: $NAME_ITEM v$VERSION"
        echo "DEBUG: Release notes:"
        echo "$RELEASE_NOTES"
      fi
      
      if gh release create "$TAG_NAME" --title "$NAME_ITEM v$VERSION" --notes "$RELEASE_NOTES"; then
        echo "✅ Successfully created release for $TAG_NAME"
        SUCCESS_COUNT=$((SUCCESS_COUNT+1))
      else
        echo "❌ Failed to create release for $TAG_NAME"
        FAIL_COUNT=$((FAIL_COUNT+1))
      fi
    else
      echo "⚠️ Warning: Tag $TAG_NAME does not exist, skipping release"
      FAIL_COUNT=$((FAIL_COUNT+1))
    fi
  else
    echo "⚠️ Warning: package.json not found at $PATH_ITEM"
    FAIL_COUNT=$((FAIL_COUNT+1))
  fi
done

echo "Releases created: $SUCCESS_COUNT"
echo "Releases failed: $FAIL_COUNT"
echo "success_count=$SUCCESS_COUNT"
echo "fail_count=$FAIL_COUNT"

# Return error code if any releases failed
if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
fi

exit 0 