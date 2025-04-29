#!/usr/bin/env node

/**
 * This script runs the version-from-commits script in dry-run mode
 * to show what changesets would be created without actually creating them.
 * 
 * Usage: node dry-run-changeset.js [--branch=<branch>] [--from=<commit>]
 */

const { execSync, spawnSync } = require('child_process');
const { join } = require('path');
const chalk = require('chalk');

// Parse arguments
const branchArg = process.argv.find(arg => arg.startsWith('--branch='));
const fromArg = process.argv.find(arg => arg.startsWith('--from='));
let currentBranch;

if (branchArg) {
  currentBranch = branchArg.split('=')[1];
} else {
  // Get current branch
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    console.error(chalk.red('Error getting current branch:'), error.message);
    process.exit(1);
  }
}

// Check if branch exists
try {
  execSync(`git rev-parse --verify ${currentBranch}`, { stdio: 'pipe' });
} catch (error) {
  console.error(chalk.red(`Branch '${currentBranch}' does not exist or is not a valid git reference.`));
  process.exit(1);
}

// If on main branch, inform the user
if (currentBranch === 'main') {
  console.log(chalk.yellow('⚠️  Warning: You are currently on the main branch.'));
  console.log(chalk.yellow('   This command is meant to be run on a feature branch to see what would change if merged to main.'));
  console.log(chalk.yellow('   Continuing will show changes between the latest tag and HEAD.\n'));
}

console.log(chalk.blue(`Testing changeset generation for branch: ${chalk.bold(currentBranch)}`));
console.log(chalk.blue(`Running in dry-run mode - no changesets will be created.\n`));

// Run the version script with dry-run flag
const versionScriptPath = join(__dirname, '..', '.github', 'scripts', 'versioning', 'version-from-commits.js');

try {
  // Check if the versioning script exists
  try {
    execSync(`ls "${versionScriptPath}"`, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Versioning script not found at ${versionScriptPath}. Please ensure it exists.`);
  }

  let args = ['--dry-run'];
  
  // Use the current branch as the target
  args.push(`--to=${currentBranch}`);
  
  // Add from parameter if specified
  if (fromArg) {
    args.push(fromArg);
  }
  
  console.log(chalk.dim(`> node ${versionScriptPath} ${args.join(' ')}\n`));
  
  // Use spawnSync instead of execSync to get better error handling and capture both stdout and stderr
  const result = spawnSync('node', [versionScriptPath, ...args], { 
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });
  
  if (result.error) {
    throw result.error;
  }
  
  if (result.status !== 0) {
    throw new Error(`Process exited with code ${result.status}\n${result.stderr}`);
  }
  
  // Get the output
  const output = result.stdout;
  const versionOutput = result.stderr; // Version changes are sent to stderr
  
  // Simplify the stdout display - only show necessary info
  const isNoChanges = output.includes('No version changes detected');
  
  if (isNoChanges) {
    console.log(chalk.gray('No version changes detected'));
  } else if (versionOutput) {
    // Show version changes with nice formatting
    console.log(chalk.bold.underline('\nVersion Changes:'));
    console.log(versionOutput);
  }
  
  // Show information about what would happen
  console.log(chalk.green('\n✅ Test completed successfully.'));
  console.log(chalk.blue('\nℹ️  This was a dry run. No changesets were created.'));
  console.log(chalk.blue('   To create the changesets, run the actual versioning command.'));
  
} catch (error) {
  console.error(chalk.red('Error during dry run:'));
  console.error(chalk.red(error.message || error));
  process.exit(1);
} 