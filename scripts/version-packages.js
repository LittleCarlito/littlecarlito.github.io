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
 * Determine base commit to check from
 * @returns {string} Base commit SHA
 */
function getBaseCommit() {
  try {
    // Try to get the latest tag
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
 * @param {string} baseCommit Base commit SHA
 * @returns {Object} Map of package paths to version bump types
 */
function determineVersionBumps(baseCommit) {
  const packageVersions = {};
  
  // Initialize all packages with no bump
  PACKAGES.forEach(pkg => {
    packageVersions[pkg] = null;
  });
  
  // Get commits since base commit
  const commits = execSync(`git log ${baseCommit}..HEAD --pretty=format:"%s"`).toString().trim().split('\n');
  
  // Process each commit
  commits.forEach(commit => {
    // Skip merge commits
    if (commit.startsWith('Merge')) {
      return;
    }
    
    const scope = extractScope(commit);
    const bumpType = determineBumpType(commit);
    
    // If scope is in excluded list, skip this commit
    if (scope && EXCLUDED_SCOPES.includes(scope)) {
      console.log(`Skipping excluded scope: ${scope}`);
      return;
    }
    
    // If commit has a scope, only bump the package that matches the scope
    if (scope) {
      for (const pkg of PACKAGES) {
        const pkgName = pkg.split('/').pop();
        
        // Check if scope matches package name
        if (pkgName === scope || scope === 'common') {
          // Only upgrade the bump type if it's more significant
          if (
            !packageVersions[pkg] || 
            (bumpType === BUMP_TYPES.MAJOR) ||
            (bumpType === BUMP_TYPES.MINOR && packageVersions[pkg] === BUMP_TYPES.PATCH)
          ) {
            packageVersions[pkg] = bumpType;
          }
          
          // Important: Don't break here, allow 'common' scope to affect multiple packages
          // Only break if it's a package-specific scope
          if (scope !== 'common') {
            break;
          }
        }
      }
    } else {
      // No scope in the commit, only bump packages directly affected by the changes
      // This requires analyzing which files were modified in the commit
      try {
        const commitHash = execSync(`git log --format="%H" -1 --grep="${commit.replace(/"/g, '\\"')}"`).toString().trim();
        if (commitHash) {
          const changedFiles = execSync(`git show --name-only --pretty=format: ${commitHash}`).toString().trim().split('\n');
          
          // Map changed files to affected packages
          PACKAGES.forEach(pkg => {
            const pkgPrefix = pkg.replace(/^apps\//, 'apps/').replace(/^packages\//, 'packages/');
            const isAffected = changedFiles.some(file => file.startsWith(pkgPrefix) || file === 'package.json');
            
            if (isAffected) {
              // Only upgrade the bump type if it's more significant
              if (
                !packageVersions[pkg] || 
                (bumpType === BUMP_TYPES.MAJOR) ||
                (bumpType === BUMP_TYPES.MINOR && packageVersions[pkg] === BUMP_TYPES.PATCH)
              ) {
                packageVersions[pkg] = bumpType;
              }
            }
          });
        }
      } catch (error) {
        console.error(`Error analyzing commit changes: ${error.message}`);
      }
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