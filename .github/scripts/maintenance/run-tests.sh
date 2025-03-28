#!/bin/bash

# Exit on error
set -e

# Run tests script
# Handles running test commands and reporting results

# Main test function
run_tests() {
    local test_command="$1"
    
    echo "DEBUG: Received test command: '$test_command'" >&2
    
    # Make sure pnpm is available by sourcing nvm
    if [[ "$test_command" == *"pnpm"* ]]; then
        echo "Command uses pnpm, ensuring it's available..." >&2
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Check if pnpm is available
        if ! command -v pnpm &> /dev/null; then
            echo "ERROR: pnpm command not found! Trying to install it..." >&2
            # Redirect all npm output to stderr
            npm install -g pnpm >&2 2>&1
        fi
        
        # Verify pnpm is now available
        if ! command -v pnpm &> /dev/null; then
            echo "FATAL: Could not install pnpm. Tests cannot run." >&2
            echo "result=failure"
            return 1
        else
            echo "pnpm is available at $(which pnpm)" >&2
        fi
    fi
    
    # Create a temporary file to capture command output
    TEST_OUTPUT=$(mktemp)
    
    # Run the test command, capturing exit code
    set +e
    eval "$test_command" > "$TEST_OUTPUT" 2>&1
    TEST_RESULT=$?
    set -e
    
    # Display the output
    cat "$TEST_OUTPUT" >&2
    rm -f "$TEST_OUTPUT"
    
    # Return the result
    if [ $TEST_RESULT -eq 0 ]; then
        echo "Tests passed" >&2
        echo "result=success"
    else
        echo "Tests failed with exit code $TEST_RESULT" >&2
        echo "result=failure"
    fi
}

# Parse command line arguments
main() {
    local test_command="pnpm test"
    
    # Better argument parsing that handles spaces in arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test-command)
                # Shift to get the value and use it directly
                shift
                # Handle the entire argument, including any spaces
                test_command="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--test-command \"command with args\"]" >&2
                exit 1
                ;;
        esac
    done
    
    echo "DEBUG: Final test command: '$test_command'" >&2
    
    # Call test function
    run_tests "$test_command"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 