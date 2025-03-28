#!/bin/bash

# Exit on error
set -e

# Function to delete a branch
delete_branch() {
    local token=$1
    local repo=$2
    local branch=$3
    
    echo "Deleting branch $branch..." >&2
    RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
      -H "Authorization: token $token" \
      -H "Accept: application/vnd.github.v3+json" \
      "https://api.github.com/repos/$repo/git/refs/heads/$branch")
    
    # Extract status code and response body
    HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed '$ d')
    
    # Check if delete was successful (2xx status code)
    if [[ $HTTP_STATUS -ge 200 && $HTTP_STATUS -lt 300 ]]; then
        echo "✅ Successfully deleted branch $branch" >&2
        return 0
    else
        echo "❌ Failed to delete branch $branch. Status: $HTTP_STATUS" >&2
        echo "Error: $RESPONSE_BODY" >&2
        return 1
    fi
}

# Main function
main() {
    # Parse command line arguments
    local token=""
    local repo=""
    local branch=""
    
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
            --branch)
                branch="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <github-token> --repo <owner/repo> --branch <branch-name>" >&2
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
    
    if [ -z "$branch" ]; then
        echo "Error: --branch is required" >&2
        exit 1
    fi
    
    delete_branch "$token" "$repo" "$branch"
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 