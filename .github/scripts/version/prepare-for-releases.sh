#!/bin/bash
set -e

# Script to prepare for GitHub releases by ensuring all prerequisites are met
# Usage: prepare-for-releases.sh --package-paths "path1,path2" --package-names "name1,name2" [--debug true]

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
  echo "Usage: prepare-for-releases.sh --package-paths 'path1,path2' --package-names 'name1,name2' [--debug true]"
  exit 1
fi

# Debug information
if [ "$DEBUG" == "true" ]; then
  echo "DEBUG MODE ENABLED"
  echo "Package paths: $PACKAGE_PATHS"
  echo "Package names: $PACKAGE_NAMES"
  echo "Current directory: $(pwd)"
fi

# Convert comma-separated lists to arrays
IFS=',' read -ra PATHS <<< "$PACKAGE_PATHS"
IFS=',' read -ra NAMES <<< "$PACKAGE_NAMES"

# Prepare tag registry for cleanup
declare -A TAGS_TO_CREATE
declare -A PACKAGES_WITH_CHANGESETS

# Check if .changeset directory exists
if [ ! -d ".changeset" ]; then
  echo "No changesets found, nothing to clean up"
  echo "ready_for_release=true"
  exit 0
fi

# Get list of changeset files
CHANGESET_FILES=$(find .changeset -type f -not -name "README.md" -not -name "config.json")

# Identify packages with changesets
for CHANGESET_FILE in $CHANGESET_FILES; do
  if [ -z "$CHANGESET_FILE" ]; then
    continue
  fi
  
  # Extract package names using the frontmatter format (between --- lines)
  PACKAGES=$(sed -n '/^---$/,/^---$/p' "$CHANGESET_FILE" | grep -v "^---$" | grep ":" | cut -d'"' -f1 | sed 's/^[[:space:]]*//' | sed 's/:[[:space:]]*$//')
  
  # If no packages found in expected format, try alternative extraction
  if [ -z "$PACKAGES" ]; then
    PACKAGES=$(grep -o '"@[^"]*"' "$CHANGESET_FILE" | tr -d '"' || echo "")
  fi
  
  for PKG in $PACKAGES; do
    # Strip any formatting/whitespace
    PKG=$(echo "$PKG" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    PACKAGES_WITH_CHANGESETS["$PKG"]=1
  done
done

# Check package versions and prepare for release
PACKAGES_CHECKED=0
PACKAGES_WITH_ISSUES=0
PACKAGE_ISSUES=()

for i in "${!PATHS[@]}"; do
  PATH_ITEM="${PATHS[$i]}"
  NAME_ITEM="${NAMES[$i]}"
  PACKAGES_CHECKED=$((PACKAGES_CHECKED + 1))
  
  # Check if package.json exists
  if [ ! -f "$PATH_ITEM/package.json" ]; then
    echo "ERROR: package.json not found at $PATH_ITEM"
    PACKAGES_WITH_ISSUES=$((PACKAGES_WITH_ISSUES + 1))
    PACKAGE_ISSUES+=("$NAME_ITEM: ERROR - package.json not found")
    continue
  fi
  
  # Get version from package.json
  VERSION=$(node -p "require('./$PATH_ITEM/package.json').version" 2>/dev/null || echo "unknown")
  
  if [ "$VERSION" == "unknown" ]; then
    echo "ERROR: Failed to extract version for $NAME_ITEM from $PATH_ITEM/package.json"
    PACKAGES_WITH_ISSUES=$((PACKAGES_WITH_ISSUES + 1))
    PACKAGE_ISSUES+=("$NAME_ITEM: ERROR - version extraction failed")
    continue
  fi
  
  # Check if this package has a changeset
  if [ ${PACKAGES_WITH_CHANGESETS["$NAME_ITEM"]+isset} ]; then
    HAS_CHANGESET=true
  else
    HAS_CHANGESET=false
  fi
  
  # Build tag names
  TAG_NAME="${NAME_ITEM}@${VERSION}"
  CLEAN_PKG_NAME=$(echo "$NAME_ITEM" | sed 's/@//g' | sed 's/\//-/g')
  ALT_TAG_NAME="${CLEAN_PKG_NAME}@${VERSION}"
  
  # Verify if tag exists for this version
  TAG_EXISTS=$(git tag -l "$TAG_NAME")
  ALT_TAG_EXISTS=$(git tag -l "$ALT_TAG_NAME")
  
  if [ "$DEBUG" == "true" ]; then
    echo "DEBUG: $NAME_ITEM v$VERSION - changeset: $HAS_CHANGESET, tag: $TAG_EXISTS, alt tag: $ALT_TAG_EXISTS"
  fi
  
  # Store tags that need to be created (packages with no tags but should have them)
  if [ -z "$TAG_EXISTS" ] && [ -z "$ALT_TAG_EXISTS" ]; then
    TAGS_TO_CREATE["$NAME_ITEM"]="$VERSION"
    
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG: Added $NAME_ITEM@$VERSION to tags to create"
    fi
  fi
done

# Report preparation results
echo "----- Release Preparation Summary -----"
if [ "${#PACKAGE_ISSUES[@]}" -gt 0 ]; then
  echo "Issues found:"
  for ISSUE in "${PACKAGE_ISSUES[@]}"; do
    echo "  - $ISSUE"
  done
fi

TAGS_TO_CREATE_COUNT=${#TAGS_TO_CREATE[@]}
if [ $TAGS_TO_CREATE_COUNT -gt 0 ]; then
  echo "Packages needing tags ($TAGS_TO_CREATE_COUNT):"
  for PKG in "${!TAGS_TO_CREATE[@]}"; do
    VERSION="${TAGS_TO_CREATE[$PKG]}"
    echo "  - $PKG@$VERSION"
  done
else
  echo "All packages have appropriate tags"
fi
echo "----------------------------------"

# Determine if we're ready for release
if [ $PACKAGES_WITH_ISSUES -eq 0 ] && [ $TAGS_TO_CREATE_COUNT -eq 0 ]; then
  echo "✅ System is ready for release"
  echo "ready_for_release=true"
  echo "packages_checked=$PACKAGES_CHECKED"
  echo "tags_to_create=0"
else
  echo "⚠️ System needs preparation before release"
  echo "ready_for_release=false"
  echo "packages_checked=$PACKAGES_CHECKED"
  echo "packages_with_issues=$PACKAGES_WITH_ISSUES"
  echo "tags_to_create=$TAGS_TO_CREATE_COUNT"
  
  # Output JSON of tags to create for consumption by other scripts
  if [ $TAGS_TO_CREATE_COUNT -gt 0 ]; then
    # Create JSON array of objects with package and version
    TAGS_JSON="["
    FIRST=true
    for PKG in "${!TAGS_TO_CREATE[@]}"; do
      VERSION="${TAGS_TO_CREATE[$PKG]}"
      if [ "$FIRST" = true ]; then
        FIRST=false
      else
        TAGS_JSON="$TAGS_JSON,"
      fi
      
      # Extract clean package name for JSON
      CLEAN_NAME=$(echo "$PKG" | sed 's/@littlecarlito\///g')
      TAGS_JSON="$TAGS_JSON{\"package\":\"$CLEAN_NAME\",\"version\":\"$VERSION\"}"
    done
    TAGS_JSON="$TAGS_JSON]"
    
    echo "tags_json=$TAGS_JSON"
  fi
fi

exit 0 