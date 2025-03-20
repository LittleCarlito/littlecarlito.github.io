// This file has functions without JSDoc comments
/**
 *
 */
function missingJsDoc() {
	console.log("This function is missing JSDoc");
}

/**
 *
 */
function anotherMissingJsDoc() {
	return "Also missing JSDoc";
}

// This one has JSDoc
/**
 * This function has proper JSDoc
 * @returns {string} A greeting message
 */
function hasJsDoc() {
	return "Hello, world!";
}

// Testing spacing between functions
/**
 * Function 1
 */
function function1() {
	return "First function";
}

/**
 * Function 2 - should warn about missing blank line
 */
function function2() {
	return "Second function";
}
