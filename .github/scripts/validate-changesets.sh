#!/bin/bash

# Exit on error
set -e

# Enable debug mode with DEBUG=1
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Function to validate a single changeset file
validate_changeset() {
    local file=$1
    echo "Validating changeset: $file"
    
    # Check if file exists
    if [ ! -f "$file" ]; then
        echo "Error: Changeset file $file does not exist"
        return 1
    fi
    
    # Check file extension
    if [[ ! "$file" =~ \.md$ ]]; then
        echo "Error: Changeset file $file must have .md extension"
        return 1
    fi
    
    # Read file content
    content=$(cat "$file")
    if [ -z "$content" ]; then
        echo "Error: Changeset file $file is empty"
        return 1
    fi
    
    # Check for required sections
    if ! echo "$content" | grep -q "^---"; then
        echo "Error: Changeset file $file must start with '---'"
        return 1
    fi
    
    # Check if this is an auto-generated changeset
    is_auto_changeset=0
    if [[ "$file" =~ auto-[a-z0-9]+\.md ]]; then
        echo "  Auto-generated changeset detected, applying special validation rules"
        is_auto_changeset=1
    fi
    
    # Validate package names
    while IFS= read -r line; do
        # Clean the line to handle potential special characters
        clean_line=$(echo "$line" | tr -d '\r')
        
        if [[ $clean_line =~ ^\"?@?[a-zA-Z0-9-]+(/[a-zA-Z0-9-]+)?\"?: ]]; then
            # Extract package name, handling quoted names and scoped packages
            package=$(echo "$clean_line" | sed 's/^"//;s/":/:/;s/:.*//' | tr -d '"')
            
            # Skip validation for auto-generated changesets
            if [ $is_auto_changeset -eq 1 ]; then
                echo "  Skipping package existence check for auto-generated changeset"
                continue
            fi
            
            # Only check folder existence for non-root packages
            if [[ $package == @* || $package == */* ]]; then
                # Extract package name without scope
                pkg_name=$(echo "$package" | sed 's/@\{0,1\}\([^/]*\)\/\{0,1\}\(.*\)/\2/')
                pkg_name=${pkg_name:-$package} # Fallback if regex didn't match
                
                if [ ! -d "packages/$pkg_name" ] && [ ! -d "apps/$pkg_name" ]; then
                    echo "Error: Package '$package' referenced in $file does not exist in packages/ or apps/"
                    return 1
                fi
            fi
        fi
    done <<< "$content"
    
    # Validate version bump types
    while IFS= read -r line; do
        # Clean the line to handle potential special characters
        clean_line=$(echo "$line" | tr -d '\r')
        
        if [[ $clean_line =~ ^\"?@?[a-zA-Z0-9-]+(/[a-zA-Z0-9-]+)?\"?: ]]; then
            # Skip bump type validation for auto-generated changesets
            if [ $is_auto_changeset -eq 1 ]; then
                echo "  Skipping bump type validation for auto-generated changeset"
                continue
            fi
            
            # For regular changesets, validate the bump type
            bump_type=$(echo "$clean_line" | sed 's/.*: *"\{0,1\}\([^"]*\)"\{0,1\}.*/\1/')
            if [[ ! "$bump_type" =~ ^(major|minor|patch)$ ]]; then
                echo "Error: Invalid bump type '$bump_type' in $file"
                return 1
            fi
        fi
    done <<< "$content"
    
    # Validate summary
    if ! echo "$content" | grep -q "summary:"; then
        echo "Error: Changeset file $file must include a summary"
        return 1
    fi
    
    return 0
}

# Function to validate all changeset files
validate_all_changesets() {
    local changeset_dir=".changeset"
    local has_errors=0
    
    echo "Validating all changeset files..."
    
    # Check if changeset directory exists
    if [ ! -d "$changeset_dir" ]; then
        echo "Error: Changeset directory $changeset_dir does not exist"
        return 1
    fi
    
    # Check if there are any markdown files
    changeset_files=("$changeset_dir"/*.md)
    if [ ! -e "${changeset_files[0]}" ]; then
        echo "Warning: No changeset files found in $changeset_dir"
        return 0
    fi
    
    # Validate each changeset file
    for file in "$changeset_dir"/*.md; do
        if [ -f "$file" ]; then
            if ! validate_changeset "$file"; then
                has_errors=1
                echo "  Failed validation: $file"
            else
                echo "  Passed validation: $file"
            fi
        fi
    done
    
    return $has_errors
}

# Main function
main() {
    echo "Starting changeset validation..."
    
    if validate_all_changesets; then
        echo "All changeset files are valid!"
        exit 0
    else
        echo "Validation failed. Please fix the errors above."
        exit 1
    fi
}

# Run main function
main 