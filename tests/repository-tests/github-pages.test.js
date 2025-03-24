const fs = require('fs');
const path = require('path');

// Path to the portfolio dist directory - this is what gets deployed to GitHub Pages
const PORTFOLIO_DIR = path.resolve(__dirname, '../../apps/portfolio');
const PORTFOLIO_PUBLIC_DIR = path.resolve(PORTFOLIO_DIR, 'public');
const PORTFOLIO_DIST_DIR = path.resolve(PORTFOLIO_DIR, 'dist');
const BLORKPACK_DIR = path.resolve(__dirname, '../../packages/blorkpack');

// Force jest to recognize this as a test file
const test = global.test || jest.test;
const describe = global.describe || jest.describe;
const expect = global.expect || jest.expect;

describe('GitHub Pages Deployment', () => {
	describe('Essential files for deployment', () => {
		test('index.html exists and has correct CSP configuration', () => {
			const indexHtmlPath = path.resolve(PORTFOLIO_DIR, 'index.html');
			expect(fs.existsSync(indexHtmlPath)).toBe(true);
      
			const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
      
			// Check that CSP exists
			expect(indexHtmlContent).toContain('Content-Security-Policy');
      
			// Verify CSP doesn't contain frame-ancestors directive in meta tag (this caused issues)
			expect(indexHtmlContent).not.toContain('frame-ancestors');
			
			// Verify CSP includes unpkg.com for external scripts
			expect(indexHtmlContent).toContain('script-src');
			expect(indexHtmlContent).toContain('https://unpkg.com');
			
			// Ensure connect-src also includes unpkg.com for dynamic imports
			expect(indexHtmlContent).toContain('connect-src');
			expect(indexHtmlContent).toContain('connect-src \'self\' https://unpkg.com');
			
			// Verify source-map-loader metadata is present to fix WebAssembly source map issues
			expect(indexHtmlContent).toContain('<meta name="source-map-loader" content="enabled">');
		});

		// New test to verify WebGL extension handling
		test('AppRenderer properly enables WebGL extensions', () => {
			const appRendererPath = path.resolve(BLORKPACK_DIR, 'src/app_renderer.js');
			expect(fs.existsSync(appRendererPath)).toBe(true);
			
			const appRendererContent = fs.readFileSync(appRendererPath, 'utf8');
			
			// Check that EXT_float_blend extension is explicitly enabled
			expect(appRendererContent).toContain('gl.getExtension(\'EXT_float_blend\')');
		});

		test('Rapier loader handles WebAssembly imports properly', () => {
			const loaderPath = path.resolve(BLORKPACK_DIR, 'src/loader.js');
			expect(fs.existsSync(loaderPath)).toBe(true);
			
			const loaderContent = fs.readFileSync(loaderPath, 'utf8');
			
			// Check that Rapier loader uses standard import with no timestamp parameter for GitHub Pages
			// This is required to work with import maps
			expect(loaderContent).toContain('await import(\'@dimforge/rapier3d-compat\')');
			
			// Make sure there's no timestamp parameter in the import (would break import map)
			expect(loaderContent).not.toContain('await import(\'@dimforge/rapier3d-compat?t=\'');
			expect(loaderContent).not.toContain('const timestamp = Date.now()');
		});

		test('_headers file exists with proper MIME type definitions', () => {
			const headersPath = path.resolve(PORTFOLIO_PUBLIC_DIR, '_headers');
			expect(fs.existsSync(headersPath)).toBe(true);
      
			const headersContent = fs.readFileSync(headersPath, 'utf8');
      
			// Check for JavaScript MIME type configuration
			expect(headersContent).toContain('/*.js');
			expect(headersContent).toContain('application/javascript');
      
			// Check for JSON MIME type configuration
			expect(headersContent).toContain('/*.json');
			expect(headersContent).toContain('application/json');
		});

		test('.nojekyll file exists in public directory', () => {
			const nojekyllPath = path.resolve(PORTFOLIO_PUBLIC_DIR, '.nojekyll');
			// If this doesn't exist yet, the test will remind you to create it
			expect(fs.existsSync(nojekyllPath)).toBe(true);
		});

		test('custom_types.json exists and is valid JSON', () => {
			const customTypesPath = path.resolve(PORTFOLIO_DIR, 'custom_types.json');
			expect(fs.existsSync(customTypesPath)).toBe(true);
      
			// Verify it's valid JSON by trying to parse it
			const customTypesContent = fs.readFileSync(customTypesPath, 'utf8');
			expect(() => JSON.parse(customTypesContent)).not.toThrow();
		});
	});

	describe('Build output verification', () => {
		test('vite.config.js has GitHub Pages base configuration', () => {
			const viteConfigPath = path.resolve(PORTFOLIO_DIR, 'vite.config.js');
			expect(fs.existsSync(viteConfigPath)).toBe(true);
      
			const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
      
			// Check that the config handles GitHub Pages base path
			expect(viteConfigContent).toContain('isGitHubPages');
			expect(viteConfigContent).toContain('/threejs_site/');
		});

		test('vite.config.js includes file copy logic for custom_types.json', () => {
			const viteConfigPath = path.resolve(PORTFOLIO_DIR, 'vite.config.js');
			const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
      
			// Check that custom_types.json is copied
			expect(viteConfigContent).toContain('custom_types.json');
		});
	});
});

describe('GitHub Pages Dependencies', () => {
	test('portfolio depends on blorkpack properly', () => {
		// Check the dependencies in package.json
		const portfolioPackagePath = path.resolve(PORTFOLIO_DIR, 'package.json');
		expect(fs.existsSync(portfolioPackagePath)).toBe(true);
		
		const portfolioPackage = JSON.parse(fs.readFileSync(portfolioPackagePath, 'utf8'));
		
		// Check for blorkpack in dependencies
		expect(portfolioPackage.dependencies).toBeDefined();
		expect(portfolioPackage.dependencies['@littlecarlito/blorkpack']).toBeDefined();
		
		// Make sure there's a prebuild script that builds blorkpack
		expect(portfolioPackage.scripts).toBeDefined();
		expect(portfolioPackage.scripts.prebuild).toBeDefined();
		expect(portfolioPackage.scripts.prebuild).toContain('blorkpack');
		expect(portfolioPackage.scripts.prebuild).toContain('build');
	});
	
	test('main.js imports from blorkpack correctly', () => {
		const mainJsPath = path.resolve(PORTFOLIO_DIR, 'main.js');
		expect(fs.existsSync(mainJsPath)).toBe(true);
		
		const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
		
		// Check for correct import syntax from blorkpack
		expect(mainJsContent).toMatch(/@littlecarlito\/blorkpack/);
	});
});

// This test validates the build output if a build has already been run
// Skip the test if no dist directory exists (CI will build before testing)
(fs.existsSync(PORTFOLIO_DIST_DIR) ? describe : describe.skip)('Built output validation', () => {
	test('main JavaScript file exists in dist directory', () => {
		// Look for any JS file in the dist directory instead of specifically 'main.js'
		// With Vite's bundling, the main JS file might have a hash in its name
		const distFiles = fs.readdirSync(PORTFOLIO_DIST_DIR);
		const hasJsFile = distFiles.some(file => file.endsWith('.js'));
		expect(hasJsFile).toBe(true);
	});

	test('custom_types.json is copied to dist directory', () => {
		const customTypesDistPath = path.resolve(PORTFOLIO_DIST_DIR, 'custom_types.json');
		expect(fs.existsSync(customTypesDistPath)).toBe(true);
	});

	test('.nojekyll file exists in dist directory', () => {
		const nojekyllDistPath = path.resolve(PORTFOLIO_DIST_DIR, '.nojekyll');
		expect(fs.existsSync(nojekyllDistPath)).toBe(true);
	});

	test('_headers file is copied to dist directory', () => {
		const headersDistPath = path.resolve(PORTFOLIO_DIST_DIR, '_headers');
		expect(fs.existsSync(headersDistPath)).toBe(true);
	});
}); 