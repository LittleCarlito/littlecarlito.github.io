/**
 * Path Configuration
 * 
 * This file provides a centralized source of truth for path-related configuration
 * used throughout the application. This helps ensure consistency in path handling
 * across different environments (local development vs GitHub Pages).
 */

// The GitHub Pages project name - this should be the only place it's defined
export const GITHUB_PAGES_BASE = 'threejs_site';

/**
 * Returns the base path for the current environment
 * @returns {string} Base path with trailing slash
 */
export function getBasePath() {
	// For GitHub Pages, check if we're on the GitHub domain or if the path includes the base
	const isGitHubPages = 
    window.location.hostname === 'littlecarlito.github.io' || 
    window.location.pathname.includes(`${GITHUB_PAGES_BASE}/`);
  
	return isGitHubPages ? `${GITHUB_PAGES_BASE}/` : '';
}

/**
 * Resolves a path based on the current environment (local dev or GitHub Pages)
 * @param {string} path - The path to resolve (can be relative or with leading slash)
 * @returns {string} The resolved path appropriate for the current environment
 */
export function resolvePath(path) {
	if (!path && path !== '') {
		return '';
	}
  
	const basePath = getBasePath();
  
	// Normalize the path by removing leading slash if present
	const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  
	// Combine base path with normalized path
	return `${basePath}${normalizedPath}`;
}

/**
 * Determines if the current environment is GitHub Pages
 * @returns {boolean} True if the current environment is GitHub Pages
 */
export function isGitHubPagesEnvironment() {
	return window.location.hostname === 'littlecarlito.github.io' || 
         window.location.pathname.includes(`${GITHUB_PAGES_BASE}/`);
}

/**
 * Gets the absolute URL for a path
 * @param {string} path - The path to resolve
 * @returns {string} The absolute URL
 */
export function getAbsoluteUrl(path) {
	const resolvedPath = resolvePath(path);
	return window.location.origin ? 
		`${window.location.origin}/${resolvedPath}` : 
		`http://localhost:3000/${resolvedPath}`;
} 