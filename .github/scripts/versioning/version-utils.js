/**
 * Shared utilities for version calculation
 * This module provides common functionality used by both test-version and version-from-commits
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES = ['blorkpack', 'blorktools', 'blorkvisor'];
const APPS = ['portfolio'];
const ALL_PROJECTS = [...PACKAGES, ...APPS];
const IGNORE_SCOPES = ['pipeline'];

/**
 * Get the current version of a package from its package.json
 */
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

/**
 * Calculate a new version based on the current version and bump type
 */
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

/**
 * Determine the bump type based on version difference
 */
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

/**
 * Convert a project name to a package name
 */
function getPackageName(project) {
  return `@littlecarlito/${project}`;
}

/**
 * Check if a git reference exists
 */
function refExists(ref) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Escape a git reference for shell command
 */
function escapeRef(ref) {
  if (!ref) return '';
  return ref.replace(/'/g, "'\\''");
}

/**
 * Update package version directly in package.json
 */
function updatePackageVersions(packageVersions, dryRun = false) {
  if (dryRun) {
    console.log('DRY RUN: Would update package versions:');
    console.log(packageVersions);
    return null;
  }

  const results = [];

  Object.entries(packageVersions).forEach(([packageName, info]) => {
    const project = info.project;
    const newVersion = info.finalVersion;
    
    // Get package.json path
    const packageJsonPath = path.join(
      process.cwd(), 
      project === 'portfolio' ? 'apps/portfolio' : `packages/${project}`,
      'package.json'
    );
    
    try {
      // Read package.json
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Update version
      packageJson.version = newVersion;
      
      // Write back to file
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      
      console.log(`Updated ${packageName} to version ${newVersion}`);
      
      results.push({
        packageName,
        path: packageJsonPath,
        version: newVersion,
        success: true
      });
    } catch (error) {
      console.error(`Error updating ${packageName}:`, error.message);
      results.push({
        packageName,
        path: packageJsonPath,
        error: error.message,
        success: false
      });
    }
  });
  
  return results;
}

/**
 * Create git tag for package version
 */
function createVersionTag(packageName, version, dryRun = false) {
  const tag = `${packageName}@${version}`;
  
  if (dryRun) {
    console.log(`DRY RUN: Would create git tag: ${tag}`);
    return { success: true, tag };
  }
  
  try {
    execSync(`git tag ${tag}`);
    console.log(`Created git tag: ${tag}`);
    return { success: true, tag };
  } catch (error) {
    console.error(`Error creating git tag ${tag}:`, error.message);
    return { success: false, tag, error: error.message };
  }
}

/**
 * Get the latest version tag for a package
 * This helps prevent reaccumulating increments when tags exist
 */
function getLatestVersionTag(project) {
  const packageName = getPackageName(project);
  try {
    // Try to find the most recent tag for this package
    const cmd = `git tag -l "${packageName}@*" --sort=-v:refname | head -n1`;
    const tagResult = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    
    if (tagResult) {
      // Extract version from tag (format: @packageName/project@1.2.3)
      const versionMatch = tagResult.match(/@(\d+\.\d+\.\d+)$/);
      if (versionMatch && versionMatch[1]) {
        return versionMatch[1];
      }
    }
    
    // If no tag found, check if this is the first run by checking if we have any commits
    // Get the current version from package.json as a fallback
    const currentVersion = getCurrentVersion(project);
    
    // If the current version is already above 0.0.0, use it
    if (currentVersion !== '0.0.0') {
      return currentVersion;
    }
    
    // If the version is 0.0.0 and no tags exist, 
    // we should process from the beginning of repository history
    // Set a special indicator to let the calling function know it should 
    // process from the first commit
    return '__FIRST_COMMIT__';
  } catch (error) {
    // On error, fall back to the current version from package.json
    console.error(`Error getting latest tag for ${packageName}: ${error.message}`);
    return getCurrentVersion(project);
  }
}

module.exports = {
  PACKAGES,
  APPS,
  ALL_PROJECTS,
  IGNORE_SCOPES,
  getCurrentVersion,
  calculateNewVersion,
  determineBumpType,
  getPackageName,
  refExists,
  escapeRef,
  updatePackageVersions,
  createVersionTag,
  getLatestVersionTag
}; 