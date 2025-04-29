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
    
    while [ $elapsed -lt "$timeout" ]; do
        # Get all check runs for this commit using properly quoted paths
        CHECK_RUNS=$(gh api "/repos/${repo}/commits/${sha}/check-runs" || echo '{"check_runs":[], "total_count":0}')
        
        # Validate the response structure
        if ! echo "$CHECK_RUNS" | jq -e '.check_runs' > /dev/null 2>&1; then
            echo "Warning: GitHub API response doesn't contain expected 'check_runs' array. Response:" >&2
            echo "$CHECK_RUNS" | jq '.' >&2
            echo "Waiting for valid response..." >&2
            sleep $interval
            elapsed=$((elapsed + interval))
            continue
        fi
        
        # Debug check_runs array structure
        echo "Check runs array structure:" >&2
        echo "$CHECK_RUNS" | jq '.check_runs | map(type)' >&2
        
        # Get total count of check runs
        TOTAL_CHECKS=$(echo "$CHECK_RUNS" | jq '.total_count // 0')
        echo "Total check runs: $TOTAL_CHECKS" >&2
        
        if [ "$TOTAL_CHECKS" = "0" ] || [ "$TOTAL_CHECKS" = "null" ]; then
            echo "No checks found yet. Waiting..." >&2
            sleep $interval
            elapsed=$((elapsed + interval))
            continue
        fi
        
        # Use a temporary file to capture jq errors
        ERROR_LOG=$(mktemp)
        
        # Function to safely run jq with error handling
        safe_jq() {
            local query="$1"
            local default="$2"
            local result
            
            # Check if input is an --arg parameter or a regular query
            if [[ "$query" == "--arg"* ]]; then
                # If it contains --arg, split it and run jq properly with arguments
                local arg_name
                local arg_value
                local actual_query
                
                arg_name=$(echo "$query" | awk '{print $2}')
                arg_value=$(echo "$query" | awk '{print $3}')
                actual_query=$(echo "$query" | awk '{$1=$2=$3=""; print $0}' | sed 's/^[ \t]*//')
                
                result=$(echo "$CHECK_RUNS" | jq --arg "$arg_name" "$arg_value" "$actual_query" 2>"$ERROR_LOG" || echo "$default")
            else
                # Regular query without arguments
                result=$(echo "$CHECK_RUNS" | jq "$query" 2>"$ERROR_LOG" || echo "$default")
            fi
            
            if [ -s "$ERROR_LOG" ]; then
                echo "Warning: jq error occurred with query: $query" >&2
                cat "$ERROR_LOG" >&2
                echo "$default"
            else
                echo "$result"
            fi
        }
        
        # Count completed and successful checks using safe_jq
        COMPLETED_CHECKS=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.status == "completed"))] | length' "0")
        SUCCESSFUL_CHECKS=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.status == "completed" and .conclusion == "success"))] | length' "0")
        FAILED_CHECKS=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.status == "completed" and .conclusion != "success" and .conclusion != "neutral" and .conclusion != "skipped"))] | length' "0")
        
        # Use echo and grep to identify which check runs match our workflow
        all_check_names=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.name | type == "string")) | .name]' "[]")
        
        # Extract names in a cleaner way without adding backslashes
        mapfile -t check_name_array < <(echo "$all_check_names" | jq -r '.[]')
        
        # Find workflow checks using pattern matching
        workflow_check_names=""
        for check_name in "${check_name_array[@]}"; do
            # If the check name contains push/create/pr keywords, mark it as a workflow check
            if [[ -n "$check_name" ]] && [[ "$check_name" =~ [Pp]ush|[Cc]reat|PR|[Pp]ull[[:space:]]?[Rr]equest ]]; then
                if [[ -n "$workflow_check_names" ]]; then
                    workflow_check_names="$workflow_check_names
$check_name"
                else
                    workflow_check_names="$check_name"
                fi
            fi
        done
        
        # Count the matches
        workflow_count=0
        if [[ -n "$workflow_check_names" ]]; then
            workflow_count=$(echo "$workflow_check_names" | wc -l)
            workflow_count=$(echo "$workflow_count" | tr -d '[:space:]')
        fi
        WORKFLOW_CHECKS=$workflow_count
        
        # Get in-progress workflow checks
        all_statuses=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.name | type == "string")) | {name: .name, status: .status}]' "[]")
        workflow_in_progress_count=0
        
        # More detailed workflow check debugging
        echo "Workflow check identification:" >&2
        
        # Iterate over all check names to verify detection
        for check_name in "${check_name_array[@]}"; do
            if [[ -n "$check_name" ]]; then
                is_workflow="No"
                status="unknown"
                
                # Check if it's identified as a workflow check
                if echo "$workflow_check_names" | grep -Fq "$check_name"; then
                    is_workflow="Yes"
                    
                    # Get status for this check
                    status=$(echo "$all_statuses" | jq -r ".[] | select(.name == \"$check_name\") | .status")
                    
                    # Count in-progress workflow checks
                    if [[ "$status" == "in_progress" ]]; then
                        workflow_in_progress_count=$((workflow_in_progress_count + 1))
                    fi
                fi
                
                echo "  - '$check_name': workflow=$is_workflow, status=$status" >&2
            fi
        done
        
        WORKFLOW_IN_PROGRESS=$workflow_in_progress_count
        
        echo "Identified as our workflow checks:" >&2
        if [[ -n "$workflow_check_names" ]]; then
            # Use parameter expansion with a loop instead of sed
            while IFS= read -r line; do
                echo "  - $line" >&2
            done <<< "$workflow_check_names"
        else
            echo "  (none)" >&2
        fi
        
        # Calculate non-workflow checks - ensure we don't get negative numbers
        NON_WORKFLOW_TOTAL=$((TOTAL_CHECKS - WORKFLOW_CHECKS))
        if [ "$NON_WORKFLOW_TOTAL" -lt 0 ]; then
            NON_WORKFLOW_TOTAL=0
        fi
        
        # Calculate completed non-workflow checks using set operations
        # Get completed check names
        completed_checks=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.status == "completed")) | .name]' "[]")
        mapfile -t completed_name_array < <(echo "$completed_checks" | jq -r '.[]')
        
        # Count completed checks that aren't workflow checks
        non_workflow_completed_count=0
        for check_name in "${completed_name_array[@]}"; do
            # Check if this name is in workflow_check_names - if not, it's a non-workflow check
            if ! echo "$workflow_check_names" | grep -Fq "$check_name"; then
                non_workflow_completed_count=$((non_workflow_completed_count + 1))
            fi
        done
        
        NON_WORKFLOW_COMPLETED=$non_workflow_completed_count
        
        # Ensure counts are consistent
        if [ "$NON_WORKFLOW_COMPLETED" -gt "$NON_WORKFLOW_TOTAL" ]; then
            NON_WORKFLOW_COMPLETED=$NON_WORKFLOW_TOTAL
        fi
        
        echo "Checks: $COMPLETED_CHECKS/$TOTAL_CHECKS completed overall" >&2
        echo "Non-workflow checks: $NON_WORKFLOW_COMPLETED/$NON_WORKFLOW_TOTAL completed" >&2
        echo "Current workflow checks: $WORKFLOW_CHECKS total, $WORKFLOW_IN_PROGRESS in progress" >&2
        echo "All checks: $SUCCESSFUL_CHECKS successful, $FAILED_CHECKS failed" >&2
        
        # Output all check names for better debugging
        echo "All check names:" >&2
        # Get check info one at a time to avoid JSON parsing issues
        check_count=$(safe_jq '.check_runs | length' "0")
        
        for ((i=0; i<check_count; i++)); do
            check_info=$(safe_jq ".check_runs[$i] | select(. != null) | {name: (.name // \"unnamed\"), status: (.status // \"unknown\"), conclusion: (.conclusion // \"none\")}" "{}")
            
            if [ "$check_info" != "{}" ]; then
                name=$(echo "$check_info" | jq -r '.name // "unnamed"')
                status=$(echo "$check_info" | jq -r '.status // "unknown"')
                conclusion=$(echo "$check_info" | jq -r '.conclusion // "none"')
                echo "  - $name: status=$status, conclusion=$conclusion" >&2
            fi
        done
        
        # If any checks failed, exit
        if [ "$FAILED_CHECKS" != "0" ]; then
            echo "Some checks failed. Aborting." >&2
            printf "%s\n" "checks_status=failed"
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
        # 2. All non-workflow checks are complete (don't require the workflow itself to complete)
        if [ "$COMPLETED_CHECKS" = "$TOTAL_CHECKS" ] || [ "$NON_WORKFLOW_COMPLETED" = "$NON_WORKFLOW_TOTAL" ]; then
            echo "All required checks completed successfully (except possibly our own workflow)!" >&2
            printf "%s\n" "checks_status=success"
            printf "%s\n" "completed_checks=${COMPLETED_CHECKS}"
            printf "%s\n" "total_checks=${TOTAL_CHECKS}"
            printf "%s\n" "successful_checks=${SUCCESSFUL_CHECKS}"
            return 0
        fi
        
        # Check if we're out of time
        if [ $elapsed -ge "$timeout" ]; then
            echo "Timeout waiting for checks to complete." >&2
            printf "%s\n" "checks_status=timeout"
            return 1
        fi
        
        echo "Waiting for all checks to complete ($elapsed/$timeout seconds elapsed)..." >&2
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    # Clean up temporary file
    [ -f "$ERROR_LOG" ] && rm -f "$ERROR_LOG"
    
    echo "Timeout waiting for checks to complete." >&2
    printf "%s\n" "checks_status=timeout"
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