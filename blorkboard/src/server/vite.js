import { createServer } from 'vite';
import net from 'net';

/**
 * Checks if a port is in use by attempting to create a server on it
 * @param {number} port - The port to check
 * @returns {Promise<boolean>} True if port is in use, false otherwise
 */
export async function isPortInUse(port) {
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
 * Starts a Vite server for a project
 * @param {Object} options - Server options
 * @param {string} options.root - Root directory for the server
 * @param {number} options.port - Port to start the server on
 * @returns {Promise<Object>} Server instance and port
 */
export async function startViteServer({ root, port }) {
	try {
		const server = await createServer({
			root,
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

		return { server, port: actualPort };
	} catch (e) {
		console.error('Error starting Vite server:', e);
		throw e;
	}
} 