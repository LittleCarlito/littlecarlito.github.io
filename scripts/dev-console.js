#!/usr/bin/env node

import express from 'express';
import { exec, spawn } from 'child_process';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 9000;

// Function to start a process and return its handle
function startProcess(command, args, options = {}) {
  console.log(`Starting: ${command} ${args.join(' ')}`);
  const process = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    ...options
  });
  
  process.stdout.on('data', (data) => {
    console.log(`[${command}] ${data.toString().trim()}`);
  });
  
  process.stderr.on('data', (data) => {
    console.error(`[${command}] ${data.toString().trim()}`);
  });
  
  process.on('close', (code) => {
    console.log(`[${command}] process exited with code ${code}`);
  });
  
  return process;
}

// Track when servers are ready
let webReady = false;
let toolsReady = false;

// Start the server after everything is ready
function startDashboardWhenReady() {
  if (webReady && toolsReady) {
    // Start the server for the console dashboard
    app.listen(port, () => {
      console.log(`\n🚀 Development Console available at http://localhost:${port}`);
      console.log(`\n📱 Choose which app to work with:`);
      console.log(`  • Main Website: http://localhost:3000`);
      console.log(`  • Development Tools: http://localhost:3001\n`);
      
      // Open the browser
      open(`http://localhost:${port}`);
    });
  }
}

// Start the main web application with capturing ready state
const webApp = startProcess('pnpm', ['--filter=@littlecarlito/web', 'dev', '--', '--no-open', '--port', '3000']);
webApp.stdout.on('data', (data) => {
  const output = data.toString();
  // Look for the message that indicates the server is ready
  if (output.includes('Local:') && output.includes('http://localhost:3000')) {
    webReady = true;
    startDashboardWhenReady();
  }
});

// Start the tools application using the dev script with no-open flag
console.log('Starting development tools...');
// We use environment variables to prevent browser opening
const toolsEnv = { ...process.env, BROWSER: 'none', NO_OPEN: '1' };
const toolsApp = startProcess('pnpm', ['--filter=@littlecarlito/blorktools', 'dev', '--', '--no-open', '--port', '3001'], { env: toolsEnv });
toolsApp.stdout.on('data', (data) => {
  const output = data.toString();
  // Look for the message that indicates the server is ready
  if (output.includes('Local:') && output.includes('http://localhost:3001')) {
    toolsReady = true;
    startDashboardWhenReady();
  }
});

// Fallback in case we don't catch the ready messages
setTimeout(() => {
  if (!webReady) {
    console.log('Web app startup message not detected, assuming it is ready');
    webReady = true;
  }
  if (!toolsReady) {
    console.log('Tools app startup message not detected, assuming it is ready');
    toolsReady = true;
  }
  startDashboardWhenReady();
}, 10000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down all applications...');
  webApp.kill();
  toolsApp.kill();
  process.exit(0);
});

// Serve static assets
app.use(express.static(path.join(__dirname, 'dev-console')));

// Create HTML for the dev console
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
  </style>
</head>
<body>
  <h1>ThreeJS Site Development Console</h1>
  <p>Welcome to the development console. Select an application to open.</p>
  
  <div class="apps-container">
    <div class="app-card">
      <h3>Main Website</h3>
      <p>Launch the main website application</p>
      <a href="http://localhost:3000" target="_blank">Open Website</a>
      <div class="port-info">
        Listening on port 3000
      </div>
    </div>
    
    <div class="app-card">
      <h3>Development Tools</h3>
      <p>Debug 3D assets, textures, and models</p>
      <a href="http://localhost:3001" target="_blank">Open Tools</a>
      <div class="port-info">
        Listening on port 3001
      </div>
    </div>
  </div>
</body>
</html>
`;

// Main route
app.get('/', (req, res) => {
  res.send(consoleHtml);
}); 