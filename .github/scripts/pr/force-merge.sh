#!/bin/bash

# Exit on error
set -e

# Function to force merge a PR
force_merge_pr() {
    local token=$1
    local repo=$2
    local pr_number=$3
    local commit_title=$4
    local merge_method=${5:-"squash"}
    local delete_branch=${6:-"true"}
    
    # Get PR details
    PR_INFO=$(gh pr view $pr_number --json headRefName,mergeable,mergeStateStatus)
    HEAD_BRANCH=$(echo "$PR_INFO" | jq -r '.headRefName')
    MERGEABLE=$(echo "$PR_INFO" | jq -r '.mergeable')
    MERGE_STATE=$(echo "$PR_INFO" | jq -r '.mergeStateStatus')
    
    echo "PR #$pr_number details:" >&2
    echo "Head branch: $HEAD_BRANCH" >&2
    echo "Mergeable: $MERGEABLE" >&2
    echo "Merge state: $MERGE_STATE" >&2
    
    # Create JSON payload with jq to handle escaping properly
    JSON_PAYLOAD=$(jq -n \
      --arg title "$commit_title" \
      --arg method "$merge_method" \
      '{
        "commit_title": $title,
        "commit_message": "",
        "merge_method": $method
      }')
    
    echo "Attempting direct API merge with title: $commit_title" >&2
    
    # Merge the PR using the GitHub API directly
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
      -H "Authorization: token $token" \
      -H "Accept: application/vnd.github.v3+json" \
      "https://api.github.com/repos/$repo/pulls/$pr_number/merge" \
      -d "$JSON_PAYLOAD")
    
    # Extract status code and response body
    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed '$ d')
    
    echo "Response body: $RESPONSE_BODY" >&2
    echo "Status code: $HTTP_STATUS" >&2
    
    # Check if merge was successful (2xx status code)
    if [[ $HTTP_STATUS -ge 200 && $HTTP_STATUS -lt 300 ]]; then
        echo "✅ Successfully merged PR #$pr_number" >&2
        
        # Delete branch if requested
        if [ "$delete_branch" = "true" ]; then
            echo "Deleting branch $HEAD_BRANCH..." >&2
            curl -X DELETE \
              -H "Authorization: token $token" \
              -H "Accept: application/vnd.github.v3+json" \
              "https://api.github.com/repos/$repo/git/refs/heads/$HEAD_BRANCH"
            
            echo "Branch $HEAD_BRANCH has been deleted" >&2
        fi
        return 0
    else
        echo "❌ Failed to merge PR #$pr_number. Status: $HTTP_STATUS" >&2
        echo "Error: $RESPONSE_BODY" >&2
        return 1
    fi
}

# Main function
main() {
    # Parse command line arguments
    local token=""
    local repo=""
    local pr_number=""
    local commit_title="Merge pull request"
    local merge_method="squash"
    local delete_branch="true"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --token)
                token="$2"
                shift 2
                ;;
            --repo)
                repo="$2"
                shift 2
                ;;
            --pr-number)
                pr_number="$2"
                shift 2
                ;;
            --commit-title)
                commit_title="$2"
                shift 2
                ;;
            --merge-method)
                merge_method="$2"
                shift 2
                ;;
            --delete-branch)
                delete_branch="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <github-token> --repo <owner/repo> --pr-number <pr-number> [--commit-title <title>] [--merge-method <merge|squash|rebase>] [--delete-branch <true|false>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$token" ]; then
        echo "Error: --token is required" >&2
        exit 1
    fi
    
    if [ -z "$repo" ]; then
        echo "Error: --repo is required" >&2
        exit 1
    fi
    
    if [ -z "$pr_number" ]; then
        echo "Error: --pr-number is required" >&2
        exit 1
    fi
    
    # Set GH_TOKEN for gh commands
    export GH_TOKEN="$token"
    
    force_merge_pr "$token" "$repo" "$pr_number" "$commit_title" "$merge_method" "$delete_branch"
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 