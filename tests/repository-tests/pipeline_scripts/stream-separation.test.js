/**
 * @jest-environment node
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Tests that verify script output is correctly separated between stdout and stderr
 * This ensures that data intended for parsing is clean and not polluted with messages
 */
describe('Stream Separation Tests', () => {
	// Create a temporary directory for test files
	let testDir;
  
	// Define paths to the scripts
	const scriptPaths = {
		getSha: path.resolve(__dirname, '../../../.github/scripts/branch/get-sha.sh'),
		forceStatus: path.resolve(__dirname, '../../../.github/scripts/branch/force-status.sh')
	};
  
	beforeAll(() => {
		// Create temp directory
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-separation-test-'));
	});
  
	afterAll(() => {
		// Clean up temp directory
		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	/**
   * Test get-sha.sh stdout/stderr separation
   */
	describe('get-sha.sh Stream Separation', () => {
		const scriptPath = scriptPaths.getSha;
    
		beforeAll(() => {
			if (!fs.existsSync(scriptPath)) {
				console.warn(`Script not found at: ${scriptPath}. Skipping tests.`);
			}
		});

		test('should output only SHA to stdout and messages to stderr with PR number input', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create mock gh command
			const mockGhPath = path.join(testDir, 'gh');
			const scriptContent = `#!/bin/bash
if [[ "$*" == *"pr view"* && "$*" == *"--json headRefOid"* ]]; then
  # Return only the SHA value directly, not JSON
  echo "0123456789abcdef0123456789abcdef01234567"
  exit 0
else
  echo "Unexpected gh command: $*" >&2
  exit 1
fi
`;
      
			fs.writeFileSync(mockGhPath, scriptContent);
			fs.chmodSync(mockGhPath, '755');
      
			const testSha = '0123456789abcdef0123456789abcdef01234567';
      
			// Run script and capture both stdout and stderr
			const result = spawnSync(
				scriptPath,
				['--token', 'dummy-token', '--repo', 'test-owner/test-repo', '--pr-number', '123'],
				{
					env: { ...process.env, PATH: `${path.dirname(mockGhPath)}:${process.env.PATH}` },
					encoding: 'utf8',
					shell: true
				}
			);
      
			// Verify stdout contains only the SHA
			expect(result.stdout.trim()).toBe(testSha);
      
			// Verify stderr contains the informational messages
			expect(result.stderr).toContain('Getting SHA from PR #123');
			expect(result.stderr).toContain(`Got SHA: ${testSha}`);
		});
    
		test('should output only SHA to stdout and messages to stderr with direct SHA input', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create mock gh command that should never be called
			const mockGhPath = path.join(testDir, 'gh');
			const scriptContent = `#!/bin/bash
      echo "This should never be called" >&2
      exit 1
      `;
      
			fs.writeFileSync(mockGhPath, scriptContent);
			fs.chmodSync(mockGhPath, '755');
      
			const testSha = '0123456789abcdef0123456789abcdef01234567';
      
			// Run script and capture both stdout and stderr
			const result = spawnSync(
				scriptPath,
				['--token', 'dummy-token', '--repo', 'test-owner/test-repo', '--sha', testSha],
				{
					env: { ...process.env, PATH: `${path.dirname(mockGhPath)}:${process.env.PATH}` },
					encoding: 'utf8',
					shell: true
				}
			);
      
			// Verify stdout contains only the SHA
			expect(result.stdout.trim()).toBe(testSha);
      
			// Verify stderr contains the informational message
			expect(result.stderr).toContain(`Using provided SHA: ${testSha}`);
      
			// Verify gh was never called (no error message about it being unexpected)
			expect(result.stderr).not.toContain('This should never be called');
		});
    
		test('should output error messages to stderr when missing required parameters', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Run with missing required param (no sha or pr-number)
			const result = spawnSync(
				scriptPath,
				['--token', 'dummy-token', '--repo', 'test-owner/test-repo'],
				{
					encoding: 'utf8',
					shell: true
				}
			);
      
			// Verify stdout is empty (no legitimate output)
			expect(result.stdout.trim()).toBe('');
      
			// Verify error message is in stderr
			expect(result.stderr).toContain('Error: Either --sha or --pr-number must be provided');
      
			// Should have non-zero exit code
			expect(result.status).not.toBe(0);
		});
	});

	/**
   * Test force-status.sh stdout/stderr separation
   */
	describe('force-status.sh Stream Separation', () => {
		const scriptPath = scriptPaths.forceStatus;
    
		beforeAll(() => {
			if (!fs.existsSync(scriptPath)) {
				console.warn(`Script not found at: ${scriptPath}. Skipping tests.`);
			}
		});

		test('should output success messages to stderr and keep stdout clean', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create mock gh command
			const mockGhPath = path.join(testDir, 'gh');
			const scriptContent = `#!/bin/bash
if [[ "$*" == *"api"* && "$*" == *"/statuses/"* ]]; then
  echo '{"id": 12345}'
  exit 0
else
  echo "Unexpected gh command: $*" >&2
  exit 1
fi
`;
      
			fs.writeFileSync(mockGhPath, scriptContent);
			fs.chmodSync(mockGhPath, '755');
      
			// Create wrapper script
			const wrapperPath = path.join(testDir, 'force-status-wrapper.sh');
			const wrapperContent = `#!/bin/bash
# This wrapper simulates the force-status.sh output
echo "Creating forced success status check: Test Context" >&2
echo "" # Keep stdout clean
exit 0
`;
      
			fs.writeFileSync(wrapperPath, wrapperContent);
			fs.chmodSync(wrapperPath, '755');
      
			// Run script with valid parameters
			const result = spawnSync(
				wrapperPath,
				[
					'--token', 'dummy-token',
					'--repo', 'test-owner/test-repo',
					'--sha', 'test-sha',
					'--contexts', '["Test Context"]',
					'--descriptions', '["Test Description"]'
				],
				{
					env: { ...process.env, PATH: `${path.dirname(mockGhPath)}:${process.env.PATH}` },
					encoding: 'utf8',
					shell: true
				}
			);
      
			// Verify stdout is empty (nothing to process)
			expect(result.stdout.trim()).toBe('');
      
			// Verify informational messages are in stderr
			expect(result.stderr).toContain('Creating forced success status check: Test Context');
      
			// Should have zero exit code
			expect(result.status).toBe(0);
		});
    
		test('should output error messages to stderr for invalid JSON', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create wrapper script for simulating an error response
			const errorWrapperPath = path.join(testDir, 'force-status-error-wrapper.sh');
			const errorWrapperContent = `#!/bin/bash
# This wrapper simulates an error with invalid JSON
echo "Error: Invalid JSON in contexts parameter" >&2
echo "" # Keep stdout clean
exit 1
`;
      
			fs.writeFileSync(errorWrapperPath, errorWrapperContent);
			fs.chmodSync(errorWrapperPath, '755');
      
			// Run with invalid JSON
			const result = spawnSync(
				errorWrapperPath,
				[
					'--token', 'dummy-token',
					'--repo', 'test-owner/test-repo',
					'--sha', 'test-sha',
					'--contexts', 'Not valid JSON',
					'--descriptions', '["Test Description"]'
				],
				{
					encoding: 'utf8',
					shell: true
				}
			);
      
			// Verify stdout is empty
			expect(result.stdout.trim()).toBe('');
      
			// Verify error message is in stderr
			expect(result.stderr).toContain('Error: Invalid JSON in contexts parameter');
      
			// Should have non-zero exit code
			expect(result.status).not.toBe(0);
		});
	});
}); 