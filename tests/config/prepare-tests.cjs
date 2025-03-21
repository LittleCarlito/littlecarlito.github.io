#!/usr/bin/env node

/**
 * Test environment verification script
 * Simply checks if required builds exist before running tests
 */

const fs = require('fs');
const path = require('path');

/**
 * Verify the test environment
 */
module.exports = async function() {
	console.log('📦 Verifying build environment...');

	// Define paths
	const ROOT_DIR = path.resolve(__dirname, '../..');
	const BLORKPACK_DIST = path.join(ROOT_DIR, 'packages/blorkpack/dist');
	const BLORKTOOLS_DIST = path.join(ROOT_DIR, 'packages/blorktools/dist');

	// Check if packages are built
	if (!fs.existsSync(BLORKPACK_DIST) || !fs.existsSync(path.join(BLORKPACK_DIST, 'index.js'))) {
		console.error('❌ Error: blorkpack package is not built. Run "pnpm --filter @littlecarlito/blorkpack build" first.');
		process.exit(1);
	}

	if (!fs.existsSync(BLORKTOOLS_DIST)) {
		console.error('❌ Error: blorktools package is not built. Run "pnpm --filter @littlecarlito/blorktools build" first.');
		process.exit(1);
	}

	console.log('✅ Build verification complete!');
}; 