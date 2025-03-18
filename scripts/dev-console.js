#!/usr/bin/env node

import express from 'express';
import { exec, spawn } from 'child_process';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
let consolePort = 9000;

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

// Function to start a process and return its handle
function startProcess(command, args, options = {}) {
  console.log(`Starting: ${command} ${args.join(' ')}`);
  try {
    // Use detached mode to create a new process group
    const process = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      detached: true, // Create new process group
      ...options
    });
    
    process.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`[${command}] ${output}`);
    });
    
    process.stderr.on('data', (data) => {
      console.error(`[${command}] ${data.toString().trim()}`);
    });
    
    process.on('close', (code) => {
      console.log(`[${command}] process exited with code ${code}`);
    });
    
    // Track the process unref to prevent it from keeping the Node.js process alive
    process.unref();
    
    return process;
  } catch (error) {
    console.error(`Failed to start process: ${error.message}`);
    return null;
  }
}

// Track when servers are ready
let webPort = null;
let toolsPort = null;
let webApp = null;
let toolsApp = null;
let dashboardStarted = false;

// Function to start the dashboard once services are ready
function startDashboard() {
  if (dashboardStarted) return;
  dashboardStarted = true;
  
  // Create HTML for the dev console with dynamic ports
  const consoleHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ThreeJS Site Development Console</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #121212;
        color: #e1e1e1;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      h1, h2 {
        color: #5d8fff;
      }
      .apps-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 20px;
        margin-top: 30px;
      }
      .app-card {
        background-color: #1e1e1e;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .app-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
      }
      .app-card h3 {
        margin-top: 0;
        color: #5d8fff;
      }
      .app-card p {
        margin-bottom: 15px;
        color: #b0b0b0;
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
      .status-message {
        background-color: #2a2a2a;
        border-radius: 8px;
        padding: 15px;
        margin-top: 20px;
        font-size: 0.95em;
      }
      .status-message h3 {
        margin-top: 0;
        color: #5d8fff;
      }
    </style>
  </head>
  <body>
    <h1>ThreeJS Site Development Console</h1>
    <p>Welcome to the development console. Select an application to open.</p>
    
    <div class="status-message">
      <h3>Port Status</h3>
      <p>
        ${webPort ? `Web app running on port: ${webPort}` : 'Web app not available'}
        ${webPort && webPort !== 3000 ? ' (default port 3000 was in use)' : ''}
      </p>
      <p>
        ${toolsPort ? `Tools app running on port: ${toolsPort}` : 'Tools app not available'}
        ${toolsPort && toolsPort !== 3001 ? ' (default port 3001 was in use)' : ''}
      </p>
    </div>
    
    <div class="apps-container">
      ${webPort ? `
      <div id="web-card" class="app-card">
        <h3>Main Website</h3>
        <p>Launch the main website application</p>
        <a href="http://localhost:${webPort}" target="_blank">Open Website</a>
        <div class="port-info">
          Listening on port ${webPort}
        </div>
      </div>
      ` : ''}
      
      ${toolsPort ? `
      <div id="tools-card" class="app-card">
        <h3>Development Tools</h3>
        <p>Debug 3D assets, textures, and models</p>
        <a href="http://localhost:${toolsPort}" target="_blank">Open Tools</a>
        <div class="port-info">
          Listening on port ${toolsPort}
        </div>
      </div>
      ` : ''}
    </div>

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
        ${webPort ? `checkService('http://localhost:${webPort}', 'web-card');` : ''}
        ${toolsPort ? `checkService('http://localhost:${toolsPort}', 'tools-card');` : ''}
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
  app.listen(consolePort, () => {
    console.log(`\n🚀 Development Console available at http://localhost:${consolePort}`);
    console.log(`\n📱 Choose which app to work with:`);
    if (webPort) console.log(`  • Main Website: http://localhost:${webPort}`);
    if (toolsPort) console.log(`  • Development Tools: http://localhost:${toolsPort}`);
    if (!webPort) console.log(`  • Main Website: Failed to start`);
    if (!toolsPort) console.log(`  • Development Tools: Failed to start`);
    console.log();
    
    // Open the browser
    open(`http://localhost:${consolePort}`);
  });
}

// Simplified main function to run everything
async function run() {
  try {
    // Find available ports for all services
    consolePort = await findAvailablePort(9000);
    if (!consolePort) {
      throw new Error("Could not find an available port for the console");
    }
    
    webPort = await findAvailablePort(3000);
    if (!webPort) {
      console.log("Could not find an available port for the web app");
    }
    
    toolsPort = await findAvailablePort(3001);
    if (!toolsPort) {
      console.log("Could not find an available port for the tools app");
    }
    
    // Start the web app
    if (webPort) {
      webApp = startProcess('pnpm', ['--filter=@littlecarlito/web', 'dev', '--', '--no-open', '--port', webPort.toString()]);
    }
    
    // Wait a bit to avoid resource contention
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start the tools app
    if (toolsPort) {
      const toolsEnv = { ...process.env, BROWSER: 'none', NO_OPEN: '1' };
      toolsApp = startProcess('pnpm', ['--filter=@littlecarlito/blorktools', 'dev', '--', '--no-open', '--port', toolsPort.toString()], { env: toolsEnv });
    }
    
    // Start the console dashboard after a short delay
    setTimeout(() => {
      startDashboard();
    }, 2000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down all applications...');
      
      // Kill web app with process group to ensure all child processes are terminated
      if (webApp && webApp.pid) {
        try {
          console.log('Terminating web app process...');
          process.kill(-webApp.pid, 'SIGTERM');
        } catch (err) {
          console.log('Failed to terminate web app process:', err.message);
          // Fallback to regular kill
          webApp.kill('SIGTERM');
        }
      }
      
      // Kill tools app with process group to ensure all child processes are terminated
      if (toolsApp && toolsApp.pid) {
        try {
          console.log('Terminating tools app process...');
          process.kill(-toolsApp.pid, 'SIGTERM');
        } catch (err) {
          console.log('Failed to terminate tools app process:', err.message);
          // Fallback to regular kill
          toolsApp.kill('SIGTERM');
        }
      }
      
      // Force exit after a short delay in case some processes are hanging
      setTimeout(() => {
        console.log('Force exiting development console');
        process.exit(0);
      }, 800);
    });
    
  } catch (error) {
    console.error(`Error during startup: ${error.message}`);
    process.exit(1);
  }
}

// Start everything
run(); 