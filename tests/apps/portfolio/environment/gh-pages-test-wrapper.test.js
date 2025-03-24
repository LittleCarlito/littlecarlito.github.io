/**
 * Test wrapper for GitHub Pages texture test
 * 
 * This test doesn't actually run the GitHub Pages texture test,
 * it just checks that the script exists and is accessible.
 * 
 * The actual texture test should be run using the npm scripts:
 * - pnpm gh-pages:test (interactive)
 * - pnpm gh-pages:check (headless/CI)
 */

const fs = require('fs');
const path = require('path');

describe('GitHub Pages Texture Test', () => {
	const testScriptPath = path.resolve(__dirname, 'gh-pages-texture-test.js');
	const serverScriptPath = path.resolve(__dirname, '../../portfolio/gh-pages-simulator.js');
  
	test('test script exists', () => {
		expect(fs.existsSync(testScriptPath)).toBe(true);
	});
  
	test('server script exists', () => {
		expect(fs.existsSync(serverScriptPath)).toBe(true);
	});
  
	test('scripts are accessible', () => {
		expect(() => {
			fs.accessSync(testScriptPath, fs.constants.R_OK);
			fs.accessSync(serverScriptPath, fs.constants.R_OK);
		}).not.toThrow();
	});
  
	test('texture test is implemented', () => {
		const content = fs.readFileSync(testScriptPath, 'utf8');
		expect(content).toContain('testGitHubPagesTextureLoading');
		expect(content).toContain('puppeteer');
	});
  
	test('server script is implemented', () => {
		const content = fs.readFileSync(serverScriptPath, 'utf8');
		expect(content).toContain('createServer');
		expect(content).toContain('listen');
	});
  
	test('gh-pages:check npm script exists', () => {
		const packageJson = JSON.parse(
			fs.readFileSync(path.resolve(__dirname, '../../../../package.json'), 'utf8')
		);
		expect(packageJson.scripts['gh-pages:check']).toBeDefined();
		expect(packageJson.scripts['gh-pages:check']).toContain('gh-pages-texture-test.js');
	});
  
	test('texture test should be run via npm scripts, not Jest', () => {
		console.log('To run the GitHub Pages texture test: pnpm gh-pages:check');
		expect(true).toBe(true);
	});
}); 