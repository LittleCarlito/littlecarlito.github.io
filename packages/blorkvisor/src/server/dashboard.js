import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProjectDetailFactory } from '../utils/project-details.js';

/**
 *
 */
export class DashboardServer {
	/**
	 *
	 */
	constructor(port, projects) {
		this.port = port;
		this.projects = projects;
		this.app = express();
		this.__dirname = path.dirname(fileURLToPath(import.meta.url));
		this.rootDir = path.join(this.__dirname, '..', '..', '..');
		this.setupMiddleware();
		this.setupRoutes();
	}

	/**
     * Sets up Express middleware
     * @private
     */
	setupMiddleware() {
		this.app.use(express.json());
		this.app.use(express.static(path.join(this.__dirname, '../pages')));
	}

	/**
     * Sets up Express routes
     * @private
     */
	setupRoutes() {
		// Serve the main dashboard
		this.app.get('/', (req, res) => {
			res.sendFile(path.join(this.__dirname, '../pages/index.html'));
		});

		// API endpoint to get project status
		this.app.get('/api/projects/status', (req, res) => {
			const statusCards = this.projects.map(project => 
				ProjectDetailFactory.generateProjectStatusCard(project)
			);
			res.json({ statusCards });
		});

		// API endpoint to get project cards
		this.app.get('/api/projects/cards', (req, res) => {
			const projectCards = this.projects.map(project => 
				ProjectDetailFactory.generateProjectCard(project)
			);
			res.json({ projectCards });
		});

		// API endpoint to get project details
		this.app.get('/api/projects/:name', (req, res) => {
			const project = this.projects.find(p => p.name === req.params.name);
			if (!project) {
				return res.status(404).json({ error: 'Project not found' });
			}
			res.json(project);
		});
	}

	/**
     * Starts the dashboard server
     * @returns {Promise<void>}
     */
	async start() {
		return new Promise((resolve, reject) => {
			this.server = this.app.listen(this.port, () => {
				console.log(`Dashboard server running on port ${this.port}`);
				resolve();
			});

			this.server.on('error', (error) => {
				reject(error);
			});
		});
	}

	/**
     * Stops the dashboard server
     * @returns {Promise<void>}
     */
	async stop() {
		return new Promise((resolve) => {
			this.server.close(() => {
				console.log('Dashboard server stopped');
				resolve();
			});
		});
	}

	/**
     * Updates the projects list
     * @param {Array} projects - Updated projects array
     */
	updateProjects(projects) {
		this.projects = projects;
	}
} 