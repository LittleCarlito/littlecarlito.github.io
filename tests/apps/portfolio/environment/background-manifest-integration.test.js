import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { GITHUB_PAGES_BASE } from '../../../../apps/portfolio/common/path_config.js';

// Mock THREE.js
const mockThree = {
	Scene: jest.fn(() => ({
		background: null
	})),
	Color: jest.fn((color) => ({ color })),
	RepeatWrapping: 'RepeatWrapping',
	ClampToEdgeWrapping: 'ClampToEdgeWrapping', 
	SRGBColorSpace: 'srgb',
	LinearFilter: 'LinearFilter'
};

// Mock texture loader with success callback support
const mockTextureLoader = {
	load: jest.fn((path, onSuccess, onProgress, onError) => {
		const mockTexture = {
			path,
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
			isTexture: true,
			image: { width: 1, height: 1079, src: 'data:image/jpeg;base64,MOCK_IMAGE_DATA' }
		};
		
		// Call success callback if provided
		if (onSuccess) {
			onSuccess(mockTexture);
		}
		
		return mockTexture;
	})
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
		// Path resolution
		const basePath = isGitHubPages ? `/${GITHUB_PAGES_BASE}/` : '/';
		const imagePath = bg.image_path.startsWith('/') ? bg.image_path.substring(1) : bg.image_path;
		const fullImagePath = `${basePath}${imagePath}`;
		
		// Load texture with callback handling
		const texture = mockTextureLoader.load(
			fullImagePath,
			// Success callback
			(loadedTexture) => {
				// Configure texture settings for optimal display
				loadedTexture.wrapS = mockThree.RepeatWrapping;
				loadedTexture.wrapT = mockThree.ClampToEdgeWrapping;
				loadedTexture.repeat.set(1, 1);
				
				// Special handling for 1-pixel wide gradients
				if (loadedTexture.image && loadedTexture.image.width === 1) {
					loadedTexture.matrixAutoUpdate = false;
					loadedTexture.matrix.setUvTransform(0, 0, window.innerWidth / window.innerHeight, 1, 0, 0, 0);
				}
				
				// Apply additional settings
				loadedTexture.colorSpace = mockThree.SRGBColorSpace;
				loadedTexture.generateMipmaps = false;
				loadedTexture.minFilter = mockThree.LinearFilter;
				loadedTexture.magFilter = mockThree.LinearFilter;
				loadedTexture.needsUpdate = true;
			},
			undefined,
			// Error callback
			(error) => {
				scene.background = new mockThree.Color('0x000000');
			}
		);
		
		scene.background = texture;
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
		
		// Mock window.innerWidth and innerHeight for tests
		global.window = {
			innerWidth: 1920,
			innerHeight: 1080
		};
	});
  
	afterEach(() => {
		// Clean up global mocks
		delete global.window;
	});
  
	test('should load background image with correct path in local environment', () => {
		// Setup local environment
		const isGitHubPages = false;
    
		// Execute the function
		const scene = setupBackground(isGitHubPages);
    
		// Verify manifest was queried
		expect(mockManifestManager.get_background_config).toHaveBeenCalled();
    
		// Verify texture loader was called with correct path and callbacks
		expect(mockTextureLoader.load).toHaveBeenCalledWith(
			'/images/gradient.jpg',
			expect.any(Function),
			undefined,
			expect.any(Function)
		);
    
		// Get the success callback that was passed to load
		const successCallback = mockTextureLoader.load.mock.calls[0][1];
    
		// Create a mock texture to pass to the callback
		const mockTexture = {
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
			image: { width: 1, height: 1079 }
		};
    
		// Call the success callback
		successCallback(mockTexture);
    
		// Verify texture was configured correctly
		expect(mockTexture.wrapS).toBe(mockThree.RepeatWrapping);
		expect(mockTexture.wrapT).toBe(mockThree.ClampToEdgeWrapping);
		expect(mockTexture.repeat.set).toHaveBeenCalledWith(1, 1);
		expect(mockTexture.matrixAutoUpdate).toBe(false);
		expect(mockTexture.matrix.setUvTransform).toHaveBeenCalledWith(0, 0, window.innerWidth / window.innerHeight, 1, 0, 0, 0);
		expect(mockTexture.colorSpace).toBe(mockThree.SRGBColorSpace);
		expect(mockTexture.generateMipmaps).toBe(false);
		expect(mockTexture.minFilter).toBe(mockThree.LinearFilter);
		expect(mockTexture.magFilter).toBe(mockThree.LinearFilter);
		expect(mockTexture.needsUpdate).toBe(true);
    
		// Verify scene background was set
		expect(scene.background).toEqual(expect.objectContaining({
			path: '/images/gradient.jpg'
		}));
	});
  
	test('should load background image with correct path in GitHub Pages environment', () => {
		// Setup GitHub Pages environment
		const isGitHubPages = true;
    
		// Execute the function
		const scene = setupBackground(isGitHubPages);
    
		// Verify texture loader was called with correct path
		expect(mockTextureLoader.load).toHaveBeenCalledWith(
			'/threejs_site/images/gradient.jpg',
			expect.any(Function),
			undefined,
			expect.any(Function)
		);
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
		expect(mockTextureLoader.load).toHaveBeenCalledWith(
			'/threejs_site/images/gradient.jpg',
			expect.any(Function),
			undefined,
			expect.any(Function)
		);
	});
  
	test('should handle texture load errors by using fallback color', () => {
		// Setup
		const isGitHubPages = false;
    
		// Execute the function
		const scene = setupBackground(isGitHubPages);
    
		// Get the error callback that was passed to load
		const errorCallback = mockTextureLoader.load.mock.calls[0][3];
    
		// Call the error callback with a mock error
		errorCallback(new Error('Failed to load texture'));
    
		// Verify fallback color was used
		expect(mockThree.Color).toHaveBeenCalledWith('0x000000');
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
  
	test('should handle standard size images appropriately', () => {
		// Setup local environment
		const isGitHubPages = false;
    
		// Execute the function
		setupBackground(isGitHubPages);
    
		// Get the success callback
		const successCallback = mockTextureLoader.load.mock.calls[0][1];
    
		// Create a mock texture with a standard size image (not 1-pixel wide)
		const mockTexture = {
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
			image: { width: 1024, height: 1024 }
		};
    
		// Call the success callback
		successCallback(mockTexture);
    
		// Verify standard settings were applied but not the special 1-pixel mapping
		expect(mockTexture.wrapS).toBe(mockThree.RepeatWrapping);
		expect(mockTexture.wrapT).toBe(mockThree.ClampToEdgeWrapping);
		expect(mockTexture.repeat.set).toHaveBeenCalledWith(1, 1);
		expect(mockTexture.matrixAutoUpdate).toBe(true); // Should remain true for standard images
		expect(mockTexture.matrix.setUvTransform).not.toHaveBeenCalled();
	});
}); 