#!/usr/bin/env node

// This script detects if package.json has type: "module" and handles workspace references
// appropriately in both ESM and CommonJS environments

// Use the CommonJS approach that works in both environments
const fs = require('fs');

// Read the package.json file
try {
	const pkgPath = './package.json';
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
	
	// Log if we're in an ESM environment (for debugging)
	if (pkg.type === 'module') {
		console.log('Note: This package uses ESM (type: module)');
	}
	
	// Process all dependency types
	const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
	let changed = false;
	
	depTypes.forEach(type => {
		if (pkg[type]) {
			Object.keys(pkg[type]).forEach(dep => {
				// Replace workspace: with * for all versions
				if (typeof pkg[type][dep] === 'string' && pkg[type][dep].startsWith('workspace:')) {
					console.log(`Replacing workspace reference for ${dep}: ${pkg[type][dep]} -> *`);
					pkg[type][dep] = '*';
					changed = true;
				}
			});
		}
	});
	
	// Convert to string and check for any remaining workspace references
	const pkgStr = JSON.stringify(pkg, null, 2);
	if (pkgStr.includes('workspace:')) {
		console.log('Found additional workspace references, fixing with regex');
		// Make sure to properly quote the replacement string
		const fixedPkgStr = pkgStr.replace(/"workspace:[^"]*"/g, '"*"');
		fs.writeFileSync(pkgPath, fixedPkgStr);
	} else if (changed) {
		fs.writeFileSync(pkgPath, pkgStr);
	}
	
	console.log('Successfully removed all workspace: references');
} catch (error) {
	console.error('Error processing package.json:', error);
	process.exit(1);
} 