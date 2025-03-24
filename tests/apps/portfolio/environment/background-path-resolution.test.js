import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock the texture loader
const mockTextureLoader = {
	load: jest.fn()
};

/**
 * The function we're testing - isolated from main.js
 * This is a pure function that handles the path resolution logic
 */
function resolveBackgroundImagePath(imagePath, isGitHubPages) {
	const basePath = isGitHubPages ? '/threejs_site/' : '/';
	const normalizedPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
	return `${basePath}${normalizedPath}`;
}

describe('Background Image Path Resolution Function', () => {
	beforeEach(() => {
		// Reset the mock
		mockTextureLoader.load.mockClear();
	});

	test('should resolve relative paths correctly for local development', () => {
		// Test with a relative path in local development
		const result = resolveBackgroundImagePath('images/gradient.jpg', false);
		expect(result).toBe('/images/gradient.jpg');
	});

	test('should resolve relative paths correctly for GitHub Pages', () => {
		// Test with a relative path in GitHub Pages
		const result = resolveBackgroundImagePath('images/gradient.jpg', true);
		expect(result).toBe('/threejs_site/images/gradient.jpg');
	});

	test('should handle absolute paths correctly for local development', () => {
		// Test with an absolute path in local development
		const result = resolveBackgroundImagePath('/images/gradient.jpg', false);
		expect(result).toBe('/images/gradient.jpg');
	});

	test('should handle absolute paths correctly for GitHub Pages', () => {
		// Test with an absolute path in GitHub Pages
		const result = resolveBackgroundImagePath('/images/gradient.jpg', true);
		expect(result).toBe('/threejs_site/images/gradient.jpg');
	});

	test('should handle nested paths correctly', () => {
		// Test with a nested path
		const result = resolveBackgroundImagePath('assets/images/backgrounds/gradient.jpg', true);
		expect(result).toBe('/threejs_site/assets/images/backgrounds/gradient.jpg');
	});

	test('should handle empty paths gracefully', () => {
		// Test with an empty path
		const result = resolveBackgroundImagePath('', true);
		expect(result).toBe('/threejs_site/');
	});

	test('should handle paths with query parameters', () => {
		// Test with a path that includes query parameters
		const result = resolveBackgroundImagePath('images/gradient.jpg?v=123', true);
		expect(result).toBe('/threejs_site/images/gradient.jpg?v=123');
	});
});

// Integration test with the texture loader
describe('Background Image Path Resolution Integration', () => {
	beforeEach(() => {
		// Reset the mock
		mockTextureLoader.load.mockClear();
	});

	test('should correctly load resolved paths in local environment', () => {
		// Simulate the environment check and path resolution
		const isGitHubPages = false;
		const imagePath = 'images/gradient.jpg';
    
		// Resolve the path
		const resolvedPath = resolveBackgroundImagePath(imagePath, isGitHubPages);
    
		// Load the texture
		mockTextureLoader.load(resolvedPath);
    
		// Verify the correct path was used
		expect(mockTextureLoader.load).toHaveBeenCalledWith('/images/gradient.jpg');
	});

	test('should correctly load resolved paths in GitHub Pages environment', () => {
		// Simulate the environment check and path resolution
		const isGitHubPages = true;
		const imagePath = 'images/gradient.jpg';
    
		// Resolve the path
		const resolvedPath = resolveBackgroundImagePath(imagePath, isGitHubPages);
    
		// Load the texture
		mockTextureLoader.load(resolvedPath);
    
		// Verify the correct path was used
		expect(mockTextureLoader.load).toHaveBeenCalledWith('/threejs_site/images/gradient.jpg');
	});
}); 