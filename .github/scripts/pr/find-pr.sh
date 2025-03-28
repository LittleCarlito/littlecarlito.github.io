#!/bin/bash

# Exit on error
set -e

# Find PR script
# Searches for PRs matching specific criteria

# Main find PR function
find_pr() {
    local token="$1"
    local repo="$2"
    local title_pattern="$3"
    local head_branch="$4"
    local base_branch="$5"
    
    echo "Finding PRs in repository: $repo" >&2
    
    # Set up filters
    local filters=""
    
    if [ -n "$title_pattern" ]; then
        echo "Looking for PRs with title matching: $title_pattern" >&2
        filters="$filters | select(.title | contains(\"$title_pattern\"))"
    fi
    
    if [ -n "$head_branch" ]; then
        echo "Looking for PRs with head branch: $head_branch" >&2
        filters="$filters | select(.headRefName == \"$head_branch\")"
    fi
    
    if [ -n "$base_branch" ]; then
        echo "Looking for PRs with base branch: $base_branch" >&2
        filters="$filters | select(.baseRefName == \"$base_branch\")"
    fi
    
    # If no filters, add a default to avoid syntax error
    if [ -z "$filters" ]; then
        filters=" | ."
    fi
    
    # Construct the JQ query
    local query=".[]$filters"
    
    # Run the query
    PR_DATA=$(gh pr list --repo "$repo" --json number,title,headRefName,baseRefName,state --jq "$query")
    
    if [ -z "$PR_DATA" ]; then
        echo "No PR found matching criteria" >&2
        echo "pr_number=" > /dev/stdout
        echo "has_pr=false" > /dev/stdout
    else
        # Assuming we might get multiple results, take the first one
        PR_NUMBER=$(echo "$PR_DATA" | jq -r '.number' | head -n 1)
        PR_TITLE=$(echo "$PR_DATA" | jq -r '.title' | head -n 1)
        PR_STATE=$(echo "$PR_DATA" | jq -r '.state' | head -n 1)
        
        echo "Found PR #$PR_NUMBER: $PR_TITLE (state: $PR_STATE)" >&2
        echo "pr_number=$PR_NUMBER" > /dev/stdout
        echo "has_pr=true" > /dev/stdout
        echo "pr_title=$PR_TITLE" > /dev/stdout
        echo "pr_state=$PR_STATE" > /dev/stdout
    fi
}

# Parse command line arguments
main() {
    local token=""
    local repo=""
    local title_pattern=""
    local head_branch=""
    local base_branch=""
    
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
            --title)
                title_pattern="$2"
                shift 2
                ;;
            --head-branch)
                head_branch="$2"
                shift 2
                ;;
            --base-branch)
                base_branch="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <token> --repo <owner/repo> [--title <pattern>] [--head-branch <branch>] [--base-branch <branch>]" >&2
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
    
    # At least one search criteria should be provided
    if [ -z "$title_pattern" ] && [ -z "$head_branch" ] && [ -z "$base_branch" ]; then
        echo "Error: At least one search criteria (--title, --head-branch, or --base-branch) must be provided" >&2
        exit 1
    fi
    
    # Set GH_TOKEN for gh commands
    export GH_TOKEN="$token"
    
    # Call find function
    find_pr "$token" "$repo" "$title_pattern" "$head_branch" "$base_branch"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 