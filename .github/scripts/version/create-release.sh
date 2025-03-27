#!/bin/bash

# Exit on error
set -e

# Create GitHub release script
# Creates a GitHub release for a given tag

# Main create release function
create_release() {
    local token="$1"
    local repo="$2"
    local tag_name="$3"
    local name="$4"
    local body="$5"
    local draft="$6"
    local prerelease="$7"
    local generate_notes="$8"
    
    echo "Creating GitHub release for tag: $tag_name" >&2
    
    # Check if tag exists
    if ! git tag | grep -q "^$tag_name$"; then
        echo "Error: Tag $tag_name does not exist" >&2
        exit 1
    fi
    
    # Set default name if not provided
    if [ -z "$name" ]; then
        name="Release $tag_name"
    fi
    
    # Create the release using GitHub CLI
    RELEASE_RESPONSE=$(gh api \
      --method POST \
      /repos/$repo/releases \
      -f tag_name="$tag_name" \
      -f name="$name" \
      -f body="$body" \
      -f draft="$draft" \
      -f prerelease="$prerelease" \
      -f generate_release_notes="$generate_notes")
    
    # Extract release details
    RELEASE_ID=$(echo "$RELEASE_RESPONSE" | jq -r '.id')
    RELEASE_URL=$(echo "$RELEASE_RESPONSE" | jq -r '.html_url')
    
    echo "Created release: $RELEASE_URL" >&2
    echo "release_id=$RELEASE_ID"
    echo "release_url=$RELEASE_URL"
}

# Parse command line arguments
main() {
    local token=""
    local repo=""
    local tag_name=""
    local name=""
    local body=""
    local draft="false"
    local prerelease="false"
    local generate_notes="true"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --token)
                token="$2"
                shift 2
                ;;
            --repo)
                repo="$2"
                shift 2
                ;;
            --tag-name)
                tag_name="$2"
                shift 2
                ;;
            --name)
                name="$2"
                shift 2
                ;;
            --body)
                body="$2"
                shift 2
                ;;
            --draft)
                draft="$2"
                shift 2
                ;;
            --prerelease)
                prerelease="$2"
                shift 2
                ;;
            --generate-notes)
                generate_notes="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --token <token> --repo <owner/repo> --tag-name <tag> [--name <name>] [--body <body>] [--draft <true|false>] [--prerelease <true|false>] [--generate-notes <true|false>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$token" ]; then
        echo "Error: --token is required" >&2
        exit 1
    fi
    
    if [ -z "$repo" ]; then
        echo "Error: --repo is required" >&2
        exit 1
    fi
    
    if [ -z "$tag_name" ]; then
        echo "Error: --tag-name is required" >&2
        exit 1
    fi
    
    # Set GH_TOKEN for gh commands
    export GH_TOKEN="$token"
    
    # Call release function
    create_release "$token" "$repo" "$tag_name" "$name" "$body" "$draft" "$prerelease" "$generate_notes"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 