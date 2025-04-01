#!/bin/bash

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script ensures all packages in the monorepo have corresponding Git tags based on their package.json versions.
It scans all packages and creates any missing tags.

Options:
  --token TOKEN             GitHub token for authentication (required)
  --repo REPO               Repository name in format owner/repo (default: current repo)
  --package-paths PATHS     Comma-separated list of package paths
  --package-names NAMES     Comma-separated list of package names
  --force-create BOOL       Whether to recreate tags even if they exist (default: true)
  --help                    Display this help and exit

Example:
  $(basename "$0") --token "gh_token" --repo "owner/repo" --package-paths "packages/pkg1,packages/pkg2" --package-names "@org/pkg1,@org/pkg2"
EOF
}

# Default values
REPO=""
FORCE_CREATE="true"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --package-paths)
      PACKAGE_PATHS="$2"
      shift 2
      ;;
    --package-names)
      PACKAGE_NAMES="$2"
      shift 2
      ;;
    --force-create)
      FORCE_CREATE="$2"
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

if [[ -z "$PACKAGE_PATHS" ]]; then
  echo "Error: Package paths are required" >&2
  show_help
  exit 1
fi

if [[ -z "$PACKAGE_NAMES" ]]; then
  echo "Error: Package names are required" >&2
  show_help
  exit 1
fi

# If repo is not provided, derive it from environment
if [[ -z "$REPO" && -n "$GITHUB_REPOSITORY" ]]; then
  REPO="$GITHUB_REPOSITORY"
elif [[ -z "$REPO" ]]; then
  echo "Error: Repository information not available" >&2
  exit 1
fi

# Convert comma-separated strings to arrays
IFS=',' read -ra PATH_ARRAY <<< "$PACKAGE_PATHS"
IFS=',' read -ra NAME_ARRAY <<< "$PACKAGE_NAMES"

if [[ ${#PATH_ARRAY[@]} -ne ${#NAME_ARRAY[@]} ]]; then
  echo "Error: Number of package paths must match number of package names" >&2
  exit 1
fi

# Setup headers for GitHub API requests
HEADER_AUTH="Authorization: token $TOKEN"
HEADER_ACCEPT="Accept: application/vnd.github+json"

echo "Ensuring tags exist for all packages..." >&2
TAGS_CREATED=0
TAGS_VERIFIED=0

# Process each package
for i in "${!PATH_ARRAY[@]}"; do
  PKG_PATH="${PATH_ARRAY[$i]}"
  PKG_NAME="${NAME_ARRAY[$i]}"
  
  # Get package version from package.json
  if [[ -f "$PKG_PATH/package.json" ]]; then
    VERSION=$(cat "$PKG_PATH/package.json" | grep -o '"version": "[^"]*' | cut -d'"' -f4)
    
    if [[ -n "$VERSION" ]]; then
      echo "Found version $VERSION for package $PKG_NAME" >&2
      
      # Format the tag name in npm standard format
      TAG_NAME="${PKG_NAME}@${VERSION}"
      
      # Prepare a clean package name for alternative tag format
      CLEAN_PKG_NAME=$(echo "$PKG_NAME" | sed 's/@//g' | sed 's/\//-/g')
      ALT_TAG_NAME="${CLEAN_PKG_NAME}@${VERSION}"
      
      # Check if tag already exists
      TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPO/git/refs/tags/$TAG_NAME" | grep -c "\"ref\"")
      
      ALT_TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPO/git/refs/tags/$ALT_TAG_NAME" | grep -c "\"ref\"")
      
      if [[ $TAG_EXISTS -eq 0 && $ALT_TAG_EXISTS -eq 0 || "$FORCE_CREATE" == "true" ]]; then
        echo "Creating tag $TAG_NAME for $PKG_NAME v$VERSION (standard npm format)" >&2
        
        # Delete existing tags if force create is enabled
        if [[ $TAG_EXISTS -gt 0 ]]; then
          echo "Deleting existing tag $TAG_NAME" >&2
          curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
            "https://api.github.com/repos/$REPO/git/refs/tags/$TAG_NAME" >/dev/null 2>&1
        fi
        
        if [[ $ALT_TAG_EXISTS -gt 0 ]]; then
          echo "Deleting existing tag $ALT_TAG_NAME" >&2
          curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
            "https://api.github.com/repos/$REPO/git/refs/tags/$ALT_TAG_NAME" >/dev/null 2>&1
        fi
        
        # Get latest commit SHA
        COMMIT_SHA=$(git rev-parse HEAD)
        
        # Create tag
        TAG_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
          -d "{\"tag\":\"$TAG_NAME\",\"message\":\"Release $PKG_NAME v$VERSION\",\"object\":\"$COMMIT_SHA\",\"type\":\"commit\"}" \
          "https://api.github.com/repos/$REPO/git/tags")
        
        TAG_SHA=$(echo "$TAG_RESPONSE" | grep -o '"sha": "[^"]*' | head -1 | cut -d'"' -f4)
        
        if [[ -n "$TAG_SHA" ]]; then
          # Create reference for tag
          REF_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
            -d "{\"ref\":\"refs/tags/$TAG_NAME\",\"sha\":\"$TAG_SHA\"}" \
            "https://api.github.com/repos/$REPO/git/refs")
          
          REF_URL=$(echo "$REF_RESPONSE" | grep -o '"url": "[^"]*' | head -1 | cut -d'"' -f4)
          
          if [[ -n "$REF_URL" ]]; then
            echo "Successfully created tag $TAG_NAME" >&2
            TAGS_CREATED=$((TAGS_CREATED + 1))
            
            # Create a GitHub release
            RELEASE_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
              -d "{\"tag_name\":\"$TAG_NAME\",\"name\":\"$PKG_NAME v$VERSION\",\"body\":\"Release of $PKG_NAME version $VERSION\",\"draft\":false,\"prerelease\":false}" \
              "https://api.github.com/repos/$REPO/releases")
            
            RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep -o '"id": [0-9]*' | head -1 | cut -d' ' -f2)
            
            if [[ -n "$RELEASE_ID" ]]; then
              echo "Created GitHub release for $PKG_NAME v$VERSION" >&2
            else
              echo "Warning: Failed to create GitHub release for $PKG_NAME v$VERSION" >&2
            fi
          else
            echo "Failed to create tag reference for $PKG_NAME v$VERSION" >&2
            echo "API response: $REF_RESPONSE" >&2
          fi
        else
          echo "Failed to create tag for $PKG_NAME v$VERSION" >&2
          echo "API response: $TAG_RESPONSE" >&2
        fi
      else
        echo "Tag already exists for $PKG_NAME v$VERSION, verified." >&2
        TAGS_VERIFIED=$((TAGS_VERIFIED + 1))
      fi
    else
      echo "Could not determine version for $PKG_NAME, package.json seems malformed" >&2
    fi
  else
    echo "Package.json not found at $PKG_PATH" >&2
  fi
done

echo "Tags created: $TAGS_CREATED, Tags verified: $TAGS_VERIFIED" >&2
echo "tags_created=$TAGS_CREATED"
echo "tags_verified=$TAGS_VERIFIED"
echo "total_packages=${#PATH_ARRAY[@]}"

exit 0 