#!/bin/bash

# Exit on error
set -e

# Setup Environment Script
# Sets up Node.js, pnpm, and configures Git for GitHub Actions

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main setup function
setup_environment() {
    local node_version="$1"
    local pnpm_version="$2"
    local github_token="$3"
    local registry_url="$4"
    local scope="$5"
    local fetch_depth="$6"
    
    echo "Setting up environment with Node.js $node_version and pnpm $pnpm_version" >&2
    
    # Check if nvm is installed, use it if available
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo "Using nvm to install Node.js..." >&2
        
        # This will redirect ALL output from these commands to stderr
        # Critical to avoid GitHub Actions parsing issues
        {
            export NVM_DIR="$HOME/.nvm"
            source "$HOME/.nvm/nvm.sh"
            # Explicitly redirect all nvm output to stderr
            nvm install "$node_version" 
            nvm use "$node_version"
        } >&2
    elif command_exists volta; then
        echo "Using volta to install Node.js..." >&2
        { volta install node@"$node_version"; } >&2
    elif ! command_exists node; then
        echo "Error: Node.js is not installed and neither nvm nor volta are available" >&2
        return 1
    fi
    
    # Install pnpm if not present
    if ! command_exists pnpm; then
        echo "Installing pnpm $pnpm_version..." >&2
        { npm install -g pnpm@"$pnpm_version"; } >&2
    fi
    
    # Configure Git identity
    echo "Configuring Git identity..." >&2
    { git config --global user.name "github-actions[bot]"; } >&2
    { git config --global user.email "github-actions[bot]@users.noreply.github.com"; } >&2
    
    # Configure npm registry (if not in a GitHub Action environment)
    if [ -z "$GITHUB_ACTIONS" ]; then
        echo "Configuring npm registry..." >&2
        echo "@$scope:registry=$registry_url" > .npmrc
        echo "${registry_url#https:}/:_authToken=$github_token" >> .npmrc
    fi
    
    # Install dependencies
    echo "Installing dependencies..." >&2
    { pnpm install; } >&2
    
    echo "Environment setup complete" >&2
    
    # Only print the output data in the exact format needed for GitHub Actions output
    echo "setup_complete=true"
}

# Parse command line arguments
main() {
    local node_version="lts/*"
    local pnpm_version="8.15.4"
    local github_token=""
    local registry_url="https://npm.pkg.github.com"
    local scope="@littlecarlito"
    local fetch_depth="0"  # Adding fetch-depth parameter with default
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --node-version)
                node_version="$2"
                shift 2
                ;;
            --pnpm-version)
                pnpm_version="$2"
                shift 2
                ;;
            --github-token)
                github_token="$2"
                shift 2
                ;;
            --registry-url)
                registry_url="$2"
                shift 2
                ;;
            --scope)
                scope="$2"
                shift 2
                ;;
            --fetch-depth)
                fetch_depth="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 [--node-version <version>] [--pnpm-version <version>] --github-token <token> [--registry-url <url>] [--scope <scope>] [--fetch-depth <depth>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$github_token" ]; then
        echo "Error: --github-token is required" >&2
        exit 1
    fi
    
    # Display fetch-depth for information (we don't actually use it in the script,
    # but we include it for compatibility with the original action)
    echo "Note: fetch-depth parameter ($fetch_depth) is accepted but not used in this script" >&2
    
    # Call setup function
    setup_environment "$node_version" "$pnpm_version" "$github_token" "$registry_url" "$scope" "$fetch_depth"
}

# Run main function (if script is not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 