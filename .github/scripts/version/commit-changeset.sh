#!/bin/bash
# commit-changeset.sh
# Commits and pushes changeset changes to the branch

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

echo "Committing changeset to branch: $BRANCH_NAME" >&2

# Add changeset files
if ! git add .changeset/ 2>/dev/null; then
    echo "Error adding changeset files" >&2
    echo "commit_success=false"
    exit 1
fi

# Commit changes
if ! git commit -m "chore: auto-generate changeset [skip ci]" 2>/dev/null; then
    echo "Error committing changeset" >&2
    echo "commit_success=false"
    exit 1
fi

# Push branch
if ! git push --set-upstream origin "$BRANCH_NAME" 2>/dev/null; then
    echo "Error pushing branch $BRANCH_NAME" >&2
    echo "commit_success=false"
    exit 1
fi

echo "Changeset committed and pushed successfully" >&2
echo "commit_success=true" 