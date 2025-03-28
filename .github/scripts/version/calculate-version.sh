#!/bin/bash

# Exit on error
set -e

# Calculate version script
# Determines new version numbers based on current version and bump type

# Main calculate function
calculate_version() {
    local package_path="$1"
    local version_type="$2"
    
    # Determine package.json path
    if [ -z "$package_path" ]; then
        PACKAGE_JSON_PATH="package.json"
        echo "Using root package.json" >&2
    else
        PACKAGE_JSON_PATH="$package_path/package.json"
        echo "Using package.json at $PACKAGE_JSON_PATH" >&2
    fi
    
    # Check if package.json exists
    if [ ! -f "$PACKAGE_JSON_PATH" ]; then
        echo "Error: Package.json not found at $PACKAGE_JSON_PATH" >&2
        return 1
    fi
    
    # Get current version
    CURRENT_VERSION=$(node -p "require('./$PACKAGE_JSON_PATH').version")
    echo "Current version: $CURRENT_VERSION" >&2
    
    # Split version into parts
    IFS='.' read -r -a version_parts <<< "$CURRENT_VERSION"
    MAJOR="${version_parts[0]}"
    MINOR="${version_parts[1]}"
    PATCH=$(echo "${version_parts[2]}" | grep -o '^[0-9]*')
    SUFFIX=$(echo "${version_parts[2]}" | grep -o '[^0-9].*$' || echo "")
    
    # Calculate new version based on type
    case "$version_type" in
        major)
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
        minor)
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
        patch)
            PATCH=$((PATCH + 1))
            ;;
        *)
            echo "Error: Invalid version type '$version_type'. Must be 'major', 'minor', or 'patch'." >&2
            return 1
            ;;
    esac
    
    NEW_VERSION="$MAJOR.$MINOR.$PATCH$SUFFIX"
    echo "New version: $NEW_VERSION" >&2
    echo "current_version=$CURRENT_VERSION" > /dev/stdout
    echo "new_version=$NEW_VERSION" > /dev/stdout
    echo "package_path=$PACKAGE_JSON_PATH" > /dev/stdout
}

# Parse command line arguments
main() {
    local package_path="."
    local version_type="patch"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --package-path)
                package_path="$2"
                shift 2
                ;;
            --version-type)
                version_type="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--package-path <path>] [--version-type <major|minor|patch>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Call calculate function
    calculate_version "$package_path" "$version_type"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 