import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TEST_FILE = path.join(process.cwd(), 'tests', 'lint-tests', 'test-fix.js');
const BACKUP_FILE = path.join(process.cwd(), 'tests', 'lint-tests', 'test-fix.js.bak');

/**
 * Creates a backup of the test file for restoration after testing
 */
function createBackup() {
	console.log('Creating backup of test file...');
	fs.copyFileSync(TEST_FILE, BACKUP_FILE);
}

/**
 * Restores the test file from backup to ensure it's ready for next test run
 */
function restoreFromBackup() {
	console.log('Restoring test file from backup...');
	fs.copyFileSync(BACKUP_FILE, TEST_FILE);
}

/**
 * Verifies that all ESLint fixes were applied correctly by checking file content
 * @returns {boolean} Whether all fixes were verified successfully
 */
function verifyFixes() {
	const content = fs.readFileSync(TEST_FILE, 'utf8');
	
	// Check for fixed indentation (should use tabs)
	if (content.includes('    ')) {
		console.error('❌ Indentation was not fixed (still using spaces)');
		return false;
	}
	
	// Check for proper blank lines between functions
	if (content.includes('function firstFunction() {\n}\nfunction secondFunction()')) {
		console.error('❌ Missing blank line between functions was not fixed');
		return false;
	}
	
	// Check for extra blank lines within function
	if (content.includes('function extraBlankLines() {\n\n    const x = 1;\n\n    const y = 2;')) {
		console.error('❌ Extra blank lines within function were not fixed');
		return false;
	}
	
	// Check for JSDoc addition
	if (!content.includes('function missingJsDoc() {\n    /**\n     *')) {
		console.error('❌ Missing JSDoc was not added');
		return false;
	}
	
	console.log('✅ All fixes verified successfully');
	return true;
}

/**
 * Main test function that orchestrates the fix test process and handles cleanup
 */
function runFixTest() {
	try {
		// Create backup
		createBackup();
		
		// Run ESLint with --fix
		console.log('Running ESLint with --fix...');
		execSync('pnpm eslint tests/lint-tests/test-fix.js --fix', { stdio: 'inherit' });
		
		// Verify fixes
		const fixesVerified = verifyFixes();
		
		// Restore from backup
		restoreFromBackup();
		
		// Clean up backup file
		fs.unlinkSync(BACKUP_FILE);
		
		if (!fixesVerified) {
			console.error('❌ Fix test failed');
			process.exit(1);
		}
		
		console.log('✅ Fix test completed successfully');
	} catch (error) {
		console.error('❌ Error during fix test:', error);
		// Ensure we restore from backup even if there's an error
		if (fs.existsSync(BACKUP_FILE)) {
			restoreFromBackup();
			fs.unlinkSync(BACKUP_FILE);
		}
		process.exit(1);
	}
}

// Run the test
runFixTest(); 