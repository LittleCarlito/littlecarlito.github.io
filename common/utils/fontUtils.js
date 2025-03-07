/**
 * Font utilities for handling path determination based on deployment environment
 */

/**
 * Determines if the application is running on the production deployment
 * @returns {boolean} True if running on production (GitHub Pages), false otherwise
 */
export const isProduction = () => {
    return window.location.hostname === 'littlecarlito.github.io';
};

/**
 * Gets the base path for font assets based on the deployment environment
 * @returns {string} The base path for font assets
 */
export const getFontBasePath = () => {
    return isProduction() ? '/threejs_site/fonts' : '/fonts';
};

/**
 * Gets the relative path prefix for font assets based on the deployment environment
 * For use in HTML files where relative paths are needed
 * @returns {string} The relative path prefix for font assets
 */
export const getRelativeFontBasePath = () => {
    return isProduction() ? '/threejs_site/fonts' : '../fonts';
};

/**
 * Gets the full path for a specific font file
 * @param {string} fontFileName - The name of the font file
 * @param {boolean} useRelativePath - Whether to use a relative path (for HTML files)
 * @returns {string} The full path to the font file
 */
export const getFontPath = (fontFileName, useRelativePath = false) => {
    const basePath = useRelativePath ? getRelativeFontBasePath() : getFontBasePath();
    return `${basePath}/${fontFileName}`;
}; 