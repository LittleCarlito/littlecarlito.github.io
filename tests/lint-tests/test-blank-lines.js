/* eslint-disable */
// TEST FILE: Demonstrates blank line linting rules
// To see errors: pnpm eslint tests/lint-tests/test-blank-lines.js

// Example 1: Blank lines within function (should trigger no-multiple-empty-lines rule)
/* eslint-enable no-multiple-empty-lines */
/**
 * Function with extra blank lines that should trigger errors
 */
function functionWithBlankLines() {
	const test = "has blank line at beginning";
	if (test) {
		console.log(test);
	}
}

// Example 2: Another function with blank lines in the middle
/**
 * Function with blank lines in the middle
 */
function anotherFunction() {
	const x = 1;
	const y = 2;
	// Blank line above
	const z = x + y;
	// Another blank line above
	return z;
}

// Example 3: Properly formatted function (should pass)
/**
 * Properly formatted function without extra blank lines
 */
function properFunction() {
	const value = "proper formatting";
	return value;
}

// To run test: pnpm eslint tests/lint-tests/test-blank-lines.js 