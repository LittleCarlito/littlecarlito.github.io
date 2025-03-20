/* eslint-disable */
// TEST FILE: Demonstrates indentation linting rules
// To see errors: pnpm eslint tests/lint-tests/test-error.js

// Example 1: Indentation with spaces instead of tabs
/* eslint-enable indent */
/**
 * Function with incorrect indentation (spaces instead of tabs)
 */
function badlyIndentedFunction() {
	// These lines use spaces not tabs
	const test = "bad indentation";
	if (test) {
		console.log("This is indented with spaces");
	}
}

// Example 2: Properly indented function (with tabs)
/**
 * Function with correct indentation (tabs)
 */
function properlyIndentedFunction() {
	// These lines use tabs as required
	const test = "good indentation";
	if (test) {
		console.log("This is indented with tabs");
	}
}

// To run test: pnpm eslint tests/lint-tests/test-error.js 