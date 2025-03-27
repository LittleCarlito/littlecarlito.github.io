#!/bin/bash

# Exit on error
set -e

# Preserve Changeset Config Script
# Ensures the changeset config stays with independent versioning

# Main function
preserve_config() {
    echo "Ensuring changeset config uses independent versioning..." >&2
    
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
        echo "Config was restored to independent versioning" >&2
        git add .changeset/config.json
        git commit -m "chore: restore independent versioning in changeset config"
        git push
        echo "true"  # Output for capture
    else
        echo "Config already has independent versioning" >&2
        echo "false"  # Output for capture
    fi
    
    rm .changeset/config.json.bak
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    preserve_config
fi 