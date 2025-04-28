#!/usr/bin/env node

/**
 * GitHub Actions Workflow Validator
 * 
 * This script validates GitHub Actions workflow files and reports any issues.
 * It serves as a manual way to run the same validation that happens in the pre-commit hook.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.blue('🔍 GitHub Actions Validator'));
console.log(chalk.blue('=========================\n'));

// Check if the validation script exists
const validatorScript = path.join(__dirname, '../tests/pipeline-tests/validate-github-actions.sh');

if (!fs.existsSync(validatorScript)) {
  console.error(chalk.red('❌ Validator script not found at:'), validatorScript);
  console.log(chalk.yellow('\nMake sure you have the validation script at:'));
  console.log(chalk.yellow('  tests/pipeline-tests/validate-github-actions.sh'));
  process.exit(1);
}

try {
  // Make sure the script is executable
  try {
    fs.chmodSync(validatorScript, '755');
  } catch (err) {
    console.warn(chalk.yellow('⚠️ Could not make validator script executable. May need sudo permissions.'));
  }

  // Run the validator script and capture output
  console.log(chalk.blue('Running GitHub Actions validator...\n'));
  
  try {
    const result = execSync(`${validatorScript}`, { stdio: 'pipe', encoding: 'utf-8' });
    console.log(result);
    console.log(chalk.green('✅ GitHub Actions validation passed!'));
  } catch (validationError) {
    console.log(validationError.stdout ? validationError.stdout.toString() : validationError.message);
    console.log(chalk.red('❌ GitHub Actions validation failed!'));
    
    // Show the error count if it's in the output
    const errorMatch = validationError.stdout && validationError.stdout.toString().match(/Found (\d+) types of issues/);
    if (errorMatch && errorMatch[1]) {
      console.log(chalk.red(`Found ${errorMatch[1]} types of issues in GitHub Actions workflows.`));
    }
    
    process.exit(1);
  }
  
  // Check for specific issues in .github directory
  console.log(chalk.blue('\nAdditional checks for common GitHub Actions issues...\n'));
  
  // Look for || operators in expressions
  try {
    execSync('grep -r "\\${{ .* || .*}}" --include="*.yml" .github/', { stdio: 'pipe' });
    console.log(chalk.red('❌ Found potential invalid || operator usage:'));
    console.log(chalk.white(execSync('grep -r "\\${{ .* || .*}}" --include="*.yml" .github/', { encoding: 'utf-8' })));
    console.log(chalk.yellow('GitHub Actions expressions don\'t support the || operator with environment variables.'));
    console.log(chalk.yellow('Use conditional steps or bash if statements instead.'));
  } catch (err) {
    // grep returns non-zero if no matches found, which is good in this case
    console.log(chalk.green('✅ No invalid || operators found in GitHub Actions expressions'));
  }

  // Look for undefined variable references
  try {
    execSync('grep -r "\\${{ .* [A-Z_]* .*}}" --include="*.yml" .github/ | grep -v "steps\\|inputs\\|env\\|github\\|needs\\|secrets\\|vars\\|matrix\\|job\\|runner"', { stdio: 'pipe' });
    console.log(chalk.red('❌ Found potential references to undefined variables:'));
    console.log(chalk.white(execSync('grep -r "\\${{ .* [A-Z_]* .*}}" --include="*.yml" .github/ | grep -v "steps\\|inputs\\|env\\|github\\|needs\\|secrets\\|vars\\|matrix\\|job\\|runner"', { encoding: 'utf-8' })));
    console.log(chalk.yellow('Make sure all variables are properly defined before use.'));
  } catch (err) {
    // grep returns non-zero if no matches found, which is good in this case
    console.log(chalk.green('✅ No undefined variable references found in GitHub Actions expressions'));
  }

  // Check for actionlint availability
  try {
    execSync('command -v actionlint', { stdio: 'pipe' });
    console.log(chalk.green('✅ actionlint is installed'));
  } catch (err) {
    console.log(chalk.yellow('⚠️ actionlint is not installed. Full validation requires actionlint:'));
    console.log(chalk.white('    # Using Go:'));
    console.log(chalk.white('    go install github.com/rhysd/actionlint/cmd/actionlint@latest'));
    console.log(chalk.white('    # Using Homebrew:'));
    console.log(chalk.white('    brew install actionlint'));
  }

  console.log(chalk.blue('\n========================='));
  console.log(chalk.green('✅ All checks completed. No critical issues found.'));
  
} catch (error) {
  console.error(chalk.red('❌ Error running validator:'));
  console.error(error.stdout ? error.stdout.toString() : error.message);
  process.exit(1);
} 