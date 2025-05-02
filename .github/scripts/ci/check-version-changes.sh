#!/bin/bash
set -e

# Script to check for packages that need versioning
# Usage: check-version-changes.sh

echo "🔍 Checking for versionable changes..."

# Run lerna changed to check for packages that need versioning
CHANGED_OUTPUT=$(pnpm lerna changed --json 2>/dev/null || echo "[]")
CHANGED_COUNT=$(echo "$CHANGED_OUTPUT" | jq '. | length')

if [ "$CHANGED_COUNT" -eq 0 ]; then
  echo "⚠️ No changes detected for versioning"
  echo "has_changes=false" >> "$GITHUB_OUTPUT"
  exit 0
else
  echo "has_changes=true" >> "$GITHUB_OUTPUT"
  
  # Show which packages will be versioned
  echo "📦 Packages that will be versioned:"
  echo "$CHANGED_OUTPUT" | jq -r '.[].name'
  
  # List the changes in each package
  echo "🔄 Changes in each package:"
  for pkg in $(echo "$CHANGED_OUTPUT" | jq -r '.[].name'); do
    echo "Package: $pkg"
    pnpm lerna diff "$pkg"
    echo ""
  done
fi

exit 0 