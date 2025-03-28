#!/bin/bash

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script finds and automatically merges PRs with version changes.

Options:
  --token TOKEN             GitHub token for authentication (required)
  --repo REPO               Repository name in format owner/repo (default: current repo)
  --pr-title TITLE          PR title to search for (default: "chore: version packages")
  --merge-method METHOD     Merge method to use (default: "squash", options: merge, squash, rebase)
  --delete-branch BOOL      Whether to delete PR branch after merge (default: false)
  --help                    Display this help and exit

Example:
  $(basename "$0") --token "gh_token" --pr-title "chore: version packages" --merge-method "squash"
EOF
}

# Default values
REPO=""
PR_TITLE="chore: version packages"
MERGE_METHOD="squash"
DELETE_BRANCH="false"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --pr-title)
      PR_TITLE="$2"
      shift 2
      ;;
    --merge-method)
      MERGE_METHOD="$2"
      shift 2
      ;;
    --delete-branch)
      DELETE_BRANCH="$2"
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

# Validate required parameters
if [[ -z "$TOKEN" ]]; then
  echo "Error: GitHub token is required" >&2
  show_help
  exit 1
fi

# If repo is not provided, derive it from environment
if [[ -z "$REPO" && -n "$GITHUB_REPOSITORY" ]]; then
  REPO="$GITHUB_REPOSITORY"
elif [[ -z "$REPO" ]]; then
  echo "Error: Repository information not available" >&2
  exit 1
fi

# Setup headers for GitHub API requests
HEADER_AUTH="Authorization: token $TOKEN"
HEADER_ACCEPT="Accept: application/vnd.github+json"

echo "Searching for version PRs with title: '$PR_TITLE'" >&2

# Find open PRs with the given title
PR_RESPONSE=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
  "https://api.github.com/repos/$REPO/pulls?state=open")

# Extract PR information for matching PRs
MATCHING_PR=$(echo "$PR_RESPONSE" | jq -r --arg title "$PR_TITLE" '.[] | select(.title == $title) | {number: .number, head: .head.ref, sha: .head.sha}')

if [[ -z "$MATCHING_PR" || "$MATCHING_PR" == "null" ]]; then
  echo "No open PRs found with title: '$PR_TITLE'" >&2
  echo "has_pr=false"
  exit 0
fi

# Extract PR details
PR_NUMBER=$(echo "$MATCHING_PR" | jq -r '.number')
PR_HEAD=$(echo "$MATCHING_PR" | jq -r '.head')
PR_SHA=$(echo "$MATCHING_PR" | jq -r '.sha')

if [[ -n "$PR_NUMBER" && "$PR_NUMBER" != "null" ]]; then
  echo "Found matching PR #$PR_NUMBER" >&2
  echo "has_pr=true"
  echo "pr_number=$PR_NUMBER"
  echo "pr_head=$PR_HEAD"
  echo "pr_sha=$PR_SHA"
  
  # Check if PR is mergeable
  PR_DETAILS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
    "https://api.github.com/repos/$REPO/pulls/$PR_NUMBER")
  
  MERGEABLE=$(echo "$PR_DETAILS" | jq -r '.mergeable')
  MERGEABLE_STATE=$(echo "$PR_DETAILS" | jq -r '.mergeable_state')
  
  echo "PR #$PR_NUMBER mergeable: $MERGEABLE, state: $MERGEABLE_STATE" >&2
  
  # Auto-merge the PR if it's mergeable
  if [[ "$MERGEABLE" == "true" || "$MERGEABLE_STATE" == "clean" ]]; then
    echo "Auto-merging PR #$PR_NUMBER using $MERGE_METHOD method" >&2
    
    MERGE_RESPONSE=$(curl -s -X PUT -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
      "https://api.github.com/repos/$REPO/pulls/$PR_NUMBER/merge" \
      -d "{\"merge_method\":\"$MERGE_METHOD\"}")
    
    MERGED=$(echo "$MERGE_RESPONSE" | jq -r '.merged')
    
    if [[ "$MERGED" == "true" ]]; then
      echo "Successfully merged PR #$PR_NUMBER" >&2
      echo "pr_merged=true"
      
      # Delete branch if requested
      if [[ "$DELETE_BRANCH" == "true" && -n "$PR_HEAD" ]]; then
        echo "Deleting branch: $PR_HEAD" >&2
        curl -s -X DELETE -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
          "https://api.github.com/repos/$REPO/git/refs/heads/$PR_HEAD" >/dev/null 2>&1
        echo "branch_deleted=true"
      fi
    else
      echo "Failed to merge PR #$PR_NUMBER" >&2
      echo "Error message: $(echo "$MERGE_RESPONSE" | jq -r '.message')" >&2
      echo "pr_merged=false"
    fi
  else
    echo "PR #$PR_NUMBER is not mergeable at this time (state: $MERGEABLE_STATE)" >&2
    echo "pr_merged=false"
  fi
else
  echo "No valid PR number found in the response" >&2
  echo "has_pr=false"
fi

exit 0 