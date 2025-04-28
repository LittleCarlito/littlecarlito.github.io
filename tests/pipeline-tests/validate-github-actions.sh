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
ISSUE_SUMMARY=""

# Check for || in GitHub Actions expressions
if grep -r '\${{ .* || .*}}' --include="*.yml" .github/ > /dev/null 2>&1; then
    ISSUE_COUNT=$(grep -r '\${{ .* || .*}}' --include="*.yml" .github/ | wc -l | tr -d ' ')
    echo "❌ Found $ISSUE_COUNT potential invalid '||' operator usage in GitHub Actions expressions."
    echo "   GitHub Actions expressions don't support the || operator with environment variables."
    echo "   Use conditional steps or bash if statements instead."
    
    # Display the problematic lines
    grep -r '\${{ .* || .*}}' --include="*.yml" .github/
    
    ERRORS=$((ERRORS + 1))
    ISSUE_SUMMARY="$ISSUE_SUMMARY\n- $ISSUE_COUNT invalid '||' operator usage"
fi

# Check for undefined variable references
if grep -r '\${{ .* [A-Z_]* .*}}' --include="*.yml" .github/ | grep -v "steps\|inputs\|env\|github\|needs\|secrets\|vars\|matrix\|job\|runner" > /dev/null 2>&1; then
    ISSUE_COUNT=$(grep -r '\${{ .* [A-Z_]* .*}}' --include="*.yml" .github/ | grep -v "steps\|inputs\|env\|github\|needs\|secrets\|vars\|matrix\|job\|runner" | wc -l | tr -d ' ')
    echo "❌ Found $ISSUE_COUNT potential references to undefined variables in GitHub Actions expressions."
    
    # Display the problematic lines
    grep -r '\${{ .* [A-Z_]* .*}}' --include="*.yml" .github/ | grep -v "steps\|inputs\|env\|github\|needs\|secrets\|vars\|matrix\|job\|runner"
    
    ERRORS=$((ERRORS + 1))
    ISSUE_SUMMARY="$ISSUE_SUMMARY\n- $ISSUE_COUNT undefined variable references"
fi

# Print summary and exit with appropriate status code
if [ $ERRORS -gt 0 ]; then
    echo "❌ Found $ERRORS types of issues with GitHub Actions workflow files."
    echo -e "Summary of issues:$ISSUE_SUMMARY"
    exit 1
else
    echo "✅ GitHub Actions validation passed!"
    exit 0
fi 