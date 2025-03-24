#!/usr/bin/env node

/**
 * GitHub Pages Path Integrity Checker
 * 
 * This script performs a comprehensive analysis of the codebase to detect common
 * GitHub Pages path issues, particularly focusing on doubled path segments
 * and incorrect leading slash handling that could cause 404 errors.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Define constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.join(REPO_ROOT, 'apps');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const GITHUB_PAGES_BASE = 'threejs_site';
const DOUBLED_PATH_PATTERN = `${GITHUB_PAGES_BASE}/${GITHUB_PAGES_BASE}`;

// Counters for reporting
let filesChecked = 0;
let issuesFound = 0;
let potentialIssues = 0;

/**
 * Recursively finds files matching patterns
 * @param {string} dir - The directory to search
 * @param {RegExp} pattern - File pattern to match
 * @returns {string[]} Array of matching file paths
 */
function findFiles(dir, pattern) {
	let results = [];
    
	const items = fs.readdirSync(dir);
	for (const item of items) {
		const itemPath = path.join(dir, item);
        
		// Skip node_modules and dist folders
		if (item === 'node_modules' || item === 'dist' || item === '.git') {
			continue;
		}
        
		const stat = fs.statSync(itemPath);
		if (stat.isDirectory()) {
			results = results.concat(findFiles(itemPath, pattern));
		} else if (pattern.test(item)) {
			results.push(itemPath);
		}
	}
    
	return results;
}

/**
 * Checks a file for GitHub Pages path issues
 * @param {string} filePath - Path to the file
 * @returns {Object} Object containing found issues and file path
 */
function checkFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	const issues = [];
	const warnings = [];
    
	filesChecked++;
    
	// Test for doubled GitHub Pages base paths
	if (content.includes(DOUBLED_PATH_PATTERN)) {
		issues.push(`Contains doubled path: ${DOUBLED_PATH_PATTERN}`);
	}
    
	// Test for incorrect path concatenation
	if (content.includes(`/${GITHUB_PAGES_BASE}/${GITHUB_PAGES_BASE}/`)) {
		issues.push(`Contains doubled path with slashes: /${DOUBLED_PATH_PATTERN}/`);
	}
    
	// Test for quoted doubled paths
	if (content.includes(`"${GITHUB_PAGES_BASE}/${GITHUB_PAGES_BASE}"`) ||
        content.includes(`'${GITHUB_PAGES_BASE}/${GITHUB_PAGES_BASE}'`)) {
		issues.push(`Contains quoted doubled path: "${DOUBLED_PATH_PATTERN}"`);
	}
    
	// Check for path resolution functions
	if (filePath.endsWith('.js')) {
		// Look for patterns that might cause path issues
		if (content.includes('resolvePath') && content.includes(GITHUB_PAGES_BASE)) {
			if (content.includes(`${GITHUB_PAGES_BASE}/`) && !content.includes(`/${GITHUB_PAGES_BASE}/`)) {
				warnings.push(`Path resolution function without leading slash: ${GITHUB_PAGES_BASE}/`);
			}
		}
        
		// Check for window.location usage with GitHub Pages base
		if (content.includes('window.location') && content.includes(GITHUB_PAGES_BASE)) {
			if (content.includes(`'${GITHUB_PAGES_BASE}/'`) || content.includes(`"${GITHUB_PAGES_BASE}/"`)) {
				warnings.push(`Uses window.location with GitHub Pages base without leading slash`);
			}
		}
        
		// Font loading checks
		if (content.includes('loadFont') || content.includes('FontLoader')) {
			if (content.includes('fonts') && content.includes(GITHUB_PAGES_BASE)) {
				if (content.includes(`${GITHUB_PAGES_BASE}/fonts`) && !content.includes(`/${GITHUB_PAGES_BASE}/fonts`)) {
					warnings.push(`Font loading without leading slash: ${GITHUB_PAGES_BASE}/fonts`);
				}
			}
		}
	}
    
	return {
		file: filePath,
		issues,
		warnings
	};
}

/**
 * Main function
 */
function main() {
	console.log('🔍 GitHub Pages Path Integrity Checker');
	console.log(`Checking for issues with GitHub Pages base path: ${GITHUB_PAGES_BASE}`);
    
	// Find relevant files to check
	console.log('Finding files to check...');
	const jsFiles = findFiles(REPO_ROOT, /\.(js|jsx|ts|tsx)$/);
	const htmlFiles = findFiles(REPO_ROOT, /\.(html|htm)$/);
	const jsonFiles = findFiles(REPO_ROOT, /\.json$/);
	const cssFiles = findFiles(REPO_ROOT, /\.(css|scss|sass)$/);
    
	const allFiles = [...jsFiles, ...htmlFiles, ...jsonFiles, ...cssFiles];
	console.log(`Found ${allFiles.length} files to check`);
    
	// Check each file
	const results = [];
    
	for (const file of allFiles) {
		const result = checkFile(file);
		if (result.issues.length > 0 || result.warnings.length > 0) {
			results.push(result);
			issuesFound += result.issues.length;
			potentialIssues += result.warnings.length;
		}
	}
    
	// Report results
	console.log(`\n📊 Results: Checked ${filesChecked} files`);
    
	if (issuesFound === 0 && potentialIssues === 0) {
		console.log('✅ No GitHub Pages path issues found!');
	} else {
		console.log(`⚠️ Found ${issuesFound} critical issues and ${potentialIssues} potential issues`);
        
		results.forEach(result => {
			const relativePath = path.relative(REPO_ROOT, result.file);
            
			if (result.issues.length > 0) {
				console.log(`\n❌ ${relativePath}`);
				result.issues.forEach(issue => console.log(`   - ${issue}`));
			}
            
			if (result.warnings.length > 0 && result.issues.length === 0) {
				console.log(`\n⚠️ ${relativePath}`);
				result.warnings.forEach(warning => console.log(`   - ${warning}`));
			}
		});
        
		console.log('\n🛠️ How to fix:');
		console.log(`1. For path resolution, use consistent leading slashes before ${GITHUB_PAGES_BASE}`);
		console.log(`2. Avoid concatenating paths that might create ${DOUBLED_PATH_PATTERN}`);
		console.log('3. For GitHub Pages, prefer absolute paths (with leading slash)');
		console.log('4. When using resolvePath(), check the implementation for GitHub Pages handling');
        
		// Exit with error code if critical issues were found
		if (issuesFound > 0) {
			process.exit(1);
		}
	}
}

// Run the script
main(); 