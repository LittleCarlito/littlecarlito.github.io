/**
 * Root Jest configuration for the monorepo
 */
module.exports = {
	rootDir: '../../..',
	testEnvironment: 'jsdom',
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './tests/config/jest/babel.config.cjs' }],
		'^.+\\.(yml|yaml)$': '<rootDir>/tests/config/transformers/yaml-transformer.cjs',
		'^.+\\.sh$': '<rootDir>/tests/config/transformers/shell-transformer.cjs'
	},
	setupFilesAfterEnv: ['<rootDir>/tests/config/setup/jest.setup.cjs'],
	testMatch: [
		'<rootDir>/tests/**/*.test.js',
		'<rootDir>/tests/**/*-test.js',
		'<rootDir>/packages/**/src/test/**/*.js'
	],
	testPathIgnorePatterns: [
		'/node_modules/',
		'/dist/',
		'packages/blorkpack/src/test/__mocks__/',
		'tests/lint-tests/',
		// Ignore ESM files that use import.meta.url syntax
		'tests/apps/portfolio/environment/gh-pages-texture-test.js',
		'tests/apps/portfolio/gh-pages-simulator.js'
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
	globalSetup: '<rootDir>/tests/config/setup/prepare-tests.cjs',
	// Add verbose module reporting to help debug issues
	verbose: true,
	// Configure coverage settings
	coverageDirectory: '<rootDir>/coverage',
	collectCoverageFrom: [
		'packages/*/src/**/*.js',
		'.github/**/*',
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