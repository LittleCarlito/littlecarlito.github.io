#!/usr/bin/env node

/**
 * Helper script to create a changeset with standard options
 * 
 * Usage: 
 *   node scripts/create-changeset.js
 * 
 * This will guide you through creating a changeset interactively
 */

import { execSync } from 'child_process';

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

console.log(`${colors.bright}${colors.blue}🦋 Creating a new changeset${colors.reset}`);
console.log(`${colors.dim}This will guide you through adding a changeset which will result in a version bump and changelog entry${colors.reset}\n`);

try {
	// Run the changeset command
	execSync('pnpm changeset', { stdio: 'inherit' });
  
	console.log(`\n${colors.green}✅ Changeset created successfully!${colors.reset}`);
	console.log(`${colors.dim}The changeset file has been created in the .changeset directory${colors.reset}`);
	console.log(`${colors.dim}Commit this file to include it in the next release${colors.reset}\n`);
  
	console.log(`${colors.cyan}What's next?${colors.reset}`);
	console.log(`1. Review the changeset file in the .changeset directory`);
	console.log(`2. Commit and push your changes`);
	console.log(`3. When you merge to main, a PR will be created with version bumps`);
	console.log(`4. When that PR is merged, packages will be released`);
} catch (error) {
	console.error(`\n${colors.red}❌ Error creating changeset:${colors.reset}`, error.message);
	process.exit(1);
} 