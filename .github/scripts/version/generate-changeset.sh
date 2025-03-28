#!/bin/bash

# Exit on error
set -e

# Generate changeset script
# Creates a new changeset from conventional commits or package details

# Main generate function
generate_changeset() {
    local since_commit="$1"
    local package_name="$2"
    local version_type="$3"
    local auto_changeset_prefix="$4"
    
    # Log message - redirect to stderr
    echo "Generating changeset..." >&2
    
    # Create a new branch for the changeset
    BRANCH_NAME="changeset-release/auto-$(date +%s)"
    echo "Using branch name: $BRANCH_NAME" >&2
    
    # Redirect git command output to stderr
    { git checkout -b "$BRANCH_NAME"; } 2>&1 >&2 || {
        echo "Error creating branch $BRANCH_NAME" >&2
        return 1
    }
    
    CHANGESET_CREATED=false
    
    # Generate changeset from conventional commits
    if [ -f "scripts/auto-changeset.js" ]; then
        echo "Using scripts/auto-changeset.js to generate changeset" >&2
        if [ -n "$since_commit" ]; then
            node scripts/auto-changeset.js --since="$since_commit" >&2
        else
            node scripts/auto-changeset.js >&2
        fi
    else
        echo "No auto-changeset.js script found, creating manual changeset" >&2
        # Create manual changeset
        mkdir -p .changeset
        CHANGESET_ID="${auto_changeset_prefix}$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)"
        
        if [ "$package_name" != "all" ]; then
            echo "Creating changeset for package: $package_name with version type: $version_type" >&2
            cat > ".changeset/$CHANGESET_ID.md" << EOF
---
"$package_name": $version_type
---

Auto-generated changeset for $package_name
EOF
        fi
    fi
    
    # Check if any changesets were created
    if ls .changeset/${auto_changeset_prefix}*.md 1> /dev/null 2>&1; then
        echo "Changeset generated successfully!" >&2
        
        # Commit the changeset - redirect all output to stderr
        { git add .changeset/; } 2>&1 >&2 || {
            echo "Error adding changeset files" >&2
            return 1
        }
        { git commit -m "chore: auto-generate changeset [skip ci]"; } 2>&1 >&2 || {
            echo "Error committing changeset" >&2
            return 1
        }
        { git push --set-upstream origin "$BRANCH_NAME"; } 2>&1 >&2 || {
            echo "Error pushing branch $BRANCH_NAME" >&2
            return 1
        }
        
        # Output values - send to stdout without >&2 redirection
        echo "branch_name=$BRANCH_NAME"
        echo "changeset_created=true"
    else
        echo "No changeset was generated" >&2
        # Output values - send to stdout without >&2 redirection
        echo "changeset_created=false"
        # Return to the original branch
        { git checkout -; } 2>&1 >&2 || {
            echo "Error returning to original branch" >&2
            return 1
        }
        # Delete the temporary branch
        { git branch -D "$BRANCH_NAME"; } 2>&1 >&2 || {
            echo "Error deleting branch $BRANCH_NAME" >&2
            return 1
        }
    fi
}

# Parse command line arguments
main() {
    local since_commit=""
    local package_name="all"
    local version_type="patch"
    local auto_changeset_prefix="auto-"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --since-commit)
                since_commit="$2"
                shift 2
                ;;
            --package-name)
                package_name="$2"
                shift 2
                ;;
            --version-type)
                version_type="$2"
                shift 2
                ;;
            --auto-changeset-prefix)
                auto_changeset_prefix="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--since-commit <sha>] [--package-name <n>] [--version-type <type>] [--auto-changeset-prefix <prefix>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Call generate function
    generate_changeset "$since_commit" "$package_name" "$version_type" "$auto_changeset_prefix"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 