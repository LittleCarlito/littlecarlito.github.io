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

# Function to get PR state
get_pr_state() {
    local pr_number=$1
    local state=""
    
    if [ -z "$pr_number" ]; then
        echo "Error: No PR number provided"
        return 1
    }
    
    state=$(gh pr view "$pr_number" --json state --jq '.state' 2>/dev/null) || {
        echo "Error: Could not get state for PR #$pr_number"
        return 1
    }
    
    if [ -z "$state" ] || [ "$state" = "null" ]; then
        echo "Error: Invalid state returned for PR #$pr_number"
        return 1
    }
    
    echo "$state"
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

# Function to force merge PR with admin privileges
force_merge_pr() {
    local pr_number=$1
    local merge_method=${2:-"squash"}
    local delete_branch=${3:-true}
    
    echo "Force merging PR #$pr_number with admin privileges using method: $merge_method..."
    
    # Validate input
    if [ -z "$pr_number" ]; then
        echo "Error: No PR number provided"
        return 1
    fi
    
    # Validate merge method
    if [[ ! "$merge_method" =~ ^(merge|squash|rebase)$ ]]; then
        echo "Error: Invalid merge method: $merge_method. Must be 'merge', 'squash', or 'rebase'."
        return 1
    }
    
    # Get PR details
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
    }
    
    echo "PR #$pr_number: $head_branch -> $base_branch"
    
    # Try to merge with admin flag first
    echo "Attempting to $merge_method merge PR #$pr_number with --admin flag..."
    
    local merge_output=""
    merge_output=$(gh pr merge "$pr_number" --"$merge_method" --admin --delete-branch 2>&1) || {
        echo "Warning: Admin merge command was not successful: $merge_output"
        echo "Will try alternate merge method..."
    }
    
    # Check if the PR was merged
    sleep 5
    local pr_state=""
    pr_state=$(get_pr_state "$pr_number")
    if [ $? -ne 0 ]; then
        echo "Error: Could not get PR state after merge attempt"
        return 1
    fi
    
    if [ "$pr_state" == "MERGED" ]; then
        echo "Successfully merged PR #$pr_number using admin flag"
    else
        # If still not merged, try direct API call as a fallback
        echo "Admin merge command unsuccessful. PR #$pr_number is still in state: $pr_state"
        echo "Attempting direct merge with API as fallback..."
        
        # Force merge with direct API call
        local api_output=""
        api_output=$(gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            "/repos/$GITHUB_REPOSITORY/pulls/$pr_number/merge" \
            -f merge_method="$merge_method" 2>&1) || {
            echo "Error: API merge failed: $api_output"
            return 1
        }
        
        # Verify the merge actually happened
        sleep 5
        pr_state=$(get_pr_state "$pr_number")
        if [ $? -ne 0 ]; then
            echo "Error: Could not get PR state after API merge attempt"
            return 1
        fi
    fi
    
    # Final check if PR is merged
    if [ "$pr_state" == "MERGED" ]; then
        echo "Successfully merged PR #$pr_number"
        
        # Delete branch if requested and not already deleted
        if [ "$delete_branch" = true ]; then
            echo "Checking if branch $head_branch should be deleted..."
            
            # Only delete if branch exists
            if check_branch_exists "$head_branch"; then
                echo "Deleting branch: $head_branch"
                git push origin --delete "$head_branch" 2>/dev/null || {
                    echo "Warning: Failed to delete branch $head_branch, it may have been deleted automatically or by another process"
                }
            else
                echo "Branch $head_branch doesn't exist or was already deleted"
            fi
        else
            echo "Keeping branch $head_branch (delete_branch=$delete_branch)"
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
    
    echo "Starting force PR merge process for PR #$pr_number..."
    
    # Check if PR exists
    if ! check_pr_exists "$pr_number"; then
        echo "Error: PR #$pr_number does not exist"
        exit 1
    fi
    
    # Attempt force merge
    if force_merge_pr "$pr_number" "$merge_method" "$delete_branch"; then
        echo "Force merge of PR #$pr_number completed successfully!"
        exit 0
    else
        echo "Force merge of PR #$pr_number failed."
        exit 1
    fi
}

# Run main function with all arguments
main "$@" 