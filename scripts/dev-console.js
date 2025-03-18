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
            if (packageData.scripts && (packageData.scripts.dev || packageData.scripts.start)) {
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
              
              // Create project metadata
              discoveredProjects.push({
                name: packageData.name,
                path: projectPath,
                relativePath: path.relative(rootDir, projectPath),
                description: description || `${packageData.name} application`, 
                version: packageData.version,
                devScript: packageData.scripts.dev || packageData.scripts.start,
                defaultPort: 3000 + discoveredProjects.length, // Start from 3000, increment for each project
                port: null, // Will be assigned later
                process: null, // Will be assigned when started
                ready: false
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning directory ${fullBasePath}:`, err.message);
      }
    }
    
    return discoveredProjects;
  } catch (err) {
    console.error('Error discovering projects:', err.message);
    return [];
  }
}

// Function to generate a nice card view for a project
function generateProjectCard(project) {
  if (!project || !project.port) {
    return '';
  }
  
  const displayName = project.name.replace(/^@[^/]+\//, ''); // Remove scope from display
  const portChangeInfo = project.port !== project.defaultPort ? 
    `(default port ${project.defaultPort} was in use)` : '';
  
  return `
  <div id="${displayName}-card" class="app-card">
    <h3>${displayName}</h3>
    <p>${project.description}</p>
    <a href="http://localhost:${project.port}" target="_blank">Open ${displayName}</a>
    <div class="port-info">
      Listening on port ${project.port} ${portChangeInfo}
    </div>
  </div>
  `;
}

// Generate script to check if services are available
function generateServiceChecks() {
  return projects
    .filter(p => p.port)
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
  const portInfo = project.port ? 
    `Running on port: ${project.port}${project.port !== project.defaultPort ? ' (default port was in use)' : ''}` : 
    'Not available';
  
  return `
  <div class="project-status">
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
  
  const projectCards = projects
    .filter(p => p.port) // Only show projects with assigned ports
    .map(generateProjectCard)
    .join('');
  
  const serviceChecks = generateServiceChecks();
  
  const projectStatuses = projects
    .map(generateProjectStatus)
    .join('');
  
  // Create HTML for the dev console with dynamic project data
  const consoleHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Development Console</title>
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
      .apps-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 30px;
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
      .port-info {
        font-size: 0.9em;
        margin-top: 15px;
        padding: 8px;
        background-color: #2a2a2a;
        border-radius: 4px;
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
      <h1>Development Console</h1>
    </div>
    <p>Welcome to the development console. Select an application to open.</p>
    
    <div class="dashboard-overview">
      <h3>Dashboard Overview</h3>
      <p>Running on port: ${consolePort}</p>
      <div class="project-statuses">
        ${projectStatuses || '<p>No projects found</p>'}
      </div>
    </div>
    
    <h2>Applications</h2>
    ${projects.length > 0 ? 
      `<div class="apps-container">
        ${projectCards}
      </div>` : 
      `<div class="no-projects">
        <h3>No Runnable Projects Found</h3>
        <p>Couldn't find any projects with dev scripts in the workspace.</p>
      </div>`
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
  app.use(express.static(path.join(__dirname, 'dev-console')));
  app.get('/', (req, res) => {
    res.send(consoleHtml);
  });
  
  // Start the server
  expressServer = app.listen(consolePort, () => {
    console.log(`\n🚀 Development Console available at http://localhost:${consolePort}`);
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
  
  console.log('✅ Development console shutdown complete');
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
        throw new Error("Could not find an available port for the console");
      }
      
      // Assign ports to each project
      for (const project of projects) {
        project.port = await findAvailablePort(project.defaultPort);
        if (!project.port) {
          console.log(`Could not find an available port for ${project.name}`);
        }
      }
      
      // Start each project
      for (const project of projects) {
        if (project.port) {
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