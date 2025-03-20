/* eslint-disable */
// TEST FILE: Demonstrates JSDoc linting rules
// To see errors: pnpm eslint tests/lint-tests/test-jsdoc.js

// Example 1: Missing JSDoc content (empty JSDoc block)
/* eslint-enable jsdoc/require-jsdoc */
/**
 *
 */
function missingJsDoc() {
	console.log("This function is missing JSDoc content");
}

// Example 2: Another function with empty JSDoc
/**
 *
 */
function anotherMissingJsDoc() {
	return "Also missing JSDoc content";
}

// Example 3: Proper JSDoc (should pass linting)
/**
 * This function has proper JSDoc
 * @returns {string} A greeting message
 */
function hasJsDoc() {
	return "Hello, world!";
}

// Example 4: Testing spacing between functions
/**
 * Function 1
 */
function function1() {
	return "First function";
}

/* eslint-disable padding-line-between-statements */
// This should trigger a warning about missing blank line between functions
/**
 * Function 2 - should warn about missing blank line
 */
function function2() {
	return "Second function";
}
/* eslint-enable */

// To run test: pnpm eslint tests/lint-tests/test-jsdoc.js 