'use strict';

// Use dynamic import instead of require
// Define which scopes should be ignored for versioning
const IGNORED_SCOPES = ['pipeline'];

module.exports = async () => {
  // Dynamically import the conventionalcommits preset
  const { default: conventionalConfig } = await import('conventional-changelog-conventionalcommits');
  
  return {
    name: 'mypreset',
    recommendedBumpOpts: {
      preset: {
        name: 'conventionalcommits',
        types: [
          { type: 'feat', section: 'Features', hidden: false },
          { type: 'fix', section: 'Bug Fixes', hidden: false },
          { type: 'docs', section: 'Documentation', hidden: false },
          { type: 'style', section: 'Styles', hidden: false },
          { type: 'refactor', section: 'Code Refactoring', hidden: false },
          { type: 'perf', section: 'Performance Improvements', hidden: false },
          { type: 'test', section: 'Tests', hidden: false },
          { type: 'build', section: 'Build System', hidden: false },
          { type: 'ci', section: 'Continuous Integration', hidden: false },
          { type: 'chore', section: 'Chores', hidden: false },
          { type: 'slice', section: 'Slices', hidden: false }
        ]
      },
      parserOpts: {
        noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING']
      },
      whatBump: (commits) => {
        let level = 2; // Default to patch level
        let breaking = 0;
        let features = 0;
        let slices = 0;
        let hasNonIgnoredCommits = false;

        commits.forEach(commit => {
          // Skip commits with ignored scopes
          if (IGNORED_SCOPES.includes(commit.scope)) {
            return;
          }

          // Mark that we have at least one non-ignored commit
          hasNonIgnoredCommits = true;

          if (commit.notes.length > 0) {
            breaking += commit.notes.length;
            level = 0; // Major
          } else if (commit.type === 'feat') {
            features += 1;
            if (level > 1) level = 1; // Minor
          } else if (commit.type === 'slice') {
            slices += 1;
            if (level > 2) level = 2; // Patch
          }
        });

        // If all commits were in the ignored scopes, don't bump version
        if (!hasNonIgnoredCommits) {
          return null;
        }

        return {
          level: level,
          reason: breaking 
            ? `There ${breaking === 1 ? 'is' : 'are'} ${breaking} BREAKING CHANGE${breaking === 1 ? '' : 'S'}`
            : features 
              ? `There ${features === 1 ? 'is' : 'are'} ${features} new feature${features === 1 ? '' : 's'}`
              : slices
                ? `There ${slices === 1 ? 'is' : 'are'} ${slices} slice ${slices === 1 ? 'change' : 'changes'}`
                : 'There are only fixes, chores, or other non-API changes'
        };
      }
    }
  };
}; 