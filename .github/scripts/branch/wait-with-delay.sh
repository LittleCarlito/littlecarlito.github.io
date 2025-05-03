#!/bin/bash
set -e

# Script to wait for checks with an initial delay to avoid race conditions
# Usage: wait-with-delay.sh --repo owner/repo --sha COMMIT_SHA [--workflow NAME] [--timeout 300] [--min-checks 3] [--initial-delay 30]

REPO=""
SHA=""
WORKFLOW=""
TIMEOUT=300
MIN_CHECKS=3
INITIAL_DELAY=10

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --sha)
      SHA="$2"
      shift 2
      ;;
    --workflow)
      WORKFLOW="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --min-checks)
      MIN_CHECKS="$2"
      shift 2
      ;;
    --initial-delay)
      INITIAL_DELAY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$REPO" ] || [ -z "$SHA" ]; then
  echo "ERROR: repo and sha are required arguments"
  echo "Usage: wait-with-delay.sh --repo owner/repo --sha COMMIT_SHA [--workflow NAME] [--timeout 300] [--min-checks 3] [--initial-delay 30]"
  exit 1
fi

# Apply initial delay to avoid race conditions with PR creation/GitHub API
if [ $INITIAL_DELAY -gt 0 ]; then
  echo "Waiting $INITIAL_DELAY seconds before checking PR status to avoid race conditions..."
  sleep $INITIAL_DELAY
fi

# Call the original wait-checks.sh script
if [ -f ".github/scripts/branch/wait-checks.sh" ]; then
  ARGS=(
    "--repo" "$REPO"
    "--sha" "$SHA"
  )
  
  if [ -n "$WORKFLOW" ]; then
    ARGS+=("--workflow" "$WORKFLOW")
  fi
  
  ARGS+=(
    "--timeout" "$TIMEOUT"
    "--min-checks" "$MIN_CHECKS"
  )
  
  bash .github/scripts/branch/wait-checks.sh "${ARGS[@]}"
  RESULT=$?
  
  if [ $RESULT -ne 0 ]; then
    echo "Checks failed or timed out"
    exit $RESULT
  fi
else
  echo "ERROR: wait-checks.sh script not found at .github/scripts/branch/wait-checks.sh"
  exit 1
fi

echo "All checks passed successfully"
exit 0 