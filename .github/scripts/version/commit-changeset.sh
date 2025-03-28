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

# Commit changes with all output redirected to stderr
COMMIT_OUTPUT=$(git commit -m "chore: auto-generate changeset [skip ci]" 2>&1) || {
    echo "Error committing changeset: $COMMIT_OUTPUT" >&2
    echo "commit_success=false"
    exit 1
}

# Store commit SHA for possible future use
COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null)

# Push branch with all output redirected to stderr
PUSH_OUTPUT=$(git push --set-upstream origin "$BRANCH_NAME" 2>&1) || {
    echo "Error pushing branch $BRANCH_NAME: $PUSH_OUTPUT" >&2
    echo "commit_success=false"
    exit 1
}

echo "Changeset committed and pushed successfully" >&2
echo "commit_success=true"
echo "commit_sha=$COMMIT_SHA" 