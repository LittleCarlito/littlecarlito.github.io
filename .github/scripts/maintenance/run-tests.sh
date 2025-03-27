#!/bin/bash

# Exit on error
set -e

# Run tests script
# Handles running test commands and reporting results

# Main test function
run_tests() {
    local test_command="$1"
    
    echo "Running tests with command: $test_command" >&2
    
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
        echo "success"
    else
        echo "Tests failed with exit code $TEST_RESULT" >&2
        echo "failure"
    fi
}

# Parse command line arguments
main() {
    local test_command="pnpm test"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --test-command)
                test_command="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--test-command <command>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Call test function
    run_tests "$test_command"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 