const fs = require('fs');
const path = require('path');
const glob = require('glob');
const jsYaml = require('js-yaml');
const { execSync } = require('child_process');

// Force Jest to recognize this as a test file
const test = global.test || jest.test;
const describe = global.describe || jest.describe;
const expect = global.expect || jest.expect;

// Helper function to determine which packages are being changed in the current commit
/**
 *
 */
function getModifiedPackages() {
	try {
		// Get staged files that are about to be committed
		const stagedFiles = execSync('git diff --cached --name-only').toString().trim().split('\n');
		
		// Identify which packages are being modified
		const modifiedPackages = new Set();
		
		stagedFiles.forEach(file => {
			if (file.startsWith('packages/blorkpack/')) {
				modifiedPackages.add('blorkpack');
			} else if (file.startsWith('packages/blorkboard/')) {
				modifiedPackages.add('blorkboard');
			} else if (file.startsWith('packages/blorktools/')) {
				modifiedPackages.add('blorktools');
			} else if (file.startsWith('apps/portfolio/')) {
				modifiedPackages.add('portfolio');
			}
		});
		
		return modifiedPackages;
	} catch (error) {
		console.warn('Error detecting modified packages:', error.message);
		// Return empty set as fallback
		return new Set();
	}
}

// Determine which packages require build verification
const packagesToVerify = getModifiedPackages();
const shouldVerifyBuilds = packagesToVerify.size > 0;

// Helper to check if a package's build output exists
/**
 *
 */
function verifyPackageIsBuilt(packageName) {
	try {
		const distPath = path.resolve(__dirname, '../../packages', packageName, 'dist');
		if (!fs.existsSync(distPath)) {
			throw new Error(`${packageName} package is not built. Run "pnpm --filter @littlecarlito/${packageName} build" first.`);
		}
		return true;
	} catch (error) {
		console.error(`❌ ${error.message}`);
		return false;
	}
}

describe('Build Dependencies', () => {
	// Only verify builds if packages are actually being modified
	if (shouldVerifyBuilds) {
		test('modified packages are properly built', () => {
			packagesToVerify.forEach(packageName => {
				if (packageName === 'blorkpack') {
					expect(verifyPackageIsBuilt('blorkpack')).toBe(true);
				} else if (packageName === 'blorktools') {
					expect(verifyPackageIsBuilt('blorktools')).toBe(true);
				} else if (packageName === 'blorkboard') {
					expect(verifyPackageIsBuilt('blorkboard')).toBe(true);
				}
			});
		});
	}

	test('workspace package.json files should be valid', () => {
		// Find all package.json files in the workspace
		const packageJsonFiles = glob.sync('**/package.json', {
			ignore: ['**/node_modules/**', '**/dist/**'],
			cwd: path.resolve(__dirname, '../../')
		});

		// Map of package names to their package.json paths for later lookup
		const packagePathMap = new Map();
		// Map of package names to their workspace dependencies
		const packageDepsMap = new Map();

		// First pass: collect all packages and their dependencies
		packageJsonFiles.forEach(packageJsonPath => {
			const absolutePath = path.resolve(__dirname, '../../', packageJsonPath);
			const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      
			if (!packageJson.name) return; // Skip packages without names
      
			packagePathMap.set(packageJson.name, packageJsonPath);
      
			// Extract workspace dependencies
			if (packageJson.dependencies) {
				const workspaceDeps = Object.entries(packageJson.dependencies)
					.filter(([, versionOrPath]) => versionOrPath.startsWith('workspace:'))
					.map(([name]) => name);
        
				if (workspaceDeps.length > 0) {
					packageDepsMap.set(packageJson.name, workspaceDeps);
				}
			}
		});

		// Detect circular dependencies - this is a real issue that should be flagged
		/**
		 *
		 */
		function detectCircular() {
			const visited = new Set();
			const recStack = new Set();
			const circularPaths = [];

			/**
			 *
			 */
			function dfs(pkg, path = []) {
				if (recStack.has(pkg)) {
					circularPaths.push([...path, pkg].join(' → '));
					return true;
				}
        
				if (visited.has(pkg)) return false;
        
				visited.add(pkg);
				recStack.add(pkg);
				path.push(pkg);
        
				const deps = packageDepsMap.get(pkg) || [];
				for (const dep of deps) {
					if (dfs(dep, [...path])) {
						return true;
					}
				}
        
				recStack.delete(pkg);
				return false;
			}

			// Start DFS from each package
			for (const pkg of packageDepsMap.keys()) {
				dfs(pkg);
			}

			return circularPaths;
		}

		// Detect potential problems with the build order
		const circularDependencies = detectCircular();
		expect(circularDependencies).toHaveLength(0, 
			`Circular dependencies detected in workspace:\n${circularDependencies.join('\n')}`);
    
		// Check for apps that depend on packages but don't have build commands
		// These are real issues worth checking for
		const buildIssues = [];
    
		packageDepsMap.forEach((deps, pkg) => {
			const pkgPath = packagePathMap.get(pkg);
			const pkgJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../', pkgPath), 'utf8'));
      
			// Only check packages that have a "build" script
			if (pkgJson.scripts && pkgJson.scripts.build) {
				// Check if the package has dependencies on other workspace packages
				const workspaceDependencies = deps.map(dep => ({
					fullName: dep,
					plainName: dep.split('/').pop()
				}));
				
				// If it has workspace dependencies but no prebuild, or prebuild doesn't include dependencies, flag as issue
				if (workspaceDependencies.length > 0) {
					// If no prebuild script exists at all
					if (!pkgJson.scripts.prebuild) {
						buildIssues.push(`${pkgPath}: depends on workspace packages ${workspaceDependencies.map(d => d.plainName).join(', ')} but doesn't have a prebuild script`);
					} else {
						// Check that each dependency is mentioned in the prebuild script
						const missingDeps = workspaceDependencies.filter(dep => 
							!pkgJson.scripts.prebuild.includes(dep.plainName)
						);
						
						if (missingDeps.length > 0) {
							buildIssues.push(`${pkgPath}: prebuild script doesn't build required dependencies: ${missingDeps.map(d => d.plainName).join(', ')}`);
						}
					}
				}
			}
		});
    
		expect(buildIssues).toHaveLength(0, `Build issues detected:\n${buildIssues.join('\n')}`);
	});

	test('workspace package dependencies are properly configured', () => {
		// Find all package.json files in the workspace
		const packageJsonFiles = glob.sync('**/package.json', {
			ignore: ['**/node_modules/**', '**/dist/**'],
			cwd: path.resolve(__dirname, '../../')
		});
		
		// Check each package that depends on other workspace packages
		packageJsonFiles.forEach(packageJsonPath => {
			const absolutePath = path.resolve(__dirname, '../../', packageJsonPath);
			const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
			
			// Skip packages without names
			if (!packageJson.name) return;
			
			// Skip packages without dependencies
			if (!packageJson.dependencies) return;
			
			// Find workspace dependencies
			const workspaceDeps = Object.entries(packageJson.dependencies)
				.filter(([, versionOrPath]) => versionOrPath.startsWith('workspace:'))
				.map(([name]) => name.split('/').pop());
				
			if (workspaceDeps.length === 0) return;
			
			// If package has build script, it should have prebuild for dependencies
			if (packageJson.scripts && packageJson.scripts.build) {
				if (workspaceDeps.length > 0) {
					expect(packageJson.scripts.prebuild).toBeDefined();
					
					// Check that each dependency is mentioned in the prebuild
					workspaceDeps.forEach(depName => {
						const prebuiltMsg = `Should build ${depName} in prebuild script of ${packageJsonPath}`;
						const hasDep = packageJson.scripts.prebuild.includes(depName);
						expect(hasDep).toBe(true, prebuiltMsg);
					});
				}
			}
		});
	});

	test('GitHub Pages workflow builds packages in the correct order', () => {
		// Check that package dependencies are built in the correct order in GitHub workflows
		const workflowPath = path.resolve(__dirname, '../../.github/workflows/unified-pipeline.yml');
		expect(fs.existsSync(workflowPath)).toBe(true);
		
		const workflowContent = fs.readFileSync(workflowPath, 'utf8');
		const workflowConfig = jsYaml.load(workflowContent);
		
		// Check package build steps exist
		expect(workflowConfig.jobs.build.steps).toBeDefined();
		
		// Find the build step(s)
		const buildSteps = workflowConfig.jobs.build.steps.filter(step => 
			step.name && (step.name.includes('Build') || step.name.includes('build')));
		
		expect(buildSteps.length).toBeGreaterThan(0);
		
		// Get package dependencies for checking build order
		const packageJsonFiles = glob.sync('**/package.json', {
			ignore: ['**/node_modules/**', '**/dist/**'],
			cwd: path.resolve(__dirname, '../../')
		});
		
		// Map of package names to their workspace dependencies
		const workflowDepsMap = new Map();
		
		// Collect packages and their dependencies
		packageJsonFiles.forEach(packageJsonPath => {
			const absolutePath = path.resolve(__dirname, '../../', packageJsonPath);
			const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      
			if (!packageJson.name) return; // Skip packages without names
      
			// Extract workspace dependencies
			if (packageJson.dependencies) {
				const workspaceDeps = Object.entries(packageJson.dependencies)
					.filter(([, versionOrPath]) => versionOrPath.startsWith('workspace:'))
					.map(([name]) => name);
        
				if (workspaceDeps.length > 0) {
					workflowDepsMap.set(packageJson.name, workspaceDeps);
				}
			}
		});
		
		// Check GitHub Pages build step if it exists
		if (workflowConfig.jobs['build-site']) {
			const siteSteps = workflowConfig.jobs['build-site'].steps.filter(step => 
				step.name && (step.name.includes('Build') || step.name.includes('build')));
			
			expect(siteSteps.length).toBeGreaterThan(0);
			
			// If we find a build step with multiple package builds, verify dependency order
			for (const step of siteSteps) {
				if (step.run) {
					// Extract all build commands
					const buildCommands = step.run.split('\n')
						.filter(line => line.includes('build') && line.includes('--filter='));
					
					// Map of package to its position in build sequence
					const buildOrder = {};
					buildCommands.forEach((cmd, index) => {
						const match = cmd.match(/--filter=@[^/]+\/([^ ]+)/);
						if (match) {
							buildOrder[match[1]] = index;
						}
					});
					
					// Check dependency build order using the workflow dependency map
					workflowDepsMap.forEach((deps, pkg) => {
						const pkgName = pkg.split('/').pop();
						
						if (buildOrder[pkgName] !== undefined) {
							deps.forEach(dep => {
								const depName = dep.split('/').pop();
								if (buildOrder[depName] !== undefined) {
									// Dependency should be built before depending package
									const correctOrder = buildOrder[depName] < buildOrder[pkgName];
									const msg = `In workflow build, ${depName} should be built before ${pkgName}`;
									expect(correctOrder).toBe(true, msg);
								}
							});
						}
					});
				}
			}
		}
	});

	test('verify build scripts are properly configured', async () => {
		// Find all package.json files
		const packageJsonFiles = glob.sync('**/package.json', {
			ignore: ['**/node_modules/**', '**/dist/**'],
			cwd: path.resolve(__dirname, '../../')
		});
		
		// Check all buildable packages
		packageJsonFiles.forEach(packageJsonPath => {
			const absolutePath = path.resolve(__dirname, '../../', packageJsonPath);
			const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
			
			// Skip packages without names
			if (!packageJson.name) return;
			
			// Only check packages with build scripts
			if (packageJson.scripts && packageJson.scripts.build) {
				// Check that exportable packages have main/module entries and files array
				if (packageJson.private !== true) {
					if (packageJson.name.includes('/')) { // Scoped package, likely meant to be imported
						// Should have main and/or module entry points
						const hasEntryPoint = (packageJson.main || packageJson.module) !== undefined;
						const msg = `Package ${packageJson.name} should have main or module entry point`;
						expect(hasEntryPoint).toBe(true, msg);
						
						// Should include dist in files array if it has one
						if (packageJson.files) {
							expect(packageJson.files).toContain('dist');
						}
					}
				}
			}
		});
	});
}); 