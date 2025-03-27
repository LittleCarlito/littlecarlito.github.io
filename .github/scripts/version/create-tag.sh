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
    
    echo "Creating tag: $TAG_NAME" >&2
    
    # Check if tag already exists
    if git tag | grep -q "^$TAG_NAME$"; then
        echo "Warning: Tag $TAG_NAME already exists" >&2
        
        # Check if we should force update
        if [ "$force" = "true" ]; then
            echo "Force updating existing tag" >&2
            git tag -d "$TAG_NAME"
        else
            echo "Skipping tag creation (use --force to update existing tag)" >&2
            echo "tag_name=$TAG_NAME"
            echo "created=false"
            return 0
        fi
    fi
    
    # Create the tag
    if [ -n "$tag_message" ]; then
        git tag -a "$TAG_NAME" -m "$tag_message"
    else
        git tag -a "$TAG_NAME" -m "Release $TAG_NAME"
    fi
    
    # Push the tag
    git push origin "$TAG_NAME"
    
    echo "Tag $TAG_NAME created and pushed" >&2
    echo "tag_name=$TAG_NAME"
    echo "created=true"
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
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --version <version> [--tag-prefix <prefix>] [--message <msg>] [--force]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$version" ]; then
        echo "Error: --version is required" >&2
        exit 1
    fi
    
    # Call tag function
    create_tag "$version" "$tag_prefix" "$tag_message"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 