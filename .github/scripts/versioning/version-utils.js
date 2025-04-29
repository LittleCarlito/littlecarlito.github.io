/**
 * Shared utilities for version calculation
 * This module provides common functionality used by both test-version and version-from-commits
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES = ['blorkpack', 'blorktools', 'blorkboard'];
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
 * Create a changeset file with explicit version instructions
 */
function createCustomChangeset(packageVersions, body, dryRun = false) {
  if (dryRun) {
    console.log('DRY RUN: Would create changeset with:');
    console.log('Package versions:', packageVersions);
    console.log('Body:', body);
    return null;
  }

  // Create the .changeset directory if it doesn't exist
  const changesetDir = path.join(process.cwd(), '.changeset');
  if (!fs.existsSync(changesetDir)) {
    fs.mkdirSync(changesetDir, { recursive: true });
  }

  // Create a unique changeset ID
  const changesetId = `version-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const changesetPath = path.join(changesetDir, `${changesetId}.md`);
  
  // Generate the changeset header with EXPLICIT VERSIONS
  let content = '---\n';
  
  // For each package, include its name and EXACT bump type
  Object.entries(packageVersions).forEach(([packageName, versionInfo]) => {
    // Use the most specific bump type possible
    const bumpType = versionInfo.bumpType;
    content += `"${packageName}": ${bumpType}\n`;
  });
  
  content += '---\n\n';
  content += body;
  
  // Write the changeset file
  fs.writeFileSync(changesetPath, content);
  console.log(`Created changeset at ${changesetPath}`);
  
  return {
    id: changesetId,
    path: changesetPath
  };
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
  createCustomChangeset
}; 