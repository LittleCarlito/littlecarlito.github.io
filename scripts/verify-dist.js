import fs from 'fs';
import path from 'path';

// Check if packages directory exists in dist
const distPath = path.resolve('dist');
const packagesPath = path.join(distPath, 'packages');

console.log('Verifying that no source files are included in the dist directory...');

// Check for packages directory
if (fs.existsSync(packagesPath)) {
  console.error('ERROR: packages directory found in dist folder!');
  console.log('Removing packages directory from dist to prevent source code deployment');
  
  // Recursively delete the packages directory
  fs.rmSync(packagesPath, { recursive: true, force: true });
  console.log('Removed packages directory from dist.');
} else {
  console.log('✅ No packages directory found in dist. Good!');
}

// Function to check for source files
function findSourceFiles(directory) {
  const sourceFiles = [];
  
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules directory
        if (entry.name !== 'node_modules') {
          scan(fullPath);
        }
      } else {
        // Check file extensions
        if (
          entry.name.endsWith('.ts') || 
          entry.name.endsWith('.tsx') || 
          entry.name.endsWith('.js.map')
        ) {
          sourceFiles.push(fullPath);
        }
      }
    }
  }
  
  scan(directory);
  return sourceFiles;
}

// Find source files
const sourceFiles = findSourceFiles(distPath);

if (sourceFiles.length > 0) {
  console.warn('WARNING: Source files found in dist folder. Consider reviewing your build process.');
  console.log('Source files:');
  sourceFiles.forEach(file => console.log(`- ${file}`));
} else {
  console.log('✅ No source code files found in dist.');
}

console.log('Verification complete!'); 