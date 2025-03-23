#!/usr/bin/env node

/**
 * This script verifies that the pnpm lockfile is in sync with package.json
 * It's meant to be run as part of the pre-push hook to prevent pushes with out-of-date lockfiles
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the repository root directory
const rootDir = path.resolve(__dirname, '../..');

try {
	console.log('🔍 Verifying pnpm lockfile integrity...');
  
	// Run pnpm install in frozen-lockfile mode and capture the output
	execSync('pnpm install --frozen-lockfile', { 
		cwd: rootDir,
		stdio: ['pipe', 'pipe', 'pipe'] 
	});
  
	console.log('✅ Lockfile is up to date with package.json');
	process.exit(0);
} catch (error) {
	const errorOutput = error.stderr ? error.stderr.toString() : '';
  
	if (errorOutput.includes('ERR_PNPM_OUTDATED_LOCKFILE')) {
		console.error('❌ The lockfile is out of sync with package.json');
		console.error('');
		console.error('Fix this by running:');
		console.error('  pnpm install --no-frozen-lockfile');
		console.error('');
		console.error('Then commit the updated pnpm-lock.yaml file');
	} else {
		console.error('❌ An unexpected error occurred while checking the lockfile:');
		console.error(errorOutput || error.message);
	}
  
	process.exit(1);
} 