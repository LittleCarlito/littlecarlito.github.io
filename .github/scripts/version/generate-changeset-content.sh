#!/bin/bash
# generate-changeset-content.sh
# Generates the actual changeset content

set -e

# Parse command line arguments
SINCE_COMMIT=""
PACKAGE_NAME="all"
VERSION_TYPE="patch"
AUTO_CHANGESET_PREFIX="auto-"

while [[ $# -gt 0 ]]; do
    case $1 in
        --since-commit)
            SINCE_COMMIT="$2"
            shift 2
            ;;
        --package-name)
            PACKAGE_NAME="$2"
            shift 2
            ;;
        --version-type)
            VERSION_TYPE="$2"
            shift 2
            ;;
        --auto-changeset-prefix)
            AUTO_CHANGESET_PREFIX="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 [--since-commit <sha>] [--package-name <name>] [--version-type <type>] [--auto-changeset-prefix <prefix>]" >&2
            exit 1
            ;;
    esac
done

echo "Generating changeset content..." >&2

# Generate from conventional commits if available
if [ -f "scripts/auto-changeset.js" ]; then
    echo "Using scripts/auto-changeset.js to generate changeset" >&2
    if [ -n "$SINCE_COMMIT" ]; then
        node scripts/auto-changeset.js --since="$SINCE_COMMIT" >&2
    else
        node scripts/auto-changeset.js >&2
    fi
    CREATED=true
else
    echo "No auto-changeset.js script found, creating manual changeset" >&2
    # Create manual changeset
    mkdir -p .changeset
    CHANGESET_ID="${AUTO_CHANGESET_PREFIX}$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)"
    
    if [ "$PACKAGE_NAME" != "all" ]; then
        echo "Creating changeset for package: $PACKAGE_NAME with version type: $VERSION_TYPE" >&2
        cat > ".changeset/$CHANGESET_ID.md" << EOF
---
"$PACKAGE_NAME": $VERSION_TYPE
---

Auto-generated changeset for $PACKAGE_NAME
EOF
        CREATED=true
    else
        CREATED=false
    fi
fi

# Check if any changesets were actually created
if ls .changeset/${AUTO_CHANGESET_PREFIX}*.md 1> /dev/null 2>&1; then
    echo "changeset_created=true"
    echo "changeset_id=$CHANGESET_ID"
else
    echo "changeset_created=false"
fi 