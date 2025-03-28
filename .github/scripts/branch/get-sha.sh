#!/bin/bash

# Exit on error
set -e

# Function to get SHA from a PR number or use provided SHA
get_sha() {
    local token=$1
    local repo=$2
    local sha=$3
    local pr_number=$4
    
    if [ -n "$sha" ]; then
        # Only print the actual SHA with no additional text
        echo "$sha" >&2
    elif [ -n "$pr_number" ]; then
        # Get SHA using GitHub CLI
        PR_SHA=$(gh pr view $pr_number --json headRefOid --jq .headRefOid)
        # Only print the actual SHA with no additional text
        echo "$PR_SHA" >&2
    else
        echo "Error: Either 'sha' or 'pr-number' must be provided" >&2
        return 1
    fi
}

# Main function
main() {
    # Parse command line arguments
    local token=""
    local repo=""
    local sha=""
    local pr_number=""
    
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
            --sha)
                sha="$2"
                shift 2
                ;;
            --pr-number)
                pr_number="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <github-token> --repo <owner/repo> [--sha <commit-sha>] [--pr-number <pr-number>]" >&2
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
    
    # At least one of sha or pr-number must be provided
    if [ -z "$sha" ] && [ -z "$pr_number" ]; then
        echo "Error: Either --sha or --pr-number must be provided" >&2
        exit 1
    fi
    
    # Set GH_TOKEN for gh commands
    export GH_TOKEN="$token"
    
    # Redirect informational messages to stderr
    if [ -n "$sha" ]; then
        echo "Using provided SHA: $sha" >&2
    elif [ -n "$pr_number" ]; then
        echo "Getting SHA from PR #$pr_number" >&2
        PR_SHA=$(gh pr view $pr_number --json headRefOid --jq .headRefOid)
        echo "Got SHA: $PR_SHA" >&2
    fi
    
    # Call the function which will output only the SHA to stdout
    get_sha "$token" "$repo" "$sha" "$pr_number"
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 