#!/bin/bash

# Exit on error
set -e

# Check for changesets script
# Detects if there are any changesets in the repository

# Main check function
check_changesets() {
    local auto_changeset_prefix="$1"
    
    echo "Checking for changesets..." >&2
    
    # Check if .changeset directory exists
    if [ ! -d ".changeset" ]; then
        echo "No .changeset directory found" >&2
        echo "has_changesets=false" > /dev/stdout
        echo "has_auto_changesets=false" > /dev/stdout
        return 1
    fi
    
    # Count changeset files
    CHANGESET_COUNT=$(find .changeset -name "*.md" -not -name "README.md" -not -name "config.json" | wc -l | tr -d ' ')
    
    if [ "$CHANGESET_COUNT" -gt 0 ]; then
        echo "Found $CHANGESET_COUNT changeset file(s)" >&2
        echo "has_changesets=true" > /dev/stdout
    else
        echo "No changeset files found" >&2
        echo "has_changesets=false" > /dev/stdout
    fi
    
    # Check for auto-generated changesets if prefix is provided
    if [ -n "$auto_changeset_prefix" ]; then
        AUTO_CHANGESET_COUNT=$(find .changeset -name "${auto_changeset_prefix}*.md" | wc -l | tr -d ' ')
        
        if [ "$AUTO_CHANGESET_COUNT" -gt 0 ]; then
            echo "Found $AUTO_CHANGESET_COUNT auto-generated changeset file(s) with prefix '$auto_changeset_prefix'" >&2
            echo "has_auto_changesets=true" > /dev/stdout
        else
            echo "No auto-generated changeset files found with prefix '$auto_changeset_prefix'" >&2
            echo "has_auto_changesets=false" > /dev/stdout
        fi
    else
        echo "No auto-changeset prefix specified, skipping auto-changeset check" >&2
        echo "has_auto_changesets=false" > /dev/stdout
    fi
}

# Parse command line arguments
main() {
    local auto_changeset_prefix="auto-"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto-changeset-prefix)
                auto_changeset_prefix="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--auto-changeset-prefix <prefix>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Call check function
    check_changesets "$auto_changeset_prefix"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 