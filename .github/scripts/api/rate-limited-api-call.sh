#!/bin/bash
set -e

# Script to perform rate limited and properly back-off API calls to GitHub
# Takes care of concurrency, backing off when rate limits are reached
# Usage: rate-limited-api-call.sh --method GET --endpoint "/repos/owner/repo/tags" --token "token" [--data "{}"] [--max-retries 5] [--debug true]

METHOD="GET"
ENDPOINT=""
TOKEN=""
DATA=""
MAX_RETRIES=5
DEBUG="false"
BASE_URL="https://api.github.com"
REQUEST_ID=$(date +%s)-$RANDOM

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --method)
      METHOD="$2"
      shift 2
      ;;
    --endpoint)
      ENDPOINT="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --data)
      DATA="$2"
      shift 2
      ;;
    --max-retries)
      MAX_RETRIES="$2"
      shift 2
      ;;
    --debug)
      DEBUG="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$ENDPOINT" ]; then
  echo "Error: --endpoint is required"
  exit 1
fi

if [ -z "$TOKEN" ]; then
  echo "Error: --token is required"
  exit 1
fi

# Debug information
if [ "$DEBUG" == "true" ]; then
  echo "DEBUG[$REQUEST_ID]: API Call Details"
  echo "DEBUG[$REQUEST_ID]: Method: $METHOD"
  echo "DEBUG[$REQUEST_ID]: Endpoint: $ENDPOINT"
  echo "DEBUG[$REQUEST_ID]: Max retries: $MAX_RETRIES"
  [ -n "$DATA" ] && echo "DEBUG[$REQUEST_ID]: Data: $DATA"
fi

# Function to wait for rate limit reset if needed
wait_for_rate_limit() {
  local rate_limit_remaining=$(echo "$1" | grep -i "X-RateLimit-Remaining" | cut -d: -f2 | tr -d ' \r')
  local rate_limit_reset=$(echo "$1" | grep -i "X-RateLimit-Reset" | cut -d: -f2 | tr -d ' \r')
  
  if [ -z "$rate_limit_remaining" ] || [ -z "$rate_limit_reset" ]; then
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG[$REQUEST_ID]: Could not parse rate limit headers"
    fi
    return 0
  fi
  
  if [ "$DEBUG" == "true" ]; then
    echo "DEBUG[$REQUEST_ID]: Rate limit remaining: $rate_limit_remaining"
    echo "DEBUG[$REQUEST_ID]: Rate limit reset: $rate_limit_reset"
  fi
  
  if [ "$rate_limit_remaining" -le 10 ]; then
    local now=$(date +%s)
    local wait_time=$((rate_limit_reset - now + 5)) # Add 5 seconds buffer
    
    if [ $wait_time -gt 0 ]; then
      echo "Rate limit almost reached. Waiting for $wait_time seconds before retrying..."
      sleep $wait_time
    fi
  fi
}

# Function to determine backoff time based on attempt
get_backoff_time() {
  local attempt=$1
  local base_time=1
  
  # Exponential backoff with jitter
  echo $((base_time * 2 ** (attempt - 1) + RANDOM % 5))
}

# Perform the API call with retries and backoff
perform_api_call() {
  local attempt=1
  local success=false
  local response_file=$(mktemp)
  local headers_file=$(mktemp)
  
  while [ $attempt -le $MAX_RETRIES ] && [ "$success" != "true" ]; do
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG[$REQUEST_ID]: Attempt $attempt of $MAX_RETRIES"
    fi
    
    # Prepare the curl command
    local curl_cmd="curl -s -X $METHOD"
    curl_cmd="$curl_cmd -H \"Authorization: token $TOKEN\""
    curl_cmd="$curl_cmd -H \"Accept: application/vnd.github+json\""
    curl_cmd="$curl_cmd -D $headers_file"
    
    if [ -n "$DATA" ] && [ "$METHOD" != "GET" ]; then
      curl_cmd="$curl_cmd -H \"Content-Type: application/json\" -d '$DATA'"
    fi
    
    curl_cmd="$curl_cmd \"$BASE_URL$ENDPOINT\""
    
    # Execute the curl command
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG[$REQUEST_ID]: Executing: $curl_cmd"
    fi
    
    eval "$curl_cmd > $response_file"
    
    # Get HTTP status code
    local status_code=$(head -n 1 "$headers_file" | grep -o "[0-9]\{3\}")
    
    if [ "$DEBUG" == "true" ]; then
      echo "DEBUG[$REQUEST_ID]: Status code: $status_code"
      echo "DEBUG[$REQUEST_ID]: Response headers:"
      cat "$headers_file"
      echo "DEBUG[$REQUEST_ID]: Response body:"
      cat "$response_file"
    fi
    
    # Check for rate limit headers
    wait_for_rate_limit "$(cat "$headers_file")"
    
    # Handle different status codes
    if [ -z "$status_code" ]; then
      echo "Error: Could not determine HTTP status code"
      local backoff_time=$(get_backoff_time $attempt)
      echo "Backing off for $backoff_time seconds..."
      sleep $backoff_time
    elif [ "$status_code" -eq 200 ] || [ "$status_code" -eq 201 ] || [ "$status_code" -eq 204 ]; then
      # Success
      success=true
    elif [ "$status_code" -eq 404 ] && [ "$METHOD" == "DELETE" ]; then
      # For DELETE requests, 404 can be considered a success (resource already gone)
      success=true
    elif [ "$status_code" -eq 429 ] || [ "$status_code" -ge 500 ]; then
      # Rate limit or server error
      local backoff_time=$(get_backoff_time $attempt)
      echo "Rate limit reached or server error. Backing off for $backoff_time seconds..."
      sleep $backoff_time
    else
      # Client error or other status code
      echo "Error: HTTP status $status_code"
      local error_message=$(cat "$response_file" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
      
      if [ -n "$error_message" ]; then
        echo "Error message: $error_message"
        
        # If this is a reference conflict, we might want to retry
        if [[ "$error_message" == *"reference already exists"* ]] || [[ "$error_message" == *"Reference update failed"* ]]; then
          local backoff_time=$(get_backoff_time $attempt)
          echo "Reference conflict detected. Backing off for $backoff_time seconds..."
          sleep $backoff_time
        else
          # Other client errors might not be retriable
          break
        fi
      else
        local backoff_time=$(get_backoff_time $attempt)
        echo "Backing off for $backoff_time seconds..."
        sleep $backoff_time
      fi
    fi
    
    attempt=$((attempt + 1))
  done
  
  # Output the response
  if [ "$success" == "true" ]; then
    cat "$response_file"
    echo "status_code=$status_code" >&2
    echo "success=true" >&2
  else
    echo "{\"error\":\"API call failed after $MAX_RETRIES attempts\", \"status_code\":\"$status_code\"}"
    echo "status_code=$status_code" >&2
    echo "success=false" >&2
  fi
  
  # Clean up temp files
  rm -f "$response_file" "$headers_file"
  
  # Return success or failure
  [ "$success" == "true" ] && return 0 || return 1
}

# Execute the API call
perform_api_call 