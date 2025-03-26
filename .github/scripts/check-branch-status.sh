#!/bin/bash

# Exit on error
set -e

# Function to check if a branch exists
check_branch_exists() {
    local branch=$1
    if git show-ref --verify --quiet refs/heads/"$branch"; then
        return 0
    else
        return 1
    fi
}

# Function to check if a branch is up to date
check_branch_up_to_date() {
    local branch=$1
    local base_branch=${2:-main}
    
    git fetch origin "$base_branch" > /dev/null 2>&1
    git fetch origin "$branch" > /dev/null 2>&1
    
    local base_commit=$(git rev-parse origin/"$base_branch")
    local branch_commit=$(git rev-parse origin/"$branch")
    
    if git merge-base --is-ancestor "$base_commit" "$branch_commit"; then
        return 0
    else
        return 1
    fi
}

# Function to check branch protection rules
check_branch_protection() {
    local branch=$1
    local required_checks=("build" "test" "lint")
    local missing_checks=()
    
    # Get status checks for the branch
    local checks=$(gh api "/repos/$GITHUB_REPOSITORY/branches/$branch/protection" --jq '.required_status_checks.contexts[]' 2>/dev/null || echo "")
    
    # Check each required check
    for check in "${required_checks[@]}"; do
        if ! echo "$checks" | grep -q "$check"; then
            missing_checks+=("$check")
        fi
    done
    
    if [ ${#missing_checks[@]} -eq 0 ]; then
        return 0
    else
        echo "Missing required checks: ${missing_checks[*]}"
        return 1
    fi
}

# Function to check branch status
check_branch_status() {
    local branch=$1
    local base_branch=${2:-main}
    local has_errors=0
    
    echo "Checking status for branch: $branch"
    
    # Check if branch exists
    if ! check_branch_exists "$branch"; then
        echo "Error: Branch $branch does not exist"
        has_errors=1
    fi
    
    # Check if branch is up to date
    if ! check_branch_up_to_date "$branch" "$base_branch"; then
        echo "Error: Branch $branch is not up to date with $base_branch"
        has_errors=1
    fi
    
    # Check branch protection rules
    if ! check_branch_protection "$branch"; then
        has_errors=1
    fi
    
    # Check for open pull requests
    local pr_count=$(gh pr list --head "$branch" --state open --json number | jq length)
    if [ "$pr_count" -gt 0 ]; then
        echo "Warning: Branch has $pr_count open pull request(s)"
    fi
    
    # Check for failing checks
    local failing_checks=$(gh api "/repos/$GITHUB_REPOSITORY/commits/$branch/check-runs" --jq '.check_runs[] | select(.conclusion=="failure") | .name')
    if [ -n "$failing_checks" ]; then
        echo "Error: Branch has failing checks:"
        echo "$failing_checks"
        has_errors=1
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
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 --branch <branch-name> [--base <base-branch>]"
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$branch" ]; then
        echo "Error: --branch is required"
        exit 1
    fi
    
    echo "Starting branch status check..."
    
    if check_branch_status "$branch" "$base_branch"; then
        echo "Branch status check passed!"
    else
        echo "Branch status check failed!"
        exit 1
    fi
}

# Run main function with all arguments
main "$@" 