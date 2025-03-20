#!/usr/bin/env node

/**
 * Semantic Version Check Script
 * 
 * This script runs semantic-release in dry-run mode for the root project 
 * and all subpackages to show developers what would be released.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

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

/**
 * Runs semantic-release dry-run in the specified directory
 * @param {string} dir - Directory to run in 
 * @param {string} name - Name of the package
 */
function runDryRun(dir, name) {
	console.log(`\n${colors.bright}${colors.cyan}Running semantic-release dry-run for ${name}${colors.reset}`);
	console.log(`${colors.yellow}===============================================${colors.reset}`);
  
	try {
		// Create a temporary .releaserc.json for the dry run
		const releaseConfigCommand = `cat > ${dir}/.releaserc.temp.json << 'EOF'
{
  "branches": ["main"],
  "plugins": [
    ["@semantic-release/commit-analyzer", {
      "preset": "angular",
      "releaseRules": [
        {"type": "feat", "release": "minor"},
        {"type": "fix", "release": "patch"},
        {"type": "perf", "release": "patch"},
        {"scope": "no-release", "release": false},
        {"type": "docs", "release": "patch"},
        {"type": "style", "release": "patch"},
        {"type": "refactor", "release": "patch"},
        {"type": "test", "release": "patch"},
        {"type": "chore", "release": "patch"},
        {"type": "build", "release": "patch"}
      ]
    }],
    "@semantic-release/release-notes-generator"
  ]
}
EOF`;
    
		execSync(releaseConfigCommand, { stdio: 'ignore' });
    
		// Run the dry-run with the temporary config
		const output = execSync(
			`cd ${dir} && pnpm semantic-release --dry-run --no-ci --extends ./.releaserc.temp.json`, 
			{ encoding: 'utf8' }
		);
    
		// Parse the output to extract the version information
		if (output.includes('There is no new release')) {
			console.log(`${colors.yellow}No new release would be created for ${name}${colors.reset}`);
		} else {
			const versionMatch = output.match(/The next release version is (\d+\.\d+\.\d+)/);
			const typeMatch = output.match(/Release type: (\w+)/);
      
			if (versionMatch && typeMatch) {
				const version = versionMatch[1];
				const releaseType = typeMatch[1];
				console.log(`${colors.green}${name} would be released as version ${version} (${releaseType})${colors.reset}`);
			} else {
				console.log(`${colors.green}A new release would be created for ${name}${colors.reset}`);
			}
		}
    
		// Clean up the temporary file
		execSync(`rm ${dir}/.releaserc.temp.json`, { stdio: 'ignore' });
	} catch (error) {
		console.error(`${colors.red}Error running semantic-release for ${name}:${colors.reset}`);
		console.error(error.stdout?.toString() || error.message);
	}
}

// Main function
/**
 *
 */
async function main() {
	console.log(`${colors.bright}${colors.magenta}Semantic Version Check${colors.reset}`);
	console.log(`${colors.blue}Checking what would be released by semantic-release...${colors.reset}`);
  
	// Check root project
	const rootDir = process.cwd();
	runDryRun(rootDir, 'root project');
  
	// Check blorkpack if it exists
	const blorkpackDir = resolve(rootDir, 'packages/blorkpack');
	if (existsSync(blorkpackDir)) {
		runDryRun(blorkpackDir, 'blorkpack');
	}
  
	// Check blorktools if it exists
	const blorktoolsDir = resolve(rootDir, 'packages/blorktools');
	if (existsSync(blorktoolsDir)) {
		runDryRun(blorktoolsDir, 'blorktools');
	}
  
	console.log(`\n${colors.bright}${colors.green}Version check complete!${colors.reset}`);
}

main().catch(error => {
	console.error(`${colors.red}Error:${colors.reset}`, error);
	process.exit(1);
}); 