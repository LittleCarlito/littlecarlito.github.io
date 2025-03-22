import { readFileSync, writeFileSync } from 'fs';

// Read the package.json file
try {
	const pkgPath = './package.json';
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
	
	// Process all dependency types
	const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
	let changed = false;
	
	depTypes.forEach(type => {
		if (pkg[type]) {
			Object.keys(pkg[type]).forEach(dep => {
				// Replace workspace: with * for all versions
				if (pkg[type][dep].startsWith("workspace:")) {
					pkg[type][dep] = "*";
					changed = true;
				}
			});
		}
	});
	
	// Convert to string and check for any remaining workspace references
	const pkgStr = JSON.stringify(pkg, null, 2);
	if (pkgStr.includes("workspace:")) {
		console.log("Found additional workspace references, fixing with regex");
		// Make sure to properly quote the replacement string
		const fixedPkgStr = pkgStr.replace(/"workspace:[^"]*"/g, '"*"');
		writeFileSync(pkgPath, fixedPkgStr);
	} else if (changed) {
		writeFileSync(pkgPath, pkgStr);
	}
	
	console.log("Successfully removed all workspace: references");
} catch (error) {
	console.error("Error processing package.json:", error);
	process.exit(1);
} 