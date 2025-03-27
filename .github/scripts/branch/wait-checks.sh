#!/bin/bash

# Exit on error
set -e

# Function to wait for checks excluding the current workflow
wait_for_checks() {
    local repo=$1
    local sha=$2
    local current_workflow=$3
    local timeout=${4:-300}
    local min_required_checks=${5:-3}
    
    echo "Waiting for checks to complete on commit $sha (excluding $current_workflow)..."
    echo "Timeout: $timeout seconds, Minimum required checks: $min_required_checks"
    
    # Wait initial time for checks to start appearing
    echo "Waiting 5 seconds for checks to start appearing..."
    sleep 5
    
    # Wait for checks to complete (until timeout)
    local interval=10
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        # Get all check runs for this commit
        CHECK_RUNS=$(gh api /repos/$repo/commits/$sha/check-runs)
        
        # Get total count of check runs
        TOTAL_CHECKS=$(echo "$CHECK_RUNS" | jq '.total_count')
        echo "Total check runs: $TOTAL_CHECKS"
        
        if [ "$TOTAL_CHECKS" = "0" ]; then
            echo "No checks found yet. Waiting..."
            sleep $interval
            elapsed=$((elapsed + interval))
            continue
        fi
        
        # Count checks from current workflow
        OUR_CHECKS=$(echo "$CHECK_RUNS" | jq --arg name "$current_workflow" '[.check_runs[] | select(.name == $name)] | length')
        OUR_CHECKS_IN_PROGRESS=$(echo "$CHECK_RUNS" | jq --arg name "$current_workflow" '[.check_runs[] | select(.status != "completed" and .name == $name)] | length')
        
        # Calculate non-workflow checks
        NON_WORKFLOW_TOTAL=$((TOTAL_CHECKS - OUR_CHECKS))
        NON_WORKFLOW_COMPLETED=$(echo "$CHECK_RUNS" | jq --arg name "$current_workflow" '[.check_runs[] | select(.status == "completed" and .name != $name)] | length')
        
        # Count successful and failed checks
        SUCCESSFUL_CHECKS=$(echo "$CHECK_RUNS" | jq '[.check_runs[] | select(.status == "completed" and .conclusion == "success")] | length')
        FAILED_CHECKS=$(echo "$CHECK_RUNS" | jq '[.check_runs[] | select(.status == "completed" and .conclusion != "success" and .conclusion != "neutral" and .conclusion != "skipped")] | length')
        
        echo "Checks: $NON_WORKFLOW_COMPLETED/$NON_WORKFLOW_TOTAL completed (excluding current workflow)"
        echo "Current workflow checks: $OUR_CHECKS total, $OUR_CHECKS_IN_PROGRESS in progress"
        echo "All checks: $SUCCESSFUL_CHECKS successful, $FAILED_CHECKS failed"
        
        # Output all check names for better debugging
        echo "All check names:"
        echo "$CHECK_RUNS" | jq -r '.check_runs[] | "\(.name), status: \(.status), conclusion: \(.conclusion)"'
        
        # If any checks failed, exit
        if [ "$FAILED_CHECKS" != "0" ]; then
            echo "Some checks failed. Aborting."
            return 1
        fi
        
        # Make sure we have at least the minimum required number of non-workflow checks
        if [ "$NON_WORKFLOW_TOTAL" -lt "$min_required_checks" ]; then
            echo "Waiting for more checks to appear. Expected at least $min_required_checks, but found $NON_WORKFLOW_TOTAL"
            sleep $interval
            elapsed=$((elapsed + interval))
            continue
        fi
        
        # Proceed if all non-workflow checks are complete
        if [ "$NON_WORKFLOW_COMPLETED" = "$NON_WORKFLOW_TOTAL" ]; then
            echo "All required checks completed successfully (excluding current workflow)!"
            return 0
        fi
        
        # Check if we're out of time
        if [ $elapsed -ge $timeout ]; then
            echo "Timeout waiting for checks to complete."
            return 1
        fi
        
        echo "Waiting for all checks to complete ($elapsed/$timeout seconds elapsed)..."
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo "Timeout waiting for checks to complete."
    return 1
}

# Main function
main() {
    # Parse command line arguments
    local repo=""
    local sha=""
    local workflow_name=""
    local timeout="300"
    local min_checks="3"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --repo)
                repo="$2"
                shift 2
                ;;
            --sha)
                sha="$2"
                shift 2
                ;;
            --workflow)
                workflow_name="$2"
                shift 2
                ;;
            --timeout)
                timeout="$2"
                shift 2
                ;;
            --min-checks)
                min_checks="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 --repo <owner/repo> --sha <commit-sha> --workflow <workflow-name> [--timeout <seconds>] [--min-checks <number>]"
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$repo" ]; then
        echo "Error: --repo is required"
        exit 1
    fi
    
    if [ -z "$sha" ]; then
        echo "Error: --sha is required"
        exit 1
    fi
    
    if [ -z "$workflow_name" ]; then
        echo "Error: --workflow is required"
        exit 1
    fi
    
    wait_for_checks "$repo" "$sha" "$workflow_name" "$timeout" "$min_checks"
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 