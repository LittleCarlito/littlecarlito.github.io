/**
 * Asset Debugger - Main Entry Point
 * Exports all necessary functions and components for the asset debugger
 */

// Export the main initialization function
export { init } from './scene/asset_debugger.js';

// Export utility functions
export { formatFileSize } from './util/materials-util.js';

// Export state management functions
export { getState, updateState, initState } from './scene/state.js'; 