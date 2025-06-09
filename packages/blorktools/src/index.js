/**
 * Blorktools - 3D Asset Development Toolset
 * Main entry point for the package
 */
// Re-export core functionality from each tool
export * from './rig_debugger/index.js';

// Export individual tools
export const tools = {
	// Rig Debugger Tool
	rigDebugger: {
		init: () => import('./rig_debugger/index.js').then(module => module.default)
	}
};
