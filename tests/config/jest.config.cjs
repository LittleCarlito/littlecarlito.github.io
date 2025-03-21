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
		'^@littlecarlito/blorkpack$': '<rootDir>/packages/blorkpack/dist/index.js',
		'^@littlecarlito/blorkpack/(.*)$': '<rootDir>/packages/blorkpack/dist/$1.js',
		'^packages/blorkpack/src/(.*)$': '<rootDir>/packages/blorkpack/src/$1',
		'^../dist/index.js$': '<rootDir>/packages/blorkpack/dist/index.js'
	},
	modulePaths: ['<rootDir>'],
	moduleDirectories: ['node_modules', '<rootDir>'],
	// Create test directories if they don't exist
	globalSetup: './tests/config/globalSetup.js'
}; 