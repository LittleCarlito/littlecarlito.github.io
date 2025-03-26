#!/bin/bash

# Exit on error
set -e

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
    
    # Check for required sections
    if ! echo "$content" | grep -q "^---"; then
        echo "Error: Changeset file $file must start with '---'"
        return 1
    fi
    
    # Validate package names
    while IFS= read -r line; do
        if [[ $line =~ ^[a-zA-Z0-9-]+@[0-9]+\.[0-9]+\.[0-9]+: ]]; then
            package=$(echo "$line" | cut -d'@' -f1)
            if [ ! -d "packages/$package" ]; then
                echo "Error: Package '$package' referenced in $file does not exist"
                return 1
            fi
        fi
    done <<< "$content"
    
    # Validate version bump types
    while IFS= read -r line; do
        if [[ $line =~ ^[a-zA-Z0-9-]+@[0-9]+\.[0-9]+\.[0-9]+: ]]; then
            bump_type=$(echo "$line" | cut -d':' -f2 | tr -d ' ')
            if [[ ! "$bump_type" =~ ^(major|minor|patch)$ ]]; then
                echo "Error: Invalid bump type '$bump_type' in $file"
                return 1
            fi
        fi
    done <<< "$content"
    
    # Validate summary
    if ! echo "$content" | grep -q "^---" -A1 | grep -q "summary:"; then
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
    
    # Validate each changeset file
    for file in "$changeset_dir"/*.md; do
        if [ -f "$file" ]; then
            if ! validate_changeset "$file"; then
                has_errors=1
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
    else
        echo "Validation failed. Please fix the errors above."
        exit 1
    fi
}

# Run main function
main 