const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');

// Force jest to recognize this as a test file
const test = global.test || jest.test;
const describe = global.describe || jest.describe;
const expect = global.expect || jest.expect;
const beforeAll = global.beforeAll || jest.beforeAll;

describe('Package Scripts Binary Check', () => {
	// Store all package.json files and their parsed content
	let packageFiles = [];
  
	// Store all extracted binaries
	let allBinaries = new Set();
  
	// Store the verification results
	let verificationResults = {};
  
	// Known safe commands (these don't need to be checked)
	const safeCommands = [
		'node', 'npm', 'pnpm', 'yarn', 'turbo', 'cd', 'echo', 'touch', 'mkdir', 
		'rm', 'cp', 'mv', 'ls', 'cat', 'find', 'grep', 'git', 'test', 'if', 'else', 'fi'
	];
  
	beforeAll(() => {
		// Find all package.json files in the project
		const repoRoot = path.resolve(__dirname, '../../..');
		packageFiles = glob.sync('**/package.json', {
			cwd: repoRoot,
			ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**']
		}).map(file => path.resolve(repoRoot, file));
    
		// Parse all package.json files
		const packageJsons = packageFiles.map(file => {
			return {
				path: file,
				content: JSON.parse(fs.readFileSync(file, 'utf8'))
			};
		});
    
		// Extract all dlx/npx commands from scripts
		packageJsons.forEach(pkg => {
			if (pkg.content.scripts) {
				Object.values(pkg.content.scripts).forEach(script => {
					// Extract pnpm dlx or npx commands
					const dlxMatches = script.match(/(?:pnpm dlx|npx) ([a-zA-Z0-9_-]+)/g) || [];
					dlxMatches.forEach(match => {
						const binary = match.split(' ').pop();
						allBinaries.add(binary);
					});
				});
			}
		});
    
		// Verify each binary with npm view
		allBinaries.forEach(binary => {
			if (safeCommands.includes(binary)) {
				verificationResults[binary] = { exists: true, message: 'System command' };
				return;
			}
      
			try {
				// Check if package exists on npm
				const result = execSync(`npm view ${binary} bin --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
				const binInfo = JSON.parse(result);
        
				// Check if it has a bin entry (executable)
				if (binInfo && Object.keys(binInfo).length > 0) {
					verificationResults[binary] = { 
						exists: true, 
						hasBin: true,
						message: 'Available on npm with executable' 
					};
				} else {
					// Package exists but has no bin entry
					try {
						// Check if there's a CLI version
						const cliName = `${binary}-cli`;
						const cliResult = execSync(`npm view ${cliName} bin --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
						const cliBinInfo = JSON.parse(cliResult);
            
						if (cliBinInfo && Object.keys(cliBinInfo).length > 0) {
							verificationResults[binary] = { 
								exists: true, 
								hasBin: false,
								alternative: cliName,
								alternativeHasBin: true,
								message: `Package exists but has no executable. Use ${cliName} instead` 
							};
						} else {
							verificationResults[binary] = { 
								exists: true, 
								hasBin: false,
								message: `Package exists but has no executable`
							};
						}
					} catch (cliError) {
						verificationResults[binary] = { 
							exists: true, 
							hasBin: false,
							message: `Package exists but has no executable`
						};
					}
				}
			} catch (error) {
				// If not found directly, check if there's a CLI version
				try {
					const cliName = `${binary}-cli`;
					const cliResult = execSync(`npm view ${cliName} bin --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
					const cliBinInfo = JSON.parse(cliResult);
          
					if (cliBinInfo && Object.keys(cliBinInfo).length > 0) {
						verificationResults[binary] = { 
							exists: false, 
							alternative: cliName,
							alternativeExists: true,
							alternativeHasBin: true,
							message: `Package not found, but ${cliName} exists with executable and should be used instead` 
						};
					} else {
						verificationResults[binary] = { 
							exists: false, 
							alternative: cliName,
							alternativeExists: true,
							alternativeHasBin: false,
							message: `Package not found, ${cliName} exists but has no executable` 
						};
					}
				} catch (alternativeError) {
					verificationResults[binary] = { 
						exists: false, 
						message: `Package not found on npm: ${error.message}` 
					};
				}
			}
		});
	});
  
	test('All package.json files are found and parsed', () => {
		expect(packageFiles.length).toBeGreaterThan(0);
	});
  
	test('All binaries referenced by dlx/npx exist with executable', () => {
		const nonExecutableBinaries = Object.entries(verificationResults)
			.filter(([_, result]) => 
				(result.exists && !result.hasBin && !result.alternativeHasBin) || 
        (!result.exists && (!result.alternativeExists || !result.alternativeHasBin))
			);
      
		if (nonExecutableBinaries.length > 0) {
			console.error('Non-executable binaries:', 
				nonExecutableBinaries.map(([name, result]) => `${name}: ${result.message}`));
		}
    
		// For each binary, test if it exists or has a valid alternative with bin
		allBinaries.forEach(binary => {
			const result = verificationResults[binary];
      
			if (!result) {
				fail(`Missing verification result for binary: ${binary}`);
				return;
			}
      
			const errorMessage = `Binary '${binary}' is not available as an executable on npm. ${
				(result.alternative && result.alternativeHasBin) ? 
					`Consider using '${result.alternative}' instead.` : 
					'No suitable alternative found.'
			}`;
      
			expect(
				(result.exists && result.hasBin) || 
        (result.alternativeExists && result.alternativeHasBin)
			).toBe(true, errorMessage);
		});
	});
  
	test('No package names with -cli alternatives are used directly', () => {
		const packagesWithCliAlternatives = Object.entries(verificationResults)
			.filter(([_, result]) => 
				(result.exists && !result.hasBin && result.alternative && result.alternativeHasBin) ||
        (!result.exists && result.alternativeExists && result.alternativeHasBin)
			);
      
		if (packagesWithCliAlternatives.length > 0) {
			console.warn('Packages with CLI alternatives that should be used instead:', 
				packagesWithCliAlternatives.map(([name, result]) => `${name} -> ${result.alternative}`));
		}
    
		expect(packagesWithCliAlternatives.length).toBe(0, 
			`Some packages need to be replaced with their CLI alternatives: ${
				packagesWithCliAlternatives.map(([binary, result]) => `${binary} -> ${result.alternative}`).join(', ')
			}`);
	});
}); 