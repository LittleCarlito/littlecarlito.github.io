/**
 * Shared Vite plugins and utilities for all packages
 */
import fs from 'fs';
import path from 'path';
// Problematic files in Three.js that we want to exclude
export const EXCLUDED_FILES = [
	'node_modules/three/examples/jsm/libs/lottie_canvas.module.js',
	'node_modules/three/examples/jsm/libs/chevrotain.module.min.js'
];
/**
 * Creates a plugin that handles graceful shutdown of the Vite dev server
 */
export function gracefulShutdownPlugin() {
	return {
		name: 'graceful-shutdown',
		configureServer(server) {
			const originalClose = server.httpServer.close.bind(server.httpServer);
			// Replace the close method with our custom implementation
			server.httpServer.close = (callback) => {
				console.log('Gracefully shutting down...');
				// Force process exit after a timeout if it gets stuck
				const forceExitTimeout = setTimeout(() => {
					console.log('Forcing exit...');
					process.exit(0);
				}, 500);
				return originalClose(() => {
					clearTimeout(forceExitTimeout);
					if (callback) callback();
				});
			};
			// Handle Ctrl+C signal more directly
			process.on('SIGINT', () => {
				console.log('Interrupt received, shutting down...');
				setTimeout(() => {
					process.exit(0);
				}, 100);
			});
		}
	};
}
/**
 * Creates a plugin that writes a timestamp to the output file
 * This forces the main app to detect changes to the file
 */
export function timestampPlugin(outputPath) {
	return {
		name: 'timestamp-plugin',
		writeBundle(options, bundle) {
			// Add timestamp to ensure the file always changes
			const timestamp = new Date().toISOString();
			if (fs.existsSync(outputPath)) {
				// Read the file
				let content = fs.readFileSync(outputPath, 'utf-8');
				// Add timestamp comment at the top
				content = `/* BUILD TIMESTAMP: ${timestamp} */\n${content}`;
				// Write back the content
				fs.writeFileSync(outputPath, content);
				console.log(`
========================================================================
🔥 REBUILT WITH TIMESTAMP: ${timestamp}
========================================================================
        `);
			}
		}
	};
}
/**
 * Creates a plugin that replaces problematic modules with empty stubs
 * Useful for modules that use eval() or other potentially unsafe code
 */
export function createEmptyModuleStubs(excludedFiles = EXCLUDED_FILES) {
	return {
		name: 'empty-module-stubs',
		enforce: 'pre',
		resolveId(id) {
			// Check if this is a problematic file
			for (const file of excludedFiles) {
				if (id.includes(file)) {
					// Create a virtual module ID for this file
					return '\0empty-stub:' + id;
				}
			}
			return null;
		},
		load(id) {
			// If this is one of our virtual module IDs, return an empty module
			if (id.startsWith('\0empty-stub:')) {
				return `
          // Empty module stub for file with eval() - security risk removed
          export default {};
          
          // Generic stub functions to prevent runtime errors
          export function * () { 
            console.warn('This module was disabled due to security risks with eval()');
            return {}; 
          }
        `;
			}
			return null;
		}
	};
}
/**
 * Creates a plugin that warns when eval usage is detected except in excluded files
 */
export function createEvalWarningHandler(excludedFiles = EXCLUDED_FILES) {
	return (warning, warn) => {
		// Skip eval warnings in excluded files
		if (warning.code === 'EVAL' || 
        (warning.message && excludedFiles.some(file => 
        	warning.message.includes(file) && warning.message.includes('eval')
        ))) {
			return;
		}
		warn(warning);
	};
} 