/**
 * Tests for GitHub Actions output handling
 * 
 * Validates that scripts properly redirect logs to stderr
 * and only output structured data to stdout
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');
const { expect } = require('@jest/globals');

// Enable debug logging with DEBUG=1
const DEBUG = process.env.DEBUG === '1';

describe('GitHub Actions Output Handling', () => {
	// Find script and action files
	const scriptsPath = path.join(process.cwd(), '.github', 'scripts');
	const actionsPath = path.join(process.cwd(), '.github', 'actions');
  
	// Paths may not exist in test environment
	const scriptsExist = fs.existsSync(scriptsPath);
	const actionsExist = fs.existsSync(actionsPath);
  
	// Scripts with known output variable patterns
	const KNOWN_OUTPUT_SCRIPTS = {
		'get-sha.sh': true,
		'wait-checks.sh': true,
		'update-packages.sh': true,
		'validate-status.sh': true
	};
  
	/**
	 * Advanced parser to check for proper redirection in shell commands
	 * Handles command groups, pipes, and redirections anywhere in a command
	 */
	function findProblematicCommands(content, filename) {
		// Process the entire script content for better context
		const scriptTokens = tokenizeScript(content);
		const scriptFunctions = analyzeScriptStructure(scriptTokens);
		
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
		let currentFunction = null;
		
		// Track function context
		for (let i = 0; i < lines.length; i++) {
			// Handle line continuations with backslash
			let line = lines[i].trim();
			
			// Skip comments and empty lines
			if (line.startsWith('#') || !line) continue;
			
			// Track function context
			if (line.startsWith('function ')) {
				const fnName = line.substring('function '.length).split('(')[0].trim();
				currentFunction = fnName;
			} else if (/^[a-zA-Z0-9_]+\(\)/.test(line)) {
				const fnName = line.split('(')[0].trim();
				currentFunction = fnName;
			}
			
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
			
			// Get context - look at adjacent lines to determine if we're in a function
			// that returns output values to the caller
			const context = getCommandContext(lines, i, filename, currentFunction, scriptFunctions);
			
			// Function to check if line is an output variable or value
			const isOutputValue = isLineOutputValue(line, context, filename);
			
			// Check if it's a log message (not setting a variable)
			// These SHOULD be redirected to stderr
			const isLogCommand = /^(echo|printf)/.test(line) && !isOutputValue;
			
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
				problems.logIssues++;
				if (DEBUG) {
					console.log(`[DEBUG] Log without stderr redirection: ${filename}:${i+1} - ${line}`);
				}
			} else if (isGitCommand && !hasStderrRedirection && !isPartOfPipe(line)) {
				problems.gitIssues++;
				if (DEBUG) {
					console.log(`[DEBUG] Git command without stderr redirection: ${filename}:${i+1} - ${line}`);
				}
			} else if (isOutputValue && hasStderrRedirection && !hasStdoutRedirection) {
				problems.outputVarIssues++;
				if (DEBUG) {
					console.log(`[DEBUG] Output variable with stderr redirection: ${filename}:${i+1} - ${line}`);
				}
			}
		}
		
		return problems;
	}
	
	/**
	 * Tokenize a shell script for better analysis
	 */
	function tokenizeScript(content) {
		const lines = content.split('\n');
		const tokens = [];
		let inFunction = false;
		let currentFunctionName = '';
		let currentFunctionLines = [];
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			// Track function declarations
			if (line.startsWith('function ') || /^[a-zA-Z0-9_]+\(\)/.test(line)) {
				if (inFunction) {
					// Save previous function
					tokens.push({
						type: 'function',
						name: currentFunctionName,
						lines: currentFunctionLines
					});
				}
				
				// Start new function
				inFunction = true;
				if (line.startsWith('function ')) {
					currentFunctionName = line.substring('function '.length).split('(')[0].trim();
				} else {
					currentFunctionName = line.split('(')[0].trim();
				}
				currentFunctionLines = [];
			} else if (inFunction && line === '}') {
				// End of function
				tokens.push({
					type: 'function',
					name: currentFunctionName,
					lines: currentFunctionLines
				});
				inFunction = false;
				currentFunctionName = '';
				currentFunctionLines = [];
			} else if (inFunction) {
				// Add line to current function
				currentFunctionLines.push(line);
			} else {
				// Outside of functions
				if (line) {
					tokens.push({
						type: 'line',
						content: line
					});
				}
			}
		}
		
		return tokens;
	}
	
	/**
	 * Analyze script structure to identify getter functions and outputs
	 */
	function analyzeScriptStructure(tokens) {
		const functions = {};
		
		tokens.forEach(token => {
			if (token.type === 'function') {
				const fn = {
					name: token.name,
					isGetter: token.name.startsWith('get_'),
					returnsValue: false,
					outputLines: []
				};
				
				// Analyze function body to detect if it returns a value
				let lastEchoBeforeReturn = null;
				for (let i = 0; i < token.lines.length; i++) {
					const line = token.lines[i].trim();
					if (/^(echo|printf)/.test(line)) {
						lastEchoBeforeReturn = line;
						
						// Check if this echo is likely returning a value
						if (!line.includes('Error:') && !line.includes('Warning:') &&
							(/^echo\s+"\$[a-zA-Z0-9_]+"/.test(line) || 
							/^echo\s+\$[a-zA-Z0-9_]+/.test(line) ||
							/=/.test(line))) {
							fn.outputLines.push(line);
							fn.returnsValue = true;
						}
					} else if (line === 'return 0' || line === 'return $?' || line === 'return') {
						if (lastEchoBeforeReturn && !lastEchoBeforeReturn.includes('>&2')) {
							fn.returnsValue = true;
							if (!fn.outputLines.includes(lastEchoBeforeReturn)) {
								fn.outputLines.push(lastEchoBeforeReturn);
							}
						}
						lastEchoBeforeReturn = null;
					}
				}
				
				functions[token.name] = fn;
			}
		});
		
		return functions;
	}
	
	/**
	 * Check if a line is an output variable or value
	 */
	function isLineOutputValue(line, context, filename) {
		// Output variable patterns
		const keyValuePatterns = [
			/^(echo|printf)\s+"[A-Za-z0-9_]+=.*"/, // key=value with quotes
			/^(echo|printf)\s+[A-Za-z0-9_]+=.*/, // key=value without quotes
			/^printf\s+".*\\n"/ // printf with newline (likely an output)
		];
		
		// Known output variables by file
		const baseFilename = path.basename(filename);
		if (KNOWN_OUTPUT_SCRIPTS[baseFilename]) {
			if (line.startsWith('echo ') && !line.includes('Error:') && !line.includes('Warning:')) {
				return true;
			}
		}
		
		// Check for key=value patterns
		if (keyValuePatterns.some(pattern => pattern.test(line))) {
			return true;
		}
		
		// Check if it's in a getter function and likely a return value
		if (context.isGetter && !line.includes('Error:') && !line.includes('Warning:')) {
			if (line.startsWith('echo ') || line.startsWith('printf ')) {
				return true;
			}
		}
		
		// Check if this is the last echo before a return statement
		if (context.isReturnValue) {
			return true;
		}
		
		// Check for variable-only outputs (likely return values)
		if (/^echo\s+"\$[A-Za-z0-9_]+"$/.test(line) || 
			/^echo\s+\$[A-Za-z0-9_]+$/.test(line)) {
			return true;
		}
		
		// Special pattern: formatted GitHub Actions output
		if (/^echo\s+"[a-z_-]+=.*"\s+>>\s+\$GITHUB_OUTPUT$/.test(line)) {
			return true;
		}
		
		return false;
	}
	
	/**
	 * Analyze the command context to determine if a line is likely an output value
	 * rather than a log message
	 */
	function getCommandContext(lines, currentIndex, filename, currentFunction, scriptFunctions) {
		const context = {
			isReturnValue: false,
			isGetter: false,
			isInOutputBlock: false
		};
		
		// Check if we're in a known getter function
		if (currentFunction && currentFunction.startsWith('get_')) {
			context.isGetter = true;
		}
		
		if (currentFunction && scriptFunctions && scriptFunctions[currentFunction]) {
			context.isGetter = scriptFunctions[currentFunction].isGetter;
			
			// Check if this line is in the list of identified output lines
			const currentLine = lines[currentIndex].trim();
			if (scriptFunctions[currentFunction].outputLines.includes(currentLine)) {
				context.isReturnValue = true;
			}
		}
		
		// Check if the line is immediately before a return statement
		// This is a common pattern for returning values in shell scripts
		if (currentIndex < lines.length - 2) {
			const nextLine = lines[currentIndex + 1].trim();
			if (nextLine === 'return 0' || nextLine === 'return $?' || nextLine === 'return') {
				// Check if this line is an echo/printf without error messages
				const currentLine = lines[currentIndex].trim();
				if ((currentLine.startsWith('echo ') || currentLine.startsWith('printf ')) && 
					!currentLine.includes('Error:') && !currentLine.includes('Warning:')) {
					context.isReturnValue = true;
				}
			}
		}
		
		// Check for comment indicators of output values
		if (currentIndex > 0) {
			const prevLine = lines[currentIndex - 1].trim();
			if (prevLine.startsWith('# Output') || 
				prevLine.includes('# Return value') || 
				prevLine.includes('# output value')) {
				context.isReturnValue = true;
			}
		}
		
		return context;
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
			const { logIssues, gitIssues, outputVarIssues } = findProblematicCommands(content, scriptFile);
      
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