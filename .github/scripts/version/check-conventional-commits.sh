#!/bin/bash
set -e

# Help text
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: check-conventional-commits.sh [options]"
  echo ""
  echo "Options:"
  echo "  --base-commit <commit>    Base commit to check from (default: auto-detect)"
  echo "  --since <time/commit>     Check commits since this time or commit"
  echo "  --auto-prefix <prefix>    Prefix for auto-generated version commits to exclude (default: auto-)"
  echo ""
  exit 0
fi

# Default values
BASE_COMMIT=""
SINCE=""
AUTO_PREFIX="auto-"

# Parse arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --base-commit)
      BASE_COMMIT="$2"
      shift
      shift
      ;;
    --since)
      SINCE="$2"
      shift
      shift
      ;;
    --auto-prefix)
      AUTO_PREFIX="$2"
      shift
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Determine base commit to check from
if [ -n "$BASE_COMMIT" ]; then
  echo "Using provided base commit: $BASE_COMMIT"
elif [ -n "$SINCE" ]; then
  BASE_COMMIT="$SINCE"
  echo "Using provided since value as base commit: $BASE_COMMIT"
else
  # Auto-detect the most recent reference point
  LATEST_TAG_COMMIT=$(git rev-list --tags --max-count=1)
  
  if [ -n "$LATEST_TAG_COMMIT" ]; then
    BASE_COMMIT=$LATEST_TAG_COMMIT
    echo "Using latest tag commit as base: $BASE_COMMIT"
  else
    # Get the first commit in the repo
    BASE_COMMIT=$(git rev-list --max-parents=0 HEAD)
    echo "No tags found, using first commit in repo: $BASE_COMMIT"
  fi
fi

# Count conventional commits, excluding auto-generated version commits
if [[ $BASE_COMMIT =~ ^[0-9a-f]{7,40}$ ]]; then
  # If it's a valid commit hash
  CONVENTIONAL_COUNT=$(git log $BASE_COMMIT..HEAD --format=%s | grep -E '^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]+\))?!?:' | grep -v "$AUTO_PREFIX-generate version" | wc -l | tr -d ' ')
  RANGE="$BASE_COMMIT..HEAD"
else
  # If it's a date or other reference
  CONVENTIONAL_COUNT=$(git log --since="$BASE_COMMIT" --format=%s | grep -E '^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]+\))?!?:' | grep -v "$AUTO_PREFIX-generate version" | wc -l | tr -d ' ')
  RANGE="since $BASE_COMMIT"
fi

echo "Found $CONVENTIONAL_COUNT conventional commits $RANGE"
echo "base_commit=$BASE_COMMIT" >> $GITHUB_OUTPUT
echo "conventional_count=$CONVENTIONAL_COUNT" >> $GITHUB_OUTPUT 