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

