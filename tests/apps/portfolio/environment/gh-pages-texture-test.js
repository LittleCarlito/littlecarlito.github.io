// GitHub Pages Texture Loading Test
// This test checks for texture loading issues in a GitHub Pages environment
// Can run in interactive mode (default) or headless mode (with --headless)
// @jest-environment node
// @jest-environment-options {"jest.skipNodeResolution": true}
/**
 * This is an ESM module that should be run from the command line.
 * It is not designed to be imported by Jest tests directly.
 * Use `pnpm gh-pages:check` or `pnpm gh-pages:test` to run this script.
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isHeadless = args.includes('--headless');
const keepOpen = args.includes('--keep-open') && !isHeadless;

// Configuration
const SERVER_URL = 'http://localhost:8080';
const TIMEOUT = 30000; // 30 seconds
const SERVER_STARTUP_TIME = 5000; // Time to wait for the server to start
const TEXTURE_LOAD_TIME = 8000; // Time to wait for textures to load

console.log(`Running GitHub Pages texture test in ${isHeadless ? 'headless' : 'interactive'} mode`);

// Main test function
/**
 *
 */
async function testGitHubPagesTextureLoading() {
	console.log('Starting GitHub Pages texture loading test...');
  
	let browser = null;
	let serverProcess = null;
  
	try {
		// Start the GitHub Pages simulator server
		console.log('Starting GitHub Pages simulator server...');
		const serverScriptPath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../portfolio/gh-pages-simulator.js'
		);
    
		serverProcess = spawn('node', [serverScriptPath], {
			stdio: ['ignore', 'pipe', 'pipe']
		});
    
		// Log server output
		serverProcess.stdout.on('data', (data) => {
			console.log(`SERVER: ${data.toString().trim()}`);
		});
    
		serverProcess.stderr.on('data', (data) => {
			console.error(`SERVER ERROR: ${data.toString().trim()}`);
		});
    
		// Wait for server to start
		console.log(`Waiting ${SERVER_STARTUP_TIME}ms for server to start...`);
		await new Promise(resolve => setTimeout(resolve, SERVER_STARTUP_TIME));
    
		// Launch browser
		console.log(`Launching ${isHeadless ? 'headless' : 'interactive'} browser...`);
		browser = await puppeteer.launch({
			headless: isHeadless,
			args: ['--disable-web-security'] // Disable CORS for testing
		});
    
		const page = await browser.newPage();
    
		// Collect console messages
		const consoleMessages = [];
		page.on('console', msg => {
			const text = msg.text();
      
			// Filter out noisy logs
			if (text.includes('THREE.WebGLRenderer') || text.includes('es-module-shims')) {
				return;
			}
      
			consoleMessages.push(text);
      
			// Highlight texture-related logs
			if (text.includes('texture') || text.includes('Texture') || 
          text.includes('load') || text.includes('background')) {
				console.log('\x1b[33m%s\x1b[0m', `BROWSER: ${text}`); // Yellow
			} else if (text.includes('error') || text.includes('Error') || text.includes('failed')) {
				console.log('\x1b[31m%s\x1b[0m', `BROWSER ERROR: ${text}`); // Red
			} else {
				console.log(`BROWSER: ${text}`);
			}
		});
    
		// Capture errors
		page.on('pageerror', err => {
			console.error('\x1b[31m%s\x1b[0m', `PAGE ERROR: ${err.message}`);
			consoleMessages.push(`ERROR: ${err.message}`);
		});
    
		// Navigate to the GitHub Pages simulated URL
		console.log(`Navigating to ${SERVER_URL}/threejs_site/...`);
    
		await page.goto(`${SERVER_URL}/threejs_site/`, {
			waitUntil: 'networkidle2',
			timeout: TIMEOUT
		});
    
		console.log('Page loaded successfully');
    
		// Wait for the image to load
		await page.waitForFunction(() => window.imageLoaded !== undefined, { timeout: TIMEOUT });
		console.log('Image load status checked');
    
		// Check if image loaded
		const imageLoaded = await page.evaluate(() => {
			return window.imageLoaded;
		});
    
		if (imageLoaded) {
			console.log('\x1b[32m%s\x1b[0m', 'TEST PASSED: Image loaded successfully');
		} else {
			console.log('\x1b[31m%s\x1b[0m', 'TEST FAILED: Image did not load');
      
			// Get more details about why it failed
			await page.evaluate(() => {
				console.error('Image loading failure details:');
				const img = document.getElementById('testImage');
				console.error('Image element:', img ? 'Found' : 'Not found');
				console.error('Image source:', img ? img.src : 'N/A');
				console.error('Image complete:', img ? img.complete : 'N/A');
        
				// Check network requests
				console.error('Checking network requests for image files...');
				performance.getEntriesByType('resource')
					.filter(entry => entry.name.includes('.jpg') || entry.name.includes('.png'))
					.forEach(entry => {
						console.error(`Resource: ${entry.name}, Duration: ${entry.duration}ms`);
					});
			});
		}
    
		if (keepOpen) {
			// Keep browser open for manual inspection in interactive mode
			console.log('\nBrowser will stay open for manual inspection.');
			console.log('Press Ctrl+C to exit when done.\n');
      
			// Wait until manually closed
			await new Promise(resolve => {});
		} else {
			// Close resources in headless mode or when not keeping open
			if (browser) {
				await browser.close();
				console.log('Browser closed');
			}
      
			if (serverProcess) {
				serverProcess.kill();
				console.log('Server process terminated');
			}
		}
    
		// Return success/failure for CI/CD integration
		return imageLoaded ? 0 : 1;
	} catch (error) {
		console.error('\x1b[31m%s\x1b[0m', `Test error: ${error.message}`);
		console.error(error.stack);
    
		// Clean up resources
		if (browser && !keepOpen) {
			await browser.close();
		}
    
		if (serverProcess && !keepOpen) {
			serverProcess.kill();
		}
    
		return 1; // Error exit code
	}
}

// Run the test
testGitHubPagesTextureLoading()
	.then(exitCode => {
		console.log(`Test completed with exit code: ${exitCode}`);
    
		// Only exit in headless mode
		if (isHeadless) {
			process.exit(exitCode);
		}
	})
	.catch(error => {
		console.error('Unhandled error in test:', error);
    
		// Only exit in headless mode
		if (isHeadless) {
			process.exit(1);
		}
	}); 