#!/bin/bash

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script ensures all packages in the monorepo have corresponding Git tags based on their package.json versions.
It scans all packages and creates any missing tags with enhanced error handling and retry mechanisms.

Options:
  --token TOKEN             GitHub token for authentication (required)
  --repo REPO               Repository name in format owner/repo (default: current repo)
  --package-paths PATHS     Comma-separated list of package paths
  --package-names NAMES     Comma-separated list of package names
  --retry-attempts NUM      Number of retry attempts for failed operations (default: 3)
  --help                    Display this help and exit

Example:
  $(basename "$0") --token "gh_token" --repo "owner/repo" --package-paths "packages/pkg1,packages/pkg2" --package-names "@org/pkg1,@org/pkg2"
EOF
}

# Default values
REPO=""
RETRY_ATTEMPTS=3

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
    --retry-attempts)
      RETRY_ATTEMPTS="$2"
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
  # Try to get repo from git remote
  REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null)
  if [[ -n "$REMOTE_URL" ]]; then
    REPO=$(echo "$REMOTE_URL" | sed -E 's/.*[:/]([^/]+\/[^/]+)(\.git)?$/\1/')
    echo "Derived repository: $REPO from git remote" >&2
  else
    echo "Error: Repository information not available" >&2
    exit 1
  fi
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

# Function to create a tag with retries
create_tag_with_retry() {
  local pkg_name=$1
  local version=$2
  local tag_name=$3
  local commit_sha=$4
  local attempts=$RETRY_ATTEMPTS
  local success=false
  
  echo "Creating tag $tag_name for $pkg_name v$version with up to $attempts attempts" >&2
  
  while [[ $attempts -gt 0 && "$success" != "true" ]]; do
    # Create annotated tag
    TAG_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      -d "{\"tag\":\"$tag_name\",\"message\":\"Release $pkg_name v$version\",\"object\":\"$commit_sha\",\"type\":\"commit\"}" \
      "https://api.github.com/repos/$REPO/git/tags")
    
    TAG_SHA=$(echo "$TAG_RESPONSE" | grep -o '"sha": "[^"]*' | head -1 | cut -d'"' -f4)
    
    if [[ -n "$TAG_SHA" ]]; then
      # Create reference for tag
      REF_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        -d "{\"ref\":\"refs/tags/$tag_name\",\"sha\":\"$TAG_SHA\"}" \
        "https://api.github.com/repos/$REPO/git/refs")
      
      REF_URL=$(echo "$REF_RESPONSE" | grep -o '"url": "[^"]*' | head -1 | cut -d'"' -f4)
      
      if [[ -n "$REF_URL" ]]; then
        echo "Successfully created tag $tag_name on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
        success=true
        break
      else
        echo "Failed to create tag reference on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
        if [[ $attempts -gt 1 ]]; then
          echo "API response: $REF_RESPONSE" >&2
          echo "Retrying in 3 seconds..." >&2
          sleep 3
        fi
      fi
    else
      echo "Failed to create tag object on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      if [[ $attempts -gt 1 ]]; then
        echo "API response: $TAG_RESPONSE" >&2
        echo "Retrying in 3 seconds..." >&2
        sleep 3
      fi
    fi
    
    attempts=$((attempts - 1))
  done
  
  echo "$success"
}

# Function to create a release for a tag
create_release_for_tag() {
  local pkg_name=$1
  local version=$2
  local tag_name=$3
  local attempts=$RETRY_ATTEMPTS
  local success=false
  
  echo "Creating GitHub release for $tag_name with up to $attempts attempts" >&2
  
  while [[ $attempts -gt 0 && "$success" != "true" ]]; do
    RELEASE_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      -d "{\"tag_name\":\"$tag_name\",\"name\":\"$pkg_name v$version\",\"body\":\"Release of $pkg_name version $version\",\"draft\":false,\"prerelease\":false}" \
      "https://api.github.com/repos/$REPO/releases")
    
    RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep -o '"id": [0-9]*' | head -1 | cut -d' ' -f2)
    
    if [[ -n "$RELEASE_ID" ]]; then
      echo "Created GitHub release for $pkg_name v$version on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      success=true
      break
    else
      echo "Failed to create GitHub release on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      if [[ $attempts -gt 1 ]]; then
        echo "API response: $RELEASE_RESPONSE" >&2
        echo "Retrying in 3 seconds..." >&2
        sleep 3
      fi
    fi
    
    attempts=$((attempts - 1))
  done
  
  echo "$success"
}

# Function to aggressively delete a tag if it exists
delete_tag_if_exists() {
  local tag_name=$1
  local attempts=$RETRY_ATTEMPTS
  local success=false
  
  # Check if tag exists
  TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    "https://api.github.com/repos/$REPO/git/refs/tags/$tag_name" | grep -c "\"ref\"")
  
  if [[ $TAG_EXISTS -eq 0 ]]; then
    echo "Tag $tag_name does not exist, no need to delete" >&2
    return 0
  fi
  
  echo "Deleting existing tag $tag_name with up to $attempts attempts" >&2
  
  while [[ $attempts -gt 0 && "$success" != "true" ]]; do
    DELETE_RESPONSE=$(curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      "https://api.github.com/repos/$REPO/git/refs/tags/$tag_name")
    
    # Check if successful (DELETE returns 204 No Content when successful)
    if [[ -z "$DELETE_RESPONSE" ]]; then
      echo "Successfully deleted tag $tag_name on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      success=true
      break
    else
      echo "Failed to delete tag on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      if [[ $attempts -gt 1 ]]; then
        echo "API response: $DELETE_RESPONSE" >&2
        echo "Retrying in 3 seconds..." >&2
        sleep 3
      fi
    fi
    
    attempts=$((attempts - 1))
  done
  
  # After deletion, verify it's really gone
  TAG_STILL_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    "https://api.github.com/repos/$REPO/git/refs/tags/$tag_name" | grep -c "\"ref\"")
  
  if [[ $TAG_STILL_EXISTS -gt 0 ]]; then
    echo "Warning: Tag $tag_name still exists after deletion attempts" >&2
    return 1
  fi
  
  return 0
}

echo "Ensuring tags exist for all packages with enhanced error handling..." >&2
TAGS_CREATED=0
TAGS_VERIFIED=0
TAGS_FAILED=0

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
      
      echo "Primary tag format: $TAG_NAME" >&2
      echo "Alternative tag format: $ALT_TAG_NAME" >&2
      
      # Check if tags need to be handled
      # Only create if tag doesn't exist
      TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPO/git/refs/tags/$TAG_NAME" | grep -c "\"ref\"")
      
      ALT_TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPO/git/refs/tags/$ALT_TAG_NAME" | grep -c "\"ref\"")
      
      if [[ $TAG_EXISTS -eq 0 && $ALT_TAG_EXISTS -eq 0 ]]; then
        # Get latest commit SHA
        COMMIT_SHA=$(git rev-parse HEAD)
        
        # Create tag with retry
        CREATE_RESULT=$(create_tag_with_retry "$PKG_NAME" "$VERSION" "$TAG_NAME" "$COMMIT_SHA")
        
        if [[ "$CREATE_RESULT" == "true" ]]; then
          TAGS_CREATED=$((TAGS_CREATED + 1))
          
          # Create release for the tag
          RELEASE_RESULT=$(create_release_for_tag "$PKG_NAME" "$VERSION" "$TAG_NAME")
          
          if [[ "$RELEASE_RESULT" != "true" ]]; then
            echo "Warning: Created tag but failed to create release for $PKG_NAME v$VERSION" >&2
          fi
        else
          TAGS_FAILED=$((TAGS_FAILED + 1))
          echo "Failed to create tag for $PKG_NAME v$VERSION after $RETRY_ATTEMPTS attempts" >&2
        fi
      else
        echo "Tag already exists for $PKG_NAME v$VERSION, verified." >&2
        TAGS_VERIFIED=$((TAGS_VERIFIED + 1))
      fi
    else
      echo "Could not determine version for $PKG_NAME, package.json seems malformed" >&2
      # Try alternative methods to find version
      if [[ -d "$PKG_PATH/node_modules" ]]; then
        echo "Attempting to find version from node_modules directory..." >&2
        PKG_VERSION_FILE="$PKG_PATH/node_modules/$PKG_NAME/package.json"
        if [[ -f "$PKG_VERSION_FILE" ]]; then
          VERSION=$(cat "$PKG_VERSION_FILE" | grep -o '"version": "[^"]*' | cut -d'"' -f4)
          if [[ -n "$VERSION" ]]; then
            echo "Found version $VERSION from node_modules for $PKG_NAME" >&2
            # Proceed with tagging using this version
            # (similar logic to above, could extract to a function)
          fi
        fi
      fi
    fi
  else
    echo "Package.json not found at $PKG_PATH" >&2
    # Try to find package.json in subdirectories
    POTENTIAL_PKG_JSON=$(find "$PKG_PATH" -name "package.json" -not -path "*/node_modules/*" -not -path "*/dist/*" | head -1)
    if [[ -n "$POTENTIAL_PKG_JSON" ]]; then
      echo "Found alternative package.json at $POTENTIAL_PKG_JSON" >&2
      VERSION=$(cat "$POTENTIAL_PKG_JSON" | grep -o '"version": "[^"]*' | cut -d'"' -f4)
      if [[ -n "$VERSION" ]]; then
        echo "Found version $VERSION from alternative location for $PKG_NAME" >&2
        # Proceed with tagging using this version
        # (similar logic to above, could extract to a function)
      fi
    fi
  fi
done

echo "Tags created: $TAGS_CREATED, Tags verified: $TAGS_VERIFIED, Tags failed: $TAGS_FAILED" >&2
echo "tags_created=$TAGS_CREATED"
echo "tags_verified=$TAGS_VERIFIED"
echo "tags_failed=$TAGS_FAILED"
echo "total_packages=${#PATH_ARRAY[@]}"

# Return success only if no tags failed
if [[ $TAGS_FAILED -eq 0 ]]; then
  exit 0
else
  exit 1
fi 