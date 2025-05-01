const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define package directories
const PACKAGE_DIRS = ['packages', 'apps'];

// Define custom scopes and their mappings
const SCOPE_MAPPINGS = {
  'pipeline': 'pipeline', // Ignored scope
  'portfolio': 'portfolio',
  'blorktools': 'blorktools',
  'blorkpack': 'blorkpack',
  'blorkvision': 'blorkvision',
  'blorkboard': 'blorkvisor', // Handle the rename from "blorkboard" to "blorkvisor"
};

// Get all conventional commits without scopes (to be applied to all packages)
function getScopelessCommits() {
  console.log('\nAnalyzing scopeless commits (applicable to all packages)...');
  
  try {
    // Get commit history for scopeless conventional commits
    // Looking for commits that follow the pattern but don't have a scope (e.g., feat: something, not feat(scope): something)
    const gitLogCmd = `git log --format="%h|%s" --grep="^feat\\([^)]*\\): " --grep="^fix\\([^)]*\\): " --grep="^feat: " --grep="^fix: " --grep="^slice\\([^)]*\\): " --all`;
    
    const gitLog = execSync(
      gitLogCmd,
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 } // Increase buffer size for large repos
    ).trim();
    
    if (!gitLog) {
      console.log('No scopeless commits found');
      return [];
    }
    
    const commits = gitLog.split('\n')
      // Filter out commits with scopes
      .filter(commitLine => {
        const message = commitLine.split('|')[1];
        // Ensure the commit doesn't have a scope (except for slice scope which is special)
        return !(message.match(/^(feat|fix)\([^)]+\):/) || message.includes('(pipeline)'));
      });
    
    console.log(`Found ${commits.length} scopeless commits applicable to all packages`);
    
    return commits;
  } catch (error) {
    console.error('Error analyzing scopeless commits:', error.message);
    return [];
  }
}

// Function to analyze commits for a specific path
function analyzeCommits(packagePath, packageName) {
  console.log(`\nAnalyzing commits for ${packagePath}...`);
  
  try {
    // Get directory name from path for renaming cases
    const dirName = path.basename(packagePath);
    
    // Prepare git log command based on package
    let gitLogCmd = `git log --format="%h|%s" -- ${packagePath}`;
    
    // Handle blorkvisor (formerly blorkboard)
    const isBlorkvisor = dirName === 'blorkvisor';
    
    // Add additional commit search for blorkvisor/blorkboard
    if (isBlorkvisor) {
      console.log(`  - Including commits with scope (blorkboard) for ${packagePath}`);
      gitLogCmd = `(${gitLogCmd}) && (git log --format="%h|%s" --grep="\\(blorkboard\\)" --all)`;
    }
    
    // Execute git log command
    const gitLog = execSync(
      gitLogCmd,
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 } // Increase buffer size for large repos
    ).trim();
    
    // Get scopeless commits (applied to all packages)
    const scopelessCommits = getScopelessCommits();
    
    let allCommits = [];
    
    if (gitLog) {
      allCommits = gitLog.split('\n');
    }
    
    // Add scopeless commits to this package's commits
    allCommits = [...allCommits, ...scopelessCommits];
    
    // Remove duplicate commits (based on hash)
    const uniqueCommits = Array.from(new Map(
      allCommits.map(line => {
        const [hash] = line.split('|');
        return [hash, line];
      })
    ).values());
    
    console.log(`Found ${uniqueCommits.length} total commits for ${packagePath}`);
    
    if (uniqueCommits.length === 0) {
      return { major: 0, minor: 0, patch: 0, details: [] };
    }
    
    let major = 0, minor = 0, patch = 0;
    let details = [];

    uniqueCommits.forEach(commitLine => {
      const [hash, message] = commitLine.split('|');
      let type = 'other';
      let impact = 'none';
      
      // Check for major version bumps (breaking changes)
      if (
        message.includes('BREAKING CHANGE') || 
        message.includes('!:') ||
        message.match(/feat!(\([^)]*\))?:/)
      ) {
        major++;
        type = 'breaking';
        impact = 'major';
      }
      // Check for pipeline scope (ignored)
      else if (message.includes('(pipeline)')) {
        type = 'pipeline';
        impact = 'ignored';
      }
      // Check for feature commits (minor version bump)
      else if (message.startsWith('feat')) {
        minor++;
        type = 'feature';
        impact = 'minor';
      }
      // Check for fix commits or slice scope (patch version bump)
      else if (
        message.startsWith('fix') || 
        message.match(/slice\([^)]*\):/)
      ) {
        patch++;
        type = 'fix';
        impact = 'patch';
      }
      
      // Add detailed information about this commit
      details.push({
        hash,
        message,
        type,
        impact
      });
    });

    return { 
      major, 
      minor, 
      patch, 
      details 
    };
  } catch (error) {
    console.error(`Error analyzing commits for ${packagePath}:`, error.message);
    return { major: 0, minor: 0, patch: 0, details: [] };
  }
}

// Function to determine package version
function determineVersion(versionInfo) {
  const { major, minor, patch } = versionInfo;
  
  if (major > 0) {
    return `${major}.0.0`; // If there are breaking changes, reset minor and patch
  } else if (minor > 0) {
    return `0.${minor}.0`; // If there are features but no breaking changes, reset patch
  } else {
    return `0.0.${patch}`; // Only fixes, increment patch
  }
}

// Function to update package.json
function updatePackageJson(packagePath, version, versionInfo) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`No package.json found at ${packageJsonPath}`);
    return false;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version || '0.0.0';
    
    packageJson.version = version;
    
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n'
    );
    
    console.log(`Updated ${packagePath}/package.json: ${oldVersion} -> ${version}`);
    console.log(`  - Major changes: ${versionInfo.major}`);
    console.log(`  - Minor changes: ${versionInfo.minor}`);
    console.log(`  - Patch changes: ${versionInfo.patch}`);
    
    // Log some representative commits from each category
    logCommitSamples(versionInfo.details);
    
    return true;
  } catch (error) {
    console.error(`Error updating ${packageJsonPath}:`, error.message);
    return false;
  }
}

// Function to log representative commit samples
function logCommitSamples(details) {
  const samples = {
    breaking: [],
    feature: [],
    fix: []
  };
  
  // Collect up to 3 samples of each type
  details.forEach(commit => {
    if (commit.type === 'breaking' && samples.breaking.length < 3) {
      samples.breaking.push(commit);
    } else if (commit.type === 'feature' && samples.feature.length < 3) {
      samples.feature.push(commit);
    } else if (commit.type === 'fix' && samples.fix.length < 3) {
      samples.fix.push(commit);
    }
  });
  
  // Log samples
  if (samples.breaking.length > 0) {
    console.log('\n  Sample breaking changes:');
    samples.breaking.forEach(commit => {
      console.log(`   - ${commit.hash.substring(0, 7)}: ${commit.message}`);
    });
  }
  
  if (samples.feature.length > 0) {
    console.log('\n  Sample features:');
    samples.feature.forEach(commit => {
      console.log(`   - ${commit.hash.substring(0, 7)}: ${commit.message}`);
    });
  }
  
  if (samples.fix.length > 0) {
    console.log('\n  Sample fixes:');
    samples.fix.forEach(commit => {
      console.log(`   - ${commit.hash.substring(0, 7)}: ${commit.message}`);
    });
  }
}

// Main function
function main() {
  let updated = 0;
  let failed = 0;
  const packageSummary = [];
  
  console.log('🔍 Starting semantic version analysis based on commit history...');
  console.log('  - Including scopeless commits for all packages');
  console.log('  - Considering (blorkboard) scope for blorkvisor');
  
  // Process each directory where packages are located
  PACKAGE_DIRS.forEach(dirName => {
    const dir = path.join(process.cwd(), dirName);
    
    if (!fs.existsSync(dir)) {
      console.log(`Directory ${dirName} does not exist, skipping`);
      return;
    }
    
    // Process each package in the directory
    fs.readdirSync(dir).forEach(pkg => {
      const packagePath = path.join(dir, pkg);
      
      // Skip if not a directory
      if (!fs.statSync(packagePath).isDirectory()) {
        return;
      }
      
      // Analyze commit history and determine version
      const versionInfo = analyzeCommits(packagePath, pkg);
      const version = determineVersion(versionInfo);
      
      // Update package.json with new version
      const success = updatePackageJson(packagePath, version, versionInfo);
      
      if (success) {
        updated++;
        packageSummary.push({
          name: `${dirName}/${pkg}`,
          version,
          changes: {
            major: versionInfo.major,
            minor: versionInfo.minor,
            patch: versionInfo.patch
          }
        });
      } else {
        failed++;
      }
    });
  });
  
  console.log('\n✅ Version update complete:');
  console.log(`  - Updated packages: ${updated}`);
  console.log(`  - Failed updates: ${failed}`);
  
  console.log('\n📊 Summary of package versions:');
  console.log('-'.repeat(60));
  console.log('| Package'.padEnd(30) + '| Version'.padEnd(15) + '| Changes'.padEnd(15) + '|');
  console.log('-'.repeat(60));
  
  packageSummary.forEach(pkg => {
    const changesStr = `${pkg.changes.major}/${pkg.changes.minor}/${pkg.changes.patch}`;
    console.log('| ' + pkg.name.padEnd(28) + '| ' + pkg.version.padEnd(13) + '| ' + changesStr.padEnd(13) + '|');
  });
  
  console.log('-'.repeat(60));
  console.log('Format: major/minor/patch');
}

main(); 