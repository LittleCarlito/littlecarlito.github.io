const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');

const WORKFLOWS_DIR = path.join(process.cwd(), '.github', 'workflows');

describe('GitHub Workflows Validation', () => {
	const workflowFiles = glob.sync(`${WORKFLOWS_DIR}/**/*.{yml,yaml}`);
  
	test('should find at least one workflow file', () => {
		expect(workflowFiles.length).toBeGreaterThan(0);
	});
  
	workflowFiles.forEach(filePath => {
		describe(`Workflow: ${path.basename(filePath)}`, () => {
			let workflow;
      
			beforeAll(() => {
				try {
					// Import the workflow file directly using Jest's module system
					// This ensures the file is instrumented for coverage
					workflow = require(filePath);
				} catch (error) {
					console.error(`Failed to parse ${filePath}: ${error.message}`);
				}
			});
      
			test('should have valid YAML structure', () => {
				expect(workflow).toBeDefined();
			});
      
			test('should have a name property', () => {
				expect(workflow.name).toBeDefined();
				expect(typeof workflow.name).toBe('string');
			});
      
			test('should have valid on triggers', () => {
				expect(workflow.on).toBeDefined();
			});
      
			test('should have at least one job', () => {
				expect(workflow.jobs).toBeDefined();
				expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
			});
      
			test('should not use github.ref_name in PR creation after branch creation', () => {
				// Skip if no jobs
				if (!workflow.jobs) return;
        
				Object.entries(workflow.jobs).forEach(([jobName, job]) => {
					// Skip if no steps
					if (!job.steps) return;
          
					let branchCreated = false;
					let branchVarName = null;
          
					// Check if any step creates a branch
					job.steps.forEach(step => {
						if (!step.run) return;
            
						if (
							step.run.includes('git checkout -b') || 
              step.run.includes('BRANCH_NAME=') || 
              step.run.includes('branch_name=')
						) {
							branchCreated = true;
              
							// Extract branch var name if set to env
							if (step.run.includes('GITHUB_ENV')) {
								const match = step.run.match(/(\w+)_name=.*GITHUB_ENV/) || 
                              step.run.match(/(\w+)=.*GITHUB_ENV/);
								if (match) {
									branchVarName = match[1].toLowerCase();
								}
							}
						}
					});
          
					// If branch was created, check that github.ref_name is not used for PR creation
					if (branchCreated) {
						job.steps.forEach(step => {
							if (!step.run) return;
              
							const hasPrCreation = step.run.includes('gh pr create') || 
                                   step.run.includes('PR_URL=');
              
							const hasGithubRefUsage = step.run.includes('github.ref_name');
              
							if (hasPrCreation && hasGithubRefUsage) {
								// This should make the test fail
								expect(step.run).not.toContain('github.ref_name');
							}
						});
					}
				});
			});
		});
	});
}); 