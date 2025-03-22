#!/usr/bin/env node

// This script detects if package.json has type: "module" and handles workspace references
// appropriately in both ESM and CommonJS environments

// Use the CommonJS approach
const fs = require('fs');

try {
	// Read and parse package.json
	const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
	// Log if we're in an ESM environment (for debugging)
	if (pkg.type === 'module') {
		console.log('Note: This package uses ESM (type: module)');
	}
  
	// Process all dependency types
	const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  
	depTypes.forEach(type => {
		if (pkg[type]) {
			Object.keys(pkg[type]).forEach(dep => {
				// Replace workspace: with * for all versions
				if (typeof pkg[type][dep] === 'string' && pkg[type][dep].startsWith('workspace:')) {
					console.log(`Replacing workspace reference for ${dep}: ${pkg[type][dep]} -> *`);
					pkg[type][dep] = '*';
				}
			});
		}
	});
  
	// Extra check to handle nested workspace references
	const pkgStr = JSON.stringify(pkg, null, 2);
	if (pkgStr.includes('workspace:')) {
		console.log('Found additional workspace references, fixing with regex');
		const fixedPkgStr = pkgStr.replace(/"workspace:[^"]*"/g, '"*"');
		fs.writeFileSync('package.json', fixedPkgStr);
	} else {
		fs.writeFileSync('package.json', pkgStr);
	}
  
	console.log('Successfully removed all workspace: references');
} catch (e) {
	console.error('Error processing package.json:', e.message);
	process.exit(1);
} 