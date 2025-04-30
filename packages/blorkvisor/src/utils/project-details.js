/**
 *
 */
export class ProjectDetailFactory {
	/**
     * Generates a GitHub URL for a project
     * @param {Object} project - Project object
     * @returns {string|null} GitHub URL or null if not available
     */
	static generateGitHubUrl(project) {
		if (!project.repoUrl) return null;
        
		const url = new URL(project.repoUrl);
		if (url.hostname !== 'github.com') return null;
        
		const pathParts = url.pathname.split('/').filter(Boolean);
		if (pathParts.length < 2) return null;
        
		const [owner, repo] = pathParts;
		const repoPath = project.repoDirectory ? `${repo}/tree/main/${project.repoDirectory}` : repo;
		return `https://github.com/${owner}/${repoPath}`;
	}

	/**
     * Extracts the simple name from the full package name
     * @param {string} fullName - Full package name (e.g. @littlecarlito/blorktools)
     * @returns {string} Simple name (e.g. Blorktools)
     */
	static getSimpleName(fullName) {
		// Extract name after the last slash or the whole name if no slash
		const namePart = fullName.split('/').pop();
		// Capitalize first letter
		return namePart.charAt(0).toUpperCase() + namePart.slice(1);
	}

	/**
     * Generates a status summary for a project
     * @param {Object} project - Project object
     * @returns {string} Status summary
     */
	static generateProjectStatus(project) {
		if (project.isSelf) {
			return `Listening on port ${project.port}`;
		}
		
		if (!project.shouldServe) {
			return 'Not served';
		}

		if (!project.process) {
			return 'Not started';
		}

		if (!project.ready) {
			return 'Starting...';
		}

		return `Running on port ${project.port}`;
	}

	/**
     * Gets a user-friendly project type label
     * @param {string} type - Project type
     * @returns {string} Type label in uppercase
     */
	static getTypeLabel(type) {
		return type.toUpperCase();
	}

	/**
     * Generates a project card HTML
     * @param {Object} project - Project object
     * @returns {string} Project card HTML
     */
	static generateProjectCard(project) {
		const status = this.generateStatusForCard(project);
		const statusClass = this.getStatusClass(project);
		const typeClass = this.getTypeClass(project.type);
		const typeLabel = this.getTypeLabel(project.type);
		const simpleName = this.getSimpleName(project.name);
        
		// For BlorkVisor itself, just link to the current dashboard
		let openButton = '';
		if (project.isSelf) {
			openButton = `<a href="/" class="open-button">Open ${simpleName.toLowerCase()}</a>`;
		} else if (project.shouldServe && project.process && project.ready) {
			// Special case for blorktools to ensure we open the correct page
			let openUrl = `http://localhost:${project.port}`;
			if (project.name === '@littlecarlito/blorktools') {
				// Make sure it goes to the right index page for tools
				openUrl = `http://localhost:${project.port}/index.html`;
			}
			openButton = `<a href="${openUrl}" target="_blank" class="open-button">Open ${simpleName.toLowerCase()}</a>`;
		}

		let statusElement;
		if (project.isSelf) {
			statusElement = `<div class="status-info status-running">${status}</div>`;
		} else if (project.ready && project.shouldServe) {
			statusElement = `<div class="status-info status-running">Listening on port ${project.port}</div>`;
		} else if (!project.shouldServe) {
			statusElement = `<div class="status-info status-package">Not served</div>`;
		} else {
			statusElement = `<div class="status-info ${statusClass}">${status}</div>`;
		}

		return `
            <div class="project-card ${typeClass}" data-project="${simpleName.toLowerCase()}">
                <div class="type-badge">${typeLabel}</div>
                <h3>${simpleName}</h3>
                <div class="card-content">
                    <p class="description">${project.description}</p>
                    
                    ${openButton}
                    
                    ${statusElement}
                </div>
            </div>
        `;
	}

	/**
     * Generates status text for project card
     * @param {Object} project - Project object
     * @returns {string} Status text
     */
	static generateStatusForCard(project) {
		if (project.isSelf) {
			return `Listening on port ${project.port}`;
		}
		
		if (!project.shouldServe) {
			return 'Not served';
		}

		if (!project.process) {
			return 'Service unavailable';
		}

		if (!project.ready) {
			return 'Starting...';
		}

		return `Listening on port ${project.port}`;
	}

	/**
     * Generates a project status card HTML for the dashboard overview
     * @param {Object} project - Project object
     * @returns {string} Status card HTML
     */
	static generateProjectStatusCard(project) {
		const status = this.generateProjectStatus(project);
		const statusClass = this.getStatusClass(project);
		const typeClass = this.getTypeClass(project.type);
		const typeLabel = this.getTypeLabel(project.type);
		const simpleName = this.getSimpleName(project.name);
		const githubUrl = this.generateGitHubUrl(project);

		return `
            <div class="overview-card ${typeClass}">
                <div class="type-badge">${typeLabel}</div>
                <h3>${simpleName}</h3>
                <p class="status-text">${status}</p>
                <p class="version-text">Version: ${project.version}</p>
                <p class="path-text">Path: ${project.relativePath}</p>
                ${githubUrl ? `<a href="${githubUrl}" target="_blank" class="view-link">View on GitHub</a>` : ''}
            </div>
        `;
	}

	/**
     * Gets the CSS class for a project's status
     * @private
     * @param {Object} project - Project object
     * @returns {string} CSS class name
     */
	static getStatusClass(project) {
		if (project.isSelf) return 'status-running';
		if (!project.shouldServe) return 'status-package';
		if (!project.process) return 'status-stopped';
		if (!project.ready) return 'status-starting';
		return 'status-running';
	}

	/**
     * Gets the CSS class for a project's type
     * @private
     * @param {string} type - Project type
     * @returns {string} CSS class name
     */
	static getTypeClass(type) {
		const typeClasses = {
			app: 'type-app',
			tool: 'type-tool',
			package: 'type-package',
			ui: 'type-ui',
			api: 'type-api',
			library: 'type-library',
			unknown: 'type-unknown'
		};
		return typeClasses[type] || typeClasses.unknown;
	}
} 