#!/usr/bin/env node

/**
 * Set a specific version for a package
 * 
 * This script allows you to explicitly set a version for a package regardless of semantic versioning rules.
 * It directly updates the package.json file and can optionally create a Git tag for the version.
 * 
 * Usage:
 * node set-package-version.js <package-name> <version> [--create-tag] [--push-tag]
 * 
 * Examples:
 * node set-package-version.js blorkpack 111.0.6544 --create-tag
 * node set-package-version.js @littlecarlito/blorkpack 111.0.6544 --create-tag --push-tag
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the existing utility functions
const { PACKAGES, APPS, getPackageName } = require('./version-utils');

// Parse command line arguments
if (process.argv.length < 4) {
  console.error('Error: Missing required arguments');
  console.error('Usage: node set-package-version.js <package-name> <version> [--create-tag] [--push-tag]');
  process.exit(1);
}

let packageName = process.argv[2];
const newVersion = process.argv[3];
const createTag = process.argv.includes('--create-tag');
const pushTag = process.argv.includes('--push-tag');

// Handle package name with or without the scope
if (!packageName.includes('/')) {
  // Check if it's one of our known packages
  if (PACKAGES.includes(packageName) || APPS.includes(packageName)) {
    packageName = getPackageName(packageName);
  } else {
    console.error(`Error: Unknown package "${packageName}"`);
    console.error(`Known packages: ${PACKAGES.concat(APPS).join(', ')}`);
    process.exit(1);
  }
}

// Validate the version format
if (!newVersion.match(/^\d+\.\d+\.\d+/)) {
  console.error(`Error: Invalid version format "${newVersion}"`);
  console.error('Version must be in the format: MAJOR.MINOR.PATCH');
  process.exit(1);
}

// Get the project name from the full package name
const projectName = packageName.split('/')[1];
const isApp = APPS.includes(projectName);

// Determine the path to the package.json file
const packageJsonPath = path.join(
  process.cwd(),
  isApp ? `apps/${projectName}` : `packages/${projectName}`,
  'package.json'
);

// Check if the package.json file exists
if (!fs.existsSync(packageJsonPath)) {
  console.error(`Error: Package.json not found at ${packageJsonPath}`);
  process.exit(1);
}

// Read the package.json file
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  console.error(`Error reading package.json: ${error.message}`);
  process.exit(1);
}

// Store the current version for logging
const currentVersion = packageJson.version;

// Update the version
packageJson.version = newVersion;

// Write the updated package.json file
try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated ${packageName} from ${currentVersion} to ${newVersion}`);
} catch (error) {
  console.error(`Error writing package.json: ${error.message}`);
  process.exit(1);
}

// Create a git tag if requested
if (createTag) {
  const tagName = `${packageName}@${newVersion}`;
  
  try {
    execSync(`git tag ${tagName}`);
    console.log(`✅ Created git tag: ${tagName}`);
    
    // Push the tag if requested
    if (pushTag) {
      execSync(`git push origin ${tagName}`);
      console.log(`✅ Pushed git tag to remote: ${tagName}`);
    } else {
      console.log(`To push the tag to remote, run: git push origin ${tagName}`);
    }
  } catch (error) {
    console.error(`Error creating/pushing git tag: ${error.message}`);
    // Don't exit with error since the package.json was already updated
  }
}

console.log('Done!'); 