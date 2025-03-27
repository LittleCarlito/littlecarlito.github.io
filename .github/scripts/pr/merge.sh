#!/bin/bash

# Exit on error
set -e

# Enable debug mode with DEBUG=1
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Function to check if a PR exists
check_pr_exists() {
    local pr_number=$1
    
    if [ -z "$pr_number" ]; then
        echo "Error: No PR number provided"
        return 1
    fi
    
    local pr_info=""
    pr_info=$(gh pr view "$pr_number" 2>&1) || {
        echo "Error checking PR existence: $pr_info"
        return 1
    }
    
    return 0
}

# Function to check PR status
check_pr_status() {
    local pr_number=$1
    local status_json=""
    
    echo "Checking PR #$pr_number status..."
    
    # Get PR status with error handling
    status_json=$(gh pr view "$pr_number" --json state,mergeable,mergeStateStatus,reviewDecision 2>&1) || {
        echo "Error fetching PR status: $status_json"
        return 1
    }
    
    # Extract PR state
    local pr_state=$(echo "$status_json" | jq -r '.state' 2>/dev/null)
    if [ -z "$pr_state" ] || [ "$pr_state" = "null" ]; then
        echo "Error: Could not extract PR state from API response"
        return 1
    fi
    
    # Check if PR is open
    if [ "$pr_state" != "OPEN" ]; then
        echo "Error: PR #$pr_number is not open (current state: $pr_state)"
        return 1
    fi
    
    # Extract mergeable status
    local mergeable=$(echo "$status_json" | jq -r '.mergeable' 2>/dev/null)
    if [ -z "$mergeable" ] || [ "$mergeable" = "null" ]; then
        echo "Warning: Could not extract mergeable status from API response"
        # Don't fail here, we'll check merge state status
    else
        # Check if PR is mergeable
        if [ "$mergeable" != "MERGEABLE" ]; then
            echo "Error: PR #$pr_number is not mergeable (status: $mergeable)"
            return 1
        fi
    fi
    
    # Extract merge state status
    local merge_state=$(echo "$status_json" | jq -r '.mergeStateStatus' 2>/dev/null)
    if [ -z "$merge_state" ] || [ "$merge_state" = "null" ]; then
        echo "Warning: Could not extract merge state status from API response"
        # Don't fail here, perhaps there are no checks required
    else
        # Check merge state status
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
            "CLEAN")
                echo "PR #$pr_number is ready to merge (clean)"
                ;;
            *)
                echo "Warning: Unrecognized merge state: $merge_state"
                ;;
        esac
    fi
    
    # Extract review decision
    local review_decision=$(echo "$status_json" | jq -r '.reviewDecision' 2>/dev/null)
    if [ -z "$review_decision" ] || [ "$review_decision" = "null" ]; then
        echo "Warning: No review decision found, PR may not require reviews"
    else
        # Check review decision
        if [ "$review_decision" != "APPROVED" ]; then
            echo "Error: PR #$pr_number is not approved (status: $review_decision)"
            return 1
        else
            echo "PR #$pr_number is approved"
        fi
    fi
    
    return 0
}

# Function to check if a branch exists
check_branch_exists() {
    local branch=$1
    
    if [ -z "$branch" ]; then
        echo "Error: No branch name provided"
        return 1
    fi
    
    # Try to fetch the branch
    git fetch origin "$branch" --quiet 2>/dev/null || {
        # If fetch fails, the branch likely doesn't exist
        return 1
    }
    
    # Check if branch exists on remote
    if git show-ref --verify --quiet refs/remotes/origin/"$branch"; then
        return 0
    else
        return 1
    fi
}

# Function to merge PR
merge_pr() {
    local pr_number=$1
    local merge_method=${2:-"merge"}
    local delete_branch=${3:-true}
    local success=0
    
    echo "Merging PR #$pr_number using method: $merge_method..."
    
    # Get PR details before merge
    local pr_details=""
    pr_details=$(gh pr view "$pr_number" --json headRefName,baseRefName 2>&1) || {
        echo "Error getting PR details: $pr_details"
        return 1
    }
    
    # Extract branch names
    local head_branch=$(echo "$pr_details" | jq -r '.headRefName' 2>/dev/null)
    local base_branch=$(echo "$pr_details" | jq -r '.baseRefName' 2>/dev/null)
    
    if [ -z "$head_branch" ] || [ -z "$base_branch" ]; then
        echo "Error: Could not extract branch names from PR #$pr_number"
        return 1
    fi
    
    echo "PR #$pr_number: $head_branch -> $base_branch"
    
    # Merge PR with appropriate method
    local merge_output=""
    case "$merge_method" in
        "merge")
            merge_output=$(gh pr merge "$pr_number" --merge 2>&1) || success=1
            ;;
        "squash")
            merge_output=$(gh pr merge "$pr_number" --squash 2>&1) || success=1
            ;;
        "rebase")
            merge_output=$(gh pr merge "$pr_number" --rebase 2>&1) || success=1
            ;;
        *)
            echo "Error: Invalid merge method: $merge_method"
            return 1
            ;;
    esac
    
    if [ $success -ne 0 ]; then
        echo "Error merging PR #$pr_number: $merge_output"
        return 1
    fi
    
    echo "PR #$pr_number merged successfully!"
    
    # Delete branch if requested
    if [ "$delete_branch" = true ]; then
        echo "Checking if branch $head_branch should be deleted..."
        
        # Only delete if branch exists
        if check_branch_exists "$head_branch"; then
            echo "Deleting branch: $head_branch"
            git push origin --delete "$head_branch" 2>/dev/null || {
                echo "Warning: Failed to delete branch $head_branch, it may have been deleted already"
            }
        else
            echo "Branch $head_branch doesn't exist or was already deleted"
        fi
    else
        echo "Keeping branch $head_branch (delete_branch=$delete_branch)"
    fi
    
    echo "PR #$pr_number process completed successfully"
    return 0
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
            --help)
                echo "Usage: $0 --pr <pr-number> [--method merge|squash|rebase] [--keep-branch]"
                exit 0
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
    
    # Validate merge method
    if [[ ! "$merge_method" =~ ^(merge|squash|rebase)$ ]]; then
        echo "Error: Invalid merge method: $merge_method. Must be 'merge', 'squash', or 'rebase'."
        exit 1
    fi
    
    echo "Starting PR merge process for PR #$pr_number..."
    
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
    if ! merge_pr "$pr_number" "$merge_method" "$delete_branch"; then
        echo "Error: Failed to merge PR #$pr_number"
        exit 1
    fi
    
    echo "Successfully processed PR #$pr_number"
    exit 0
}

# Run main function with all arguments
main "$@" 