#!/bin/bash

# Exit on error
set -e

# Create tag script
# Creates and pushes Git tags for package versions

# Main tag function
create_tag() {
    local version="$1"
    local tag_prefix="$2"
    local tag_message="$3"
    
    # Create tag name
    TAG_NAME="${tag_prefix}${version}"
    
    printf "Creating tag: %s\n" "$TAG_NAME" >&2
    
    # Check if tag already exists
    if git tag 2>&1 | grep -q "^$TAG_NAME$"; then
        printf "Warning: Tag %s already exists\n" "$TAG_NAME" >&2
        
        # Check if we should force update
        if [ "$force" = "true" ]; then
            printf "Force updating existing tag\n" >&2
            git tag -d "$TAG_NAME" >&2
        else
            printf "Skipping tag creation (use --force to update existing tag)\n" >&2
            printf "tag_name=%s\n" "$TAG_NAME"
            printf "created=false\n"
            return 0
        fi
    fi
    
    # Create the tag
    if [ -n "$tag_message" ]; then
        git tag -a "$TAG_NAME" -m "$tag_message" >&2 || {
            printf "Error creating tag %s\n" "$TAG_NAME" >&2
            return 1
        }
    else
        git tag -a "$TAG_NAME" -m "Release $TAG_NAME" >&2 || {
            printf "Error creating tag %s\n" "$TAG_NAME" >&2
            return 1
        }
    fi
    
    # Push the tag
    git push origin "$TAG_NAME" >&2 || {
        printf "Error pushing tag %s\n" "$TAG_NAME" >&2
        return 1
    }
    
    printf "Tag %s created and pushed\n" "$TAG_NAME" >&2
    printf "tag_name=%s\n" "$TAG_NAME"
    printf "created=true\n"
}

# Parse command line arguments
main() {
    local version=""
    local tag_prefix="v"
    local tag_message=""
    local force="false"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                version="$2"
                shift 2
                ;;
            --tag-prefix)
                tag_prefix="$2"
                shift 2
                ;;
            --message)
                tag_message="$2"
                shift 2
                ;;
            --force)
                force="true"
                shift
                ;;
            *)
                printf "Unknown option: %s\n" "$1" >&2
                printf "Usage: %s --version <version> [--tag-prefix <prefix>] [--message <msg>] [--force]\n" "$0" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$version" ]; then
        printf "Error: --version is required\n" >&2
        exit 1
    fi
    
    # Call tag function
    create_tag "$version" "$tag_prefix" "$tag_message"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 