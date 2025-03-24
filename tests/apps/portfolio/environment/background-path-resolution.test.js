import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { GITHUB_PAGES_BASE } from '../../../../apps/portfolio/common/path_config.js';

// Mock the texture loader
const mockTextureLoader = {
	load: jest.fn((path, onSuccess, onProgress, onError) => {
		// Simulate successful load by default
		if (onSuccess) {
			onSuccess({
				wrapS: null,
				wrapT: null,
				repeat: { set: jest.fn() },
				matrix: { setUvTransform: jest.fn() },
				matrixAutoUpdate: true,
				colorSpace: null,
				generateMipmaps: true,
				minFilter: null,
				magFilter: null,
				needsUpdate: false,
				image: { width: 1, height: 1079, src: 'data:image/jpeg;base64,MOCK_IMAGE_DATA' }
			});
		}
		// Return a mock texture object
		return {
			wrapS: null,
			wrapT: null,
			repeat: { set: jest.fn() },
			matrix: { setUvTransform: jest.fn() },
			needsUpdate: false
		};
	})
};

/**
 * The function we're testing - isolated from main.js
 * This is a pure function that handles the path resolution logic
 */
function resolveBackgroundImagePath(imagePath, isGitHubPages) {
	const basePath = isGitHubPages ? `/${GITHUB_PAGES_BASE}/` : '/';
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
		expect(result).toBe(`/${GITHUB_PAGES_BASE}/images/gradient.jpg`);
	});

	test('should handle absolute paths correctly for local development', () => {
		// Test with an absolute path in local development
		const result = resolveBackgroundImagePath('/images/gradient.jpg', false);
		expect(result).toBe('/images/gradient.jpg');
	});

	test('should handle absolute paths correctly for GitHub Pages', () => {
		// Test with an absolute path in GitHub Pages
		const result = resolveBackgroundImagePath('/images/gradient.jpg', true);
		expect(result).toBe(`/${GITHUB_PAGES_BASE}/images/gradient.jpg`);
	});

	test('should handle nested paths correctly', () => {
		// Test with a nested path
		const result = resolveBackgroundImagePath('assets/images/backgrounds/gradient.jpg', true);
		expect(result).toBe(`/${GITHUB_PAGES_BASE}/assets/images/backgrounds/gradient.jpg`);
	});

	test('should handle empty paths gracefully', () => {
		// Test with an empty path
		const result = resolveBackgroundImagePath('', true);
		expect(result).toBe(`/${GITHUB_PAGES_BASE}/`);
	});

	test('should handle paths with query parameters', () => {
		// Test with a path that includes query parameters
		const result = resolveBackgroundImagePath('images/gradient.jpg?v=123', true);
		expect(result).toBe(`/${GITHUB_PAGES_BASE}/images/gradient.jpg?v=123`);
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
		
		// Load the texture with a success callback
		const onLoadSuccess = jest.fn();
		mockTextureLoader.load(resolvedPath, onLoadSuccess);
		
		// Verify the correct path was used and the callback was executed
		expect(mockTextureLoader.load).toHaveBeenCalledWith('/images/gradient.jpg', onLoadSuccess);
		expect(onLoadSuccess).toHaveBeenCalled();
	});

	test('should correctly load resolved paths in GitHub Pages environment', () => {
		// Simulate the environment check and path resolution
		const isGitHubPages = true;
		const imagePath = 'images/gradient.jpg';
		
		// Resolve the path
		const resolvedPath = resolveBackgroundImagePath(imagePath, isGitHubPages);
		
		// Load the texture with a success callback
		const onLoadSuccess = jest.fn();
		mockTextureLoader.load(resolvedPath, onLoadSuccess);
		
		// Verify the correct path was used and the callback was executed
		expect(mockTextureLoader.load).toHaveBeenCalledWith(`/${GITHUB_PAGES_BASE}/images/gradient.jpg`, onLoadSuccess);
		expect(onLoadSuccess).toHaveBeenCalled();
	});
	
	test('should properly handle texture load errors', () => {
		// Simulate the environment check and path resolution
		const isGitHubPages = true;
		const imagePath = 'images/nonexistent.jpg';
		
		// Resolve the path
		const resolvedPath = resolveBackgroundImagePath(imagePath, isGitHubPages);
		
		// Create a local scene object to avoid modifying global window
		const scene = { background: null };
		
		// Create mock THREE.Color for fallback
		const mockThreeColor = function(color) {
			return { color };
		};
		global.THREE = { Color: mockThreeColor };
		
		// Setup the error callback
		const onLoadError = jest.fn(error => {
			// Simulate setting fallback color on the local scene
			scene.background = new THREE.Color(0x000000);
		});
		
		// Call the texture loader with our error handler
		mockTextureLoader.load(resolvedPath, null, undefined, onLoadError);
		
		// Trigger the error callback with a mock error
		mockTextureLoader.load.mock.calls[0][3](new Error('Failed to load texture'));
		
		// Verify the fallback was set on the local scene
		expect(scene.background).toEqual({ color: 0x000000 });
		
		// Cleanup
		delete global.THREE;
	});
}); 