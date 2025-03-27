#!/bin/bash

# Exit on error
set -e

# Enable debug mode with DEBUG=1
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Function to get required checks for a branch
get_required_checks() {
    local branch=$1
    
    if [ -z "$branch" ]; then
        echo "Error: Empty branch name provided"
        return 1
    fi
    
    local api_output=""
    local endpoint="/repos/$GITHUB_REPOSITORY/branches/$branch/protection"
    
    echo "Fetching required checks for branch: $branch"
    
    api_output=$(gh api "$endpoint" 2>&1) || {
        # Check if error is due to branch not having protection
        if [[ "$api_output" == *"Branch not protected"* ]] || [[ "$api_output" == *"Not Found"* ]]; then
            echo "Warning: Branch $branch does not have protection rules"
            return 0
        fi
        
        echo "Error fetching branch protection: $api_output"
        return 1
    }
    
    # Extract the required checks
    local checks=""
    checks=$(echo "$api_output" | jq -r '.required_status_checks.contexts[] // empty' 2>/dev/null) || {
        echo "Warning: Could not parse required checks from API response"
        return 0
    }
    
    if [ -z "$checks" ]; then
        echo "Warning: No required checks found for branch $branch"
        return 0
    fi
    
    echo "$checks"
    return 0
}

# Function to get current checks for a commit
get_commit_checks() {
    local sha=$1
    
    if [ -z "$sha" ]; then
        echo "Error: Empty SHA provided"
        return 1
    fi
    
    local api_output=""
    local endpoint="/repos/$GITHUB_REPOSITORY/commits/$sha/check-runs"
    
    echo "Fetching check runs for commit: $sha"
    
    api_output=$(gh api "$endpoint" 2>&1) || {
        echo "Error fetching check runs: $api_output"
        return 1
    }
    
    # Extract the check names
    local checks=""
    checks=$(echo "$api_output" | jq -r '.check_runs[] | select(.status=="completed") | .name' 2>/dev/null) || {
        echo "Warning: Could not parse check runs from API response"
        return 0
    }
    
    if [ -z "$checks" ]; then
        echo "Warning: No check runs found for commit $sha"
        return 0
    fi
    
    echo "$checks"
    return 0
}

# Function to check if a specific check is passing
check_if_passing() {
    local sha=$1
    local check_name=$2
    
    if [ -z "$sha" ] || [ -z "$check_name" ]; then
        echo "Error: Empty SHA or check name provided"
        return 1
    fi
    
    local api_output=""
    local endpoint="/repos/$GITHUB_REPOSITORY/commits/$sha/check-runs"
    
    api_output=$(gh api "$endpoint" 2>&1) || {
        echo "Error fetching check run status: $api_output"
        return 1
    }
    
    # Extract the check conclusion
    local check_status=""
    check_status=$(echo "$api_output" | jq -r ".check_runs[] | select(.name==\"$check_name\") | .conclusion" 2>/dev/null) || {
        echo "Warning: Could not parse check status from API response"
        return 1
    }
    
    if [ -z "$check_status" ]; then
        echo "Warning: Check '$check_name' not found for commit $sha"
        return 1
    fi
    
    if [ "$check_status" = "success" ]; then
        echo "Check '$check_name' is passing ✓"
        return 0
    else
        echo "Check '$check_name' is not passing (status: $check_status) ✗"
        return 1
    fi
}

# Function to check if all required checks are passing
check_required_checks() {
    local branch=$1
    local sha=${2:-$(git rev-parse HEAD)}
    local has_errors=0
    
    if [ -z "$branch" ]; then
        echo "Error: Empty branch name provided"
        return 1
    fi
    
    if [ -z "$sha" ]; then
        echo "Error: Could not determine commit SHA"
        return 1
    fi
    
    echo "Checking required checks for branch: $branch"
    echo "Commit SHA: $sha"
    
    # Get required checks
    local required_checks=""
    required_checks=$(get_required_checks "$branch") || {
        # If there's an error but the function returned 0, it means there are no required checks
        # and the function printed a warning, so we can continue with an empty list
        if [ $? -ne 0 ]; then
            echo "Error: Failed to get required checks for branch $branch"
            return 1
        fi
    }
    
    if [ -z "$required_checks" ]; then
        echo "No required checks found for branch $branch, skipping check verification"
        return 0
    fi
    
    echo "Required checks:"
    echo "$required_checks"
    
    # Get current checks
    local current_checks=""
    current_checks=$(get_commit_checks "$sha") || {
        echo "Error: Failed to get current checks for commit $sha"
        return 1
    }
    
    echo "Current checks:"
    echo "$current_checks"
    
    # Check each required check
    while IFS= read -r check; do
        if [ -z "$check" ]; then
            continue
        fi
        
        echo "Checking required check: $check"
        
        if ! echo "$current_checks" | grep -q "^$check$"; then
            echo "Error: Required check '$check' is not present ✗"
            has_errors=1
        else
            # Check if the check passed
            if ! check_if_passing "$sha" "$check"; then
                has_errors=1
            fi
        fi
    done <<< "$required_checks"
    
    if [ $has_errors -eq 0 ]; then
        echo "All required checks are passing! ✓"
        return 0
    else
        echo "Some required checks are failing or missing ✗"
        return 1
    fi
}

# Function to wait for checks to complete
wait_for_checks() {
    local branch=$1
    local sha=${2:-$(git rev-parse HEAD)}
    local timeout=${3:-300} # 5 minutes default timeout
    local interval=10
    local elapsed=0
    local start_time=$(date +%s)
    
    if [ -z "$branch" ]; then
        echo "Error: Empty branch name provided"
        return 1
    fi
    
    if [ -z "$sha" ]; then
        echo "Error: Could not determine commit SHA"
        return 1
    fi
    
    echo "Waiting for checks to complete for branch: $branch, commit: $sha"
    echo "Timeout: $timeout seconds, will check every $interval seconds"
    
    while [ $elapsed -lt $timeout ]; do
        echo "Elapsed time: $elapsed seconds (timeout: $timeout seconds)"
        
        if check_required_checks "$branch" "$sha"; then
            echo "All required checks are passing within $elapsed seconds!"
            return 0
        fi
        
        echo "Waiting for checks to complete... ($elapsed seconds elapsed, timeout: $timeout seconds)"
        sleep $interval
        elapsed=$(($(date +%s) - start_time))
    done
    
    echo "Error: Timeout ($timeout seconds) waiting for checks to complete"
    
    # One final check to see what's still failing
    check_required_checks "$branch" "$sha"
    
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
            --help)
                echo "Usage: $0 --branch <branch-name> [--sha <commit-sha>] [--timeout <seconds>] [--wait]"
                exit 0
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
    
    # Validate numeric timeout if provided
    if [ -n "$timeout" ] && ! [[ "$timeout" =~ ^[0-9]+$ ]]; then
        echo "Error: --timeout must be a positive integer"
        exit 1
    fi
    
    echo "Starting check verification process..."
    
    if [ "$wait" = true ]; then
        echo "Will wait for checks to complete (timeout: ${timeout:-300} seconds)"
        if [ -n "$timeout" ]; then
            if ! wait_for_checks "$branch" "$sha" "$timeout"; then
                echo "Timed out waiting for checks to complete"
                exit 1
            fi
        else
            if ! wait_for_checks "$branch" "$sha"; then
                echo "Timed out waiting for checks to complete"
                exit 1
            fi
        fi
        echo "All checks completed successfully"
        exit 0
    else
        if check_required_checks "$branch" "$sha"; then
            echo "All required checks are passing"
            exit 0
        else
            echo "Some required checks are failing or missing"
            exit 1
        fi
    fi
}

# Run main function with all arguments
main "$@" 