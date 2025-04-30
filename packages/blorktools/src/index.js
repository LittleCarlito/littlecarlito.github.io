/**
 * Blorktools - 3D Asset Development Toolset
 * Main entry point for the package
 */
// Re-export core functionality from each tool
export * from './asset_debugger/index.js';
export * from './rig_debugger/index.js';

// Export individual tools
export const tools = {
	// Asset Debugger Tool
	assetDebugger: {
		init: () => import('./asset_debugger/index.js').then(module => module.init())
	},
	// Rig Debugger Tool
	rigDebugger: {
		init: () => import('./rig_debugger/index.js').then(module => module.default)
	}
};
// Export utility functions that might be useful for consumers
export { formatFileSize } from './asset_debugger/core/materials.js'; 