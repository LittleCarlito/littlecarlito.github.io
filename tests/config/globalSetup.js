/**
 * Global setup file for Jest
 * Creates necessary directories for tests
 */
const fs = require('fs');
const path = require('path');

module.exports = async () => {
	// Create lint-tests directory if it doesn't exist
	const lintTestsDir = path.join(process.cwd(), 'tests/lint-tests');
	if (!fs.existsSync(lintTestsDir)) {
		console.log(`Creating directory: ${lintTestsDir}`);
		fs.mkdirSync(lintTestsDir, { recursive: true });
	}
}; 