#!/usr/bin/env node

/**
 * Workflow Branch Reference Validator
 * 
 * This script scans GitHub Actions workflow files for potentially dangerous
 * misuse of branch references in PR creation code.
 * 
 * It detects:
 * 1. When a workflow creates a branch and stores it in env var but later uses github.ref_name
 * 2. When PR head references use static refs in dynamic branch contexts
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');

// Color codes for terminal output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m'
};

// Pattern for detecting branch creation in bash scripts
const BRANCH_CREATION_PATTERNS = [
	/git checkout -b\s+([^&;\s]+)/,
	/BRANCH_NAME\s*=\s*["']?([^"'&;)]+)["']?/,
	/branch_name\s*=\s*["']?([^"'&;)]+)["']?/
];

// Pattern for PR creation commands
const PR_CREATION_PATTERNS = [
	/gh pr create.*?--head\s+([^\s"']+|"[^"]+"|'[^']+')/,
	/PR_URL=\$\(gh pr create.*?--head\s+([^\s"']+|"[^"]+"|'[^']+')/,
	/pull\/([^\s"']+|"[^"]+"|'[^']+')/
];

// Pattern for github.ref_name usage
const GITHUB_REF_PATTERN = /\$\{\{\s*github\.ref_name\s*\}\}/;

/**
 * Check if script is using github.ref_name where it should use env variables
 */
function checkWorkflowFile(filePath) {
	try {
		const content = fs.readFileSync(filePath, 'utf8');
		const workflow = yaml.load(content);
		const issues = [];
    
		// No jobs to check
		if (!workflow.jobs) {
			return { issues, filePath };
		}
    
		// Analyze each job
		Object.entries(workflow.jobs).forEach(([jobName, job]) => {
			if (!job.steps) return;
      
			let branchCreated = false;
			let branchVarName = null;
      
			// First pass: detect if job creates a branch
			job.steps.forEach((step, stepIndex) => {
				if (!step.run) return;
        
				// Check for branch creation patterns
				for (const pattern of BRANCH_CREATION_PATTERNS) {
					const match = step.run.match(pattern);
					if (match) {
						branchCreated = true;
						// Try to extract variable name
						const branchVar = step.run.match(/(\w+)=.+git checkout -b/) || 
                              step.run.match(/BRANCH_NAME=["']?([^"']+)["']?/) ||
                              step.run.match(/branch_name=["']?([^"']+)["']?/);
            
						if (branchVar) {
							branchVarName = branchVar[1];
						}
            
						// Check if the step sets env variable
						if (step.run.includes('GITHUB_ENV') && (
							step.run.includes('branch_name=') || 
                step.run.includes('BRANCH_NAME='))) {
							const envVarMatch = step.run.match(/(\w+)_name.*GITHUB_ENV/) ||
                                step.run.match(/(\w+)=.*GITHUB_ENV/);
							if (envVarMatch) {
								branchVarName = envVarMatch[1].toLowerCase();
							}
						}
					}
				}
			});
      
			// If this job creates a branch, check for github.ref_name in PR creation
			if (branchCreated) {
				job.steps.forEach((step, stepIndex) => {
					if (!step.run) return;
          
					// Check for PR creation patterns
					for (const pattern of PR_CREATION_PATTERNS) {
						const match = step.run.match(pattern);
						if (match && step.run.match(GITHUB_REF_PATTERN)) {
							issues.push({
								job: jobName,
								step: stepIndex + 1,
								message: `Job creates a branch but uses github.ref_name in PR creation. Should likely use \${{ env.${branchVarName || 'branch_name'} }}.`,
								severity: 'error'
							});
						}
					}
				});
			}
		});
    
		return { issues, filePath };
	} catch (error) {
		return {
			issues: [{
				message: `Failed to parse workflow file: ${error.message}`,
				severity: 'error'
			}],
			filePath
		};
	}
}

/**
 * Main function to scan workflow files and report issues
 */
function validateWorkflows() {
	const workflowPath = path.join(process.cwd(), '.github', 'workflows');
  
	// Ensure the workflow directory exists
	if (!fs.existsSync(workflowPath)) {
		console.error(`${colors.red}Error: GitHub workflows directory not found.${colors.reset}`);
		process.exit(1);
	}
  
	// Get all workflow files
	const workflowFiles = glob.sync(`${workflowPath}/**/*.{yml,yaml}`);
  
	if (workflowFiles.length === 0) {
		console.log(`${colors.yellow}No workflow files found.${colors.reset}`);
		process.exit(0);
	}
  
	console.log(`${colors.blue}Analyzing ${workflowFiles.length} workflow files...${colors.reset}`);
  
	// Check each workflow file
	const results = workflowFiles.map(file => checkWorkflowFile(file));
  
	// Filter to only results with issues
	const issueResults = results.filter(result => result.issues.length > 0);
  
	// Display results
	if (issueResults.length === 0) {
		console.log(`${colors.green}✓ No branch reference issues found in workflow files.${colors.reset}`);
		process.exit(0);
	}
  
	// Count total issues
	const totalIssues = issueResults.reduce((sum, result) => sum + result.issues.length, 0);
	console.log(`${colors.red}✗ Found ${totalIssues} potential branch reference issues in ${issueResults.length} files:${colors.reset}`);
  
	// Display each issue
	issueResults.forEach(result => {
		console.log(`\n${colors.magenta}${result.filePath}${colors.reset}`);
    
		result.issues.forEach(issue => {
			const color = issue.severity === 'error' ? colors.red : colors.yellow;
			console.log(`  ${color}• Job '${issue.job}', Step ${issue.step}: ${issue.message}${colors.reset}`);
		});
	});
  
	// Exit with error code if issues found
	process.exit(1);
}

// Run validation
validateWorkflows(); 