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
    
    echo "Cleaning up temporary files..." >&2
    
    # Find temporary files in a safer way with error handling
    echo "Removing temporary files with extensions .tmp, .temp, .log" >&2
    find . -type f -name "*.tmp" -delete >&2 && { echo "  Deleted .tmp files" >&2; files_deleted=1; } || echo "  No .tmp files found" >&2
    find . -type f -name "*.temp" -delete >&2 && { echo "  Deleted .temp files" >&2; files_deleted=1; } || echo "  No .temp files found" >&2
    find . -type f -name "*.log" -delete >&2 && { echo "  Deleted .log files" >&2; files_deleted=1; } || echo "  No .log files found" >&2
    
    # Warning: these operations can be destructive, add confirmation if not in CI
    if [ "${CI:-false}" != "true" ]; then
        echo "Removing node_modules, .turbo, and dist directories outside of CI environment" >&2
        echo "Warning: This operation will delete all node_modules directories and may require reinstalling dependencies" >&2
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Skipping node_modules, .turbo, and dist deletion" >&2
            return 0
        fi
    fi
    
    echo "Removing node_modules directories..." >&2
    find . -type d -name "node_modules" -exec rm -rf {} + >&2 && { echo "  Deleted node_modules directories" >&2; dirs_deleted=1; } || echo "  No node_modules directories found or permission denied" >&2
    
    echo "Removing .turbo directories..." >&2
    find . -type d -name ".turbo" -exec rm -rf {} + >&2 && { echo "  Deleted .turbo directories" >&2; dirs_deleted=1; } || echo "  No .turbo directories found or permission denied" >&2
    
    echo "Removing dist directories..." >&2
    find . -type d -name "dist" -exec rm -rf {} + >&2 && { echo "  Deleted dist directories" >&2; dirs_deleted=1; } || echo "  No dist directories found or permission denied" >&2
    
    if [ $files_deleted -eq 0 ] && [ $dirs_deleted -eq 0 ]; then
        echo "No temporary files or directories were found to clean up" >&2
        return 0
    fi
    
    echo "Temporary files cleanup completed" >&2
    printf "cleanup_temp_files_complete=true\n"
    return 0
}

# Function to clean up temporary branches
cleanup_temp_branches() {
    local branches_deleted=0
    local error_count=0
    
    echo "Cleaning up temporary branches..." >&2
    
    # Ensure we have the latest remote info
    echo "Fetching remote information..." >&2
    git fetch --prune origin 2>&1 >&2 || {
        echo "Warning: Failed to fetch remote information. Some remote branches may not be visible." >&2
    }
    
    # Get all branches that match our temporary branch pattern
    echo "Finding temporary branches..." >&2
    local temp_branches=""
    temp_branches=$(git branch -r | grep -E "changeset-release/|temp/|temporary/") || {
        echo "No temporary branches found matching the patterns" >&2
        return 0
    }
    
    if [ -z "$temp_branches" ]; then
        echo "No temporary branches found matching the patterns" >&2
        return 0
    fi
    
    echo "Found the following temporary branches:" >&2
    echo "$temp_branches" >&2
    
    # Warning: this operation can be destructive, add confirmation if not in CI
    if [ "${CI:-false}" != "true" ]; then
        echo "Warning: This operation will delete remote branches" >&2
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Skipping branch deletion" >&2
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
        current_branch=$(git rev-parse --abbrev-ref HEAD) || {
            echo "Warning: Failed to get current branch" >&2
            continue
        }
        
        if [ "$branch_name" = "$current_branch" ]; then
            echo "Skipping currently checked out branch: $branch_name" >&2
            continue
        fi
        
        echo "Deleting branch: $branch_name" >&2
        git push origin --delete "$branch_name" 2>&1 >&2 || {
            echo "  Error: Failed to delete branch $branch_name" >&2
            error_count=$((error_count + 1))
            continue
        }
        
        echo "  Successfully deleted branch: $branch_name" >&2
        branches_deleted=$((branches_deleted + 1))
    done <<< "$temp_branches"
    
    echo "Branch cleanup completed: $branches_deleted branches deleted, $error_count errors encountered" >&2
    
    if [ $error_count -gt 0 ]; then
        echo "Some branches could not be deleted. You may need admin permissions or the branches may be protected." >&2
        return 1
    fi
    
    printf "cleanup_temp_branches_complete=true\n"
    return 0
}

# Function to clean up old artifacts
cleanup_artifacts() {
    local artifacts_deleted=0
    
    echo "Cleaning up old artifacts..." >&2
    
    # List of artifact directories to clean
    local artifact_dirs=(".next" "build" "coverage" ".nyc_output")
    
    # Warning: this operation can be destructive, add confirmation if not in CI
    if [ "${CI:-false}" != "true" ]; then
        echo "Warning: This operation will delete build artifacts and may require rebuilding your project" >&2
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Skipping artifacts deletion" >&2
            return 0
        fi
    fi
    
    # Clean up each artifact directory with error handling
    for dir in "${artifact_dirs[@]}"; do
        if [ -d "$dir" ]; then
            echo "Removing $dir directory..." >&2
            rm -rf "$dir" 2>&1 >&2 && {
                echo "  Successfully deleted $dir" >&2
                artifacts_deleted=$((artifacts_deleted + 1))
            } || {
                echo "  Error: Failed to delete $dir. You may not have permission." >&2
            }
        else
            echo "Directory $dir does not exist, skipping" >&2
        fi
    done
    
    if [ $artifacts_deleted -eq 0 ]; then
        echo "No artifacts were found to clean up" >&2
    else
        echo "Artifacts cleanup completed: $artifacts_deleted directories removed" >&2
    fi
    
    printf "cleanup_artifacts_complete=true\n"
    return 0
}

# Function to print help message
print_help() {
    echo "Usage: $0 [OPTIONS]" >&2
    echo "Clean up temporary files, branches, and build artifacts." >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  --files-only       Only clean up temporary files" >&2
    echo "  --branches-only    Only clean up temporary branches" >&2
    echo "  --artifacts-only   Only clean up build artifacts" >&2
    echo "  --all              Clean up everything (default if no options provided)" >&2
    echo "  --help             Display this help message" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  $0                 Clean up everything" >&2
    echo "  $0 --files-only    Only clean up temporary files" >&2
    echo "  $0 --all           Clean up everything (explicitly)" >&2
    echo "" >&2
    echo "Environment variables:" >&2
    echo "  DEBUG=1            Enable debug output" >&2
    echo "  CI=true            Skip confirmation prompts (for CI environments)" >&2
}

# Main cleanup function
main() {
    local files_only=false
    local branches_only=false
    local artifacts_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --files-only)
                files_only=true
                shift
                ;;
            --branches-only)
                branches_only=true
                shift
                ;;
            --artifacts-only)
                artifacts_only=true
                shift
                ;;
            --all)
                files_only=false
                branches_only=false
                artifacts_only=false
                shift
                ;;
            --help)
                print_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1" >&2
                print_help
                exit 1
                ;;
        esac
    done
    
    # If no specific options are set, clean up everything
    if [ "$files_only" = false ] && [ "$branches_only" = false ] && [ "$artifacts_only" = false ]; then
        files_only=true
        branches_only=true
        artifacts_only=true
    fi
    
    # Run cleanup functions based on options
    if [ "$files_only" = true ]; then
        cleanup_temp_files
    fi
    
    if [ "$branches_only" = true ]; then
        cleanup_temp_branches
    fi
    
    if [ "$artifacts_only" = true ]; then
        cleanup_artifacts
    fi
    
    printf "cleanup_complete=true\n"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 