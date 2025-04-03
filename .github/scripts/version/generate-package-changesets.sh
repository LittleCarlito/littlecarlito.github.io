#!/bin/bash
# generate-package-changesets.sh
# Automatically detects changes in packages and generates appropriate changesets
# This is an enhanced version that doesn't require manual pnpm change

set -e

# Parse command line arguments
BASE_COMMIT=""
AUTO_CHANGESET_PREFIX="auto-"
DEFAULT_VERSION_TYPE="patch"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --base-commit)
            BASE_COMMIT="$2"
            shift 2
            ;;
        --auto-changeset-prefix)
            AUTO_CHANGESET_PREFIX="$2"
            shift 2
            ;;
        --default-version)
            DEFAULT_VERSION_TYPE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 [--base-commit <sha>] [--auto-changeset-prefix <prefix>] [--default-version <patch|minor|major>] [--dry-run <true|false>]" >&2
            exit 1
            ;;
    esac
done

echo "Auto-generating changesets based on commit scopes..." >&2

# Call our new scope-based changeset generation script
OUTPUT=$(.github/scripts/version/scope-based-changeset.sh \
  --base-commit "$BASE_COMMIT" \
  --auto-changeset-prefix "$AUTO_CHANGESET_PREFIX" \
  --default-version "$DEFAULT_VERSION_TYPE" \
  --dry-run "$DRY_RUN")

# Forward all outputs
echo "$OUTPUT"

# Extract key metrics for logging
PACKAGES_CHANGED=$(echo "$OUTPUT" | grep "^packages_changed=" | cut -d= -f2)
CHANGESETS_CREATED=$(echo "$OUTPUT" | grep "^changesets_created=" | cut -d= -f2)
CHANGESET_CREATED=$(echo "$OUTPUT" | grep "^changeset_created=" | cut -d= -f2)

echo "Completed changeset generation" >&2
echo "Packages with changes: $PACKAGES_CHANGED" >&2
echo "Changesets created: $CHANGESETS_CREATED" >&2 