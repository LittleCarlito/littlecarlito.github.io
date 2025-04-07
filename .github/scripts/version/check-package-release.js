#!/usr/bin/env node

/**
 * Script to check if package releases exist on GitHub npm registry
 * This script:
 * 1. Checks if a package exists in the GitHub npm registry
 * 2. If not, marks it for publication
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Get package paths from arguments or use defaults
const packagePaths = process.argv.slice(2).length > 0 
  ? process.argv.slice(2) 
  : ['packages/blorkpack', 'packages/blorktools', 'packages/blorkboard', 'apps/portfolio'];

// Configuration
const owner = 'littlecarlito'; // GitHub organization name
const scope = '@littlecarlito'; // Package scope

/**
 * Check if a package version exists in the GitHub npm registry
 * @param {string} packageName - Package name with scope
 * @param {string} version - Package version
 * @returns {Promise<boolean>} - True if exists, false otherwise
 */
async function checkPackageExists(packageName, version) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'npm.pkg.github.com',
      path: `/${packageName.replace('@', '')}/`,
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.npm.install-v1+json',
        'User-Agent': 'node'
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 404) {
        console.log(`Package ${packageName} not found on GitHub npm`);
        resolve(false);
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const packageInfo = JSON.parse(data);
          const versionExists = packageInfo.versions && packageInfo.versions[version];
          console.log(`Package ${packageName}@${version} exists: ${!!versionExists}`);
          resolve(!!versionExists);
        } catch (error) {
          console.error(`Error parsing response for ${packageName}: ${error.message}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error checking package ${packageName}: ${error.message}`);
      resolve(false);
    });

    req.end();
  });
}

/**
 * Main function to check all packages
 */
async function main() {
  console.log('Checking packages for existing releases...');
  const packagesToPublish = [];

  // Process each package
  for (const packagePath of packagePaths) {
    const packageJsonPath = path.join(process.cwd(), packagePath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.log(`Package.json not found for ${packagePath}, skipping...`);
      continue;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const packageName = packageJson.name;
      const version = packageJson.version;

      if (!packageName || !version) {
        console.log(`Missing name or version in ${packagePath}/package.json, skipping...`);
        continue;
      }

      // Skip if version is 0.0.0
      if (version === '0.0.0') {
        console.log(`Package ${packageName} has version 0.0.0, marking for publication`);
        packagesToPublish.push(packagePath);
        continue;
      }

      // Check if package exists
      const exists = await checkPackageExists(packageName, version);
      if (!exists) {
        console.log(`Package ${packageName}@${version} does not exist, marking for publication`);
        packagesToPublish.push(packagePath);
      }
    } catch (error) {
      console.error(`Error processing ${packagePath}: ${error.message}`);
    }
  }

  // Output the list of packages to publish
  if (packagesToPublish.length > 0) {
    fs.writeFileSync(
      path.join(process.cwd(), '.packages-to-publish.json'), 
      JSON.stringify(packagesToPublish, null, 2)
    );
    console.log(`Found ${packagesToPublish.length} packages to publish`);
    return true;
  } else {
    console.log('All packages are up to date');
    return false;
  }
}

// Run the script
main()
  .then(hasPackagesToPublish => {
    process.exit(hasPackagesToPublish ? 0 : 1);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  }); 