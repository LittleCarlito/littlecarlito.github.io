/**
 * Blorktools - 3D Asset Development Toolset
 * Main entry point for the package
 */

// Re-export core functionality from each tool
export * from './asset_debugger/index.js';

// Export individual tools
export const tools = {
  // Asset Debugger Tool
  assetDebugger: {
    init: () => import('./asset_debugger/index.js').then(module => module.init()),
    // Legacy entry point is now the same as the standard entry point
    legacy: () => import('./asset_debugger/index.js')
  }
};

// Export utility functions that might be useful for consumers
export { formatFileSize, getFileExtension, createElement } from './asset_debugger/utils/helpers.js';

// Version information
export const VERSION = '1.0.0'; 