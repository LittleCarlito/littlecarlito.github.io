const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the root directory
const rootDir = path.resolve(__dirname, '../..');
const lockfilePath = path.resolve(rootDir, 'pnpm-lock.yaml');

// Verify the lockfile exists
if (!fs.existsSync(lockfilePath)) {
	console.error('Error: pnpm-lock.yaml not found');
	process.exit(1);
}

// Try to do a frozen install and expect it to succeed
let installSucceeded = false;
let errorOutput = '';

try {
	// Run with reduced output and capture stderr
	execSync('pnpm install --frozen-lockfile', { 
		cwd: rootDir,
		stdio: ['ignore', 'ignore', 'pipe']
	});
	installSucceeded = true;
} catch (error) {
	errorOutput = error.stderr.toString();
	
	// Check if this is the specific lockfile error
	if (errorOutput.includes('ERR_PNPM_OUTDATED_LOCKFILE')) {
		// Extract the specific packages that are out of sync for a better error message
		const packageMatches = errorOutput.match(/specifiers in the lockfile.*don't match specs in package\.json/);
		const specificIssue = packageMatches ? packageMatches[0] : 'Lockfile is out of sync with package.json';
		
		// Output error and exit
		console.error(`Lockfile is out of sync with package.json.\n\n` +
			`${specificIssue}\n\n` +
			`To fix this, run: pnpm update-lockfile\n` +
			`Then commit the updated pnpm-lock.yaml file`);
		process.exit(1);
	}
	
	// If it's some other error, just pass the error through
	console.error(error.message);
	process.exit(1);
}

if (installSucceeded) {
	console.log('✅ Lockfile is in sync with package.json');
	process.exit(0);
} else {
	console.error('❌ Failed to verify lockfile');
	process.exit(1);
} 