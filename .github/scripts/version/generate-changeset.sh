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
    
    printf "Generating changeset...\n" >&2
    
    # Create a new branch for the changeset
    BRANCH_NAME="changeset-release/auto-$(date +%s)"
    printf "Using branch name: %s\n" "$BRANCH_NAME" >&2
    git checkout -b "$BRANCH_NAME" 2>&1 >&2 || {
        printf "Error creating branch %s\n" "$BRANCH_NAME" >&2
        return 1
    }
    
    CHANGESET_CREATED=false
    
    # Generate changeset from conventional commits
    if [ -f "scripts/auto-changeset.js" ]; then
        printf "Using scripts/auto-changeset.js to generate changeset\n" >&2
        if [ -n "$since_commit" ]; then
            node scripts/auto-changeset.js --since="$since_commit" >&2
        else
            node scripts/auto-changeset.js >&2
        fi
    else
        printf "No auto-changeset.js script found, creating manual changeset\n" >&2
        # Create manual changeset
        mkdir -p .changeset
        CHANGESET_ID="${auto_changeset_prefix}$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)"
        
        if [ "$package_name" != "all" ]; then
            printf "Creating changeset for package: %s with version type: %s\n" "$package_name" "$version_type" >&2
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
        printf "Changeset generated successfully!\n" >&2
        
        # Commit the changeset
        git add .changeset/ 2>&1 >&2 || {
            printf "Error adding changeset files\n" >&2
            return 1
        }
        git commit -m "chore: auto-generate changeset [skip ci]" 2>&1 >&2 || {
            printf "Error committing changeset\n" >&2
            return 1
        }
        git push --set-upstream origin "$BRANCH_NAME" 2>&1 >&2 || {
            printf "Error pushing branch %s\n" "$BRANCH_NAME" >&2
            return 1
        }
        
        printf "branch_name=%s\n" "$BRANCH_NAME"
        printf "changeset_created=true\n"
    else
        printf "No changeset was generated\n" >&2
        printf "changeset_created=false\n"
        # Return to the original branch
        git checkout - 2>&1 >&2 || {
            printf "Error returning to original branch\n" >&2
            return 1
        }
        # Delete the temporary branch
        git branch -D "$BRANCH_NAME" 2>&1 >&2 || {
            printf "Error deleting branch %s\n" "$BRANCH_NAME" >&2
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
                printf "Unknown option: %s\n" "$1" >&2
                printf "Usage: %s [--since-commit <sha>] [--package-name <n>] [--version-type <type>] [--auto-changeset-prefix <prefix>]\n" "$0" >&2
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