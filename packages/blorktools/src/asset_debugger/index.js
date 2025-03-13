// Main entry point for the Asset Debugger tool

import { setupScene, animate } from './core/scene.js';
import { setupDragDrop } from './ui/dragdrop.js';
import { setupDebugPanel } from './ui/debugPanel.js';
import { setupEventListeners } from './utils/events.js';

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
  screenMeshes: []
};

// Initialize the application
export function init() {
  console.log('Asset Debugger Tool initialized');
  
  // Setup the THREE.js environment (scene, camera, renderer)
  setupScene(state);
  
  // Initialize debug panel (it starts hidden)
  setupDebugPanel(state);
  
  // Setup drag and drop functionality
  setupDragDrop(state);
  
  // Set up event listeners
  setupEventListeners(state);
  
  // Hide loading screen if it's showing
  const loadingScreen = document.getElementById('loading');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  // Start the animation loop
  animate(state);
}

// Wait for DOM to load before initializing
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
} 