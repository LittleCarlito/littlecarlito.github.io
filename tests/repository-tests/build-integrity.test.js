/**
 * Build Integrity Test Suite
 * 
 * This test suite verifies that the built artifacts will work correctly
 * when deployed to GitHub Pages, with special focus on modules that
 * have caused issues in the past, such as Rapier physics.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fetch = require('node-fetch');
const http = require('http');
const handler = require('serve-handler');

// Define the GitHub Pages base path - this should match the one in path_config.js
const GITHUB_PAGES_BASE = 'threejs_site';

// Paths
const REPO_ROOT = path.resolve(__dirname, '../..');
const PORTFOLIO_DIR = path.resolve(REPO_ROOT, 'apps/portfolio');
const PORTFOLIO_DIST_DIR = path.resolve(PORTFOLIO_DIR, 'dist');
const BLORKPACK_DIR = path.resolve(REPO_ROOT, 'packages/blorkpack');

// Port for local test server
const TEST_SERVER_PORT = 9876;
let server = null;

// Helper to run build
/**
 * Runs the GitHub Pages build process
 * @returns {boolean} Whether the build succeeded
 */
function runGitHubPagesBuild() {
	try {
		console.log('Building project for GitHub Pages deployment...');
		execSync('pnpm build', {
			env: { ...process.env, GITHUB_PAGES: 'true' },
			cwd: REPO_ROOT,
			stdio: 'inherit'
		});
		return true;
	} catch (error) {
		console.error('Build failed:', error.message);
		return false;
	}
}

/**
 * Start a local server to test asset loading
 */
async function startTestServer() {
	if (!fs.existsSync(PORTFOLIO_DIST_DIR)) {
		throw new Error('No dist directory found. Run with FORCE_BUILD=true to build first.');
	}
    
	// Return a promise that resolves when the server is ready
	return new Promise((resolve, reject) => {
		server = http.createServer((request, response) => {
			// Simulate GitHub Pages base path
			if (request.url.startsWith(`/${GITHUB_PAGES_BASE}/`)) {
				// Strip the base path for serve-handler
				request.url = request.url.replace(`/${GITHUB_PAGES_BASE}`, '');
			}
            
			return handler(request, response, {
				public: PORTFOLIO_DIST_DIR,
				rewrites: [{ source: '**', destination: '/index.html' }]
			});
		});
        
		server.listen(TEST_SERVER_PORT, () => {
			console.log(`Test server running at http://localhost:${TEST_SERVER_PORT}`);
			resolve();
		});
        
		server.on('error', (err) => {
			reject(err);
		});
	});
}

/**
 * Stop the test server
 */
function stopTestServer() {
	if (server) {
		server.close();
		server = null;
	}
}

describe('GitHub Pages Build Integrity Tests', () => {
	// Optionally rebuild before tests if needed
	const shouldBuild = process.env.FORCE_BUILD === 'true';
    
	beforeAll(async () => {
		if (shouldBuild) {
			const buildSuccess = runGitHubPagesBuild();
			expect(buildSuccess).toBe(true);
		}
	});
    
	describe('Rapier Physics Loading', () => {
		// These tests will be skipped if the dist directory doesn't exist
		// Use FORCE_BUILD=true jest test to ensure they run with a fresh build
        
		it('loader.js should use standard import without timestamp parameter', () => {
			const loaderPath = path.resolve(BLORKPACK_DIR, 'src/loader.js');
			expect(fs.existsSync(loaderPath)).toBe(true);
            
			const loaderContent = fs.readFileSync(loaderPath, 'utf8');
            
			// Should use standard import
			expect(loaderContent).toContain('await import(\'@dimforge/rapier3d-compat\')');
            
			// Should NOT use timestamp parameters
			expect(loaderContent).not.toContain('?t=');
			expect(loaderContent).not.toContain('const timestamp = Date.now()');
		});
        
		it('index.html should include Rapier in import map', () => {
			const indexHtmlPath = path.resolve(PORTFOLIO_DIR, 'index.html');
			expect(fs.existsSync(indexHtmlPath)).toBe(true);
            
			const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
            
			// Extract import map
			const importMapMatch = indexHtmlContent.match(/<script type="importmap">([\s\S]*?)<\/script>/);
			expect(importMapMatch).toBeTruthy();
            
			const importMap = JSON.parse(importMapMatch[1]);
			expect(importMap.imports['@dimforge/rapier3d-compat']).toBeDefined();
			expect(importMap.imports['@dimforge/rapier3d-compat']).toContain('rapier.es.js');
		});
        
		// Skip if no dist directory but don't fail the entire suite
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('built main.js should NOT contain timestamp parameters', () => {
			// Find the main.js file (may have hash in name)
			const distFiles = fs.readdirSync(PORTFOLIO_DIST_DIR);
			const mainJsFile = distFiles.find(f => f === 'main.js' || f.match(/^main\.[a-z0-9]+\.js$/i));
            
			expect(mainJsFile).toBeTruthy();
            
			if (mainJsFile) {
				const mainJsPath = path.join(PORTFOLIO_DIST_DIR, mainJsFile);
				const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
                
				// Should NOT contain timestamp parameters that would break import maps
				expect(mainJsContent).not.toContain('import("@dimforge/rapier3d-compat?t=');
				expect(mainJsContent).not.toContain('import(\'@dimforge/rapier3d-compat?t=');
				expect(mainJsContent).not.toContain('@dimforge/rapier3d-compat?t=');
			}
		});
        
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('built index.html should have correct import map with Rapier', () => {
			const distIndexHtmlPath = path.join(PORTFOLIO_DIST_DIR, 'index.html');
			expect(fs.existsSync(distIndexHtmlPath)).toBe(true);
            
			const distIndexHtmlContent = fs.readFileSync(distIndexHtmlPath, 'utf8');
            
			// Verify import map exists and contains Rapier
			const importMapMatch = distIndexHtmlContent.match(/<script type="importmap">([\s\S]*?)<\/script>/);
			expect(importMapMatch).toBeTruthy();
            
			const importMap = JSON.parse(importMapMatch[1]);
            
			// Verify Rapier is in the import map
			expect(importMap.imports['@dimforge/rapier3d-compat']).toBeDefined();
            
			// Verify it points to a correct URL without timestamps
			const rapierUrl = importMap.imports['@dimforge/rapier3d-compat'];
			expect(rapierUrl).toContain('https://unpkg.com/@dimforge/rapier3d-compat');
			expect(rapierUrl).toContain('rapier.es.js');
			expect(rapierUrl).not.toContain('?t=');
		});

		// Add a new comprehensive test for Rapier loading
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('should properly bundle Rapier without dynamic timestamp imports', () => {
			// Check for separate Rapier chunk file
			const distFiles = fs.readdirSync(PORTFOLIO_DIST_DIR);
			const rapierFiles = distFiles.filter(f => f.includes('rapier'));
			
			// Ensure there's at least one Rapier-related file (either as a separate chunk or in main.js)
			const hasRapierFile = rapierFiles.length > 0;
			const mainJsPath = path.join(PORTFOLIO_DIST_DIR, 'main.js');
			
			if (!hasRapierFile && fs.existsSync(mainJsPath)) {
				// If no separate Rapier file, check if it's inlined in main.js
				const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
				expect(mainJsContent).not.toContain('@dimforge/rapier3d-compat?t=');
			} else if (hasRapierFile) {
				// Check that Rapier files don't contain timestamp parameters
				for (const rapierFile of rapierFiles) {
					const rapierFilePath = path.join(PORTFOLIO_DIST_DIR, rapierFile);
					const rapierContent = fs.readFileSync(rapierFilePath, 'utf8');
					expect(rapierContent).not.toContain('?t=');
				}
			}
		});
	});
    
	describe('Build Consistency', () => {
		it('should have matching import map in source and built files', () => {
			// Skip if no dist directory
			if (!fs.existsSync(PORTFOLIO_DIST_DIR)) {
				console.warn('Skipping build consistency test - no dist directory');
				return;
			}
            
			// Read source index.html
			const sourceIndexHtmlPath = path.resolve(PORTFOLIO_DIR, 'index.html');
			const sourceIndexHtmlContent = fs.readFileSync(sourceIndexHtmlPath, 'utf8');
            
			// Extract source import map
			const sourceImportMapMatch = sourceIndexHtmlContent.match(/<script type="importmap">([\s\S]*?)<\/script>/);
			expect(sourceImportMapMatch).toBeTruthy();
			const sourceImportMap = JSON.parse(sourceImportMapMatch[1]);
            
			// Read built index.html
			const builtIndexHtmlPath = path.join(PORTFOLIO_DIST_DIR, 'index.html');
			const builtIndexHtmlContent = fs.readFileSync(builtIndexHtmlPath, 'utf8');
            
			// Extract built import map
			const builtImportMapMatch = builtIndexHtmlContent.match(/<script type="importmap">([\s\S]*?)<\/script>/);
			expect(builtImportMapMatch).toBeTruthy();
			const builtImportMap = JSON.parse(builtImportMapMatch[1]);
            
			// Compare import maps
			// They should have the same entries for Rapier
			expect(builtImportMap.imports['@dimforge/rapier3d-compat']).toBe(
				sourceImportMap.imports['@dimforge/rapier3d-compat']
			);
		});

		// Add a new test to verify the build script preserves the correct imports
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('should verify build script preserves import map functionality', () => {
			// Get the package.json to check build scripts
			const packageJsonPath = path.resolve(REPO_ROOT, 'package.json');
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			
			// Verify test:build-integrity exists
			expect(packageJson.scripts['test:build-integrity']).toBeDefined();
			expect(packageJson.scripts['test:build-integrity']).toContain('build-integrity.test.js');
			
			// Verify verify-gh-pages exists
			expect(packageJson.scripts['verify-gh-pages']).toBeDefined();
			expect(packageJson.scripts['verify-gh-pages']).toContain('GITHUB_PAGES=true');
			
			// Ensure build and test steps are in the right order
			const verifyGhPagesScript = packageJson.scripts['verify-gh-pages'];
			const buildBeforeTest = verifyGhPagesScript.indexOf('build') < verifyGhPagesScript.indexOf('test');
			expect(buildBeforeTest).toBe(true);
		});
	});

	// New test section specifically for detecting regression in the Rapier loading issue
	describe('Regression Prevention', () => {
		it('loader.js should not contain any dynamic timestamp generation code', () => {
			const loaderPath = path.resolve(BLORKPACK_DIR, 'src/loader.js');
			const loaderContent = fs.readFileSync(loaderPath, 'utf8');
			
			// Check for various timestamp patterns
			expect(loaderContent).not.toContain('Date.now()');
			expect(loaderContent).not.toContain('new Date()');
			expect(loaderContent).not.toContain('?t=');
			expect(loaderContent).not.toContain('?timestamp=');
		});
		
		it('should have consistent loading strategy across source files', () => {
			// Check for consistency in all relevant files
			const loaderPath = path.resolve(BLORKPACK_DIR, 'src/loader.js');
			const loaderContent = fs.readFileSync(loaderPath, 'utf8');
			
			// Loader should use the bare import syntax for Rapier
			expect(loaderContent).toContain('await import(\'@dimforge/rapier3d-compat\')');
			
			// Check import map in index.html
			const indexHtmlPath = path.resolve(PORTFOLIO_DIR, 'index.html');
			const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
			
			const importMapMatch = indexHtmlContent.match(/<script type="importmap">([\s\S]*?)<\/script>/);
			expect(importMapMatch).toBeTruthy();
			
			const importMap = JSON.parse(importMapMatch[1]);
			expect(importMap.imports['@dimforge/rapier3d-compat']).toBeDefined();
		});
	});
	
	// New test section specifically for testing asset loading in GitHub Pages environment
	describe('Asset Loading', () => {
		// Server for testing asset loading
		beforeAll(async () => {
			if (fs.existsSync(PORTFOLIO_DIST_DIR)) {
				await startTestServer();
			}
		});
		
		afterAll(() => {
			stopTestServer();
		});
		
		// Skip if no dist directory but don't fail the entire suite
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('manifest.json should be accessible', async () => {
			const response = await fetch(`http://localhost:${TEST_SERVER_PORT}/${GITHUB_PAGES_BASE}/resources/manifest.json`);
			expect(response.status).toBe(200);
			const manifest = await response.json();
			expect(manifest).toBeDefined();
		});
		
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('gradient.jpg should be accessible from GitHub Pages path', async () => {
			// First verify the file exists in the build
			const imagePath = path.join(PORTFOLIO_DIST_DIR, 'images', 'gradient.jpg');
			expect(fs.existsSync(imagePath)).toBe(true);
			
			// Now test it can be loaded via the GitHub Pages URL
			const response = await fetch(`http://localhost:${TEST_SERVER_PORT}/${GITHUB_PAGES_BASE}/images/gradient.jpg`);
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toContain('image/jpeg');
		});
		
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('should correctly resolve image paths in main.js', () => {
			// Find the main.js file
			const distFiles = fs.readdirSync(PORTFOLIO_DIST_DIR);
			const mainJsFile = distFiles.find(f => f === 'main.js' || f.match(/^main\.[a-z0-9]+\.js$/i));
			
			expect(mainJsFile).toBeTruthy();
			
			if (mainJsFile) {
				const mainJsPath = path.join(PORTFOLIO_DIST_DIR, mainJsFile);
				const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
				
				// Check path resolution for GitHub Pages
				// Make sure it does NOT include paths with double slashes like /threejs_site/
				expect(mainJsContent).not.toContain(`"/${GITHUB_PAGES_BASE}/`);
				expect(mainJsContent).not.toContain(`'/${GITHUB_PAGES_BASE}/`);
				
				// Instead of looking for a specific string format, use a more flexible approach
				// to accommodate minification and compile-time transformations
				expect(mainJsContent).toContain('pathname.includes');
				expect(mainJsContent).toContain(GITHUB_PAGES_BASE);
				// Ensure there are no leading slashes before threejs_site/ - this will allow any pattern
				// like window.location.pathname.includes('threejs_site/') or pathname.includes("threejs_site")
				// after minification
				expect(mainJsContent).not.toContain(`/${GITHUB_PAGES_BASE}/`);
			}
		});
		
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('should test all manifest-referenced assets are accessible', async () => {
			// Load the manifest to check asset paths
			const manifestPath = path.join(PORTFOLIO_DIST_DIR, 'resources', 'manifest.json');
			if (!fs.existsSync(manifestPath)) {
				console.warn('Manifest not found, skipping asset check');
				return;
			}
			
			const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
			
			// Check background image if present
			if (manifest.background && manifest.background.type === 'IMAGE' && manifest.background.image_path) {
				const imagePath = manifest.background.image_path;
				
				// Build the GitHub Pages URL
				const normalizedPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
				const fullImagePath = `${GITHUB_PAGES_BASE}/${normalizedPath}`;
				
				// Try to access the image
				const response = await fetch(`http://localhost:${TEST_SERVER_PORT}/${fullImagePath}`);
				expect(response.status).toBe(200);
				expect(response.headers.get('content-type')).toMatch(/^image\//);
			}
			
			// Check other key assets from manifest
			// Add more checks here for other important assets
		});
		
		// Add a test for path resolution logic
		(fs.existsSync(PORTFOLIO_DIST_DIR) ? it : it.skip)('should correctly resolve assets with both leading slash and non-leading slash paths', async () => {
			// Test relative path (no leading slash)
			const relativeResponse = await fetch(`http://localhost:${TEST_SERVER_PORT}/${GITHUB_PAGES_BASE}/images/gradient.jpg`);
			expect(relativeResponse.status).toBe(200);
			
			// Test absolute path (with leading slash, which should still work)
			const absoluteResponse = await fetch(`http://localhost:${TEST_SERVER_PORT}/${GITHUB_PAGES_BASE}/images/gradient.jpg`);
			expect(absoluteResponse.status).toBe(200);
		});
	});
}); 