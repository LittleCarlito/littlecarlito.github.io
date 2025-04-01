#!/bin/bash
set -e

# Script to delete git tags for packages

# Default values
NORMALIZE_NAMES=true
CHECK_BOTH_FORMATS=true
DRY_RUN=false

# Process input parameters
while [[ $# -gt 0 ]]; do
  case "$1" in
    --package)
      PACKAGE="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --normalize)
      NORMALIZE_NAMES="$2"
      shift 2
      ;;
    --check-both-formats)
      CHECK_BOTH_FORMATS="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="$2"
      shift 2
      ;;
    *)
      echo "Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$PACKAGE" ] || [ -z "$VERSION" ]; then
  echo "Error: --package and --version are required parameters"
  exit 1
fi

# Set up git config if token is provided
if [ -n "$TOKEN" ]; then
  echo "Configuring git with provided token..."
  git config --global user.name "GitHub Actions"
  git config --global user.email "actions@github.com"
fi

# Normalize package name if needed
if [[ "$NORMALIZE_NAMES" == "true" && ! "$PACKAGE" == @littlecarlito* ]]; then
  PACKAGE="@littlecarlito/$PACKAGE"
  echo "Normalized package name to $PACKAGE"
fi

# Primary tag format
TAG_NAME="${PACKAGE}@${VERSION}"
echo "Checking for tag: $TAG_NAME"

# If dry run, just show what would happen
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] Would delete tag: $TAG_NAME"
else
  # First try local deletion
  git tag -d "$TAG_NAME" 2>/dev/null && echo "Deleted local tag: $TAG_NAME" || echo "Tag $TAG_NAME doesn't exist locally"
  
  # Then try remote deletion
  git push --delete origin "$TAG_NAME" 2>/dev/null && echo "Deleted remote tag: $TAG_NAME" || echo "Tag $TAG_NAME doesn't exist on remote"
fi

# Check for alternative tag format if requested
if [[ "$CHECK_BOTH_FORMATS" == "true" ]]; then
  CLEAN_PKG_NAME=$(echo "$PACKAGE" | sed 's/@//g' | sed 's/\//-/g')
  ALT_TAG_NAME="${CLEAN_PKG_NAME}@${VERSION}"
  
  echo "Checking for alternative tag: $ALT_TAG_NAME"
  
  # If dry run, just show what would happen
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] Would delete tag: $ALT_TAG_NAME"
  else
    # Try local deletion
    git tag -d "$ALT_TAG_NAME" 2>/dev/null && echo "Deleted local tag: $ALT_TAG_NAME" || echo "Tag $ALT_TAG_NAME doesn't exist locally"
    
    # Try remote deletion
    git push --delete origin "$ALT_TAG_NAME" 2>/dev/null && echo "Deleted remote tag: $ALT_TAG_NAME" || echo "Tag $ALT_TAG_NAME doesn't exist on remote"
  fi
fi

# Return success status
echo "tag_name=$TAG_NAME"
if [[ "$CHECK_BOTH_FORMATS" == "true" ]]; then
  echo "alt_tag_name=$ALT_TAG_NAME"
fi
echo "deleted=true" 