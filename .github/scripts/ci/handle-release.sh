#!/bin/bash
set -e

# Script to handle Lerna versioning and publishing
# Usage:
#   handle-release.sh --type auto|patch|minor|major|preminor|prerelease --token GITHUB_TOKEN

# Parse arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --type)
      RELEASE_TYPE="$2"
      shift
      shift
      ;;
    --token)
      GH_TOKEN="$2"
      shift
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$RELEASE_TYPE" ]; then
  echo "❌ Release type is required"
  exit 1
fi

if [ -z "$GH_TOKEN" ]; then
  echo "❌ GitHub token is required"
  exit 1
fi

echo "🔍 Checking for versionable changes..."

# Run lerna changed to check for packages that need versioning
CHANGED_OUTPUT=$(pnpm lerna changed --json 2>/dev/null || echo "[]")
CHANGED_COUNT=$(echo "$CHANGED_OUTPUT" | jq '. | length')

# If no changes and not a manual run, exit
if [ "$CHANGED_COUNT" -eq 0 ] && [ "$RELEASE_TYPE" = "auto" ]; then
  echo "⚠️ No changes detected for versioning"
  echo "has_changes=false" >> "$GITHUB_OUTPUT"
  exit 0
else
  echo "has_changes=true" >> "$GITHUB_OUTPUT"
  
  # Show which packages will be versioned
  if [ "$CHANGED_COUNT" -gt 0 ]; then
    echo "📦 Packages that will be versioned:"
    echo "$CHANGED_OUTPUT" | jq -r '.[].name'
  fi
fi

# Configure git for the release commit
git config --global user.name "GitHub Actions"
git config --global user.email "actions@github.com"

# Execute versioning based on the release type
echo "🔄 Running versioning with type: $RELEASE_TYPE"
export GH_TOKEN

if [ "$RELEASE_TYPE" = "auto" ]; then
  # Use conventional commits for automatic versioning
  pnpm lerna version --conventional-commits --yes
else
  # Use specified release type
  pnpm lerna version "$RELEASE_TYPE" --yes
fi

# If we have a lerna.json with version field, get it
if [ -f "lerna.json" ]; then
  VERSION=$(jq -r '.version // "unknown"' lerna.json)
  if [ "$VERSION" != "unknown" ] && [ "$VERSION" != "independent" ]; then
    echo "version=$VERSION" >> "$GITHUB_OUTPUT"
  fi
fi

echo "✅ Version and tag created successfully"

# Build packages before publishing
echo "🏗️ Building packages..."
pnpm build

# Publish packages to registry
echo "📦 Publishing packages..."
pnpm lerna publish from-package --yes

echo "🎉 Release process completed successfully" 