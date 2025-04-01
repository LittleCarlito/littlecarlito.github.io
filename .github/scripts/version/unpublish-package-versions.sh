#!/bin/bash

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script unpublishes specific package versions from the GitHub Packages registry.

Options:
  --token TOKEN             GitHub token for authentication (required)
  --registry URL            Registry URL (default: https://npm.pkg.github.com)
  --package PKG             Package name including scope (e.g., @littlecarlito/blorktools)
  --version VER             Version to unpublish (e.g., 1.13.0)
  --scope SCOPE             NPM scope (default: @littlecarlito)
  --unpublish-tag BOOL      Whether to also delete corresponding git tag (default: true)
  --repository REPO         Repository name (owner/repo) for tag deletion
  --dry-run BOOL            Show what would be done without actually doing it (default: false)
  --help                    Display this help and exit

Example:
  $(basename "$0") --token "gh_token" --package "@littlecarlito/blorktools" --version "1.13.0" --repository "LittleCarlito/threejs_site"
EOF
}

# Default values
REGISTRY="https://npm.pkg.github.com"
SCOPE="@littlecarlito"
UNPUBLISH_TAG="true"
DRY_RUN="false"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --package)
      PACKAGE="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    --unpublish-tag)
      UNPUBLISH_TAG="$2"
      shift 2
      ;;
    --repository)
      REPOSITORY="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$TOKEN" ]]; then
  echo "Error: GitHub token is required" >&2
  show_help
  exit 1
fi

if [[ -z "$PACKAGE" ]]; then
  echo "Error: Package name is required" >&2
  show_help
  exit 1
fi

if [[ -z "$VERSION" ]]; then
  echo "Error: Version is required" >&2
  show_help
  exit 1
fi

if [[ "$UNPUBLISH_TAG" == "true" && -z "$REPOSITORY" ]]; then
  echo "Error: Repository is required when unpublish-tag is true" >&2
  show_help
  exit 1
fi

# Setup headers for GitHub API requests
HEADER_AUTH="Authorization: Bearer $TOKEN"
HEADER_ACCEPT="Accept: application/vnd.github+json"

# Normalize package name if needed
if [[ ! "$PACKAGE" == $SCOPE* ]]; then
  PACKAGE="$SCOPE/$PACKAGE"
  echo "Normalized package name to $PACKAGE" >&2
fi

# Convert package name for use in npm commands
NPM_PACKAGE=$(echo "$PACKAGE" | sed 's/@//')

echo "===========================================" >&2
echo "Unpublishing $PACKAGE@$VERSION" >&2
echo "===========================================" >&2

# Create npmrc file for authentication
if [[ "$DRY_RUN" == "false" ]]; then
  echo "Setting up npm authentication for GitHub Packages..." >&2
  NPM_CONFIG_FILE=$(mktemp)
  echo "@${SCOPE#@}:registry=$REGISTRY" > "$NPM_CONFIG_FILE"
  echo "$REGISTRY/:_authToken=$TOKEN" >> "$NPM_CONFIG_FILE"
else
  echo "[DRY RUN] Would set up npm authentication" >&2
fi

# Unpublish the package version
if [[ "$DRY_RUN" == "false" ]]; then
  echo "Unpublishing $PACKAGE@$VERSION from registry..." >&2
  UNPUBLISH_OUTPUT=$(npm unpublish --force "$PACKAGE@$VERSION" --registry "$REGISTRY" --userconfig "$NPM_CONFIG_FILE" 2>&1) || {
    echo "Error unpublishing package: $UNPUBLISH_OUTPUT" >&2
    rm -f "$NPM_CONFIG_FILE"
    exit 1
  }
  echo "$UNPUBLISH_OUTPUT" >&2
  rm -f "$NPM_CONFIG_FILE"
else
  echo "[DRY RUN] Would run: npm unpublish --force $PACKAGE@$VERSION --registry $REGISTRY" >&2
fi

# Remove corresponding Git tag if requested
if [[ "$UNPUBLISH_TAG" == "true" ]]; then
  # Format tag names (try both formats)
  TAG_NAME="${PACKAGE}@${VERSION}"
  CLEAN_PKG_NAME=$(echo "$PACKAGE" | sed 's/@//g' | sed 's/\//-/g')
  ALT_TAG_NAME="${CLEAN_PKG_NAME}@${VERSION}"
  
  # Check if either tag exists
  echo "Checking for tag: $TAG_NAME" >&2
  TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    "https://api.github.com/repos/$REPOSITORY/git/refs/tags/$TAG_NAME" | grep -c "\"ref\"")
  
  echo "Checking for alternative tag: $ALT_TAG_NAME" >&2
  ALT_TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    "https://api.github.com/repos/$REPOSITORY/git/refs/tags/$ALT_TAG_NAME" | grep -c "\"ref\"")
  
  if [[ $TAG_EXISTS -gt 0 ]]; then
    if [[ "$DRY_RUN" == "false" ]]; then
      echo "Deleting tag: $TAG_NAME" >&2
      curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPOSITORY/git/refs/tags/$TAG_NAME" >/dev/null 2>&1
      
      if [[ $? -eq 0 ]]; then
        echo "Successfully deleted tag: $TAG_NAME" >&2
      else
        echo "Failed to delete tag: $TAG_NAME" >&2
      fi
    else
      echo "[DRY RUN] Would delete tag: $TAG_NAME" >&2
    fi
  else
    echo "Tag $TAG_NAME does not exist, nothing to delete" >&2
  fi
  
  if [[ $ALT_TAG_EXISTS -gt 0 ]]; then
    if [[ "$DRY_RUN" == "false" ]]; then
      echo "Deleting alternative tag: $ALT_TAG_NAME" >&2
      curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPOSITORY/git/refs/tags/$ALT_TAG_NAME" >/dev/null 2>&1
      
      if [[ $? -eq 0 ]]; then
        echo "Successfully deleted tag: $ALT_TAG_NAME" >&2
      else
        echo "Failed to delete tag: $ALT_TAG_NAME" >&2
      fi
    else
      echo "[DRY RUN] Would delete tag: $ALT_TAG_NAME" >&2
    fi
  else
    echo "Tag $ALT_TAG_NAME does not exist, nothing to delete" >&2
  fi
fi

if [[ "$DRY_RUN" == "false" ]]; then
  echo "Unpublish operation completed for $PACKAGE@$VERSION" >&2
  echo "unpublished=true"
  echo "package=$PACKAGE"
  echo "version=$VERSION"
else
  echo "[DRY RUN] Unpublish operation would be completed for $PACKAGE@$VERSION" >&2
  echo "unpublished=false"
  echo "package=$PACKAGE"
  echo "version=$VERSION"
fi

exit 0 