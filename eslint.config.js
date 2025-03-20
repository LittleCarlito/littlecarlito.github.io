import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
	// Empty config with no rules enabled
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'build/**',
			'coverage/**',
			'.turbo/**',
		],
		linterOptions: {
			reportUnusedDisableDirectives: 'off',
		},
	},
	// JavaScript base config with all rules disabled
	{
		files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
		...js.configs.recommended,
		plugins: {
			jsdoc: jsdoc,
		},
		rules: {
			...Object.fromEntries(
				Object.entries(js.configs.recommended.rules || {}).map(([key]) => [key, 'off'])
			),
			// Tab indentation rule
			'indent': ['error', 'tab'],
			// Prevent blank lines at the beginning or end of blocks
			'padded-blocks': ['error', 'never'],
			// Modified: Allow exactly one blank line between functions but none within functions
			'no-multiple-empty-lines': ['error', { 'max': 1, 'maxBOF': 0, 'maxEOF': 1 }],
			// Require padding lines between statements (especially functions)
			'padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: 'function', next: '*' }, // Require blank line after function
				{ blankLine: 'always', prev: '*', next: 'function' }, // Require blank line before function (except first line)
			],
			// Require JSDoc documentation for all functions
			'jsdoc/require-jsdoc': ['error', {
				publicOnly: false,
				require: {
					FunctionDeclaration: true,
					MethodDefinition: true,
					ClassDeclaration: true,
					ArrowFunctionExpression: false,
					FunctionExpression: false,
				},
			}],
		},
	},
]; 