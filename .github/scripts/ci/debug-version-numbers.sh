#!/bin/bash
# Debug script to view all relevant version numbers in the CI environment

# Print versions of Node.js and package managers
echo "=== ENVIRONMENT INFO ==="
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
if command -v pnpm &> /dev/null; then
  echo "PNPM version: $(pnpm -v)"
else
  echo "PNPM not installed"
fi

# Print repository information
echo ""
echo "=== REPOSITORY INFO ==="
echo "Current directory: $(pwd)"
echo "Git branch: $(git rev-parse --abbrev-ref HEAD)"
echo "Git commit: $(git rev-parse HEAD)"
echo "Git tags on current commit:"
git tag --points-at HEAD | xargs echo

# Print package versions from package.json files
echo ""
echo "=== PACKAGE VERSIONS ==="

for pkg_dir in packages/* apps/*; do
  if [ -f "$pkg_dir/package.json" ]; then
    name=$(node -e "console.log(require('./$pkg_dir/package.json').name || 'Unknown')")
    version=$(node -e "console.log(require('./$pkg_dir/package.json').version || 'Unknown')")
    echo "$name: $version (from $pkg_dir/package.json)"
  fi
done

# List all git tags for version reference
echo ""
echo "=== GIT TAGS ==="
git tag -l | grep -E '@littlecarlito|v[0-9]' | sort -V | tail -n 10

# Print most recent commits
echo ""
echo "=== RECENT COMMITS ==="
git log -5 --oneline

# Check if we're in a CI environment and print variables
echo ""
echo "=== CI VARIABLES ==="
if [ -n "$GITHUB_ACTIONS" ]; then
  echo "Running in GitHub Actions"
  echo "GITHUB_REF: $GITHUB_REF"
  echo "GITHUB_SHA: $GITHUB_SHA"
  echo "GITHUB_REPOSITORY: $GITHUB_REPOSITORY"
  echo "GITHUB_WORKFLOW: $GITHUB_WORKFLOW"
  echo "GITHUB_EVENT_NAME: $GITHUB_EVENT_NAME"
else
  echo "Not running in a recognized CI environment"
fi

# Check if there are uncommitted changes
echo ""
echo "=== GIT STATUS ==="
if [ -z "$(git status --porcelain)" ]; then
  echo "Working directory clean"
else
  echo "Uncommitted changes:"
  git status --porcelain
fi 