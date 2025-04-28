#!/bin/bash
# Test GitHub Actions workflow files

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

echo "🔍 Testing GitHub Actions workflow files..."

# Run the GitHub Actions validation script
./tests/pipeline-tests/validate-github-actions.sh

echo "🧪 Testing workflow dry-runs..."

# If act is installed, try to run the PR workflow in dry run mode
if command -v act &> /dev/null; then
    echo "Running local workflow simulation using 'act'..."
    
    # Simulate a PR workflow run
    act pull_request -W .github/workflows/pr-dryrun.yml --dry-run
    
    echo "Note: This is only a syntax check. Some context-specific errors might not be caught."
else
    echo "⚠️ 'act' not installed. For more thorough workflow testing, consider installing it:"
    echo "   https://github.com/nektos/act#installation"
fi

echo "✅ All tests completed successfully!" 