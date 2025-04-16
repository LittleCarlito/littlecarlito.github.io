#!/usr/bin/env node

/**
 * Test Version Merge Script
 * 
 * This script simulates what version changes would happen if the current branch
 * were merged into main. It uses the EXACT SAME logic as the actual versioning
 * process but runs in dry-run mode without making actual changes.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Import the actual versioning logic - we need to require functions directly from version-packages.js
const versionPackagesPath = path.join(__dirname, 'version-packages.js');
const versionPackagesContent = fs.readFileSync(versionPackagesPath, 'utf8');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// Extract configuration from version-packages.js
let PACKAGES, EXCLUDED_SCOPES, BUMP_TYPES;
const packageMatch = versionPackagesContent.match(/const PACKAGES = \[([\s\S]*?)\];/);
if (packageMatch) {
  PACKAGES = eval(`[${packageMatch[1]}]`);
} else {
  PACKAGES = [
    'packages/blorkpack',
    'packages/blorktools',
    'packages/blorkboard',
    'apps/portfolio'
  ];
}

const excludedMatch = versionPackagesContent.match(/const EXCLUDED_SCOPES = \[([\s\S]*?)\];/);
if (excludedMatch) {
  EXCLUDED_SCOPES = eval(`[${excludedMatch[1]}]`);
} else {
  EXCLUDED_SCOPES = ['pipeline', 'ci', 'workflows', 'github', 'actions'];
}

const bumpMatch = versionPackagesContent.match(/const BUMP_TYPES = \{([\s\S]*?)\};/);
if (bumpMatch) {
  BUMP_TYPES = eval(`({${bumpMatch[1]}})`);
} else {
  BUMP_TYPES = {
    PATCH: 'patch',
    MINOR: 'minor',
    MAJOR: 'major'
  };
}

/**
 * Gets the name of the current branch
 * @returns {string} Current branch name
 */
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    console.error(`${colors.red}Error getting current branch:${colors.reset}`, error.message);
    process.exit(1);
  }
}

/**
 * Gets the merge base between the current branch and main
 * @param {string} currentBranch - Name of the current branch
 * @returns {string} Merge base commit SHA
 */
function getMergeBase(currentBranch) {
  try {
    return execSync(`git merge-base main ${currentBranch}`).toString().trim();
  } catch (error) {
    console.error(`${colors.red}Error finding merge base:${colors.reset}`, error.message);
    console.error(`${colors.yellow}Make sure 'main' branch exists and you have the latest version.${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Extract scope from commit message - copied from version-packages.js
 */
function extractScope(message) {
  const match = message.match(/^[a-z]+\(([^)]+)\):/);
  return match ? match[1] : null;
}

/**
 * Determine version bump type based on commit message - copied from version-packages.js
 */
function determineBumpType(message) {
  // Check for breaking changes
  if (message.includes('BREAKING CHANGE:') || 
      message.match(/^(feat|fix|refactor)!:/)) {
    return BUMP_TYPES.MAJOR;
  }
  
  // Check for features
  if (message.match(/^feat(\([^)]+\))?:/)) {
    return BUMP_TYPES.MINOR;
  }
  
  // Default to patch
  return BUMP_TYPES.PATCH;
}

/**
 * Get all commits since base commit and determine which packages need to be versioned
 * Direct copy of determineVersionBumps from version-packages.js
 */
function determineVersionBumps(baseCommit) {
  const packageVersions = {};
  
  // Initialize all packages with no bump
  PACKAGES.forEach(pkg => {
    packageVersions[pkg] = null;
  });
  
  // Determine if this is a PR merge (we're simulating it is)
  const isPrMerge = true;
  
  // Get commits since base commit
  let gitLogCommand = `git log ${baseCommit}..HEAD --pretty=format:"%s"`;
  
  // For PR merges, we need to adjust the command to get all commits in the PR
  if (isPrMerge) {
    console.log(`${colors.cyan}PR merge simulation, using merge base ${baseCommit}${colors.reset}`);
    // For a PR merge, we want commits between the merge base and HEAD
    gitLogCommand = `git log ${baseCommit}..HEAD --pretty=format:"%s"`;
  }
  
  console.log(`Running command: ${gitLogCommand}`);
  let commits;
  try {
    const output = execSync(gitLogCommand).toString().trim();
    if (output) {
      commits = output.split('\n');
    } else {
      commits = [];
    }
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return packageVersions;
  }
  
  console.log(`Found ${commits.length} commits since ${baseCommit}`);
  
  // Process each commit
  commits.forEach(commit => {
    // Skip merge commits and empty commits
    if (commit.startsWith('Merge') || commit.trim() === '') {
      return;
    }
    
    console.log(`Analyzing commit: ${commit}`);
    
    const scope = extractScope(commit);
    const bumpType = determineBumpType(commit);
    
    console.log(`  Scope: ${scope || 'none'}, Bump type: ${bumpType}`);
    
    // If scope is in excluded list, skip this commit
    if (scope && EXCLUDED_SCOPES.includes(scope)) {
      console.log(`  Skipping excluded scope: ${scope}`);
      return;
    }
    
    // If commit has a scope, bump the package that matches the scope
    if (scope) {
      let matchFound = false;
      
      for (const pkg of PACKAGES) {
        const pkgName = pkg.split('/').pop();
        
        // Check if scope matches package name
        if (pkgName === scope || scope === 'common') {
          console.log(`  Matched package: ${pkg}`);
          matchFound = true;
          
          // Only upgrade the bump type if it's more significant
          if (
            !packageVersions[pkg] || 
            (bumpType === BUMP_TYPES.MAJOR) ||
            (bumpType === BUMP_TYPES.MINOR && packageVersions[pkg] === BUMP_TYPES.PATCH)
          ) {
            packageVersions[pkg] = bumpType;
            console.log(`  Setting ${pkg} to ${bumpType} bump`);
          }
          
          // Only break for package-specific scope, not for 'common'
          if (scope !== 'common') {
            break;
          }
        }
      }
      
      if (!matchFound) {
        console.log(`  No package match found for scope: ${scope}`);
      }
    } else {
      // No scope in the commit message - apply to ALL packages
      console.log(`  No scope - applying to all packages`);
      
      PACKAGES.forEach(pkg => {
        // Only upgrade the bump type if it's more significant
        if (
          !packageVersions[pkg] || 
          (bumpType === BUMP_TYPES.MAJOR) ||
          (bumpType === BUMP_TYPES.MINOR && packageVersions[pkg] === BUMP_TYPES.PATCH)
        ) {
          packageVersions[pkg] = bumpType;
          console.log(`  Setting ${pkg} to ${bumpType} bump`);
        }
      });
    }
  });
  
  return packageVersions;
}

/**
 * Increment version according to semver rules
 * Direct copy from version-packages.js
 */
function incrementVersion(version, bumpType) {
  const [major, minor, patch] = version.split('.').map(Number);
  
  switch (bumpType) {
    case BUMP_TYPES.MAJOR:
      return `${major + 1}.0.0`;
    case BUMP_TYPES.MINOR:
      return `${major}.${minor + 1}.0`;
    case BUMP_TYPES.PATCH:
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

/**
 * Get current version from package.json
 */
function getCurrentVersion(pkgPath) {
  try {
    const pkgJsonPath = path.join(process.cwd(), pkgPath, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      console.log(`  Package.json not found for ${pkgPath}`);
      return '0.0.0';
    }
    
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch (error) {
    console.error(`Error reading package.json for ${pkgPath}:`, error.message);
    return '0.0.0';
  }
}

/**
 * Main function to run the test version check
 */
function runTestVersionSimulation() {
  console.log(`${colors.bright}${colors.magenta}Test Version Merge Simulation${colors.reset}`);
  console.log(`${colors.blue}Using the EXACT SAME logic as the actual versioning process${colors.reset}`);
  
  // Get current branch and merge base
  const currentBranch = getCurrentBranch();
  console.log(`${colors.blue}Current branch: ${colors.cyan}${currentBranch}${colors.reset}`);
  
  if (currentBranch === 'main') {
    console.log(`${colors.yellow}You're already on main branch. No need to simulate a merge.${colors.reset}`);
    return;
  }
  
  const mergeBase = getMergeBase(currentBranch);
  console.log(`${colors.blue}Merge base with main: ${colors.cyan}${mergeBase}${colors.reset}`);
  console.log(`${colors.blue}Simulating version changes if merged into main...${colors.reset}\n`);
  
  // Determine version bumps using the actual logic from version-packages.js
  const packageBumps = determineVersionBumps(mergeBase);
  
  console.log(`\n${colors.bright}${colors.cyan}Version Changes that would be applied:${colors.reset}`);
  console.log(`${colors.yellow}===============================================${colors.reset}`);
  
  let wouldUpdateCount = 0;
  
  // Simulate updating package versions
  for (const [pkg, bumpType] of Object.entries(packageBumps)) {
    console.log(`\n${colors.bright}${pkg}:${colors.reset}`);
    
    const currentVersion = getCurrentVersion(pkg);
    console.log(`  Current version: ${colors.blue}${currentVersion}${colors.reset}`);
    
    if (bumpType) {
      const newVersion = incrementVersion(currentVersion, bumpType);
      console.log(`  Would bump to:   ${colors.green}${newVersion}${colors.reset} (${bumpType})`);
      wouldUpdateCount++;
    } else {
      console.log(`  ${colors.yellow}No version change would be applied${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.bright}${colors.green}Version simulation complete!${colors.reset}`);
  
  if (wouldUpdateCount > 0) {
    console.log(`${colors.green}Would update ${wouldUpdateCount} package(s)${colors.reset}`);
  } else {
    console.log(`${colors.yellow}No packages would be versioned based on current commits${colors.reset}`);
  }
}

// Run the simulation
try {
  runTestVersionSimulation();
} catch (error) {
  console.error(`${colors.red}Error:${colors.reset}`, error);
  process.exit(1);
} 