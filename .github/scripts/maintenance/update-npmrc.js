#!/usr/bin/env node

/**
 * Script to update all .npmrc files to remove NODE_AUTH_TOKEN requirement
 * This script:
 * 1. Finds all .npmrc files in the repo
 * 2. Updates them to remove NODE_AUTH_TOKEN references
 * 3. Updates root package.json workspace configuration
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Configuration
const scope = '@littlecarlito';

/**
 * Find all .npmrc files in the repository
 * @returns {string[]} Array of file paths
 */
function findNpmrcFiles() {
  try {
    const result = execSync('find . -name ".npmrc" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"', { encoding: 'utf8' });
    return result.trim().split('\n').filter(line => line);
  } catch (error) {
    console.error('Error finding .npmrc files:', error.message);
    return [];
  }
}

/**
 * Update an .npmrc file to remove NODE_AUTH_TOKEN requirement
 * @param {string} filePath - Path to the .npmrc file
 * @returns {boolean} Success status
 */
function updateNpmrcFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = content
      .replace(/\/\/npm\.pkg\.github\.com\/:_authToken=\${NODE_AUTH_TOKEN}.*$/gm, '')
      .trim();
    
    // Ensure the scope registry line exists
    const registryLine = `${scope}:registry=https://npm.pkg.github.com/`;
    const finalContent = updatedContent.includes(registryLine) 
      ? updatedContent 
      : `${registryLine}\n${updatedContent}`;
    
    fs.writeFileSync(filePath, finalContent + '\n');
    console.log(`Updated ${filePath} to remove NODE_AUTH_TOKEN requirement`);
    return true;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Update package.json files to use workspace references
 * @param {string} packagePath - Path to the package
 */
function updatePackageWorkspaceRefs(packagePath) {
  const packageJsonPath = path.join(process.cwd(), packagePath);
  
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    let changed = false;

    // Helper to identify and update scoped dependencies
    const updateScopedDeps = (deps) => {
      let depsChanged = false;
      for (const [key, value] of Object.entries(deps)) {
        if (key.startsWith(scope) && !value.startsWith('workspace:')) {
          deps[key] = 'workspace:*';
          depsChanged = true;
        }
      }
      return depsChanged;
    };

    // Update dependencies
    if (updateScopedDeps(dependencies)) {
      packageJson.dependencies = dependencies;
      changed = true;
    }

    // Update devDependencies
    if (updateScopedDeps(devDependencies)) {
      packageJson.devDependencies = devDependencies;
      changed = true;
    }

    // Write updated package.json if changed
    if (changed) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`Updated ${packageJsonPath} to use workspace references`);
    }

    return true;
  } catch (error) {
    console.error(`Error updating ${packageJsonPath}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log('Updating .npmrc files to remove NODE_AUTH_TOKEN requirement...');
  
  // Find all .npmrc files
  const npmrcFiles = findNpmrcFiles();
  console.log(`Found ${npmrcFiles.length} .npmrc files`);
  
  // Update each .npmrc file
  let successCount = 0;
  let failureCount = 0;
  
  for (const filePath of npmrcFiles) {
    const success = updateNpmrcFile(filePath);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }
  
  console.log(`\nNpmrc update summary: ${successCount} files updated, ${failureCount} failed`);
  
  // Find and update package.json files with workspace references
  console.log('\nUpdating package.json files to use workspace references...');
  try {
    const packageJsonFiles = execSync(
      'find . -name "package.json" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"', 
      { encoding: 'utf8' }
    ).trim().split('\n').filter(line => line);
    
    for (const filePath of packageJsonFiles) {
      updatePackageWorkspaceRefs(filePath);
    }
  } catch (error) {
    console.error('Error updating package.json files:', error.message);
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