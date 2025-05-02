#!/bin/bash
set -e

# Script to manage GitHub releases based on package tags
# This operates independently of the tag synchronization process

echo "🚀 Starting GitHub release management..."

# Process command-line arguments
DRY_RUN=false
VERBOSE=false
TAG_FILE=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
    --tag-file) TAG_FILE="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# If no tag file is provided, get all package tags
if [ -z "$TAG_FILE" ]; then
  echo "📋 No tag file provided, fetching all package tags..."
  git fetch --tags
  git tag -l "@littlecarlito/*" > all_package_tags.txt
  TAG_FILE="all_package_tags.txt"
fi

# Verify tag file exists
if [ ! -f "$TAG_FILE" ]; then
  echo "❌ Error: Tag file $TAG_FILE does not exist"
  exit 1
fi

# Read all available package tags
echo "📋 Reading available package tags from $TAG_FILE..."
PACKAGE_TAGS=$(cat "$TAG_FILE" | grep -v '^$')
TAG_COUNT=$(echo "$PACKAGE_TAGS" | grep -v '^$' | wc -l | tr -d '[:space:]')

echo "Found $TAG_COUNT package tags to check for releases"

# If verbose mode, show all tags
if [ "$VERBOSE" = true ]; then
  echo ""
  echo "📑 All package tags:"
  echo "$PACKAGE_TAGS" | sed 's/^/  - /'
fi

# Get existing GitHub releases
echo "🔍 Getting existing GitHub releases..."
EXISTING_RELEASES=$(gh release list --limit 1000 | awk '{print $1}')
RELEASE_COUNT=$(echo "$EXISTING_RELEASES" | grep -v '^$' | wc -l | tr -d '[:space:]')

echo "Found $RELEASE_COUNT existing GitHub releases"

# If verbose mode, show all releases
if [ "$VERBOSE" = true ]; then
  echo ""
  echo "📑 All existing GitHub releases:"
  echo "$EXISTING_RELEASES" | sed 's/^/  - /'
fi

# Find tags without corresponding releases
echo "🔍 Identifying tags without corresponding releases..."
TAGS_TO_RELEASE=()

while IFS= read -r tag; do
  # Skip empty lines
  [ -z "$tag" ] && continue
  
  # Check if release exists for this tag
  if ! echo "$EXISTING_RELEASES" | grep -q "^$tag$"; then
    TAGS_TO_RELEASE+=("$tag")
  fi
done <<< "$PACKAGE_TAGS"

# Print analysis report
echo ""
echo "📊 Release Analysis Report:"
echo "=========================="
echo "Total package tags: $TAG_COUNT"
echo "Existing GitHub releases: $RELEASE_COUNT"
echo "Tags without releases: ${#TAGS_TO_RELEASE[@]}"

if [ ${#TAGS_TO_RELEASE[@]} -gt 0 ]; then
  echo ""
  echo "🏷️ Tags that need GitHub releases:"
  for tag in "${TAGS_TO_RELEASE[@]}"; do
    echo "  - $tag"
  done
fi

# Create GitHub releases for tags that don't have them
RELEASES_CREATED=0

if [ ${#TAGS_TO_RELEASE[@]} -gt 0 ]; then
  echo ""
  echo "🚀 Creating GitHub releases for tags without releases..."
  
  for tag in "${TAGS_TO_RELEASE[@]}"; do
    # Extract package name from tag
    PACKAGE_NAME=$(echo "$tag" | sed 's/@\(.*\)@.*/\1/')
    VERSION=$(echo "$tag" | sed 's/.*@\(.*\)/\1/')
    
    echo "Processing tag: $tag (Package: $PACKAGE_NAME, Version: $VERSION)"
    
    # Check if there's a CHANGELOG.md file for this package
    CHANGELOG_PATH=""
    if [[ "$PACKAGE_NAME" == *"portfolio"* ]]; then
      CHANGELOG_PATH="apps/portfolio/CHANGELOG.md"
    else
      # Extract the package short name
      SHORT_NAME=$(echo "$PACKAGE_NAME" | sed 's/.*\/\(.*\)/\1/')
      CHANGELOG_PATH="packages/$SHORT_NAME/CHANGELOG.md"
    fi
    
    # Extract release notes if changelog exists
    RELEASE_NOTES=""
    if [ -f "$CHANGELOG_PATH" ]; then
      echo "  Extracting release notes from $CHANGELOG_PATH for version $VERSION"
      # Extract section for this specific version
      RELEASE_NOTES=$(awk -v version="$VERSION" '
        BEGIN { found=0; capture=0; notes="" }
        $0 ~ "^## " version { found=1; capture=1; next }
        found && $0 ~ "^## " { capture=0 }
        capture { notes = notes $0 "\n" }
        END { print notes }
      ' "$CHANGELOG_PATH")
    fi
    
    # Default notes if none found
    if [ -z "$RELEASE_NOTES" ]; then
      RELEASE_NOTES="Release of $PACKAGE_NAME version $VERSION"
    fi
    
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would create GitHub release for tag: $tag"
      echo "  Title: $PACKAGE_NAME v$VERSION"
      echo "  Notes: $RELEASE_NOTES"
      RELEASES_CREATED=$((RELEASES_CREATED + 1))
    else
      echo "  Creating GitHub release for tag: $tag"
      
      # Create GitHub release
      if gh release create "$tag" \
        --title "$PACKAGE_NAME v$VERSION" \
        --notes "$RELEASE_NOTES" \
        --target main; then
        echo "  ✅ Successfully created release for $tag"
        RELEASES_CREATED=$((RELEASES_CREATED + 1))
      else
        echo "  ❌ Failed to create release for $tag"
      fi
    fi
  done
fi

echo ""
echo "📊 Release Creation Summary:"
echo "==========================="
echo "Tags checked: $TAG_COUNT"
echo "Tags without releases: ${#TAGS_TO_RELEASE[@]}"
echo "Releases created: $RELEASES_CREATED"

# Write release information to GitHub output if we're in a GitHub action
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "releases_count=$RELEASES_CREATED" >> $GITHUB_OUTPUT
  echo "has_new_releases=$([[ $RELEASES_CREATED -gt 0 ]] && echo "true" || echo "false")" >> $GITHUB_OUTPUT
fi

echo "✅ GitHub release management completed successfully!"
exit 0 