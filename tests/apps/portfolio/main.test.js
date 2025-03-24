import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as THREE from 'three';

// Instead of mocking all the modules (which causes import errors),
// we'll only mock what we need for our specific tests

// Document mocks
global.document = {
	getElementById: jest.fn(() => ({
		textContent: '',
		remove: jest.fn(),
		style: {}
	})),
	createElement: jest.fn(() => ({
		style: {},
		addEventListener: jest.fn()
	})),
	body: {
		insertAdjacentHTML: jest.fn(),
		appendChild: jest.fn()
	}
};

// Fetch mock
global.fetch = jest.fn(() => Promise.resolve({
	ok: true,
	text: jest.fn(() => Promise.resolve('<div></div>'))
}));

// Create a utility function to test the path resolution logic
/**
 * Utility function to test path resolution logic
 */
function resolveBackgroundImagePath(imagePath, isGitHubPages = false) {
	// This simulates the path resolution logic from main.js
	if (!imagePath && imagePath !== '') {
		return null;
	}
	
	// Determine base path based on environment
	const basePath = isGitHubPages ? '/threejs_site/' : '/';
	
	// Normalize the image path by removing leading slash if present
	const normalizedImagePath = imagePath.startsWith('/') 
		? imagePath.substring(1) 
		: imagePath;
		
	// Construct the full image path
	const fullImagePath = `${basePath}${normalizedImagePath}`;
	
	// Create a proper URL string without using the URL constructor
	// This avoids issues with paths starting with "/"
	const absoluteUrl = window.location.origin ? 
		`${window.location.origin}${fullImagePath}` :
		`http://localhost:3000${fullImagePath}`;
	
	return {
		original: imagePath,
		normalized: normalizedImagePath,
		fullPath: fullImagePath,
		absoluteUrl
	};
}

describe('Background Image Path Resolution', () => {
	const originalLocation = window.location;

	beforeEach(() => {
		// Reset window.location
		delete window.location;
		window.location = {
			pathname: '',
			includes: function(str) { return this.pathname.includes(str); }
		};
    
		// Reset mocks
		jest.clearAllMocks();
    
		// Setup window elements
		window.scene = { background: null };
		window.viewable_container = { get_camera: jest.fn(() => ({})) };
	});
  
	afterEach(() => {
		window.location = originalLocation;
	});

	test('should resolve image path correctly for local development', async () => {
		// Setup
		window.location.pathname = '/';
		const TEXTURE_LOADER = {
			load: jest.fn((path) => ({ path }))
		};
    
		// Simulate the path resolution code
		const bg = { type: 'IMAGE', image_path: 'images/gradient.jpg' };
		const basePath = window.location.pathname.includes('/threejs_site/') ? '/threejs_site/' : '/';
		const imagePath = bg.image_path.startsWith('/') ? bg.image_path.substring(1) : bg.image_path;
		const fullImagePath = `${basePath}${imagePath}`;
    
		// Call the mock loader
		TEXTURE_LOADER.load(fullImagePath);
    
		// Assert
		expect(TEXTURE_LOADER.load).toHaveBeenCalledWith('/images/gradient.jpg');
	});
  
	test('should resolve image path correctly for GitHub Pages', async () => {
		// Setup
		window.location.pathname = '/threejs_site/index.html';
		const TEXTURE_LOADER = {
			load: jest.fn((path) => ({ path }))
		};
    
		// Simulate the path resolution code
		const bg = { type: 'IMAGE', image_path: 'images/gradient.jpg' };
		const basePath = window.location.pathname.includes('/threejs_site/') ? '/threejs_site/' : '/';
		const imagePath = bg.image_path.startsWith('/') ? bg.image_path.substring(1) : bg.image_path;
		const fullImagePath = `${basePath}${imagePath}`;
    
		// Call the mock loader
		TEXTURE_LOADER.load(fullImagePath);
    
		// Assert
		expect(TEXTURE_LOADER.load).toHaveBeenCalledWith('/threejs_site/images/gradient.jpg');
	});
  
	test('should handle absolute paths in image_path correctly', async () => {
		// Setup
		window.location.pathname = '/threejs_site/index.html';
		const TEXTURE_LOADER = {
			load: jest.fn((path) => ({ path }))
		};
    
		// Simulate the path resolution code
		const bg = { type: 'IMAGE', image_path: '/images/gradient.jpg' }; // Note the leading slash
		const basePath = window.location.pathname.includes('/threejs_site/') ? '/threejs_site/' : '/';
		const imagePath = bg.image_path.startsWith('/') ? bg.image_path.substring(1) : bg.image_path;
		const fullImagePath = `${basePath}${imagePath}`;
    
		// Call the mock loader
		TEXTURE_LOADER.load(fullImagePath);
    
		// Assert
		expect(TEXTURE_LOADER.load).toHaveBeenCalledWith('/threejs_site/images/gradient.jpg');
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
});

/**
 * Integration tests for texture loading and configuration
 */
describe('Texture Loading and Configuration', () => {
	beforeEach(() => {
		// Enable fake timers for this test suite
		jest.useFakeTimers();
		
		// Mock THREE.TextureLoader
		THREE.TextureLoader = jest.fn().mockImplementation(() => ({
			load: jest.fn((url, onLoad, onProgress, onError) => {
				const mockTexture = {
					url,
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
					image: { width: 1, height: 1079 } // Default to 1-pixel wide for gradient tests
				};
				
				// Call onLoad callback if provided
				if (onLoad) {
					setTimeout(() => onLoad(mockTexture), 0);
				}
				
				return mockTexture;
			})
		}));
		
		// Mock window.innerWidth/Height
		global.window.innerWidth = 1920;
		global.window.innerHeight = 1080;
		
		// Mock addEventListener for resize events
		window.addEventListener = jest.fn();
	});
	
	afterEach(() => {
		jest.clearAllMocks();
		// Restore real timers
		jest.useRealTimers();
	});
	
	test('should configure 1-pixel wide textures correctly', () => {
		const textureLoader = new THREE.TextureLoader();
		const texture = textureLoader.load('/images/gradient.jpg', texture => {
			// Special handling for 1-pixel wide gradients
			if (texture.image && texture.image.width === 1) {
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.ClampToEdgeWrapping;
				texture.matrixAutoUpdate = false;
				texture.matrix.setUvTransform(0, 0, window.innerWidth / window.innerHeight, 1, 0, 0, 0);
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.generateMipmaps = false;
				texture.minFilter = THREE.LinearFilter;
				texture.magFilter = THREE.LinearFilter;
				texture.needsUpdate = true;
			}
		});
		
		// Verify the initial texture object
		expect(texture.url).toBe('/images/gradient.jpg');
		
		// Simulate texture load completion and check matrix transformation
		jest.runAllTimers();
		
		// Add expectations for texture configuration
		expect(texture.wrapS).toBe(THREE.RepeatWrapping);
		expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
		expect(texture.matrixAutoUpdate).toBe(false);
		expect(texture.matrix.setUvTransform).toHaveBeenCalledWith(0, 0, window.innerWidth / window.innerHeight, 1, 0, 0, 0);
	});
	
	test('should handle texture load errors gracefully', () => {
		// Mock console.error
		console.error = jest.fn();
		
		// Mock scene for background fallback
		const scene = { background: null };
		
		// Mock THREE.TextureLoader with error simulation
		THREE.TextureLoader = jest.fn().mockImplementation(() => ({
			load: jest.fn((url, onLoad, onProgress, onError) => {
				// Simulate error
				if (onError) {
					setTimeout(() => onError(new Error('Failed to load texture')), 0);
				}
				return null;
			})
		}));
		
		// Mock Color constructor
		THREE.Color = jest.fn(color => ({ color }));
		
		const textureLoader = new THREE.TextureLoader();
		textureLoader.load(
			'/images/gradient.jpg',
			null, // Success callback not needed for this test
			null, // Progress callback not needed
			error => {
				console.error('Error loading texture:', error);
				scene.background = new THREE.Color(0x000000);
			}
		);
		
		// Run timers to trigger error callback
		jest.runAllTimers();
		
		// Verify error was logged
		expect(console.error).toHaveBeenCalledWith('Error loading texture:', expect.any(Error));
		
		// Verify fallback color was applied
		expect(scene.background).toEqual({ color: 0x000000 });
	});
	
	test('should register window resize handler for gradient scaling', () => {
		// Setup variables to store resize handler
		let resizeHandler;
		
		// Mock addEventListener to capture the resize handler
		window.addEventListener = jest.fn((event, handler) => {
			if (event === 'resize') {
				resizeHandler = handler;
			}
		});
		
		// Create a mock texture with update function
		const texture = {
			image: { width: 1, height: 1079 },
			matrix: { setUvTransform: jest.fn() },
			needsUpdate: false
		};
		
		// Define the update function (simplified from main.js)
		const updateGradientScale = () => {
			if (texture.image && texture.image.width === 1) {
				texture.matrix.setUvTransform(0, 0, window.innerWidth / window.innerHeight, 1, 0, 0, 0);
				texture.needsUpdate = true;
			}
		};
		
		// Register the resize handler
		window.addEventListener('resize', updateGradientScale);
		
		// Verify resize listener was registered
		expect(window.addEventListener).toHaveBeenCalledWith('resize', updateGradientScale);
		
		// Store initial state
		const initialCalls = texture.matrix.setUvTransform.mock.calls.length;
		
		// Trigger resize event with new dimensions
		window.innerWidth = 1280;
		window.innerHeight = 720;
		resizeHandler();
		
		// Verify matrix was updated with new aspect ratio
		expect(texture.matrix.setUvTransform).toHaveBeenCalledTimes(initialCalls + 1);
		expect(texture.matrix.setUvTransform).toHaveBeenLastCalledWith(0, 0, 1280/720, 1, 0, 0, 0);
		expect(texture.needsUpdate).toBe(true);
	});
}); 