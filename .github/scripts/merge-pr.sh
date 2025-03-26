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

# Function to check PR status
check_pr_status() {
    local pr_number=$1
    local status=$(gh pr view "$pr_number" --json state,mergeable,mergeStateStatus,reviewDecision)
    
    # Check if PR is open
    if [ "$(echo "$status" | jq -r '.state')" != "OPEN" ]; then
        echo "Error: PR #$pr_number is not open"
        return 1
    fi
    
    # Check if PR is mergeable
    if [ "$(echo "$status" | jq -r '.mergeable')" != "MERGEABLE" ]; then
        echo "Error: PR #$pr_number is not mergeable"
        return 1
    fi
    
    # Check merge state status
    local merge_state=$(echo "$status" | jq -r '.mergeStateStatus')
    case "$merge_state" in
        "BLOCKED")
            echo "Error: PR #$pr_number is blocked"
            return 1
            ;;
        "BEHIND")
            echo "Error: PR #$pr_number is behind base branch"
            return 1
            ;;
        "DIRTY")
            echo "Error: PR #$pr_number has merge conflicts"
            return 1
            ;;
        "UNKNOWN")
            echo "Error: PR #$pr_number has unknown merge state"
            return 1
            ;;
    esac
    
    # Check review decision
    local review_decision=$(echo "$status" | jq -r '.reviewDecision')
    if [ "$review_decision" != "APPROVED" ]; then
        echo "Error: PR #$pr_number is not approved"
        return 1
    fi
    
    return 0
}

# Function to merge PR
merge_pr() {
    local pr_number=$1
    local merge_method=${2:-"merge"}
    local delete_branch=${3:-true}
    
    echo "Merging PR #$pr_number..."
    
    # Get PR details
    local pr_details=$(gh pr view "$pr_number" --json headRefName,baseRefName)
    local head_branch=$(echo "$pr_details" | jq -r '.headRefName')
    local base_branch=$(echo "$pr_details" | jq -r '.baseRefName')
    
    # Merge PR
    case "$merge_method" in
        "merge")
            gh pr merge "$pr_number" --merge
            ;;
        "squash")
            gh pr merge "$pr_number" --squash
            ;;
        "rebase")
            gh pr merge "$pr_number" --rebase
            ;;
        *)
            echo "Error: Invalid merge method: $merge_method"
            return 1
            ;;
    esac
    
    # Delete branch if requested
    if [ "$delete_branch" = true ]; then
        echo "Deleting branch: $head_branch"
        git push origin --delete "$head_branch"
    fi
    
    echo "Successfully merged PR #$pr_number"
}

# Main function
main() {
    # Parse command line arguments
    local pr_number=""
    local merge_method="merge"
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
    
    echo "Starting PR merge process..."
    
    # Check if PR exists
    if ! check_pr_exists "$pr_number"; then
        echo "Error: PR #$pr_number does not exist"
        exit 1
    fi
    
    # Check PR status
    if ! check_pr_status "$pr_number"; then
        echo "Error: PR #$pr_number is not ready to merge"
        exit 1
    fi
    
    # Merge PR
    merge_pr "$pr_number" "$merge_method" "$delete_branch"
}

# Run main function with all arguments
main "$@" 