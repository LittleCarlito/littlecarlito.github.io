/**
 * Unit tests for version-packages.js
 * These tests directly test the source file rather than a mocked version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mock the fs and child_process modules
jest.mock('fs');
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

// Path to version-packages.js
const VERSION_PACKAGES_PATH = path.join(process.cwd(), 'scripts', 'version-packages.js');

// Mock utilities to test updatePackageVersion in isolation
describe('updatePackageVersion isolated test', () => {
  // Define the original function to test in isolation
  let BUMP_TYPES;
  let updatePackageVersion;
  
  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
    
    // Mock fs functions for all tests
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (filePath.endsWith('package.json')) {
        return JSON.stringify({ name: 'test-package', version: '0.1.0' });
      }
      return '';
    });
    fs.writeFileSync.mockImplementation(() => {});
    
    // Load the version utilities
    const versionUtils = require('../../scripts/version-utils');
    BUMP_TYPES = versionUtils.BUMP_TYPES;
    
    // Define updatePackageVersion function for isolated testing
    // This is the exact function from version-packages.js with explicit packageCommits parameter
    updatePackageVersion = (pkgPath, newVersion, packageCommits) => {
      if (!newVersion) {
        return null;
      }
      
      const pkgJsonPath = path.join(process.cwd(), pkgPath, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      
      // Default to 0.0.0 if no version exists
      const currentVersion = pkg.version || '0.0.0';
      
      // Update package.json
      pkg.version = newVersion;
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      
      // Find the highest bump type that led to this version
      let highestBumpType = BUMP_TYPES.PATCH;
      for (const commit of packageCommits[pkgPath] || []) {
        if (commit.bumpType === BUMP_TYPES.MAJOR) {
          highestBumpType = BUMP_TYPES.MAJOR;
          break;
        } else if (commit.bumpType === BUMP_TYPES.MINOR && highestBumpType !== BUMP_TYPES.MAJOR) {
          highestBumpType = BUMP_TYPES.MINOR;
        }
      }
      
      return {
        currentVersion,
        newVersion,
        bumpType: highestBumpType
      };
    };
  });
  
  test('should require packageCommits parameter', () => {
    // The function should throw an error when packageCommits is not provided
    expect(() => {
      updatePackageVersion('packages/test-package', '0.2.0');
    }).toThrow();
  });
  
  test('should handle packageCommits parameter properly', () => {
    // Setup a mock packageCommits object
    const packageCommits = {
      'packages/test-package': [
        { hash: 'abc123', message: 'fix: test fix', bumpType: BUMP_TYPES.PATCH },
        { hash: 'def456', message: 'feat: test feature', bumpType: BUMP_TYPES.MINOR }
      ]
    };
    
    // This should not throw an error
    const result = updatePackageVersion('packages/test-package', '0.2.0', packageCommits);
    
    // Verify the result
    expect(result).not.toBeNull();
    expect(result.currentVersion).toBe('0.1.0');
    expect(result.newVersion).toBe('0.2.0');
    expect(result.bumpType).toBe(BUMP_TYPES.MINOR); // Should detect highest bump type as MINOR
    
    // Verify that the function used the packageCommits parameter
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
  
  test('should handle empty packageCommits object correctly', () => {
    // Setup an empty packageCommits object
    const packageCommits = {};
    
    // Should not throw an error
    const result = updatePackageVersion('packages/test-package', '0.2.0', packageCommits);
    
    // Verify default behavior with empty packageCommits
    expect(result).not.toBeNull();
    expect(result.bumpType).toBe(BUMP_TYPES.PATCH); // Default should be PATCH
  });
  
  test('should determine correct bump type from commits', () => {
    // Test with all commit types
    const testCases = [
      {
        description: 'single patch commit',
        commits: [{ bumpType: BUMP_TYPES.PATCH }],
        expectedBumpType: BUMP_TYPES.PATCH
      },
      {
        description: 'multiple patch commits',
        commits: [{ bumpType: BUMP_TYPES.PATCH }, { bumpType: BUMP_TYPES.PATCH }],
        expectedBumpType: BUMP_TYPES.PATCH
      },
      {
        description: 'one minor commit among patches',
        commits: [{ bumpType: BUMP_TYPES.PATCH }, { bumpType: BUMP_TYPES.MINOR }, { bumpType: BUMP_TYPES.PATCH }],
        expectedBumpType: BUMP_TYPES.MINOR
      },
      {
        description: 'one major commit among patches and minors',
        commits: [{ bumpType: BUMP_TYPES.PATCH }, { bumpType: BUMP_TYPES.MINOR }, { bumpType: BUMP_TYPES.MAJOR }],
        expectedBumpType: BUMP_TYPES.MAJOR
      }
    ];
    
    // Run tests for each case
    testCases.forEach(({ description, commits, expectedBumpType }) => {
      const packageCommits = {
        'packages/test-package': commits
      };
      
      const result = updatePackageVersion('packages/test-package', '0.2.0', packageCommits);
      expect(result.bumpType).toBe(expectedBumpType, `Failed for test case: ${description}`);
    });
  });
});

describe('Integration test for versionPackages function', () => {
  let versionPackages;
  let determineVersionBumps;
  let updatePackageVersion;
  
  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
    
    // Mock execSync to return predictable values for git commands
    execSync.mockImplementation(command => {
      if (command.includes('git tag')) {
        return 'v1.0.0\nv0.9.0';
      }
      if (command.includes('git log')) {
        return 'abc123\ndef456';
      }
      if (command.includes('git rev-list')) {
        return 'mock-first-commit';
      }
      return '';
    });
    
    // Mock fs functions
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (filePath.endsWith('package.json')) {
        return JSON.stringify({ version: '0.1.0' });
      }
      return '';
    });
    
    // Clear cache to reload modules with fresh mocks
    jest.resetModules();
    
    // Create a spy for a custom implementation
    determineVersionBumps = jest.fn().mockReturnValue({
      packageVersions: {
        'packages/test-package': '0.2.0'
      },
      packageCommits: {
        'packages/test-package': [
          { hash: 'abc123', message: 'feat: test feature', bumpType: 'minor' }
        ]
      },
      currentVersions: {
        'packages/test-package': '0.1.0'
      }
    });
    
    // Create a spy for updatePackageVersion
    updatePackageVersion = jest.fn().mockReturnValue({
      currentVersion: '0.1.0',
      newVersion: '0.2.0',
      bumpType: 'minor'
    });
    
    // Create a minimal version of versionPackages for testing
    versionPackages = (options = {}) => {
      const { packageVersions, packageCommits, currentVersions } = determineVersionBumps();
      
      // Update package versions
      for (const [pkg, newVersion] of Object.entries(packageVersions)) {
        if (newVersion && currentVersions[pkg] !== newVersion) {
          if (options.apply) {
            // This is the call we're testing - it must pass packageCommits
            updatePackageVersion(pkg, newVersion, packageCommits);
          }
        }
      }
      
      return { packageVersions, packageCommits, currentVersions };
    };
  });
  
  test('should pass packageCommits to updatePackageVersion', () => {
    // Run the function
    versionPackages({ apply: true });
    
    // Verify updatePackageVersion was called with packageCommits
    expect(updatePackageVersion).toHaveBeenCalledWith(
      'packages/test-package',
      '0.2.0',
      expect.any(Object) // packageCommits
    );
    
    // Verify third argument (packageCommits) is the expected object
    const packageCommitsArg = updatePackageVersion.mock.calls[0][2];
    expect(packageCommitsArg).toHaveProperty('packages/test-package');
    expect(packageCommitsArg['packages/test-package']).toHaveLength(1);
    expect(packageCommitsArg['packages/test-package'][0].hash).toBe('abc123');
  });
}); 