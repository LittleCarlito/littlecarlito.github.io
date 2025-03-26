#!/bin/bash

# Exit on error
set -e

# Function to check if a PR exists
check_pr_exists() {
    local pr_number=$1
    if gh pr view "$pr_number" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to get PR state
get_pr_state() {
    local pr_number=$1
    gh pr view "$pr_number" --json state --jq '.state'
}

# Function to force merge PR with admin privileges
force_merge_pr() {
    local pr_number=$1
    local merge_method=${2:-"squash"}
    local delete_branch=${3:-true}
    
    echo "Force merging PR #$pr_number with admin privileges..."
    
    # Get PR details
    local pr_details=$(gh pr view "$pr_number" --json headRefName,baseRefName)
    local head_branch=$(echo "$pr_details" | jq -r '.headRefName')
    local base_branch=$(echo "$pr_details" | jq -r '.baseRefName')
    
    # Try to merge with admin flag first
    echo "Attempting to $merge_method merge PR #$pr_number with --admin flag..."
    gh pr merge "$pr_number" --"$merge_method" --admin --delete-branch || true
    
    # Check if the PR was merged
    sleep 5
    local pr_state=$(get_pr_state "$pr_number")
    if [ "$pr_state" == "MERGED" ]; then
        echo "Successfully merged PR #$pr_number using admin flag"
        return 0
    fi
    
    # If still not merged, try direct API call as a fallback
    echo "Admin merge command unsuccessful. PR #$pr_number is still in state: $pr_state"
    echo "Attempting direct merge with API as fallback..."
    
    # Force merge with direct API call
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        /repos/"$GITHUB_REPOSITORY"/pulls/"$pr_number"/merge \
        -f merge_method="$merge_method"
    
    # Verify the merge actually happened
    sleep 5
    pr_state=$(get_pr_state "$pr_number")
    if [ "$pr_state" == "MERGED" ]; then
        echo "Successfully merged PR #$pr_number using API call"
        
        # Delete branch if requested and not already deleted
        if [ "$delete_branch" = true ]; then
            echo "Deleting branch: $head_branch"
            git push origin --delete "$head_branch" || true
        fi
        
        return 0
    else
        echo "ERROR: Failed to merge PR #$pr_number. Current state: $pr_state"
        return 1
    fi
}

# Main function
main() {
    # Parse command line arguments
    local pr_number=""
    local merge_method="squash"
    local delete_branch=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --pr)
                pr_number="$2"
                shift 2
                ;;
            --method)
                merge_method="$2"
                shift 2
                ;;
            --keep-branch)
                delete_branch=false
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 --pr <pr-number> [--method merge|squash|rebase] [--keep-branch]"
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$pr_number" ]; then
        echo "Error: --pr is required"
        exit 1
    fi
    
    echo "Starting force PR merge process..."
    
    # Check if PR exists
    if ! check_pr_exists "$pr_number"; then
        echo "Error: PR #$pr_number does not exist"
        exit 1
    fi
    
    # Attempt force merge
    force_merge_pr "$pr_number" "$merge_method" "$delete_branch"
}

# Run main function with all arguments
main "$@" 