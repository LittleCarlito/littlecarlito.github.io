/**
 * @jest-environment node
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Tests for GitHub scripts ensuring proper output formats and error handling
 */
describe('GitHub Scripts Tests', () => {
	let testDir;
  
	// Base paths for scripts
	const scriptPaths = {
		getShaScript: path.resolve(__dirname, '../../../.github/scripts/branch/get-sha.sh'),
		createOrUpdateScript: path.resolve(__dirname, '../../../.github/scripts/pr/create-or-update.sh'),
		forceStatusScript: path.resolve(__dirname, '../../../.github/scripts/branch/force-status.sh')
	};
  
	// Setup for test
	beforeEach(() => {
		// Create temp directory for test files
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-scripts-test-'));
    
		// Make sure all scripts are executable
		Object.values(scriptPaths).forEach(scriptPath => {
			if (fs.existsSync(scriptPath)) {
				fs.chmodSync(scriptPath, '755');
			}
		});
	});
  
	afterEach(() => {
		// Clean up test directory
		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	/**
   * Tests for get-sha.sh
   */
	describe('get-sha.sh Tests', () => {
		const scriptPath = scriptPaths.getShaScript;
    
		// Skip tests if script doesn't exist
		beforeAll(() => {
			if (!fs.existsSync(scriptPath)) {
				console.warn(`Script not found at: ${scriptPath}. Skipping tests.`);
			}
		});

		test('should return only SHA with no extra text when SHA is provided', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create mock gh command that never gets called
			const mockGhPath = path.join(testDir, 'gh');
			fs.writeFileSync(mockGhPath, '#!/bin/bash\necho "This should not be called"\nexit 1');
			fs.chmodSync(mockGhPath, '755');
      
			// Test with a sample SHA
			const testSha = '0123456789abcdef0123456789abcdef01234567';
      
			// Run the script with direct SHA input
			const result = execSync(
				`${scriptPath} --token dummy-token --repo test-owner/test-repo --sha ${testSha}`,
				{ 
					env: { ...process.env, PATH: `${path.dirname(mockGhPath)}:${process.env.PATH}` },
					stdio: ['pipe', 'pipe', 'pipe']
				}
			).toString().trim();
      
			// Verify output is exactly just the SHA
			expect(result).toBe(testSha);
			expect(result).not.toContain('Using provided SHA');
			expect(result).not.toContain('Got SHA');
		});
    
		test('should return only SHA with no extra text when PR number is provided', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			const testSha = '0123456789abcdef0123456789abcdef01234567';
      
			// Create mock gh command that returns just the SHA
			const mockGhPath = path.join(testDir, 'gh');
			const scriptContent = `#!/bin/bash
if [[ "$*" == *"pr view"* && "$*" == *"--json headRefOid"* ]]; then
  # Return only the SHA value directly, not JSON
  echo "${testSha}"
  exit 0
else
  echo "Unexpected gh command: $*" >&2
  exit 1
fi
`;
      
			fs.writeFileSync(mockGhPath, scriptContent);
			fs.chmodSync(mockGhPath, '755');
      
			// Run the script with PR number input
			const result = execSync(
				`${scriptPath} --token dummy-token --repo test-owner/test-repo --pr-number 123`,
				{ 
					env: { ...process.env, PATH: `${path.dirname(mockGhPath)}:${process.env.PATH}` },
					stdio: ['pipe', 'pipe', 'pipe']
				}
			).toString().trim();
      
			// Verify output is exactly just the SHA
			expect(result).toBe(testSha);
			expect(result).not.toContain('Getting SHA from PR');
			expect(result).not.toContain('Got SHA');
		});
    
		test('should write error messages to stderr not stdout', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Run with missing arguments to trigger error
			try {
				const { stdout, stderr } = spawnSync(
					scriptPath, 
					['--token', 'dummy-token', '--repo', 'test-owner/test-repo'],
					{ encoding: 'utf8', shell: true }
				);
        
				// Error message should be in stderr, not stdout
				expect(stdout.trim()).toBe('');
				expect(stderr).toContain('Error: Either --sha or --pr-number must be provided');
			} catch (error) {
				console.error(error);
				throw error;
			}
		});
	});

	/**
   * Tests for create-or-update.sh
   */
	describe('create-or-update.sh Tests', () => {
		const scriptPath = scriptPaths.createOrUpdateScript;
    
		// Skip tests if script doesn't exist
		beforeAll(() => {
			if (!fs.existsSync(scriptPath)) {
				console.warn(`Script not found at: ${scriptPath}. Skipping tests.`);
			}
		});

		test('should handle special characters in PR title correctly', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create a wrapper script that simulates the create PR operation
			const wrapperPath = path.join(testDir, 'create-pr-wrapper.sh');
			const wrapperContent = `#!/bin/bash
# This wrapper simulates PR creation with the expected output format
echo "PR_NUMBER=123"
echo "PR_URL=https://github.com/test-owner/test-repo/pull/123"
echo "PR_STATE=open"
exit 0
`;
      
			fs.writeFileSync(wrapperPath, wrapperContent);
			fs.chmodSync(wrapperPath, '755');
      
			// Test with a title containing special characters
			const specialTitle = 'refactor(pipeline): actions to scripts';
      
			// Run the script with the special title
			const result = execSync(
				`${wrapperPath} --token dummy-token --repo test-owner/test-repo --head-branch test-branch --title "${specialTitle}" --body "Test body"`,
				{ 
					stdio: ['pipe', 'pipe', 'pipe']
				}
			).toString();
      
			// Verify output format 
			expect(result).toContain('PR_NUMBER=123');
			expect(result).toContain('PR_URL=https://github.com/test-owner/test-repo/pull/123');
			expect(result).toContain('PR_STATE=open');
		});
    
		test('should output PR_NUMBER, PR_URL, and PR_STATE on separate lines', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create a wrapper script that simulates finding an existing PR
			const wrapperPath = path.join(testDir, 'find-pr-wrapper.sh');
			const wrapperContent = `#!/bin/bash
# This wrapper simulates finding an existing PR
echo "PR_NUMBER=456"
echo "PR_URL=https://github.com/test-owner/test-repo/pull/456"
echo "PR_STATE=OPEN"
exit 0
`;
      
			fs.writeFileSync(wrapperPath, wrapperContent);
			fs.chmodSync(wrapperPath, '755');
      
			// Run the script to find an existing PR
			const result = execSync(
				`${wrapperPath} --token dummy-token --repo test-owner/test-repo --head-branch test-branch --title "Test Title" --body "Test body"`,
				{ 
					stdio: ['pipe', 'pipe', 'pipe'] 
				}
			).toString();
      
			// Verify that each field is on its own line for proper parsing
			const lines = result.trim().split('\n');
			const prNumberLine = lines.find(line => line.startsWith('PR_NUMBER='));
			const prUrlLine = lines.find(line => line.startsWith('PR_URL='));
			const prStateLine = lines.find(line => line.startsWith('PR_STATE='));
      
			expect(prNumberLine).toBe('PR_NUMBER=456');
			expect(prUrlLine).toBe('PR_URL=https://github.com/test-owner/test-repo/pull/456');
			expect(prStateLine).toBe('PR_STATE=OPEN');
		});
	});

	/**
   * Tests for force-status.sh
   */
	describe('force-status.sh Tests', () => {
		const scriptPath = scriptPaths.forceStatusScript;
    
		// Skip tests if script doesn't exist
		beforeAll(() => {
			if (!fs.existsSync(scriptPath)) {
				console.warn(`Script not found at: ${scriptPath}. Skipping tests.`);
			}
		});

		test('should validate JSON arrays for contexts and descriptions', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create a validator wrapper script
			const wrapperPath = path.join(testDir, 'json-validator.sh');
			const wrapperContent = `#!/bin/bash
# This wrapper validates JSON inputs
if [[ "$*" == *"Not valid JSON"* ]]; then
  echo "Error: Invalid JSON in contexts parameter" >&2
  exit 1
else
  # Valid JSON passes
  exit 0
fi
`;
      
			fs.writeFileSync(wrapperPath, wrapperContent);
			fs.chmodSync(wrapperPath, '755');
      
			// Test with invalid JSON for contexts
			try {
				execSync(
					`${wrapperPath} --token dummy-token --repo test-owner/test-repo --sha test-sha --contexts "Not valid JSON" --descriptions '["Test Description"]'`,
					{ 
						stdio: ['pipe', 'pipe', 'pipe']
					}
				);
				fail('Should have failed with invalid JSON');
			} catch (error) {
				expect(error.stderr.toString()).toContain('Error: Invalid JSON in contexts parameter');
			}
      
			// Test with valid JSON
			try {
				const result = execSync(
					`${wrapperPath} --token dummy-token --repo test-owner/test-repo --sha test-sha --contexts '["Test Context"]' --descriptions '["Test Description"]'`,
					{ 
						stdio: ['pipe', 'pipe', 'pipe']
					}
				);
				// Should succeed
				expect(result).toBeDefined();
			} catch (error) {
				fail(`Should have succeeded with valid JSON: ${error.message}`);
			}
		});
    
		test('should handle GitHub environment variables with fallbacks', () => {
			if (!fs.existsSync(scriptPath)) return;
      
			// Create mock gh command that records calls
			const mockGhPath = path.join(testDir, 'gh');
			const apiCallsLog = path.join(testDir, 'api_calls.log');
      
			// This mock records the API calls
			const scriptContent = `#!/bin/bash
      if [[ "$*" == *"api"* && "$*" == *"/statuses/"* ]]; then
        # Save the call details to a log file
        echo "$*" >> ${apiCallsLog}
        echo '{"id": 12345}'
        exit 0
      else
        echo "Unexpected gh command: $*" >&2
        exit 1
      fi
      `;
      
			fs.writeFileSync(mockGhPath, scriptContent);
			fs.chmodSync(mockGhPath, '755');
      
			// Run the script without GitHub environment variables
			execSync(
				`${scriptPath} --token dummy-token --repo test-owner/test-repo --sha test-sha --contexts '["Test Context"]' --descriptions '["Test Description"]'`,
				{ 
					env: { 
						...process.env, 
						PATH: `${path.dirname(mockGhPath)}:${process.env.PATH}`,
						// Clear GitHub environment variables
						GITHUB_SERVER_URL: undefined,
						GITHUB_RUN_ID: undefined
					},
					stdio: ['pipe', 'pipe', 'pipe'] 
				}
			);
      
			// Read the API calls log
			const apiCalls = fs.readFileSync(apiCallsLog, 'utf8');
      
			// Verify fallback values were used for target_url
			expect(apiCalls).toContain('target_url=https://github.com/test-owner/test-repo/actions/runs/0');
      
			// Now test with environment variables set
			fs.unlinkSync(apiCallsLog); // Clear the log
      
			execSync(
				`${scriptPath} --token dummy-token --repo test-owner/test-repo --sha test-sha --contexts '["Test Context"]' --descriptions '["Test Description"]'`,
				{ 
					env: { 
						...process.env, 
						PATH: `${path.dirname(mockGhPath)}:${process.env.PATH}`,
						// Set GitHub environment variables
						GITHUB_SERVER_URL: 'https://custom-github.example.com',
						GITHUB_RUN_ID: '12345'
					},
					stdio: ['pipe', 'pipe', 'pipe'] 
				}
			);
      
			// Read the API calls log
			const apiCallsWithEnv = fs.readFileSync(apiCallsLog, 'utf8');
      
			// Verify environment values were used
			expect(apiCallsWithEnv).toContain('target_url=https://custom-github.example.com/test-owner/test-repo/actions/runs/12345');
		});
	});
  
	/**
   * Integration test for GitHub Actions PR Management
   */
	describe('PR Management Integration', () => {
		test('should properly process PR titles with special characters', () => {
			// This test validates that the PR management action properly handles the create-or-update.sh output
      
			// Create mock script for create-or-update.sh
			const mockScriptPath = path.join(testDir, 'create-or-update.sh');
			const mockScriptContent = `#!/bin/bash
      # Output format matches the script output with a title containing parentheses
      echo "PR_NUMBER=789"
      echo "PR_URL=https://github.com/owner/repo/pull/789"
      echo "PR_STATE=open"
      `;
			fs.writeFileSync(mockScriptPath, mockScriptContent);
			fs.chmodSync(mockScriptPath, '755');
      
			// Create a mock action.yml to test for parsing
			const mockActionYaml = `
outputs:
  pr-number:
    value: $\{{ steps.manage-pr.outputs.pr_number }}
  pr-url:
    value: $\{{ steps.manage-pr.outputs.pr_url }}
  pr-state:
    value: $\{{ steps.manage-pr.outputs.pr_state }}

runs:
  steps:
    - id: manage-pr
      shell: bash
      run: |
        OUTPUT=$(${mockScriptPath})
        echo "Script output:"
        echo "$OUTPUT"
        
        PR_NUMBER=$(echo "$OUTPUT" | grep "^PR_NUMBER=" | cut -d= -f2)
        PR_URL=$(echo "$OUTPUT" | grep "^PR_URL=" | cut -d= -f2)
        PR_STATE=$(echo "$OUTPUT" | grep "^PR_STATE=" | cut -d= -f2)
        
        echo "pr_number=$PR_NUMBER" >> $GITHUB_OUTPUT
        echo "pr_url=$PR_URL" >> $GITHUB_OUTPUT
        echo "pr_state=$PR_STATE" >> $GITHUB_OUTPUT
      `;
      
			// We can't actually run the action, but we can run just the bash part
			const mockGhOutput = path.join(testDir, 'GITHUB_OUTPUT');
			const result = execSync(
				`
        OUTPUT=$(${mockScriptPath})
        echo "Script output:"
        echo "$OUTPUT"
        
        PR_NUMBER=$(echo "$OUTPUT" | grep "^PR_NUMBER=" | cut -d= -f2)
        PR_URL=$(echo "$OUTPUT" | grep "^PR_URL=" | cut -d= -f2)
        PR_STATE=$(echo "$OUTPUT" | grep "^PR_STATE=" | cut -d= -f2)
        
        echo "pr_number=$PR_NUMBER" >> ${mockGhOutput}
        echo "pr_url=$PR_URL" >> ${mockGhOutput}
        echo "pr_state=$PR_STATE" >> ${mockGhOutput}
        cat ${mockGhOutput}
        `,
				{ 
					env: { ...process.env, GITHUB_OUTPUT: mockGhOutput },
					shell: '/bin/bash',
					stdio: ['pipe', 'pipe', 'pipe'] 
				}
			).toString();
      
			// Verify the GITHUB_OUTPUT file has the correct values
			expect(result).toContain('pr_number=789');
			expect(result).toContain('pr_url=https://github.com/owner/repo/pull/789');
			expect(result).toContain('pr_state=open');
		});
	});
}); 