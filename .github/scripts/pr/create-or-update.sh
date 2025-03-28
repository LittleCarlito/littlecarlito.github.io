#!/bin/bash

# Exit on error
set -e

# Function to find or create a PR
find_or_create_pr() {
    local token=$1
    local repo=$2
    local base_branch=$3
    local head_branch=$4
    local title=$5
    local body=$6
    
    # Check if PR already exists
    echo "Checking for existing PR..." >&2
    EXISTING_PR=$(gh pr list \
      --repo "$repo" \
      --head "$head_branch" \
      --base "$base_branch" \
      --json number,url,state \
      --jq '.[0]' 2>&2)
    
    if [ -n "$EXISTING_PR" ]; then
        echo "Found existing PR" >&2
        PR_NUMBER=$(echo "$EXISTING_PR" | jq -r '.number')
        PR_URL=$(echo "$EXISTING_PR" | jq -r '.url')
        PR_STATE=$(echo "$EXISTING_PR" | jq -r '.state')
    else
        echo "Creating new PR" >&2
        # Create PR - use the GitHub CLI which properly handles special characters
        PR_RESPONSE=$(gh pr create \
          --repo "$repo" \
          --base "$base_branch" \
          --head "$head_branch" \
          --title "$title" \
          --body "$body" 2>&2)
        
        PR_NUMBER=$(echo "$PR_RESPONSE" | grep -o '[0-9]*$')
        PR_URL="https://github.com/$repo/pull/$PR_NUMBER"
        PR_STATE="open"
    fi
    
    # Output results in a format suitable for parsing
    printf "pr_number=%s\n" "$PR_NUMBER"
    printf "pr_url=%s\n" "$PR_URL"
    printf "pr_state=%s\n" "$PR_STATE"
}

# Main function
main() {
    # Parse command line arguments
    local token=""
    local repo=""
    local base_branch="main"
    local head_branch=""
    local title=""
    local body=""
    
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
            --base-branch)
                base_branch="$2"
                shift 2
                ;;
            --head-branch)
                head_branch="$2"
                shift 2
                ;;
            --title)
                title="$2"
                shift 2
                ;;
            --body)
                body="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <github-token> --repo <owner/repo> --head-branch <branch> --title <title> [--base-branch <branch>] [--body <body>]" >&2
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
    
    if [ -z "$head_branch" ]; then
        echo "Error: --head-branch is required" >&2
        exit 1
    fi
    
    if [ -z "$title" ]; then
        echo "Error: --title is required" >&2
        exit 1
    fi
    
    # Set GH_TOKEN for gh commands
    export GH_TOKEN="$token"
    
    find_or_create_pr "$token" "$repo" "$base_branch" "$head_branch" "$title" "$body"
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 