const fs = require('fs');
const path = require('path');
const glob = require('glob');
const jsYaml = require('js-yaml');

// Force Jest to recognize this as a test file
const test = global.test || jest.test;
const describe = global.describe || jest.describe;
const expect = global.expect || jest.expect;

describe('Build Dependencies', () => {
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
				// Check if the app/package has a direct dependency on packages that can fail at build time
				const hasCriticalDeps = deps.some(dep => {
					// Extract package name without scope for checking in scripts
					const plainName = dep.split('/').pop();
					return plainName === 'blorkpack'; // Known critical dependency that caused build issues
				});
        
				// If it has critical dependencies but no prebuild, flag as an issue
				if (hasCriticalDeps && (!pkgJson.scripts.prebuild || !pkgJson.scripts.prebuild.includes('blorkpack'))) {
					buildIssues.push(`${pkgPath}: depends on blorkpack but doesn't have a prebuild script to build it first`);
				}
			}
		});
    
		expect(buildIssues).toHaveLength(0, `Build issues detected:\n${buildIssues.join('\n')}`);
	});

	test('portfolio app dependencies are properly configured', () => {
		// Check specifically for the portfolio app's configuration
		const portfolioPath = path.resolve(__dirname, '../../apps/portfolio/package.json');
		expect(fs.existsSync(portfolioPath)).toBe(true);
		
		const portfolioJson = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
		
		// Check that it depends on blorkpack
		expect(portfolioJson.dependencies).toBeDefined();
		expect(portfolioJson.dependencies['@littlecarlito/blorkpack']).toBeDefined();
		
		// Check that it has the prebuild script that builds blorkpack
		expect(portfolioJson.scripts).toBeDefined();
		expect(portfolioJson.scripts.prebuild).toBeDefined();
		expect(portfolioJson.scripts.prebuild).toContain('blorkpack');
		expect(portfolioJson.scripts.prebuild).toContain('build');
	});

	test('GitHub Pages workflow builds packages in the correct order', () => {
		// Check that the GitHub workflow builds blorkpack before portfolio
		const workflowPath = path.resolve(__dirname, '../../.github/workflows/ci-main.yml');
		expect(fs.existsSync(workflowPath)).toBe(true);
		
		const workflowContent = fs.readFileSync(workflowPath, 'utf8');
		const workflowConfig = jsYaml.load(workflowContent);
		
		// Check packages build step
		expect(workflowConfig.jobs.build.steps).toBeDefined();
		
		// Find the build packages step
		const buildPackagesStep = workflowConfig.jobs.build.steps.find(step => 
			step.name && step.name.includes('Build packages'));
		
		expect(buildPackagesStep).toBeDefined();
		expect(buildPackagesStep.run).toContain('pnpm --filter=@littlecarlito/blorkpack build');
		
		// Check GitHub Pages build step
		expect(workflowConfig.jobs['build-site'].steps).toBeDefined();
		
		// Find the GitHub Pages build step
		const buildSiteStep = workflowConfig.jobs['build-site'].steps.find(step => 
			step.name && step.name.includes('Build for GitHub Pages'));
		
		expect(buildSiteStep).toBeDefined();
		expect(buildSiteStep.run).toContain('pnpm --filter=@littlecarlito/blorkpack build');
		expect(buildSiteStep.run.indexOf('pnpm --filter=@littlecarlito/blorkpack build')).toBeLessThan(
			buildSiteStep.run.indexOf('pnpm --filter=@littlecarlito/portfolio build')
		);
	});

	test('verify build process works with simulated dependency build', async () => {
		// Don't actually run builds in tests, but verify the build commands are valid
		const blorkpackPath = path.resolve(__dirname, '../../packages/blorkpack/package.json');
		const portfolioPath = path.resolve(__dirname, '../../apps/portfolio/package.json');
		
		expect(fs.existsSync(blorkpackPath)).toBe(true);
		expect(fs.existsSync(portfolioPath)).toBe(true);
		
		const blorkpackJson = JSON.parse(fs.readFileSync(blorkpackPath, 'utf8'));
		const portfolioJson = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
		
		// Check that blorkpack has a build script
		expect(blorkpackJson.scripts).toBeDefined();
		expect(blorkpackJson.scripts.build).toBeDefined();
		
		// Check that portfolio has a prebuild script that builds blorkpack
		expect(portfolioJson.scripts).toBeDefined();
		expect(portfolioJson.scripts.prebuild).toBeDefined();
		
		// Check that portfolio's build script exists
		expect(portfolioJson.scripts.build).toBeDefined();
		
		// Validate package main entry points
		expect(blorkpackJson.main).toBeDefined();
		expect(blorkpackJson.main).toContain('dist');
		
		// Check that dist directory is in package.json files array
		expect(blorkpackJson.files).toContain('dist');
	});
}); 