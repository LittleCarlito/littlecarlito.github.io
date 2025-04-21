/**
 * Script to run the blorkboard dev command
 * Ensures proper workspace linking before running
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// This function will attempt to repair workspace links
function repairWorkspaceLinks() {
  console.log('Repairing workspace links...');
  
  try {
    // Force recreate all links between workspace packages
    execSync('pnpm install --force', { 
      stdio: 'inherit',
      shell: true 
    });
    
    // Ensure node_modules links are properly created
    console.log('Establishing workspace links...');
    execSync('pnpm install', {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PNPM_LINK_WORKSPACE_PACKAGES: 'true', // Force workspace linking
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to repair workspace links:', error.message);
    return false;
  }
}

// Build dependency packages first
function buildDependencyPackages() {
  console.log('Building dependency packages first...');
  try {
    // Build blorkpack
    console.log('Building blorkpack...');
    execSync('pnpm --filter="@littlecarlito/blorkpack" build', {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PATH: process.env.PATH
      }
    });
    
    // Build blorktools
    console.log('Building blorktools...');
    execSync('pnpm --filter="@littlecarlito/blorktools" build', {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PATH: process.env.PATH
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to build dependency packages:', error.message);
    return false;
  }
}

// Check if blorkboard package exists
try {
  fs.accessSync(path.join(__dirname, '../packages/blorkboard/package.json'));
  console.log('Running blorkboard dev script...');
  
  // Build dependency packages first
  if (!buildDependencyPackages()) {
    console.error('Failed to build dependencies. Cannot proceed.');
    process.exit(1);
  }
  
  try {
    // Use double quotes for Windows compatibility
    execSync('pnpm --filter="@littlecarlito/blorkboard" dev', { 
      stdio: 'inherit',
      shell: true
    });
  } catch (cmdError) {
    console.error('Error running blorkboard dev script. This is a workspace resolution issue.');
    console.log('Attempting to repair workspace links...');
    
    // Attempt to repair links and try again
    if (repairWorkspaceLinks()) {
      console.log('Workspace links repaired. Trying again...');
      execSync('pnpm --filter="@littlecarlito/blorkboard" dev', {
        stdio: 'inherit',
        shell: true
      });
    } else {
      console.error('Failed to run blorkboard. Please check your pnpm configuration.');
      process.exit(1);
    }
  }
} catch (e) {
  console.error('Error: Could not find blorkboard package. Running install first...');
  
  if (repairWorkspaceLinks()) {
    // Build dependency packages before dev
    if (!buildDependencyPackages()) {
      console.error('Failed to build dependencies. Cannot proceed.');
      process.exit(1);
    }
    
    console.log('\nNow trying to run dev script...');
    execSync('pnpm --filter="@littlecarlito/blorkboard" dev', { 
      stdio: 'inherit',
      shell: true
    });
  } else {
    console.error('Failed to set up workspace. Please check your repository structure.');
    process.exit(1);
  }
} 