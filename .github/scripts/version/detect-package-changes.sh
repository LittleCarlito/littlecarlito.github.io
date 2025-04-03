#!/bin/bash
# detect-package-changes.sh
# Detects which packages have actual code changes since their last tag or version

set -e

# Default values
DEBUG="false"
VERBOSE="false"

# Parse arguments
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
    --verbose)
      VERBOSE="$2"
      shift 2
      ;;
    --help)
      echo "Usage: detect-package-changes.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --package-paths <paths>   Comma-separated list of package directories"
      echo "  --package-names <names>   Comma-separated list of package names"
      echo "  --debug <true|false>      Enable debug output"
      echo "  --verbose <true|false>    Enable verbose output"
      echo "  --help                    Display this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Function to log debug information
debug_log() {
  if [[ "$DEBUG" == "true" ]]; then
    echo "DEBUG: $1" >&2
  fi
}

# Function to log verbose information
verbose_log() {
  if [[ "$VERBOSE" == "true" || "$DEBUG" == "true" ]]; then
    echo "$1" >&2
  fi
}

# Check required parameters
if [[ -z "$PACKAGE_PATHS" ]]; then
  echo "Error: --package-paths is required"
  exit 1
fi

if [[ -z "$PACKAGE_NAMES" ]]; then
  echo "Error: --package-names is required"
  exit 1
fi

# Convert comma-separated lists to arrays
IFS=',' read -ra NAME_ARRAY <<< "$PACKAGE_NAMES"
IFS=',' read -ra PATH_ARRAY <<< "$PACKAGE_PATHS"

# Validate arrays have the same length
if [[ ${#NAME_ARRAY[@]} -ne ${#PATH_ARRAY[@]} ]]; then
  echo "Error: Number of package names must match number of package paths"
  exit 1
fi

# Initialize results
CHANGED_PACKAGES=""
CHANGED_PATHS=""
TOTAL_PACKAGES=${#NAME_ARRAY[@]}
CHANGED_COUNT=0

# Process each package
for i in "${!NAME_ARRAY[@]}"; do
  PKG_NAME="${NAME_ARRAY[$i]}"
  PKG_PATH="${PATH_ARRAY[$i]}"
  
  verbose_log "Checking package: $PKG_NAME at path: $PKG_PATH"
  
  # Check if package.json exists
  if [[ ! -f "$PKG_PATH/package.json" ]]; then
    verbose_log "Warning: No package.json found at $PKG_PATH, skipping"
    continue
  fi
  
  # Get current version from package.json
  VERSION=$(grep -o '"version": *"[^"]*"' "$PKG_PATH/package.json" | cut -d'"' -f4)
  if [[ -z "$VERSION" ]]; then
    verbose_log "Warning: Could not determine version for $PKG_NAME, skipping"
    continue
  fi
  
  # Construct tag name
  TAG_NAME="${PKG_NAME}@${VERSION}"
  
  # Check if tag exists
  if git rev-parse -q --verify "refs/tags/$TAG_NAME" > /dev/null; then
    debug_log "Tag $TAG_NAME exists, checking for changes since tag"
    
    # Get the commit hash for this tag
    TAG_COMMIT=$(git rev-list -n 1 "tags/$TAG_NAME")
    
    # Check for changes in package directory since tag
    CHANGES=$(git diff --name-only "$TAG_COMMIT..HEAD" -- "$PKG_PATH")
    
    if [[ -n "$CHANGES" ]]; then
      verbose_log "Changes detected in $PKG_NAME since $TAG_NAME:"
      
      if [[ "$VERBOSE" == "true" || "$DEBUG" == "true" ]]; then
        echo "$CHANGES" | head -5 >&2
        CHANGE_COUNT=$(echo "$CHANGES" | wc -l)
        if [[ "$CHANGE_COUNT" -gt 5 ]]; then
          echo "... and $((CHANGE_COUNT - 5)) more files" >&2
        fi
      fi
      
      # Add package to changed lists
      if [[ -z "$CHANGED_PACKAGES" ]]; then
        CHANGED_PACKAGES="$PKG_NAME"
        CHANGED_PATHS="$PKG_PATH"
      else
        CHANGED_PACKAGES="$CHANGED_PACKAGES,$PKG_NAME"
        CHANGED_PATHS="$CHANGED_PATHS,$PKG_PATH"
      fi
      
      CHANGED_COUNT=$((CHANGED_COUNT + 1))
    else
      verbose_log "No changes detected in $PKG_NAME since $TAG_NAME"
    fi
  else
    # If tag doesn't exist, treat as a new package that needs versioning
    verbose_log "Tag $TAG_NAME does not exist, marking $PKG_NAME as changed (new package)"
    
    # Add package to changed lists
    if [[ -z "$CHANGED_PACKAGES" ]]; then
      CHANGED_PACKAGES="$PKG_NAME"
      CHANGED_PATHS="$PKG_PATH"
    else
      CHANGED_PACKAGES="$CHANGED_PACKAGES,$PKG_NAME"
      CHANGED_PATHS="$CHANGED_PATHS,$PKG_PATH"
    fi
    
    CHANGED_COUNT=$((CHANGED_COUNT + 1))
  fi
done

# Output results
echo "changed_packages=$CHANGED_PACKAGES"
echo "changed_paths=$CHANGED_PATHS"
echo "total_packages=$TOTAL_PACKAGES"
echo "changed_count=$CHANGED_COUNT"

verbose_log "Detection complete: $CHANGED_COUNT of $TOTAL_PACKAGES packages have changes"

# Exit with success if any packages changed, error if none changed
if [[ "$CHANGED_COUNT" -gt 0 ]]; then
  exit 0
else
  # Return specific error code 3 for "no changes detected" scenario
  exit 3
fi 