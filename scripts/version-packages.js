#!/usr/bin/env node

/**
 * version-packages.js
 * Handles versioning packages based on conventional commits and scopes
 * Supports independent versioning for each package
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES = [
  'packages/blorkpack',
  'packages/blorktools',
  'packages/blorkboard',
  'apps/portfolio'
];

// Special scopes that should NOT trigger version bumps
const EXCLUDED_SCOPES = ['pipeline', 'ci', 'workflows', 'github', 'actions'];

// Version bump types
const BUMP_TYPES = {
  PATCH: 'patch',
  MINOR: 'minor',
  MAJOR: 'major'
};

/**
 * Determine base commit to check from, with support for merge base from PR
 * @returns {string} Base commit SHA
 */
function getBaseCommit() {
  // Check if we have a merge base from environment or config file
  const mergeBaseFromEnv = process.env.VERSION_MERGE_BASE;
  let configMergeBase = null;
  
  // Try to read from config file
  try {
    if (fs.existsSync('.version-config.json')) {
      const config = JSON.parse(fs.readFileSync('.version-config.json', 'utf8'));
      configMergeBase = config.mergeBase;
    }
  } catch (error) {
    console.log('Error reading .version-config.json:', error.message);
  }
  
  // Use merge base from PR if available
  if (mergeBaseFromEnv) {
    console.log(`Using merge base from environment: ${mergeBaseFromEnv}`);
    return mergeBaseFromEnv;
  } else if (configMergeBase) {
    console.log(`Using merge base from config file: ${configMergeBase}`);
    return configMergeBase;
  }
  
  // Default behavior - try to get the latest tag
  try {
    const tags = execSync('git tag --sort=-v:refname').toString().trim().split('\n');
    if (tags.length > 0) {
      return tags[0];
    }
  } catch (error) {
    console.log('No tags found, using first commit');
  }

  // Fall back to first commit
  return execSync('git rev-list --max-parents=0 HEAD').toString().trim();
}

/**
 * Extract scope from commit message
 * @param {string} message Commit message
 * @returns {string|null} Scope or null if no scope found
 */
function extractScope(message) {
  const match = message.match(/^[a-z]+\(([^)]+)\):/);
  return match ? match[1] : null;
}

/**
 * Determine version bump type based on commit message
 * @param {string} message Commit message
 * @returns {string} Version bump type (patch, minor, major)
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
 * @param {string} baseCommit Base commit SHA or reference
 * @returns {Object} Map of package paths to version bump types
 */
function determineVersionBumps(baseCommit) {
  const packageVersions = {};
  
  // Initialize all packages with no bump
  PACKAGES.forEach(pkg => {
    packageVersions[pkg] = null;
  });
  
  // Determine if this is a PR merge
  const mergeBaseFromEnv = process.env.VERSION_MERGE_BASE;
  const isPrMerge = !!mergeBaseFromEnv;
  
  // Get commits since base commit
  let gitLogCommand = `git log ${baseCommit}..HEAD --pretty=format:"%s"`;
  
  // For PR merges, we need to adjust the command to get all commits in the PR
  if (isPrMerge) {
    console.log(`PR merge detected, using merge base ${baseCommit}`);
    // For a PR merge, we want commits between the merge base and HEAD^
    // (HEAD^ excludes the merge commit itself)
    gitLogCommand = `git log ${baseCommit}..HEAD^ --pretty=format:"%s"`;
  }
  
  console.log(`Running command: ${gitLogCommand}`);
  const commits = execSync(gitLogCommand).toString().trim().split('\n');
  
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
 * @param {string} version Current version
 * @param {string} bumpType Bump type (patch, minor, major)
 * @returns {string} New version
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
 * Update package.json version
 * @param {string} pkgPath Path to package directory
 * @param {string} bumpType Bump type (patch, minor, major)
 * @returns {string|null} New version or null if no update was made
 */
function updatePackageVersion(pkgPath, bumpType) {
  if (!bumpType) {
    return null;
  }
  
  const pkgJsonPath = path.join(process.cwd(), pkgPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  
  // Default to 0.0.0 if no version exists
  const currentVersion = pkg.version || '0.0.0';
  const newVersion = incrementVersion(currentVersion, bumpType);
  
  // Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  
  return newVersion;
}

/**
 * Main function to version packages
 */
function versionPackages() {
  console.log('🔍 Determining packages to version...');
  
  const baseCommit = getBaseCommit();
  console.log(`Using base commit: ${baseCommit}`);
  
  const packageBumps = determineVersionBumps(baseCommit);
  
  let updatedCount = 0;
  
  // Update package versions
  for (const [pkg, bumpType] of Object.entries(packageBumps)) {
    if (bumpType) {
      const newVersion = updatePackageVersion(pkg, bumpType);
      if (newVersion) {
        console.log(`📦 Updated ${pkg} to version ${newVersion} (${bumpType})`);
        updatedCount++;
      }
    } else {
      console.log(`📦 No changes for ${pkg}`);
    }
  }
  
  if (updatedCount > 0) {
    console.log(`\n✅ Updated ${updatedCount} package(s)`);
  } else {
    console.log('\n⚠️ No packages needed versioning');
  }
}

// Run the versioning
versionPackages(); 