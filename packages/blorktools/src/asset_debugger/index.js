// Main entry point for the Asset Debugger tool
import { setupScene, animate } from './core/scene.js';
import { setupDragDrop } from './ui/dragdrop.js';
import { setupDebugPanel } from './ui/debugPanel.js';
import { setupEventListeners } from './utils/events.js';
import { initDebugOverlay } from './utils/debugOverlay.js';
import { createDropPanel } from './ui/dropPanel.js';
import { createAtlasVisualization } from './ui/atlasVisualization.js';
import { createUvChannelPanel } from './ui/uvChannelPanel.js';
// Application state - central store
export const state = {
	// Scene-related state
	scene: null,
	camera: null,
	renderer: null,
	controls: null,
	// Content-related state
	modelFile: null,
	textureFile: null,
	modelObject: null,
	textureObject: null,
	modelInfo: null,
	additionalTextures: [],
	// UI state
	isDebugMode: false,
	currentUvSet: 0,
	multiTextureMode: false,
	// UV data
	screenMeshes: [],
	availableUvSets: [],
	uvSetNames: []
};

// Debug state initialization
console.log('Asset Debugger index.js loaded - initializing state:', state);

// Initialize the application
/**
 * Initialize the Asset Debugger
 * @param {Object} options - Configuration options
 */
export function init(options = {}) {
	console.log('Asset Debugger init called with options:', options);
	console.log('Asset Debugger Tool initialized');
	// Setup the THREE.js environment (scene, camera, renderer)
	setupScene(state);
	// Initialize all panels right away with empty states
	setupDebugPanel(state);
	createDropPanel(state);
	createAtlasVisualization(state);
	createUvChannelPanel(state);
	// Setup drag and drop functionality
	setupDragDrop(state);
	// Set up event listeners
	setupEventListeners(state);
	// Initialize the debug overlay (activated by pressing 's')
	initDebugOverlay();
	// Hide loading screen if it's showing
	const loadingScreen = document.getElementById('loading');
	if (loadingScreen) {
		loadingScreen.style.display = 'none';
	}
	// Start the animation loop
	animate(state);

	// Ensure state is correctly initialized
	if (!state.modelObject) {
		console.log('No model object in state at initialization');
	}
	
	if (!state.textureObject) {
		console.log('No texture object in state at initialization');
	}
	
	return state;
}

// Wait for DOM to load before initializing
if (typeof document !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
} 