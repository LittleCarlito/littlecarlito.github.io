/**
 * Global configuration for the application
 * This file should be loaded before any other modules
 */

// Create a global configuration object
window.AppConfig = window.AppConfig || {};

// Set environment information
window.AppConfig.isProduction = window.location.hostname === 'littlecarlito.github.io';
window.AppConfig.basePath = window.AppConfig.isProduction ? '/threejs_site' : '';
window.AppConfig.fontBasePath = window.AppConfig.isProduction ? '/threejs_site/fonts' : '/fonts';
window.AppConfig.relativeFontPath = window.AppConfig.isProduction ? '/threejs_site/fonts' : '../fonts';

// Export for ESM compatibility
export const AppConfig = window.AppConfig;

/**
 * Gets the full path for a specific font file
 * @param {string} fontFileName - The name of the font file
 * @param {boolean} useRelativePath - Whether to use a relative path (for HTML files)
 * @returns {string} The full path to the font file
 */
export function getFontPath(fontFileName, useRelativePath = false) {
    const basePath = useRelativePath ? AppConfig.relativeFontPath : AppConfig.fontBasePath;
    return `${basePath}/${fontFileName}`;
} 