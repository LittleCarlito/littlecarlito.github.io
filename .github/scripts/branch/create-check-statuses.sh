#!/bin/bash
set -e

# Help text
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: create-check-statuses.sh [options]"
  echo ""
  echo "Options:"
  echo "  --token <token>         GitHub token for authentication"
  echo "  --repo <repo>           Repository name (owner/repo)"
  echo "  --sha <sha>             Commit SHA to add checks to"
  echo "  --contexts <json>       JSON array of check context names"
  echo "  --descriptions <json>   Optional JSON array of check descriptions (same length as contexts)"
  echo "  --state <state>         Check state (default: success)"
  echo "  --target-url <url>      URL to link checks to"
  echo ""
  exit 0
fi

# Default values
STATE="success"
REPO="${GITHUB_REPOSITORY}"
TARGET_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --token)
      TOKEN="$2"
      shift
      shift
      ;;
    --repo)
      REPO="$2"
      shift
      shift
      ;;
    --sha)
      SHA="$2"
      shift
      shift
      ;;
    --contexts)
      CONTEXTS="$2"
      shift
      shift
      ;;
    --descriptions)
      DESCRIPTIONS="$2"
      shift
      shift
      ;;
    --state)
      STATE="$2"
      shift
      shift
      ;;
    --target-url)
      TARGET_URL="$2"
      shift
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$TOKEN" ]; then
  echo "Error: GitHub token is required"
  exit 1
fi

if [ -z "$SHA" ]; then
  echo "Error: Commit SHA is required"
  exit 1
fi

if [ -z "$CONTEXTS" ]; then
  echo "Error: Contexts array is required"
  exit 1
fi

# Set GitHub token for CLI/API
export GH_TOKEN="$TOKEN"

# Parse contexts array
CONTEXT_ARRAY=$(echo "$CONTEXTS" | jq -r '.[]')

# Parse descriptions array if provided
if [ -n "$DESCRIPTIONS" ]; then
  DESCRIPTION_ARRAY=$(echo "$DESCRIPTIONS" | jq -r '.[]')
else
  # Use default descriptions based on context names
  DESCRIPTION_ARRAY=$(echo "$CONTEXTS" | jq -r '.[] | . + " completed successfully"')
fi

# Create status for each context
COUNTER=0
while read -r CONTEXT; do
  # Get corresponding description
  DESCRIPTION=$(echo "$DESCRIPTION_ARRAY" | sed -n "$((COUNTER+1))p")
  if [ -z "$DESCRIPTION" ]; then
    DESCRIPTION="$CONTEXT completed successfully"
  fi
  
  echo "Creating $STATE status for context: $CONTEXT"
  
  # Use GitHub API to create status
  gh api \
    --method POST \
    "/repos/$REPO/statuses/$SHA" \
    -f state="$STATE" \
    -f context="$CONTEXT" \
    -f description="$DESCRIPTION" \
    -f target_url="$TARGET_URL"
  
  echo "Created $STATE status for $CONTEXT: $DESCRIPTION"
  COUNTER=$((COUNTER+1))
done <<< "$CONTEXT_ARRAY"

echo "Created $COUNTER status checks for commit $SHA"
echo "status_count=$COUNTER" >> $GITHUB_OUTPUT 