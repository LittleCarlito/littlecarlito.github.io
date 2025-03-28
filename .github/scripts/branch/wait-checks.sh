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
    
    echo "Waiting for checks to complete on commit $sha (excluding $current_workflow)..." >&2
    echo "Timeout: $timeout seconds, Minimum required checks: $min_required_checks" >&2
    
    # Wait initial time for checks to start appearing
    echo "Waiting 5 seconds for checks to start appearing..." >&2
    sleep 5
    
    # Wait for checks to complete (until timeout)
    local interval=10
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        # Get all check runs for this commit
        CHECK_RUNS=$(gh api /repos/$repo/commits/$sha/check-runs)
        
        # Get total count of check runs
        TOTAL_CHECKS=$(echo "$CHECK_RUNS" | jq '.total_count')
        echo "Total check runs: $TOTAL_CHECKS" >&2
        
        if [ "$TOTAL_CHECKS" = "0" ]; then
            echo "No checks found yet. Waiting..." >&2
            sleep $interval
            elapsed=$((elapsed + interval))
            continue
        fi
        
        # Count completed and successful checks
        COMPLETED_CHECKS=$(echo "$CHECK_RUNS" | jq '[.check_runs[] | select(.status == "completed")] | length')
        SUCCESSFUL_CHECKS=$(echo "$CHECK_RUNS" | jq '[.check_runs[] | select(.status == "completed" and .conclusion == "success")] | length')
        FAILED_CHECKS=$(echo "$CHECK_RUNS" | jq '[.check_runs[] | select(.status == "completed" and .conclusion != "success" and .conclusion != "neutral" and .conclusion != "skipped")] | length')
        
        # Count checks from current workflow - MORE FLEXIBLE MATCHING
        # Using contains() rather than exact match to be more resilient to name changes
        # Make sure we only apply contains() to string values
        WORKFLOW_CHECKS=$(echo "$CHECK_RUNS" | jq --arg name "$current_workflow" '[.check_runs[] | select((.name | type == "string") and (.name | contains($name)))] | length')
        WORKFLOW_IN_PROGRESS=$(echo "$CHECK_RUNS" | jq --arg name "$current_workflow" '[.check_runs[] | select(.status != "completed" and (.name | type == "string") and (.name | contains($name)))] | length')
        
        # For debugging: show exactly which checks were recognized as "our workflow"
        OUR_WORKFLOW_CHECKS=$(echo "$CHECK_RUNS" | jq --arg name "$current_workflow" '.check_runs[] | select((.name | type == "string") and (.name | contains($name))) | .name')
        echo "Identified as our workflow checks: $OUR_WORKFLOW_CHECKS" >&2
        
        # Calculate non-workflow checks
        NON_WORKFLOW_TOTAL=$((TOTAL_CHECKS - WORKFLOW_CHECKS))
        NON_WORKFLOW_COMPLETED=$(echo "$CHECK_RUNS" | jq --arg name "$current_workflow" '[.check_runs[] | select(.status == "completed" and ((.name | type != "string") or (.name | contains($name) | not)))] | length')
        
        echo "Checks: $COMPLETED_CHECKS/$TOTAL_CHECKS completed overall" >&2
        echo "Non-workflow checks: $NON_WORKFLOW_COMPLETED/$NON_WORKFLOW_TOTAL completed" >&2
        echo "Current workflow checks: $WORKFLOW_CHECKS total, $WORKFLOW_IN_PROGRESS in progress" >&2
        echo "All checks: $SUCCESSFUL_CHECKS successful, $FAILED_CHECKS failed" >&2
        
        # Output all check names for better debugging
        echo "All check names:" >&2
        echo "$CHECK_RUNS" | jq -r '.check_runs[] | "\(.name), status: \(.status), conclusion: \(.conclusion)"' >&2
        
        # If any checks failed, exit
        if [ "$FAILED_CHECKS" != "0" ]; then
            echo "Some checks failed. Aborting." >&2
            return 1
        fi
        
        # Make sure we have at least the minimum required number of non-workflow checks
        if [ "$NON_WORKFLOW_TOTAL" -lt "$min_required_checks" ]; then
            echo "Waiting for more checks to appear. Expected at least $min_required_checks, but found $NON_WORKFLOW_TOTAL" >&2
            sleep $interval
            elapsed=$((elapsed + interval))
            continue
        fi
        
        # CRITICAL FIX: Match the original lies.yaml logic
        # Proceed ONLY if either:
        # 1. ALL checks are complete, OR
        # 2. All non-workflow checks are complete AND exactly one workflow check is still running
        if [ "$COMPLETED_CHECKS" = "$TOTAL_CHECKS" ] || [ "$NON_WORKFLOW_COMPLETED" = "$NON_WORKFLOW_TOTAL" -a "$WORKFLOW_IN_PROGRESS" = "1" -a "$WORKFLOW_CHECKS" = "1" ]; then
            echo "All required checks completed successfully (except possibly our own workflow)!" >&2
            return 0
        fi
        
        # Check if we're out of time
        if [ $elapsed -ge $timeout ]; then
            echo "Timeout waiting for checks to complete." >&2
            return 1
        fi
        
        echo "Waiting for all checks to complete ($elapsed/$timeout seconds elapsed)..." >&2
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo "Timeout waiting for checks to complete." >&2
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
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --repo <owner/repo> --sha <commit-sha> --workflow <workflow-name> [--timeout <seconds>] [--min-checks <number>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$repo" ]; then
        echo "Error: --repo is required" >&2
        exit 1
    fi
    
    if [ -z "$sha" ]; then
        echo "Error: --sha is required" >&2
        exit 1
    fi
    
    if [ -z "$workflow_name" ]; then
        echo "Error: --workflow is required" >&2
        exit 1
    fi
    
    wait_for_checks "$repo" "$sha" "$workflow_name" "$timeout" "$min_checks"
}

# Run main function with all arguments (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 