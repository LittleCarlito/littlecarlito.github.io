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

# Create a temporary file to store the output from scope-based-changeset.sh
TEMP_OUTPUT=$(mktemp)

# Call our new scope-based changeset generation script with output capture
echo "DEBUG: Running scope-based-changeset.sh script..." >&2
.github/scripts/version/scope-based-changeset.sh \
  --base-commit "$BASE_COMMIT" \
  --auto-changeset-prefix "$AUTO_CHANGESET_PREFIX" \
  --default-version "$DEFAULT_VERSION_TYPE" \
  --dry-run "$DRY_RUN" > "$TEMP_OUTPUT" 2>&1 || {
    echo "ERROR: scope-based-changeset.sh script failed with status $?" >&2
    cat "$TEMP_OUTPUT" >&2
    rm -f "$TEMP_OUTPUT"
    exit 1
  }

# Debug: Show what was captured in the output file
echo "DEBUG: Output from scope-based-changeset.sh:" >&2
grep -E "^packages_changed=|^changesets_created=|^changeset_created=" "$TEMP_OUTPUT" >&2

# Extract output variables directly from the file - use strict pattern matching
PACKAGES_CHANGED=$(grep -E "^packages_changed=[0-9]+$" "$TEMP_OUTPUT" | head -1 | cut -d= -f2)
CHANGESETS_CREATED=$(grep -E "^changesets_created=[0-9]+$" "$TEMP_OUTPUT" | head -1 | cut -d= -f2)
CHANGESET_CREATED=$(grep -E "^changeset_created=(true|false)$" "$TEMP_OUTPUT" | head -1 | cut -d= -f2)

# Check if we got all the expected outputs
if [[ -z "$PACKAGES_CHANGED" || -z "$CHANGESETS_CREATED" || -z "$CHANGESET_CREATED" ]]; then
  echo "ERROR: Failed to extract all required outputs from scope-based-changeset.sh" >&2
  echo "Raw output was:" >&2
  cat "$TEMP_OUTPUT" >&2
  rm -f "$TEMP_OUTPUT"
  # Set defaults if values are missing
  PACKAGES_CHANGED=${PACKAGES_CHANGED:-0}
  CHANGESETS_CREATED=${CHANGESETS_CREATED:-0}
  CHANGESET_CREATED=${CHANGESET_CREATED:-false}
  echo "Using default values: packages_changed=$PACKAGES_CHANGED, changesets_created=$CHANGESETS_CREATED, changeset_created=$CHANGESET_CREATED" >&2
fi

# Clean up the temporary file
rm -f "$TEMP_OUTPUT"

# Log the values for debugging (to stderr only!)
echo "DEBUG: Packages with changes: $PACKAGES_CHANGED" >&2
echo "DEBUG: Changesets created: $CHANGESETS_CREATED" >&2

# Forward these outputs explicitly - only to stdout and in the GitHub Actions format
# Absolutely nothing else should be sent to stdout
echo "packages_changed=$PACKAGES_CHANGED"
echo "changesets_created=$CHANGESETS_CREATED"
echo "changeset_created=$CHANGESET_CREATED"

echo "Completed changeset generation" >&2
echo "Script completed successfully" >&2
exit 0 