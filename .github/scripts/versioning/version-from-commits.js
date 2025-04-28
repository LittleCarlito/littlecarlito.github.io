#!/usr/bin/env node

/**
 * This script parses commit messages between the latest version tag and current HEAD
 * to automatically generate changesets for versioning packages based on conventional commits.
 * 
 * Commit format: 
 * <type>[(scope)]: <message>
 * 
 * Types that trigger version changes:
 * - feat: minor bump
 * - fix: patch bump
 * - perf: patch bump
 * - slice: patch bump
 * - feat!: or any type with "BREAKING CHANGE:" in the body: major bump
 * 
 * If no scope is specified, all packages are bumped.
 * If a scope is specified, only that package is bumped.
 * A scope of "pipeline" is ignored.
 * 
 * This script ACCUMULATES version changes across all commits chronologically.
 * 
 * Usage:
 * node version-from-commits.js [--dry-run] [--from=<ref>] [--to=<ref>]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PACKAGES = ['blorkpack', 'blorktools', 'blorkboard'];
const APPS = ['portfolio'];
const ALL_PROJECTS = [...PACKAGES, ...APPS];
const IGNORE_SCOPES = ['pipeline'];

// CLI arguments
const DRY_RUN = process.argv.includes('--dry-run');
const fromArg = process.argv.find(arg => arg.startsWith('--from='));
const toArg = process.argv.find(arg => arg.startsWith('--to='));

// Get from and to refs
let fromRef = fromArg ? fromArg.split('=')[1] : null;
let toRef = toArg ? toArg.split('=')[1] : 'HEAD';

console.log(`Analyzing commits from ${fromRef || 'beginning'} to ${toRef}`);

// Get all commits between the refs
const gitLogCommand = `git log ${fromRef ? `${fromRef}..` : ''}${toRef} --pretty=format:"%H|||%s|||%b|||%at" --no-merges`;
let commitsOutput;
try {
  commitsOutput = execSync(gitLogCommand).toString().trim();
} catch (error) {
  console.error(`Error executing git log command: ${error.message}`);
  process.exit(1);
}

if (!commitsOutput) {
  console.log('No commits found to analyze');
  process.exit(0);
}

const commits = commitsOutput.split('\n').map(line => {
  // Handle potential malformed commit messages with a more robust separator
  const parts = line.split('|||');
  const hash = parts[0] || '';
  const subject = parts[1] || '';
  const body = parts[2] || '';
  const timestamp = parseInt(parts[3] || '0', 10);
  return { hash, subject, body, timestamp };
});

// Sort commits by timestamp (oldest first to process chronologically)
commits.sort((a, b) => a.timestamp - b.timestamp);

console.log(`Found ${commits.length} commits to analyze (ordered chronologically)`);

// Get initial versions for each project
const accumulatedVersions = {};

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
ALL_PROJECTS.forEach(project => {
  accumulatedVersions[project] = getCurrentVersion(project);
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
commits.forEach(commit => {
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

// ANSI color codes
const BLUE = '\u001b[34m';
const GREEN = '\u001b[32m';
const RESET = '\u001b[0m';

// Show final version changes
const initialVersions = {};
ALL_PROJECTS.forEach(project => {
  initialVersions[project] = getCurrentVersion(project);
});

// Output final accumulated version changes
let hasChanges = false;
ALL_PROJECTS.forEach(project => {
  const initialVersion = initialVersions[project];
  const finalVersion = accumulatedVersions[project];
  
  if (initialVersion !== finalVersion) {
    hasChanges = true;
    const incrementCount = versionProgressions[project].length - 1; // Subtract 1 for the initial entry
    const emphasisMark = incrementCount > 30 ? '!' : ''; // Add emphasis for large increment counts
    console.error(`${project}: ${BLUE}${initialVersion}${RESET} → ${GREEN}${finalVersion}${RESET} (${incrementCount} increments${emphasisMark})`);
  }
});

if (!hasChanges) {
  console.log('No version changes detected');
  process.exit(0);
}

// In dry run mode, print detailed version progression and exit
if (DRY_RUN) {
  console.log('\nDetailed Version Progression:');
  ALL_PROJECTS.forEach(project => {
    if (versionProgressions[project].length > 1) { // Only show projects with changes
      console.log(`\n${project}:`);
      versionProgressions[project].forEach((entry, index) => {
        const prefix = index === 0 ? 'Initial:' : `Step ${index}:`;
        const commitInfo = entry.commit === 'Initial' ? '' : ` [${entry.commit}: ${entry.message}]`;
        const bumpInfo = entry.bumpType ? ` (${entry.bumpType})` : '';
        console.log(`${prefix} ${entry.version}${bumpInfo}${commitInfo}`);
      });
    }
  });
  
  console.log('\nDRY RUN: No changesets were created');
  process.exit(0);
}

// Create the .changeset directory if it doesn't exist
const changesetDir = path.join(process.cwd(), '.changeset');
if (!fs.existsSync(changesetDir)) {
  fs.mkdirSync(changesetDir, { recursive: true });
}

// Helper function to get package names from project keys
function getPackageName(project) {
  return `@littlecarlito/${project}`;
}

// Create changesets for the final accumulated versions
const changesets = [];

// Determine the bump type based on version difference
function determineBumpType(initialVersion, finalVersion) {
  const [initialMajor, initialMinor, initialPatch] = initialVersion.split('.').map(Number);
  const [finalMajor, finalMinor, finalPatch] = finalVersion.split('.').map(Number);
  
  if (finalMajor > initialMajor) {
    return 'major';
  } else if (finalMinor > initialMinor) {
    return 'minor';
  } else if (finalPatch > initialPatch) {
    return 'patch';
  }
  return null;
}

// For each project that has a version change, create a changeset
ALL_PROJECTS.forEach(project => {
  const initialVersion = initialVersions[project];
  const finalVersion = accumulatedVersions[project];
  
  if (initialVersion === finalVersion) {
    return; // No change for this project
  }
  
  const bumpType = determineBumpType(initialVersion, finalVersion);
  if (!bumpType) {
    return; // Should not happen, but just in case
  }
  
  const changesetId = `version-${project}-${bumpType}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const packageName = getPackageName(project);
  
  const changesetContent = {
    packageName,
    type: bumpType,
    initialVersion,
    finalVersion
  };
  
  changesets.push({ id: changesetId, content: changesetContent });
});

// Create changeset files
changesets.forEach(({ id, content }) => {
  const changesetPath = path.join(changesetDir, `${id}.md`);
  
  const changesetContent = `---
"${content.packageName}": ${content.type}
---

Accumulated changes from ${content.initialVersion} to ${content.finalVersion}
Generated from commit history between ${fromRef || 'beginning'} and ${toRef}
`;
  
  fs.writeFileSync(changesetPath, changesetContent);
  console.log(`Created changeset: ${id}`);
});

console.log(`\nCreated ${changesets.length} changesets based on accumulated version changes`);
console.log('Run "pnpm changeset version" to apply these changes to package.json files'); 