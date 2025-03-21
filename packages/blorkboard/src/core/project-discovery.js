import fs from 'fs/promises';
import { existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import path from 'path';

/**
 *
 */
export class ProjectInvestigator {
	/**
	 *
	 */
	constructor(rootDir) {
		this.rootDir = rootDir;
	}

	/**
     * Discovers all projects in the workspace
     * @returns {Promise<Array>} Array of discovered projects
     */
	async discoverProjects() {
		try {
			const workspaceConfig = await fs.readFile(path.join(this.rootDir, 'pnpm-workspace.yaml'), 'utf8');
			const workspaceData = parseYaml(workspaceConfig);
			const packagePatterns = workspaceData.packages || [];
			const discoveredProjects = [];

			for (const pattern of packagePatterns) {
				const basePath = pattern.replace(/\*/g, '');
				const fullBasePath = path.join(this.rootDir, basePath);
				await this.scanDirectory(fullBasePath, discoveredProjects);
			}

			return this.sortProjects(discoveredProjects);
		} catch (err) {
			console.error('Error discovering projects:', err.message);
			return [];
		}
	}

	/**
     * Scans a directory for projects
     * @private
     * @param {string} fullBasePath - Full path to scan
     * @param {Array} discoveredProjects - Array to store discovered projects
     */
	async scanDirectory(fullBasePath, discoveredProjects) {
		try {
			const entries = await fs.readdir(fullBasePath, { withFileTypes: true });
			const dirs = entries.filter(entry => entry.isDirectory()).map(dir => dir.name);

			for (const dir of dirs) {
				const projectPath = path.join(fullBasePath, dir);
				const project = await this.investigateProject(projectPath, discoveredProjects);
				if (project) {
					discoveredProjects.push(project);
				}
			}
		} catch (err) {
			console.error(`Error scanning directory ${fullBasePath}:`, err.message);
		}
	}

	/**
     * Investigates a single project directory
     * @private
     * @param {string} projectPath - Path to project directory
     * @param {Array} [discoveredProjects=[]] - Array of already discovered projects
     * @returns {Promise<Object|null>} Project metadata or null if not a valid project
     */
	async investigateProject(projectPath, discoveredProjects = []) {
		const packageJsonPath = path.join(projectPath, 'package.json');
		if (!existsSync(packageJsonPath)) return null;

		const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
		if (!this.hasValidScripts(packageData)) return null;

		const description = await this.extractDescription(projectPath, packageData);
		const projectType = this.determineProjectType(projectPath, packageData);
		const shouldServe = this.shouldProjectBeServed(projectType);
		const repoInfo = this.extractRepoInfo(packageData);
		const defaultPort = this.calculateDefaultPort(packageData, discoveredProjects);

		return {
			name: packageData.name,
			path: projectPath,
			relativePath: path.relative(this.rootDir, projectPath),
			description: description || `${packageData.name} application`,
			version: packageData.version,
			devScript: this.determineScriptToUse(packageData),
			defaultPort,
			port: null,
			process: null,
			ready: false,
			type: projectType,
			shouldServe,
			repoUrl: repoInfo.url,
			repoDirectory: repoInfo.directory
		};
	}

	/**
     * Checks if package.json has valid scripts
     * @private
     * @param {Object} packageData - Package.json data
     * @returns {boolean} True if valid scripts exist
     */
	hasValidScripts(packageData) {
		return packageData.scripts && 
               (packageData.scripts.dev || packageData.scripts.start || packageData.scripts.tools);
	}

	/**
     * Extracts project description from README or package.json
     * @private
     * @param {string} projectPath - Project directory path
     * @param {Object} packageData - Package.json data
     * @returns {Promise<string>} Project description
     */
	async extractDescription(projectPath, packageData) {
		if (packageData.description) return packageData.description;

		const readmePath = path.join(projectPath, 'README.md');
		if (existsSync(readmePath)) {
			const readmeContent = await fs.readFile(readmePath, 'utf8');
			const firstParagraph = readmeContent.split('\n\n')[1];
			if (firstParagraph) {
				return firstParagraph.replace(/\n/g, ' ').trim();
			}
		}
		return '';
	}

	/**
     * Determines the project type based on name and configuration
     * @private
     * @param {string} projectPath - Project directory path
     * @param {Object} packageData - Package.json data
     * @returns {string} Project type
     */
	determineProjectType(projectPath, packageData) {
		if (packageData.blorkType) return packageData.blorkType;

		if (packageData.name.includes('web') || packageData.name.includes('portfolio') || packageData.name.includes('site')) {
			return 'app';
		}
		if (packageData.name.includes('blorktools')) return 'tool';
		if (packageData.name.includes('blorkboard')) return 'tool';
		if (packageData.name.includes('blorkpack')) return 'package';
		if (packageData.name.includes('ui')) return 'ui';
		if (packageData.name.includes('api')) return 'api';
		if (path.basename(projectPath).includes('lib') || packageData.name.includes('lib')) return 'library';
		return 'unknown';
	}

	/**
     * Determines if a project should be served
     * @private
     * @param {string} projectType - Project type
     * @returns {boolean} True if project should be served
     */
	shouldProjectBeServed(projectType) {
		return !['package', 'library'].includes(projectType);
	}

	/**
     * Extracts repository information from package.json
     * @private
     * @param {Object} packageData - Package.json data
     * @returns {Object} Repository information
     */
	extractRepoInfo(packageData) {
		if (!packageData.repository) return { url: null, directory: null };

		let repoUrl = typeof packageData.repository === 'string' 
			? packageData.repository 
			: packageData.repository.url;
		const repoDirectory = packageData.repository.directory;

		if (repoUrl?.startsWith('git+')) {
			repoUrl = repoUrl.substring(4);
		}

		return { url: repoUrl, directory: repoDirectory };
	}

	/**
     * Calculates the default port for a project
     * @private
     * @param {Object} packageData - Package.json data
     * @param {Array} discoveredProjects - Array of already discovered projects
     * @returns {number} Default port number
     */
	calculateDefaultPort(packageData, discoveredProjects = []) {
		if (packageData.name.includes('blorktools')) return 3001;
		if (packageData.name.includes('portfolio')) return 3000;
		if (packageData.name.includes('web')) return 3002;

		return 3003 + discoveredProjects.filter(p => 
			!p.name.includes('blorktools') && 
            !p.name.includes('portfolio') &&
            !p.name.includes('web')
		).length;
	}

	/**
     * Determines which script to use for the project
     * @private
     * @param {Object} packageData - Package.json data
     * @returns {string} Script name to use
     */
	determineScriptToUse(packageData) {
		if (packageData.name.includes('blorktools') && packageData.scripts.tools) {
			return packageData.scripts.tools;
		}
		return packageData.scripts.dev || packageData.scripts.start;
	}

	/**
     * Sorts projects by priority
     * @private
     * @param {Array} projects - Array of projects to sort
     * @returns {Array} Sorted projects
     */
	sortProjects(projects) {
		return projects.sort((a, b) => {
			if (a.name.includes('web')) return -1;
			if (b.name.includes('web')) return 1;
			if (a.name.includes('blorktools')) return -1;
			if (b.name.includes('blorktools')) return 1;
			return 0;
		});
	}
} 