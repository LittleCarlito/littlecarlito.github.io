import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
// Check if packages directory exists in dist
const distPath = path.resolve('dist');
const packagesPath = path.join(distPath, 'packages');
console.log('Verifying that no source files are included in the dist directory...');
// Check for packages directory
if (fs.existsSync(packagesPath)) {
	console.error('ERROR: packages directory found in dist folder!');
	console.log('Removing packages directory from dist to prevent source code deployment');
	// Recursively delete the packages directory
	fs.rmSync(packagesPath, { recursive: true, force: true });
	console.log('Removed packages directory from dist.');
} else {
	console.log('✅ No packages directory found in dist. Good!');
}

// Function to check for source files
/**
 *
 */
function findSourceFiles(directory) {
	const sourceFiles = [];

	/**
	 *
	 */
	function scan(dir) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				// Skip node_modules directory
				if (entry.name !== 'node_modules') {
					scan(fullPath);
				}
			} else {
				// Check file extensions
				if (
					entry.name.endsWith('.ts') || 
          entry.name.endsWith('.tsx') || 
          entry.name.endsWith('.js.map')
				) {
					sourceFiles.push(fullPath);
				}
			}
		}
	}

	scan(directory);
	return sourceFiles;
}

// Find source files
const sourceFiles = findSourceFiles(distPath);
if (sourceFiles.length > 0) {
	console.warn('WARNING: Source files found in dist folder. Consider reviewing your build process.');
	console.log('Source files:');
	sourceFiles.forEach(file => console.log(`- ${file}`));
} else {
	console.log('✅ No source code files found in dist.');
}
// Check for development and documentation files
console.log('\n🔍 Checking for development and documentation files...');
// List of patterns that shouldn't be in production build
const developmentPatterns = [
	// Development directories
	'development/',
	'dev/',
	'tests/',
	'test/',
	'spec/',
	'examples/',
	'example/',
	'demos/',
	'demo/',
	// Documentation directories
	'docs/',
	'documentation/',
	'api-docs/',
	'wiki/',
	// Development files
	'.eslintrc',
	'.prettierrc',
	'.babelrc',
	'jest.config',
	'webpack.config',
	'tsconfig',
	'rollup.config',
	'karma.conf',
	'mocha.opts',
	'cypress.json',
	'.storybook',
	// Documentation files
	'README',
	'CHANGELOG',
	'LICENSE',
	'CONTRIBUTING',
	'AUTHORS',
	'BACKERS',
	'SPONSORS',
	'CODE_OF_CONDUCT',
	// Other development files
	'.git',
	'.github',
	'.gitlab',
	'.gitignore',
	'.npmignore',
	'.travis.yml',
	'.circleci',
	'.vscode',
	'.idea',
	'coverage/',
	'node_modules/',
	// Blork-specific directories
	'blorktools/',
	'tools/'
];

/**
 *
 */
function findDevelopmentFiles(directory) {
	const devFiles = [];

	/**
	 *
	 */
	function scan(dir) {
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				const relativePath = path.relative(distPath, fullPath);
				// Check if the path matches any of the development patterns
				const isDevFile = developmentPatterns.some(pattern => {
					if (pattern.endsWith('/')) {
						// For directory patterns, check if it's a directory that matches
						return entry.isDirectory() && entry.name.toLowerCase() === pattern.slice(0, -1).toLowerCase();
					} else {
						// For file patterns, check if the filename starts with or contains the pattern
						return entry.name.toLowerCase().includes(pattern.toLowerCase());
					}
				});
				if (isDevFile) {
					devFiles.push(fullPath);
					// Don't scan further into this directory if it's a development directory
					if (entry.isDirectory()) continue;
				}
				// Continue scanning subdirectories
				if (entry.isDirectory()) {
					scan(fullPath);
				}
			}
		} catch (err) {
			console.error(`Error scanning ${dir}: ${err.message}`);
		}
	}

	scan(directory);
	return devFiles;
}

const developmentFiles = findDevelopmentFiles(distPath);
if (developmentFiles.length > 0) {
	console.warn('WARNING: Development or documentation files found in dist folder!');
	console.log('Files that should not be in production:');
	developmentFiles.forEach(file => {
		console.log(`- ${path.relative(distPath, file)}`);
		// Remove the file/directory to prevent it from being deployed
		try {
			const stats = fs.statSync(file);
			if (stats.isDirectory()) {
				fs.rmSync(file, { recursive: true, force: true });
				console.log(`  Removed directory: ${path.relative(distPath, file)}`);
			} else {
				fs.unlinkSync(file);
				console.log(`  Removed file: ${path.relative(distPath, file)}`);
			}
		} catch (err) {
			console.error(`  Failed to remove: ${err.message}`);
		}
	});
} else {
	console.log('✅ No development or documentation files found in dist.');
}
// Analyze bundle size
console.log('\n📊 Analyzing bundle size...');

// Get file sizes
/**
 *
 */
function getFileSizesInDir(dir, extension) {
	const results = [];

	/**
	 *
	 */
	function scan(directory) {
		const entries = fs.readdirSync(directory, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				scan(fullPath);
			} else if (!extension || entry.name.endsWith(extension)) {
				const stats = fs.statSync(fullPath);
				results.push({
					path: fullPath,
					size: stats.size,
					sizeFormatted: formatBytes(stats.size)
				});
			}
		}
	}

	scan(dir);
	// Sort by size (largest first)
	return results.sort((a, b) => b.size - a.size);
}

// Format bytes to human-readable format
/**
 *
 */
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Get largest JS files
const jsFiles = getFileSizesInDir(distPath, '.js');
const totalJsSize = jsFiles.reduce((total, file) => total + file.size, 0);
// Get largest asset files
const assetFiles = getFileSizesInDir(path.join(distPath, 'assets'));
const totalAssetSize = assetFiles.reduce((total, file) => total + file.size, 0);
// Total size
const totalSize = totalJsSize + totalAssetSize;
console.log(`Total bundle size: ${formatBytes(totalSize)}`);
console.log(`JavaScript bundle size: ${formatBytes(totalJsSize)}`);
console.log(`Assets size: ${formatBytes(totalAssetSize)}`);
// Log top 5 largest files
console.log('\nTop 5 largest JavaScript files:');
jsFiles.slice(0, 5).forEach(file => {
	console.log(`- ${file.sizeFormatted}: ${path.relative(distPath, file.path)}`);
});
console.log('\nTop 5 largest assets:');
assetFiles.slice(0, 5).forEach(file => {
	console.log(`- ${file.sizeFormatted}: ${path.relative(distPath, file.path)}`);
});
console.log('\nVerification complete!'); 