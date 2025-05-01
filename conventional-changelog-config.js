'use strict';

const conventionalCommitsConfig = require('conventional-changelog-conventionalcommits');

module.exports = async function customConventionalConfig(config) {
  const conventionalConfig = await conventionalCommitsConfig(config);
  
  // The default recommended bump for slice commits is patch
  conventionalConfig.recommendedBumpOpts.parserOpts.noteKeywords = [
    ...conventionalConfig.recommendedBumpOpts.parserOpts.noteKeywords,
    'SLICE'
  ];
  
  // Define custom rules for "slice" commit type
  conventionalConfig.recommendedBumpOpts.whatBump = (commits) => {
    let level = 2; // Default to patch level
    let breakingChange = false;
    let features = false;
    
    commits.forEach(commit => {
      if (commit.notes.length > 0) {
        breakingChange = true;
        level = 0; // Major
      } else if (commit.type === 'feat') {
        features = true;
        level = 1; // Minor
      } else if (commit.type === 'slice') {
        // Treat slice as patch (level 2)
        level = Math.min(level, 2);
      }
    });
    
    return {
      level: level,
      reason: breakingChange 
        ? 'There are breaking changes'
        : features 
          ? 'There are new features'
          : 'There are patches or slice updates'
    };
  };
  
  return conventionalConfig;
}; 