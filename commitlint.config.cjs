const fs = require('fs');

// Define allowed types in a single place
const allowedTypes = [
  'build', 'chore', 'ci', 'docs', 'feat', 'fix', 
  'perf', 'refactor', 'revert', 'style', 'test', 'slice'
];

// Types that trigger version bumps (subset of allowed types)
const versioningTypes = ['feat', 'fix', 'perf', 'slice'];

// Write types to files that shell scripts can read
fs.writeFileSync('.husky/.commit-types', allowedTypes.join(' '));
fs.writeFileSync('.husky/.versioning-types', versioningTypes.join(' '));

module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Removed all custom version/release rules
  rules: {
    'type-enum': [2, 'always', allowedTypes]
  }
};
