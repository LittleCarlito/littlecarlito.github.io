#!/bin/bash
set -e

# Script to generate a JSON summary of pipeline execution results
# This summary will be used for reporting to various platforms

# Initialize variables with default values
WORKFLOW_NAME=""
WORKFLOW_RESULT="unknown"
WORKFLOW_ID=""
WORKFLOW_URL=""
REPOSITORY=""
TRIGGER_SHA=""
TRIGGER_BRANCH=""
OUTPUT_PATH="./summary.json"

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --workflow-name)
      WORKFLOW_NAME="$2"
      shift 2
      ;;
    --workflow-result)
      WORKFLOW_RESULT="$2"
      shift 2
      ;;
    --workflow-id)
      WORKFLOW_ID="$2"
      shift 2
      ;;
    --workflow-url)
      WORKFLOW_URL="$2"
      shift 2
      ;;
    --repository)
      REPOSITORY="$2"
      shift 2
      ;;
    --trigger-sha)
      TRIGGER_SHA="$2"
      shift 2
      ;;
    --trigger-branch)
      TRIGGER_BRANCH="$2"
      shift 2
      ;;
    --output-path)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$WORKFLOW_NAME" ] || [ -z "$WORKFLOW_RESULT" ]; then
  echo "ERROR: workflow-name and workflow-result are required arguments"
  exit 1
fi

# Get timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get short SHA if full SHA is provided
SHORT_SHA="${TRIGGER_SHA:0:7}"

# Determine emoji based on result
if [ "$WORKFLOW_RESULT" == "success" ]; then
  STATUS_EMOJI="✅"
  COLOR="0x57F287" # Discord green
elif [ "$WORKFLOW_RESULT" == "failure" ]; then
  STATUS_EMOJI="❌"
  COLOR="0xED4245" # Discord red
else
  STATUS_EMOJI="⚠️"
  COLOR="0xFEE75C" # Discord yellow
fi

# Create summary object
cat > "$OUTPUT_PATH" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "workflow": {
    "name": "${WORKFLOW_NAME}",
    "result": "${WORKFLOW_RESULT}",
    "id": "${WORKFLOW_ID}",
    "url": "${WORKFLOW_URL}"
  },
  "repository": "${REPOSITORY}",
  "trigger": {
    "sha": "${TRIGGER_SHA}",
    "short_sha": "${SHORT_SHA}",
    "branch": "${TRIGGER_BRANCH}"
  },
  "display": {
    "status_emoji": "${STATUS_EMOJI}",
    "color": "${COLOR}"
  }
}
EOF

# Print summary info
echo "Summary generated at: ${OUTPUT_PATH}"
echo "Workflow: ${WORKFLOW_NAME}"
echo "Result: ${WORKFLOW_RESULT}"
echo "Trigger: ${TRIGGER_BRANCH} (${SHORT_SHA})"

# Set correct permissions
chmod 644 "$OUTPUT_PATH"

# Exit with success
exit 0 