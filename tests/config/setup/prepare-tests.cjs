#!/usr/bin/env node

/**
 * Test environment verification script
 * Only checks if required builds exist for packages being modified
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper function to determine which packages are being changed in the current commit
 */
function getModifiedPackages() {
	try {
		// Get staged files that are about to be committed
		const stagedFiles = execSync('git diff --cached --name-only').toString().trim().split('\n');
		
		// Identify which packages are being modified
		const modifiedPackages = {
			blorkpack: false,
			blorktools: false,
			blorkvisor: false,
			portfolio: false
		};
		
		stagedFiles.forEach(file => {
			if (file.startsWith('packages/blorkpack/')) {
				modifiedPackages.blorkpack = true;
			} else if (file.startsWith('packages/blorkvisor/')) {
				modifiedPackages.blorkvisor = true;
			} else if (file.startsWith('packages/blorktools/')) {
				modifiedPackages.blorktools = true;
			} else if (file.startsWith('apps/portfolio/')) {
				modifiedPackages.portfolio = true;
			}
		});
		
		return modifiedPackages;
	} catch (error) {
		// If we can't determine modified packages, default to checking everything
		return {
			blorkpack: true,
			blorktools: true,
			blorkvisor: true,
			portfolio: true
		};
	}
}

/**
 * Verify the test environment
 */
module.exports = async function() {
	console.log('📦 Verifying build environment...');

	// Define paths
	const ROOT_DIR = path.resolve(__dirname, '../../..');
	const BLORKPACK_DIST = path.join(ROOT_DIR, 'packages/blorkpack/dist');
	const BLORKTOOLS_DIST = path.join(ROOT_DIR, 'packages/blorktools/dist');

	// Determine which packages are being modified
	const modifiedPackages = getModifiedPackages();
	let allBuildsVerified = true;

	// Check for test-specific environment variables 
	const isTestSpecificCheck = process.env.IS_TEST_SPECIFIC === 'true';
	const isCoverageTest = process.env.JEST_COVERAGE === 'true';
	const isFullCheck = process.env.CHECK_ALL_BUILDS === 'true';
	
	// Skip build checks if running specific tests not requiring builds
	if (isTestSpecificCheck && !isFullCheck && !isCoverageTest) {
		console.log('✅ Skipping build verification for specific tests.');
		return;
	}
	
	// Only verify blorkpack if it's being modified or it's a full check
	if (modifiedPackages.blorkpack || isFullCheck) {
		if (!fs.existsSync(BLORKPACK_DIST) || !fs.existsSync(path.join(BLORKPACK_DIST, 'index.js'))) {
			console.error('❌ Error: blorkpack package is not built. Run "pnpm --filter @littlecarlito/blorkpack build" first.');
			allBuildsVerified = false;
		}
	}

	// Only verify blorktools if it's being modified or it's a full check
	if (modifiedPackages.blorktools || isFullCheck) {
		if (!fs.existsSync(BLORKTOOLS_DIST)) {
			console.error('❌ Error: blorktools package is not built. Run "pnpm --filter @littlecarlito/blorktools build" first.');
			allBuildsVerified = false;
		}
	}

	if (!allBuildsVerified) {
		process.exit(1);
	}

	console.log('✅ Build verification complete!');
}; 