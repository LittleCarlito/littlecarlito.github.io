// Path utilities for handling GitHub Pages deployment
// This module provides functions to resolve asset paths correctly in both local and deployed environments

/**
 * Gets the base URL for the current environment
 * In development: returns '/'
 * In GitHub Pages: returns '/threejs_site/' (or whatever your repo name is)
 */
export function getBasePath() {
    // Vite automatically sets this based on the base config
    return import.meta.env.BASE_URL || '/';
}

/**
 * Resolves a path relative to the application base
 * @param {string} path - The path to resolve (should not start with /)
 * @returns {string} The resolved path
 */
export function resolvePath(path) {
    const basePath = getBasePath();
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    // Ensure base path ends with slash
    const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
    return cleanBase + cleanPath;
}

/**
 * Resolves multiple paths at once
 * @param {...string} paths - The paths to resolve
 * @returns {string[]} Array of resolved paths
 */
export function resolvePaths(...paths) {
    return paths.map(path => resolvePath(path));
}

/**
 * Creates a URL object with the correct base path
 * @param {string} path - The path to create URL for
 * @returns {URL} URL object with correct base
 */
export function createUrl(path) {
    const resolvedPath = resolvePath(path);
    return new URL(resolvedPath, window.location.origin);
}