#!/bin/bash

# Exit on error
set -e

# Preserve Changeset Config Script
# Ensures the changeset config stays with independent versioning

# Main function
preserve_config() {
    printf "Preserving config...\n"
    
    # Create a backup of our config
    cp .changeset/config.json .changeset/config.json.bak
    
    # Update the config to use independent versioning
    cat > .changeset/config.json << EOF
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": true,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
EOF
    
    # Check if the config was changed
    if ! cmp -s .changeset/config.json .changeset/config.json.bak; then
        printf "Config was restored to independent versioning\n"
        git add .changeset/config.json 2>&1 >&2
        git commit -m "chore: restore independent versioning in changeset config" 2>&1 >&2
        git push origin HEAD 2>&1 >&2
        printf "config_updated=true\n"
    else
        printf "Config already has independent versioning\n"
        printf "config_updated=false\n"
    fi
    
    rm .changeset/config.json.bak
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    preserve_config
fi 