/**
 * Tests for GitHub Actions script output handling
 * 
 * Validates that scripts properly redirect logs to stderr
 * and only output structured data to stdout
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');
const { expect } = require('@jest/globals');

describe('GitHub Actions Output Handling', () => {
	// Find script and action files
	const scriptsPath = path.join(process.cwd(), '.github', 'scripts');
	const actionsPath = path.join(process.cwd(), '.github', 'actions');
  
	// Paths may not exist in test environment
	const scriptsExist = fs.existsSync(scriptsPath);
	const actionsExist = fs.existsSync(actionsPath);
  
	/**
	 * Advanced parser to check for proper redirection in shell commands
	 * Handles command groups, pipes, and redirections anywhere in a command
	 */
	function findProblematicCommands(content) {
		// Split the content into lines for analysis
		const lines = content.split('\n');
		const problems = {
			logIssues: 0,
			gitIssues: 0,
			outputVarIssues: 0
		};
		
		// Track multi-line statements
		let continuedLine = '';
		let inMultiLineCommand = false;
		
		for (let i = 0; i < lines.length; i++) {
			// Handle line continuations with backslash
			let line = lines[i].trim();
			
			// Skip comments and empty lines
			if (line.startsWith('#') || !line) continue;
			
			// Handle line continuation
			if (inMultiLineCommand) {
				continuedLine += ' ' + line;
				if (!line.endsWith('\\')) {
					line = continuedLine;
					inMultiLineCommand = false;
					continuedLine = '';
				} else {
					continue;
				}
			} else if (line.endsWith('\\')) {
				inMultiLineCommand = true;
				continuedLine = line.slice(0, -1);
				continue;
			}
			
			// Skip function declarations, if/then/else/fi, and case statements
			if (/^(function|if|\}|\{|then|else|elif|fi|case|esac|for|while|do|done)/.test(line)) continue;
			
			// Now analyze the command for proper redirection
			
			// Check if it's an output variable (key=value pattern)
			// These should NOT be redirected to stderr
			const outputVarPattern = /^(echo|printf)\s+"[A-Za-z0-9_]+=.*"/;
			const isOutputVar = outputVarPattern.test(line);
			
			// Check if it's a log message (not setting a variable)
			// These SHOULD be redirected to stderr
			const isLogCommand = /^(echo|printf)/.test(line) && !isOutputVar;
			
			// Check if it's a git command
			// These SHOULD be redirected to stderr
			const isGitCommand = /^git\s+/.test(line);
			
			// Check for redirection to stderr
			const hasStderrRedirection = isCommandRedirectedToStderr(line);
			
			// Check if it's redirected to stdout explicitly
			// This is valid for output variables
			const hasStdoutRedirection = />\s*\/dev\/stdout/.test(line);
			
			// Apply our rules
			if (isLogCommand && !hasStderrRedirection && !isPartOfPipe(line)) {
				// Skip output variables redirected to stdout explicitly
				if (!(outputVarPattern.test(line) && hasStdoutRedirection)) {
					problems.logIssues++;
				}
			} else if (isGitCommand && !hasStderrRedirection && !isPartOfPipe(line)) {
				problems.gitIssues++;
			} else if (isOutputVar && hasStderrRedirection && !hasStdoutRedirection) {
				problems.outputVarIssues++;
			}
		}
		
		return problems;
	}
	
	/**
	 * Check if a command has proper stderr redirection
	 * Handles various redirection patterns and command grouping
	 */
	function isCommandRedirectedToStderr(command) {
		// Check for any stderr redirection pattern
		const redirectionPatterns = [
			/2>&1\s+>&2/, // Redirects both stdout and stderr to stderr
			/>&2/,        // Redirects stdout to stderr
			/2>&2/,       // Redirects stderr to stderr (redundant but valid)
			/1>&2/        // Redirects stdout to stderr (alternative syntax)
		];
		
		// Look for command groups and handle them properly
		const groupMatches = command.match(/\{([^}]+)\}/g);
		if (groupMatches) {
			// Check each command group for redirection
			for (const group of groupMatches) {
				if (!redirectionPatterns.some(pattern => pattern.test(group))) {
					// If any group lacks redirection, check if the entire construct has it
					if (!redirectionPatterns.some(pattern => 
						pattern.test(command.substring(command.indexOf(group) + group.length)))) {
						return false;
					}
				}
			}
			return true;
		}
		
		// For simple commands, check for any redirection pattern anywhere in the line
		return redirectionPatterns.some(pattern => pattern.test(command));
	}
	
	/**
	 * Check if a command is part of a pipe chain 
	 * (and thus might be redirected by a subsequent command)
	 */
	function isPartOfPipe(command) {
		// Check if the command is part of a pipe
		return command.includes(' | ') || command.endsWith(' |');
	}
	
	test('bash scripts should properly handle output streams', () => {
		if (!scriptsExist) {
			console.warn('Scripts directory not found, skipping test');
			return;
		}
    
		const scriptFiles = glob.sync('**/*.sh', { cwd: scriptsPath });
		const problematicScripts = [];
    
		scriptFiles.forEach(scriptFile => {
			const fullPath = path.join(scriptsPath, scriptFile);
			const content = fs.readFileSync(fullPath, 'utf8');
      
			// Use our enhanced parser to find issues
			const { logIssues, gitIssues, outputVarIssues } = findProblematicCommands(content);
			
			if (logIssues > 0 || gitIssues > 0 || outputVarIssues > 0) {
				problematicScripts.push({
					script: scriptFile,
					logIssues,
					gitIssues,
					outputVarIssues
				});
			}
		});
    
		if (problematicScripts.length > 0) {
			const message = ['Scripts with potential output issues:']
				.concat(problematicScripts.map(({ script, logIssues, gitIssues, outputVarIssues }) => {
					const issues = [];
					if (logIssues > 0) issues.push(`${logIssues} log messages not redirected to stderr`);
					if (gitIssues > 0) issues.push(`${gitIssues} git commands not redirected to stderr`);
					if (outputVarIssues > 0) issues.push(`${outputVarIssues} output variables incorrectly redirected to stderr`);
					return `- ${script}: ${issues.join(', ')}`;
				}))
				.join('\n');
      
			console.log("--- Failing scripts ---");
			console.log(message);
			expect(problematicScripts.length).toBe(0, message);
		}
	});
  
	test('action yaml files should properly capture script output', () => {
		if (!actionsExist) {
			console.warn('Actions directory not found, skipping test');
			return;
		}
    
		const actionFiles = glob.sync('**/action.{yml,yaml}', { cwd: actionsPath });
		const problematicActions = [];
    
		actionFiles.forEach(actionFile => {
			const fullPath = path.join(actionsPath, actionFile);
			const content = fs.readFileSync(fullPath, 'utf8');
      
			try {
				const action = yaml.load(content);
        
				// Skip if no outputs or no steps
				if (!action.outputs || !action.runs || !action.runs.steps) return;
        
				// Action has outputs, check if scripts are properly captured
				const scriptSteps = action.runs.steps.filter(step => 
					step.run && 
					typeof step.run === 'string' && 
					step.run.includes('.github/scripts') && 
					step.run.includes('.sh')
				);
        
				// Check each script step to see if outputs are properly captured
				scriptSteps.forEach(step => {
					const hasProperCapture = 
						step.run.includes('while IFS= read -r line') && 
						step.run.includes('if [[ "$line" == *"="* ]]');
          
					if (!hasProperCapture) {
						problematicActions.push({
							action: actionFile,
							issue: 'Script output not properly captured and processed'
						});
					}
				});
			} catch (error) {
				console.warn(`Failed to parse ${actionFile}: ${error.message}`);
			}
		});
    
		if (problematicActions.length > 0) {
			const message = ['Actions with potential output handling issues:']
				.concat(problematicActions.map(({ action, issue }) => 
					`- ${action}: ${issue}`
				))
				.join('\n');
      
			console.log("--- Failing actions ---");
			console.log(message);
			expect(problematicActions.length).toBe(0, message);
		}
	});
}); 