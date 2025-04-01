#!/bin/bash

# Exit on error
set -e

# Run tests script
# Handles running test commands and reporting results

# Main test function
run_tests() {
    local test_command="$1"
    
    echo "DEBUG: Received test command: '$test_command'" >&2
    
    # Environment diagnostics
    echo "===== TEST ENVIRONMENT =====" >&2
    echo "Node version: $(node -v)" >&2
    echo "NPM version: $(npm -v)" >&2
    echo "Current directory: $(pwd)" >&2
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "WARNING: node_modules not found in current directory!" >&2
        echo "Directory contents:" >&2
        ls -la >&2
    else
        echo "node_modules found in current directory" >&2
    fi
    
    # Check packages directory
    echo "Packages directory structure:" >&2
    find packages -type d -maxdepth 2 | sort >&2 || echo "No packages directory found" >&2
    
    # Check for test files
    echo "Checking for test files:" >&2
    find . -name "*.test.js" -o -name "*.spec.js" | grep -v node_modules | sort >&2 || echo "No test files found" >&2
    
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
    echo "Running test command: $test_command" >&2
    set +e
    eval "$test_command" > "$TEST_OUTPUT" 2>&1
    TEST_RESULT=$?
    set -e
    
    # Display the output
    echo "===== TEST OUTPUT =====" >&2
    cat "$TEST_OUTPUT" >&2
    echo "==== END TEST OUTPUT ====" >&2
    
    # Check if the output contains "No tests specified" - in which case, treat as success
    if grep -q "No tests specified" "$TEST_OUTPUT"; then
        echo "Package has no tests specified - treating as success" >&2
        echo "result=success"
        rm -f "$TEST_OUTPUT"
        return 0
    fi
    
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