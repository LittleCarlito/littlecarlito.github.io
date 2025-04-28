#!/usr/bin/env node

/**
 * This script analyzes the commits in a PR to determine which packages would be bumped
 * when merged to main. It's used to give feedback in PR descriptions about upcoming
 * version changes.
 * 
 * Usage:
 * node check-version-changes.js <pr-number>
 * 
 * Output:
 * JSON object with package names and their bump types
 */

const { execSync } = require('child_process');

// Configuration
const PACKAGES = ['blorkpack', 'blorktools', 'blorkboard'];
const APPS = ['portfolio'];
const ALL_PROJECTS = [...PACKAGES, ...APPS];
const IGNORE_SCOPES = ['pipeline'];

// Get PR number from arguments
const prNumber = process.argv[2];

if (!prNumber) {
  console.error('Please provide a PR number');
  process.exit(1);
}

// Get the base and head references for the PR
let prDetails;
let baseRef, headRef, commits = [];

try {
  console.log(`Fetching PR #${prNumber} details using GitHub CLI...`);
  const prOutput = execSync(`gh pr view ${prNumber} --json baseRefName,headRefName,commits`).toString();
  prDetails = JSON.parse(prOutput);
  
  baseRef = prDetails.baseRefName;
  headRef = prDetails.headRefName;
  commits = prDetails.commits || [];
  
  console.log(`PR #${prNumber} is from ${headRef} to ${baseRef} with ${commits.length} commits.`);
  
  // If no commits were returned by GitHub CLI, fall back to git
  if (commits.length === 0) {
    console.log('No commits returned by GitHub CLI. Falling back to git...');
    throw new Error('No commits in GitHub CLI response');
  }
} catch (error) {
  console.error(`Error or incomplete data from GitHub CLI: ${error.message}`);
  console.log('Falling back to git commands to get commit information...');
  
  try {
    // Get base and head refs from git if not already set
    if (!baseRef || !headRef) {
      console.log('Getting PR base and head refs...');
      // Try to get PR details with just the basic info (no commits)
      const basicPrOutput = execSync(`gh pr view ${prNumber} --json baseRefName,headRefName`).toString();
      const basicPrDetails = JSON.parse(basicPrOutput);
      
      baseRef = basicPrDetails.baseRefName;
      headRef = basicPrDetails.headRefName;
    }
    
    console.log(`Using git to get commits between ${baseRef} and ${headRef}...`);
    
    // Ensure we have both branches
    execSync(`git fetch origin ${baseRef}:refs/remotes/origin/${baseRef}`);
    execSync(`git fetch origin ${headRef}:refs/remotes/origin/${headRef}`);
    
    // Get commit info using git log
    const commitShas = execSync(`git log origin/${baseRef}..origin/${headRef} --no-merges --format=%H`).toString().trim().split('\n');
    console.log(`Found ${commitShas.length} commits using git log.`);
    
    // Build the commits array in the same format as GitHub CLI would provide
    commits = [];
    
    for (const sha of commitShas) {
      if (!sha) continue;
      
      // Get the commit details
      const commitInfo = execSync(`git show --no-patch --format="%s%n%b" ${sha}`).toString().trim();
      const firstNewline = commitInfo.indexOf('\n');
      
      if (firstNewline === -1) {
        // Just a subject line, no body
        commits.push({
          oid: sha,
          messageHeadline: commitInfo,
          messageBody: ''
        });
      } else {
        // Extract subject and body
        commits.push({
          oid: sha,
          messageHeadline: commitInfo.substring(0, firstNewline),
          messageBody: commitInfo.substring(firstNewline + 1)
        });
      }
    }
    
    console.log(`Successfully processed ${commits.length} commits using git.`);
  } catch (gitError) {
    console.error(`Error using git fallback: ${gitError.message}`);
    console.error('Could not get commit information. Exiting.');
    process.exit(1);
  }
}

console.log(`Analyzing ${commits.length} commits between ${baseRef} and ${headRef} for PR #${prNumber}`);

// Extract commit messages with proper error handling
const commitMessages = commits.map(commit => {
  // Safely extract hash and messages
  const hash = commit.oid || '';
  const subject = commit.messageHeadline || '';
  const body = commit.messageBody || '';
  return { hash, subject, body };
});

// Parse commits to determine version bumps
const versionBumps = {};

ALL_PROJECTS.forEach(project => {
  versionBumps[project] = { major: 0, minor: 0, patch: 0 };
});

const commitRegex = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(([^)]+)\))?(!)?:\s(.+)$/;

commitMessages.forEach(commit => {
  const { subject, body } = commit;
  const match = subject.match(commitRegex);
  
  if (!match) {
    console.log(`Skipping commit with non-conventional format: ${subject}`);
    return;
  }
  
  const [, type, , rawScope, breaking, message] = match;
  
  // Check if commit has BREAKING CHANGE in body
  const hasBreakingChange = breaking || body.includes('BREAKING CHANGE:');
  
  // Determine which bump type this commit corresponds to
  let bumpType = 'none';
  if (hasBreakingChange) {
    bumpType = 'major';
  } else if (type === 'feat') {
    bumpType = 'minor';
  } else if (type === 'fix' || type === 'perf') {
    bumpType = 'patch';
  }
  
  if (bumpType === 'none') {
    return;
  }
  
  // Determine affected projects
  let affectedProjects = [];
  
  if (rawScope) {
    const scope = rawScope.trim();
    
    // Skip ignored scopes
    if (IGNORE_SCOPES.includes(scope)) {
      return;
    }
    
    // Check if scope is a valid project
    if (ALL_PROJECTS.includes(scope)) {
      affectedProjects = [scope];
    } else {
      return;
    }
  } else {
    // No scope means all projects are affected
    affectedProjects = ALL_PROJECTS;
  }
  
  // Record the bump for each affected project
  affectedProjects.forEach(project => {
    versionBumps[project][bumpType]++;
  });
});

// Determine the highest bump type for each project
const finalBumps = {};

ALL_PROJECTS.forEach(project => {
  const { major, minor, patch } = versionBumps[project];
  
  if (major > 0) {
    finalBumps[project] = 'major';
  } else if (minor > 0) {
    finalBumps[project] = 'minor';
  } else if (patch > 0) {
    finalBumps[project] = 'patch';
  } else {
    finalBumps[project] = null;
  }
});

// Format output for PR description
const packageNames = {
  blorkpack: '@littlecarlito/blorkpack',
  blorktools: '@littlecarlito/blorktools',
  blorkboard: '@littlecarlito/blorkboard',
  portfolio: '@littlecarlito/portfolio'
};

const bumpEmojis = {
  major: '🚨 MAJOR',
  minor: '✨ MINOR',
  patch: '🐛 PATCH'
};

let output = '';

if (Object.values(finalBumps).every(bump => bump === null)) {
  output = 'No version changes detected from commit messages';
} else {
  output = '## Version Changes\n\nThis PR will trigger the following version bumps when merged:\n\n';
  
  // Show packages with changes first, grouped by bump type
  ['major', 'minor', 'patch'].forEach(bumpType => {
    const packagesWithBump = Object.entries(finalBumps)
      .filter(([, bump]) => bump === bumpType)
      .map(([project]) => packageNames[project]);
    
    if (packagesWithBump.length > 0) {
      output += `${bumpEmojis[bumpType]}: ${packagesWithBump.join(', ')}\n`;
    }
  });
  
  // Show packages with no changes
  const unchangedPackages = Object.entries(finalBumps)
    .filter(([, bump]) => bump === null)
    .map(([project]) => packageNames[project]);
  
  if (unchangedPackages.length > 0) {
    output += `\n⏹️ NO CHANGE: ${unchangedPackages.join(', ')}\n`;
  }
}

// Also output structured data for GitHub Actions
const structuredOutput = {
  hasChanges: !Object.values(finalBumps).every(bump => bump === null),
  changes: Object.entries(finalBumps)
    .filter(([, bump]) => bump !== null)
    .reduce((acc, [project, bump]) => {
      acc[packageNames[project]] = bump;
      return acc;
    }, {})
};

// Write both formats
console.log(output);
console.log('\n---\n');
console.log(JSON.stringify(structuredOutput, null, 2)); 