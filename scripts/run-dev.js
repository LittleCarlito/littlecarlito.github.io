/**
 * Cross-platform script to run the blorkboard dev command
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if blorkboard package exists
try {
  fs.accessSync(path.join(__dirname, '../packages/blorkboard/package.json'));
  console.log('Running blorkboard dev script...');
  
  try {
    // Use double quotes for Windows compatibility
    execSync('pnpm --filter="@littlecarlito/blorkboard" dev', { 
      stdio: 'inherit',
      shell: true
    });
  } catch (cmdError) {
    console.error('Error running blorkboard dev script. This might be a workspace resolution issue.');
    
    // Try running with exact path reference instead of package name
    console.log('\nAttempting alternative approach...');
    try {
      execSync('cd packages/blorkboard && pnpm dev', {
        stdio: 'inherit',
        shell: true
      });
    } catch (altError) {
      console.error('Alternative approach failed. Running full install and trying again...');
      execSync('pnpm install', { stdio: 'inherit', shell: true });
      
      try {
        execSync('pnpm --filter="@littlecarlito/blorkboard" dev', { 
          stdio: 'inherit',
          shell: true
        });
      } catch (finalError) {
        console.error('All attempts failed. Please check your pnpm configuration and workspace setup.');
        process.exit(1);
      }
    }
  }
} catch (e) {
  console.error('Error: Could not find blorkboard package. Running install first...');
  execSync('pnpm install', { stdio: 'inherit', shell: true });
  
  console.log('\nNow trying to run dev script again...');
  try {
    execSync('pnpm --filter="@littlecarlito/blorkboard" dev', { 
      stdio: 'inherit',
      shell: true
    });
  } catch (retryError) {
    console.error('Still encountered issues. Trying direct path reference...');
    execSync('cd packages/blorkboard && pnpm dev', {
      stdio: 'inherit',
      shell: true
    });
  }
} 