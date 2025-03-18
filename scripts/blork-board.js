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
      server.close();
      resolve(false); // Port is free
    });
    
    server.listen(port);
  });
}

// Find the next available port starting from the preferred port
async function findAvailablePort(preferredPort, maxAttempts = 10) {
  let port = preferredPort;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
    console.log(`Port ${port} is in use, trying ${port + 1}...`);
    port++;
  }
  return null; // No available ports found within range
}

// Kill a process and all its children using tree-kill
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
    
    process.stdout.on('data', (data) => {
      process.hasOutput = true;
      const output = data.toString().trim();
      console.log(`[${command}] ${output}`);
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
              
              // Assign default ports with blorktools having priority for port 3001
              let defaultPort = 3000 + discoveredProjects.length;
              if (packageData.name.includes('blorktools')) {
                defaultPort = 3001; // Make sure blorktools gets port 3001
              } else if (packageData.name.includes('web')) {
                defaultPort = 3000; // Web app gets port 3000
              } else if (defaultPort === 3001) {
                defaultPort = 3002; // Anything else that would get 3001, get 3002 instead
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
                shouldServe: shouldServe
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

// Function to generate a nice card view for a project
function generateProjectCard(project) {
  if (!project) {
    return '';
  }
  
  const displayName = project.name.replace(/^@[^/]+\//, ''); // Remove scope from display
  
  // Different card templates based on whether the project is served
  if (project.shouldServe && project.port) {
    const portChangeInfo = project.port !== project.defaultPort ? 
      `(default port ${project.defaultPort} was in use)` : '';
    
    return `
    <div id="${displayName}-card" class="app-card ${project.type}-card">
      <div class="card-badge">${project.type}</div>
      <h3>${displayName}</h3>
      <p>${project.description}</p>
      <a href="http://localhost:${project.port}" target="_blank">Open ${displayName}</a>
      <div class="port-info">
        Listening on port ${project.port} ${portChangeInfo}
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
function generateServiceChecks() {
  return projects
    .filter(p => p.shouldServe && p.port)
    .map(p => {
      const displayName = p.name.replace(/^@[^/]+\//, '');
      return `checkService('http://localhost:${p.port}', '${displayName}-card');`;
    })
    .join('\n      ');
}

// Function to generate a project status summary
function generateProjectStatus(project) {
  if (!project) return '';
  
  const displayName = project.name.replace(/^@[^/]+\//, '');
  let portInfo = 'Not available';
  
  if (project.shouldServe) {
    portInfo = project.port ? 
      `Running on port: ${project.port}${project.port !== project.defaultPort ? ' (default port was in use)' : ''}` : 
      'Not available';
  } else {
    portInfo = 'Not served (non-interactive package)';
  }
  
  return `
  <div class="project-status ${project.type}-status">
    <div class="status-badge">${project.type}</div>
    <h4>${displayName}</h4>
    <p>${portInfo}</p>
    <p class="version">Version: ${project.version}</p>
    <p class="path">Path: ${project.relativePath}</p>
  </div>
  `;
}

// Function to start the dashboard once services are ready
function startDashboard() {
  if (dashboardStarted) return;
  dashboardStarted = true;
  
  // Generate cards for all projects
  const projectCards = projects.map(generateProjectCard).join('');
  
  const serviceChecks = projects
    .filter(p => p.shouldServe && p.port)
    .map(p => {
      const displayName = p.name.replace(/^@[^/]+\//, '');
      return `checkService('http://localhost:${p.port}', '${displayName}-card');`;
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
      .app-card a {
        display: inline-block;
        background-color: #5d8fff;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        text-decoration: none;
        font-weight: bold;
        transition: background-color 0.2s;
        text-align: center;
      }
      .app-card a:hover {
        background-color: #4a75d1;
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
      function checkService(url, cardId) {
        fetch(url, { mode: 'no-cors' })
          .catch(() => {
            const card = document.getElementById(cardId);
            if (card) {
              card.classList.add('unavailable');
              const portInfo = card.querySelector('.port-info');
              if (portInfo) {
                portInfo.textContent = 'Service unavailable';
              }
            }
          });
      }
      
      // Wait a moment then check services
      setTimeout(() => {
        ${serviceChecks}
      }, 1000);
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
  
  // Wait for all termination attempts
  await Promise.all(termPromises);
  
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
  
  await Promise.all(killPromises);
  
  // Close the express server
  if (expressServer) {
    console.log('Closing dashboard server...');
    expressServer.close();
  }
  
  console.log('✅ BlorkBoard shutdown complete');
  // Force exit after cleanup
  process.exit(0);
}

// Simplified main function to run everything
async function run() {
  try {
    // Discover all projects in the workspace
    projects = await discoverProjects();
    
    if (projects.length === 0) {
      console.log("No runnable projects discovered in the workspace");
    } else {
      console.log(`Discovered ${projects.length} projects in the workspace`);
      
      // Find available port for console
      consolePort = await findAvailablePort(9000);
      if (!consolePort) {
        throw new Error("Could not find an available port for the BlorkBoard");
      }
      
      // Assign ports to each project that should be served
      for (const project of projects) {
        if (project.shouldServe) {
          project.port = await findAvailablePort(project.defaultPort);
          if (!project.port) {
            console.log(`Could not find an available port for ${project.name}`);
          }
        }
      }
      
      // Start each project that should be served
      for (const project of projects) {
        if (project.shouldServe && project.port) {
          // Special handling for blorktools
          if (project.name.includes('blorktools')) {
            console.log(`Starting ${project.name} with tools script on port ${project.port}...`);
            
            // For tools script, construct args differently
            const args = [
              '--filter=' + project.name,
              'tools',
              '--port',
              project.port.toString(),
              '--no-open'
            ];
            
            // Add a small delay between starting each project
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const env = { ...process.env, BROWSER: 'none', NO_OPEN: '1' };
            project.process = startProcess('pnpm', args, { env, cwd: rootDir });
          } else {
            // Regular handling for other projects
            const portArg = project.devScript.includes('--port') ? 
              [] : ['--', '--no-open', '--port', project.port.toString()];
            
            const args = [
              '--filter=' + project.name,
              'dev',
              ...portArg
            ];
            
            // Add a small delay between starting each project
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const env = { ...process.env, BROWSER: 'none', NO_OPEN: '1' };
            project.process = startProcess('pnpm', args, { env, cwd: rootDir });
          }
          
          // Check if the process failed to start after a short delay
          if (project.process) {
            setTimeout(() => {
              if (project.process && !project.process.hasOutput && project.process.exitCode === null) {
                console.log(`No output from ${project.name} after 2 seconds, it may have failed silently.`);
              }
            }, 2000);
          }
        }
      }
      
      // Start the dashboard after all projects have been started
      setTimeout(() => {
        startDashboard();
      }, 2000);
    }
    
    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', shutdownGracefully);  // Ctrl+C
    process.on('SIGTERM', shutdownGracefully); // kill command
    process.on('SIGHUP', shutdownGracefully);  // Terminal closed
    
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