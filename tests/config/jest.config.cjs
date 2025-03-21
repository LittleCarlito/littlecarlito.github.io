/**
 * Root Jest configuration for the monorepo
 */
module.exports = {
	rootDir: '../..',
	testEnvironment: 'jsdom',
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './tests/config/babel.config.cjs' }]
	},
	setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.cjs'],
	testMatch: [
		'<rootDir>/tests/**/*.test.js',
		'<rootDir>/tests/**/*-test.js',
		'<rootDir>/packages/**/src/test/**/*.js'
	],
	testPathIgnorePatterns: [
		'/node_modules/',
		'/dist/',
		'packages/blorkpack/src/test/__mocks__/',
		'tests/lint-tests/'
	],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
		// Simplify the mapping to ensure it works on all platforms
		'@littlecarlito/blorkpack': '<rootDir>/packages/blorkpack/dist/index.js',
		'@littlecarlito/blorkpack/(.*)': '<rootDir>/packages/blorkpack/dist/index.js',
		'packages/blorkpack/src/(.*)': '<rootDir>/packages/blorkpack/src/$1',
		'../dist/index.js': '<rootDir>/packages/blorkpack/dist/index.js'
	},
	modulePaths: ['<rootDir>'],
	moduleDirectories: ['node_modules', '<rootDir>'],
	// Use our custom preparation script before running tests
	globalSetup: '<rootDir>/tests/config/prepare-tests.cjs',
	// Add verbose module reporting to help debug issues
	verbose: true,
	// Configure coverage settings
	coverageDirectory: '<rootDir>/coverage',
	collectCoverageFrom: [
		'packages/*/src/**/*.js',
		'!packages/*/src/test/**',
		'!packages/*/dist/**',
		'!**/node_modules/**'
	],
	coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
	// Add JUnit reporter for CI integration
	reporters: [
		'default',
		['jest-junit', {
			outputDirectory: '<rootDir>/pipeline-artifacts/test-reports',
			outputName: 'junit.xml'
		}]
	]
}; 