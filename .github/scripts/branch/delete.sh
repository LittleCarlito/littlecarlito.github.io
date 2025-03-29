#!/bin/bash

# Exit on error
set -e

# Function to delete a branch
delete_branch() {
    local token=$1
    local repo=$2
    local branch=$3
    local max_attempts=${4:-3}  # Default to 3 attempts if not specified
    local success=false
    local method=""
    
    echo "Deleting branch $branch... (max attempts: $max_attempts)" >&2
    
    # Try API deletion first, then git command as fallback
    for attempt in $(seq 1 $max_attempts); do
        # On odd attempts use API, on even attempts use git
        if [ $((attempt % 2)) -eq 1 ]; then
            method="API"
            
            # API deletion via curl
            RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
              -H "Authorization: token $token" \
              -H "Accept: application/vnd.github.v3+json" \
              "https://api.github.com/repos/$repo/git/refs/heads/$branch")
            
            # Extract status code and response body
            HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
            RESPONSE_BODY=$(echo "$RESPONSE" | sed '$ d')
            
            # Check if delete was successful (2xx status code)
            if [[ $HTTP_STATUS -ge 200 && $HTTP_STATUS -lt 300 ]]; then
                echo "✅ Successfully deleted branch $branch via $method (attempt $attempt)" >&2
                success=true
                break
            else
                echo "❌ Failed to delete branch $branch via $method. Status: $HTTP_STATUS" >&2
                echo "Error: $RESPONSE_BODY" >&2
            fi
        else
            method="git command"
            
            # Git push deletion
            if git push "https://${token}@github.com/${repo}.git" --delete "$branch" 2>/dev/null; then
                echo "✅ Successfully deleted branch $branch via $method (attempt $attempt)" >&2
                success=true
                break
            else
                echo "❌ Failed to delete branch $branch via $method" >&2
            fi
        fi
        
        # Only wait if we're going to try again
        if [ $attempt -lt $max_attempts ]; then
            echo "Waiting 3 seconds before next attempt..." >&2
            sleep 3
        fi
    done
    
    # Return success/failure
    if [ "$success" = true ]; then
        return 0
    else
        return 1
    fi
}

# Function to delete related changeset branches if any
delete_changeset_branches() {
    local token=$1
    local repo=$2
    local prefix=$3
    
    # Only look for changeset branches if this is a version branch
    if [[ "$prefix" != "version-packages-"* ]]; then
        return 0
    fi
    
    echo "Looking for related changeset branches to clean up..." >&2
    
    # Ensure we have latest remote info
    git fetch --prune origin 2>/dev/null || true
    
    # Find changeset branches (created in the last 2 days to avoid deleting unrelated ones)
    CHANGESET_BRANCHES=$(git branch -r | grep "origin/changeset-release/auto-" | sed 's|origin/||')
    
    if [ -z "$CHANGESET_BRANCHES" ]; then
        echo "No changeset branches found to clean up" >&2
        return 0
    fi
    
    echo "Found changeset branches to clean up:" >&2
    echo "$CHANGESET_BRANCHES" >&2
    
    # Delete each changeset branch
    for branch in $CHANGESET_BRANCHES; do
        echo "Cleaning up changeset branch: $branch" >&2
        delete_branch "$token" "$repo" "$branch" 2  # Use fewer attempts for these
    done
    
    return 0
}

# Main function
main() {
    # Parse command line arguments
    local token=""
    local repo=""
    local branch=""
    local cleanup_changesets="false"
    local max_attempts=3
    
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
            --cleanup-changesets)
                cleanup_changesets="$2"
                shift 2
                ;;
            --max-attempts)
                max_attempts="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <github-token> --repo <owner/repo> --branch <branch-name> [--cleanup-changesets true|false] [--max-attempts <number>]" >&2
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
    
    # Delete the branch
    if delete_branch "$token" "$repo" "$branch" "$max_attempts"; then
        echo "branch_deleted=true"
        
        # Also clean up related changeset branches if requested
        if [ "$cleanup_changesets" = "true" ]; then
            delete_changeset_branches "$token" "$repo" "$branch"
        fi
    else
        echo "branch_deleted=false"
        exit 1
    fi
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 