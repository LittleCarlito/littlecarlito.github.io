#!/usr/bin/env node
import express from 'express';
import { exec, spawn } from 'child_process';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import treeKill from 'tree-kill';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const app = express();
let consolePort = 9000;
let isShuttingDown = false;

// Function to check if a port is in use
/**
 * Checks if a port is in use by attempting to create a server on it
 * @param {number} port - The port to check
 * @returns {Promise<boolean>} True if port is in use, false otherwise
 */
function isPortInUse(port) {
	return new Promise((resolve) => {
		const server = net.createServer();
		
		server.once('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				resolve(true); // Port is in use
			} else {
				resolve(false);
			}
		});

		server.once('listening', () => {
			// Close the server immediately
			server.close(() => {
				resolve(false); // Port is free
			});
		});

		try {
			server.listen(port);
		} catch (err) {
			resolve(true); // Assume port is in use if we can't even try to listen
		}
	});
}

// Function to wait for a port to become available or in use
/**
 * Waits for a port to either become available or in use
 * @param {number} port - The port to check
 * @param {boolean} waitForInUse - If true, wait for port to be in use, otherwise wait for it to be free
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} True if the desired state was reached, false if timed out
 */
async function waitForPort(port, waitForInUse = true, timeout = 5000) {
	const startTime = Date.now();
	while (Date.now() - startTime < timeout) {
		const inUse = await isPortInUse(port);
		if (waitForInUse === inUse) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	return false;
}

// Find the next available port starting from the preferred port
/**
 * Finds an available port starting from the preferred port
 * @param {number} preferredPort - The port to start checking from
 * @param {number} maxPort - Maximum port number to try (defaults to 65535)
 * @returns {Promise<number|null>} Available port or null if none found
 */
async function findAvailablePort(preferredPort, maxPort = 65535) {
	let port = preferredPort;
	const startPort = 3000; // Minimum port to consider
	const maxAttempts = maxPort - startPort; // Try all ports in range

	for (let attempt = 0; attempt < maxAttempts && port <= maxPort; attempt++) {
		try {
			const inUse = await isPortInUse(port);
			if (!inUse) {
				return port;
			}
			console.log(`Port ${port} is in use, trying ${port + 1}...`);
			port++;
			
			// If we've gone past our range, wrap around to the start
			if (port > maxPort) {
				port = startPort;
			}
		} catch (err) {
			console.error(`Error checking port ${port}:`, err);
			port++; // Try next port on error
		}
	}
	return null; // No available ports found within range
}

// Kill a process and all its children using tree-kill
/**
 *
 */
function killProcess(pid, signal = 'SIGTERM') {
	return new Promise((resolve) => {
		treeKill(pid, signal, (err) => {
			if (err) {
				console.log(`Error killing process ${pid} with ${signal}: ${err.message}`);
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
}

// Function to start a process and return its handle
/**
 *
 */
function startProcess(command, args, options = {}) {
	console.log(`Starting: ${command} ${args.join(' ')}`);
	try {
		// Create new process group to make it easier to kill all child processes
		const process = spawn(command, args, {
			stdio: 'pipe',
			shell: true,
			detached: true,
			...options
		});

		// Store the spawn time to detect immediate failures
		process.spawnTime = Date.now();
		process.hasOutput = false;

		// Track if we've seen the "ready" message from Vite
		let isViteReady = false;
		
		process.stdout.on('data', (data) => {
			process.hasOutput = true;
			const output = data.toString().trim();
			console.log(`[${command}] ${output}`);
			
			// Check for Vite ready message with port
			if (output.includes('VITE_READY:')) {
				const actualPort = parseInt(output.split(':')[1], 10);
				process.actualPort = actualPort;
				isViteReady = true;
				process.emit('vite-ready');
			} else if (output.includes('VITE') && output.includes('ready')) {
				// Look for the port in the output
				const match = output.match(/http:\/\/localhost:(\d+)/);
				if (match) {
					const actualPort = parseInt(match[1], 10);
					process.actualPort = actualPort;
					isViteReady = true;
					process.emit('vite-ready');
				}
			} else if (output.includes('Local:') && output.includes('http://localhost:')) {
				// Look for the port in the URL output
				const match = output.match(/http:\/\/localhost:(\d+)/);
				if (match) {
					const actualPort = parseInt(match[1], 10);
					process.actualPort = actualPort;
					isViteReady = true;
					process.emit('vite-ready');
				}
			}
		});

		process.stderr.on('data', (data) => {
			process.hasOutput = true;
			const output = data.toString().trim();
			console.error(`[${command}] ${output}`);
		});

		process.on('error', (err) => {
			console.error(`[${command}] Process error: ${err.message}`);
		});

		process.on('close', (code) => {
			// Only log if not shutting down to avoid cluttering the console during exit
			if (!isShuttingDown) {
				console.log(`[${command}] Process exited with code ${code}`);
			}
		});

		// Don't prevent the Node.js process from exiting
		process.unref();

		// Add a promise-based way to wait for Vite to be ready
		process.waitForReady = () => {
			return new Promise((resolve, reject) => {
				if (isViteReady) {
					resolve(true);
					return;
				}

				const timeout = setTimeout(() => {
					reject(new Error('Timeout waiting for Vite to start'));
				}, 5000);

				process.once('vite-ready', () => {
					clearTimeout(timeout);
					resolve(true);
				});

				process.once('close', (code) => {
					clearTimeout(timeout);
					reject(new Error(`Process exited with code ${code}`));
				});
			});
		};

		return process;
	} catch (error) {
		console.error(`Failed to start process: ${error.message}`);
		return null;
	}
}

// Project metadata and tracking
let projects = [];
let dashboardStarted = false;
let expressServer = null;

// Function to discover all workspace packages
/**
 *
 */
async function discoverProjects() {
	try {
		// Read workspace config
		const workspaceConfig = await fs.readFile(path.join(rootDir, 'pnpm-workspace.yaml'), 'utf8');
		const workspaceData = parseYaml(workspaceConfig);
		// Parse workspace package patterns
		const packagePatterns = workspaceData.packages || [];
		const discoveredProjects = [];
		// Process each package pattern
		for (const pattern of packagePatterns) {
			// Remove wildcards for directory scanning
			const basePath = pattern.replace(/\*/g, '');
			const fullBasePath = path.join(rootDir, basePath);
			try {
				// Get subdirectories
				const entries = await fs.readdir(fullBasePath, { withFileTypes: true });
				const dirs = entries.filter(entry => entry.isDirectory()).map(dir => dir.name);
				// Process each directory
				for (const dir of dirs) {
					const projectPath = path.join(fullBasePath, dir);
					const packageJsonPath = path.join(projectPath, 'package.json');
					// Check if package.json exists
					if (existsSync(packageJsonPath)) {
						const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
						// Check if it has a dev script
						if (packageData.scripts && (packageData.scripts.dev || packageData.scripts.start || packageData.scripts.tools)) {
							// Extract metadata
							const readmePath = path.join(projectPath, 'README.md');
							let description = packageData.description || '';
							// Try to extract description from README if available
							if (existsSync(readmePath)) {
								const readmeContent = await fs.readFile(readmePath, 'utf8');
								const firstParagraph = readmeContent.split('\n\n')[1]; // Skip title, get first paragraph
								if (firstParagraph && !description) {
									description = firstParagraph.replace(/\n/g, ' ').trim();
								}
							}
							// Determine the script to use (prioritize 'tools' for blorktools)
							let scriptToUse = packageData.scripts.dev || packageData.scripts.start;
							if (packageData.name.includes('blorktools') && packageData.scripts.tools) {
								scriptToUse = packageData.scripts.tools;
							}
							// Determine project type and whether it should be served on a port
							let projectType = 'unknown';
							let shouldServe = true;
							// Check for explicit type first in blorkType property
							if (packageData.blorkType) {
								projectType = packageData.blorkType;
								// Non-interactive types
								if (['package', 'library'].includes(projectType)) {
									shouldServe = false;
								}
							} else {
								// Auto-detect based on name if no explicit type
								if (packageData.name.includes('web') || packageData.name.includes('portfolio') || packageData.name.includes('site')) {
									projectType = 'app';
								} else if (packageData.name.includes('blorktools')) {
									projectType = 'tool';
								} else if (packageData.name.includes('blorkpack')) {
									projectType = 'package';
									shouldServe = false; // Don't assign a port to blorkpack
								} else if (packageData.name.includes('ui')) {
									projectType = 'ui';
								} else if (packageData.name.includes('api')) {
									projectType = 'api';
								} else if (path.basename(projectPath).includes('lib') || packageData.name.includes('lib')) {
									projectType = 'library';
									shouldServe = false;
								}
							}
							// Extract repository information
							let repoUrl = null;
							let repoDirectory = null;
							if (packageData.repository) {
								if (typeof packageData.repository === 'string') {
									repoUrl = packageData.repository;
								} else if (packageData.repository.url) {
									repoUrl = packageData.repository.url;
									repoDirectory = packageData.repository.directory;
								}
								// Clean up the URL (remove git+ prefix if present)
								if (repoUrl && repoUrl.startsWith('git+')) {
									repoUrl = repoUrl.substring(4);
								}
							}
							// Assign default ports with blorktools having priority for port 3001
							let defaultPort;
							if (packageData.name.includes('blorktools')) {
								defaultPort = 3001; // Make sure blorktools gets port 3001
							} else if (packageData.name.includes('portfolio')) {
								defaultPort = 3000; // Portfolio gets port 3000
							} else if (packageData.name.includes('web')) {
								defaultPort = 3002; // Web app gets port 3002
							} else {
								// For other projects, start at 3003 and increment
								defaultPort = 3003 + discoveredProjects.filter(p => 
									!p.name.includes('blorktools') && 
									!p.name.includes('portfolio') &&
									!p.name.includes('web')
								).length;
							}
							// Create project metadata
							discoveredProjects.push({
								name: packageData.name,
								path: projectPath,
								relativePath: path.relative(rootDir, projectPath),
								description: description || `${packageData.name} application`, 
								version: packageData.version,
								devScript: scriptToUse,
								defaultPort: defaultPort,
								port: null, // Will be assigned later
								process: null, // Will be assigned when started
								ready: false,
								type: projectType,
								shouldServe: shouldServe,
								repoUrl: repoUrl,
								repoDirectory: repoDirectory
							});
						}
					}
				}
			} catch (err) {
				console.error(`Error scanning directory ${fullBasePath}:`, err.message);
			}
		}
		// Sort projects to ensure web is first, tools second
		discoveredProjects.sort((a, b) => {
			if (a.name.includes('web')) return -1;
			if (b.name.includes('web')) return 1;
			if (a.name.includes('blorktools')) return -1;
			if (b.name.includes('blorktools')) return 1;
			return 0;
		});
		return discoveredProjects;
	} catch (err) {
		console.error('Error discovering projects:', err.message);
		return [];
	}
}

// Function to generate GitHub repo URL for a project
/**
 *
 */
function generateGitHubUrl(project) {
	if (!project.repoUrl) return null;
	// Format: https://github.com/username/repo
	let repoUrl = project.repoUrl;
	if (repoUrl.endsWith('.git')) {
		repoUrl = repoUrl.substring(0, repoUrl.length - 4);
	}
	// Try to detect branch - most common ones are main, master, or develop
	// For simplicity, let's try master since main didn't work
	const branch = 'master';
	// For packages, link to the package in the repo
	if (project.type === 'package' || project.type === 'library') {
		if (project.repoDirectory) {
			return `${repoUrl}/tree/${branch}/${project.repoDirectory}`;
		}
		return repoUrl;
	}
	// For apps, link to the directory in the repo
	if (project.repoDirectory) {
		return `${repoUrl}/tree/${branch}/${project.repoDirectory}`;
	} else if (project.relativePath) {
		return `${repoUrl}/tree/${branch}/${project.relativePath}`;
	}
	return repoUrl;
}

// Function to generate a project status summary
/**
 *
 */
function generateProjectStatus(project) {
	if (!project) return '';
	const displayName = project.name.replace(/^@[^/]+\//, '');
	let portInfo = 'Not available';
	let portDataAttr = '';
	
	if (project.shouldServe) {
		if (project.port) {
			portInfo = `Running on port: ${project.port}${project.port !== project.defaultPort ? ' (default port was in use)' : ''}`;
			portDataAttr = `data-port="${project.port}"`;
		} else {
			portInfo = 'Service unavailable';
		}
	} else {
		portInfo = 'Not served (non-interactive package)';
	}
	
	const githubUrl = generateGitHubUrl(project);
	const githubLink = githubUrl ? 
		`<a href="${githubUrl}" target="_blank" class="repo-link">View on GitHub</a>` : '';
	
	return `
  <div class="project-status ${project.type}-status">
    <div class="status-badge">${project.type}</div>
    <h4>${displayName}</h4>
    <p ${portDataAttr}>${portInfo}</p>
    <p class="version">Version: ${project.version}</p>
    <p class="path">Path: ${project.relativePath}</p>
    ${githubLink}
  </div>
  `;
}

// Function to generate a nice card view for a project
/**
 *
 */
function generateProjectCard(project) {
	if (!project) {
		return '';
	}
	const displayName = project.name.replace(/^@[^/]+\//, ''); // Remove scope from display
	// Different card templates based on whether the project is served
	if (project.shouldServe) {
		const portChangeInfo = project.port !== project.defaultPort ? 
			`(default port ${project.defaultPort} was in use)` : '';
		return `
    <div id="${displayName}-card" class="app-card ${project.type}-card">
      <div class="card-badge">${project.type}</div>
      <h3>${displayName}</h3>
      <p>${project.description}</p>
      <div class="card-actions">
        <a href="http://localhost:${project.port}" target="_blank" class="open-link">Open ${displayName}</a>
      </div>
      <div class="port-info">
        ${project.port ? `Listening on port ${project.port} ${portChangeInfo}` : 'Service unavailable'}
      </div>
    </div>
    `;
	} else {
		// Card for non-served projects (like packages)
		return `
    <div id="${displayName}-card" class="app-card ${project.type}-card package-card">
      <div class="card-badge">${project.type}</div>
      <h3>${displayName}</h3>
      <p>${project.description}</p>
      <div class="package-info">
        Non-interactive ${project.type} (not served on a port)
      </div>
    </div>
    `;
	}
}

// Generate script to check if services are available
/**
 *
 */
function generateServiceChecks() {
	return projects
		.filter(p => p.shouldServe && p.port)
		.map(p => {
			const displayName = p.name.replace(/^@[^/]+\//, '');
			return `checkService('http://localhost:${p.port}', '${displayName}-card', ${p.port});`;
		})
		.join('\n      ');
}

// Function to start the dashboard once services are ready
/**
 *
 */
function startDashboard() {
	if (dashboardStarted) return;
	dashboardStarted = true;
	// Generate cards for all projects
	const projectCards = projects.map(generateProjectCard).join('');
	const serviceChecks = projects
		.filter(p => p.shouldServe && p.port)
		.map(p => {
			const displayName = p.name.replace(/^@[^/]+\//, '');
			return `checkService('http://localhost:${p.port}', '${displayName}-card', ${p.port});`;
		})
		.join('\n      ');
	const projectStatuses = projects
		.map(generateProjectStatus)
		.join('');
	// Create HTML for the BlorkBoard with dynamic project data
	const consoleHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BlorkBoard</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #121212;
        color: #e1e1e1;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      h1, h2, h3, h4 {
        color: #5d8fff;
      }
      .header {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
      }
      .header h1 {
        margin: 0;
      }
      .logo {
        width: 40px;
        height: 40px;
        margin-right: 10px;
      }
      .section-title {
        margin-top: 30px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
      }
      .apps-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      .app-card {
        background-color: #1e1e1e;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        border-top: 5px solid #555; /* Default border color */
      }
      .app-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
      }
      .app-card h3 {
        margin-top: 0;
        color: #5d8fff;
        text-transform: capitalize;
      }
      .app-card p {
        margin-bottom: 15px;
        color: #b0b0b0;
        flex-grow: 1;
      }
      .card-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 15px;
      }
      .card-actions a {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 4px;
        text-decoration: none;
        font-weight: bold;
        transition: background-color 0.2s;
        text-align: center;
      }
      .open-link {
        background-color: #5d8fff;
        color: white;
        flex: 1;
      }
      .github-link {
        background-color: #333;
        color: white;
        flex: 1;
      }
      .open-link:hover {
        background-color: #4a75d1;
      }
      .github-link:hover {
        background-color: #444;
      }
      .port-info, .package-info {
        font-size: 0.9em;
        margin-top: 15px;
        padding: 8px;
        background-color: #2a2a2a;
        border-radius: 4px;
      }
      .card-badge, .status-badge {
        position: absolute;
        top: 0;
        right: 0;
        background-color: #333;
        color: white;
        font-size: 0.8em;
        padding: 4px 8px;
        border-radius: 0 0 0 4px;
        text-transform: uppercase;
        font-weight: 600;
      }
      /* Color coding by type */
      .app-card {
        border-top: 5px solid #555;
      }
      .app-card.app-card {
        border-top-color: #4CAF50; /* Green for apps */
      }
      .app-card.tool-card {
        border-top-color: #2196F3; /* Blue for tools */
      }
      .app-card.package-card {
        border-top-color: #9E9E9E; /* Gray for packages */
      }
      .app-card.ui-card {
        border-top-color: #E91E63; /* Pink for UI */
      }
      .app-card.api-card {
        border-top-color: #FF9800; /* Orange for API */
      }
      .app-card.library-card {
        border-top-color: #9C27B0; /* Purple for libraries */
      }
      .status-badge {
        font-size: 0.7em;
        padding: 3px 6px;
      }
      .app-status .status-badge {
        background-color: #4CAF50;
      }
      .tool-status .status-badge {
        background-color: #2196F3;
      }
      .package-status .status-badge {
        background-color: #9E9E9E;
      }
      .ui-status .status-badge {
        background-color: #E91E63;
      }
      .api-status .status-badge {
        background-color: #FF9800;
      }
      .library-status .status-badge {
        background-color: #9C27B0;
      }
      .unavailable {
        opacity: 0.5;
        pointer-events: none;
      }
      .dashboard-overview {
        background-color: #1e1e1e;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        font-size: 0.95em;
      }
      .dashboard-overview h3 {
        margin-top: 0;
        color: #5d8fff;
      }
      .project-statuses {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 15px;
        margin-top: 15px;
      }
      .project-status {
        background-color: #2a2a2a;
        border-radius: 4px;
        padding: 12px;
        position: relative;
        padding-top: 25px;
      }
      .project-status h4 {
        margin-top: 0;
        margin-bottom: 10px;
        color: #5d8fff;
        text-transform: capitalize;
      }
      .project-status p {
        margin: 5px 0;
        font-size: 0.9em;
      }
      .project-status .version {
        color: #b0b0b0;
        font-size: 0.85em;
      }
      .project-status .path {
        color: #b0b0b0;
        font-size: 0.85em;
        word-break: break-all;
      }
      .repo-link {
        display: inline-block;
        margin-top: 8px;
        font-size: 0.85em;
        padding: 4px 8px;
        background-color: #333;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      .repo-link:hover {
        background-color: #444;
      }
      .no-projects {
        text-align: center;
        padding: 30px;
        background-color: #1e1e1e;
        border-radius: 8px;
        margin: 30px 0;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>BlorkBoard</h1>
    </div>
    <p>Welcome to the BlorkBoard. Select an application to open.</p>
    
    <div class="dashboard-overview">
      <h3>Dashboard Overview</h3>
      <p>Running on port: ${consolePort}</p>
      <div class="project-statuses">
        ${projectStatuses || '<p>No projects found</p>'}
      </div>
    </div>
    
    <h2 class="section-title">Available Projects</h2>
    <div class="apps-container">
      ${projectCards}
    </div>
    
    ${projects.length === 0 ? 
		`<div class="no-projects">
        <h3>No Runnable Projects Found</h3>
        <p>Couldn't find any projects with dev scripts in the workspace.</p>
      </div>` :
		''
}

    <script>
      // Check if services are actually available
      async function checkService(url, cardId, port) {
        try {
          const response = await fetch(url, { 
            mode: 'no-cors',
            timeout: 2000 // 2 second timeout
          });
          
          // Update UI to show service is available
          const card = document.getElementById(cardId);
          if (card) {
            card.classList.remove('unavailable');
            const portInfo = card.querySelector('.port-info');
            if (portInfo) {
              portInfo.textContent = 'Listening on port ' + port;
            }
          }
          
          // Also update the status in the overview section
          const statusDiv = document.querySelector(\`[data-port="\${port}"]\`);
          if (statusDiv) {
            statusDiv.textContent = 'Running on port: ' + port;
          }
        } catch (error) {
          // Update UI to show service is unavailable
          const card = document.getElementById(cardId);
          if (card) {
            card.classList.add('unavailable');
            const portInfo = card.querySelector('.port-info');
            if (portInfo) {
              portInfo.textContent = 'Service unavailable';
            }
          }
          
          // Also update the status in the overview section
          const statusDiv = document.querySelector(\`[data-port="\${port}"]\`);
          if (statusDiv) {
            statusDiv.textContent = 'Service unavailable';
          }
        }
      }
      
      // Check services immediately and then periodically
      function startServiceChecks() {
        const checkAllServices = () => {
          ${serviceChecks}
        };
        
        // Check immediately
        checkAllServices();
        
        // Then check every 5 seconds
        setInterval(checkAllServices, 5000);
      }
      
      // Start checking services
      startServiceChecks();
    </script>
  </body>
  </html>
  `;
	// Serve static assets and route
	app.use(express.static(path.join(__dirname, 'blork-board')));
	app.get('/', (req, res) => {
		res.send(consoleHtml);
	});
	// Start the server
	expressServer = app.listen(consolePort, () => {
		console.log(`\n🚀 BlorkBoard available at http://localhost:${consolePort}`);
		console.log(`\n📱 Discovered Projects:`);
		projects.forEach(project => {
			const displayName = project.name.replace(/^@[^/]+\//, '');
			if (project.port) {
				console.log(`  • ${displayName}: http://localhost:${project.port}`);
			} else {
				console.log(`  • ${displayName}: Failed to start`);
			}
		});
		console.log();
		// Open the browser
		open(`http://localhost:${consolePort}`);
	});
}

// Improved shutdown sequence
/**
 *
 */
async function shutdownGracefully() {
	if (isShuttingDown) return; // Prevent multiple shutdown attempts
	isShuttingDown = true;
	console.log('\n⏹️  Shutting down all applications...');
	// First attempt: gentle termination with SIGTERM
	const termPromises = projects
		.filter(project => project.process && project.process.pid)
		.map(async (project) => {
			try {
				console.log(`Terminating ${project.name}...`);
				await killProcess(project.process.pid);
				return true;
			} catch (err) {
				return false;
			}
		});
	// Wait for all termination attempts with a timeout
	const terminationTimeout = setTimeout(() => {
		console.log('Termination taking too long, forcing exit...');
		process.exit(0);
	}, 3000);
	await Promise.all(termPromises);
	clearTimeout(terminationTimeout);
	// Second attempt: force kill with SIGKILL for any remaining processes
	const killPromises = projects
		.filter(project => project.process && project.process.pid && project.process.exitCode === null)
		.map(async (project) => {
			try {
				console.log(`Force killing ${project.name}...`);
				await killProcess(project.process.pid, 'SIGKILL');
			} catch (err) {
				console.error(`Failed to kill ${project.name}: ${err.message}`);
			}
		});
	// Set a final timeout in case force kill gets stuck
	const forceKillTimeout = setTimeout(() => {
		console.log('Force killing taking too long, forcing exit...');
		process.exit(0);
	}, 1000);
	await Promise.all(killPromises);
	clearTimeout(forceKillTimeout);
	// Close the express server
	if (expressServer) {
		console.log('Closing dashboard server...');
		expressServer.close();
	}
	console.log('✅ BlorkBoard shutdown complete');
	// Force exit after cleanup
	setTimeout(() => {
		process.exit(0);
	}, 100);
}

// Simplified main function to run everything
/**
 *
 */
async function run() {
	try {
		// Discover all projects in the workspace
		projects = await discoverProjects();
		if (projects.length === 0) {
			console.log("No runnable projects discovered in the workspace");
		} else {
			console.log(`Discovered ${projects.length} projects in the workspace`);
			// Find available port for console
			consolePort = await findAvailablePort(9000, 9999);
			if (!consolePort) {
				throw new Error("Could not find an available port for the BlorkBoard");
			}

			// Start each project that should be served
			for (const project of projects) {
				if (project.shouldServe) {
					// Keep trying ports until we find one that works
					let maxTries = 20; // Try up to 20 different ports
					let currentPort = project.defaultPort;
					
					while (maxTries > 0) {
						// First check if the port is already in use
						const inUse = await isPortInUse(currentPort);
						if (!inUse) {
							// Port is free, try to start the project
							console.log(`Starting ${project.name} on port ${currentPort}...`);
							
							try {
								// Special handling for blorktools
								if (project.name.includes('blorktools')) {
									const args = [
										'--filter=' + project.name,
										'tools'
									];
									const env = { 
										...process.env, 
										BROWSER: 'none', 
										NO_OPEN: '1', 
										PORT: currentPort.toString() 
									};
									project.process = startProcess('pnpm', args, { env, cwd: rootDir });
								} else {
									// Regular handling for other projects
									const args = [
										'--filter=' + project.name,
										'dev'
									];
									const env = { 
										...process.env, 
										BROWSER: 'none', 
										NO_OPEN: '1',
										VITE_PORT: currentPort.toString(),
										PORT: currentPort.toString()
									};
									project.process = startProcess('pnpm', args, { env, cwd: rootDir });
								}

								if (project.process) {
									try {
										// Wait for Vite to indicate it's ready
										await project.process.waitForReady();
										
										// Use the actual port that Vite reported
										if (project.process.actualPort) {
											project.port = project.process.actualPort;
											console.log(`Successfully started ${project.name} on port ${project.port}`);
											break; // Successfully started, exit the while loop
										} else {
											throw new Error('Vite did not report its port');
										}
									} catch (err) {
										console.log(`Failed to start ${project.name} on port ${currentPort}: ${err.message}`);
										if (project.process) {
											await killProcess(project.process.pid);
											project.process = null;
										}
									}
								}
							} catch (err) {
								console.error(`Error starting ${project.name}:`, err);
							}
						}
						
						// If we get here, either port was in use or start failed
						console.log(`Port ${currentPort} is not available for ${project.name}, trying next port...`);
						currentPort++;
						maxTries--;
						
						if (maxTries === 0) {
							console.error(`Failed to start ${project.name} after trying multiple ports`);
							project.port = null;
						}
						
						// Add a small delay between attempts
						await new Promise(resolve => setTimeout(resolve, 500));
					}
				}
			}

			// Start the dashboard after all projects have been started
			setTimeout(() => {
				startDashboard();
			}, 2000);
		}

		// Set up signal handlers for graceful shutdown
		process.on('SIGINT', () => {
			console.log('Interrupt received, shutting down...');
			setTimeout(() => {
				console.log('Forced exit due to timeout');
				process.exit(0);
			}, 5000);
			shutdownGracefully();
		});
		process.on('SIGTERM', shutdownGracefully);
		process.on('SIGHUP', shutdownGracefully);
		
		// Handle unhandled errors
		process.on('unhandledRejection', (reason, promise) => {
			console.error('Unhandled Promise Rejection:', reason);
			shutdownGracefully();
		});
		process.on('uncaughtException', (error) => {
			console.error('Uncaught Exception:', error);
			shutdownGracefully();
		});
	} catch (error) {
		console.error(`Error during startup: ${error.message}`);
		process.exit(1);
	}
}

// Start everything
run(); 