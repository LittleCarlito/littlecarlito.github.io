#!/bin/bash
# Test script to simulate the pre-push hook without actually pushing

# Change to repository root directory
cd "$(git rev-parse --show-toplevel)" || exit 1

# Create test-results directory if it doesn't exist
mkdir -p test-results

# Set output file path
OUTPUT_FILE="test-results/pre-push-log.txt"

# Create or clear the output file
> "$OUTPUT_FILE"

echo "🧪 Running pre-push test..."
echo "Capturing ALL output to $OUTPUT_FILE"

# Run pre-push hook and capture ALL output to file
(
  # Add timestamp header
  echo "===============================================" 
  echo "PRE-PUSH TEST RUN: $(date)" 
  echo "==============================================="
  echo
  
  # Execute the pre-push script
  bash -x .husky/pre-push
  
  # Add result footer with exit code
  EXIT_CODE=$?
  echo
  echo "==============================================="
  echo "TEST COMPLETED: $(date)" 
  echo "EXIT CODE: $EXIT_CODE"
  echo "==============================================="
) &> "$OUTPUT_FILE"

# Show status message
if [ $? -eq 0 ]; then
  echo "✅ Test completed successfully!"
else
  echo "❌ Test failed! See log for details."
fi

echo "📄 Complete log saved to $OUTPUT_FILE" 