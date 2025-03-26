#!/bin/bash

# Exit on error
set -e

# Enable debug mode with DEBUG=1
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Function to clean up temporary files
cleanup_temp_files() {
    local files_deleted=0
    local dirs_deleted=0
    
    echo "Cleaning up temporary files..."
    
    # Find temporary files in a safer way with error handling
    echo "Removing temporary files with extensions .tmp, .temp, .log"
    find . -type f -name "*.tmp" -delete 2>/dev/null && echo "  Deleted .tmp files" && files_deleted=1 || echo "  No .tmp files found"
    find . -type f -name "*.temp" -delete 2>/dev/null && echo "  Deleted .temp files" && files_deleted=1 || echo "  No .temp files found"
    find . -type f -name "*.log" -delete 2>/dev/null && echo "  Deleted .log files" && files_deleted=1 || echo "  No .log files found"
    
    # Warning: these operations can be destructive, add confirmation if not in CI
    if [ "${CI:-false}" != "true" ]; then
        echo "Removing node_modules, .turbo, and dist directories outside of CI environment"
        echo "Warning: This operation will delete all node_modules directories and may require reinstalling dependencies"
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Skipping node_modules, .turbo, and dist deletion"
            return 0
        fi
    fi
    
    echo "Removing node_modules directories..."
    find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null && echo "  Deleted node_modules directories" && dirs_deleted=1 || echo "  No node_modules directories found or permission denied"
    
    echo "Removing .turbo directories..."
    find . -type d -name ".turbo" -exec rm -rf {} + 2>/dev/null && echo "  Deleted .turbo directories" && dirs_deleted=1 || echo "  No .turbo directories found or permission denied"
    
    echo "Removing dist directories..."
    find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null && echo "  Deleted dist directories" && dirs_deleted=1 || echo "  No dist directories found or permission denied"
    
    if [ $files_deleted -eq 0 ] && [ $dirs_deleted -eq 0 ]; then
        echo "No temporary files or directories were found to clean up"
        return 0
    fi
    
    echo "Temporary files cleanup completed"
    return 0
}

# Function to clean up temporary branches
cleanup_temp_branches() {
    local branches_deleted=0
    local error_count=0
    
    echo "Cleaning up temporary branches..."
    
    # Ensure we have the latest remote info
    echo "Fetching remote information..."
    git fetch --prune origin 2>/dev/null || {
        echo "Warning: Failed to fetch remote information. Some remote branches may not be visible."
    }
    
    # Get all branches that match our temporary branch pattern
    echo "Finding temporary branches..."
    local temp_branches=""
    temp_branches=$(git branch -r | grep -E "changeset-release/|temp/|temporary/" 2>/dev/null) || {
        echo "No temporary branches found matching the patterns"
        return 0
    }
    
    if [ -z "$temp_branches" ]; then
        echo "No temporary branches found matching the patterns"
        return 0
    fi
    
    echo "Found the following temporary branches:"
    echo "$temp_branches"
    
    # Warning: this operation can be destructive, add confirmation if not in CI
    if [ "${CI:-false}" != "true" ]; then
        echo "Warning: This operation will delete remote branches"
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Skipping branch deletion"
            return 0
        fi
    fi
    
    # Process each temporary branch
    while IFS= read -r branch; do
        # Extract branch name from "origin/branch-name"
        local branch_name="${branch#origin/}"
        
        # Skip if branch is empty
        if [ -z "$branch_name" ]; then
            continue
        fi
        
        # Skip if branch is currently checked out
        local current_branch=""
        current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || {
            echo "Warning: Failed to get current branch"
            continue
        }
        
        if [ "$branch_name" = "$current_branch" ]; then
            echo "Skipping currently checked out branch: $branch_name"
            continue
        fi
        
        echo "Deleting branch: $branch_name"
        git push origin --delete "$branch_name" 2>/dev/null || {
            echo "  Error: Failed to delete branch $branch_name"
            error_count=$((error_count + 1))
            continue
        }
        
        echo "  Successfully deleted branch: $branch_name"
        branches_deleted=$((branches_deleted + 1))
    done <<< "$temp_branches"
    
    echo "Branch cleanup completed: $branches_deleted branches deleted, $error_count errors encountered"
    
    if [ $error_count -gt 0 ]; then
        echo "Some branches could not be deleted. You may need admin permissions or the branches may be protected."
        return 1
    fi
    
    return 0
}

# Function to clean up old artifacts
cleanup_artifacts() {
    local artifacts_deleted=0
    
    echo "Cleaning up old artifacts..."
    
    # List of artifact directories to clean
    local artifact_dirs=(".next" "build" "coverage" ".nyc_output")
    
    # Warning: this operation can be destructive, add confirmation if not in CI
    if [ "${CI:-false}" != "true" ]; then
        echo "Warning: This operation will delete build artifacts and may require rebuilding your project"
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Skipping artifacts deletion"
            return 0
        fi
    fi
    
    # Clean up each artifact directory with error handling
    for dir in "${artifact_dirs[@]}"; do
        if [ -d "$dir" ]; then
            echo "Removing $dir directory..."
            rm -rf "$dir" 2>/dev/null && {
                echo "  Successfully deleted $dir"
                artifacts_deleted=$((artifacts_deleted + 1))
            } || {
                echo "  Error: Failed to delete $dir. You may not have permission."
            }
        else
            echo "Directory $dir does not exist, skipping"
        fi
    done
    
    if [ $artifacts_deleted -eq 0 ]; then
        echo "No artifacts were found to clean up"
    else
        echo "Artifacts cleanup completed: $artifacts_deleted directories removed"
    fi
    
    return 0
}

# Function to print help message
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Clean up temporary files, branches, and build artifacts."
    echo ""
    echo "Options:"
    echo "  --files-only       Only clean up temporary files"
    echo "  --branches-only    Only clean up temporary branches"
    echo "  --artifacts-only   Only clean up build artifacts"
    echo "  --all              Clean up everything (default if no options provided)"
    echo "  --help             Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0                 Clean up everything"
    echo "  $0 --files-only    Only clean up temporary files"
    echo "  $0 --all           Clean up everything (explicitly)"
    echo ""
    echo "Environment variables:"
    echo "  DEBUG=1            Enable debug output"
    echo "  CI=true            Skip confirmation prompts (for CI environments)"
}

# Main cleanup function
main() {
    echo "Starting cleanup process..."
    local has_errors=0
    local operation_performed=0
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --files-only)
                cleanup_temp_files || has_errors=1
                operation_performed=1
                shift
                ;;
            --branches-only)
                cleanup_temp_branches || has_errors=1
                operation_performed=1
                shift
                ;;
            --artifacts-only)
                cleanup_artifacts || has_errors=1
                operation_performed=1
                shift
                ;;
            --all)
                cleanup_temp_files || has_errors=1
                cleanup_temp_branches || has_errors=1
                cleanup_artifacts || has_errors=1
                operation_performed=1
                shift
                ;;
            --help)
                print_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                print_help
                exit 1
                ;;
        esac
    done
    
    # If no arguments provided, do everything
    if [ $operation_performed -eq 0 ]; then
        cleanup_temp_files || has_errors=1
        cleanup_temp_branches || has_errors=1
        cleanup_artifacts || has_errors=1
    fi
    
    if [ $has_errors -eq 0 ]; then
        echo "Cleanup completed successfully!"
        exit 0
    else
        echo "Cleanup completed with some errors"
        exit 1
    fi
}

# Run main function with all arguments
main "$@" 