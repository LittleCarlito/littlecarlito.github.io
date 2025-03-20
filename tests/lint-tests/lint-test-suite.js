/**
 * Lint Test Suite
 * 
 * This file contains code examples that intentionally violate various linting rules
 * to demonstrate how ESLint catches and reports issues.
 * 
 * RUN WITH: pnpm eslint tests/lint-tests/lint-test-suite.js
 * 
 * RULE CATEGORIES TESTED:
 * 1. Formatting rules (indentation, spacing)
 * 2. JSDoc documentation rules
 * 3. Spacing between functions
 */

// SECTION 1: JSDoc Tests

// Missing JSDoc (should trigger jsdoc/require-jsdoc)
function missingJsDocFunction() {
  return "This function has no JSDoc";
}

// Empty JSDoc (should trigger jsdoc warnings)
/**
 */
function emptyJsDocFunction() {
  return "This function has empty JSDoc";
}

// Incomplete JSDoc (missing @returns)
/**
 * This function returns a string but doesn't document it
 */
function incompleteJsDocFunction() {
  return "Missing @returns tag";
}

// Proper JSDoc (should pass)
/**
 * This function has proper JSDoc documentation
 * @param {string} name - The name to greet
 * @returns {string} A greeting message
 */
function properJsDocFunction(name) {
  return `Hello, ${name}!`;
}

// SECTION 2: Formatting Tests

// Bad indentation (using spaces instead of tabs)
function badIndentation() {
    const test = "indented with spaces"; // 4 spaces
    if (test) {
        console.log(test);    // 8 spaces
    }
}

// Bad spacing (extra blank lines within function)
function extraBlankLines() {

  const x = 1;

  const y = 2;
  
  return x + y;
}

// SECTION 3: Function Spacing Tests

// These functions are missing the required blank line between them
/**
 * First consecutive function
 */
function firstFunction() {
  return "First";
}
/**
 * Second consecutive function with no blank line in between
 */
function secondFunction() {
  return "Second";
} 