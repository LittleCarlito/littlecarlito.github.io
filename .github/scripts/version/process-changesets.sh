#!/bin/bash

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script processes changesets by running version or publish commands,
handling direct publishing by default, and setting up GitHub output variables.

Options:
  --publish CMD             Command to run for publishing (default: pnpm run release)
  --version CMD             Command to run for versioning (default: pnpm run version)
  --commit-message MSG      Commit message for version changes (default: "chore: version packages")
  --pr-title TITLE          PR title for version changes (default: "chore: version packages")
  --create-releases BOOL    Whether to create GitHub releases (default: true)
  --create-pr BOOL          Whether to create a PR instead of direct publishing (default: false)
  --force-publish BOOL      Whether to force publish even if the version exists (default: true)
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
CREATE_PR="false"
FORCE_PUBLISH="true"

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
    --create-pr)
      CREATE_PR="$2"
      shift 2
      ;;
    --force-publish)
      FORCE_PUBLISH="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

# Function to check if we have changesets
check_changesets() {
  if [[ -d ".changeset" && "$(ls -A .changeset | grep -v README.md | grep -v config.json)" ]]; then
    echo "true"
  else
    echo "false"
  fi
}

# Determine if we have changesets
HAS_CHANGESETS=$(check_changesets)

echo "has_changesets=${HAS_CHANGESETS}"

if [[ "${HAS_CHANGESETS}" != "true" ]]; then
  echo "No changesets found - skipping version and publish steps" >&2
  echo "published=false"
  exit 0
fi

# Check if we should create a PR or directly publish
if [[ "${CREATE_PR}" == "true" ]]; then
  echo "PR creation requested - attempting to create a version PR..." >&2

  # Create a new branch for versioning
  BRANCH_NAME="version-packages-$(date +%s)"
  { git checkout -b "${BRANCH_NAME}"; } 2>&1

  # Run the version command
  echo "Running version command: ${VERSION_CMD}" >&2
  { eval "${VERSION_CMD}"; } 2>&1

  # Check if there are changes to commit
  if [[ -z "$(git status --porcelain)" ]]; then
    echo "No changes from versioning - nothing to commit or create PR for" >&2
    { git checkout -; } 2>&1 # Return to original branch
    echo "published=false"
    exit 0
  fi

  # Commit changes
  { git add .; } 2>&1
  { git commit -m "${COMMIT_MESSAGE}"; } 2>&1

  # Push changes
  echo "Pushing changes to branch ${BRANCH_NAME}..." >&2
  { git push origin "${BRANCH_NAME}"; } 2>&1

  # Create a PR
  echo "Creating PR for versioning changes..." >&2
  PR_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls" \
    -d "{\"title\":\"${PR_TITLE}\",\"head\":\"${BRANCH_NAME}\",\"base\":\"main\",\"body\":\"This PR was created by the changesets action to version packages.\"}")

  PR_NUMBER=$(echo "${PR_RESPONSE}" | grep -o '"number": [0-9]*' | head -1 | cut -d' ' -f2)

  if [[ -n "${PR_NUMBER}" ]]; then
    echo "PR #${PR_NUMBER} created successfully" >&2
    echo "pr_number=${PR_NUMBER}"
    echo "pr_url=https://github.com/${GITHUB_REPOSITORY}/pull/${PR_NUMBER}"
    echo "published=false"
    exit 0
  else
    echo "Failed to create PR, response: ${PR_RESPONSE}" >&2
    
    # Check if this is due to "no commits between" error
    if [[ "${PR_RESPONSE}" == *"No commits between"* ]] || [[ "${PR_RESPONSE}" == *"Validation Failed"* ]]; then
      echo "No new commits to create PR with - this is expected if no changesets were processed" >&2
      { git checkout -; } 2>&1 # Return to original branch
      echo "published=false"
      exit 0
    fi
    
    # Fall back to direct publish if PR creation fails
    echo "PR creation failed - falling back to direct publish..." >&2
    { git checkout main; } 2>&1
  fi
else
  # Direct publishing (default)
  echo "Direct publishing is enabled - skipping PR creation..." >&2

  # Run versioning command directly on main
  echo "Running version command: ${VERSION_CMD}" >&2
  { eval "${VERSION_CMD}"; } 2>&1

  # Check if there are changes to commit
  if [[ -z "$(git status --porcelain)" ]]; then
    echo "No changes from versioning - nothing to publish" >&2
    echo "published=false"
    exit 0
  fi

  # Commit changes directly to main
  { git add .; } 2>&1
  { git commit -m "${COMMIT_MESSAGE}"; } 2>&1
fi

# If we reach here, we're proceeding with direct publish
if [[ "${FORCE_PUBLISH}" == "true" ]]; then
  echo "Force publishing is enabled - will use --force flag" >&2
  PUBLISH_CMD="${PUBLISH_CMD} --force"
fi

echo "Running publish command: ${PUBLISH_CMD}" >&2
PUBLISH_OUTPUT=$(mktemp)
set +e
eval "${PUBLISH_CMD}" > "$PUBLISH_OUTPUT" 2>&1
PUBLISH_EXIT_CODE=$?
set -e

# Display the output for debugging
cat "$PUBLISH_OUTPUT" >&2
rm -f "$PUBLISH_OUTPUT"

# Clean up the branch if we created one
if [[ "${CREATE_PR}" == "true" && -n "${BRANCH_NAME}" ]]; then
  echo "Cleaning up temporary branch ${BRANCH_NAME}..." >&2
  
  # Switch back to main first
  { git checkout main; } 2>&1 || true
  
  # Use the enhanced branch deletion script for more reliable cleanup
  DELETE_OUTPUT=$(bash .github/scripts/branch/delete.sh \
    --token "${GITHUB_TOKEN}" \
    --repo "${GITHUB_REPOSITORY}" \
    --branch "${BRANCH_NAME}" \
    --cleanup-changesets "true" \
    --max-attempts 3)
    
  if echo "$DELETE_OUTPUT" | grep -q "branch_deleted=true"; then
    echo "Successfully cleaned up temporary branch: ${BRANCH_NAME}" >&2
  else
    echo "Note: Could not fully clean up branch ${BRANCH_NAME}, but continuing..." >&2
  fi
fi

# Check if publish was successful
if [[ ${PUBLISH_EXIT_CODE} -eq 0 ]]; then
  echo "Successfully published packages" >&2
  echo "published=true"
  
  # Create releases if requested
  if [[ "${CREATE_RELEASES}" == "true" ]]; then
    echo "Creating GitHub releases is enabled, this will be handled by the next step" >&2
  fi
  
  exit 0
else
  echo "Failed to publish packages with exit code ${PUBLISH_EXIT_CODE}" >&2
  echo "published=false"
  exit 1
fi 