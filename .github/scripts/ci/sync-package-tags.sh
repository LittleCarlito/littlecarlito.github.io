#!/bin/bash
set -e

# Script to synchronize package tags between local and remote repositories
# This script operates independently of the release process

echo "🔄 Starting package tag synchronization..."

# Process command-line arguments
DRY_RUN=false
VERBOSE=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Fetch all tags from remote
echo "🔍 Fetching tags from remote..."
git fetch --tags

# Get all remote and local tags for our packages
echo "📋 Getting tag information..."
REMOTE_TAGS=$(git ls-remote --tags origin | grep -o 'refs/tags/@littlecarlito/[^{]*' | sed 's|refs/tags/||')
LOCAL_TAGS=$(git tag -l "@littlecarlito/*")

# Count tags
REMOTE_COUNT=$(echo "$REMOTE_TAGS" | grep -v '^$' | wc -l | tr -d '[:space:]')
LOCAL_COUNT=$(echo "$LOCAL_TAGS" | grep -v '^$' | wc -l | tr -d '[:space:]')

echo "Found $REMOTE_COUNT remote tags and $LOCAL_COUNT local tags"

# If verbose mode, show all tags
if [ "$VERBOSE" = true ]; then
  echo ""
  echo "📑 All remote tags:"
  echo "$REMOTE_TAGS" | grep -v '^$' | sed 's/^/  - /'
  
  echo ""
  echo "📑 All local tags:"
  echo "$LOCAL_TAGS" | grep -v '^$' | sed 's/^/  - /'
fi

# Find tags that exist locally but not remotely
echo "🔍 Identifying tags that exist locally but not remotely..."
LOCAL_ONLY_TAGS=()

while IFS= read -r tag; do
  # Skip empty lines
  [ -z "$tag" ] && continue
  
  # Check if tag exists remotely
  if ! echo "$REMOTE_TAGS" | grep -q "^$tag$"; then
    LOCAL_ONLY_TAGS+=("$tag")
  fi
done <<< "$LOCAL_TAGS"

# Find tags that exist remotely but not locally
echo "🔍 Identifying tags that exist remotely but not locally..."
REMOTE_ONLY_TAGS=()

while IFS= read -r tag; do
  # Skip empty lines
  [ -z "$tag" ] && continue
  
  # Check if tag exists locally
  if ! echo "$LOCAL_TAGS" | grep -q "^$tag$"; then
    REMOTE_ONLY_TAGS+=("$tag")
  fi
done <<< "$REMOTE_TAGS"

# Print analysis report
echo ""
echo "📊 Tag Analysis Report:"
echo "========================"
echo "Total remote tags: $REMOTE_COUNT"
echo "Total local tags: $LOCAL_COUNT"
echo "Tags existing only locally: ${#LOCAL_ONLY_TAGS[@]}"
echo "Tags existing only remotely: ${#REMOTE_ONLY_TAGS[@]}"

if [ ${#LOCAL_ONLY_TAGS[@]} -gt 0 ]; then
  echo ""
  echo "🏷️ Tags that exist locally but not remotely:"
  for tag in "${LOCAL_ONLY_TAGS[@]}"; do
    echo "  - $tag"
  done
fi

if [ ${#REMOTE_ONLY_TAGS[@]} -gt 0 ]; then
  echo ""
  echo "🏷️ Tags that exist remotely but not locally:"
  for tag in "${REMOTE_ONLY_TAGS[@]}"; do
    echo "  - $tag"
  done
fi

# Push local tags that don't exist remotely
if [ ${#LOCAL_ONLY_TAGS[@]} -gt 0 ]; then
  echo ""
  echo "🚀 Pushing local tags to remote..."
  
  for tag in "${LOCAL_ONLY_TAGS[@]}"; do
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would push tag: $tag"
    else
      echo "  Pushing tag: $tag"
      git push origin "refs/tags/$tag"
    fi
  done
fi

# Import remote tags that don't exist locally (optional, uncomment if needed)
if [ ${#REMOTE_ONLY_TAGS[@]} -gt 0 ]; then
  echo ""
  echo "⬇️ Importing remote tags that don't exist locally..."
  
  for tag in "${REMOTE_ONLY_TAGS[@]}"; do
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would import tag: $tag"
    else
      echo "  Importing tag: $tag"
      git tag "$tag" "refs/remotes/origin/main" || echo "  Failed to import tag: $tag"
    fi
  done
fi

# Create a file with all available package tags
echo ""
echo "📝 Creating list of all available package tags..."
(echo "$REMOTE_TAGS"; echo "$LOCAL_TAGS") | sort | uniq > all_package_tags.txt
TAG_TOTAL=$(cat all_package_tags.txt | grep -v '^$' | wc -l | tr -d '[:space:]')
echo "Total unique package tags: $TAG_TOTAL"

# Write tag information to GitHub output if we're in a GitHub action
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "tag_count=$TAG_TOTAL" >> $GITHUB_OUTPUT
  echo "local_only_count=${#LOCAL_ONLY_TAGS[@]}" >> $GITHUB_OUTPUT
  echo "remote_only_count=${#REMOTE_ONLY_TAGS[@]}" >> $GITHUB_OUTPUT
  echo "has_new_tags=$([[ ${#LOCAL_ONLY_TAGS[@]} -gt 0 ]] && echo "true" || echo "false")" >> $GITHUB_OUTPUT
fi

echo "✅ Tag synchronization completed successfully!"
exit 0 