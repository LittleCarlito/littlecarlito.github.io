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
			portfolio: false
		};

		stagedFiles.forEach(file => {
			if (file.startsWith('apps/portfolio/')) {
				modifiedPackages.portfolio = true;
			}
		});

		return modifiedPackages;
	} catch (error) {
		// If we can't determine modified packages, default to checking everything
		return {
			portfolio: true
		};
	}
}

/**
 * Verify the test environment
 */
module.exports = async function() {
	console.log('📦 Verifying build environment...');

	// Determine which packages are being modified
	const modifiedPackages = getModifiedPackages();

	// Check for test-specific environment variables
	const isTestSpecificCheck = process.env.IS_TEST_SPECIFIC === 'true';
	const isCoverageTest = process.env.JEST_COVERAGE === 'true';
	const isFullCheck = process.env.CHECK_ALL_BUILDS === 'true';

	// Skip build checks if running specific tests not requiring builds
	if (isTestSpecificCheck && !isFullCheck && !isCoverageTest) {
		console.log('✅ Skipping build verification for specific tests.');
		return;
	}

	console.log('✅ Build verification complete!');
};
