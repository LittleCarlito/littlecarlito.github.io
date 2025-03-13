// Drag and drop interface for file uploads

import { formatFileSize } from '../utils/helpers.js';
import { loadModelFromFile } from '../core/loader.js';
import { loadTextureFromFile } from '../materials/textureManager.js';
import { loadNumberAtlasTexture } from '../core/loader.js';
import { startDebugging as startDebugPanel } from './debugPanel.js';

// Setup drag and drop functionality
export function setupDragAndDrop(state) {
  // Get the drop zone elements using the correct IDs from the HTML
  const modelDrop = document.getElementById('drop-zone-model');
  const textureDrop = document.getElementById('drop-zone-texture');
  const startButton = document.getElementById('start-button');
  const modelInfo = document.getElementById('model-file-info');
  const textureInfo = document.getElementById('texture-file-info');
  
  if (!modelDrop || !textureDrop) {
    console.error('Drop zones not found in the DOM');
    return;
  }
  
  // Prevent defaults to allow dropping
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    modelDrop.addEventListener(eventName, preventDefaults, false);
    textureDrop.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  // Highlight drop zone on drag over
  ['dragenter', 'dragover'].forEach(eventName => {
    modelDrop.addEventListener(eventName, () => {
      modelDrop.classList.add('active');
    }, false);
    
    textureDrop.addEventListener(eventName, () => {
      textureDrop.classList.add('active');
    }, false);
  });
  
  // Remove highlight on drag leave
  ['dragleave', 'drop'].forEach(eventName => {
    modelDrop.addEventListener(eventName, () => {
      modelDrop.classList.remove('active');
    }, false);
    
    textureDrop.addEventListener(eventName, () => {
      textureDrop.classList.remove('active');
    }, false);
  });
  
  // Handle model file drop
  modelDrop.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Check if it's a GLB file
      if (file.name.toLowerCase().endsWith('.glb')) {
        state.modelFile = file;
        modelInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        modelDrop.classList.add('has-file');
        checkFilesReady();
      } else {
        alert('Please drop a valid GLB file.');
      }
    }
  }, false);
  
  // Handle texture file drop
  textureDrop.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Check if it's an image file
      if (file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/)) {
        state.textureFile = file;
        textureInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        textureDrop.classList.add('has-file');
        checkFilesReady();
      } else {
        alert('Please drop a valid image file (JPG, PNG, WEBP).');
      }
    }
  }, false);
  
  // Also allow clicking on drop zones to select files
  modelDrop.addEventListener('click', () => {
    triggerFileInput('model', file => {
      if (file.name.toLowerCase().endsWith('.glb')) {
        state.modelFile = file;
        modelInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        modelDrop.classList.add('has-file');
        checkFilesReady();
      } else {
        alert('Please select a valid GLB file.');
      }
    });
  });
  
  textureDrop.addEventListener('click', () => {
    triggerFileInput('texture', file => {
      if (file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/)) {
        state.textureFile = file;
        textureInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        textureDrop.classList.add('has-file');
        checkFilesReady();
      } else {
        alert('Please select a valid image file (JPG, PNG, WEBP).');
      }
    });
  });
  
  // Check if both files are ready and enable start button
  function checkFilesReady() {
    if (state.modelFile && state.textureFile) {
      startButton.style.display = 'block';
      startButton.disabled = false;
    }
  }
  
  // Handle click on start button
  startButton.addEventListener('click', () => {
    if (startButton.disabled) return;
    
    startDebugging(state);
  });
  
  // Create temporary file input for clicks
  function triggerFileInput(type, callback) {
    const input = document.createElement('input');
    input.type = 'file';
    
    if (type === 'model') {
      input.accept = '.glb';
    } else {
      input.accept = 'image/jpeg, image/png, image/webp';
    }
    
    input.onchange = e => {
      if (e.target.files.length) {
        callback(e.target.files[0]);
      }
    };
    
    input.click();
  }
}

// Start debugging
export function startDebugging(state) {
  console.log('Starting debugging with files:', state.modelFile, state.textureFile);
  
  // Hide drag-drop zone
  const dragDropZone = document.getElementById('drop-container');
  if (dragDropZone) {
    dragDropZone.style.display = 'none';
  }
  
  // Show loading screen
  const loadingScreen = document.getElementById('loading');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
  }
  
  // Show renderer canvas
  if (state.renderer) {
    state.renderer.domElement.style.display = 'block';
  }
  
  // Set debug mode
  state.isDebugMode = true;
  
  // Start the debug panel
  startDebugPanel(state);
  
  // Load the model and texture
  loadModelFromFile(state);
  
  // For testing with the number atlas
  if (state.textureFile.name === 'test_atlas') {
    loadNumberAtlasTexture(state);
  } else {
    loadTextureFromFile(state);
  }
}

// Reset to drop zone UI
export function resetToDropZone(state) {
  const dragDropZone = document.getElementById('drop-container');
  if (dragDropZone) {
    dragDropZone.style.display = 'flex';
  }
  
  const loadingScreen = document.getElementById('loading');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  if (state.renderer) {
    state.renderer.domElement.style.display = 'none';
  }
  
  const debugPanel = document.getElementById('debug-panel');
  if (debugPanel) {
    debugPanel.style.display = 'none';
  }
  
  // Clear scene
  if (state.modelObject && state.scene) {
    state.scene.remove(state.modelObject);
    state.modelObject = null;
  }
  
  // Reset model and texture files
  state.modelFile = null;
  state.textureFile = null;
  
  // Reset UI
  const modelDrop = document.getElementById('drop-zone-model');
  const textureDrop = document.getElementById('drop-zone-texture');
  const modelInfo = document.getElementById('model-file-info');
  const textureInfo = document.getElementById('texture-file-info');
  const startButton = document.getElementById('start-button');
  
  if (modelDrop) modelDrop.classList.remove('has-file');
  if (textureDrop) textureDrop.classList.remove('has-file');
  if (modelInfo) modelInfo.textContent = '';
  if (textureInfo) textureInfo.textContent = '';
  if (startButton) {
    startButton.style.display = 'none';
    startButton.disabled = true;
  }
  
  state.isDebugMode = false;
} 