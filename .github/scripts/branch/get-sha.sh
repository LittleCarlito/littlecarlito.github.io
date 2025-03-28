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
        # Only print the SHA, nothing else
        echo "$sha"
    elif [ -n "$pr_number" ]; then
        # Get SHA using GitHub CLI and print only the SHA
        # Redirect any potential error messages to stderr
        gh pr view "$pr_number" --json headRefOid --jq .headRefOid 2>/dev/null || {
            echo "Error: Failed to get SHA from PR $pr_number" >&2
            return 1
        }
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

    # Call the function which will output only the SHA to stdout
    # Capture the result to ensure we only output the SHA and nothing else
    local result=$(get_sha "$token" "$repo" "$sha" "$pr_number")
    
    # Only output the SHA if it's a valid format (40 or 7 character hex)
    if [[ "$result" =~ ^[0-9a-f]{7,40}$ ]]; then
        echo "$result"
    else
        echo "Error: Invalid SHA format: $result" >&2
        exit 1
    fi
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi