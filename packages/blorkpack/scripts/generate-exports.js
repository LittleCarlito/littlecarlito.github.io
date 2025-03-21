/**
 * Script to automatically generate the exports field in package.json
 * based on the files in the src directory.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper function to get all JS files in a directory recursively
/**
 *
 */
function getJsFiles(dir, baseDir = dir, files = {}) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// Recursively scan directories
			getJsFiles(fullPath, baseDir, files);
		} else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
			// Only include JS files that aren't named index.js
			const relativePath = path.relative(baseDir, fullPath);
			const exportPath = relativePath.replace(/\.js$/, '');
			files[exportPath] = relativePath;
		}
	}
	return files;
}

// Create a simplified, user-friendly export name
/**
 *
 */
function createFriendlyExportName(filePath) {
	// Remove .js extension
	let name = filePath.replace(/\.js$/, '');
	// Handle special cases for deeply nested files
	if (name.includes('asset_handler/system_asset_factory/spawners/')) {
		// For spawners, just use the spawner name 
		const spawnerName = path.basename(name);
		// Simplify the name by removing "primitive_" and "_spawner"
		const simpleName = spawnerName
			.replace('primitive_', '')
			.replace('_spawner', '');
		return `./spawner/${simpleName}`;
	}
	// For files in asset_handler/system_asset_factory
	if (name.includes('asset_handler/system_asset_factory')) {
		if (name.endsWith('system_asset_factory')) {
			return './factory';
		}
		// Other files in this directory get a simpler path
		const baseName = path.basename(name);
		return `./factory/${baseName}`;
	}
	// For files in asset_handler
	if (name.includes('asset_handler/')) {
		if (name.endsWith('asset_handler')) {
			return './spawner';
		}
	}
	// For utils, keep directory structure but simplify
	if (name.startsWith('utils/')) {
		return `./${name}`;
	}
	// Convert snake_case to kebab-case for top-level files
	const baseName = path.basename(name);
	const kebabCase = baseName.replace(/_/g, '-');
	return `./${kebabCase}`;
}

// Build the exports object
/**
 *
 */
function buildExports() {
	const srcDir = path.join(rootDir, 'src');
	const jsFiles = getJsFiles(srcDir, srcDir);
	// Start with the main export
	const exports = {
		'.': './dist/index.js'
	};
	// Track used export paths to avoid duplicates
	const usedPaths = new Set(['.']);
	// First pass: Generate friendly paths
	const friendlyExports = {};
	for (const [exportPath, relativePath] of Object.entries(jsFiles)) {
		const distPath = `./dist/${relativePath.replace(/\\/g, '/')}`;
		const friendlyPath = createFriendlyExportName(exportPath);
		if (!usedPaths.has(friendlyPath)) {
			friendlyExports[friendlyPath] = distPath;
			usedPaths.add(friendlyPath);
		}
	}
	// Add all friendly exports first (these are the ones users will use)
	Object.assign(exports, friendlyExports);
	// Add directory exports for directories that contain index.js
	const directories = new Set();
	Object.keys(jsFiles).forEach(file => {
		const dir = path.dirname(file);
		if (dir !== '.') {
			directories.add(dir);
		}
	});
	directories.forEach(dir => {
		const indexPath = path.join(dir, 'index.js');
		if (fs.existsSync(path.join(srcDir, indexPath))) {
			const dirExport = `./${dir.replace(/\\/g, '/')}`;
			if (!usedPaths.has(dirExport)) {
				exports[dirExport] = `./dist/${indexPath.replace(/\\/g, '/')}`;
				usedPaths.add(dirExport);
			}
		}
	});
	return exports;
}

// Update package.json
/**
 *
 */
function updatePackageJson() {
	const packageJsonPath = path.join(rootDir, 'package.json');
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
	packageJson.exports = buildExports();
	// Write back to package.json with proper formatting
	fs.writeFileSync(
		packageJsonPath, 
		JSON.stringify(packageJson, null, 2) + '\n'
	);
	console.log('✅ Updated package.json exports field');
	console.log(`📦 Added ${Object.keys(packageJson.exports).length} export paths`);
}

// Run the script
updatePackageJson(); 