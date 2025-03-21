import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';

// Custom rule to prevent unnecessary dynamic imports with await
const noUnnecessaryDynamicImports = {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow unnecessary dynamic imports with await',
			category: 'Best Practices',
			recommended: true,
		}
	},
	create(context) {
		return {
			// Look for dynamic import expressions inside await
			'AwaitExpression > ImportExpression'(node) {
				const importSource = node.source.value;
				
				// Skip if the import path contains a variable or expression
				if (!importSource || typeof importSource !== 'string') {
					return;
				}
				
				// Check if the import is within a function or method
				let parent = node.parent;
				let insideFunction = false;
				
				while (parent) {
					if (
						parent.type === 'FunctionDeclaration' ||
						parent.type === 'FunctionExpression' ||
						parent.type === 'ArrowFunctionExpression' ||
						parent.type === 'MethodDefinition'
					) {
						insideFunction = true;
						break;
					}
					parent = parent.parent;
				}
				
				// If it's a static import path and not in a condition/loop, it could be moved to top-level
				if (insideFunction) {
					// Report the issue
					context.report({
						node,
						message: `Unnecessary dynamic import with await for '${importSource}'. Consider using static import at the top of the file instead if this module is always required.`
					});
				}
			}
		};
	}
};

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
			custom: {
				rules: {
					'no-unnecessary-dynamic-imports': noUnnecessaryDynamicImports
				}
			}
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
			// Apply our custom rule
			'custom/no-unnecessary-dynamic-imports': 'error',
		},
	},
]; 