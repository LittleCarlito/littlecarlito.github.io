#!/bin/bash

# Exit on error
set -e

# Enable debug mode with DEBUG=1
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Function to get current version of a package
get_package_version() {
    local package=$1
    local version=""
    
    if [ -f "packages/$package/package.json" ]; then
        version=$(node -p "try { require('./packages/$package/package.json').version } catch(e) { console.error(e); process.exit(1) }" 2>/dev/null)
        if [ $? -ne 0 ] || [ -z "$version" ]; then
            echo "Error: Failed to parse package.json for $package" >&2
            return 1
        fi
    elif [ -f "package.json" ]; then
        version=$(node -p "try { require('./package.json').version } catch(e) { console.error(e); process.exit(1) }" 2>/dev/null)
        if [ $? -ne 0 ] || [ -z "$version" ]; then
            echo "Error: Failed to parse root package.json" >&2
            return 1
        fi
    else
        echo "Error: No package.json found for $package" >&2
        return 1
    fi
    
    # Verify version format
    if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
        echo "Error: Invalid version format: $version" >&2
        return 1
    fi
    
    # Output the version to stdout (no redirection)
    echo "$version"
}

# Function to update version in package.json
update_package_version() {
    local package=$1
    local new_version=$2
    local package_json="packages/$package/package.json"
    local result=0
    
    if [ -f "$package_json" ]; then
        # Update version in package.json with robust error handling
        node -e "
        try {
            const fs = require('fs');
            const pkg = require('./$package_json');
            pkg.version = '$new_version';
            fs.writeFileSync('./$package_json', JSON.stringify(pkg, null, 2) + '\n');
            console.log('Updated $package to version $new_version');
        } catch(error) {
            console.error('Error updating version in $package_json:', error);
            process.exit(1);
        }
        " || result=1
        
        if [ $result -ne 0 ]; then
            echo "Error: Failed to update version in $package_json" >&2
            return 1
        fi
    else
        echo "Warning: Package.json not found at $package_json" >&2
        return 0  # Continue with other packages
    fi
    
    return 0
}

# Function to update dependencies versions
update_dependencies() {
    local package=$1
    local new_version=$2
    local result=0
    
    # Find all package.json files and update dependencies
    find . -name "package.json" -type f -print0 | while IFS= read -r -d '' pkg_file; do
        node -e "
        try {
            const fs = require('fs');
            const pkg = require('$(pwd)/$pkg_file');
            let updated = false;
            
            // Check dependencies
            if (pkg.dependencies && pkg.dependencies['$package']) {
                pkg.dependencies['$package'] = '$new_version';
                updated = true;
            }
            
            // Check devDependencies
            if (pkg.devDependencies && pkg.devDependencies['$package']) {
                pkg.devDependencies['$package'] = '$new_version';
                updated = true;
            }
            
            // Check peerDependencies
            if (pkg.peerDependencies && pkg.peerDependencies['$package']) {
                pkg.peerDependencies['$package'] = '$new_version';
                updated = true;
            }
            
            if (updated) {
                fs.writeFileSync('$(pwd)/$pkg_file', JSON.stringify(pkg, null, 2) + '\n');
                console.log('Updated $package dependency in $pkg_file');
            }
        } catch(error) {
            console.error('Error updating dependencies in $pkg_file:', error);
            process.exit(1);
        }
        " || result=1
        
        if [ $result -ne 0 ]; then
            echo "Error: Failed to update dependencies in $pkg_file" >&2
            return 1
        fi
    done
    
    return 0
}

# Function to version a single package
version_package() {
    local package=$1
    local version_type=$2
    local current_version=""
    
    current_version=$(get_package_version "$package") || return 1
    
    # Parse version numbers
    if [[ "$current_version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-[a-zA-Z0-9.-]+)?$ ]]; then
        local major="${BASH_REMATCH[1]}"
        local minor="${BASH_REMATCH[2]}"
        local patch="${BASH_REMATCH[3]}"
        local prerelease="${BASH_REMATCH[4]}"
        
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
                echo "Error: Invalid version type: $version_type" >&2
                return 1
                ;;
        esac
        
        # Add prerelease tag back if present
        if [ -n "$prerelease" ]; then
            new_version="$new_version$prerelease"
        fi
    else
        echo "Error: Failed to parse version components from: $current_version" >&2
        return 1
    fi
    
    # Update package version
    update_package_version "$package" "$new_version" || return 1
    
    # Update dependencies
    update_dependencies "$package" "$new_version" || return 1
    
    # Output the new version to stdout (no redirection)
    echo "$new_version"
    return 0
}

# Function to version all packages
version_all_packages() {
    local version_type=$1
    local packages=()
    local failed_packages=()
    local success=0
    
    # Get list of packages
    if [ -d "packages" ]; then
        for pkg_dir in packages/*; do
            if [ -d "$pkg_dir" ] && [ -f "$pkg_dir/package.json" ]; then
                packages+=($(basename "$pkg_dir"))
            fi
        done
    else
        packages=(".")
    fi
    
    if [ ${#packages[@]} -eq 0 ]; then
        echo "Warning: No packages found to version" >&2
        return 0
    fi
    
    # Version each package
    for package in "${packages[@]}"; do
        echo "Versioning package: $package"
        if ! version_package "$package" "$version_type"; then
            echo "Failed to version package: $package"
            failed_packages+=("$package")
            success=1
        fi
    done
    
    if [ ${#failed_packages[@]} -gt 0 ]; then
        echo "The following packages failed to version: ${failed_packages[*]}"
        return 1
    fi
    
    return $success
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
            --help)
                echo "Usage: $0 [--type major|minor|patch]"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--type major|minor|patch]"
                exit 1
                ;;
        esac
    done
    
    # Validate version type
    if [[ ! "$version_type" =~ ^(major|minor|patch)$ ]]; then
        echo "Error: Invalid version type: $version_type. Must be 'major', 'minor', or 'patch'." >&2
        exit 1
    fi
    
    echo "Starting package versioning with type: $version_type..."
    
    if version_all_packages "$version_type"; then
        echo "Package versioning completed successfully!"
        exit 0
    else
        echo "Package versioning completed with errors."
        exit 1
    fi
}

# Run main function with all arguments
main "$@" 
