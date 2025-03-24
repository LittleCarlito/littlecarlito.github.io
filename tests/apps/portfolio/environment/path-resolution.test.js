import { describe, test, expect, beforeEach } from '@jest/globals';
import { GITHUB_PAGES_BASE } from '../../../../apps/portfolio/common/path_config.js';

/**
 * Utility function to test image path resolution
 * 
 * @param {string} imagePath - Path to the image (relative or absolute)
 * @param {boolean} isGitHubPages - Whether the environment is GitHub Pages
 * @returns {Object} - Object containing path resolution details
 */
function resolveBackgroundImagePath(imagePath, isGitHubPages = false) {
	if (!imagePath && imagePath !== '') {
		return null;
	}
  
	// Determine base path based on environment
	const basePath = isGitHubPages ? `/${GITHUB_PAGES_BASE}/` : '/';
  
	// Normalize the image path by removing leading slash if present
	const normalizedImagePath = imagePath.startsWith('/') 
		? imagePath.substring(1) 
		: imagePath;
    
	// Construct the full image path
	const fullImagePath = `${basePath}${normalizedImagePath}`;
  
	// Create absolute URL if needed
	const absoluteUrl = new URL(fullImagePath, window.location.origin).href;
  
	return {
		original: imagePath,
		normalized: normalizedImagePath,
		fullPath: fullImagePath,
		absoluteUrl
	};
}

describe('Background Image Path Resolution', () => {
	beforeEach(() => {
		// Setup window.location mock
		Object.defineProperty(window, 'location', {
			value: {
				origin: 'http://localhost:3000',
				pathname: '/',
				search: '',
				hash: ''
			},
			writable: true
		});
	});
  
	test('should correctly resolve a relative path in local environment', () => {
		const imagePath = 'images/gradient.jpg';
		const result = resolveBackgroundImagePath(imagePath, false);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: imagePath,
			fullPath: '/images/gradient.jpg',
			absoluteUrl: 'http://localhost:3000/images/gradient.jpg'
		});
	});
  
	test('should correctly resolve an absolute path in local environment', () => {
		const imagePath = '/images/gradient.jpg';
		const result = resolveBackgroundImagePath(imagePath, false);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: 'images/gradient.jpg',
			fullPath: '/images/gradient.jpg',
			absoluteUrl: 'http://localhost:3000/images/gradient.jpg'
		});
	});
  
	test('should correctly resolve a relative path in GitHub Pages environment', () => {
		const imagePath = 'images/gradient.jpg';
		const result = resolveBackgroundImagePath(imagePath, true);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: imagePath,
			fullPath: '/threejs_site/images/gradient.jpg',
			absoluteUrl: 'http://localhost:3000/threejs_site/images/gradient.jpg'
		});
	});
  
	test('should correctly resolve an absolute path in GitHub Pages environment', () => {
		const imagePath = '/images/gradient.jpg';
		const result = resolveBackgroundImagePath(imagePath, true);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: 'images/gradient.jpg',
			fullPath: '/threejs_site/images/gradient.jpg',
			absoluteUrl: 'http://localhost:3000/threejs_site/images/gradient.jpg'
		});
	});
  
	test('should handle nested paths correctly', () => {
		const imagePath = 'assets/textures/gradients/blue-gradient.jpg';
		const result = resolveBackgroundImagePath(imagePath, true);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: imagePath,
			fullPath: '/threejs_site/assets/textures/gradients/blue-gradient.jpg',
			absoluteUrl: 'http://localhost:3000/threejs_site/assets/textures/gradients/blue-gradient.jpg'
		});
	});
  
	test('should handle empty paths', () => {
		const result = resolveBackgroundImagePath('', false);
    
		expect(result).toEqual({
			original: '',
			normalized: '',
			fullPath: '/',
			absoluteUrl: 'http://localhost:3000/'
		});
	});
  
	test('should handle paths with query parameters', () => {
		const imagePath = 'images/gradient.jpg?v=123';
		const result = resolveBackgroundImagePath(imagePath, false);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: imagePath,
			fullPath: '/images/gradient.jpg?v=123',
			absoluteUrl: 'http://localhost:3000/images/gradient.jpg?v=123'
		});
	});
  
	test('should handle paths with both query parameters and hash', () => {
		const imagePath = 'images/gradient.jpg?v=123#section1';
		const result = resolveBackgroundImagePath(imagePath, true);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: imagePath,
			fullPath: '/threejs_site/images/gradient.jpg?v=123#section1',
			absoluteUrl: 'http://localhost:3000/threejs_site/images/gradient.jpg?v=123#section1'
		});
	});
  
	test('should handle null or undefined paths', () => {
		expect(resolveBackgroundImagePath(null, false)).toBeNull();
		expect(resolveBackgroundImagePath(undefined, false)).toBeNull();
	});
  
	test('should handle paths when window.location.pathname has nested directories', () => {
		// Mock window.location with a nested pathname
		Object.defineProperty(window, 'location', {
			value: {
				origin: 'http://localhost:3000',
				pathname: '/portfolio/project1/',
				search: '',
				hash: ''
			},
			writable: true
		});
    
		const imagePath = 'images/gradient.jpg';
		const result = resolveBackgroundImagePath(imagePath, false);
    
		expect(result).toEqual({
			original: imagePath,
			normalized: imagePath,
			fullPath: '/images/gradient.jpg',
			absoluteUrl: 'http://localhost:3000/images/gradient.jpg'
		});
	});
}); 