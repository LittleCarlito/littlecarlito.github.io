// GitHub Pages Environment Simulator
// This script sets up a local server that simulates the GitHub Pages environment
// to debug texture loading issues without needing to deploy

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const REPO_BASE = path.resolve(__dirname, '../../../'); // Go up to repo root

// Map of file extensions to MIME types
const MIME_TYPES = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.wasm': 'application/wasm'
};

// Create HTTP server
const server = http.createServer((req, res) => {
	console.log(`Request: ${req.method} ${req.url}`);
  
	// Simulate GitHub Pages base path
	let url = req.url;
  
	// Strip /littlecarlito.github.io/ prefix for file lookup but keep it in logs
	// This simulates how GitHub Pages serves files with the repo name in URL
	if (url.startsWith('/littlecarlito.github.io/')) {
		url = url.replace('/littlecarlito.github.io/', '/');
	}
  
	// Normalize URL to prevent directory traversal
	const safePath = path.normalize(url).replace(/^(\.\.[\/\\])+/, '');
  
	// Map URL to file path in the repo
	let filePath = path.join(REPO_BASE, safePath);
  
	// Handle root path
	if (safePath === '/' || safePath === '/littlecarlito.github.io/') {
		// Instead of serving the full app, serve a minimal test HTML that just loads the gradient image
		const testHtml = `
		<!DOCTYPE html>
		<html>
		<head>
		  <title>GitHub Pages Texture Test</title>
		</head>
		<body>
		  <h1>GitHub Pages Texture Loading Test</h1>
		  <div>Testing image loading at: /littlecarlito.github.io/images/gradient.jpg</div>
		  <img id="testImage" src="/littlecarlito.github.io/images/gradient.jpg" 
			   onload="window.imageLoaded = true; console.log('Image loaded successfully!')" 
			   onerror="window.imageLoaded = false; console.error('Image failed to load')">
		  
		  <script>
			// Set a global variable to indicate the image load status
			window.imageLoaded = false;
			
			// Log when the image starts loading
			console.log('Starting to load image...');
			
			// Add event listeners to track loading
			document.getElementById('testImage').addEventListener('load', function() {
			  console.log('Image loaded via event listener');
			  window.imageLoaded = true;
			});
			
			document.getElementById('testImage').addEventListener('error', function() {
			  console.error('Image failed to load via event listener');
			  window.imageLoaded = false;
			});
		  </script>
		</body>
		</html>
		`;
		
		// Send the test HTML directly
		res.writeHead(200, {
		  'Content-Type': 'text/html',
		  'Access-Control-Allow-Origin': '*',
		  'Access-Control-Allow-Methods': 'GET, OPTIONS',
		  'Access-Control-Allow-Headers': 'Content-Type',
		  'X-GitHub-Pages-Simulator': 'true'
		});
		res.end(testHtml);
		return;
	}
  
	// Special case for main.js and other app files that should be served from apps/portfolio
	if (safePath === '/main.js' || 
		safePath === '/index.css' || 
		safePath === '/manifest.json' || 
		safePath === '/import-map.json' ||
		safePath === '/custom_types.json') {
		filePath = path.join(REPO_BASE, 'apps/portfolio', safePath);
	}
  
	// Handle paths for resources and pages
	if (safePath.startsWith('/pages/') || 
		safePath.startsWith('/resources/') || 
		safePath.startsWith('/common/') || 
		safePath.startsWith('/background/') || 
		safePath.startsWith('/viewport/')) {
		filePath = path.join(REPO_BASE, 'apps/portfolio', safePath);
	}
  
	// Handle image assets
	if (safePath.startsWith('/images/')) {
		// First try apps/portfolio/images, then try apps/portfolio/public/images
		const portfolioImagesPath = path.join(REPO_BASE, 'apps/portfolio', safePath);
		const publicImagesPath = path.join(REPO_BASE, 'apps/portfolio/public', safePath);
		
		if (fs.existsSync(portfolioImagesPath)) {
			filePath = portfolioImagesPath;
		} else if (fs.existsSync(publicImagesPath)) {
			filePath = publicImagesPath;
		}
	}
  
	// Handle direct access to images that might use the full GitHub Pages URL
	if (safePath.startsWith('/littlecarlito.github.io/images/')) {
		const relativePath = safePath.replace('/littlecarlito.github.io/', '/');
		// First try apps/portfolio/images, then try apps/portfolio/public/images
		const portfolioImagesPath = path.join(REPO_BASE, 'apps/portfolio', relativePath);
		const publicImagesPath = path.join(REPO_BASE, 'apps/portfolio/public', relativePath);
		
		if (fs.existsSync(portfolioImagesPath)) {
			filePath = portfolioImagesPath;
		} else if (fs.existsSync(publicImagesPath)) {
			filePath = publicImagesPath;
		}
	}
  
	// Handle blorkpack package files
	if (safePath.startsWith('/packages/blorkpack/') || 
		safePath.startsWith('/littlecarlito.github.io/packages/blorkpack/')) {
		const normalizedPath = safePath.replace('/littlecarlito.github.io/', '/');
		filePath = path.join(REPO_BASE, normalizedPath);
	}
  
	// Log file paths for debugging
	console.log(`Resolving path: ${safePath} to ${filePath}`);
  
	// Get file extension
	const extname = path.extname(filePath).toLowerCase();
  
	// Set content type based on file extension
	const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
	// Check if file exists
	fs.access(filePath, fs.constants.R_OK, (err) => {
		if (err) {
			// If the file doesn't exist in repo root, try looking in apps/portfolio
			// This handles files that might be in the public directory
			const portfolioPath = path.join(REPO_BASE, 'apps/portfolio', safePath);
      
			fs.access(portfolioPath, fs.constants.R_OK, (portfolioErr) => {
				if (portfolioErr) {
					// Try public directory as a fallback
					const publicPath = path.join(REPO_BASE, 'apps/portfolio/public', safePath);
          
					fs.access(publicPath, fs.constants.R_OK, (publicErr) => {
						if (publicErr) {
							console.error(`File not found: ${filePath}`);
							console.error(`Also tried: ${portfolioPath}`);
							console.error(`And: ${publicPath}`);
							res.writeHead(404);
							res.end('File Not Found');
							return;
						}
            
						serveFile(publicPath, contentType, res);
					});
					return;
				}
        
				serveFile(portfolioPath, contentType, res);
			});
			return;
		}
    
		serveFile(filePath, contentType, res);
	});
});

// Helper function to serve file with appropriate headers
/**
 *
 */
function serveFile(filePath, contentType, res) {
	fs.readFile(filePath, (err, data) => {
		if (err) {
			console.error(`Error reading file: ${err}`);
			res.writeHead(500);
			res.end('Server Error');
			return;
		}
    
		// Add CORS headers
		res.writeHead(200, {
			'Content-Type': contentType,
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'X-GitHub-Pages-Simulator': 'true'
		});
    
		// Special processing for HTML to inject GitHub Pages specific modules
		if (contentType === 'text/html') {
			let htmlContent = data.toString('utf8');
			
			// Inject Blorkpack import mapping for testing
			htmlContent = htmlContent.replace(
				/<script type="importmap">[^]*?<\/script>/s,
				`<script type="importmap">
				{
					"imports": {
						"three": "https://unpkg.com/three@0.161.0/build/three.module.js",
						"three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/",
						"@littlecarlito/blorkpack": "/littlecarlito.github.io/packages/blorkpack/dist/index.js"
					}
				}
				</script>`
			);
			
			// Send the modified HTML
			res.end(htmlContent);
			return;
		}
    
		// Special debug for image files
		if (contentType.startsWith('image/')) {
			console.log(`Serving image: ${filePath} (${data.length} bytes)`);
		}
    
		res.end(data);
	});
}

// Start server
server.listen(PORT, () => {
	console.log(`
=========================================
GitHub Pages Environment Simulator
=========================================
Server running at http://localhost:${PORT}
Base repo path: ${REPO_BASE}

To test GitHub Pages environment:
- Visit http://localhost:${PORT}/littlecarlito.github.io/
- This simulates https://littlecarlito.github.io/littlecarlito.github.io/

Assets will be served with proper CORS headers
from the appropriate directories
=========================================
`);
});