/**
 * Pipeline Script Tests Index
 * 
 * This file exports all pipeline script-related tests to make it easier to run them as a group.
 * To run all pipeline script tests: npm test -- tests/repository-tests/pipeline_scripts
 */

// Export test files to allow importing from one location
export * from './github-scripts.test.js';
export * from './special-characters.test.js';
export * from './stream-separation.test.js';
export * from './validate-checks.test.js';
export * from './wait-checks.test.js';
export * from './script-binary-check.test.js';

// Export default object with test paths for programmatic usage
export default {
	GITHUB_SCRIPTS: './github-scripts.test.js',
	SPECIAL_CHARACTERS: './special-characters.test.js',
	STREAM_SEPARATION: './stream-separation.test.js',
	VALIDATE_CHECKS: './validate-checks.test.js',
	WAIT_CHECKS: './wait-checks.test.js',
	SCRIPT_BINARY_CHECK: './script-binary-check.test.js'
}; 