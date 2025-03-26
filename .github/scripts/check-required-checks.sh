#!/bin/bash

# Exit on error
set -e

# Function to get required checks for a branch
get_required_checks() {
    local branch=$1
    local checks=$(gh api "/repos/$GITHUB_REPOSITORY/branches/$branch/protection" --jq '.required_status_checks.contexts[]' 2>/dev/null || echo "")
    echo "$checks"
}

# Function to get current checks for a commit
get_commit_checks() {
    local sha=$1
    local checks=$(gh api "/repos/$GITHUB_REPOSITORY/commits/$sha/check-runs" --jq '.check_runs[] | select(.status=="completed") | .name')
    echo "$checks"
}

# Function to check if all required checks are passing
check_required_checks() {
    local branch=$1
    local sha=${2:-$(git rev-parse HEAD)}
    local has_errors=0
    
    echo "Checking required checks for branch: $branch"
    echo "Commit SHA: $sha"
    
    # Get required checks
    local required_checks=$(get_required_checks "$branch")
    if [ -z "$required_checks" ]; then
        echo "Warning: No required checks found for branch $branch"
        return 0
    fi
    
    echo "Required checks:"
    echo "$required_checks"
    
    # Get current checks
    local current_checks=$(get_commit_checks "$sha")
    echo "Current checks:"
    echo "$current_checks"
    
    # Check each required check
    while IFS= read -r check; do
        if ! echo "$current_checks" | grep -q "^$check$"; then
            echo "Error: Required check '$check' is not present"
            has_errors=1
        else
            # Check if the check passed
            local check_status=$(gh api "/repos/$GITHUB_REPOSITORY/commits/$sha/check-runs" --jq ".check_runs[] | select(.name==\"$check\") | .conclusion")
            if [ "$check_status" != "success" ]; then
                echo "Error: Required check '$check' is not passing"
                has_errors=1
            fi
        fi
    done <<< "$required_checks"
    
    return $has_errors
}

# Function to wait for checks to complete
wait_for_checks() {
    local branch=$1
    local sha=${2:-$(git rev-parse HEAD)}
    local timeout=${3:-300} # 5 minutes default timeout
    local interval=10
    local elapsed=0
    
    echo "Waiting for checks to complete..."
    
    while [ $elapsed -lt $timeout ]; do
        if check_required_checks "$branch" "$sha"; then
            echo "All required checks are passing!"
            return 0
        fi
        
        echo "Waiting for checks to complete... ($elapsed seconds elapsed)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo "Error: Timeout waiting for checks to complete"
    return 1
}

# Main function
main() {
    # Parse command line arguments
    local branch=""
    local sha=""
    local timeout=""
    local wait=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch)
                branch="$2"
                shift 2
                ;;
            --sha)
                sha="$2"
                shift 2
                ;;
            --timeout)
                timeout="$2"
                shift 2
                ;;
            --wait)
                wait=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 --branch <branch-name> [--sha <commit-sha>] [--timeout <seconds>] [--wait]"
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$branch" ]; then
        echo "Error: --branch is required"
        exit 1
    fi
    
    echo "Starting check verification process..."
    
    if [ "$wait" = true ]; then
        if [ -n "$timeout" ]; then
            wait_for_checks "$branch" "$sha" "$timeout"
        else
            wait_for_checks "$branch" "$sha"
        fi
    else
        check_required_checks "$branch" "$sha"
    fi
}

# Run main function with all arguments
main "$@" 