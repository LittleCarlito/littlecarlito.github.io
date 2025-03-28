#!/bin/bash

# Exit on error
set -e

# Enable debug mode with DEBUG=1
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Function to check if a branch exists
check_branch_exists() {
    local branch=$1
    if [ -z "$branch" ]; then
        echo "Error: Empty branch name provided" >&2
        return 1
    fi
    
    # Fetch to ensure we have latest info
    git fetch origin "$branch" 2>&1 >&2 || true
    
    if git show-ref --verify --quiet refs/heads/"$branch" 2>&1 >&2 || git show-ref --verify --quiet refs/remotes/origin/"$branch" 2>&1 >&2; then
        return 0
    else
        return 1
    fi
}

# Function to check if a branch is up to date
check_branch_up_to_date() {
    local branch=$1
    local base_branch=${2:-main}
    
    # Validate branches are not empty
    if [ -z "$branch" ] || [ -z "$base_branch" ]; then
        echo "Error: Empty branch name provided" >&2
        return 1
    fi
    
    # Fetch latest changes
    echo "Fetching latest changes for $base_branch and $branch..." >&2
    git fetch origin "$base_branch" 2>&1 >&2 || { echo "Failed to fetch $base_branch" >&2; return 1; }
    git fetch origin "$branch" 2>&1 >&2 || { echo "Failed to fetch $branch" >&2; return 1; }
    
    # Get commit hashes
    local base_commit=""
    base_commit=$(git rev-parse origin/"$base_branch" 2>&1) || {
        echo "Error getting commit hash for $base_branch" >&2
        return 1
    }
    local branch_commit=""
    branch_commit=$(git rev-parse origin/"$branch" 2>&1) || {
        echo "Error getting commit hash for $branch" >&2
        return 1
    }
    
    # Validate commit hashes
    if [ -z "$base_commit" ]; then
        echo "Error: Could not get commit hash for $base_branch" >&2
        return 1
    fi
    
    if [ -z "$branch_commit" ]; then
        echo "Error: Could not get commit hash for $branch" >&2
        return 1
    fi
    
    # Check if base branch is an ancestor of branch
    if git merge-base --is-ancestor "$base_commit" "$branch_commit" 2>&1 >&2; then
        echo "$branch is up to date with $base_branch" >&2
        return 0
    else
        echo "$branch is behind $base_branch and needs to be updated" >&2
        return 1
    fi
}

# Function to check branch protection rules
check_branch_protection() {
    local branch=$1
    local required_checks=("build" "test" "lint")
    local missing_checks=()
    local endpoint="/repos/$GITHUB_REPOSITORY/branches/$branch/protection"
    
    # Validate branch name
    if [ -z "$branch" ]; then
        echo "Error: Empty branch name provided" >&2
        return 1
    fi
    
    echo "Checking branch protection for $branch..." >&2
    
    # Get status checks for the branch with error handling
    local api_response=""
    api_response=$(gh api "$endpoint" 2>&1) || {
        # Check if error is related to missing protection
        if [[ "$api_response" == *"Branch not protected"* ]] || [[ "$api_response" == *"Not Found"* ]]; then
            echo "Warning: Branch $branch does not have protection rules" >&2
            return 0  # Not a critical error, continue
        else
            echo "Error getting branch protection: $api_response" >&2
            return 1
        fi
    }
    
    # Extract required checks with fallback for invalid JSON
    local checks=""
    checks=$(echo "$api_response" | jq -r '.required_status_checks.contexts[]' 2>&1) || {
        echo "Warning: Could not parse branch protection JSON, continuing..." >&2
        return 0
    }
    
    # If protection doesn't have required status checks
    if [ -z "$checks" ]; then
        echo "Warning: No required status checks found for $branch" >&2
        
        if [[ "$branch" == "main" ]] || [[ "$branch" == "master" ]]; then
            echo "Critical branch without protection checks detected" >&2
            return 1
        fi
        
        return 0
    fi
    
    # Check each required check
    for check in "${required_checks[@]}"; do
        if ! echo "$checks" | grep -q "$check"; then
            missing_checks+=("$check")
        fi
    done
    
    if [ ${#missing_checks[@]} -eq 0 ]; then
        echo "All required checks are configured for $branch" >&2
        return 0
    else
        echo "Missing required checks: ${missing_checks[*]}" >&2
        return 1
    fi
}

# Function to check for failing checks
check_failing_checks() {
    local branch=$1
    local failing_count=0
    
    # Validate branch name
    if [ -z "$branch" ]; then
        echo "Error: Empty branch name provided" >&2
        return 1
    fi
    
    echo "Checking latest commit status for $branch..." >&2
    
    # Get latest commit and check status
    local latest_commit=""
    latest_commit=$(git rev-parse origin/"$branch" 2>&1) || {
        echo "Error getting latest commit for $branch" >&2
        return 1
    }
    
    if [ -z "$latest_commit" ]; then
        echo "Error: Could not get latest commit for $branch" >&2
        return 1
    fi
    
    # Get failing checks with error handling
    local api_response=""
    api_response=$(gh api "/repos/$GITHUB_REPOSITORY/commits/$latest_commit/check-runs" 2>&1) || {
        echo "Error getting check-runs: $api_response" >&2
        return 1
    }
    
    # Extract failing checks
    local failing_checks=""
    failing_checks=$(echo "$api_response" | jq -r '.check_runs[] | select(.conclusion=="failure") | .name' 2>&1) || {
        echo "Warning: Could not parse check-runs JSON, continuing..." >&2
        return 0
    }
    
    # Check if we have failing checks
    if [ -n "$failing_checks" ]; then
        echo "Branch has failing checks:" >&2
        echo "$failing_checks" >&2
        failing_count=$(echo "$failing_checks" | wc -l)
        return 1
    else
        echo "No failing checks detected for $branch" >&2
        return 0
    fi
}

# Function to check branch status
check_branch_status() {
    local branch=$1
    local base_branch=${2:-main}
    local has_errors=0
    
    echo "Checking status for branch: $branch" >&2
    
    # Check if branch exists
    if ! check_branch_exists "$branch"; then
        echo "Error: Branch $branch does not exist" >&2
        has_errors=1
    fi
    
    # Check if branch is up to date
    if ! check_branch_up_to_date "$branch" "$base_branch"; then
        echo "Error: Branch $branch is not up to date with $base_branch" >&2
        has_errors=1
    fi
    
    # Check branch protection rules
    if ! check_branch_protection "$branch"; then
        has_errors=1
    fi
    
    # Check for open pull requests
    local pr_count=0
    pr_count=$(gh pr list --head "$branch" --state open --json number | jq 'length' 2>&1) || {
        echo "Warning: Could not get PR count for $branch" >&2
        pr_count=0
    }
    
    if [ "$pr_count" -gt 0 ]; then
        echo "Warning: Branch has $pr_count open pull request(s)" >&2
    fi
    
    # Check for failing checks
    if ! check_failing_checks "$branch"; then
        has_errors=1
    fi
    
    if [ $has_errors -eq 0 ]; then
        echo "Branch $branch passed all checks" >&2
    fi
    
    return $has_errors
}

# Main function
main() {
    # Parse command line arguments
    local branch=""
    local base_branch="main"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch)
                branch="$2"
                shift 2
                ;;
            --base)
                base_branch="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 --branch <branch-name> [--base <base-branch>]" >&2
                exit 0
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --branch <branch-name> [--base <base-branch>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$branch" ]; then
        echo "Error: --branch is required" >&2
        exit 1
    fi
    
    echo "Starting branch status check..." >&2
    
    if check_branch_status "$branch" "$base_branch"; then
        echo "Branch status check passed!" >&2
        exit 0
    else
        echo "Branch status check failed!" >&2
        exit 1
    fi
}

# Run main function with all arguments
main "$@" 