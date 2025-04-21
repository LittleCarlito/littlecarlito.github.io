import { spawn } from 'child_process';
import treeKill from 'tree-kill';
import { isPortInUse, startViteServer } from '../server/vite.js';
import { join } from 'path';
import fs from 'fs';

/**
 * Gets the absolute path to the pnpm executable
 * @returns {string} Path to pnpm executable
 */
function getPnpmPath() {
	// Try common locations for pnpm
	const possiblePaths = [
		// Global npm bin directory
		join(process.env.npm_config_prefix || '', 'pnpm'),
		join(process.env.npm_config_prefix || '', 'node_modules', '.bin', 'pnpm'),
		// For Windows
		join(process.env.APPDATA || '', 'npm', 'pnpm.cmd'),
		join(process.env.APPDATA || '', 'npm', 'pnpm'),
		// For Unix-like systems
		'/usr/local/bin/pnpm',
		'/usr/bin/pnpm',
		// NodeJS path
		process.execPath.replace('node', 'pnpm')
	];

	// Find the first path that exists
	for (const path of possiblePaths) {
		try {
			if (fs.existsSync(path)) {
				return path;
			}
		} catch (e) {
			// Ignore errors
		}
	}

	// Default to just 'pnpm' and hope it's in PATH
	return 'pnpm';
}

/**
 *
 */
export class ProcessManager {
	/**
	 *
	 */
	constructor() {
		this.processes = new Map();
		this.pnpmPath = getPnpmPath();
	}

	/**
     * Starts a process for a project
     * @param {Object} project - Project object
     * @returns {Promise<Object>} Updated project object with process information
     */
	async startProcess(project) {
		if (this.processes.has(project.name)) {
			return project;
		}

		const port = await this.findAvailablePort(project.defaultPort);
		project.port = port;

		try {
			if (project.name === '@littlecarlito/blorktools') {
				console.log(`Starting Blorktools on port ${port}...`);
				const process = await this.startToolsProcess(project);
				this.processes.set(project.name, process);
				project.process = process;
			} else {
				const server = await startViteServer({
					root: project.path,
					port: port
				});
				this.processes.set(project.name, { server, port });
				project.process = { server, port };
			}
		} catch (error) {
			console.error(`Failed to start ${project.name}:`, error);
			project.ready = false;
			return project;
		}

		project.ready = true;
		return project;
	}

	/**
     * Starts a tools process
     * @private
     * @param {Object} project - Project object
     * @returns {Promise<Object>} Process object
     */
	async startToolsProcess(project) {
		return new Promise((resolve, reject) => {
			// For blorktools, we want to run the tools script which uses our modified tools.js
			console.log(`Using pnpm at: ${this.pnpmPath}`);
			
			// Use shell option on Windows to ensure pnpm is found
			const isWindows = process.platform === 'win32';
			const options = {
				cwd: project.path,
				env: {
					...process.env,
					PORT: project.port.toString(),
					NODE_ENV: 'development'
				},
				shell: isWindows
			};
			
			const childProcess = spawn(this.pnpmPath, ['run', 'tools'], options);

			let isReady = false;
			let port = project.port;

			childProcess.stdout.on('data', (data) => {
				const output = data.toString();
				console.log(`[${project.name}] ${output}`);
				
				if (!isReady && output.includes('VITE_READY:')) {
					const portMatch = output.match(/VITE_READY:(\d+)/);
					if (portMatch) {
						port = parseInt(portMatch[1]);
						isReady = true;
						console.log(`[${project.name}] Ready on port ${port}`);
						resolve({ process: childProcess, port, isReady });
					}
				}
			});

			childProcess.stderr.on('data', (data) => {
				console.error(`[${project.name}] ${data}`);
			});

			childProcess.on('error', (error) => {
				reject(error);
			});

			childProcess.on('close', (code) => {
				if (code !== 0 && !isReady) {
					reject(new Error(`Process exited with code ${code}`));
				}
			});
			
			// Set a timeout in case VITE_READY is never received
			setTimeout(() => {
				if (!isReady) {
					console.log(`[${project.name}] No ready signal received, assuming ready on port ${port}`);
					isReady = true;
					resolve({ process: childProcess, port, isReady });
				}
			}, 10000);
		});
	}

	/**
     * Finds an available port
     * @private
     * @param {number} preferredPort - Preferred port number
     * @returns {Promise<number>} Available port number
     */
	async findAvailablePort(preferredPort) {
		let port = preferredPort;
		let attempts = 0;
		const maxAttempts = 20;

		while (attempts < maxAttempts) {
			if (!(await isPortInUse(port))) {
				return port;
			}
			port++;
			attempts++;
		}

		throw new Error(`Could not find available port after ${maxAttempts} attempts`);
	}

	/**
     * Kills a process and its children
     * @param {string} projectName - Name of the project
     * @returns {Promise<void>}
     */
	async killProcess(projectName) {
		const processInfo = this.processes.get(projectName);
		if (!processInfo) return;

		try {
			if (processInfo.server && typeof processInfo.server.close === 'function') {
				await new Promise((resolve) => processInfo.server.close(resolve));
			} else if (processInfo.process) {
				await new Promise((resolve) => treeKill(processInfo.process.pid, 'SIGTERM', resolve));
			}
		} catch (error) {
			console.error(`Error shutting down ${projectName}:`, error.message);
		}

		this.processes.delete(projectName);
	}

	/**
     * Kills all processes
     * @returns {Promise<void>}
     */
	async killAllProcesses() {
		try {
			const promises = Array.from(this.processes.keys()).map(projectName => 
				this.killProcess(projectName)
			);
			await Promise.all(promises);
		} catch (error) {
			console.error('Error shutting down processes:', error.message);
		}
	}
} 