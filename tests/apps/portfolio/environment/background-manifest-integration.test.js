import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock THREE.js
const mockThree = {
	Scene: jest.fn(() => ({
		background: null
	})),
	Color: jest.fn((color) => ({ color }))
};

// Mock texture loader
const mockTextureLoader = {
	load: jest.fn((path) => ({ path }))
};

// Mock manifest manager
const mockManifestManager = {
	get_background_config: jest.fn(() => ({
		type: 'IMAGE',
		image_path: 'images/gradient.jpg'
	}))
};

/**
 * The function we're testing - simulating the background setup from main.js
 */
function setupBackground(isGitHubPages) {
	const scene = new mockThree.Scene();
	const manifestManager = mockManifestManager;
  
	// Get background config from manifest manager
	const bg = manifestManager.get_background_config();
  
	switch (bg.type) {
	case 'IMAGE': {
		// This is the code we're testing
		const basePath = isGitHubPages ? '/threejs_site/' : '/';
		const imagePath = bg.image_path.startsWith('/') ? bg.image_path.substring(1) : bg.image_path;
		const fullImagePath = `${basePath}${imagePath}`;
		scene.background = mockTextureLoader.load(fullImagePath);
		break;
	}
	case 'COLOR':
		scene.background = new mockThree.Color(bg.color_value);
		break;
	default:
		scene.background = new mockThree.Color('0x000000');
	}
  
	return scene;
}

describe('Background Setup Integration with Manifest', () => {
	beforeEach(() => {
		// Reset mocks
		mockThree.Scene.mockClear();
		mockThree.Color.mockClear();
		mockTextureLoader.load.mockClear();
		mockManifestManager.get_background_config.mockClear();
	});
  
	test('should load background image with correct path in local environment', () => {
		// Setup local environment
		const isGitHubPages = false;
    
		// Execute the function
		const scene = setupBackground(isGitHubPages);
    
		// Verify manifest was queried
		expect(mockManifestManager.get_background_config).toHaveBeenCalled();
    
		// Verify texture loader was called with correct path
		expect(mockTextureLoader.load).toHaveBeenCalledWith('/images/gradient.jpg');
    
		// Verify scene background was set
		expect(scene.background).toEqual({ path: '/images/gradient.jpg' });
	});
  
	test('should load background image with correct path in GitHub Pages environment', () => {
		// Setup GitHub Pages environment
		const isGitHubPages = true;
    
		// Execute the function
		const scene = setupBackground(isGitHubPages);
    
		// Verify manifest was queried
		expect(mockManifestManager.get_background_config).toHaveBeenCalled();
    
		// Verify texture loader was called with correct path
		expect(mockTextureLoader.load).toHaveBeenCalledWith('/threejs_site/images/gradient.jpg');
    
		// Verify scene background was set
		expect(scene.background).toEqual({ path: '/threejs_site/images/gradient.jpg' });
	});
  
	test('should handle COLOR type background', () => {
		// Mock manifest to return a color background
		mockManifestManager.get_background_config.mockReturnValueOnce({
			type: 'COLOR',
			color_value: '0x123456'
		});
    
		// Execute the function
		const scene = setupBackground(false);
    
		// Verify Color constructor was called with correct value
		expect(mockThree.Color).toHaveBeenCalledWith('0x123456');
    
		// Verify texture loader was NOT called
		expect(mockTextureLoader.load).not.toHaveBeenCalled();
	});
  
	test('should handle absolute paths in GitHub Pages environment', () => {
		// Mock manifest to return a background with absolute path
		mockManifestManager.get_background_config.mockReturnValueOnce({
			type: 'IMAGE',
			image_path: '/images/gradient.jpg'
		});
    
		// Setup GitHub Pages environment
		const isGitHubPages = true;
    
		// Execute the function
		const scene = setupBackground(isGitHubPages);
    
		// Verify texture loader was called with correct path
		expect(mockTextureLoader.load).toHaveBeenCalledWith('/threejs_site/images/gradient.jpg');
	});
  
	test('should handle invalid background type by using default color', () => {
		// Mock manifest to return an invalid background type
		mockManifestManager.get_background_config.mockReturnValueOnce({
			type: 'INVALID_TYPE'
		});
    
		// Execute the function
		const scene = setupBackground(false);
    
		// Verify default color was used
		expect(mockThree.Color).toHaveBeenCalledWith('0x000000');
    
		// Verify texture loader was NOT called
		expect(mockTextureLoader.load).not.toHaveBeenCalled();
	});
}); 