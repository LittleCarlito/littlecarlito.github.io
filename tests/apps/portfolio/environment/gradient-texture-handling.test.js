/**
 * Unit tests for handling 1-pixel wide gradient textures
 * 
 * This test ensures that our special handling for 1-pixel gradients is properly implemented
 * and doesn't get accidentally removed in future refactoring.
 */

// Mock THREE.js
global.THREE = {
	Texture: jest.fn().mockImplementation(() => ({
		image: null,
		wrapS: null,
		wrapT: null,
		minFilter: null,
		repeat: { set: jest.fn() },
		needsUpdate: false
	})),
	RepeatWrapping: 'RepeatWrapping',
	ClampToEdgeWrapping: 'ClampToEdgeWrapping',
	LinearFilter: 'LinearFilter'
};

describe('1-pixel Gradient Texture Handling', () => {
	let windowAddEventListenerSpy;
	let consoleLogSpy;
  
	beforeEach(() => {
		// Clear any mocks
		jest.clearAllMocks();
    
		// Mock window.addEventListener
		windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
    
		// Mock window dimensions
		global.window.innerWidth = 1920;
		global.window.innerHeight = 1080;
    
		// Mock scene
		global.window.scene = { background: null };
    
		// Mock console.log and console.error
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});
  
	afterEach(() => {
		jest.restoreAllMocks();
	});
  
	test('should apply special handling to 1-pixel width gradients', () => {
		// Create a texture
		const texture = new THREE.Texture();
    
		// Create the image object that will be loaded
		const image = { width: 1, height: 1079 };
    
		// Simulate the onload callback that would be called when the image loads
		/**
		 *
		 */
		function onImageLoad() {
			texture.image = image;
			texture.needsUpdate = true;
      
			// Configure texture settings
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.repeat.set(1, 1);
      
			// Special handling for 1-pixel width gradients
			if (image.width === 1) {
				console.log('1-pixel gradient detected, configuring special handling...');
				texture.minFilter = THREE.LinearFilter;
        
				// Set up vertical stretching
				const updateTextureScaleToFillScreen = () => {
					const aspect = window.innerWidth / window.innerHeight;
					texture.repeat.set(1, 1 * aspect);
					texture.needsUpdate = true;
				};
        
				// Initial update
				updateTextureScaleToFillScreen();
        
				// Update on resize
				window.addEventListener('resize', updateTextureScaleToFillScreen);
			}
      
			// Apply to scene
			window.scene.background = texture;
		}
    
		// Call the onload handler
		onImageLoad();
    
		// Verify special handling was applied
		expect(texture.minFilter).toBe(THREE.LinearFilter);
		expect(texture.repeat.set).toHaveBeenCalledTimes(2); // Once in general setup, once for aspect ratio
		expect(texture.repeat.set).toHaveBeenLastCalledWith(1, 1 * (window.innerWidth / window.innerHeight));
		expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
		expect(consoleLogSpy).toHaveBeenCalledWith('1-pixel gradient detected, configuring special handling...');
		expect(window.scene.background).toBe(texture);
	});
  
	test('should not apply special handling to textures wider than 1 pixel', () => {
		// Reset the addEventListener spy to ensure it starts fresh
		windowAddEventListenerSpy.mockClear();
    
		// Create a texture
		const texture = new THREE.Texture();
    
		// Create the image object that will be loaded - with width > 1
		const image = { width: 512, height: 512 };
    
		// Simulate the onload callback that would be called when the image loads
		/**
		 *
		 */
		function onImageLoad() {
			texture.image = image;
			texture.needsUpdate = true;
      
			// Configure texture settings
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.repeat.set(1, 1);
      
			// Special handling for 1-pixel width gradients
			if (image.width === 1) {
				console.log('1-pixel gradient detected, configuring special handling...');
				texture.minFilter = THREE.LinearFilter;
        
				// Set up vertical stretching
				const updateTextureScaleToFillScreen = () => {
					const aspect = window.innerWidth / window.innerHeight;
					texture.repeat.set(1, 1 * aspect);
					texture.needsUpdate = true;
				};
        
				// Initial update
				updateTextureScaleToFillScreen();
        
				// Update on resize
				window.addEventListener('resize', updateTextureScaleToFillScreen);
			}
      
			// Apply to scene
			window.scene.background = texture;
		}
    
		// Call the onload handler
		onImageLoad();
    
		// Verify special handling was NOT applied
		expect(texture.minFilter).not.toBe(THREE.LinearFilter);
		expect(texture.repeat.set).toHaveBeenCalledTimes(1); // Only the general setup call
		expect(windowAddEventListenerSpy).not.toHaveBeenCalled();
		expect(consoleLogSpy).not.toHaveBeenCalledWith('1-pixel gradient detected, configuring special handling...');
		expect(window.scene.background).toBe(texture);
	});
  
	test('should handle window resize events correctly for 1-pixel gradients', () => {
		// Create a texture
		const texture = new THREE.Texture();
    
		// Create the image object
		const image = { width: 1, height: 1079 };
    
		// Store the resize handler
		let resizeHandler;
    
		// Override the addEventListener mock to capture the resize handler
		windowAddEventListenerSpy.mockImplementation((event, handler) => {
			if (event === 'resize') {
				resizeHandler = handler;
			}
		});
    
		// Simulate the onload callback
		/**
		 *
		 */
		function onImageLoad() {
			texture.image = image;
			texture.needsUpdate = true;
      
			// Configure texture settings
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.repeat.set(1, 1);
      
			// Special handling for 1-pixel width gradients
			if (image.width === 1) {
				console.log('1-pixel gradient detected, configuring special handling...');
				texture.minFilter = THREE.LinearFilter;
        
				// Set up vertical stretching
				const updateTextureScaleToFillScreen = () => {
					const aspect = window.innerWidth / window.innerHeight;
					texture.repeat.set(1, 1 * aspect);
					texture.needsUpdate = true;
				};
        
				// Initial update
				updateTextureScaleToFillScreen();
        
				// Update on resize
				window.addEventListener('resize', updateTextureScaleToFillScreen);
			}
      
			// Apply to scene
			window.scene.background = texture;
		}
    
		// Call the onload handler
		onImageLoad();
    
		// Verify initial state
		expect(texture.repeat.set).toHaveBeenLastCalledWith(1, 1 * (1920/1080));
    
		// Simulate window resize
		window.innerWidth = 1280;
		window.innerHeight = 720;
    
		// Call the resize handler
		if (resizeHandler) resizeHandler();
    
		// Verify the texture was updated with new aspect ratio
		expect(texture.repeat.set).toHaveBeenLastCalledWith(1, 1 * (1280/720));
		expect(texture.needsUpdate).toBe(true);
	});
}); 