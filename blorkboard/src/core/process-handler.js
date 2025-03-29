import { spawn } from 'child_process';
import treeKill from 'tree-kill';
import { isPortInUse, startViteServer } from '../server/vite.js';

/**
 *
 */
export class ProcessManager {
	/**
	 *
	 */
	constructor() {
		this.processes = new Map();
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
			if (project.name.includes('blorktools')) {
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
			const childProcess = spawn('pnpm', ['run', project.devScript], {
				cwd: project.path,
				env: {
					...process.env,
					PORT: project.port.toString(),
					NODE_ENV: 'development'
				}
			});

			let isReady = false;
			let port = project.port;

			childProcess.stdout.on('data', (data) => {
				const output = data.toString();
				if (!isReady && output.includes('Server running on port')) {
					const portMatch = output.match(/port (\d+)/);
					if (portMatch) {
						port = parseInt(portMatch[1]);
					}
					isReady = true;
				}
			});

			childProcess.stderr.on('data', (data) => {
				console.error(`[${project.name}] ${data}`);
			});

			childProcess.on('error', (error) => {
				reject(error);
			});

			childProcess.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`Process exited with code ${code}`));
				}
			});

			resolve({ process: childProcess, port, isReady });
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