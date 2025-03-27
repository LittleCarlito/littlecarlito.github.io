#!/bin/bash

# Exit on error
set -e

# Publish packages to npm script
# Handles publishing packages to npm registry

# Main publish function
publish_packages() {
    local package_path="$1"
    local no_git_checks="$2"
    local tag="$3"
    
    echo "Publishing packages to npm" >&2
    
    # Determine publish command
    local publish_cmd="pnpm publish"
    
    if [ "$no_git_checks" = "true" ]; then
        publish_cmd="$publish_cmd --no-git-checks"
    fi
    
    if [ -n "$tag" ]; then
        publish_cmd="$publish_cmd --tag $tag"
    fi
    
    # Publish all packages or specific package
    if [ "$package_path" = "all" ]; then
        echo "Publishing all packages..." >&2
        eval "pnpm -r $publish_cmd"
    else
        echo "Publishing package at $package_path..." >&2
        
        # Determine full path if needed
        if [[ "$package_path" != "packages/"* ]] && [[ "$package_path" != "./" ]] && [[ "$package_path" != "." ]]; then
            package_path="./packages/$package_path"
        fi
        
        cd "$package_path"
        eval "$publish_cmd"
    fi
    
    echo "Publishing completed successfully" >&2
    echo "published=true"
}

# Parse command line arguments
main() {
    local package_path="all"
    local no_git_checks="true"
    local tag=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --package-path)
                package_path="$2"
                shift 2
                ;;
            --no-git-checks)
                no_git_checks="$2"
                shift 2
                ;;
            --tag)
                tag="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--package-path <path>] [--no-git-checks <true|false>] [--tag <tag>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Call publish function
    publish_packages "$package_path" "$no_git_checks" "$tag"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 