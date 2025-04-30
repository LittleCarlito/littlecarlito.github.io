const fs = require('fs');

// Define allowed types
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
  rules: {
    'type-enum': [2, 'always', allowedTypes],
    'type-case': [2, 'always', 'lowercase'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lowercase'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72]
  },
  ignorePatterns: [
    // List of patterns to ignore (if needed)
  ],
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint'
};
