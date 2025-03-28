const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');

describe('Workflow Action Validation', () => {
	const workflowsPath = path.join(process.cwd(), '.github', 'workflows');
	const actionsPath = path.join(process.cwd(), '.github', 'actions');
  
	// Find all workflow files
	const workflowFiles = glob.sync('**/*.{yml,yaml}', { cwd: workflowsPath });
  
	test('all referenced local actions should exist', () => {
		// Track missing actions for better reporting
		const missingActions = [];
    
		// Process each workflow file
		workflowFiles.forEach(file => {
			const workflowPath = path.join(workflowsPath, file);
			const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      
			try {
				const workflow = yaml.load(workflowContent);
        
				// Skip if there are no jobs
				if (!workflow.jobs) return;
        
				// Check each job
				Object.values(workflow.jobs).forEach(job => {
					// Skip if there are no steps
					if (!job.steps) return;
          
					// Check each step
					job.steps.forEach(step => {
						if (step.uses && step.uses.startsWith('./.github/actions/')) {
							// Extract action name
							const actionPath = step.uses.replace('./', '');
							const fullActionPath = path.join(process.cwd(), actionPath);
              
							// Check if action directory exists
							if (!fs.existsSync(fullActionPath)) {
								missingActions.push({
									workflow: file,
									action: step.uses,
									error: `Action directory does not exist: ${actionPath}`
								});
								return;
							}
              
							// Check if action.yml or action.yaml exists
							const hasActionYml = fs.existsSync(path.join(fullActionPath, 'action.yml'));
							const hasActionYaml = fs.existsSync(path.join(fullActionPath, 'action.yaml'));
							const hasDockerfile = fs.existsSync(path.join(fullActionPath, 'Dockerfile'));
              
							if (!hasActionYml && !hasActionYaml && !hasDockerfile) {
								missingActions.push({
									workflow: file,
									action: step.uses,
									error: `Action does not have action.yml, action.yaml, or Dockerfile: ${actionPath}`
								});
							}
						}
					});
				});
			} catch (error) {
				// If we can't parse the workflow, add it to the list of errors
				missingActions.push({
					workflow: file,
					error: `Failed to parse workflow: ${error.message}`
				});
			}
		});
    
		// If there are missing actions, format a nice error message and fail the test
		if (missingActions.length > 0) {
			const errorMessage = ['The following actions referenced in workflows do not exist:']
				.concat(missingActions.map(({ workflow, action, error }) => 
					`- ${workflow}: ${action ? action + ' - ' : ''}${error}`
				))
				.join('\n');
      
			fail(errorMessage);
		}
	});
  
	test('script usage should be consistent', () => {
		const scriptUsageIssues = [];
    
		// Process each workflow file
		workflowFiles.forEach(file => {
			const workflowPath = path.join(workflowsPath, file);
			const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      
			try {
				const workflow = yaml.load(workflowContent);
        
				// Skip if there are no jobs
				if (!workflow.jobs) return;
        
				// Check each job
				Object.values(workflow.jobs).forEach(job => {
					// Skip if there are no steps
					if (!job.steps) return;
          
					// Check each step
					job.steps.forEach(step => {
						if (step.run && typeof step.run === 'string') {
							// Check if the run command directly calls a script without bash prefix
							const scriptMatches = step.run.match(/^\s*\.github\/scripts\/([^/]+)\/([^/\s]+\.sh)/m);
              
							if (scriptMatches) {
								scriptUsageIssues.push({
									workflow: file,
									line: scriptMatches[0].trim(),
									error: 'Script should be called with bash prefix (bash .github/scripts/...)'
								});
							}
						}
					});
				});
			} catch (error) {
				// Skip parse errors as they're handled in the previous test
			}
		});
    
		// If there are script usage issues, format a nice error message and fail the test
		if (scriptUsageIssues.length > 0) {
			const errorMessage = ['The following script usages should be prefixed with bash:']
				.concat(scriptUsageIssues.map(({ workflow, line, error }) => 
					`- ${workflow}: "${line}" - ${error}`
				))
				.join('\n');
      
			fail(errorMessage);
		}
	});
}); 