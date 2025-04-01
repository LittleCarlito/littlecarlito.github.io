#!/bin/bash
set -e

# Script to parse JSON input for tags to delete

# Default values
TAGS_INPUT=""

# Process input parameters
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tags-json)
      TAGS_INPUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$TAGS_INPUT" ]; then
  echo "Error: --tags-json is a required parameter"
  exit 1
fi

# Validate JSON input
echo "$TAGS_INPUT" | jq -e . > /dev/null || {
  echo "Error: Invalid JSON input"
  exit 1
}

# Output the parsed JSON directly as matrix input
echo "tags_matrix=$TAGS_INPUT"

# Display what we're going to delete for logging
echo "Will delete the following tags:"
echo "$TAGS_INPUT" | jq -r '.[] | "- \(.package)@\(.version)"' 