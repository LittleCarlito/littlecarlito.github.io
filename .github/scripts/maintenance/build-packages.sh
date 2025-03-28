#!/bin/bash

# Exit on error
set -e

# Build packages script
# Handles running build commands and reporting results

# Main build function
build_packages() {
    local build_command="$1"
    
    echo "DEBUG: Received build command: '$build_command'" >&2
    
    # Create a temporary file to capture command output
    BUILD_OUTPUT=$(mktemp)
    
    # Run the build command, capturing exit code
    set +e
    eval "$build_command" > "$BUILD_OUTPUT" 2>&1
    BUILD_RESULT=$?
    set -e
    
    # Display the output
    cat "$BUILD_OUTPUT" >&2
    rm -f "$BUILD_OUTPUT"
    
    # Return the result
    if [ $BUILD_RESULT -eq 0 ]; then
        echo "Build successful" >&2
        echo "result=success"
    else
        echo "Build failed with exit code $BUILD_RESULT" >&2
        echo "result=failure"
    fi
}

# Parse command line arguments
main() {
    local build_command="pnpm run build"
    
    # Better argument parsing that handles spaces in arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --build-command)
                # Shift to get the value and use it directly
                shift
                # Handle the entire argument, including any spaces
                build_command="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--build-command \"command with args\"]" >&2
                exit 1
                ;;
        esac
    done
    
    echo "DEBUG: Final build command: '$build_command'" >&2
    
    # Call build function
    build_packages "$build_command"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 