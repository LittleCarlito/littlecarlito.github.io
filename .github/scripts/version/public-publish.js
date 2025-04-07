#!/usr/bin/env node

/**
 * Script to publish packages to GitHub npm registry
 * This script:
 * 1. Reads the list of packages to publish
 * 2. Publishes each package with proper authentication
 * 3. Updates package settings to make them easier to install
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Get package paths from file or arguments
let packagesToPublish = [];
const publishListFile = path.join(process.cwd(), '.packages-to-publish.json');

if (fs.existsSync(publishListFile)) {
  try {
    packagesToPublish = JSON.parse(fs.readFileSync(publishListFile, 'utf8'));
  } catch (error) {
    console.error(`Error reading packages list: ${error.message}`);
  }
}

if (packagesToPublish.length === 0) {
  console.log('No packages to publish, checking command line arguments');
  packagesToPublish = process.argv.slice(2);
}

if (packagesToPublish.length === 0) {
  console.log('No packages specified for publishing');
  process.exit(0);
}

// Configuration
const scope = '@littlecarlito';

/**
 * Update package.json to make it publicly accessible
 * @param {string} packagePath - Path to the package
 */
function updatePackageForPublic(packagePath) {
  const packageJsonPath = path.join(process.cwd(), packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`Package.json not found for ${packagePath}, skipping...`);
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Set publishConfig to ensure packages are public
    packageJson.publishConfig = {
      ...packageJson.publishConfig,
      access: 'public',
      registry: 'https://npm.pkg.github.com'
    };
    
    // Write updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`Updated ${packagePath}/package.json for public access`);
    return true;
  } catch (error) {
    console.error(`Error updating ${packagePath}/package.json: ${error.message}`);
    return false;
  }
}

/**
 * Create/update npmrc file that doesn't require NODE_AUTH_TOKEN
 * @param {string} packagePath - Path to the package
 */
function updateNpmRc(packagePath) {
  const npmrcPath = path.join(process.cwd(), packagePath, '.npmrc');
  const content = `${scope}:registry=https://npm.pkg.github.com/\n`;
  
  try {
    fs.writeFileSync(npmrcPath, content);
    console.log(`Updated ${packagePath}/.npmrc to not require NODE_AUTH_TOKEN`);
    return true;
  } catch (error) {
    console.error(`Error updating ${packagePath}/.npmrc: ${error.message}`);
    return false;
  }
}

/**
 * Publish a package to the registry
 * @param {string} packagePath - Path to the package
 */
function publishPackage(packagePath) {
  try {
    // Ensure package access is set to public
    updatePackageForPublic(packagePath);
    updateNpmRc(packagePath);
    
    // Publish package
    console.log(`Publishing ${packagePath}...`);
    execSync(`npm publish --access public`, { 
      cwd: path.join(process.cwd(), packagePath),
      stdio: 'inherit'
    });
    console.log(`Successfully published ${packagePath}`);
    return true;
  } catch (error) {
    console.error(`Error publishing ${packagePath}: ${error.message}`);
    return false;
  }
}

/**
 * Main function to publish packages
 */
function main() {
  console.log(`Publishing ${packagesToPublish.length} packages...`);
  const results = [];

  // Create root .npmrc for authentication
  const rootNpmrcPath = path.join(process.cwd(), '.npmrc');
  fs.writeFileSync(rootNpmrcPath, 
    `${scope}:registry=https://npm.pkg.github.com/\n` +
    `//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}\n`
  );
  console.log('Created root .npmrc with authentication token placeholder');

  // Process each package
  for (const packagePath of packagesToPublish) {
    const success = publishPackage(packagePath);
    results.push({ packagePath, success });
  }

  // Report results
  console.log('\nPublishing results:');
  let successCount = 0;
  let failureCount = 0;

  for (const { packagePath, success } of results) {
    if (success) {
      console.log(`✅ ${packagePath}: Successfully published`);
      successCount++;
    } else {
      console.log(`❌ ${packagePath}: Failed to publish`);
      failureCount++;
    }
  }

  console.log(`\nSummary: ${successCount} packages published, ${failureCount} failed`);
  
  // Clean up publish list file
  if (fs.existsSync(publishListFile)) {
    fs.unlinkSync(publishListFile);
  }

  return failureCount === 0;
}

// Run the script
try {
  const success = main();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
} 