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
 * - feat!: or any type with "BREAKING CHANGE:" in the body: major bump
 * 
 * If no scope is specified, all packages are bumped.
 * If a scope is specified, only that package is bumped.
 * A scope of "pipeline" is ignored.
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
const gitLogCommand = `git log ${fromRef ? `${fromRef}..` : ''}${toRef} --pretty=format:"%H|||%s|||%b" --no-merges`;
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
  return { hash, subject, body };
});

console.log(`Found ${commits.length} commits to analyze`);

// Parse commits to determine version bumps
const versionBumps = {};

ALL_PROJECTS.forEach(project => {
  versionBumps[project] = { major: 0, minor: 0, patch: 0 };
});

const commitRegex = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(([^)]+)\))?(!)?:\s(.+)$/;

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
  } else if (type === 'fix' || type === 'perf') {
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
  
  // Record the bump for each affected project
  affectedProjects.forEach(project => {
    versionBumps[project][bumpType]++;
    console.log(`Project ${project}: ${bumpType} bump due to commit: ${subject}`);
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
    // No changes for this project
    finalBumps[project] = null;
  }
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

// ANSI color codes
const BLUE = '\u001b[34m';
const GREEN = '\u001b[32m';
const RESET = '\u001b[0m';

// Generate changesets
if (Object.values(finalBumps).every(bump => bump === null)) {
  console.log('No version changes detected');
  process.exit(0);
}

// Remove the raw bump display and only show formatted version changes
// Output version changes to stderr so husky can capture them
Object.entries(finalBumps).forEach(([project, bump]) => {
  if (bump) {
    const currentVersion = getCurrentVersion(project);
    const newVersion = calculateNewVersion(currentVersion, bump);
    
    // Use stderr for husky to capture, with cleaner formatting
    console.error(`${project}: ${BLUE}${currentVersion}${RESET} → ${GREEN}${newVersion}${RESET}`);
  }
});

// In dry run mode, just print the notice and exit
if (DRY_RUN) {
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

// Group bumps by type for creating changesets
const changesets = [];

// For each project that needs a bump, create a changeset
Object.entries(finalBumps).forEach(([project, bump]) => {
  if (!bump) return;
  
  const changesetId = `version-${project}-${bump}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const packageName = getPackageName(project);
  
  const changesetContent = {
    packageName,
    type: bump
  };
  
  changesets.push({ id: changesetId, content: changesetContent });
});

// Create changeset files
changesets.forEach(({ id, content }) => {
  const changesetPath = path.join(changesetDir, `${id}.md`);
  
  const changesetContent = `---
"${content.packageName}": ${content.type}
---

Generated from commit history between ${fromRef || 'beginning'} and ${toRef}
`;
  
  fs.writeFileSync(changesetPath, changesetContent);
  console.log(`Created changeset: ${id}`);
});

console.log(`\nCreated ${changesets.length} changesets based on commit history`);
console.log('Run "pnpm changeset version" to apply these changes to package.json files'); 