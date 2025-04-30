#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import open from 'open';
import net from 'net';
import { ProjectInvestigator } from './core/project-discovery.js';
import { ProcessManager } from './core/process-handler.js';
import { DashboardServer } from './server/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..', '..');

/**
 *
 */
class BlorkVisor {
	/**
	 *
	 */
	constructor() {
		this.projectInvestigator = new ProjectInvestigator(rootDir);
		this.processManager = new ProcessManager();
		this.dashboardServer = null;
		this.projects = [];
		this.isShuttingDown = false;
	}

	/**
	 * Initializes and starts the BlorkVisor
	 */
	async run() {
		try {
			// Discover projects
			this.projects = await this.projectInvestigator.discoverProjects();
			if (this.projects.length === 0) {
				console.error('No projects found in workspace');
				process.exit(1);
			}

			// Find available port for dashboard
			const consolePort = await this.findAvailablePort(9000, 9999);
			if (!consolePort) {
				console.error('Could not find available port for dashboard');
				process.exit(1);
			}

			// Start dashboard server
			this.dashboardServer = new DashboardServer(consolePort, this.projects);
			await this.dashboardServer.start();

			// Start projects
			await this.startProjects();

			// Open dashboard in browser
			await open(`http://localhost:${consolePort}`);

			// Set up graceful shutdown
			this.setupShutdownHandlers();
		} catch (error) {
			console.error('Error starting BlorkVisor:', error);
			await this.shutdownGracefully();
			process.exit(1);
		}
	}

	/**
	 * Starts all projects that should be served
	 */
	async startProjects() {
		// Get the path to this application (BlorkVisor)
		const blorkvisorPath = join(__dirname, '..');
		const thisAppPath = blorkvisorPath.replace(/\\/g, '/');
		
		// Flag any projects that are the BlorkVisor itself
		this.projects = this.projects.map(project => {
			const projectPath = project.path.replace(/\\/g, '/');
			
			// Check if this project is BlorkVisor itself
			if (projectPath === thisAppPath) {
				console.log(`Detected self-reference: ${project.name} is the BlorkVisor itself`);
				return {
					...project,
					isSelf: true,
					port: this.dashboardServer.port,  // Use the dashboard port
					ready: true,
					shouldServe: false  // Don't try to serve it again
				};
			}
			
			return project;
		});
		
		const startPromises = this.projects
			.filter(project => project.shouldServe && !project.isSelf)
			.map(async project => {
				try {
					const updatedProject = await this.processManager.startProcess(project);
					const index = this.projects.findIndex(p => p.name === project.name);
					if (index !== -1) {
						this.projects[index] = updatedProject;
						this.dashboardServer.updateProjects(this.projects);
					}
				} catch (error) {
					console.error(`Failed to start ${project.name}:`, error);
				}
			});

		await Promise.all(startPromises);
	}

	/**
	 * Finds an available port in a range
	 * @param {number} startPort - Starting port number
	 * @param {number} endPort - Ending port number
	 * @returns {Promise<number|null>} Available port or null if none found
	 */
	async findAvailablePort(startPort, endPort) {
		for (let port = startPort; port <= endPort; port++) {
			try {
				const server = net.createServer();
				const available = await new Promise((resolve) => {
					server.once('error', () => resolve(false));
					server.once('listening', () => {
						server.close();
						resolve(true);
					});
					server.listen(port);
				});
				
				if (available) {
					return port;
				}
			} catch (error) {
				console.error(`Error checking port ${port}:`, error);
				continue;
			}
		}
		return null;
	}

	/**
	 * Sets up shutdown handlers
	 */
	setupShutdownHandlers() {
		process.on('SIGINT', () => this.shutdownGracefully());
		process.on('SIGTERM', () => this.shutdownGracefully());
		process.on('uncaughtException', (error) => {
			console.error('Uncaught Exception:', error);
			this.shutdownGracefully();
		});
		process.on('unhandledRejection', (reason, promise) => {
			console.error('Unhandled Rejection at:', promise, 'reason:', reason);
			this.shutdownGracefully();
		});
	}

	/**
	 * Gracefully shuts down all processes and servers
	 */
	async shutdownGracefully() {
		if (this.isShuttingDown) return;
		this.isShuttingDown = true;

		console.log('\nShutting down gracefully...');

		try {
			// Kill all project processes
			await this.processManager.killAllProcesses();

			// Stop dashboard server
			if (this.dashboardServer) {
				await this.dashboardServer.stop();
			}

			console.log('Shutdown complete');
		} catch (error) {
			console.error('Error during shutdown:', error);
		} finally {
			process.exit(0);
		}
	}
}

// Start BlorkVisor
const blorkVisor = new BlorkVisor();
blorkVisor.run(); 