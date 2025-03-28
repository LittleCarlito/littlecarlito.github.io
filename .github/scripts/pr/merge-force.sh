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
        echo "Error: No PR number provided" >&2
        return 1
    fi
    
    local pr_info=""
    pr_info=$(gh pr view "$pr_number" 2>&1) || {
        echo "Error checking PR existence: $pr_info" >&2
        return 1
    }
    
    return 0
}

# Function to get PR state
get_pr_state() {
    local pr_number=$1
    local state=""
    
    if [ -z "$pr_number" ]; then
        echo "Error: No PR number provided" >&2
        return 1
    fi
    
    state=$(gh pr view "$pr_number" --json state --jq '.state' 2>&1) || {
        echo "Error: Could not get state for PR #$pr_number" >&2
        return 1
    }
    
    if [ -z "$state" ] || [ "$state" = "null" ]; then
        echo "Error: Invalid state returned for PR #$pr_number" >&2
        return 1
    fi
    
    echo "$state"
    return 0
}

# Function to check if a branch exists
check_branch_exists() {
    local branch=$1
    
    if [ -z "$branch" ]; then
        echo "Error: No branch name provided" >&2
        return 1
    fi
    
    # Try to fetch the branch
    git fetch origin "$branch" 2>&1 >&2 || {
        # If fetch fails, the branch likely doesn't exist
        return 1
    }
    
    # Check if branch exists on remote
    if git show-ref --verify --quiet refs/remotes/origin/"$branch" 2>&1 >&2; then
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
    
    echo "Force merging PR #$pr_number with admin privileges using method: $merge_method..." >&2
    
    # Validate input
    if [ -z "$pr_number" ]; then
        echo "Error: No PR number provided" >&2
        return 1
    fi
    
    # Validate merge method
    if [[ ! "$merge_method" =~ ^(merge|squash|rebase)$ ]]; then
        echo "Error: Invalid merge method: $merge_method. Must be 'merge', 'squash', or 'rebase'." >&2
        return 1
    fi
    
    # Get PR details
    local pr_details=""
    pr_details=$(gh pr view "$pr_number" --json headRefName,baseRefName 2>&1) || {
        echo "Error getting PR details: $pr_details" >&2
        return 1
    }
    
    # Extract branch names
    local head_branch=""
    head_branch=$(echo "$pr_details" | jq -r '.headRefName' 2>&1) || {
        echo "Error extracting head branch name: $head_branch" >&2
        return 1
    }
    local base_branch=""
    base_branch=$(echo "$pr_details" | jq -r '.baseRefName' 2>&1) || {
        echo "Error extracting base branch name: $base_branch" >&2
        return 1
    }
    
    if [ -z "$head_branch" ] || [ -z "$base_branch" ]; then
        echo "Error: Could not extract branch names from PR #$pr_number" >&2
        return 1
    fi
    
    echo "PR #$pr_number: $head_branch -> $base_branch" >&2
    
    # Try to merge with admin flag first
    echo "Attempting to $merge_method merge PR #$pr_number with --admin flag..." >&2
    
    local merge_output=""
    merge_output=$(gh pr merge "$pr_number" --"$merge_method" --admin --delete-branch 2>&1) || {
        echo "Warning: Admin merge command was not successful: $merge_output" >&2
        echo "Will try alternate merge method..." >&2
    }
    
    # Check if the PR was merged
    sleep 5
    local pr_state=""
    pr_state=$(get_pr_state "$pr_number")
    if [ $? -ne 0 ]; then
        echo "Error: Could not get PR state after merge attempt" >&2
        return 1
    fi
    
    if [ "$pr_state" == "MERGED" ]; then
        echo "Successfully merged PR #$pr_number using admin flag" >&2
        printf "merged=true\n"
    else
        # If still not merged, try direct API call as a fallback
        echo "Admin merge command unsuccessful. PR #$pr_number is still in state: $pr_state" >&2
        echo "Attempting direct merge with API as fallback..." >&2
        
        # Force merge with direct API call
        local api_output=""
        api_output=$(gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            "/repos/$GITHUB_REPOSITORY/pulls/$pr_number/merge" \
            -f merge_method="$merge_method" 2>&1) || {
            echo "Error: API merge failed: $api_output" >&2
            return 1
        }
        
        # Verify the merge actually happened
        sleep 5
        pr_state=$(get_pr_state "$pr_number")
        if [ $? -ne 0 ]; then
            echo "Error: Could not get PR state after API merge attempt" >&2
            return 1
        fi
    fi
    
    # Final check if PR is merged
    if [ "$pr_state" == "MERGED" ]; then
        echo "Successfully merged PR #$pr_number" >&2
        printf "merged=true\n"
        
        # Delete branch if requested and not already deleted
        if [ "$delete_branch" = true ]; then
            echo "Checking if branch $head_branch should be deleted..." >&2
            
            # Only delete if branch exists
            if check_branch_exists "$head_branch"; then
                echo "Deleting branch: $head_branch" >&2
                git push origin --delete "$head_branch" 2>&1 >&2 || {
                    echo "Error: Failed to delete branch $head_branch" >&2
                    return 1
                }
                echo "Branch $head_branch deleted successfully" >&2
                printf "branch_deleted=true\n"
            else
                echo "Branch $head_branch does not exist or cannot be accessed" >&2
            fi
        else
            echo "Branch $head_branch will be kept" >&2
            printf "delete_branch=%s\n" "$delete_branch"
        fi
        
        return 0
    else
        echo "ERROR: Failed to merge PR #$pr_number. Current state: $pr_state" >&2
        printf "merged=false\n"
        return 1
    fi
}

# Parse command line arguments
main() {
    local pr_number=""
    local merge_method="squash"
    local delete_branch=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --pr-number)
                pr_number="$2"
                shift 2
                ;;
            --merge-method)
                merge_method="$2"
                shift 2
                ;;
            --delete-branch)
                delete_branch="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --pr-number <number> [--merge-method <merge|squash|rebase>] [--delete-branch <true|false>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$pr_number" ]; then
        echo "Error: --pr-number is required" >&2
        exit 1
    fi
    
    # Check if PR exists
    check_pr_exists "$pr_number" || exit 1
    
    # Force merge PR
    force_merge_pr "$pr_number" "$merge_method" "$delete_branch" || exit 1
    
    printf "merge_complete=true\n"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 