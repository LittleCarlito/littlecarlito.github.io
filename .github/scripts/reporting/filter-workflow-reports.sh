#!/bin/bash
set -e

# Script to determine if a workflow report should be sent based on branch and workflow context
# This helps avoid duplicate notifications from the same logical event
# Usage: filter-workflow-reports.sh --workflow-name NAME --branch BRANCH [--source webhook|dispatch] [--summary "Text"]

WORKFLOW_NAME=""
BRANCH=""
SOURCE="webhook"
SUMMARY=""

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --workflow-name)
      WORKFLOW_NAME="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --source)
      SOURCE="$2"
      shift 2
      ;;
    --summary)
      SUMMARY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$WORKFLOW_NAME" ] || [ -z "$BRANCH" ]; then
  echo "ERROR: workflow-name and branch are required arguments"
  echo "Usage: filter-workflow-reports.sh --workflow-name NAME --branch BRANCH [--source webhook|dispatch] [--summary \"Text\"]"
  exit 1
fi

# Default response - should report
SHOULD_REPORT="true"
REASON="Default reporting behavior"

# Rule 1: Skip changeset branches for Push and Create PR failures
if [[ "$WORKFLOW_NAME" == "Push and Create PR" && "$BRANCH" == chore/generate-changesets-* ]]; then
  SHOULD_REPORT="false"
  REASON="Skipping failure report from Push and Create PR on changeset branch: $BRANCH"
fi

# Rule 2: Skip reports that contain 'reported from' in the summary (avoid duplicates)
if [[ -n "$SUMMARY" && "$SUMMARY" == *"reported from"* ]]; then
  SHOULD_REPORT="false"
  REASON="Skipping duplicate report: Summary contains 'reported from'"
fi

# Rule 3: Allow Main Pipeline reports regardless of branch
if [[ "$WORKFLOW_NAME" == "Main Pipeline" ]]; then
  SHOULD_REPORT="true"
  REASON="Always report Main Pipeline results"
fi

# Rule 4: Only report failures from Manual Clean and Generate Changesets on main branch
if [[ "$WORKFLOW_NAME" == "Manual Clean and Generate Changesets" && "$BRANCH" != "main" ]]; then
  SHOULD_REPORT="false"
  REASON="Skipping report from Manual Clean on non-main branch: $BRANCH"
fi

# Output results in format that GitHub Actions can parse
echo "should_report=$SHOULD_REPORT"
echo "reason=$REASON"

# Log the decision for debugging
echo "$REASON"

# Always exit with success, let the calling workflow decide what to do based on the should_report value
exit 0 