#!/bin/bash
set -e

# Script to merge a PR with retry logic to handle race conditions
# Usage: merge-with-retry.sh --pr-number 123 --repository owner/repo [--attempts 3] [--delay 15] [--token TOKEN]

PR_NUMBER=""
REPOSITORY=""
ATTEMPTS=3
DELAY=15
TOKEN=${GITHUB_TOKEN}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr-number)
      PR_NUMBER="$2"
      shift 2
      ;;
    --repository)
      REPOSITORY="$2"
      shift 2
      ;;
    --attempts)
      ATTEMPTS="$2"
      shift 2
      ;;
    --delay)
      DELAY="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$PR_NUMBER" ] || [ -z "$REPOSITORY" ]; then
  echo "ERROR: pr-number and repository are required arguments"
  echo "Usage: merge-with-retry.sh --pr-number 123 --repository owner/repo [--attempts 3] [--delay 15] [--token TOKEN]"
  exit 1
fi

# Set GitHub token in environment if provided
if [ -n "$TOKEN" ]; then
  export GH_TOKEN="$TOKEN"
fi

MERGE_RESULT="failure"
MERGE_METHOD="none"

# Attempt to merge with retries
for ((i=1; i<=ATTEMPTS; i++)); do
  echo "Attempt $i of $ATTEMPTS to merge PR #$PR_NUMBER"
  
  # Check if PR is already merged
  PR_STATE=$(gh pr view $PR_NUMBER --repo "$REPOSITORY" --json state -q .state 2>/dev/null || echo "ERROR")
  if [[ "$PR_STATE" == "MERGED" ]]; then
    echo "PR #$PR_NUMBER is already merged, skipping merge attempt"
    MERGE_RESULT="success"
    MERGE_METHOD="already_merged"
    break
  fi
  
  # Try to merge using GH CLI
  if gh pr merge $PR_NUMBER --repo "$REPOSITORY" --squash --delete-branch; then
    echo "Successfully merged PR #$PR_NUMBER"
    MERGE_RESULT="success"
    MERGE_METHOD="gh_cli"
    break
  fi
  
  echo "Merge attempt $i failed, waiting before retry..."
  if [ $i -lt $ATTEMPTS ]; then
    sleep $DELAY
  fi
done

# Final check if it was merged
PR_STATE=$(gh pr view $PR_NUMBER --repo "$REPOSITORY" --json state -q .state 2>/dev/null || echo "ERROR")
if [[ "$PR_STATE" == "MERGED" ]]; then
  echo "PR #$PR_NUMBER is now merged"
  MERGE_RESULT="success"
fi

# Output results in a format that can be parsed by GitHub Actions
echo "merge_result=$MERGE_RESULT"
echo "merge_method=$MERGE_METHOD"

if [ "$MERGE_RESULT" != "success" ]; then
  echo "Failed to merge PR #$PR_NUMBER after $ATTEMPTS attempts"
  exit 1
fi

exit 0 