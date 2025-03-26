#!/bin/bash

# Exit on error
set -e

# Function to clean up temporary files
cleanup_temp_files() {
    echo "Cleaning up temporary files..."
    find . -type f -name "*.tmp" -delete
    find . -type f -name "*.temp" -delete
    find . -type f -name "*.log" -delete
    find . -type d -name "node_modules" -exec rm -rf {} +
    find . -type d -name ".turbo" -exec rm -rf {} +
    find . -type d -name "dist" -exec rm -rf {} +
}

# Function to clean up temporary branches
cleanup_temp_branches() {
    echo "Cleaning up temporary branches..."
    # Get all branches that match our temporary branch pattern
    TEMP_BRANCHES=$(git branch -r | grep -E "changeset-release/|temp/|temporary/")
    
    for branch in $TEMP_BRANCHES; do
        # Skip if branch is currently checked out
        if [ "$branch" = "$(git rev-parse --abbrev-ref HEAD)" ]; then
            continue
        fi
        
        echo "Deleting branch: $branch"
        git push origin --delete "${branch#origin/}"
    done
}

# Function to clean up old artifacts
cleanup_artifacts() {
    echo "Cleaning up old artifacts..."
    # Clean up old build artifacts
    rm -rf .next
    rm -rf build
    rm -rf coverage
    rm -rf .nyc_output
}

# Main cleanup function
main() {
    echo "Starting cleanup process..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --files-only)
                cleanup_temp_files
                ;;
            --branches-only)
                cleanup_temp_branches
                ;;
            --artifacts-only)
                cleanup_artifacts
                ;;
            --all)
                cleanup_temp_files
                cleanup_temp_branches
                cleanup_artifacts
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--files-only|--branches-only|--artifacts-only|--all]"
                exit 1
                ;;
        esac
        shift
    done
    
    # If no arguments provided, do everything
    if [ $# -eq 0 ]; then
        cleanup_temp_files
        cleanup_temp_branches
        cleanup_artifacts
    fi
    
    echo "Cleanup completed successfully!"
}

# Run main function with all arguments
main "$@" 