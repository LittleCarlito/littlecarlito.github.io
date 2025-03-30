// Drag and drop module
// Handles file drag, drop and upload functionality
import * as THREE from 'three';
import { setupRenderer } from '../core/renderer.js';
import { setupCamera } from '../core/camera.js';
import { loadModel } from '../core/loader.js';
import { loadTexture } from '../materials/textureManager.js';
import { startDebugging } from './debugPanel.js';
import { createDropPanel, updateDropPanel, toggleDropPanel } from './dropPanel.js';

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
	const textureDropZone = dropPanelContainer.querySelector('#drop-zone-texture');
	if (!modelDropZone || !textureDropZone) {
		console.error('Drop zones not found in panel');
		return;
	}
	
	// Setup drag and drop events for model zone
	setupDropZoneEvents(modelDropZone, (file) => {
		if (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')) {
			state.modelFile = file;
			// Update file info in panel using the updateDropPanel function
			updateDropPanel(state);
		} else {
			alert('Please drop a valid model file (GLB or GLTF)');
		}
	});
	
	// Setup drag and drop events for texture zone
	setupDropZoneEvents(textureDropZone, (file) => {
		const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
		const fileExt = file.name.split('.').pop().toLowerCase();
		if (validExtensions.includes(fileExt)) {
			state.textureFile = file;
			// Update file info in panel using the updateDropPanel function
			updateDropPanel(state);
		} else {
			alert('Please drop a valid image file (JPG, PNG, WEBP)');
		}
	});
	
	console.log('Drag and drop initialized with the following elements:');
	console.log('- dropPanelContainer:', dropPanelContainer);
	console.log('- modelDropZone:', modelDropZone);
	console.log('- textureDropZone:', textureDropZone);
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
		} else if (dropZone.id === 'drop-zone-texture') {
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

// Prevent default browser behavior for drag events
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
	// Hide debug panel
	const debugPanel = document.getElementById('debug-panel');
	if (debugPanel) {
		debugPanel.style.display = 'none';
	}
	// Reset state
	state.isDebugMode = false;
	state.modelLoaded = false;
	state.textureLoaded = false;
	state.modelFile = null;
	state.textureFile = null;
	
	// Create and show the drop panel if it doesn't exist
	createDropPanel(state);
	toggleDropPanel(true);
}

// Handle file uploads for model and texture
/**
 *
 */
export async function handleFileUploads(state) {
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
		}
		// Then, load the texture if provided
		if (state.textureFile) {
			console.log('Loading texture:', state.textureFile.name);
			showLoadingIndicator('Loading texture...');
			await loadTexture(state, state.textureFile);
			state.textureLoaded = true;
			console.log('Texture loaded successfully');
		} else if (state.modelLoaded) {
			// If model is loaded but no texture is provided, create a sample texture
			console.log('No texture provided, creating a sample texture.');
			showLoadingIndicator('Creating sample texture...');
			// Create a canvas texture
			const canvas = document.createElement('canvas');
			canvas.width = 512;
			canvas.height = 512;
			const ctx = canvas.getContext('2d');
			// Create a checkerboard pattern
			const tileSize = 64;
			for (let y = 0; y < canvas.height; y += tileSize) {
				for (let x = 0; x < canvas.width; x += tileSize) {
					const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
					ctx.fillStyle = isEven ? '#3498db' : '#2980b9';
					ctx.fillRect(x, y, tileSize, tileSize);
					// Add UV coordinate numbers
					ctx.fillStyle = '#ffffff';
					ctx.font = '16px Arial';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(`${(x / canvas.width).toFixed(1)},${(y / canvas.height).toFixed(1)}`, x + tileSize / 2, y + tileSize / 2);
				}
			}
			// Create the texture
			const texture = new THREE.CanvasTexture(canvas);
			state.textureObject = texture;
			state.textureLoaded = true;
			console.log('Sample texture created');
		}
		
		// Start debugging when both assets are loaded
		if (state.modelLoaded || state.textureLoaded) {
			// Hide the drop panel now that we're in debug mode
			toggleDropPanel(false);
			
			startDebugging(state);
			hideLoadingIndicator();
		} else {
			alert('Please provide at least one file (model or texture) to debug.');
			hideLoadingIndicator();
		}
	} catch (error) {
		console.error('Error loading files:', error);
		alert(`Error loading files: ${error.message}`);
		hideLoadingIndicator();
	}
}

// Show loading indicator
/**
 *
 */
function showLoadingIndicator(message = 'Loading...') {
	const loadingScreen = document.getElementById('loading');
	if (loadingScreen) {
		const messageElement = loadingScreen.querySelector('div:not(.spinner)');
		if (messageElement) {
			messageElement.textContent = message;
		}
		loadingScreen.style.display = 'flex';
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