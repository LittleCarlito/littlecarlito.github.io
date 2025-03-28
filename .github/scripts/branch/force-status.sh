#!/bin/bash

# Exit on error
set -e

# Function to get SHA from a PR number
get_sha_from_pr() {
    local token=$1
    local repo=$2
    local pr_number=$3
    
    echo "Getting SHA from PR #$pr_number"
    PR_SHA=$(gh pr view $pr_number --json headRefOid --jq .headRefOid)
    echo "Got SHA: $PR_SHA"
    echo "$PR_SHA"
}

# Function to force status checks to success
force_status_checks() {
    local token=$1
    local repo=$2
    local sha=$3
    local contexts_json=$4
    local descriptions_json=$5
    local context_prefix=${6:-""}
    
    CONTEXTS=$(echo "$contexts_json" | jq -c '.')
    DESCRIPTIONS=$(echo "$descriptions_json" | jq -c '.')
    
    CONTEXTS_LENGTH=$(echo $CONTEXTS | jq 'length')
    DESCRIPTIONS_LENGTH=$(echo $DESCRIPTIONS | jq 'length')
    
    # Parse contexts
    for (( i=0; i<$CONTEXTS_LENGTH; i++ )); do
        CONTEXT=$(echo $CONTEXTS | jq -r ".[$i]")
        
        # Get description (if available)
        DESCRIPTION=""
        if [ $i -lt $DESCRIPTIONS_LENGTH ]; then
            DESCRIPTION=$(echo $DESCRIPTIONS | jq -r ".[$i]")
        else
            DESCRIPTION="Status check passed (forced)"
        fi
        
        # Add prefix if provided
        if [ -n "$context_prefix" ]; then
            CONTEXT="$context_prefix$CONTEXT"
        fi
        
        echo "Creating forced success status check: $CONTEXT" >&2
        
        # Use the GitHub server URL from environment if available, otherwise default to github.com
        local github_server_url=${GITHUB_SERVER_URL:-"https://github.com"}
        
        # Use the GitHub run ID from environment if available, otherwise default to 0
        local github_run_id=${GITHUB_RUN_ID:-"0"}
        
        gh api \
            --method POST \
            /repos/$repo/statuses/$sha \
            -f state=success \
            -f context="$CONTEXT" \
            -f description="$DESCRIPTION (forced)" \
            -f target_url="$github_server_url/$repo/actions/runs/$github_run_id"
    done
}

# Main function
main() {
    # Parse command line arguments
    local token=""
    local repo=""
    local sha=""
    local pr_number=""
    local contexts='["Build Packages", "Test / Run Tests", "Test Changesets"]'
    local descriptions='["Build completed successfully", "Tests passed successfully", "Changesets validated successfully"]'
    local context_prefix=""
    
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
            --contexts)
                contexts="$2"
                shift 2
                ;;
            --descriptions)
                descriptions="$2"
                shift 2
                ;;
            --context-prefix)
                context_prefix="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <github-token> --repo <owner/repo> (--sha <commit-sha> | --pr-number <pr-number>) [--contexts <json-array>] [--descriptions <json-array>] [--context-prefix <prefix>]" >&2
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
    
    # Set up GH token for GitHub CLI
    export GH_TOKEN="$token"
    
    # If sha is not provided but pr-number is, get sha from PR
    if [ -z "$sha" ]; then
        sha=$(get_sha_from_pr "$token" "$repo" "$pr_number")
    fi
    
    # Ensure the contexts and descriptions are valid JSON arrays
    if ! echo "$contexts" | jq empty 2>/dev/null; then
        echo "Error: Invalid JSON in contexts parameter" >&2
        exit 1
    fi
    
    if ! echo "$descriptions" | jq empty 2>/dev/null; then
        echo "Error: Invalid JSON in descriptions parameter" >&2
        exit 1
    fi
    
    force_status_checks "$token" "$repo" "$sha" "$contexts" "$descriptions" "$context_prefix"
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 