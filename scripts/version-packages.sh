#!/bin/bash
set -e

# Script to version packages using Lerna with conventional commits
# Usage: ./scripts/version-packages.sh 
# 
# This script automatically detects version bumps based on your commit messages:
# - feat: → minor version bump
# - fix: → patch version bump
# - BREAKING CHANGE: → major version bump
# - etc.

# Check if Git is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Your Git working directory is not clean. Please commit or stash changes before versioning."
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
echo "🔍 Current branch: $CURRENT_BRANCH"

# If on main branch, warn about direct versioning
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "⚠️ Warning: You are on the main branch. It's recommended to create versions on feature branches."
  read -p "Do you want to continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🛑 Operation cancelled"
    exit 0
  fi
fi

# Run dependency tests first
echo "🧪 Running dependency tests..."
pnpm test:build-deps
if [ $? -ne 0 ]; then
  echo "❌ Dependency tests failed. Please fix errors before versioning."
  exit 1
fi

# Show which packages will be versioned
echo "📦 Checking which packages need versioning..."
pnpm lerna changed || {
  echo "ℹ️ No packages need versioning or no conventional commits found."
  echo "Make sure you have commits with prefixes like 'feat:', 'fix:', etc."
  exit 0
}

# Run lerna version with conventional commits
echo "📦 Running version command with conventional commits..."
pnpm lerna version --conventional-commits --yes

if [ $? -eq 0 ]; then
  echo "✅ Version completed successfully!"
  
  # Check if any tags were created
  LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
  if [ -n "$LATEST_TAG" ]; then
    echo "🏷️ Latest tag: $LATEST_TAG"
    echo ""
    echo "ℹ️ To push this branch with tags, run:"
    echo "git push --follow-tags origin $CURRENT_BRANCH"
  fi
else
  echo "❌ Version command failed"
  exit 1
fi 