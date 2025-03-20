import js from '@eslint/js';
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
		rules: {
			...Object.fromEntries(
				Object.entries(js.configs.recommended.rules || {}).map(([key]) => [key, 'off'])
			),
			// Tab indentation rule
			'indent': ['error', 'tab'],
			// Prevent blank lines at the beginning or end of blocks
			'padded-blocks': ['error', 'never'],
			// Prevent consecutive empty lines (max 0 means no empty lines allowed)
			'no-multiple-empty-lines': ['error', { 'max': 0, 'maxBOF': 0, 'maxEOF': 1 }],
		},
	},
	// Deliberately using spaces for testing
];
const deliberateError = "This line has spaces instead of tabs";
// This function has deliberate indentation errors
function badlyIndentedFunction() {
	// These lines use spaces not tabs
	const test = "bad indentation";
	if (test) {
		console.log("This is indented with spaces");
	}
} 