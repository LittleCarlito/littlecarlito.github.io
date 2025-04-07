// Drag and drop module
// Handles file drag, drop and upload functionality
import * as THREE from 'three';
import { setupRenderer } from '../core/renderer.js';
import { setupCamera } from '../core/camera.js';
import { loadModel, checkLoadingComplete } from '../core/loader.js';
import { loadTexture } from '../materials/textureManager.js';
import { startDebugging } from './debugPanel.js';
import { createDropPanel, updateDropPanel } from './dropPanel.js';

// Setup the drag and drop functionality
/**
 *
 */
export function setupDragDrop(state) {
	// Create the movable drop panel
	const dropPanelContainer = createDropPanel(state);
	if (!dropPanelContainer) {
		console.error('Could not create drop panel');
		return;
	}
	
	// Get the individual drop zones from the new panel
	const modelDropZone = dropPanelContainer.querySelector('#drop-zone-model');
	
	// Initialize textureFiles object if it doesn't exist
	if (!state.textureFiles) {
		state.textureFiles = {};
	}
	
	// Setup drag and drop events for model zone
	if (modelDropZone) {
		setupDropZoneEvents(modelDropZone, (file) => {
			if (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')) {
				state.modelFile = file;
				// Update file info in panel using the updateDropPanel function
				updateDropPanel(state);
			} else {
				alert('Please drop a valid model file (GLB or GLTF)');
			}
		});
	}
	
	// Setup drag and drop events for each texture type
	const textureTypes = ['baseColor', 'orm', 'normal'];
	textureTypes.forEach(type => {
		const textureDropZone = dropPanelContainer.querySelector(`#drop-zone-texture-${type}`);
		if (textureDropZone) {
			setupDropZoneEvents(textureDropZone, (file) => {
				const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
				const fileExt = file.name.split('.').pop().toLowerCase();
				if (validExtensions.includes(fileExt)) {
					// Store texture file in appropriate property within textureFiles
					state.textureFiles[type] = file;
					// Update file info in panel
					updateDropPanel(state);
				} else {
					alert('Please drop a valid image file (JPG, PNG, WEBP)');
				}
			});
		}
	});
	
	console.log('Drag and drop initialized with model and texture drop zones');
}

// Set up events for a drop zone
/**
 *
 */
function setupDropZoneEvents(dropZone, onFileDrop) {
	// Prevent defaults for drag events
	['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
		dropZone.addEventListener(eventName, preventDefaults, false);
	});
	// Highlight on dragenter/dragover
	['dragenter', 'dragover'].forEach(eventName => {
		dropZone.addEventListener(eventName, () => {
			dropZone.classList.add('active');
		});
	});
	// Remove highlight on dragleave/drop
	['dragleave', 'drop'].forEach(eventName => {
		dropZone.addEventListener(eventName, () => {
			dropZone.classList.remove('active');
		});
	});
	// Handle file drop
	dropZone.addEventListener('drop', (e) => {
		if (e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			onFileDrop(file);
		}
	});
	// Handle click to select file
	dropZone.addEventListener('click', () => {
		const input = document.createElement('input');
		input.type = 'file';
		
		if (dropZone.id === 'drop-zone-model') {
			input.accept = '.glb,.gltf';
		} else if (dropZone.id.startsWith('drop-zone-texture')) {
			input.accept = '.jpg,.jpeg,.png,.webp';
		}
		
		input.addEventListener('change', (e) => {
			if (e.target.files.length > 0) {
				onFileDrop(e.target.files[0]);
			}
		});
		input.click();
	});
}

// Prevent default drag behaviors
/**
 *
 */
function preventDefaults(e) {
	e.preventDefault();
	e.stopPropagation();
}

// Reset state to initial drop zone
/**
 *
 */
export function resetToDropZone(state) {
	// Hide loading indicator
	const loadingScreen = document.getElementById('loading');
	if (loadingScreen) {
		loadingScreen.style.display = 'none';
	}
	// Hide renderer if it exists
	if (state.renderer && state.renderer.domElement) {
		state.renderer.domElement.style.display = 'none';
	}
	// Reset state
	state.isDebugMode = false;
	state.modelLoaded = false;
	state.textureLoaded = false;
	state.modelFile = null;
	state.textureFiles = {
		baseColor: null,
		orm: null,
		normal: null
	};
	
	// Reset drop panel with empty state
	updateDropPanel(state);
}

// Handle file uploads for model and texture
/**
 *
 */
export async function handleFileUploads(state) {
	console.log('handleFileUploads called with state:', {
		modelFile: state.modelFile ? state.modelFile.name : 'none',
		textureFiles: state.textureFiles ? Object.fromEntries(
			Object.entries(state.textureFiles)
				.map(([key, value]) => [key, value ? value.name : 'none'])
		) : 'none',
		modelLoaded: state.modelLoaded,
		textureLoaded: state.textureLoaded
	});

	// Show loading indicator
	showLoadingIndicator('Initializing...');
	
	// Setup renderer if not already created
	if (!state.renderer) {
		setupRenderer(state);
	}
	
	// Setup camera if not already created
	if (!state.camera) {
		setupCamera(state);
	}
	
	try {
		// First, load the model if provided
		if (state.modelFile) {
			console.log('Loading model:', state.modelFile.name);
			showLoadingIndicator('Loading model...');
			await loadModel(state, state.modelFile);
			state.modelLoaded = true;
			console.log('Model loaded successfully');
			
			// Ensure event is dispatched for model
			console.log('Manually dispatching modelLoaded event');
			document.dispatchEvent(new CustomEvent('modelLoaded'));
		}
		
		// Then load textures if provided
		const textureTypes = ['baseColor', 'orm', 'normal'];
		let anyTextureLoaded = false;
		
		for (const type of textureTypes) {
			if (state.textureFiles[type]) {
				console.log(`Loading ${type} texture:`, state.textureFiles[type].name);
				showLoadingIndicator(`Loading ${type} texture...`);
				try {
					// Pass the texture type to loadTexture function
					await loadTexture(state, state.textureFiles[type], type);
					anyTextureLoaded = true;
					console.log(`${type} texture loaded successfully`);
				} catch (textureError) {
					console.error(`Error loading ${type} texture:`, textureError);
					alert(`Error loading ${type} texture: ${textureError.message}`);
				}
			}
		}
		
		if (anyTextureLoaded) {
			state.textureLoaded = true;
			// Ensure event is dispatched for texture
			console.log('Manually dispatching textureLoaded event');
			document.dispatchEvent(new CustomEvent('textureLoaded'));
		}
		
		// Start debugging when both assets are loaded
		if (state.modelLoaded || state.textureLoaded) {
			// Keep the drop panel visible in debug mode
			startDebugging(state);
			hideLoadingIndicator();
		} else {
			alert('Please provide at least one file (model or texture) to debug.');
			hideLoadingIndicator();
		}
	} catch (error) {
		console.error('Error loading files:', error);
		alert('Error loading files: ' + error.message);
		resetToDropZone(state);
	} finally {
		// Hide all loading indicators
		hideLoadingIndicator();
		
		// Also call the checkLoadingComplete function for a thorough cleanup
		checkLoadingComplete(state);
		
		// Ensure all loading text is hidden
		document.querySelectorAll('.loading-text').forEach(el => {
			el.style.display = 'none';
		});
	}
	
	// Start debugging mode if either model or texture is loaded
	if (state.modelLoaded || state.textureLoaded) {
		console.log('Starting debug mode with:', {
			modelLoaded: state.modelLoaded,
			textureLoaded: state.textureLoaded
		});
		startDebugging(state);
		
		// One more explicit call to hide any lingering loading indicators
		setTimeout(() => {
			hideLoadingIndicator();
			checkLoadingComplete(state);
		}, 500);
	}
}

// Show loading indicator with message
/**
 *
 */
function showLoadingIndicator(message) {
	const loadingScreen = document.getElementById('loading');
	if (loadingScreen) {
		loadingScreen.style.display = 'flex';
		const messageElement = loadingScreen.querySelector('div');
		if (messageElement) {
			messageElement.textContent = message || 'Loading...';
		}
	}
}

// Hide loading indicator
/**
 *
 */
function hideLoadingIndicator() {
	const loadingScreen = document.getElementById('loading');
	if (loadingScreen) {
		loadingScreen.style.display = 'none';
	}
}

// Add debug logging to the handleFileSelect function to track file processing

/**
 * Handle file select from the drag and drop or file input
 */
export function handleFileSelect(state, files, dropType) {
	console.log('handleFileSelect called with:', {
		fileCount: files.length,
		dropType: dropType,
		existingState: {
			modelLoaded: state.modelLoaded,
			textureLoaded: state.textureLoaded
		}
	});
	
	// ... existing file handling code ...
	
	// Process each file based on type
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		console.log('Processing file:', file.name, file.type);
		
		// ... existing file type handling ...
		
		// For model files
		if (isModelFile) {
			console.log('Model file detected:', file.name);
			state.modelFile = file;
			loadModel(state, file).catch(err => {
				console.error('Error loading model:', err);
			});
		}
		
		// For texture files
		if (isTextureFile) {
			console.log('Texture file detected:', file.name);
			state.textureFiles[type] = file;
			loadTexture(state, file, type).catch(err => {
				console.error(`Error loading ${type} texture:`, err);
			});
		}
	}
	
	// ... existing code ...
} 