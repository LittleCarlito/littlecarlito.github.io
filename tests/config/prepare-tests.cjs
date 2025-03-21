#!/usr/bin/env node

/**
 * Test environment preparation script
 * Run before Jest tests to ensure the environment is correctly configured.
 * This helps ensure consistent test behavior locally and in CI.
 */

const fs = require('fs');
const path = require('path');

/**
 * Prepare the test environment by setting up module resolution
 * This ensures that @littlecarlito/blorkpack can be properly resolved
 * during tests, both in local development and CI environments.
 */
module.exports = async function() {
  console.log('📦 Preparing test environment...');

  // Define paths
  const ROOT_DIR = path.resolve(__dirname, '../..');
  const DIST_DIR = path.join(ROOT_DIR, 'packages/blorkpack/dist');
  const NODE_MODULE_DIR = path.join(ROOT_DIR, 'node_modules/@littlecarlito/blorkpack');

  // Check if the package is built
  if (!fs.existsSync(DIST_DIR) || !fs.existsSync(path.join(DIST_DIR, 'index.js'))) {
    console.error('❌ Error: blorkpack package is not built. Run "pnpm --filter @littlecarlito/blorkpack build" first.');
    process.exit(1);
  }

  // Ensure node_modules directory exists
  if (!fs.existsSync(NODE_MODULE_DIR)) {
    console.log('📁 Creating module directory in node_modules for test resolution...');
    fs.mkdirSync(NODE_MODULE_DIR, { recursive: true });
  }

  // Copy dist files to node_modules to ensure consistent module resolution
  console.log('📋 Copying dist files to node_modules for consistent module resolution...');
  const files = fs.readdirSync(DIST_DIR);
  files.forEach(file => {
    const srcPath = path.join(DIST_DIR, file);
    const destPath = path.join(NODE_MODULE_DIR, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  });

  // Create a package.json in the node_modules directory to help with module resolution
  const packageJson = {
    name: '@littlecarlito/blorkpack',
    version: '1.0.0',
    main: 'index.js',
    type: 'module'
  };

  fs.writeFileSync(
    path.join(NODE_MODULE_DIR, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  console.log('✅ Test environment preparation complete!');
}; 