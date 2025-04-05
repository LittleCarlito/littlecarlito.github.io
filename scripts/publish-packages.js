#!/usr/bin/env node

/**
 * publish-packages.js
 * Publishes packages to the registry
 * Replaces changeset publish with direct publishing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES = [
  'packages/blorkpack',
  'packages/blorktools',
  'packages/blorkboard',
  'apps/portfolio'
];

// Parse command line arguments
const args = process.argv.slice(2);
const isForce = args.includes('--force');

/**
 * Create git tag for a package
 * @param {string} pkgPath Path to package directory
 * @returns {string|null} Tag name or null if tag creation failed
 */
function createGitTag(pkgPath) {
  try {
    const pkgJsonPath = path.join(process.cwd(), pkgPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    
    if (!pkg.version) {
      console.error(`❌ No version found in ${pkgPath}/package.json`);
      return null;
    }
    
    const pkgName = pkg.name.replace('@littlecarlito/', '');
    const tagName = `${pkgName}@${pkg.version}`;
    
    // Check if tag already exists
    try {
      execSync(`git rev-parse ${tagName}`);
      console.log(`⚠️ Tag ${tagName} already exists`);
      return tagName;
    } catch (e) {
      // Tag doesn't exist, create it
      execSync(`git tag ${tagName}`);
      console.log(`🏷️ Created tag ${tagName}`);
      return tagName;
    }
  } catch (error) {
    console.error(`❌ Failed to create tag for ${pkgPath}:`, error.message);
    return null;
  }
}

/**
 * Publish a package to the registry
 * @param {string} pkgPath Path to package directory
 * @returns {boolean} Whether the publish succeeded
 */
function publishPackage(pkgPath) {
  try {
    console.log(`📦 Publishing ${pkgPath}...`);
    
    // Construct publish command
    let publishCmd = `cd ${pkgPath} && npm publish`;
    
    // Add force flag if requested
    if (isForce) {
      publishCmd += ' --force';
    }
    
    // Add access public for scoped packages
    publishCmd += ' --access public';
    
    // Run the publish command
    execSync(publishCmd, { stdio: 'inherit' });
    
    console.log(`✅ Published ${pkgPath} successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to publish ${pkgPath}:`, error.message);
    return false;
  }
}

/**
 * Main function to publish packages
 */
function publishPackages() {
  console.log('🚀 Publishing packages...');
  
  const tags = [];
  const publishResults = [];
  
  // Create tags for each package
  for (const pkg of PACKAGES) {
    const tag = createGitTag(pkg);
    if (tag) {
      tags.push(tag);
    }
  }
  
  // Push tags to remote
  if (tags.length > 0) {
    try {
      console.log('🔄 Pushing tags to remote...');
      execSync('git push --tags');
      console.log(`✅ Pushed ${tags.length} tags to remote`);
    } catch (error) {
      console.error('❌ Failed to push tags:', error.message);
    }
  }
  
  // Publish each package
  for (const pkg of PACKAGES) {
    const success = publishPackage(pkg);
    publishResults.push({ package: pkg, success });
  }
  
  // Summary
  console.log('\n📊 Publish Summary:');
  const successCount = publishResults.filter(r => r.success).length;
  const failureCount = publishResults.length - successCount;
  
  console.log(`✅ Successfully published: ${successCount}`);
  console.log(`❌ Failed to publish: ${failureCount}`);
  
  if (failureCount > 0) {
    console.log('\nFailed packages:');
    publishResults.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.package}`);
    });
    process.exit(1);
  }
}

// Run the publishing
publishPackages(); 