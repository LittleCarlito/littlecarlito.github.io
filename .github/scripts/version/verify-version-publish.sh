#!/bin/bash
set -e

# Script to verify successful version and publish operations
# Checks for common issues that prevent successful version bumps and tag creation
# Usage: verify-version-publish.sh --package-paths "path1,path2" --package-names "name1,name2" [--debug true]

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
  echo "Usage: verify-version-publish.sh --package-paths 'path1,path2' --package-names 'name1,name2' [--debug true]"
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

# Check if arrays have the same length
if [ ${#PATHS[@]} -ne ${#NAMES[@]} ]; then
  echo "ERROR: package-paths and package-names must have the same number of elements"
  exit 1
fi

# Check if .changeset directory exists
if [ ! -d ".changeset" ]; then
  echo "warning=No .changeset directory found, skipping changeset verification"
  echo "verify_result=no_changesets_dir"
  exit 0
fi

# Get changeset files (excluding README.md and config.json)
CHANGESET_FILES=$(find .changeset -type f -not -name "README.md" -not -name "config.json")
CHANGESET_COUNT=$(echo "$CHANGESET_FILES" | wc -l | tr -d ' ')

if [ "$DEBUG" == "true" ]; then
  echo "DEBUG: Found $CHANGESET_COUNT changeset files"
  echo "$CHANGESET_FILES"
fi

# Check for package.json files and extract versions
PACKAGE_STATUS=()
PACKAGES_WITH_CHANGESETS=()
ALL_VERSIONS_MATCH=true
ALL_PACKAGES_FOUND=true

# First, identify which packages have changesets
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
    PACKAGES_WITH_CHANGESETS+=("$PKG")
  done
done

# Now verify package versions
for i in "${!PATHS[@]}"; do
  PATH_ITEM="${PATHS[$i]}"
  NAME_ITEM="${NAMES[$i]}"
  
  # Check if package.json exists
  if [ ! -f "$PATH_ITEM/package.json" ]; then
    echo "ERROR: package.json not found at $PATH_ITEM"
    ALL_PACKAGES_FOUND=false
    PACKAGE_STATUS+=("$NAME_ITEM: ERROR - package.json not found")
    continue
  fi
  
  # Get version from package.json
  VERSION=$(node -p "require('./$PATH_ITEM/package.json').version" 2>/dev/null || echo "unknown")
  
  if [ "$VERSION" == "unknown" ]; then
    echo "ERROR: Failed to extract version for $NAME_ITEM from $PATH_ITEM/package.json"
    ALL_VERSIONS_MATCH=false
    PACKAGE_STATUS+=("$NAME_ITEM: ERROR - version extraction failed")
    continue
  fi
  
  # Check if this package has a changeset
  HAS_CHANGESET=false
  for PKG in "${PACKAGES_WITH_CHANGESETS[@]}"; do
    if [ "$PKG" == "$NAME_ITEM" ]; then
      HAS_CHANGESET=true
      break
    fi
  done
  
  # Verify if tag exists for this version
  TAG_NAME="${NAME_ITEM}@${VERSION}"
  TAG_EXISTS=$(git tag -l "$TAG_NAME")
  
  # Also check alternative tag format
  CLEAN_PKG_NAME=$(echo "$NAME_ITEM" | sed 's/@//g' | sed 's/\//-/g')
  ALT_TAG_NAME="${CLEAN_PKG_NAME}@${VERSION}"
  ALT_TAG_EXISTS=$(git tag -l "$ALT_TAG_NAME")
  
  if [ -z "$TAG_EXISTS" ] && [ -z "$ALT_TAG_EXISTS" ]; then
    if [ "$HAS_CHANGESET" == "true" ]; then
      echo "WARNING: $NAME_ITEM has a changeset but no tag exists for version $VERSION"
      ALL_VERSIONS_MATCH=false
      PACKAGE_STATUS+=("$NAME_ITEM: WARNING - has changeset but no tag for v$VERSION")
    else
      echo "INFO: $NAME_ITEM v$VERSION has no tag and no changeset"
      PACKAGE_STATUS+=("$NAME_ITEM: INFO - v$VERSION (no tag, no changeset)")
    fi
  else
    if [ "$HAS_CHANGESET" == "true" ]; then
      echo "INFO: $NAME_ITEM has a changeset and tag exists for version $VERSION"
      PACKAGE_STATUS+=("$NAME_ITEM: INFO - has changeset and tag exists for v$VERSION")
    else
      echo "INFO: $NAME_ITEM v$VERSION has tag but no changeset"
      PACKAGE_STATUS+=("$NAME_ITEM: INFO - v$VERSION (tag exists, no changeset)")
    fi
  fi
done

# Output verification results
echo "----- Package Verification Summary -----"
for STATUS in "${PACKAGE_STATUS[@]}"; do
  echo "$STATUS"
done
echo "---------------------------------------"

if [ "$ALL_PACKAGES_FOUND" == "true" ] && [ "$ALL_VERSIONS_MATCH" == "true" ]; then
  echo "✅ All packages verified successfully"
  echo "verify_result=success"
elif [ "$ALL_PACKAGES_FOUND" == "false" ]; then
  echo "❌ Some package.json files are missing"
  echo "verify_result=missing_packages"
else
  echo "⚠️ Some package versions don't match expected state"
  echo "verify_result=version_mismatch"
fi

exit 0 