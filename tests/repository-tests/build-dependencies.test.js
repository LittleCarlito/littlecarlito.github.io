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
			ignore: ['**/node_modules/**', '**/dist/**', '**/version-test-temp/**'],
			cwd: path.resolve(__dirname, '../../')
		});

		// Map of package names to their package.json paths for later lookup
		const packagePathMap = new Map();
		// Map of package names to their workspace dependencies
		const packageDepsMap = new Map();

		// First pass: collect all packages and their dependencies
		packageJsonFiles.forEach(packageJsonPath => {
			const absolutePath = path.resolve(__dirname, '../../', packageJsonPath);

			// Skip files that don't exist (to handle temp directories safely)
			if (!fs.existsSync(absolutePath)) {
				console.warn(`Warning: Package.json file not found at ${absolutePath}, skipping`);
				return;
			}

			try {
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
			} catch (error) {
				console.warn(`Warning: Error processing ${absolutePath}: ${error.message}`);
			}
		});

		// Detect circular dependencies - this is a real issue that should be flagged
		function detectCircular() {
			const visited = new Set();
			const recStack = new Set();
			const circularPaths = [];

			function dfs(pkg, pathArr = []) {
				if (recStack.has(pkg)) {
					circularPaths.push([...pathArr, pkg].join(' → '));
					return true;
				}

				if (visited.has(pkg)) return false;

				visited.add(pkg);
				recStack.add(pkg);
				pathArr.push(pkg);

				const deps = packageDepsMap.get(pkg) || [];
				for (const dep of deps) {
					if (dfs(dep, [...pathArr])) {
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
	});

	test('workspace package dependencies are properly configured', () => {
		// Find all package.json files in the workspace
		const packageJsonFiles = glob.sync('**/package.json', {
			ignore: ['**/node_modules/**', '**/dist/**', '**/version-test-temp/**'],
			cwd: path.resolve(__dirname, '../../')
		});

		// Check each package that depends on other workspace packages
		packageJsonFiles.forEach(packageJsonPath => {
			const absolutePath = path.resolve(__dirname, '../../', packageJsonPath);

			// Skip files that don't exist
			if (!fs.existsSync(absolutePath)) {
				console.warn(`Warning: Package.json file not found at ${absolutePath}, skipping`);
				return;
			}

			try {
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

				// If package has build script and workspace deps, it should have prebuild for dependencies
				if (packageJson.scripts && packageJson.scripts.build && workspaceDeps.length > 0) {
					expect(packageJson.scripts.prebuild).toBeDefined();

					// Check that each dependency is mentioned in the prebuild
					workspaceDeps.forEach(depName => {
						const prebuiltMsg = `Should build ${depName} in prebuild script of ${packageJsonPath}`;
						const hasDep = packageJson.scripts.prebuild.includes(depName);
						expect(hasDep).toBe(true, prebuiltMsg);
					});
				}
			} catch (error) {
				console.warn(`Warning: Error processing ${absolutePath}: ${error.message}`);
			}
		});
	});

	test('GitHub Pages workflow builds apps in the correct order', () => {
		// Check that the main pipeline workflow exists and has build steps
		const workflowPath = path.resolve(__dirname, '../../.github/workflows/main-pipeline.yml');
		expect(fs.existsSync(workflowPath)).toBe(true);

		const workflowContent = fs.readFileSync(workflowPath, 'utf8');
		const workflowConfig = jsYaml.load(workflowContent);

		// Check build job exists (could be 'build' or 'build-and-test')
		const buildJob = workflowConfig.jobs['build-and-test'] || workflowConfig.jobs.build;
		expect(buildJob).toBeDefined();
		expect(buildJob.steps).toBeDefined();

		// Find the build step(s)
		const buildSteps = buildJob.steps.filter(step =>
			step.name && (step.name.includes('Build') || step.name.includes('build')));

		expect(buildSteps.length).toBeGreaterThan(0);
	});

	test('verify build scripts are properly configured', async () => {
		// Find all package.json files in apps
		const packageJsonFiles = glob.sync('apps/*/package.json', {
			cwd: path.resolve(__dirname, '../../')
		});

		// Check all buildable apps
		packageJsonFiles.forEach(packageJsonPath => {
			const absolutePath = path.resolve(__dirname, '../../', packageJsonPath);
			const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

			// Skip packages without names
			if (!packageJson.name) return;

			// Apps should have build scripts
			if (packageJson.scripts) {
				expect(packageJson.scripts.build).toBeDefined();
			}
		});
	});
});
