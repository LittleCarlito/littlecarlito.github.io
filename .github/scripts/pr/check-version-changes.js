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
const path = require('path');
const fs = require('fs');

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

// Function to get the current version of a package
function getCurrentVersion(project) {
  try {
    const packageJsonPath = path.join(
      process.cwd(), 
      project === 'portfolio' ? 'apps/portfolio' : `packages/${project}`,
      'package.json'
    );
    
    if (!fs.existsSync(packageJsonPath)) {
      console.error(`Package.json not found for ${project} at ${packageJsonPath}`);
      return '0.0.0';
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '0.0.0';
  } catch (error) {
    console.error(`Error reading version for ${project}:`, error.message);
    return '0.0.0';
  }
}

// Initialize accumulated versions with current versions
const accumulatedVersions = {};
const initialVersions = {};
ALL_PROJECTS.forEach(project => {
  const currentVersion = getCurrentVersion(project);
  accumulatedVersions[project] = currentVersion;
  initialVersions[project] = currentVersion;
});

// For logging the version progression
const versionProgressions = {};
ALL_PROJECTS.forEach(project => {
  versionProgressions[project] = [{
    version: accumulatedVersions[project],
    commit: 'Initial',
    message: 'Starting version'
  }];
});

const commitRegex = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert|slice)(\(([^)]+)\))?(!)?:\s(.+)$/;

// Function to calculate the new version based on the current version and bump type
function calculateNewVersion(currentVersion, bumpType) {
  if (!bumpType) return currentVersion;
  
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return currentVersion;
  }
}

// Process each commit sequentially and accumulate versions
commitMessages.forEach(commit => {
  const { hash, subject, body } = commit;
  
  // Skip if subject is undefined or empty
  if (!subject) {
    console.log(`Skipping commit ${hash.substring(0, 8)}: Invalid/empty commit message`);
    return;
  }
  
  const match = subject.match(commitRegex);
  
  if (!match) {
    console.log(`Skipping commit ${hash.substring(0, 8)} with non-conventional format: ${subject}`);
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
  } else if (type === 'fix' || type === 'perf' || type === 'slice') {
    bumpType = 'patch';
  }
  
  if (bumpType === 'none') {
    console.log(`Skipping commit with type ${type} (no version bump): ${subject}`);
    return;
  }
  
  // Determine affected projects
  let affectedProjects = [];
  
  if (rawScope) {
    const scope = rawScope.trim();
    
    // Skip ignored scopes
    if (IGNORE_SCOPES.includes(scope)) {
      console.log(`Ignoring commit with scope "${scope}": ${subject}`);
      return;
    }
    
    // Check if scope is a valid project
    if (ALL_PROJECTS.includes(scope)) {
      affectedProjects = [scope];
    } else {
      console.log(`Warning: Unknown scope "${scope}" in commit: ${subject}. Skipping.`);
      return;
    }
  } else {
    // No scope means all projects are affected
    affectedProjects = ALL_PROJECTS;
  }
  
  // Apply the version bump to each affected project
  affectedProjects.forEach(project => {
    const currentVersion = accumulatedVersions[project];
    const newVersion = calculateNewVersion(currentVersion, bumpType);
    
    // Update the accumulated version
    accumulatedVersions[project] = newVersion;
    
    console.log(`Project ${project}: ${currentVersion} → ${newVersion} (${bumpType} bump) due to commit: ${subject}`);
    
    // Record for version progression tracking
    versionProgressions[project].push({
      version: newVersion,
      commit: hash.substring(0, 8),
      message: subject,
      bumpType: bumpType
    });
  });
});

// Format output for PR description
const packageNames = {
  blorkpack: '@littlecarlito/blorkpack',
  blorktools: '@littlecarlito/blorktools',
  blorkboard: '@littlecarlito/blorkboard',
  portfolio: '@littlecarlito/portfolio'
};

let output = '';
let hasChanges = false;

// Output final accumulated version changes
ALL_PROJECTS.forEach(project => {
  const initialVersion = initialVersions[project];
  const finalVersion = accumulatedVersions[project];
  
  if (initialVersion !== finalVersion) {
    hasChanges = true;
  }
});

if (!hasChanges) {
  output = 'No version changes detected from commit messages';
} else {
  output = '## Version Changes\n\nThis PR will trigger the following version changes when merged:\n\n';
  
  ALL_PROJECTS.forEach(project => {
    const initialVersion = initialVersions[project];
    const finalVersion = accumulatedVersions[project];
    
    if (initialVersion !== finalVersion) {
      const incrementCount = versionProgressions[project].length - 1; // Subtract 1 for the initial entry
      const packageName = packageNames[project];
      let bumpType = '';
      
      if (finalVersion.split('.')[0] > initialVersion.split('.')[0]) {
        bumpType = '🚨 MAJOR';
      } else if (finalVersion.split('.')[1] > initialVersion.split('.')[1]) {
        bumpType = '✨ MINOR';
      } else {
        bumpType = '🐛 PATCH';
      }
      
      output += `${bumpType}: ${packageName}: ${initialVersion} → ${finalVersion} (${incrementCount} increments)\n`;
    }
  });
  
  // Show packages with no changes
  const unchangedPackages = ALL_PROJECTS
    .filter(project => initialVersions[project] === accumulatedVersions[project])
    .map(project => packageNames[project]);
  
  if (unchangedPackages.length > 0) {
    output += `\n⏹️ NO CHANGE: ${unchangedPackages.join(', ')}\n`;
  }
}

// Also output structured data for GitHub Actions
const structuredOutput = {
  hasChanges: hasChanges,
  changes: ALL_PROJECTS.reduce((acc, project) => {
    const initialVersion = initialVersions[project];
    const finalVersion = accumulatedVersions[project];
    
    if (initialVersion !== finalVersion) {
      acc[project] = {
        initialVersion,
        finalVersion,
        incrementCount: versionProgressions[project].length - 1
      };
    } else {
      acc[project] = null;
    }
    
    return acc;
  }, {})
};

// Output both the human-readable and structured formats
console.log(output);
console.log('---');
console.log(JSON.stringify(structuredOutput, null, 2)); 