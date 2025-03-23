const fs = require('fs');
const path = require('path');
const glob = require('glob');

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
}); 