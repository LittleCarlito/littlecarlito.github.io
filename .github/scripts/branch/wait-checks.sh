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
            
            result=$(echo "$CHECK_RUNS" | jq "$query" 2>"$ERROR_LOG" || echo "$default")
            
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
        
        # Count checks from current workflow - MUCH MORE FLEXIBLE MATCHING
        # Convert both the check name and the workflow name to lowercase and remove common words for comparison
        # This makes the matching more resistant to minor wording changes
        simplified_name=$(echo "$current_workflow" | tr '[:upper:]' '[:lower:]' | sed 's/and//g' | sed 's/pr//g' | sed 's/pull//g' | sed 's/request//g')
        
        WORKFLOW_CHECKS=$(safe_jq --arg name "$simplified_name" '
        [.check_runs[] | 
          select(
            (. | type == "object") and 
            (.name | type == "string") and 
            ((.name | ascii_downcase | gsub("and|pr|pull|request"; "")) | contains($name) or $name | contains(.name | ascii_downcase | gsub("and|pr|pull|request"; "")))
          )
        ] | length' "0")
        
        WORKFLOW_IN_PROGRESS=$(safe_jq --arg name "$simplified_name" '
        [.check_runs[] | 
          select(
            (. | type == "object") and
            (.status != "completed") and
            (.name | type == "string") and 
            ((.name | ascii_downcase | gsub("and|pr|pull|request"; "")) | contains($name) or $name | contains(.name | ascii_downcase | gsub("and|pr|pull|request"; "")))
          )
        ] | length' "0")
        
        # For debugging: show exactly which checks were recognized as "our workflow"
        OUR_WORKFLOW_CHECKS=$(safe_jq --arg name "$simplified_name" '
        [.check_runs[] | 
          select(
            (. | type == "object") and
            (.name | type == "string") and 
            ((.name | ascii_downcase | gsub("and|pr|pull|request"; "")) | contains($name) or $name | contains(.name | ascii_downcase | gsub("and|pr|pull|request"; "")))
          ) | .name] | join(", ")' "none")
        
        # FALLBACK: If no checks were identified as workflow checks, look for specific push/create PR patterns
        if [ "$WORKFLOW_CHECKS" = "0" ]; then
            echo "No workflow checks identified by name matching, looking for specific patterns..." >&2
            WORKFLOW_CHECKS=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.name | type == "string") and (.name | test("(?i)push.*creat|creat.*pr|push.*pr|pull.*request")))] | length' "0")
            WORKFLOW_IN_PROGRESS=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.status != "completed") and (.name | type == "string") and (.name | test("(?i)push.*creat|creat.*pr|push.*pr|pull.*request")))] | length' "0")
            OUR_WORKFLOW_CHECKS=$(safe_jq '[.check_runs[] | select((. | type == "object") and (.name | type == "string") and (.name | test("(?i)push.*creat|creat.*pr|push.*pr|pull.*request"))) | .name] | join(", ")' "none")
            echo "After fallback pattern matching, found $WORKFLOW_CHECKS workflow checks" >&2
        fi
        
        echo "Identified as our workflow checks: $OUR_WORKFLOW_CHECKS" >&2
        
        # Calculate non-workflow checks
        NON_WORKFLOW_TOTAL=$((TOTAL_CHECKS - WORKFLOW_CHECKS))
        NON_WORKFLOW_COMPLETED=$(safe_jq --arg name "$current_workflow" '[.check_runs[] | select((. | type == "object") and (.status == "completed") and ((.name | type != "string") or (.name | contains($name) | not)))] | length' "0")
        
        echo "Checks: $COMPLETED_CHECKS/$TOTAL_CHECKS completed overall" >&2
        echo "Non-workflow checks: $NON_WORKFLOW_COMPLETED/$NON_WORKFLOW_TOTAL completed" >&2
        echo "Current workflow checks: $WORKFLOW_CHECKS total, $WORKFLOW_IN_PROGRESS in progress" >&2
        echo "All checks: $SUCCESSFUL_CHECKS successful, $FAILED_CHECKS failed" >&2
        
        # Output all check names for better debugging
        echo "All check names:" >&2
        FULL_CHECK_INFO=$(safe_jq '.check_runs[] | select(. | type == "object") | "\(.name // "unnamed"), status: \(.status // "unknown"), conclusion: \(.conclusion // "none")"' "[]" | tr '\n' ', ')
        echo "$FULL_CHECK_INFO" >&2
        
        # If any checks failed, exit
        if [ "$FAILED_CHECKS" != "0" ]; then
            echo "Some checks failed. Aborting." >&2
            printf "checks_status=failed\n"
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
            printf "checks_status=success\n"
            printf "completed_checks=$COMPLETED_CHECKS\n"
            printf "total_checks=$TOTAL_CHECKS\n"
            printf "successful_checks=$SUCCESSFUL_CHECKS\n"
            return 0
        fi
        
        # Check if we're out of time
        if [ $elapsed -ge $timeout ]; then
            echo "Timeout waiting for checks to complete." >&2
            printf "checks_status=timeout\n"
            return 1
        fi
        
        echo "Waiting for all checks to complete ($elapsed/$timeout seconds elapsed)..." >&2
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    # Clean up temporary file
    [ -f "$ERROR_LOG" ] && rm -f "$ERROR_LOG"
    
    echo "Timeout waiting for checks to complete." >&2
    printf "checks_status=timeout\n"
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