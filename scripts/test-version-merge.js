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

// Import shared versioning utilities
const { BUMP_TYPES, incrementVersion, extractScope, extractCommitType, determineBumpType } = require('./version-utils');

// Import the actual versioning logic for package paths and excluded scopes
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
let PACKAGES, EXCLUDED_SCOPES;
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
 * Get detailed commit info
 * @param {string} commitHash Commit hash
 * @returns {Object} Commit details including hash, message, type, bumpType
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
 * Uses the same approach as version-packages.js but tracks sequential versions
 */
function determineVersionBumps(baseCommit) {
  const packageVersions = {};
  const packageCommits = {};
  
  // Initialize all packages with no bump and empty commits array
  PACKAGES.forEach(pkg => {
    packageVersions[pkg] = null;
    packageCommits[pkg] = [];
  });
  
  // Determine if this is a PR merge (we're simulating it is)
  const isPrMerge = true;
  
  // Get commits since base commit in chronological order (oldest first)
  let gitLogCommand = `git log --reverse ${baseCommit}..HEAD --pretty=format:"%H"`;
  
  // For PR merges, we need to adjust the command to get all commits in the PR
  if (isPrMerge) {
    console.log(`${colors.cyan}PR merge simulation, using merge base ${baseCommit}${colors.reset}`);
    // For a PR merge, we want commits between the merge base and HEAD
    gitLogCommand = `git log --reverse ${baseCommit}..HEAD --pretty=format:"%H"`;
  }
  
  console.log(`Running command: ${gitLogCommand}`);
  let commitHashes;
  try {
    const output = execSync(gitLogCommand).toString().trim();
    if (output) {
      commitHashes = output.split('\n');
    } else {
      commitHashes = [];
    }
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return { packageVersions, packageCommits };
  }
  
  console.log(`Found ${commitHashes.length} commits since ${baseCommit}`);
  
  // Get current versions for all packages
  const currentVersions = {};
  PACKAGES.forEach(pkg => {
    try {
      const pkgPath = path.join(process.cwd(), pkg, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
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
  
  // Process each commit
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
  
  return { packageVersions, packageCommits, currentVersions, sequentialVersions };
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
 * Generate Markdown content for version bump details
 */
function generateBumpDetailsMd(bumpDetails) {
  const timestamp = new Date().toISOString().replace('T', ' at ').substring(0, 19);
  let markdown = `## Version Bump on ${timestamp} (SIMULATION)\n\n`;
  
  // Generate section for each package
  Object.keys(bumpDetails).forEach(pkg => {
    const details = bumpDetails[pkg];
    if (!details || !details.versionInfo) return;
    
    const { currentVersion, newVersion } = details.versionInfo;
    const commits = details.commits || [];
    
    // Get unique commit types affecting this package
    const commitTypes = [...new Set(commits.map(c => c.type))].filter(Boolean).sort();
    
    markdown += `### ${pkg} → ${newVersion}\n\n`;
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
  
  return markdown;
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
  const { packageVersions, packageCommits, currentVersions, sequentialVersions } = determineVersionBumps(mergeBase);
  
  console.log(`\n${colors.bright}${colors.cyan}Version Changes that would be applied:${colors.reset}`);
  console.log(`${colors.yellow}===============================================${colors.reset}`);
  
  let wouldUpdateCount = 0;
  const bumpDetails = {};
  
  // Simulate updating package versions
  for (const [pkg, newVersion] of Object.entries(packageVersions)) {
    console.log(`\n${colors.bright}${pkg}:${colors.reset}`);
    
    const currentVersion = currentVersions[pkg] || '0.0.0';
    console.log(`  Current version: ${colors.blue}${currentVersion}${colors.reset}`);
    
    if (newVersion) {
      console.log(`  Would bump to:   ${colors.green}${newVersion}${colors.reset}`);
      
      // Find the highest bump type used in commits for this package
      let highestBumpType = BUMP_TYPES.PATCH;
      for (const commit of packageCommits[pkg]) {
        if (commit.bumpType === BUMP_TYPES.MAJOR) {
          highestBumpType = BUMP_TYPES.MAJOR;
          break;
        } else if (commit.bumpType === BUMP_TYPES.MINOR && highestBumpType !== BUMP_TYPES.MAJOR) {
          highestBumpType = BUMP_TYPES.MINOR;
        }
      }
      
      // Store details for the bump analysis preview
      bumpDetails[pkg] = {
        versionInfo: {
          currentVersion,
          newVersion,
          bumpType: highestBumpType
        },
        commits: packageCommits[pkg]
      };
      
      wouldUpdateCount++;
    } else {
      console.log(`  ${colors.yellow}No version change would be applied${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.bright}${colors.green}Version simulation complete!${colors.reset}`);
  
  if (wouldUpdateCount > 0) {
    console.log(`${colors.green}Would update ${wouldUpdateCount} package(s)${colors.reset}`);
    
    // Ask if they want to see details about what would be added to the version-bumps-analysis.md file
    console.log(`\n${colors.bright}${colors.cyan}Would you like to see what will be added to the version-bumps-analysis.md file? (y/N)${colors.reset}`);
    
    // Set up standard input with a timeout
    process.stdin.setEncoding('utf8');
    
    // Create a timeout that defaults to N after 4 seconds
    const timeout = setTimeout(() => {
      console.log(`\n${colors.yellow}No response received within 4 seconds, defaulting to N${colors.reset}`);
      process.stdin.pause();
    }, 4000);
    
    process.stdin.once('data', function (data) {
      // Clear the timeout since we received a response
      clearTimeout(timeout);
      
      const input = data.toString().trim().toLowerCase();
      // Treat empty input (just Enter) as 'n', only proceed with 'y' or 'yes'
      if (input === 'y' || input === 'yes') {
        // Generate and display the bump details
        const bumpDetailsMd = generateBumpDetailsMd(bumpDetails);
        console.log(`\n${colors.bright}${colors.magenta}The following would be added to documentation/version-bumps-analysis.md:${colors.reset}`);
        console.log(`${colors.yellow}===============================================${colors.reset}`);
        console.log(bumpDetailsMd);
      }
      process.stdin.pause();
    });
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