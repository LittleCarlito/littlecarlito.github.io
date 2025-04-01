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
TRIGGER_DETAILS=""
TRIGGER_SOURCE=""
TRIGGER_INFO=""
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
    --trigger-details)
      TRIGGER_DETAILS="$2"
      shift 2
      ;;
    --trigger-source)
      TRIGGER_SOURCE="$2"
      shift 2
      ;;
    --trigger-info)
      TRIGGER_INFO="$2"
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

# Extract additional details from summary if provided
SUMMARY="${github_event_inputs_summary:-}"
if [ -n "$SUMMARY" ]; then
  # Try to extract details from the summary
  if [[ "$SUMMARY" == *"Details:"* ]]; then
    DETAILS=$(echo "$SUMMARY" | grep -oP 'Details: \K[^.]+' || echo "")
    if [ -n "$DETAILS" ]; then
      TRIGGER_DETAILS="$DETAILS"
    fi
  fi
  
  if [[ "$SUMMARY" == *"Branch:"* ]]; then
    BRANCH_INFO=$(echo "$SUMMARY" | grep -oP 'Branch: \K[^.]+' || echo "")
    if [ -n "$BRANCH_INFO" ]; then
      TRIGGER_SOURCE="$BRANCH_INFO"
    fi
  fi
  
  if [[ "$SUMMARY" == *"Triggered by"* ]]; then
    TRIGGER_INFO_TEXT=$(echo "$SUMMARY" | grep -oP 'Triggered by \K[^.]+' || echo "")
    if [ -n "$TRIGGER_INFO_TEXT" ]; then
      TRIGGER_INFO="$TRIGGER_INFO_TEXT"
    fi
  fi
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
    "branch": "${TRIGGER_BRANCH}",
    "details": "${TRIGGER_DETAILS}",
    "source": "${TRIGGER_SOURCE}",
    "info": "${TRIGGER_INFO}"
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
if [ -n "$TRIGGER_DETAILS" ]; then
  echo "Details: ${TRIGGER_DETAILS}"
fi
if [ -n "$TRIGGER_SOURCE" ]; then
  echo "Source: ${TRIGGER_SOURCE}"
fi

# Set correct permissions
chmod 644 "$OUTPUT_PATH"

# Exit with success
exit 0 