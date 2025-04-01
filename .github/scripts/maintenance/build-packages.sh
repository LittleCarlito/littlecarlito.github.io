#!/bin/bash

# Exit on error
set -e

# Build packages script
# Handles running build commands and reporting results

# Main build function
build_packages() {
    local build_command="$1"
    
    echo "DEBUG: Received build command: '$build_command'" >&2
    
    # Check environment
    echo "Build environment:" >&2
    echo "- Node.js: $(node --version)" >&2
    echo "- npm: $(npm --version)" >&2
    
    # Verify node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "ERROR: node_modules directory not found. Dependencies may not be installed correctly." >&2
        echo "Current directory: $(pwd)" >&2
        echo "Directory contents:" >&2
        ls -la >&2
        echo "result=failure"
        return 1
    fi
    
    # Make sure pnpm is available by sourcing nvm
    if [[ "$build_command" == *"pnpm"* ]]; then
        echo "Command uses pnpm, ensuring it's available..." >&2
        
        # Check if pnpm is directly available in PATH first
        if command -v pnpm &> /dev/null; then
            echo "pnpm is available in PATH: $(which pnpm) version $(pnpm --version)" >&2
        else
            # Try to source NVM if available
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            
            # Check again after sourcing NVM
            if ! command -v pnpm &> /dev/null; then
                echo "ERROR: pnpm command not found! Trying to install it..." >&2
                # Redirect all npm output to stderr
                npm install -g pnpm >&2 2>&1
            fi
            
            # Verify pnpm is now available
            if ! command -v pnpm &> /dev/null; then
                echo "FATAL: Could not install pnpm. Build cannot run." >&2
                echo "result=failure"
                return 1
            else
                echo "pnpm is available at $(which pnpm) version $(pnpm --version)" >&2
            fi
        fi
        
        # Ensure dependencies are installed
        echo "Ensuring dependencies are installed..." >&2
        pnpm install >&2 || echo "Warning: pnpm install may have issues, but continuing with build..." >&2
    fi
    
    # List workspace packages if using pnpm
    if [[ "$build_command" == *"pnpm"* ]]; then
        echo "Listing workspace packages:" >&2
        pnpm ls -r --depth 0 >&2 || echo "Unable to list workspace packages" >&2
    fi
    
    # Run the build command, showing output directly
    echo "Executing build command: $build_command" >&2
    set +e
    eval "$build_command"
    BUILD_RESULT=$?
    set -e
    
    # Output detailed error information if build fails
    if [ $BUILD_RESULT -ne 0 ]; then
        echo "Build command failed with exit code $BUILD_RESULT" >&2
        echo "Complete build command: $build_command" >&2
        echo "Checking for dist directories:" >&2
        find . -type d -name "dist" | sort >&2 || echo "No dist directories found" >&2
        echo "result=failure"
        return 1
    else
        echo "Build successful" >&2
        echo "result=success"
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