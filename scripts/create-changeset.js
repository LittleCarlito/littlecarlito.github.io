#!/usr/bin/env node

/**
 * Helper script to create a changeset with predefined options
 * 
 * Usage: 
 *   node scripts/create-changeset.js
 * 
 * This will guide you through creating a changeset interactively
 */

import { spawnSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Available packages
const packages = [
	'@littlecarlito/blorkpack',
	'@littlecarlito/blorktools',
	'@littlecarlito/blorkboard'
];

// Change types
const changeTypes = ['major', 'minor', 'patch'];

// Ask for input with a nice prompt
/**
 *
 */
function prompt(question) {
	return new Promise((resolve) => {
		rl.question(`\n\x1b[1;34m${question}\x1b[0m\n> `, (answer) => {
			resolve(answer.trim());
		});
	});
}

// Multi-select prompt for packages
/**
 *
 */
async function selectPackages() {
	console.log('\n\x1b[1;35mSelect packages to include in this changeset:\x1b[0m');
	
	packages.forEach((pkg, i) => {
		console.log(`  ${i + 1}. ${pkg}`);
	});
	
	console.log('  a. All packages');
	
	const selection = await prompt('Enter numbers (comma-separated) or "a" for all:');
	
	if (selection.toLowerCase() === 'a') {
		return packages;
	}
	
	const selectedIndices = selection.split(',').map(s => parseInt(s.trim(), 10) - 1);
	return selectedIndices.map(i => packages[i]).filter(Boolean);
}

// Select change type
/**
 *
 */
async function selectChangeType() {
	console.log('\n\x1b[1;35mSelect change type:\x1b[0m');
	
	changeTypes.forEach((type, i) => {
		console.log(`  ${i + 1}. ${type}`);
	});
	
	const selection = await prompt('Enter number:');
	const index = parseInt(selection, 10) - 1;
	
	if (index >= 0 && index < changeTypes.length) {
		return changeTypes[index];
	}
	
	console.log('\x1b[31mInvalid selection, defaulting to "patch"\x1b[0m');
	return 'patch';
}

// Run the interactive changeset creation
/**
 *
 */
async function run() {
	try {
		console.log('\x1b[1;32m===================================\x1b[0m');
		console.log('\x1b[1;32m🔄 Interactive Changeset Creator 🔄\x1b[0m');
		console.log('\x1b[1;32m===================================\x1b[0m');

		// Get summary
		const summary = await prompt('Enter a short summary of the change:');
		
		if (!summary) {
			console.log('\x1b[31mError: Summary is required\x1b[0m');
			process.exit(1);
		}
		
		// Get changeset description (optional)
		const description = await prompt('Enter a detailed description (optional, press Enter to skip):');
		
		// Select packages
		const selectedPackages = await selectPackages();
		
		if (selectedPackages.length === 0) {
			console.log('\x1b[31mError: No packages selected\x1b[0m');
			process.exit(1);
		}
		
		// Select change type
		const changeType = await selectChangeType();
		
		// Create the changeset content
		const changesetContent = `---
${selectedPackages.map(pkg => `"${pkg}": ${changeType}`).join('\n')}
---

${summary}
${description ? '\n' + description : ''}
`;

		// Generate a unique ID for the changeset file
		const timestamp = Date.now();
		const random = Math.floor(Math.random() * 10000);
		const id = `${timestamp}-${random}`;
		
		// Write the changeset file
		const changesetDir = path.join(process.cwd(), '.changeset');
		const changesetFile = path.join(changesetDir, `${id}.md`);
		
		fs.writeFileSync(changesetFile, changesetContent);
		
		console.log(`\n\x1b[32mChangeset created successfully: ${changesetFile}\x1b[0m`);
		
		// Show a summary of what was created
		console.log('\n\x1b[1;33mChangeset Summary:\x1b[0m');
		console.log(`Summary: ${summary}`);
		console.log(`Packages: ${selectedPackages.join(', ')}`);
		console.log(`Change Type: ${changeType}`);
		console.log(`ID: ${id}`);
		
		// Remind about git commands
		console.log('\n\x1b[1;36mNext steps:\x1b[0m');
		console.log('- Review the changeset file');
		console.log('- Add to git: git add .changeset/');
		console.log('- Commit: git commit -m "chore: add changeset for [YOUR FEATURE]"');
		console.log('- Push: git push');
	} catch (error) {
		console.error('\x1b[31mError creating changeset:\x1b[0m', error);
		process.exit(1);
	} finally {
		rl.close();
	}
}

// Run the script
run(); 