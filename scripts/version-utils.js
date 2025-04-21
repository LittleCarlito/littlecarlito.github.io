/**
 * Shared versioning utilities for both dry-run simulation and actual versioning logic
 */

// Version bump types
const BUMP_TYPES = {
  PATCH: 'patch',
  MINOR: 'minor',
  MAJOR: 'major'
};

/**
 * Increment a version string based on semver bump type
 * @param {string} version Current version
 * @param {string} bumpType Bump type (patch, minor, major)
 * @returns {string} New version
 */
function incrementVersion(version, bumpType) {
  const [major, minor, patch] = version.split('.').map(Number);
  
  switch (bumpType) {
    case BUMP_TYPES.MAJOR:
      return `${major + 1}.0.0`;
    case BUMP_TYPES.MINOR:
      return `${major}.${minor + 1}.0`;
    case BUMP_TYPES.PATCH:
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

/**
 * Extract scope from commit message
 * @param {string} message Commit message
 * @returns {string|null} Scope or null if no scope found
 */
function extractScope(message) {
  const match = message.match(/^[a-z]+\(([^)]+)\):/);
  return match ? match[1] : null;
}

/**
 * Extract commit type from message
 * @param {string} message Commit message
 * @returns {string|null} Commit type or null if not found
 */
function extractCommitType(message) {
  const match = message.match(/^([a-z]+)(?:\([^)]+\))?:/);
  return match ? match[1] : null;
}

/**
 * Determine version bump type based on commit message
 * @param {string} message Commit message
 * @returns {string} Version bump type (patch, minor, major)
 */
function determineBumpType(message) {
  // Check for breaking changes
  if (message.includes('BREAKING CHANGE:') || 
      message.match(/^(feat|fix|refactor)!:/)) {
    return BUMP_TYPES.MAJOR;
  }
  
  // Check for features
  if (message.match(/^feat(\([^)]+\))?:/)) {
    return BUMP_TYPES.MINOR;
  }
  
  // Default to patch
  return BUMP_TYPES.PATCH;
}

module.exports = {
  BUMP_TYPES,
  incrementVersion,
  extractScope,
  extractCommitType,
  determineBumpType
}; 