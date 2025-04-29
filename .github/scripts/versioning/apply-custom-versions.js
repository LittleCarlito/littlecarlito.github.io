#!/usr/bin/env node

/**
 * Custom version application script
 * 
 * This script applies custom versions to package.json files based on the output
 * of the test-version script instead of relying on changeset's standard versioning.
 * 
 * It:
 * 1. Parses the output of test-version to get the versions determined by our custom logic
 * 2. Directly updates package.json files with those versions
 * 3. Generates changelogs using changesets but WITHOUT overriding our versions
 * 
 * IMPORTANT: This script will exit with a non-zero status code on any error.
 * This prevents pushes from continuing when versioning fails.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { glob } = require('glob');

// Set strict mode to fail on undefined variables
'use strict';

// Track if we've made changes to keep for debugging
let hasBackedUpFiles = false;

// Get branch name from arguments
const branchArg = process.argv.find(arg => arg.startsWith('--branch='));
const branch = branchArg ? branchArg.split('=')[1] : execSync('git symbolic-ref --short HEAD').toString().trim();

console.log(`Applying custom versions for branch: ${branch}`);

// Run test-version to get determined versions
const testVersionOutput = execSync(`pnpm test-version --branch=${branch}`).toString();
console.log('Obtained version determinations from test-version');

// Parse the output to extract package names and their determined versions
const versionChanges = new Map();

// Regex to extract version changes from test-version output
const versionRegex = /(@[\w-]+\/[\w-]+|[\w-]+):\s+(\d+\.\d+\.\d+)\s+->\s+(\d+\.\d+\.\d+)/g;
let match;

while ((match = versionRegex.exec(testVersionOutput)) !== null) {
  const [, packageName, currentVersion, newVersion] = match;
  versionChanges.set(packageName, { currentVersion, newVersion });
  console.log(`Parsed: ${packageName} will be updated from ${currentVersion} to ${newVersion}`);
}

if (versionChanges.size === 0) {
  console.log('No version changes detected to apply');
  process.exit(0);
}

// Find all package.json files
const packageFiles = glob.sync('{packages,apps}/**/package.json', { ignore: '**/node_modules/**' });

// Update each package.json with the determined version
let updatedCount = 0;

// First pass: backup original package.json files that will be changed
console.log('Backing up package.json files before changes...');
const backupFiles = new Map();

packageFiles.forEach(packagePath => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const packageName = packageJson.name;

    if (versionChanges.has(packageName)) {
      // Backup the original file content
      backupFiles.set(packagePath, JSON.stringify(packageJson, null, 2));
      console.log(`Backed up ${packagePath}`);
      hasBackedUpFiles = true;
    }
  } catch (error) {
    console.error(`Error processing ${packagePath}:`, error);
    process.exit(1);
  }
});

// Second pass: update package.json versions
console.log('Updating package.json files with custom versions...');
packageFiles.forEach(packagePath => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const packageName = packageJson.name;

    if (versionChanges.has(packageName)) {
      const { newVersion } = versionChanges.get(packageName);
      
      // Only update if the version is actually different
      if (packageJson.version !== newVersion) {
        console.log(`Updating ${packageName} to version ${newVersion} in ${packagePath}`);
        packageJson.version = newVersion;
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
        updatedCount++;
      } else {
        console.log(`${packageName} is already at version ${newVersion}`);
      }
    }
  } catch (error) {
    console.error(`Error updating version in ${packagePath}:`, error);
    console.error('Version application failed. Push will be aborted.');
    process.exit(1);
  }
});

// Generate changelogs from changesets (if present)
console.log('Generating changelogs from changesets...');

// Check if changesets exist
if (!fs.existsSync('.changeset') || !fs.readdirSync('.changeset').some(file => file.endsWith('.md') && file !== 'README.md')) {
  console.log('No changesets found, skipping changelog generation');
  console.log(`✅ Successfully updated ${updatedCount} package.json files with custom versions`);
  process.exit(0);
}

console.log('Found changesets, generating changelogs...');

// Run changeset version to generate changelogs
console.log('Running changeset version to generate changelogs...');

try {
  // This will generate the changelogs but may also modify package.json files
  execSync('pnpm changeset version', { stdio: 'inherit' });
} catch (error) {
  console.error('ERROR: Failed to run changeset version command:', error);
  console.error('Push aborted to prevent inconsistent versioning.');
  process.exit(1);
}

console.log('Changeset version executed, now restoring our custom versions...');

// Third pass: restore our custom versions
packageFiles.forEach(packagePath => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const packageName = packageJson.name;
    
    if (versionChanges.has(packageName)) {
      const { newVersion } = versionChanges.get(packageName);
      
      // Restore our version if changeset changed it
      if (packageJson.version !== newVersion) {
        console.log(`Restoring ${packageName} to our custom version ${newVersion}`);
        packageJson.version = newVersion;
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
      }
    }
  } catch (error) {
    console.error(`ERROR: Failed to restore custom version for ${packagePath}:`, error);
    console.error('Push aborted to prevent inconsistent versioning.');
    process.exit(1);
  }
});

console.log('Successfully generated changelogs while maintaining our custom versions');
console.log(`✅ Successfully updated ${updatedCount} package.json files with custom versions`);
console.log('You can now commit these changes'); 