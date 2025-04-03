#!/bin/bash

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script creates GitHub releases for packages that have been published.
Includes enhanced error handling, retries, and robust tag/release creation.

Options:
  --token TOKEN             GitHub token for authentication (required)
  --repo REPO               Repository name in format owner/repo (default: current repo)
  --package-names NAMES     Comma-separated list of package names
  --package-paths PATHS     Comma-separated list of package paths
  --delete-branch BOOL      Whether to delete version branch after release (default: false)
  --force-create BOOL       Whether to force create releases for all packages (default: true)
  --retry-attempts NUM      Number of retry attempts for failed operations (default: 3)
  --debug BOOL              Enable verbose debug output (default: false)
  --include-changelog BOOL  Whether to include changelog content in releases (default: true)
  --help                    Display this help and exit

Example:
  $(basename "$0") --token "gh_token" --package-names "@org/pkg1,@org/pkg2" --package-paths "packages/pkg1,packages/pkg2"
EOF
}

# Default values
REPO=""
DELETE_BRANCH="false"
FORCE_CREATE="true"
RETRY_ATTEMPTS=3
DEBUG="false"
INCLUDE_CHANGELOG="true"

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
    --package-names)
      PACKAGE_NAMES="$2"
      shift 2
      ;;
    --package-paths)
      PACKAGE_PATHS="$2"
      shift 2
      ;;
    --delete-branch)
      DELETE_BRANCH="$2"
      shift 2
      ;;
    --force-create)
      FORCE_CREATE="$2"
      shift 2
      ;;
    --retry-attempts)
      RETRY_ATTEMPTS="$2"
      shift 2
      ;;
    --debug)
      DEBUG="$2"
      shift 2
      ;;
    --include-changelog)
      INCLUDE_CHANGELOG="$2"
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

# Function to log debug information
debug_log() {
  if [[ "$DEBUG" == "true" ]]; then
    echo "DEBUG: $1" >&2
  fi
}

# Validate required parameters
if [[ -z "$TOKEN" ]]; then
  echo "Error: GitHub token is required" >&2
  show_help
  exit 1
fi

if [[ -z "$PACKAGE_NAMES" ]]; then
  echo "Error: Package names are required" >&2
  show_help
  exit 1
fi

if [[ -z "$PACKAGE_PATHS" ]]; then
  echo "Error: Package paths are required" >&2
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
IFS=',' read -ra NAME_ARRAY <<< "$PACKAGE_NAMES"
IFS=',' read -ra PATH_ARRAY <<< "$PACKAGE_PATHS"

if [[ ${#NAME_ARRAY[@]} -ne ${#PATH_ARRAY[@]} ]]; then
  echo "Error: Number of package names must match number of package paths" >&2
  exit 1
fi

# Setup headers for GitHub API requests
HEADER_AUTH="Authorization: token $TOKEN"
HEADER_ACCEPT="Accept: application/vnd.github+json"

# Function to check if a tag exists
tag_exists() {
  local tag_name=$1
  local result=$(curl -s -o /dev/null -w "%{http_code}" -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    "https://api.github.com/repos/$REPO/git/refs/tags/$tag_name")
  
  if [[ "$result" == "200" ]]; then
    debug_log "Tag $tag_name exists (HTTP 200)"
    echo "true"
  else
    debug_log "Tag $tag_name does not exist (HTTP $result)"
    echo "false"
  fi
}

# Function to delete a tag with retries
delete_tag_with_retry() {
  local tag_name=$1
  local attempts=$RETRY_ATTEMPTS
  local success=false
  
  debug_log "Attempting to delete tag $tag_name with $attempts retry attempts"
  
  while [[ $attempts -gt 0 && "$success" != "true" ]]; do
    local response=$(curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      "https://api.github.com/repos/$REPO/git/refs/tags/$tag_name")
    
    local status=$?
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      "https://api.github.com/repos/$REPO/git/refs/tags/$tag_name")
    
    if [[ $status -eq 0 && ( "$http_code" == "204" || "$http_code" == "404" ) ]]; then
      echo "Successfully deleted tag $tag_name on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      success=true
      break
    else
      echo "Failed to delete tag $tag_name (HTTP $http_code) on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      if [[ $attempts -gt 1 ]]; then
        debug_log "Response from delete: $response"
        echo "Retrying in 3 seconds..." >&2
        sleep 3
      fi
    fi
    
    attempts=$((attempts - 1))
  done
  
  # Check if tag still exists
  if [[ "$(tag_exists "$tag_name")" == "true" ]]; then
    echo "Warning: Tag $tag_name still exists after deletion attempts" >&2
    echo "false"
  else
    echo "true"
  fi
}

# Function to create a tag with retries
create_tag_with_retry() {
  local pkg_name=$1
  local version=$2
  local tag_name=$3
  local commit_sha=$4
  local attempts=$RETRY_ATTEMPTS
  local success=false
  
  debug_log "Creating tag $tag_name for $pkg_name v$version (commit: $commit_sha)"
  
  while [[ $attempts -gt 0 && "$success" != "true" ]]; do
    # Try using git command line to create the tag first (more reliable)
    if [[ "$DEBUG" == "true" ]]; then
      echo "Attempting to create tag using local git..." >&2
    fi
    
    # Create tag locally
    git tag -a "$tag_name" -m "Release $pkg_name v$version" "$commit_sha" 2>/dev/null || true
    
    # Push tag to remote
    local push_output=$(git push origin "$tag_name" 2>&1 || echo "Failed to push tag")
    
    # Check if successful
    if [[ "$push_output" != *"Failed to push tag"* && "$push_output" != *"error"* && "$push_output" != *"rejected"* ]]; then
      echo "Successfully created tag $tag_name using git command line on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      success=true
      break
    else
      echo "Failed to create tag using git, falling back to API on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      
      # Fallback to GitHub API for tag creation
      # Use simpler reference creation to avoid the "Could not verify object" error
      local ref_response=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        -d "{\"ref\":\"refs/tags/$tag_name\",\"sha\":\"$commit_sha\"}" \
        "https://api.github.com/repos/$REPO/git/refs")
      
      local ref_url=$(echo "$ref_response" | grep -o '"url": "[^"]*' | head -1 | cut -d'"' -f4)
      
      if [[ -n "$ref_url" ]]; then
        echo "Successfully created tag $tag_name using GitHub API on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
        success=true
        break
      else
        debug_log "Reference response: $ref_response"
        echo "API error: $(echo "$ref_response" | grep -o '"message": "[^"]*' | head -1 | cut -d'"' -f4)" >&2
        
        # Check for specific errors
        if [[ "$ref_response" == *"Reference already exists"* ]]; then
          echo "Tag reference already exists" >&2
          success=true
          break
        elif [[ "$ref_response" == *"Bad credentials"* ]]; then
          echo "Authentication error: The token used doesn't have sufficient permissions" >&2
          break
        elif [[ "$ref_response" == *"rate limit"* ]]; then
          echo "Rate limit exceeded: GitHub API rate limit reached" >&2
          break
        fi
        
        if [[ $attempts -gt 1 ]]; then
          echo "Retrying in 3 seconds..." >&2
          sleep 3
        fi
      fi
    fi
    
    attempts=$((attempts - 1))
  done
  
  echo "$success"
}

# Function to create a release - simplified version for last resort
create_simple_release() {
  local tag_name=$1
  local name=$2
  
  debug_log "Using simplified release creation for $tag_name"
  
  # Simplest possible payload with minimal fields
  local simple_response=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    -d "{\"tag_name\":\"$tag_name\",\"name\":\"$name\"}" \
    "https://api.github.com/repos/$REPO/releases")
  
  local release_id=$(echo "$simple_response" | grep -o '"id": [0-9]*' | head -1 | cut -d' ' -f2)
  
  if [[ -n "$release_id" ]]; then
    echo "Successfully created simplified release for $tag_name" >&2
    return 0
  else
    echo "Failed to create simplified release for $tag_name" >&2
    debug_log "Simple release response: $simple_response"
    return 1
  fi
}

# Function to create a release with retries
create_release_with_retry() {
  local pkg_name=$1
  local version=$2
  local tag_name=$3
  local attempts=$RETRY_ATTEMPTS
  local success=false
  
  debug_log "Creating release for $tag_name"
  
  # Check if release already exists
  local release_exists=$(curl -s -o /dev/null -w "%{http_code}" -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    "https://api.github.com/repos/$REPO/releases/tags/$tag_name")
  
  if [[ "$release_exists" == "200" && "$FORCE_CREATE" != "true" ]]; then
    echo "Release for $tag_name already exists, skipping" >&2
    echo "exists"
    return
  elif [[ "$release_exists" == "200" && "$FORCE_CREATE" == "true" ]]; then
    echo "Release for $tag_name exists but force-create is enabled, deleting existing release" >&2
    
    # Get release ID to delete it
    local release_id=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      "https://api.github.com/repos/$REPO/releases/tags/$tag_name" | grep -o '"id": [0-9]*' | head -1 | cut -d' ' -f2)
    
    if [[ -n "$release_id" ]]; then
      debug_log "Deleting release ID: $release_id"
      curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPO/releases/$release_id"
    fi
  fi
  
  while [[ $attempts -gt 0 && "$success" != "true" ]]; do
    # Find changelog file for better release notes
    local changelog_path=""
    if [[ -f "$PKG_PATH/CHANGELOG.md" ]]; then
      changelog_path="$PKG_PATH/CHANGELOG.md"
    fi
    
    # Extract release notes if changelog exists and include-changelog is enabled
    local release_body="Release of $pkg_name version $version"
    if [[ -n "$changelog_path" && "$INCLUDE_CHANGELOG" == "true" ]]; then
      local changelog_content=$(cat "$changelog_path")
      local version_notes=$(echo "$changelog_content" | awk "/## $version/{flag=1;next} /## [0-9]+/{flag=0} flag" | grep -v "^$" | head -10)
      
      if [[ -n "$version_notes" ]]; then
        # Escape quotes and special characters for JSON
        release_body=$(echo "$version_notes" | sed 's/"/\\"/g' | sed 's/$/\\n/g' | tr -d '\n')
      fi
    fi
    
    # Simplify release body for diagnostics
    if [[ "$DEBUG" == "true" ]]; then
      echo "Using simplified release body for debug mode..." >&2
      release_body="Release of $pkg_name version $version (debug mode)"
    fi
    
    # Create a properly formatted JSON payload
    local payload=$(cat <<EOF
{
  "tag_name": "$tag_name",
  "name": "$pkg_name v$version",
  "body": "$release_body",
  "draft": false,
  "prerelease": false
}
EOF
)
    
    if [[ "$DEBUG" == "true" ]]; then
      echo "Release payload: $payload" >&2
    fi
    
    # Create release - use verbose mode in debug mode
    local curl_cmd="curl -s"
    if [[ "$DEBUG" == "true" ]]; then
      curl_cmd="curl -v"
      echo "Using verbose curl for debugging" >&2
    fi
    
    local release_response=$(eval $curl_cmd -X POST -H \"$HEADER_AUTH\" -H \"$HEADER_ACCEPT\" \
      -H \"Content-Type: application/json\" \
      -d \"$payload\" \
      \"https://api.github.com/repos/$REPO/releases\")
    
    local release_id=$(echo "$release_response" | grep -o '"id": [0-9]*' | head -1 | cut -d' ' -f2)
    
    if [[ -n "$release_id" ]]; then
      echo "Successfully created release for $pkg_name v$version on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      success=true
      break
    else
      echo "Failed to create release on attempt $((RETRY_ATTEMPTS - attempts + 1))" >&2
      
      # Enhanced error reporting
      echo "API Error Response:" >&2
      echo "$release_response" | grep "message" >&2
      
      # Try an even simpler approach if we're on the last attempt
      if [[ $attempts -eq 1 ]]; then
        echo "Trying simplified API approach as last resort..." >&2
        if create_simple_release "$tag_name" "$pkg_name v$version"; then
          success=true
          break
        fi
        
        echo "Trying direct GitHub CLI approach as last resort..." >&2
        
        # Check if GitHub CLI is available
        if command -v gh &> /dev/null; then
          # Temporary file for release notes
          TEMP_NOTES=$(mktemp)
          echo "Release of $pkg_name version $version" > "$TEMP_NOTES"
          
          # Try using GitHub CLI instead
          export GH_TOKEN="$TOKEN"
          gh release create "$tag_name" --title "$pkg_name v$version" --notes-file "$TEMP_NOTES" || true
          rm "$TEMP_NOTES"
          
          # Check if it worked
          GH_RELEASE_CHECK=$(gh release view "$tag_name" 2>/dev/null || echo "not found")
          if [[ "$GH_RELEASE_CHECK" != "not found" ]]; then
            echo "Successfully created release using GitHub CLI" >&2
            success=true
            break
          fi
        fi
      fi
      
      debug_log "Full release response: $release_response"
      if [[ $attempts -gt 1 ]]; then
        echo "Retrying in 3 seconds..." >&2
        sleep 3
      fi
    fi
    
    attempts=$((attempts - 1))
  done
  
  if [[ "$success" == "true" ]]; then
    echo "true"
  else
    echo "false"
  fi
}

# Function to ensure a tag and release exist
ensure_tag_and_release() {
  local pkg_name=$1
  local version=$2
  local tag_name=$3
  
  # Get latest commit SHA
  local commit_sha=$(git rev-parse HEAD)
  debug_log "Latest commit SHA: $commit_sha"
  
  # Diagnose GitHub permissions
  if [[ "$DEBUG" == "true" ]]; then
    echo "Diagnosing GitHub permissions and connectivity..." >&2
    
    # Test connectivity to GitHub API
    local api_test=$(curl -s -o /dev/null -w "%{http_code}" -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      "https://api.github.com/repos/$REPO")
    
    echo "GitHub API connectivity test: HTTP $api_test" >&2
    
    # Test token permissions
    local token_test=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      "https://api.github.com/rate_limit")
    
    local rate_remaining=$(echo "$token_test" | grep -o '"remaining": [0-9]*' | head -1 | cut -d' ' -f2)
    
    if [[ -n "$rate_remaining" ]]; then
      echo "GitHub token appears valid. Rate limit remaining: $rate_remaining" >&2
    else
      echo "GitHub token may have issues. Response: $token_test" >&2
    fi
  fi
  
  # Check if tag exists
  local tag_exists_result=$(tag_exists "$tag_name")
  
  if [[ "$tag_exists_result" == "true" && "$FORCE_CREATE" == "true" ]]; then
    # Delete existing tag
    echo "Tag $tag_name exists but force-create is enabled. Deleting existing tag..." >&2
    local delete_result=$(delete_tag_with_retry "$tag_name")
    
    if [[ "$delete_result" != "true" ]]; then
      echo "Failed to delete existing tag $tag_name, cannot proceed with creation" >&2
      echo "false"
      return 1
    fi
    
    # Create new tag
    local create_result=$(create_tag_with_retry "$pkg_name" "$version" "$tag_name" "$commit_sha")
    
    if [[ "$create_result" != "true" ]]; then
      echo "Failed to create tag $tag_name after deleting" >&2
      echo "false"
      return 1
    fi
  elif [[ "$tag_exists_result" != "true" ]]; then
    # Tag doesn't exist, create it
    echo "Tag $tag_name does not exist. Creating..." >&2
    local create_result=$(create_tag_with_retry "$pkg_name" "$version" "$tag_name" "$commit_sha")
    
    if [[ "$create_result" != "true" ]]; then
      echo "Failed to create tag $tag_name" >&2
      # Try direct git approach one more time
      echo "Trying direct git approach as last resort..." >&2
      git tag -a "$tag_name" -m "Release $pkg_name v$version" "$commit_sha" 2>/dev/null || true
      git push origin "$tag_name" 2>/dev/null || {
        echo "All tag creation methods failed" >&2
        echo "false"
        return 1
      }
      echo "Successfully created tag using direct git approach" >&2
    fi
  else
    echo "Tag $tag_name already exists" >&2
  fi
  
  # Create or update release
  local release_result=$(create_release_with_retry "$pkg_name" "$version" "$tag_name")
  
  if [[ "$release_result" == "true" || "$release_result" == "exists" ]]; then
    echo "true"
    return 0
  else
    echo "false"
    return 1
  fi
}

echo "Creating GitHub releases for published packages with enhanced reliability..." >&2
RELEASES_CREATED=0
RELEASES_FAILED=0

# Debug information
debug_log "Processing packages in repository: $REPO"
debug_log "Force create is set to: $FORCE_CREATE"
debug_log "Retry attempts: $RETRY_ATTEMPTS"
debug_log "Include changelog: $INCLUDE_CHANGELOG"
debug_log "Package names: $PACKAGE_NAMES"
debug_log "Package paths: $PACKAGE_PATHS"

# Process each package
for i in "${!NAME_ARRAY[@]}"; do
  PKG_NAME="${NAME_ARRAY[$i]}"
  PKG_PATH="${PATH_ARRAY[$i]}"
  
  # Clean package name for use in tag
  CLEAN_PKG_NAME=$(echo "$PKG_NAME" | sed 's/@//g' | sed 's/\//-/g')
  
  debug_log "Processing package: $PKG_NAME at path: $PKG_PATH"
  
  # Get package version from package.json
  if [[ -f "$PKG_PATH/package.json" ]]; then
    VERSION=$(cat "$PKG_PATH/package.json" | grep -o '"version": "[^"]*' | cut -d'"' -f4)
    
    if [[ -n "$VERSION" ]]; then
      echo "Found version $VERSION for package $PKG_NAME" >&2
      
      # Create a tag name
      TAG_NAME="${PKG_NAME}@${VERSION}"
      ALT_TAG_NAME="${CLEAN_PKG_NAME}@${VERSION}"
      
      # Also create standard format tag that matches npm registry format
      echo "Using tag format: $TAG_NAME (npm standard format)" >&2
      debug_log "Alternative tag format: $ALT_TAG_NAME"
      
      # Ensure tag and release exist
      RESULT=$(ensure_tag_and_release "$PKG_NAME" "$VERSION" "$TAG_NAME")
      
      if [[ "$RESULT" == "true" ]]; then
        echo "Successfully created/verified tag and release for $PKG_NAME v$VERSION" >&2
        RELEASES_CREATED=$((RELEASES_CREATED + 1))
      else
        echo "Failed to create tag and release for $PKG_NAME v$VERSION" >&2
        RELEASES_FAILED=$((RELEASES_FAILED + 1))
      fi
    else
      echo "Could not determine version for $PKG_NAME" >&2
      debug_log "package.json exists but version not found for $PKG_NAME"
      
      # Try to find version from node_modules
      if [[ -d "$PKG_PATH/node_modules" ]]; then
        echo "Trying to find version from node_modules..." >&2
        PKG_VERSION_FILE="$PKG_PATH/node_modules/$PKG_NAME/package.json"
        if [[ -f "$PKG_VERSION_FILE" ]]; then
          VERSION=$(cat "$PKG_VERSION_FILE" | grep -o '"version": "[^"]*' | cut -d'"' -f4)
          if [[ -n "$VERSION" ]]; then
            echo "Found version $VERSION from node_modules for $PKG_NAME" >&2
            
            # Create a tag name
            TAG_NAME="${PKG_NAME}@${VERSION}"
            
            # Ensure tag and release exist
            RESULT=$(ensure_tag_and_release "$PKG_NAME" "$VERSION" "$TAG_NAME")
            
            if [[ "$RESULT" == "true" ]]; then
              echo "Successfully created/verified tag and release for $PKG_NAME v$VERSION (from node_modules)" >&2
              RELEASES_CREATED=$((RELEASES_CREATED + 1))
            else
              echo "Failed to create tag and release for $PKG_NAME v$VERSION (from node_modules)" >&2
              RELEASES_FAILED=$((RELEASES_FAILED + 1))
            fi
          fi
        fi
      fi
    fi
  else
    echo "Package.json not found at $PKG_PATH" >&2
    debug_log "Looking for package.json in subdirectories of $PKG_PATH"
    
    # Try to find package.json in subdirectories
    POTENTIAL_PKG_JSON=$(find "$PKG_PATH" -name "package.json" -not -path "*/node_modules/*" -not -path "*/dist/*" | head -1)
    if [[ -n "$POTENTIAL_PKG_JSON" ]]; then
      echo "Found alternative package.json at $POTENTIAL_PKG_JSON" >&2
      VERSION=$(cat "$POTENTIAL_PKG_JSON" | grep -o '"version": "[^"]*' | cut -d'"' -f4)
      if [[ -n "$VERSION" ]]; then
        echo "Found version $VERSION from alternative location for $PKG_NAME" >&2
        
        # Create a tag name
        TAG_NAME="${PKG_NAME}@${VERSION}"
        
        # Ensure tag and release exist
        RESULT=$(ensure_tag_and_release "$PKG_NAME" "$VERSION" "$TAG_NAME")
        
        if [[ "$RESULT" == "true" ]]; then
          echo "Successfully created/verified tag and release for $PKG_NAME v$VERSION (from alt location)" >&2
          RELEASES_CREATED=$((RELEASES_CREATED + 1))
        else
          echo "Failed to create tag and release for $PKG_NAME v$VERSION (from alt location)" >&2
          RELEASES_FAILED=$((RELEASES_FAILED + 1))
        fi
      fi
    fi
  fi
done

echo "Created/verified $RELEASES_CREATED releases, Failed: $RELEASES_FAILED" >&2
echo "releases_created=$RELEASES_CREATED"
echo "releases_failed=$RELEASES_FAILED"

# Delete version branch if requested and it exists
if [[ "$DELETE_BRANCH" == "true" ]]; then
  # Get version branch info if it exists
  VERSION_BRANCH=$(git branch -a | grep "version-packages" | sed 's/.*\///')
  
  if [[ -n "$VERSION_BRANCH" ]]; then
    echo "Deleting version branch: $VERSION_BRANCH" >&2
    
    # Use the enhanced branch deletion script with changeset cleanup
    DELETE_OUTPUT=$(bash .github/scripts/branch/delete.sh \
      --token "$TOKEN" \
      --repo "$REPO" \
      --branch "$VERSION_BRANCH" \
      --cleanup-changesets "true" \
      --max-attempts 3)
      
    if echo "$DELETE_OUTPUT" | grep -q "branch_deleted=true"; then
      echo "Successfully deleted version branch: $VERSION_BRANCH" >&2
      echo "branch_deleted=true"
    else
      echo "Warning: Failed to delete version branch: $VERSION_BRANCH" >&2
      echo "branch_deleted=false"
    fi
  else
    debug_log "No version branch found to delete"
  fi
fi

# Exit with success only if no releases failed
if [[ $RELEASES_FAILED -eq 0 ]]; then
  exit 0
else
  exit 1
fi 