#!/bin/bash
# Validate GitHub Actions workflow files

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

echo "🔍 Validating GitHub Actions workflow files..."

# Check if actionlint is installed
if ! command -v actionlint &> /dev/null; then
    echo "⚠️ actionlint not found. Installing..."
    
    # Install actionlint using go or brew depending on availability
    if command -v go &> /dev/null; then
        go install github.com/rhysd/actionlint/cmd/actionlint@latest
    elif command -v brew &> /dev/null; then
        brew install actionlint
    else
        echo "❌ Neither go nor brew found. Please install actionlint manually:"
        echo "   https://github.com/rhysd/actionlint#installation"
        exit 1
    fi
fi

# Validate all workflow files
echo "Running actionlint on workflow files..."
find .github/workflows -name "*.yml" -exec actionlint {} \;
find .github/actions -name "action.yml" -exec actionlint {} \;

# Check specifically for variable reference issues
echo "Checking for common variable reference issues..."
ERRORS=0

# Check for || in GitHub Actions expressions
grep -r '\${{ .* || .*}}' --include="*.yml" .github && {
    echo "❌ Found potential invalid '||' operator usage in GitHub Actions expressions."
    echo "   GitHub Actions expressions don't support the || operator with environment variables."
    echo "   Use conditional steps or bash if statements instead."
    ERRORS=$((ERRORS + 1))
}

# Check for undefined variable references
grep -r '\${{ .* [A-Z_]* .*}}' --include="*.yml" .github | grep -v "steps\|inputs\|env\|github\|needs\|secrets\|vars\|matrix\|job\|runner" && {
    echo "❌ Found potential references to undefined variables in GitHub Actions expressions."
    ERRORS=$((ERRORS + 1))
}

if [ $ERRORS -gt 0 ]; then
    echo "❌ Found $ERRORS potential issues with GitHub Actions workflow files."
    exit 1
else
    echo "✅ GitHub Actions validation passed!"
fi 