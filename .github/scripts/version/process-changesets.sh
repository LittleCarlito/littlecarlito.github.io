#!/bin/bash

# Help text
show_help() {
  cat << EOF
Usage: $(basename "$0") [OPTIONS]

This script processes changesets by running version or publish commands,
handling pull request creation, and setting up GitHub output variables.

Options:
  --publish CMD             Command to run for publishing (default: pnpm run release)
  --version CMD             Command to run for versioning (default: pnpm run version)
  --commit-message MSG      Commit message for version changes (default: "chore: version packages")
  --pr-title TITLE          PR title for version changes (default: "chore: version packages")
  --create-releases BOOL    Whether to create GitHub releases (default: true)
  --help                    Display this help and exit

Example:
  $(basename "$0") --publish "pnpm run release" --version "pnpm run version"
EOF
}

# Default values
PUBLISH_CMD="pnpm run release"
VERSION_CMD="pnpm run version"
COMMIT_MESSAGE="chore: version packages"
PR_TITLE="chore: version packages"
CREATE_RELEASES="true"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish)
      PUBLISH_CMD="$2"
      shift 2
      ;;
    --version)
      VERSION_CMD="$2"
      shift 2
      ;;
    --commit-message)
      COMMIT_MESSAGE="$2"
      shift 2
      ;;
    --pr-title)
      PR_TITLE="$2"
      shift 2
      ;;
    --create-releases)
      CREATE_RELEASES="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Error: Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Function to check if we have changesets
check_changesets() {
  if [ -d ".changeset" ] && [ "$(ls -A .changeset | grep -v README.md | grep -v config.json)" ]; then
    echo "true"
  else
    echo "false"
  fi
}

# Determine if we have changesets
HAS_CHANGESETS=$(check_changesets)

echo "has_changesets=${HAS_CHANGESETS}" >> $GITHUB_OUTPUT

if [ "${HAS_CHANGESETS}" != "true" ]; then
  echo "No changesets found - skipping version and publish steps"
  echo "published=false" >> $GITHUB_OUTPUT
  exit 0
fi

# Try to create a version PR first
echo "Attempting to create a version PR..."

# Create a new branch for versioning
BRANCH_NAME="version-packages-$(date +%s)"
git checkout -b "${BRANCH_NAME}"

# Run the version command
echo "Running version command: ${VERSION_CMD}"
eval "${VERSION_CMD}"

# Check if there are changes to commit
if [ -z "$(git status --porcelain)" ]; then
  echo "No changes from versioning - nothing to commit or create PR for"
  git checkout - # Return to original branch
  echo "published=false" >> $GITHUB_OUTPUT
  exit 0
fi

# Commit changes
git add .
git commit -m "${COMMIT_MESSAGE}"

# Push changes
git push origin "${BRANCH_NAME}"

# Create a PR
echo "Creating PR for versioning changes..."
PR_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls" \
  -d "{\"title\":\"${PR_TITLE}\",\"head\":\"${BRANCH_NAME}\",\"base\":\"main\",\"body\":\"This PR was created by the changesets action to version packages.\"}")

PR_NUMBER=$(echo "${PR_RESPONSE}" | grep -o '"number": [0-9]*' | head -1 | cut -d' ' -f2)

if [ -n "${PR_NUMBER}" ]; then
  echo "PR #${PR_NUMBER} created successfully"
  echo "pr_number=${PR_NUMBER}" >> $GITHUB_OUTPUT
  echo "pr_url=https://github.com/${GITHUB_REPOSITORY}/pull/${PR_NUMBER}" >> $GITHUB_OUTPUT
  echo "published=false" >> $GITHUB_OUTPUT
  exit 0
else
  echo "Failed to create PR, response: ${PR_RESPONSE}"
  
  # Check if this is due to "no commits between" error
  if [[ "${PR_RESPONSE}" == *"No commits between"* ]] || [[ "${PR_RESPONSE}" == *"Validation Failed"* ]]; then
    echo "No new commits to create PR with - this is expected if no changesets were processed"
    git checkout - # Return to original branch
    echo "published=false" >> $GITHUB_OUTPUT
    exit 0
  fi
  
  # Try direct publish if PR creation fails
  echo "Attempting direct publish instead..."
  git checkout main
fi

# If we reach here, we're attempting direct publish
echo "Running publish command: ${PUBLISH_CMD}"
PUBLISH_RESULT=$(eval "${PUBLISH_CMD}" 2>&1)
PUBLISH_EXIT_CODE=$?

# Check if publish was successful
if [ ${PUBLISH_EXIT_CODE} -eq 0 ]; then
  echo "Successfully published packages"
  echo "published=true" >> $GITHUB_OUTPUT
  
  # Create releases if requested
  if [ "${CREATE_RELEASES}" == "true" ]; then
    echo "Creating GitHub releases is enabled, this will be handled by the next step"
  fi
  
  exit 0
else
  echo "Failed to publish packages:"
  echo "${PUBLISH_RESULT}"
  echo "published=false" >> $GITHUB_OUTPUT
  exit 1
fi 