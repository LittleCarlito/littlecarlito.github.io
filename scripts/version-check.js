#!/usr/bin/env node

/**
 * Manual Version Check Script
 * 
 * This script runs a dry-run of the actual versioning process,
 * showing what versions would be generated for each package.
 */

// Note: This script uses CommonJS to match version-packages.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import functions from version-packages.js (directly accessing them)
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
// Note: This is a simplistic extraction method for demonstration
// In a production environment, consider importing as a module if possible
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

// Extract functions from version-packages.js
const extractScopeMatch = versionPackagesContent.match(/function extractScope\(message\) \{([\s\S]*?)\}/);
const extractScope = extractScopeMatch 
	? new Function('message', extractScopeMatch[1]) 
	: (message) => {
		const match = message.match(/^[a-z]+\(([^)]+)\):/);
		return match ? match[1] : null;
	};

const determineBumpTypeMatch = versionPackagesContent.match(/function determineBumpType\(message\) \{([\s\S]*?)\}/);
const determineBumpType = determineBumpTypeMatch
	? new Function('message', 'BUMP_TYPES', determineBumpTypeMatch[1].replace(/return/g, 'return BUMP_TYPES.'))
	: (message, BUMP_TYPES) => {
		if (message.includes('BREAKING CHANGE:') || message.match(/^(feat|fix|refactor)!:/)) {
			return BUMP_TYPES.MAJOR;
		}
		if (message.match(/^feat(\([^)]+\))?:/)) {
			return BUMP_TYPES.MINOR;
		}
		return BUMP_TYPES.PATCH;
	};

// We'll use our own getBaseCommit to simplify for the dry run
function getBaseCommit() {
	try {
		const tags = execSync('git tag --sort=-v:refname').toString().trim().split('\n');
		if (tags.length > 0) {
			return tags[0];
		}
	} catch (error) {
		console.log('No tags found, using first commit');
	}
	return execSync('git rev-list --max-parents=0 HEAD').toString().trim();
}

// Direct port of determineVersionBumps with minimal changes for dry-run
function determineVersionBumps(baseCommit) {
	const packageVersions = {};
	
	// Initialize all packages with no bump
	PACKAGES.forEach(pkg => {
		packageVersions[pkg] = null;
	});
	
	// Get commits since base commit
	let gitLogCommand = `git log ${baseCommit}..HEAD --pretty=format:"%s"`;
	
	console.log(`Running command: ${gitLogCommand}`);
	let commits = [];
	try {
		const output = execSync(gitLogCommand).toString().trim();
		if (output) {
			commits = output.split('\n');
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
		const bumpType = determineBumpType(commit, BUMP_TYPES);
		
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
 * Get current version from package.json
 * @param {string} pkgPath Path to package
 * @returns {string} Current version
 */
function getCurrentVersion(pkgPath) {
	try {
		const pkgJsonPath = path.join(process.cwd(), pkgPath, 'package.json');
		const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
		return pkg.version || '0.0.0';
	} catch (error) {
		console.error(`Error reading package.json for ${pkgPath}:`, error.message);
		return '0.0.0';
	}
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
 * Simulates updating package version without making changes
 */
function simulateUpdatePackageVersion(pkgPath, bumpType) {
	if (!bumpType) {
		return null;
	}
	
	try {
		const pkgJsonPath = path.join(process.cwd(), pkgPath, 'package.json');
		if (!fs.existsSync(pkgJsonPath)) {
			console.log(`  Package.json not found for ${pkgPath}`);
			return null;
		}
		
		const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
		const currentVersion = pkg.version || '0.0.0';
		const newVersion = incrementVersion(currentVersion, bumpType);
		
		return { currentVersion, newVersion, bumpType };
	} catch (error) {
		console.error(`Error simulating version update for ${pkgPath}:`, error.message);
		return null;
	}
}

/**
 * Main function to simulate versioning packages
 */
function simulateVersioning() {
	console.log(`${colors.bright}${colors.magenta}Manual Version Check (Dry Run)${colors.reset}`);
	console.log(`${colors.blue}Simulating what versions would be generated based on current commit history...${colors.reset}`);
	
	const baseCommit = getBaseCommit();
	console.log(`Using base commit/tag: ${baseCommit}`);
	
	const packageBumps = determineVersionBumps(baseCommit);
	
	console.log(`\n${colors.bright}${colors.cyan}Version Changes that would be applied:${colors.reset}`);
	console.log(`${colors.yellow}===============================================${colors.reset}`);
	
	let wouldUpdateCount = 0;
	
	// Simulate updating package versions
	for (const [pkg, bumpType] of Object.entries(packageBumps)) {
		const result = simulateUpdatePackageVersion(pkg, bumpType);
		
		if (result) {
			const { currentVersion, newVersion } = result;
			console.log(`\n${colors.bright}${pkg}:${colors.reset}`);
			console.log(`  Current version: ${colors.blue}${currentVersion}${colors.reset}`);
			
			if (bumpType) {
				console.log(`  Would bump to:   ${colors.green}${newVersion}${colors.reset} (${bumpType})`);
				wouldUpdateCount++;
			} else {
				console.log(`  ${colors.yellow}No version change would be applied${colors.reset}`);
			}
		}
	}
	
	console.log(`\n${colors.bright}${colors.green}Version check complete!${colors.reset}`);
	
	if (wouldUpdateCount > 0) {
		console.log(`${colors.green}Would update ${wouldUpdateCount} package(s)${colors.reset}`);
	} else {
		console.log(`${colors.yellow}No packages would be versioned based on current commits${colors.reset}`);
	}
}

// Run the simulation
try {
	simulateVersioning();
} catch (error) {
	console.error(`${colors.red}Error:${colors.reset}`, error);
	process.exit(1);
} 