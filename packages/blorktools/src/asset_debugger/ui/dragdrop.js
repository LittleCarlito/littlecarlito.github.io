// Drag and drop module
// Handles file drag, drop and upload functionality

import * as THREE from 'three';
import { setupRenderer } from '../core/renderer.js';
import { setupCamera } from '../core/camera.js';
import { loadModel } from '../core/loader.js';
import { loadTexture } from '../materials/textureManager.js';
import { startDebugging } from './debugPanel.js';

// Setup the drag and drop functionality
export function setupDragDrop(state) {
  // Get the main drop container
  const dropContainer = document.getElementById('drop-container');
  if (!dropContainer) {
    console.error('Drop container not found');
    return;
  }
  
  // Get the individual drop zones
  const modelDropZone = document.getElementById('drop-zone-model');
  const textureDropZone = document.getElementById('drop-zone-texture');
  
  if (!modelDropZone || !textureDropZone) {
    console.error('Drop zones not found');
    return;
  }
  
  // Setup drag and drop events for model zone
  setupDropZoneEvents(modelDropZone, (file) => {
    if (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')) {
      state.modelFile = file;
      
      // Update file info display
      const modelInfo = document.getElementById('model-file-info');
      if (modelInfo) {
        modelInfo.textContent = file.name;
      }
      
      // Add 'has-file' class to zone
      modelDropZone.classList.add('has-file');
      
      // Enable start button if both files are selected or just this one
      updateStartButton(state);
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
      
      // Update file info display
      const textureInfo = document.getElementById('texture-file-info');
      if (textureInfo) {
        textureInfo.textContent = file.name;
      }
      
      // Add 'has-file' class to zone
      textureDropZone.classList.add('has-file');
      
      // Enable start button if both files are selected or just this one
      updateStartButton(state);
    } else {
      alert('Please drop a valid image file (JPG, PNG, WEBP)');
    }
  });
  
  // Setup start button
  const startButton = document.getElementById('start-button');
  if (startButton) {
    startButton.addEventListener('click', () => {
      handleFileUploads(state);
    });
  }
  
  // Make drop zones visible
  dropContainer.style.display = 'flex';
  
  console.log('Drag and drop initialized with the following elements:');
  console.log('- dropContainer:', dropContainer);
  console.log('- modelDropZone:', modelDropZone);
  console.log('- textureDropZone:', textureDropZone);
  console.log('- startButton:', startButton);
}

// Set up events for a drop zone
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

// Enable/disable start button based on file selection
function updateStartButton(state) {
  const startButton = document.getElementById('start-button');
  if (!startButton) return;
  
  if (state.modelFile || state.textureFile) {
    startButton.disabled = false;
    startButton.style.display = 'block';
  } else {
    startButton.disabled = true;
    startButton.style.display = 'none';
  }
}

// Prevent default browser behavior for drag events
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Reset state to initial drop zone
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
  
  // Reset drop zones
  const modelDropZone = document.getElementById('drop-zone-model');
  const textureDropZone = document.getElementById('drop-zone-texture');
  
  if (modelDropZone) {
    modelDropZone.classList.remove('has-file');
  }
  
  if (textureDropZone) {
    textureDropZone.classList.remove('has-file');
  }
  
  // Reset file info displays
  const modelInfo = document.getElementById('model-file-info');
  const textureInfo = document.getElementById('texture-file-info');
  
  if (modelInfo) {
    modelInfo.textContent = '';
  }
  
  if (textureInfo) {
    textureInfo.textContent = '';
  }
  
  // Hide start button
  updateStartButton(state);
  
  // Show drop container
  const dropContainer = document.getElementById('drop-container');
  if (dropContainer) {
    dropContainer.style.display = 'flex';
  }
}

// Handle file uploads for model and texture
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
          ctx.fillText(`${(x/canvas.width).toFixed(1)},${(y/canvas.height).toFixed(1)}`, x + 10, y + 30);
        }
      }
      
      // Convert to texture
      const texture = new THREE.CanvasTexture(canvas);
      state.textureObject = texture;
      
      // Create a dummy file object for the UI
      state.textureFile = {
        name: "sample_texture.png",
        size: canvas.width * canvas.height * 4
      };
      
      // Update texture info in UI
      if (state.updateTextureInfo) {
        state.updateTextureInfo({
          name: state.textureFile.name,
          size: state.textureFile.size,
          dimensions: { width: canvas.width, height: canvas.height }
        });
      }
      
      state.textureLoaded = true;
      console.log('Sample texture created successfully');
    }
    
    // Start debugging when both files are loaded or when just one is loaded
    if (state.modelLoaded || state.textureLoaded) {
      // Hide drop container
      const dropContainer = document.getElementById('drop-container');
      if (dropContainer) {
        dropContainer.style.display = 'none';
      }
      
      startDebugging(state);
      hideLoadingIndicator();
    }
  } catch (error) {
    console.error('Error handling file uploads:', error);
    hideLoadingIndicator();
    alert('Error processing files. Please try again.');
    resetToDropZone(state);
  }
}

// Helper function to show loading indicator with custom message
function showLoadingIndicator(message = 'Loading...') {
  const loadingScreen = document.getElementById('loading');
  const loadingMessage = loadingScreen?.querySelector('div:not(.spinner)');
  
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
  }
  
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}

// Helper function to hide loading indicator
function hideLoadingIndicator() {
  const loadingScreen = document.getElementById('loading');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
} 