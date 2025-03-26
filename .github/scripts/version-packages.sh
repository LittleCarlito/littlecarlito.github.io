#!/bin/bash

# Exit on error
set -e

# Function to get current version of a package
get_package_version() {
    local package=$1
    if [ -f "packages/$package/package.json" ]; then
        node -p "require('./packages/$package/package.json').version"
    elif [ -f "package.json" ]; then
        node -p "require('./package.json').version"
    else
        echo "Error: No package.json found"
        exit 1
    fi
}

# Function to update version in package.json
update_package_version() {
    local package=$1
    local new_version=$2
    local package_json="packages/$package/package.json"
    
    if [ -f "$package_json" ]; then
        # Update version in package.json
        node -e "
            const pkg = require('./$package_json');
            pkg.version = '$new_version';
            require('fs').writeFileSync('./$package_json', JSON.stringify(pkg, null, 2) + '\n');
        "
        echo "Updated $package to version $new_version"
    fi
}

# Function to update dependencies versions
update_dependencies() {
    local package=$1
    local new_version=$2
    local package_json="packages/$package/package.json"
    
    if [ -f "$package_json" ]; then
        # Update dependencies that reference this package
        find . -name "package.json" -type f -exec node -e "
            const pkg = require('{}');
            if (pkg.dependencies && pkg.dependencies['$package']) {
                pkg.dependencies['$package'] = '$new_version';
                require('fs').writeFileSync('{}', JSON.stringify(pkg, null, 2) + '\n');
                console.log('Updated dependency in {}');
            }
        " \;
    fi
}

# Function to version a single package
version_package() {
    local package=$1
    local version_type=$2
    local current_version=$(get_package_version "$package")
    
    # Parse version numbers
    IFS='.' read -r -a version_parts <<< "$current_version"
    local major="${version_parts[0]}"
    local minor="${version_parts[1]}"
    local patch="${version_parts[2]}"
    
    # Calculate new version based on type
    case "$version_type" in
        "major")
            new_version="$((major + 1)).0.0"
            ;;
        "minor")
            new_version="$major.$((minor + 1)).0"
            ;;
        "patch")
            new_version="$major.$minor.$((patch + 1))"
            ;;
        *)
            echo "Error: Invalid version type: $version_type"
            exit 1
            ;;
    esac
    
    # Update package version
    update_package_version "$package" "$new_version"
    
    # Update dependencies
    update_dependencies "$package" "$new_version"
    
    echo "$new_version"
}

# Function to version all packages
version_all_packages() {
    local version_type=$1
    local packages=()
    
    # Get list of packages
    if [ -d "packages" ]; then
        packages=($(ls packages))
    else
        packages=(".")
    fi
    
    # Version each package
    for package in "${packages[@]}"; do
        echo "Versioning package: $package"
        version_package "$package" "$version_type"
    done
}

# Main function
main() {
    # Parse command line arguments
    local version_type="patch"
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type)
                version_type="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--type major|minor|patch]"
                exit 1
                ;;
        esac
    done
    
    echo "Starting package versioning..."
    version_all_packages "$version_type"
    echo "Package versioning completed successfully!"
}

# Run main function with all arguments
main "$@" 