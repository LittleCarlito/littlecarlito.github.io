#!/bin/bash
set -e

# Script to identify and clean duplicate tags that might cause issues with versioning
# This script can be run locally or in CI to resolve tag conflicts

# Function to display usage information
usage() {
  echo "Usage: $0 [--dry-run] [--verbose] [--package PACKAGE_NAME]"
  echo "  --dry-run    Show what would be deleted without performing any actions"
  echo "  --verbose    Show more detailed information during execution"
  echo "  --package    Only check tags for a specific package (e.g. @littlecarlito/blorkpack)"
  exit 1
}

# Process command-line arguments
DRY_RUN=false
VERBOSE=false
SPECIFIC_PACKAGE=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
    --package) SPECIFIC_PACKAGE="$2"; shift ;;
    --help) usage ;;
    *) echo "Unknown parameter: $1"; usage ;;
  esac
  shift
done

# Fetch all tags from remote
echo "🔍 Fetching tags from remote..."
git fetch --tags

# Get remote and local tags
echo "📋 Getting tag information..."
REMOTE_TAGS=$(git ls-remote --tags origin | grep -o 'refs/tags/@littlecarlito/[^{]*' | sed 's|refs/tags/||')
LOCAL_TAGS=$(git tag -l "@littlecarlito/*")

# Filter for specific package if requested
if [ -n "$SPECIFIC_PACKAGE" ]; then
  echo "📦 Filtering for package: $SPECIFIC_PACKAGE"
  REMOTE_TAGS=$(echo "$REMOTE_TAGS" | grep "$SPECIFIC_PACKAGE" || echo "")
  LOCAL_TAGS=$(echo "$LOCAL_TAGS" | grep "$SPECIFIC_PACKAGE" || echo "")
fi

# Find tags that exist on remote but not locally
echo "🧐 Identifying tags that exist remotely but not locally..."
MISSING_LOCALLY=()
CONFLICTING_VERSIONS=()

while IFS= read -r tag; do
  # Skip empty lines
  [ -z "$tag" ] && continue
  
  # Check if tag exists locally
  if ! echo "$LOCAL_TAGS" | grep -q "^$tag$"; then
    MISSING_LOCALLY+=("$tag")
    
    # Extract package and version for conflict checking
    PKG=$(echo "$tag" | sed -E 's/(@[^@]+)@.*/\1/')
    VERSION=$(echo "$tag" | sed -E 's/.*@([0-9]+\.[0-9]+\.[0-9]+)$/\1/')
    
    # Check for conflicting versions
    if echo "$LOCAL_TAGS" | grep -q "^$PKG@[0-9]"; then
      # Get local versions for this package
      LOCAL_VERSIONS=$(echo "$LOCAL_TAGS" | grep "^$PKG@" | sed -E 's/.*@([0-9]+\.[0-9]+\.[0-9]+)$/\1/')
      
      # Check if the remote version is greater than any local version
      for local_ver in $LOCAL_VERSIONS; do
        # Simple version comparison (assumes semver format)
        if [ "$(printf '%s\n' "$local_ver" "$VERSION" | sort -V | tail -n1)" = "$VERSION" ] && [ "$local_ver" != "$VERSION" ]; then
          CONFLICTING_VERSIONS+=("$tag (remote $VERSION > local $local_ver)")
          break
        fi
      done
    fi
  fi
done <<< "$REMOTE_TAGS"

# Print report
echo "📊 Tag Analysis Report:"
echo "========================"
echo "Total remote tags: $(echo "$REMOTE_TAGS" | wc -l | tr -d ' ')"
echo "Total local tags: $(echo "$LOCAL_TAGS" | wc -l | tr -d ' ')"
echo "Tags missing locally: ${#MISSING_LOCALLY[@]}"

if [ ${#MISSING_LOCALLY[@]} -gt 0 ]; then
  echo ""
  echo "🏷️ Tags that exist on remote but not locally:"
  for tag in "${MISSING_LOCALLY[@]}"; do
    echo "  - $tag"
  done
fi

if [ ${#CONFLICTING_VERSIONS[@]} -gt 0 ]; then
  echo ""
  echo "⚠️ Potentially conflicting versions (remote > local):"
  for conflict in "${CONFLICTING_VERSIONS[@]}"; do
    echo "  - $conflict"
  done
fi

# If verbose mode, show all local and remote tags
if [ "$VERBOSE" = true ]; then
  echo ""
  echo "📑 All remote tags:"
  echo "$REMOTE_TAGS" | sed 's/^/  - /'
  
  echo ""
  echo "📑 All local tags:"
  echo "$LOCAL_TAGS" | sed 's/^/  - /'
fi

# Offer to delete conflicting remote tags if there are any
if [ ${#CONFLICTING_VERSIONS[@]} -gt 0 ]; then
  echo ""
  echo "🧹 Cleaning up conflicting tags:"
  
  for conflict in "${CONFLICTING_VERSIONS[@]}"; do
    tag=$(echo "$conflict" | cut -d' ' -f1)
    
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would delete remote tag: $tag"
    else
      echo "  Deleting remote tag: $tag"
      git push origin ":refs/tags/$tag"
      
      # Also delete it locally if it exists
      if git tag -l "$tag" | grep -q .; then
        git tag -d "$tag"
      fi
    fi
  done
fi

# Report or import missing tags
if [ ${#MISSING_LOCALLY[@]} -gt 0 ]; then
  echo ""
  echo "🔄 Handling tags missing locally:"
  
  # Check if we should import the missing tags
  for tag in "${MISSING_LOCALLY[@]}"; do
    # Skip tags that were identified as conflicting
    if echo "${CONFLICTING_VERSIONS[@]}" | grep -q "$tag"; then
      continue
    fi
    
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would import remote tag: $tag"
    else
      echo "  Importing remote tag: $tag"
      git tag "$tag" "refs/remotes/origin/main"
    fi
  done
fi

# Final status
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "✅ Dry run completed. No changes were made."
  echo "To apply these changes, run the script without the --dry-run flag."
else
  echo ""
  echo "✅ Tag cleanup completed."
  echo "You may need to run 'git fetch --tags' to update your local references."
fi

exit 0 