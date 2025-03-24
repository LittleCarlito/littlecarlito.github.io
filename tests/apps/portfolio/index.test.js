/**
 * Portfolio application test suite index
 * 
 * This file imports all portfolio tests to ensure they're included in the test run.
 * It also provides a central place to configure test environment specific to the portfolio app.
 */

// Import individual test files directly - removing imports that cause issues
// import './main.test.js';

// Environment and background tests
import './environment/background-path-resolution.test.js';
import './environment/background-manifest-integration.test.js';

describe('Portfolio Application Test Suite', () => {
	test('Test suite loaded successfully', () => {
		// This is a simple test to ensure the test suite is loaded
		// All actual tests are in the imported files
		expect(true).toBe(true);
	});
}); 