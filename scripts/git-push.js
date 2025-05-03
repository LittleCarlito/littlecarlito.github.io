#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
let remote = 'origin';
let branch = null;
let dryRun = false;
let pushTags = true;
let skipTests = false;

// Parse arguments
args.forEach(arg => {
  if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg === '--no-tags') {
    pushTags = false;
  } else if (arg === '--skip-tests') {
    skipTests = true;
  } else if (!branch && arg.indexOf(':') === -1 && !arg.startsWith('-')) {
    // Simple remote name
    remote = arg;
  } else if (!branch && arg.indexOf(':') !== -1) {
    // Format like 'origin:branch' or 'origin:source:destination'
    const parts = arg.split(':');
    remote = parts[0];
    branch = parts.slice(1).join(':');
  }
});

// Get current branch if not specified
if (!branch) {
  const { stdout } = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' });
  branch = stdout.trim();
}

console.log(`Pushing branch ${branch} to ${remote}`);

// Run all pre-push checks using the _pre-push-checks.sh script
const preChecksPath = path.join(__dirname, '..', '.husky', '_pre-push-checks.sh');

// Set environment variables
const env = {
  ...process.env,
  HUSKY_PUSH_RUNNING: '1', // To make original pre-push skip itself
};

if (dryRun) {
  env.DRY_RUN = 'true';
}

if (skipTests) {
  env.SKIP_TESTS = 'true';
}

// Run the checks script
console.log('🔍 Running pre-push validation checks...');
const checkResult = spawnSync('bash', [preChecksPath, remote, `https://github.com/LittleCarlito/threejs_site.git`], {
  stdio: 'inherit',
  env
});

// If checks fail, exit with the same code
if (checkResult.status !== 0) {
  console.error('❌ Pre-push checks failed');
  process.exit(checkResult.status);
}

console.log('✅ Pre-push checks passed!');

// Check for version changes and tags
let needsTags = false;
if (pushTags) {
  // Check for local tags not on remote
  const localTags = spawnSync('git', ['tag'], { encoding: 'utf8' }).stdout.trim().split('\n');
  const remoteTags = spawnSync('git', ['ls-remote', '--tags', remote], { encoding: 'utf8' })
    .stdout.trim()
    .split('\n')
    .map(line => line.split('\t')[1])
    .filter(Boolean)
    .map(ref => ref.replace('refs/tags/', ''))
    .filter(tag => !tag.endsWith('^{}'));

  const tagsToSend = localTags.filter(tag => !remoteTags.includes(tag) && tag);
  
  if (tagsToSend.length > 0) {
    console.log('🏷️ Tags to be pushed:');
    tagsToSend.forEach(tag => console.log(`  ${tag}`));
    needsTags = true;
  }
  
  // Also check if we have uncommitted version changes that need tags
  const uncommittedVersions = spawnSync('git', ['diff', '--name-only', '--diff-filter=M', '--', '**/package.json'], 
    { encoding: 'utf8' }).stdout.trim();
  
  if (uncommittedVersions) {
    console.log('📦 Uncommitted package version changes detected, creating tags...');
    
    // Run versioning
    const versionResult = spawnSync('pnpm', ['version:local-tags'], { 
      stdio: 'inherit',
      env
    });
    
    if (versionResult.status !== 0) {
      console.error('❌ Version tag creation failed');
      process.exit(versionResult.status);
    }
    
    needsTags = true;
  }
}

// Now handle the actual push
console.log('🚀 Executing push...');
const pushArgs = ['push'];

// Add remote and branch
pushArgs.push(remote, `${branch}:${branch}`);

// Add tags if needed
if (needsTags) {
  pushArgs.push('--tags');
}

console.log(`git ${pushArgs.join(' ')}`);

if (!dryRun) {
  const pushResult = spawnSync('git', pushArgs, { stdio: 'inherit' });
  if (pushResult.status !== 0) {
    console.error('❌ Push failed');
    process.exit(pushResult.status);
  }
  console.log('✅ Push completed successfully!');
} else {
  console.log('🔍 [DRY RUN] - No changes were pushed');
} 