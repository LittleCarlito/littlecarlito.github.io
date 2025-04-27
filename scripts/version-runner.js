#!/usr/bin/env node

/**
 * version-runner.js
 * Command-line interface for package versioning
 * Supports both dry-run and apply modes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the version-packages logic
const versionPackages = require('./version-packages.js');
const { BUMP_TYPES, incrementVersion, extractScope, extractCommitType, determineBumpType } = require('./version-utils');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  apply: args.includes('--apply'),
  outputJson: args.includes('--output-json'),
  dryRun: args.includes('--dry-run') || !args.includes('--apply'),
  verbose: args.includes('--verbose')
};

// Check for merge base environment variable
if (process.env.MERGE_BASE) {
  process.env.VERSION_MERGE_BASE = process.env.MERGE_BASE;
}

// Setup output file paths
const jsonOutputPath = 'version-output.json';
const summaryOutputPath = 'version-summary.md';

// Log configuration
console.log('Version Runner Configuration:');
console.log(`  Apply Changes: ${options.apply}`);
console.log(`  Output JSON: ${options.outputJson}`);
console.log(`  Dry Run: ${options.dryRun}`);
console.log(`  Verbose: ${options.verbose}`);
console.log(`  Merge Base: ${process.env.VERSION_MERGE_BASE || 'Not specified'}`);

// Run the version calculation
try {
  // Get the versioning result from the imported logic
  const result = versionPackages.versionPackages({
    apply: options.apply,
    dryRun: options.dryRun,
    verbose: options.verbose
  });
  
  // Process result
  const { packageVersions, packageCommits, currentVersions, updatedPackages } = result;
  
  // Create JSON output
  const jsonOutput = {
    updatedPackages: [],
    packagesToTag: [],
    allPackages: Object.keys(packageVersions).map(pkgPath => {
      const name = pkgPath.split('/').pop();
      const currentVersion = currentVersions[pkgPath];
      const newVersion = packageVersions[pkgPath];
      const hasChanges = newVersion && newVersion !== currentVersion;
      
      return {
        name,
        path: pkgPath,
        currentVersion,
        calculatedVersion: newVersion,
        hasChanges,
        commits: packageCommits[pkgPath].map(commit => ({
          hash: commit.hash,
          message: commit.message,
          type: commit.type,
          bumpType: commit.bumpType
        }))
      };
    })
  };
  
  // Add updatedPackages if we applied changes
  if (updatedPackages && updatedPackages.length > 0) {
    jsonOutput.updatedPackages = updatedPackages;
    jsonOutput.packagesToTag = updatedPackages.map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      tag: `${pkg.name}@${pkg.version}`
    }));
  }
  
  // Write JSON output if requested
  if (options.outputJson) {
    fs.writeFileSync(jsonOutputPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`JSON output written to ${jsonOutputPath}`);
    
    // Create a version summary markdown file
    const mdContent = [
      '# Version Updates\n',
      ...jsonOutput.updatedPackages.map(pkg => 
        `- ${pkg.name}: ${pkg.previousVersion} → ${pkg.version}`
      )
    ].join('\n');
    
    if (jsonOutput.updatedPackages.length > 0) {
      fs.writeFileSync(summaryOutputPath, mdContent);
      console.log(`Markdown summary written to ${summaryOutputPath}`);
    }
  }
  
  // Print summary
  console.log('\nVersion Calculation Summary:');
  console.log('------------------------');
  
  if (jsonOutput.updatedPackages.length > 0) {
    console.log('Updated Packages:');
    jsonOutput.updatedPackages.forEach(pkg => {
      console.log(`  ${pkg.name}: ${pkg.previousVersion} → ${pkg.version}`);
    });
  } else {
    console.log('No packages were updated.');
  }
  
  process.exit(0);
} catch (error) {
  console.error('Error running version calculation:', error);
  process.exit(1);
} 