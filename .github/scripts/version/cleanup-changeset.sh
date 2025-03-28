#!/bin/bash
# cleanup-changeset.sh
# Cleans up any temporary branches if needed

set -e

# Parse command line arguments
BRANCH_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --branch-name)
            BRANCH_NAME="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 --branch-name <branch>" >&2
            exit 1
            ;;
    esac
done

if [ -z "$BRANCH_NAME" ]; then
    echo "Error: --branch-name is required" >&2
    exit 1
fi

echo "Cleaning up temporary branch: $BRANCH_NAME" >&2

# Return to the original branch
if ! git checkout - 2>/dev/null; then
    echo "Error returning to original branch" >&2
    echo "cleanup_success=false"
    exit 1
fi

# Delete the temporary branch
if ! git branch -D "$BRANCH_NAME" 2>/dev/null; then
    echo "Error deleting branch $BRANCH_NAME" >&2
    echo "cleanup_success=false"
    exit 1
fi

echo "Branch cleanup completed successfully" >&2
echo "cleanup_success=true" 