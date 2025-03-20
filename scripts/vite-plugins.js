/**
 * Shared Vite plugins and utilities for all packages
 */
import fs from 'fs';
import path from 'path';

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
 * Creates a virtual module for blorkpack during development
 */
export function createVirtualBlorkpackPlugin() {
	const virtualModuleId = '@littlecarlito/blorkpack';
	const resolvedVirtualModuleId = '\0' + virtualModuleId;
	
	// Resolve paths relative to workspace root (where pnpm-workspace.yaml is)
	const workspaceRoot = path.resolve(process.cwd(), '..', '..');
	const blorkpackPath = path.resolve(workspaceRoot, 'packages/blorkpack/dist/index.js');
	const blorkpackDir = path.resolve(workspaceRoot, 'packages/blorkpack/dist');
	
	// Check if we're in the blorkpack package itself
	const isBlorkpackPackage = process.cwd().includes('packages/blorkpack');
	
	// If we're in the blorkpack package, don't create virtual modules
	if (isBlorkpackPackage) {
		return {
			name: 'virtual-blorkpack',
			enforce: 'pre',
			resolveId(id) {
				return null;
			}
		};
	}

	return {
		name: 'virtual-blorkpack',
		enforce: 'pre',
		async resolveId(id) {
			// Handle the main module
			if (id === virtualModuleId) {
				return blorkpackPath;
			}
			// Handle subpaths
			if (id.startsWith(`${virtualModuleId}/`)) {
				const subpath = id.slice(virtualModuleId.length + 1);
				const targetPath = path.join(blorkpackDir, `${subpath}.js`);
				if (fs.existsSync(targetPath)) {
					return targetPath;
				}
			}
			return null;
		}
	};
} 