#!/usr/bin/env node
import { createServer } from 'vite';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Function to check if a port is in use
/**
 *
 */
async function isPortInUse(port) {
	return new Promise((resolve) => {
		const server = net.createServer();
        
		server.once('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				resolve(true);
			} else {
				resolve(false);
			}
		});

		server.once('listening', () => {
			server.close(() => {
				resolve(false);
			});
		});

		try {
			server.listen(port);
		} catch (err) {
			resolve(true);
		}
	});
}

/**
 * Starts the Vite server with proper configuration
 */
async function startTools() {
	const port = parseInt(process.env.PORT || '3001', 10);
    
	try {
		// Only log port info to help debugging
		console.log(`Starting blorktools on port ${port}...`);
		
		// Create server with explicitly set config to ensure correct behavior
		const server = await createServer({
			// Specify the root as src directory (where index.html is)
			root: path.resolve(__dirname, 'src'),
			// Configure server settings
			server: {
				port,
				strictPort: true,  // Try to use exact port
				open: false
			},
			// Apply necessary plugins
			plugins: []
		});
        
		await server.listen();
        
		// Get the actual port that Vite is using
		const actualPort = server.config.server.port;
		
		// Send the signal that blorkvisor is expecting
		console.log(`Server running on port ${actualPort}`);
		console.log(`VITE_READY:${actualPort}`);
		
		// Print available tools
		console.log('\nAvailable tools:');
		console.log('1. Asset Debugger: http://localhost:' + actualPort + '/asset_debugger/asset_debugger.html');
		console.log('2. Rig Debugger: http://localhost:' + actualPort + '/rig_debugger/rig_debugger.html');
		
		server.printUrls();
	} catch (e) {
		console.error('Error starting Vite server:', e);
		process.exit(1);
	}
}

startTools(); 