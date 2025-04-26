#!/bin/bash
# Script to process version changes from a merged PR
# Handles tag creation and package publishing

set -e

# Parse arguments
GITHUB_TOKEN=""
PUBLISH_PACKAGES="true"
CREATE_RELEASES="true"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --token) GITHUB_TOKEN="$2"; shift ;;
    --no-publish) PUBLISH_PACKAGES="false" ;;
    --no-releases) CREATE_RELEASES="false" ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GitHub token is required"
  exit 1
fi

echo "Processing version changes after PR merge..."

# Try to recreate version info based on the diff in the PR
CHANGED_PKGS=$(git diff --name-only HEAD^ HEAD | grep "package.json")
echo "Changed package.json files: $CHANGED_PKGS"

# Create a simple version-output.json
echo '{"updatedPackages":[],"packagesToTag":[]}' > version-output.json

# Process each changed package.json
for pkg_file in $CHANGED_PKGS; do
  # Get package directory
  pkg_dir=$(dirname "$pkg_file")
  
  # Check if file exists (may have been deleted)
  if [ ! -f "$pkg_file" ]; then
    echo "Skipping $pkg_file (file no longer exists)"
    continue
  fi
  
  # Get previous version (from git)
  prev_version=$(git show HEAD^:$pkg_file | jq -r '.version // "0.0.0"')
  
  # Get package name and current version
  pkg_name=$(cat "$pkg_file" | jq -r '.name')
  pkg_version=$(cat "$pkg_file" | jq -r '.version')
  
  # Check if the version changed
  if [ "$prev_version" != "$pkg_version" ]; then
    echo "Version change detected in $pkg_file: $prev_version -> $pkg_version"
    
    if [ -n "$pkg_name" ] && [ -n "$pkg_version" ] && [ "$pkg_name" != "null" ] && [ "$pkg_version" != "null" ]; then
      # Add to updatedPackages
      jq --arg name "$pkg_name" \
         --arg path "$pkg_dir" \
         --arg version "$pkg_version" \
         --arg previousVersion "$prev_version" \
         '.updatedPackages += [{"name": $name, "path": $path, "version": $version, "previousVersion": $previousVersion}]' \
         version-output.json > tmp.json && mv tmp.json version-output.json
      
      # Add to packagesToTag
      jq --arg name "$pkg_name" \
         --arg version "$pkg_version" \
         --arg tag "${pkg_name}@${pkg_version}" \
         '.packagesToTag += [{"name": $name, "version": $version, "tag": $tag}]' \
         version-output.json > tmp.json && mv tmp.json version-output.json
    fi
  else
    echo "No version change in $pkg_file"
  fi
done

# Count number of packages to tag
PACKAGES_TO_TAG=$(jq -c '.packagesToTag' version-output.json)
TAG_COUNT=$(echo "$PACKAGES_TO_TAG" | jq 'length')

echo "Found $TAG_COUNT packages to tag"
jq '.packagesToTag' version-output.json

# Setup git config
git config --global user.name "GitHub Actions"
git config --global user.email "actions@github.com"

# Ensure we're using the token for pushing
git remote set-url origin https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git

# Create directory for release notes
mkdir -p tmp_release_notes
TAGS_CREATED=0
FAILED=0

# Process each package
echo "$PACKAGES_TO_TAG" | jq -c '.[]' | while read -r package; do
  name=$(echo "$package" | jq -r '.name')
  version=$(echo "$package" | jq -r '.version')
  tag=$(echo "$package" | jq -r '.tag')
  
  echo "Creating tag for $name@$version: $tag"
  
  # Check both possible tag formats
  original_format_tag="$tag"
  transformed_format_tag="${tag/@/}"
  transformed_format_tag="${transformed_format_tag//\//-}"
  
  # Check if tag exists in either format
  if git tag -l "$original_format_tag" | grep -q "$original_format_tag" || \
     git tag -l "$transformed_format_tag" | grep -q "$transformed_format_tag"; then
    echo "Tag already exists in one of the formats, skipping creation"
    continue
  fi
  
  # Create tag with message
  git tag -a "$tag" -m "Release $name v$version"
  
  # Push tag with GITHUB_TOKEN
  if git push origin "$tag"; then
    echo "Successfully pushed tag $tag"
    TAGS_CREATED=$((TAGS_CREATED + 1))
    echo "$tag" >> tags_created.txt
    
    # Create release notes for this package
    pkg_path=${name#@littlecarlito/}
    changelog_path="packages/$pkg_path/CHANGELOG.md"
    release_notes="$name v$version"$'\n\n'
    
    # Add changelog content if available
    if [ -f "$changelog_path" ]; then
      echo "Found changelog at $changelog_path"
      # Extract the relevant section for this version
      version_content=$(sed -n "/## $version/,/## /p" "$changelog_path" | sed '$ d')
      if [ -n "$version_content" ]; then
        release_notes+="$version_content"
      else
        # If no specific version section, add recent commits
        release_notes+="Changes in this release:"$'\n'
        release_notes+=$(git log -3 --pretty=format:"* %s (%h)" -- "packages/$pkg_path/")
      fi
    else
      # Use recent commit history for the package
      release_notes+="Changes in this release:"$'\n'
      release_notes+=$(git log -3 --pretty=format:"* %s (%h)" -- "packages/$pkg_path/")
    fi
    
    # Save release notes to a file for later use
    echo "$release_notes" > "tmp_release_notes/${tag}.md"
  else
    echo "Failed to push tag $tag"
    FAILED=$((FAILED + 1))
  fi
done

# Output results
if [ -f "tags_created.txt" ]; then
  TAGS_CREATED=$(wc -l < tags_created.txt)
  echo "::set-output name=packages_tagged::$TAGS_CREATED"
  TAGS_CREATED_LIST=$(cat tags_created.txt | tr '\n' ',' | sed 's/,$//')
  echo "::set-output name=tags_created::$TAGS_CREATED_LIST"
else
  echo "::set-output name=packages_tagged::0"
fi

if [ $FAILED -gt 0 ]; then
  echo "::set-output name=error-message::Failed to create $FAILED tags"
fi

# Publish packages if enabled
if [ "$PUBLISH_PACKAGES" = "true" ] && [ "$TAG_COUNT" -gt 0 ]; then
  echo "Publishing packages..."
  
  # Find all packages with version changes
  for pkg_file in $CHANGED_PKGS; do
    pkg_dir=$(dirname "$pkg_file")
    echo "Publishing package in $pkg_dir"
    
    # Check if the package should be published (has a name and version)
    pkg_name=$(cat "$pkg_file" | jq -r '.name')
    pkg_version=$(cat "$pkg_file" | jq -r '.version')
    has_private=$(cat "$pkg_file" | jq 'has("private")')
    is_private=$(cat "$pkg_file" | jq -r '.private // false')
    
    if [ -n "$pkg_name" ] && [ -n "$pkg_version" ] && [ "$pkg_name" != "null" ] && [ "$pkg_version" != "null" ] && \
       ([ "$has_private" = "false" ] || [ "$is_private" = "false" ]); then
      # Navigate to the package directory and publish
      cd "$pkg_dir"
      npm publish --access public
      cd - > /dev/null
    else
      echo "Skipping $pkg_dir (private or missing name/version)"
    fi
  done
fi

# Create GitHub Releases if enabled
if [ "$CREATE_RELEASES" = "true" ] && [ -f "tags_created.txt" ]; then
  echo "Creating GitHub releases for tags..."
  
  # Authenticate GitHub CLI
  echo "$GITHUB_TOKEN" | gh auth login --with-token
  
  # Create releases for each tag
  RELEASES_CREATED=0
  RELEASES_FAILED=0
  
  # Process each tag
  for tag in $(cat tags_created.txt); do
    echo "Creating release for tag: $tag"
    
    # Check if release notes exist
    if [ -f "tmp_release_notes/${tag}.md" ]; then
      RELEASE_NOTES=$(cat "tmp_release_notes/${tag}.md")
    else
      RELEASE_NOTES="Release $tag"
    fi
    
    # Create the release
    if gh release create "$tag" \
       --title "Release $tag" \
       --notes "$RELEASE_NOTES" \
       --repo "$GITHUB_REPOSITORY"; then
      echo "Successfully created release for $tag"
      RELEASES_CREATED=$((RELEASES_CREATED + 1))
    else
      echo "::error::Failed to create release for $tag"
      RELEASES_FAILED=$((RELEASES_FAILED + 1))
    fi
  done
  
  # Output results
  echo "::set-output name=releases_created::$RELEASES_CREATED"
  echo "::set-output name=releases_failed::$RELEASES_FAILED"
  
  if [ $RELEASES_FAILED -gt 0 ]; then
    echo "::set-output name=error-message::Failed to create $RELEASES_FAILED releases"
  fi
fi

# Create summary file
jq -r '"# Version Updates\n\n" + (.updatedPackages | map("- " + .name + ": " + .previousVersion + " → " + .version) | join("\n"))' version-output.json > version-summary.md

echo "Version processing complete!"
exit 0 