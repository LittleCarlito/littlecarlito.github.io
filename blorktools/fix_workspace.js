import { readFileSync, writeFileSync } from 'fs';

// Read and parse package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

// Process all dependency types
const depTypes = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

depTypes.forEach(type => {
	if (pkg[type]) {
		Object.keys(pkg[type]).forEach(dep => {
			// Replace workspace: with * for all versions
			if (pkg[type][dep].startsWith("workspace:")) {
				pkg[type][dep] = "*";
			}
		});
	}
});

// Extra check to handle nested workspace references
const pkgStr = JSON.stringify(pkg, null, 2);
if (pkgStr.includes("workspace:")) {
	console.log("Found additional workspace references, fixing with regex");
	const fixedPkgStr = pkgStr.replace(/"workspace:[^"]*"/g, '"*"');
	writeFileSync("package.json", fixedPkgStr);
} else {
	writeFileSync("package.json", pkgStr);
}

console.log("Successfully removed all workspace: references"); 