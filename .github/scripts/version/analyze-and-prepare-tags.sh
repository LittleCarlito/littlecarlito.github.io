#!/bin/bash
set -e

# Script to analyze existing tags and prepare JSON for tag deletion
# Usage: analyze-and-prepare-tags.sh --package-paths "path1,path2" --package-names "name1,name2" [--debug true]

PACKAGE_PATHS=""
PACKAGE_NAMES=""
DEBUG="false"

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
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$PACKAGE_PATHS" ] || [ -z "$PACKAGE_NAMES" ]; then
  echo "ERROR: package-paths and package-names are required arguments"
  echo "Usage: analyze-and-prepare-tags.sh --package-paths 'path1,path2' --package-names 'name1,name2' [--debug true]"
  exit 1
fi

# Debug information
if [ "$DEBUG" == "true" ]; then
  echo "DEBUG MODE ENABLED"
  echo "Package paths: $PACKAGE_PATHS"
  echo "Package names: $PACKAGE_NAMES"
  echo "Current directory: $(pwd)"
fi

# Fetch all tags to ensure we have the latest from remote
echo "Fetching all tags from remote..."
git fetch --tags --force

# Convert comma-separated lists to arrays
IFS=',' read -ra PATHS <<< "$PACKAGE_PATHS"
IFS=',' read -ra NAMES <<< "$PACKAGE_NAMES"

# Initialize JSON array for conflicting tags
TAGS_TO_DELETE="["
FIRST=true

# Get current versions from package.json files
for i in "${!PATHS[@]}"; do
  PATH_ITEM="${PATHS[$i]}"
  NAME_ITEM="${NAMES[$i]}"
  
  if [ -f "$PATH_ITEM/package.json" ]; then
    VERSION=$(node -p "require('./$PATH_ITEM/package.json').version")
    
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG: Package $NAME_ITEM has version $VERSION in package.json"
    fi
    
    # Check if tag already exists (both locally and remotely)
    TAG_NAME="${NAME_ITEM}@${VERSION}"
    TAG_EXISTS_LOCAL=$(git tag -l "$TAG_NAME")
    TAG_EXISTS_REMOTE=$(git ls-remote --tags origin "refs/tags/$TAG_NAME" 2>/dev/null)
    
    # Extract package name without scope for alternative format checking
    CLEAN_PKG_NAME=$(echo "$NAME_ITEM" | sed 's/@//g' | sed 's/\//-/g')
    ALT_TAG_NAME="${CLEAN_PKG_NAME}@${VERSION}"
    ALT_TAG_EXISTS_LOCAL=$(git tag -l "$ALT_TAG_NAME")
    ALT_TAG_EXISTS_REMOTE=$(git ls-remote --tags origin "refs/tags/$ALT_TAG_NAME" 2>/dev/null)
    
    # If tag exists in either format, add to deletion list
    if [ -n "$TAG_EXISTS_LOCAL" ] || [ -n "$TAG_EXISTS_REMOTE" ] || [ -n "$ALT_TAG_EXISTS_LOCAL" ] || [ -n "$ALT_TAG_EXISTS_REMOTE" ]; then
      if [ "$DEBUG" == "true" ]; then
        echo "DEBUG: Found conflicting tag(s) for $NAME_ITEM@$VERSION"
        [ -n "$TAG_EXISTS_LOCAL" ] && echo "DEBUG: Local tag: $TAG_NAME"
        [ -n "$TAG_EXISTS_REMOTE" ] && echo "DEBUG: Remote tag: $TAG_NAME"
        [ -n "$ALT_TAG_EXISTS_LOCAL" ] && echo "DEBUG: Local alt tag: $ALT_TAG_NAME"
        [ -n "$ALT_TAG_EXISTS_REMOTE" ] && echo "DEBUG: Remote alt tag: $ALT_TAG_NAME"
      fi
      
      # Extract clean package name without scope for JSON
      PACKAGE_NAME_FOR_JSON=$(echo "$NAME_ITEM" | sed 's/@littlecarlito\///g')
      
      # Add to JSON array
      if [ "$FIRST" = true ]; then
        FIRST=false
      else
        TAGS_TO_DELETE="$TAGS_TO_DELETE,"
      fi
      
      TAGS_TO_DELETE="$TAGS_TO_DELETE{\"package\":\"$PACKAGE_NAME_FOR_JSON\",\"version\":\"$VERSION\"}"
    else
      if [ "$DEBUG" == "true" ]; then
        echo "DEBUG: No conflicting tags found for $NAME_ITEM@$VERSION"
      fi
    fi
  else
    echo "⚠️ Warning: package.json not found at $PATH_ITEM"
  fi
done

# Close JSON array
TAGS_TO_DELETE="$TAGS_TO_DELETE]"

# If no tags found to delete, make it an empty array
if [ "$TAGS_TO_DELETE" == "[]" ]; then
  echo "No conflicting tags found."
  NEEDS_CLEANUP="false"
else
  echo "Found conflicting tags to clean up:"
  echo "$TAGS_TO_DELETE" | jq '.'
  NEEDS_CLEANUP="true"
fi

# Output the results to be captured by the calling workflow
echo "tags_json=$TAGS_TO_DELETE" 
echo "needs_cleanup=$NEEDS_CLEANUP"

exit 0 