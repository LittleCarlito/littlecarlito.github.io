#!/usr/bin/env node

/**
 * version-packages.js
 * Handles versioning packages based on conventional commits and scopes
 * Supports independent versioning for each package
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import shared versioning utilities
const { BUMP_TYPES, incrementVersion, extractScope, extractCommitType, determineBumpType } = require('./version-utils');

// Configuration
const PACKAGES = [
  'packages/blorkpack',
  'packages/blorktools',
  'packages/blorkboard',
  'apps/portfolio'
];

// Special scopes that should NOT trigger version bumps
const EXCLUDED_SCOPES = ['pipeline', 'ci', 'workflows', 'github', 'actions'];

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
 * Get detailed commit info
 * @param {string} commitHash Commit hash
 * @returns {Object} Commit details including hash, message, author, date
 */
function getCommitDetails(commitHash) {
  const shortHash = commitHash.slice(0, 7);
  const message = execSync(`git log --format=%s -n 1 ${commitHash}`).toString().trim();
  const type = extractCommitType(message) || 'unknown';
  // Determine what bump type this individual commit would contribute
  const bumpType = determineBumpType(message);
  
  return {
    hash: shortHash,
    message,
    type,
    bumpType // Track the individual bump type for this commit
  };
}

/**
 * Get all commits since base commit and determine which packages need to be versioned
 * @param {string} baseCommit Base commit SHA or reference
 * @returns {Object} Map of package paths to version bump types and affected commits
 */
function determineVersionBumps(baseCommit) {
  const packageVersions = {};
  const packageCommits = {};
  
  // Initialize all packages with no bump and empty commits array
  PACKAGES.forEach(pkg => {
    packageVersions[pkg] = null;
    packageCommits[pkg] = [];
  });
  
  // Determine if this is a PR merge
  const mergeBaseFromEnv = process.env.VERSION_MERGE_BASE;
  const isPrMerge = !!mergeBaseFromEnv;
  
  // Get commits since base commit in chronological order (oldest first)
  let gitLogCommand = `git log --reverse ${baseCommit}..HEAD --pretty=format:"%H"`;
  
  // For PR merges, we need to adjust the command to get all commits in the PR
  if (isPrMerge) {
    console.log(`PR merge detected, using merge base ${baseCommit}`);
    // For a PR merge, we want commits between the merge base and HEAD^
    // (HEAD^ excludes the merge commit itself)
    gitLogCommand = `git log --reverse ${baseCommit}..HEAD^ --pretty=format:"%H"`;
  }
  
  console.log(`Running command: ${gitLogCommand}`);
  const commitHashes = execSync(gitLogCommand).toString().trim().split('\n');
  
  console.log(`Found ${commitHashes.length} commits since ${baseCommit}`);
  
  // Get current versions for all packages
  const currentVersions = {};
  PACKAGES.forEach(pkg => {
    try {
      const pkgJsonPath = path.join(process.cwd(), pkg, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        currentVersions[pkg] = pkgData.version || '0.0.0';
      } else {
        currentVersions[pkg] = '0.0.0';
      }
    } catch (error) {
      console.error(`Error reading package.json for ${pkg}:`, error.message);
      currentVersions[pkg] = '0.0.0';
    }
  });
  
  // Process each commit in chronological order (oldest first)
  const sequentialVersions = { ...currentVersions };
  
  commitHashes.forEach(commitHash => {
    if (!commitHash.trim()) return;
    
    const commitDetails = getCommitDetails(commitHash);
    const message = commitDetails.message;
    
    // Skip merge commits and empty commits
    if (message.startsWith('Merge') || message.trim() === '') {
      return;
    }
    
    console.log(`Analyzing commit: ${message}`);
    
    const scope = extractScope(message);
    const bumpType = commitDetails.bumpType;
    
    console.log(`  Scope: ${scope || 'none'}, Bump type: ${bumpType}`);
    
    // If scope is in excluded list, skip this commit
    if (scope && EXCLUDED_SCOPES.includes(scope)) {
      console.log(`  Skipping excluded scope: ${scope}`);
      return;
    }
    
    // If commit has a scope, apply to the matching package
    if (scope) {
      let matchFound = false;
      
      for (const pkg of PACKAGES) {
        const pkgName = pkg.split('/').pop();
        
        // Check if scope matches package name
        if (pkgName === scope || scope === 'common') {
          console.log(`  Matched package: ${pkg}`);
          matchFound = true;
          
          // Calculate the new sequential version for this package
          const newVersion = incrementVersion(sequentialVersions[pkg], bumpType);
          
          // Store the sequential version that this commit would produce
          commitDetails.exactVersion = newVersion;
          sequentialVersions[pkg] = newVersion; // Update for next commit
          
          // Track this commit for the package
          packageCommits[pkg].push(commitDetails);
          
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
        // Calculate the new sequential version for this package
        const newVersion = incrementVersion(sequentialVersions[pkg], bumpType);
        
        // Clone the commit details to avoid reference issues across packages
        const pkgCommitDetails = { ...commitDetails };
        pkgCommitDetails.exactVersion = newVersion;
        sequentialVersions[pkg] = newVersion; // Update for next commit
        
        // Track this commit for all packages
        packageCommits[pkg].push(pkgCommitDetails);
      });
    }
  });
  
  // Use the final sequential version as the recommended version bump
  PACKAGES.forEach(pkg => {
    if (packageCommits[pkg].length > 0) {
      // If package has commits, set the packageVersion to the final sequential version
      packageVersions[pkg] = sequentialVersions[pkg];
    }
  });
  
  return { packageVersions, packageCommits, currentVersions };
}

/**
 * Update package.json version
 * @param {string} pkgPath Path to package directory
 * @param {string} newVersion New version to set
 * @returns {Object|null} Version info or null if no update was made
 */
function updatePackageVersion(pkgPath, newVersion) {
  if (!newVersion) {
    return null;
  }
  
  const pkgJsonPath = path.join(process.cwd(), pkgPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  
  // Default to 0.0.0 if no version exists
  const currentVersion = pkg.version || '0.0.0';
  
  // Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  
  // Find the highest bump type that led to this version
  let highestBumpType = BUMP_TYPES.PATCH;
  for (const commit of packageCommits[pkgPath] || []) {
    if (commit.bumpType === BUMP_TYPES.MAJOR) {
      highestBumpType = BUMP_TYPES.MAJOR;
      break;
    } else if (commit.bumpType === BUMP_TYPES.MINOR && highestBumpType !== BUMP_TYPES.MAJOR) {
      highestBumpType = BUMP_TYPES.MINOR;
    }
  }
  
  return {
    currentVersion,
    newVersion,
    bumpType: highestBumpType
  };
}

/**
 * Generate Markdown content for the current version bump
 * @param {Object} bumpDetails Object containing version bump details for each package
 * @returns {string} Markdown content for just this bump
 */
function generateCurrentBumpMd(bumpDetails) {
  const timestamp = new Date().toISOString().replace('T', ' at ').substring(0, 19);
  let markdown = `## Version Bump on ${timestamp}\n\n`;
  
  let anyBumps = false;
  
  // Generate section for each package
  Object.keys(bumpDetails).forEach(pkg => {
    const details = bumpDetails[pkg];
    if (!details || !details.versionInfo) return;
    
    anyBumps = true;
    const { currentVersion, newVersion, bumpType } = details.versionInfo;
    const commits = details.commits || [];
    
    // Get unique commit types affecting this package
    const commitTypes = [...new Set(commits.map(c => c.type))].filter(Boolean).sort();
    
    markdown += `### ${pkg} → ${newVersion} (${bumpType})\n\n`;
    markdown += `- Current version: ${currentVersion}\n`;
    markdown += `- New version: ${newVersion}\n`;
    markdown += `- Affected by commit types: ${commitTypes.join(', ') || 'none'}\n\n`;
    
    // Track each commit with its individual contribution and exact version
    if (commits.length > 0) {
      markdown += '#### Sequential Version Progression\n\n';
      markdown += '| Commit | Message | Bump Type | Exact Version |\n';
      markdown += '|--------|---------|-----------|---------------|\n';
      
      // Show commits in chronological order
      commits.forEach(commit => {
        const exactVersion = commit.exactVersion || '?';
        markdown += `| \`${commit.hash}\` | ${commit.message} | **${commit.bumpType}** | **${exactVersion}** |\n`;
      });
      markdown += '\n';
    }
  });
  
  if (!anyBumps) {
    markdown += '***No packages were bumped in this version.***\n\n';
  }
  
  return markdown;
}

/**
 * Update or create the version bump analysis file
 * @param {Object} bumpDetails Object containing version bump details for each package
 */
function updateBumpAnalysisFile(bumpDetails) {
  const filePath = path.join(process.cwd(), 'documentation', 'version-bumps-analysis.md');
  const docsDir = path.join(process.cwd(), 'documentation');
  
  // Make sure the documentation directory exists
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Generate the new bump content
  const newBumpContent = generateCurrentBumpMd(bumpDetails);
  
  // Check if file exists and read it, or create header if it doesn't
  let existingContent = '';
  if (fs.existsSync(filePath)) {
    existingContent = fs.readFileSync(filePath, 'utf8');
  } else {
    existingContent = '# Version Bump Analysis\n\n';
    existingContent += 'This file tracks all version bumps, what triggered them, and which packages were affected.\n\n\n';
  }
  
  // Find the position after the header to insert the new content
  const headerEndPos = existingContent.indexOf('\n\n\n');
  if (headerEndPos !== -1) {
    // Insert after the header
    const finalContent = existingContent.substring(0, headerEndPos + 3) + newBumpContent + existingContent.substring(headerEndPos + 3);
    fs.writeFileSync(filePath, finalContent);
  } else {
    // If cannot find proper position, just append
    fs.writeFileSync(filePath, existingContent + '\n' + newBumpContent);
  }
  
  console.log(`✅ Updated version bump analysis at: ${filePath}`);
}

/**
 * Main function to version packages
 */
function versionPackages(options = {}) {
  console.log('🔍 Determining packages to version...');
  
  const baseCommit = getBaseCommit();
  console.log(`Using base commit: ${baseCommit}`);
  
  const { packageVersions, packageCommits, currentVersions } = determineVersionBumps(baseCommit);
  
  let updatedCount = 0;
  const bumpDetails = {};
  const updatedPackages = [];
  
  // Don't apply changes in dry-run mode
  const shouldApply = !options.dryRun && options.apply;
  
  // Update package versions
  for (const [pkg, newVersion] of Object.entries(packageVersions)) {
    if (newVersion && currentVersions[pkg] !== newVersion) {
      if (shouldApply) {
        const versionInfo = updatePackageVersion(pkg, newVersion);
        if (versionInfo) {
          console.log(`📦 Updated ${pkg} to version ${versionInfo.newVersion} (${versionInfo.bumpType})`);
          
          // Store details for the bump analysis file
          bumpDetails[pkg] = {
            versionInfo,
            commits: packageCommits[pkg]
          };
          
          // Add to updatedPackages array
          updatedPackages.push({
            name: pkg.split('/').pop(),
            path: pkg,
            version: versionInfo.newVersion,
            previousVersion: versionInfo.currentVersion,
            bumpType: versionInfo.bumpType
          });
          
          updatedCount++;
        }
      } else {
        console.log(`📦 Would update ${pkg} from ${currentVersions[pkg]} to ${newVersion} (dry run)`);
        
        // Add to potential updates array even in dry-run mode
        updatedPackages.push({
          name: pkg.split('/').pop(),
          path: pkg,
          version: newVersion,
          previousVersion: currentVersions[pkg],
          bumpType: determineBumpType(packageCommits[pkg][0]?.message || '')
        });
        
        updatedCount++;
      }
    } else {
      console.log(`📦 No changes for ${pkg}`);
    }
  }
  
  if (updatedCount > 0) {
    console.log(`\n✅ ${shouldApply ? 'Updated' : 'Would update'} ${updatedCount} package(s)`);
    
    // Update the version bump analysis file if applying changes
    if (shouldApply) {
      updateBumpAnalysisFile(bumpDetails);
    }
  } else {
    console.log('\n⚠️ No packages needed versioning');
  }
  
  return {
    packageVersions,
    packageCommits,
    currentVersions,
    updatedPackages,
    bumpDetails
  };
}

// Run the versioning
versionPackages({ apply: true });

// Export the functions for use in other scripts
module.exports = {
  versionPackages: function(options = {}) {
    console.log('🔍 Determining packages to version...');
    
    const baseCommit = getBaseCommit();
    console.log(`Using base commit: ${baseCommit}`);
    
    const { packageVersions, packageCommits, currentVersions } = determineVersionBumps(baseCommit);
    
    let updatedCount = 0;
    const bumpDetails = {};
    const updatedPackages = [];
    
    // Don't apply changes in dry-run mode
    const shouldApply = !options.dryRun && options.apply;
    
    // Update package versions
    for (const [pkg, newVersion] of Object.entries(packageVersions)) {
      if (newVersion && currentVersions[pkg] !== newVersion) {
        if (shouldApply) {
          const versionInfo = updatePackageVersion(pkg, newVersion);
          if (versionInfo) {
            console.log(`📦 Updated ${pkg} to version ${versionInfo.newVersion} (${versionInfo.bumpType})`);
            
            // Store details for the bump analysis file
            bumpDetails[pkg] = {
              versionInfo,
              commits: packageCommits[pkg]
            };
            
            // Add to updatedPackages array
            updatedPackages.push({
              name: pkg.split('/').pop(),
              path: pkg,
              version: versionInfo.newVersion,
              previousVersion: versionInfo.currentVersion,
              bumpType: versionInfo.bumpType
            });
            
            updatedCount++;
          }
        } else {
          console.log(`📦 Would update ${pkg} from ${currentVersions[pkg]} to ${newVersion} (dry run)`);
          
          // Add to potential updates array even in dry-run mode
          updatedPackages.push({
            name: pkg.split('/').pop(),
            path: pkg,
            version: newVersion,
            previousVersion: currentVersions[pkg],
            bumpType: determineBumpType(packageCommits[pkg][0]?.message || '')
          });
          
          updatedCount++;
        }
      } else {
        console.log(`📦 No changes for ${pkg}`);
      }
    }
    
    if (updatedCount > 0) {
      console.log(`\n✅ ${shouldApply ? 'Updated' : 'Would update'} ${updatedCount} package(s)`);
      
      // Update the version bump analysis file if applying changes
      if (shouldApply) {
        updateBumpAnalysisFile(bumpDetails);
      }
    } else {
      console.log('\n⚠️ No packages needed versioning');
    }
    
    return {
      packageVersions,
      packageCommits,
      currentVersions,
      updatedPackages,
      bumpDetails
    };
  },
  // Export constants needed by tests
  PACKAGES,
  EXCLUDED_SCOPES,
  // Export helper functions needed by tests
  getBaseCommit,
  getCommitDetails,
  determineVersionBumps,
  updatePackageVersion,
  generateCurrentBumpMd,
  updateBumpAnalysisFile
}; 