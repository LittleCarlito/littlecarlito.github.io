#!/bin/bash

# Run all linting tests and display the results
echo "Running all linting tests..."
echo ""

echo "=== Test 1: JSDoc Linting ==="
pnpm eslint tests/lint-tests/test-jsdoc.js
echo ""

echo "=== Test 2: Blank Lines ==="
pnpm eslint tests/lint-tests/test-blank-lines.js
echo ""

echo "=== Test 3: Indentation ==="
pnpm eslint tests/lint-tests/test-error.js
echo ""

echo "=== Test 4: Comprehensive Test Suite ==="
pnpm eslint tests/lint-tests/lint-test-suite.js
echo ""

echo "All tests completed." 