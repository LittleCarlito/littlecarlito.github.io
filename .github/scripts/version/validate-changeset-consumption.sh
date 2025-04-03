#!/bin/bash
set -e

# Script to validate that changesets have been properly consumed after versioning
# Usage: validate-changeset-consumption.sh [--force-cleanup true] [--debug true]

FORCE_CLEANUP="false"
DEBUG="false"

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-cleanup)
      FORCE_CLEANUP="$2"
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

# Debug information
if [ "$DEBUG" == "true" ]; then
  echo "DEBUG MODE ENABLED"
  echo "Force cleanup: $FORCE_CLEANUP"
  echo "Current directory: $(pwd)"
fi

# Check if .changeset directory exists
if [ ! -d ".changeset" ]; then
  echo "No .changeset directory found"
  echo "changeset_status=not_found"
  exit 0
fi

# Count changeset files (excluding README.md and config.json)
CHANGESET_FILES=$(find .changeset -type f -not -name "README.md" -not -name "config.json" | wc -l | tr -d ' ')

if [ "$DEBUG" == "true" ]; then
  echo "DEBUG: Found $CHANGESET_FILES changeset files"
  find .changeset -type f -not -name "README.md" -not -name "config.json" -exec ls -la {} \;
fi

# Check if package.json versions match any existing changeset files
# This is a sign of changesets not being properly consumed
UNCONSUMED_CHANGESETS=0
PROBLEMATIC_CHANGESETS=()

# Check each changeset file for package versions that match current package.json
find .changeset -type f -not -name "README.md" -not -name "config.json" | while read -r CHANGESET_FILE; do
  if [ "$DEBUG" == "true" ]; then
    echo "DEBUG: Checking changeset file $CHANGESET_FILE"
    cat "$CHANGESET_FILE"
  fi
  
  # Extract package names from the changeset
  PACKAGES=$(grep -o '"@[^"]*"' "$CHANGESET_FILE" | tr -d '"' || echo "")
  
  if [ -z "$PACKAGES" ]; then
    # Try alternative format with --- delimiters
    PACKAGES=$(sed -n '/^---$/,/^---$/p' "$CHANGESET_FILE" | grep -v "^---$" | cut -d: -f1 | tr -d '"' | sed 's/^[[:space:]]*//' || echo "")
  fi
  
  if [ -z "$PACKAGES" ]; then
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG: No packages found in $CHANGESET_FILE, may be invalid format"
    fi
    UNCONSUMED_CHANGESETS=$((UNCONSUMED_CHANGESETS + 1))
    PROBLEMATIC_CHANGESETS+=("$CHANGESET_FILE")
    continue
  fi
  
  # Check each package
  for PKG in $PACKAGES; do
    # Strip trailing colon if present
    PKG=${PKG%:}
    
    # Try to find package path by searching package.json files
    PKG_PATH=$(find . -name "package.json" -exec grep -l "\"name\": \"$PKG\"" {} \; | head -1 | xargs dirname 2>/dev/null)
    
    if [ -z "$PKG_PATH" ]; then
      if [ "$DEBUG" == "true" ]; then
        echo "DEBUG: Could not find package.json for $PKG"
      fi
      continue
    fi
    
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG: Found package $PKG at $PKG_PATH"
    fi
    
    # Get version from changeset
    CHANGESET_VERSION=$(cat "$CHANGESET_FILE" | grep -A1 "$PKG" | tail -1 | cut -d: -f2 | tr -d ' ' || echo "")
    
    # Get version from package.json
    if [ -f "$PKG_PATH/package.json" ]; then
      PKG_VERSION=$(node -p "require('./$PKG_PATH/package.json').version" 2>/dev/null || echo "")
      
      if [ "$DEBUG" == "true" ]; then
        echo "DEBUG: $PKG - Changeset version: $CHANGESET_VERSION, Package version: $PKG_VERSION"
      fi
      
      # If we found a version and it's already been applied, this changeset wasn't consumed
      if [ -n "$PKG_VERSION" ] && [ -n "$CHANGESET_VERSION" ]; then
        case "$CHANGESET_VERSION" in
          major|minor|patch)
            # This changeset should have been consumed
            echo "Changeset $CHANGESET_FILE for $PKG has not been consumed (version: $CHANGESET_VERSION)"
            UNCONSUMED_CHANGESETS=$((UNCONSUMED_CHANGESETS + 1))
            PROBLEMATIC_CHANGESETS+=("$CHANGESET_FILE")
            ;;
        esac
      fi
    fi
  done
done

# Report status
if [ $UNCONSUMED_CHANGESETS -gt 0 ]; then
  echo "Found $UNCONSUMED_CHANGESETS unconsumed changesets"
  echo "changeset_status=unconsumed"
  echo "unconsumed_count=$UNCONSUMED_CHANGESETS"
  
  # Clean up if requested
  if [ "$FORCE_CLEANUP" == "true" ]; then
    echo "Cleaning up unconsumed changesets..."
    
    for CHANGESET in "${PROBLEMATIC_CHANGESETS[@]}"; do
      if [ -f "$CHANGESET" ]; then
        echo "Removing $CHANGESET"
        rm -f "$CHANGESET"
      fi
    done
    
    echo "cleanup_performed=true"
  else
    echo "cleanup_performed=false"
  fi
else
  echo "All changesets appear to be consumed correctly"
  echo "changeset_status=consumed"
  echo "unconsumed_count=0"
  echo "cleanup_performed=false"
fi

exit 0 