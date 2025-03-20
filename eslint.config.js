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
    rules: Object.fromEntries(
      Object.entries(js.configs.recommended.rules || {}).map(([key]) => [key, 'off'])
    ),
  },
]; 