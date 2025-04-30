const fs = require('fs');

// Define allowed types in a single place
const allowedTypes = [
  'build', 'chore', 'ci', 'docs', 'feat', 'fix', 
  'perf', 'refactor', 'revert', 'style', 'test', 'slice'
];

// Types that trigger version bumps (subset of allowed types)
const versioningTypes = ['feat', 'fix', 'perf', 'slice'];

// Scopes that should be ignored for versioning
const ignoredScopes = ['pipeline'];

// Write types to files that shell scripts can read
fs.writeFileSync('.husky/.commit-types', allowedTypes.join(' '));
fs.writeFileSync('.husky/.versioning-types', versioningTypes.join(' '));
fs.writeFileSync('.husky/.ignore-scopes', ignoredScopes.join(' '));

module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Removed all custom version/release rules
  rules: {
    'type-enum': [2, 'always', allowedTypes]
  },
  ignorePatterns: [
    // List of patterns to ignore (if needed)
  ],
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint'
};
