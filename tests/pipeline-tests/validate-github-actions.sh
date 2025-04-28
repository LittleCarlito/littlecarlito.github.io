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

# Validate workflow files only (not action files)
echo "Running actionlint on workflow files..."
find .github/workflows -name "*.yml" -exec actionlint {} \;

# Create a temporary directory for modified action files validation
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/.github/workflows"

# Process each action.yml file - convert to workflow format for validation
echo "Processing action definition files..."
for action_file in $(find .github/actions -name "action.yml"); do
    # Extract just the name of the action directory
    action_name=$(basename "$(dirname "$action_file")")
    
    # Create a temporary workflow file for validation
    temp_workflow="$TEMP_DIR/.github/workflows/${action_name}_converted.yml"
    
    # Start with a valid workflow structure
    echo "name: Converted $action_name" > "$temp_workflow"
    echo "on: [push]" >> "$temp_workflow"
    echo "jobs:" >> "$temp_workflow"
    echo "  validate_action:" >> "$temp_workflow"
    echo "    runs-on: ubuntu-latest" >> "$temp_workflow"
    echo "    steps:" >> "$temp_workflow"
    echo "      - uses: actions/checkout@v3" >> "$temp_workflow"
    echo "      - name: Run $action_name" >> "$temp_workflow"
    echo "        uses: ./.github/actions/$action_name" >> "$temp_workflow"
done

# Check for shell script issues in workflow files 
echo "Checking for shell script issues..."
find .github/workflows -name "*.yml" -exec grep -l "run:" {} \; | xargs -I{} actionlint {}

# Check specifically for variable reference issues
echo "Checking for common variable reference issues..."
ERRORS=0
ISSUE_SUMMARY=""

# Check for || in GitHub Actions expressions - only flag as error when used with env vars
if grep -r '\${{ env\.[A-Za-z0-9_]* || .*}}' --include="*.yml" .github/ > /dev/null 2>&1; then
    ISSUE_COUNT=$(grep -r '\${{ env\.[A-Za-z0-9_]* || .*}}' --include="*.yml" .github/ | wc -l | tr -d ' ')
    echo "❌ Found $ISSUE_COUNT invalid '||' operator usage with environment variables in GitHub Actions expressions."
    echo "   GitHub Actions expressions don't support the || operator with environment variables."
    echo "   Use conditional steps or bash if statements instead."
    
    # Display the problematic lines
    grep -r '\${{ env\.[A-Za-z0-9_]* || .*}}' --include="*.yml" .github/
    
    ERRORS=$((ERRORS + 1))
    ISSUE_SUMMARY="$ISSUE_SUMMARY\n- $ISSUE_COUNT invalid '||' operator usage with env vars"
else
    echo "✅ No invalid '||' operator usage with environment variables detected"
    
    # Just informational - show other uses of || operator that are valid but worth reviewing
    if grep -r '\${{ .* || .*}}' --include="*.yml" .github/ | grep -v '\${{ env\.' > /dev/null 2>&1; then
        INFO_COUNT=$(grep -r '\${{ .* || .*}}' --include="*.yml" .github/ | grep -v '\${{ env\.' | wc -l | tr -d ' ')
        echo "ℹ️ Found $INFO_COUNT uses of '||' operator in GitHub Actions expressions (valid with outputs/inputs, but worth reviewing):"
        grep -r '\${{ .* || .*}}' --include="*.yml" .github/ | grep -v '\${{ env\.'
    fi
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

# Clean up
rm -rf "$TEMP_DIR"

# Print summary and exit with appropriate status code
if [ $ERRORS -gt 0 ]; then
    echo "❌ Found $ERRORS types of issues with GitHub Actions workflow files."
    echo -e "Summary of issues:$ISSUE_SUMMARY"
    exit 1
else
    echo "✅ GitHub Actions validation passed!"
    exit 0
fi 