#!/bin/bash
# cleanup-changeset-branches.sh
# Cleans up all changeset-release/auto-* branches

set -e

# Parse command line arguments
TOKEN=""
REPO=""
DRY_RUN="false"
MAX_ATTEMPTS=3

while [[ $# -gt 0 ]]; do
    case $1 in
        --token)
            TOKEN="$2"
            shift 2
            ;;
        --repo)
            REPO="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="$2"
            shift 2
            ;;
        --max-attempts)
            MAX_ATTEMPTS="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 --token <github-token> --repo <owner/repo> [--dry-run true|false] [--max-attempts <number>]" >&2
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$TOKEN" ]; then
    echo "Error: --token is required" >&2
    exit 1
fi

if [ -z "$REPO" ]; then
    echo "Error: --repo is required" >&2
    exit 1
fi

# Ensure we have the latest remote data
echo "Fetching latest remote data..." >&2
git fetch --prune origin 2>/dev/null || true

# Find changeset branches
echo "Looking for changeset-release branches to clean up..." >&2
CHANGESET_BRANCHES=$(git branch -r | grep "origin/changeset-release/auto-" | sed 's|origin/||')

if [ -z "$CHANGESET_BRANCHES" ]; then
    echo "No changeset branches found to clean up." >&2
    echo "changed=false"
    exit 0
fi

echo "Found changeset branches to clean up:" >&2
echo "$CHANGESET_BRANCHES" >&2

DELETED_COUNT=0
FAILED_COUNT=0

if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: Would delete these branches" >&2
    echo "$CHANGESET_BRANCHES" | sed 's/^/  /g' >&2
    echo "changed=false"
    exit 0
fi

# Delete each branch
for BRANCH in $CHANGESET_BRANCHES; do
    echo "Deleting branch: $BRANCH" >&2
    
    # Use our branch delete script with retries and multiple methods
    if bash .github/scripts/branch/delete.sh \
        --token "$TOKEN" \
        --repo "$REPO" \
        --branch "$BRANCH" \
        --max-attempts "$MAX_ATTEMPTS" 2>/dev/null | grep -q "branch_deleted=true"; then
        
        echo "✅ Successfully deleted branch: $BRANCH" >&2
        DELETED_COUNT=$((DELETED_COUNT + 1))
    else
        echo "❌ Failed to delete branch: $BRANCH" >&2
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo "Deleted $DELETED_COUNT branches, failed to delete $FAILED_COUNT branches" >&2

if [ $DELETED_COUNT -gt 0 ]; then
    echo "changed=true"
else
    echo "changed=false"
fi

exit 0 