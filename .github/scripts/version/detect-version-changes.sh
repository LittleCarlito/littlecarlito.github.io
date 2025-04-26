#!/bin/bash
# Script to detect if a commit or PR includes version changes

set -e

# Parse arguments
COMMIT_MESSAGE=""
PR_BODY=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --commit-message) COMMIT_MESSAGE="$2"; shift ;;
    --pr-body) PR_BODY="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Check if commit message indicates version changes
if [ -n "$COMMIT_MESSAGE" ] && [[ "$COMMIT_MESSAGE" == *"version-changes: true"* ]]; then
  echo "has_version_changes=true"
  exit 0
fi

# Check if PR body contains version changes section
if [ -n "$PR_BODY" ] && [[ "$PR_BODY" == *"## Version Changes"* ]]; then
  echo "has_version_changes=true"
  exit 0
fi

# Check if any package.json files were modified with version changes
CHANGED_PKGS=$(git diff --name-only HEAD^ HEAD | grep "package.json" || echo "")
if [ -n "$CHANGED_PKGS" ]; then
  for pkg_file in $CHANGED_PKGS; do
    # Get previous version (from git)
    if git show HEAD^:$pkg_file &>/dev/null; then
      prev_version=$(git show HEAD^:$pkg_file | jq -r '.version // "0.0.0"')
      
      # Get package name and current version
      if [ -f "$pkg_file" ]; then
        curr_version=$(cat "$pkg_file" | jq -r '.version // "0.0.0"')
        
        # Check if the version changed
        if [ "$prev_version" != "$curr_version" ]; then
          echo "has_version_changes=true"
          echo "changed_file=$pkg_file"
          echo "previous_version=$prev_version"
          echo "current_version=$curr_version"
          exit 0
        fi
      fi
    fi
  done
fi

echo "has_version_changes=false"
exit 0 