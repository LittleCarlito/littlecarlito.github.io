#!/bin/bash
set -e

# Script to detect and clean stale changesets
# A stale changeset is one where the version bump has already been applied
# but the changeset file still exists in the .changeset directory
# Usage: detect-stale-changesets.sh [--force-cleanup true] [--debug true]

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
  echo "stale_changesets=not_found"
  exit 0
fi

# Get list of package.json files to check versions
PACKAGE_JSON_FILES=$(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/dist/*")

if [ "$DEBUG" == "true" ]; then
  echo "DEBUG: Found $(echo "$PACKAGE_JSON_FILES" | wc -l) package.json files"
fi

# Count changeset files (excluding README.md and config.json)
CHANGESET_FILES=$(find .changeset -type f -not -name "README.md" -not -name "config.json")
CHANGESET_COUNT=$(echo "$CHANGESET_FILES" | wc -l | tr -d ' ')

if [ -z "$CHANGESET_FILES" ]; then
  echo "No changeset files found in .changeset directory"
  echo "stale_changesets=0"
  echo "total_changesets=0"
  exit 0
fi

if [ "$DEBUG" == "true" ]; then
  echo "DEBUG: Found $CHANGESET_COUNT changeset files"
  echo "$CHANGESET_FILES"
fi

# Create package version map
declare -A PACKAGE_VERSIONS
for PKG_JSON in $PACKAGE_JSON_FILES; do
  PKG_NAME=$(node -p "require('$PKG_JSON').name" 2>/dev/null || echo "")
  PKG_VERSION=$(node -p "require('$PKG_JSON').version" 2>/dev/null || echo "")
  
  if [ -n "$PKG_NAME" ] && [ -n "$PKG_VERSION" ]; then
    PACKAGE_VERSIONS["$PKG_NAME"]="$PKG_VERSION"
    
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG: Package $PKG_NAME version: $PKG_VERSION"
    fi
  fi
done

# Check each changeset file for already applied version bumps
STALE_CHANGESETS=0
STALE_CHANGESET_FILES=()

for CHANGESET_FILE in $CHANGESET_FILES; do
  if [ "$DEBUG" == "true" ]; then
    echo "DEBUG: Checking changeset file $CHANGESET_FILE"
    cat "$CHANGESET_FILE"
  fi
  
  # Extract package names using the frontmatter format (between --- lines)
  PACKAGES=$(sed -n '/^---$/,/^---$/p' "$CHANGESET_FILE" | grep -v "^---$" | grep ":" | cut -d'"' -f1 | sed 's/^[[:space:]]*//' | sed 's/:[[:space:]]*$//')
  
  # If no packages found in expected format, try alternative extraction
  if [ -z "$PACKAGES" ]; then
    PACKAGES=$(grep -o '"@[^"]*"' "$CHANGESET_FILE" | tr -d '"' || echo "")
  fi
  
  if [ -z "$PACKAGES" ]; then
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG: No packages found in $CHANGESET_FILE, marking as stale"
    fi
    STALE_CHANGESETS=$((STALE_CHANGESETS + 1))
    STALE_CHANGESET_FILES+=("$CHANGESET_FILE")
    continue
  fi
  
  # Check each package mentioned in the changeset
  IS_STALE=true
  for PKG in $PACKAGES; do
    # Strip any formatting/whitespace
    PKG=$(echo "$PKG" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    
    # Check if this package's bump has been applied already
    if [ "${PACKAGE_VERSIONS[$PKG]+isset}" ]; then
      # Extract bump type from changeset
      BUMP_TYPE=$(grep -A 1 "$PKG" "$CHANGESET_FILE" | grep -oE "major|minor|patch")
      
      if [ -z "$BUMP_TYPE" ]; then
        # Can't determine bump type, consider it not stale
        IS_STALE=false
        if [ "$DEBUG" == "true" ]; then
          echo "DEBUG: Could not determine bump type for $PKG in $CHANGESET_FILE"
        fi
      else
        # Package exists in the version map, check if the changeset was created
        # before the last version bump (using file modification time)
        PKG_VERSION="${PACKAGE_VERSIONS[$PKG]}"
        CHANGESET_MOD_TIME=$(stat -c %Y "$CHANGESET_FILE" 2>/dev/null || stat -f %m "$CHANGESET_FILE")
        
        # Get the time when the version might have been bumped (best approximation)
        # Look for commits with version bump messages
        LAST_VERSION_COMMIT=$(git log -n 20 --pretty=format:"%H %at %s" | grep -E "chore: version|version packages" | head -1)
        
        if [ -n "$LAST_VERSION_COMMIT" ]; then
          COMMIT_TIME=$(echo "$LAST_VERSION_COMMIT" | awk '{print $2}')
          COMMIT_HASH=$(echo "$LAST_VERSION_COMMIT" | awk '{print $1}')
          
          if [ "$DEBUG" == "true" ]; then
            echo "DEBUG: Last version commit: $COMMIT_HASH at $(date -r $COMMIT_TIME) ($COMMIT_TIME)"
            echo "DEBUG: Changeset mod time: $(date -r $CHANGESET_MOD_TIME) ($CHANGESET_MOD_TIME)"
          fi
          
          # If changeset is older than the last version bump, it's likely stale
          if [ "$CHANGESET_MOD_TIME" -lt "$COMMIT_TIME" ]; then
            if [ "$DEBUG" == "true" ]; then
              echo "DEBUG: Changeset file for $PKG is older than last version bump, likely stale"
            fi
            # Keep IS_STALE as true
          else
            IS_STALE=false
            if [ "$DEBUG" == "true" ]; then
              echo "DEBUG: Changeset file for $PKG is newer than last version bump, not stale"
            fi
          fi
        else
          # Another approach: check if package.json has been modified since changeset creation
          for PKG_JSON in $PACKAGE_JSON_FILES; do
            PKG_NAME_CHECK=$(node -p "require('$PKG_JSON').name" 2>/dev/null || echo "")
            if [ "$PKG_NAME_CHECK" == "$PKG" ]; then
              PKG_JSON_MOD_TIME=$(stat -c %Y "$PKG_JSON" 2>/dev/null || stat -f %m "$PKG_JSON")
              if [ "$PKG_JSON_MOD_TIME" -gt "$CHANGESET_MOD_TIME" ]; then
                if [ "$DEBUG" == "true" ]; then
                  echo "DEBUG: package.json for $PKG is newer than changeset, likely stale"
                fi
                # Keep IS_STALE as true
              else
                IS_STALE=false
                if [ "$DEBUG" == "true" ]; then
                  echo "DEBUG: package.json for $PKG is older than changeset, not stale"
                fi
              fi
              break
            fi
          done
        fi
      fi
    else
      # Package not found, assume the changeset is not stale
      IS_STALE=false
      if [ "$DEBUG" == "true" ]; then
        echo "DEBUG: Package $PKG not found in version map, assuming not stale"
      fi
    fi
    
    # If any package is not stale, the changeset is not stale
    if [ "$IS_STALE" == "false" ]; then
      break
    fi
  done
  
  if [ "$IS_STALE" == "true" ]; then
    echo "Stale changeset detected: $CHANGESET_FILE"
    STALE_CHANGESETS=$((STALE_CHANGESETS + 1))
    STALE_CHANGESET_FILES+=("$CHANGESET_FILE")
  fi
done

# Report status
echo "Found $STALE_CHANGESETS stale changesets out of $CHANGESET_COUNT total"
echo "stale_changesets=$STALE_CHANGESETS"
echo "total_changesets=$CHANGESET_COUNT"

# Clean up if requested
if [ "$FORCE_CLEANUP" == "true" ] && [ $STALE_CHANGESETS -gt 0 ]; then
  echo "Cleaning up stale changesets..."
  
  for STALE_FILE in "${STALE_CHANGESET_FILES[@]}"; do
    if [ -f "$STALE_FILE" ]; then
      echo "Removing $STALE_FILE"
      rm -f "$STALE_FILE"
    fi
  done
  
  # Check if we need to commit the changes
  if [ -n "$(git status --porcelain .changeset)" ]; then
    echo "cleanup_performed=true"
  else
    echo "cleanup_performed=false"
  fi
else
  echo "cleanup_performed=false"
fi

exit 0 