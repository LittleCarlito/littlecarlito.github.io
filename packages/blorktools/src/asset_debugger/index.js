// Main entry point for the Asset Debugger tool
import { setupScene, animate } from './core/scene.js';
import { setupDragDrop } from './ui/dragdrop.js';
import { setupDebugPanel, autoShowAtlasVisualization } from './ui/debugPanel.js';
import { setupEventListeners } from './utils/events.js';
import { initDebugOverlay } from './utils/debugOverlay.js';
import { createDropPanel } from './ui/dropPanel.js';
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
// Initialize the application
/**
 *
 */
export function init() {
	console.log('Asset Debugger Tool initialized');
	// Setup the THREE.js environment (scene, camera, renderer)
	setupScene(state);
	// Initialize debug panel (it starts hidden)
	setupDebugPanel(state);
	// Create the movable drop panel
	createDropPanel(state);
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
	// Listen for texture and model loaded events to show atlas visualization
	document.addEventListener('textureLoaded', () => {
		if (state.textureObject && state.modelObject) {
			autoShowAtlasVisualization(state);
		}
	});
	document.addEventListener('modelLoaded', () => {
		if (state.textureObject && state.modelObject) {
			autoShowAtlasVisualization(state);
		}
	});
}
// Wait for DOM to load before initializing
if (typeof document !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
} 