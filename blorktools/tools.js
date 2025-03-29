#!/usr/bin/env node
import { createServer } from 'vite';
import net from 'net';

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
 *
 */
async function startTools() {
	const port = parseInt(process.env.PORT || '3001', 10);
    
	try {
		const server = await createServer({
			root: 'src',
			server: {
				port,
				strictPort: false, // Allow Vite to find another port if this one is taken
				open: false
			}
		});
        
		await server.listen();
        
		// Get the actual port that Vite is using
		const actualPort = server.config.server.port;
        
		// Signal that we're ready and what port we're using
		console.log(`VITE_READY:${actualPort}`);
		server.printUrls();
	} catch (e) {
		console.error('Error starting Vite server:', e);
		process.exit(1);
	}
}

startTools(); 