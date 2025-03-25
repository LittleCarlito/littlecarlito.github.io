#!/usr/bin/env node

/**
 * Auto-generate changesets from conventional commits
 * 
 * This script analyzes recent commits with conventional commit format
 * and automatically creates changesets based on the commit types:
 * - feat: -> minor version bump
 * - fix: -> patch version bump
 * - feat!: or BREAKING CHANGE: -> major version bump
 * 
 * Usage:
 *   node scripts/auto-changeset.js [--since=<commit-ish>] [--dry-run]
 * 
 * Examples:
 *   node scripts/auto-changeset.js
 *   node scripts/auto-changeset.js --since=main
 *   node scripts/auto-changeset.js --since="1 day ago"
 *   node scripts/auto-changeset.js --dry-run
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Colors for terminal output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
let sinceOption = 'HEAD~5'; // Default to last 5 commits

// Parse --since=value argument
const sinceArg = args.find(arg => arg.startsWith('--since='));
if (sinceArg) {
	sinceOption = sinceArg.split('=')[1];
}

// Get package paths and names
/**
 *
 */
function getPackages() {
	const packagesDir = path.join(process.cwd(), 'packages');
	const packages = [];

	fs.readdirSync(packagesDir, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.forEach(dirent => {
			const packagePath = path.join(packagesDir, dirent.name);
			const packageJsonPath = path.join(packagePath, 'package.json');
      
			if (fs.existsSync(packageJsonPath)) {
				const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
				packages.push({
					name: packageJson.name,
					path: packagePath,
					directory: dirent.name
				});
			}
		});

	return packages;
}

// Get commits with parsed conventional commit info
/**
 *
 */
function getConventionalCommits() {
	// Get raw commit data
	const gitLogCommand = `git log ${sinceOption} --pretty=format:"%H||%s||%b" --no-merges`;
	const gitLogOutput = execSync(gitLogCommand).toString().trim();
  
	if (!gitLogOutput) {
		return [];
	}

	return gitLogOutput.split('\n').map(line => {
		const parts = line.split('||');
		const hash = parts[0] || '';
		const subject = parts[1] || '';
		const body = parts[2] || '';
    
		// Parse conventional commit - add null check
		if (!subject) {
			return {
				hash,
				conventional: false,
				subject: '',
				body
			};
		}
    
		const typeMatch = subject.match(/^(\w+)(\(.*?\))?(!)?:\s*(.*)$/);
    
		if (!typeMatch) {
			return {
				hash,
				conventional: false,
				subject,
				body
			};
		}
    
		const [, type, scope, breaking, message] = typeMatch;
		const isBreaking = breaking === '!' || (body && body.includes('BREAKING CHANGE:'));
    
		return {
			hash,
			conventional: true,
			type,
			scope: scope ? scope.replace(/[()]/g, '') : undefined,
			breaking: isBreaking,
			message,
			subject,
			body
		};
	});
}

// Determine affected packages from commits
/**
 *
 */
function determineAffectedPackages(commits, allPackages) {
	const packagesByCommit = {};

	// Helper to check if commit message mentions a package
	const checkPackageMentions = (text, packages) => {
		return packages.filter(pkg => {
			const shortName = pkg.name.split('/').pop();
			return text.includes(shortName) || text.includes(pkg.directory);
		});
	};

	// Process each commit to determine affected packages
	commits.forEach(commit => {
		if (!commit.conventional) return;
    
		// Start with an empty set
		let affectedPackages = new Set();
    
		// Check scope first if available
		if (commit.scope) {
			const packagesFromScope = checkPackageMentions(commit.scope, allPackages);
			packagesFromScope.forEach(pkg => affectedPackages.add(pkg.name));
		}
    
		// Check message text if we didn't find packages from scope
		if (affectedPackages.size === 0) {
			const packagesFromMessage = checkPackageMentions(commit.subject + ' ' + commit.body, allPackages);
			packagesFromMessage.forEach(pkg => affectedPackages.add(pkg.name));
		}
    
		// If still no packages found, assume all packages are affected for important changes
		if (affectedPackages.size === 0 && (commit.breaking || commit.type === 'feat')) {
			allPackages.forEach(pkg => affectedPackages.add(pkg.name));
		} else if (affectedPackages.size === 0) {
			// For less important changes like 'fix', use a heuristic or default packages
			// For now we'll use the main packages
			const mainPackages = ['@littlecarlito/blorkpack', '@littlecarlito/blorktools', '@littlecarlito/blorkboard'];
			mainPackages.forEach(pkg => affectedPackages.add(pkg));
		}
    
		packagesByCommit[commit.hash] = {
			commit,
			packages: Array.from(affectedPackages)
		};
	});

	return packagesByCommit;
}

// Determine needed version bump for each package
/**
 *
 */
function determineVersionBumps(packagesByCommit) {
	const packageBumps = {};
  
	// Initialize with lowest bump level
	Object.values(packagesByCommit).forEach(({ packages }) => {
		packages.forEach(pkg => {
			if (!packageBumps[pkg]) {
				packageBumps[pkg] = 'patch';
			}
		});
	});
  
	// Apply bump rules
	Object.values(packagesByCommit).forEach(({ commit, packages }) => {
		if (!commit.conventional) return;
    
		let bumpType = 'patch'; // default
    
		if (commit.breaking) {
			bumpType = 'major';
		} else if (commit.type === 'feat') {
			bumpType = 'minor';
		}
    
		// Apply the bump to each affected package
		packages.forEach(pkg => {
			const currentBump = packageBumps[pkg];
      
			// Only upgrade bump level, never downgrade
			if (
				bumpType === 'major' || 
        (bumpType === 'minor' && currentBump === 'patch')
			) {
				packageBumps[pkg] = bumpType;
			}
		});
	});
  
	return packageBumps;
}

// Create a changeset file
/**
 *
 */
function createChangeset(packageBumps, commits) {
	if (Object.keys(packageBumps).length === 0) {
		console.log(`${colors.yellow}No packages need version bumps.${colors.reset}`);
		return;
	}
  
	// Create random ID for changeset file
	const changesetId = crypto.randomBytes(3).toString('hex');
  
	// Prepare changeset content
	let changesetContent = '---\n';
  
	// Add package bumps
	Object.entries(packageBumps).forEach(([pkg, bump]) => {
		changesetContent += `"${pkg}": ${bump}\n`;
	});
  
	changesetContent += '---\n\n';
  
	// Add summary from commits
	const conventionalCommits = commits.filter(c => c.conventional);
	if (conventionalCommits.length > 0) {
		changesetContent += 'Changeset created from conventional commits:\n\n';
    
		conventionalCommits.forEach(commit => {
			// Format breaking changes prominently
			if (commit.breaking) {
				changesetContent += `- **BREAKING**: ${commit.subject}\n`;
			} else {
				changesetContent += `- ${commit.type}: ${commit.message}\n`;
			}
		});
	} else {
		changesetContent += 'Auto-generated changeset\n';
	}
  
	// Write to file or display in dry run
	if (dryRun) {
		console.log(`\n${colors.cyan}Would create changeset (dry run):${colors.reset}`);
		console.log(`${colors.dim}---${colors.reset}`);
		console.log(changesetContent);
		console.log(`${colors.dim}---${colors.reset}`);
	} else {
		const changesetDir = path.join(process.cwd(), '.changeset');
		if (!fs.existsSync(changesetDir)) {
			fs.mkdirSync(changesetDir, { recursive: true });
		}
    
		const filePath = path.join(changesetDir, `auto-${changesetId}.md`);
		fs.writeFileSync(filePath, changesetContent);
    
		console.log(`\n${colors.green}✅ Created changeset at ${filePath}${colors.reset}`);
		console.log(`${colors.cyan}Changeset summary:${colors.reset}`);
		Object.entries(packageBumps).forEach(([pkg, bump]) => {
			console.log(`- ${pkg}: ${colors.yellow}${bump}${colors.reset}`);
		});
	}
}

// Main execution
console.log(`${colors.bright}${colors.blue}🔄 Auto-generating changesets from conventional commits${colors.reset}`);
console.log(`${colors.dim}Analyzing commits since: ${sinceOption}${colors.reset}\n`);

try {
	const packages = getPackages();
	console.log(`${colors.cyan}Found ${packages.length} packages${colors.reset}`);
  
	const commits = getConventionalCommits();
	const conventionalCommits = commits.filter(c => c.conventional);
	console.log(`${colors.cyan}Found ${conventionalCommits.length} conventional commits out of ${commits.length} total${colors.reset}`);
  
	console.log(`${colors.dim}Determining affected packages...${colors.reset}`);
	const packagesByCommit = determineAffectedPackages(conventionalCommits, packages);
  
	console.log(`${colors.dim}Calculating required version bumps...${colors.reset}`);
	const packageBumps = determineVersionBumps(packagesByCommit);
  
	createChangeset(packageBumps, conventionalCommits);
  
	if (!dryRun) {
		console.log(`\n${colors.bright}${colors.green}Changeset created successfully!${colors.reset}`);
		console.log(`${colors.dim}Commit this file to include the changes in the next release${colors.reset}`);
	} else {
		console.log(`\n${colors.bright}${colors.yellow}Dry run completed. No changes made.${colors.reset}`);
	}
} catch (error) {
	console.error(`\n${colors.red}❌ Error:${colors.reset}`, error);
	process.exit(1);
} 