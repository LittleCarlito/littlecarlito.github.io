// Model and resource loading module

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { analyzeModelStructure } from './analyzer.js';
import { updateModelInfo, updateTextureInfo } from '../ui/debugPanel.js';
import { applyTextureToModel } from '../materials/textureManager.js';
import { resetToDropZone } from '../ui/dragdrop.js';

// Load model from file
export function loadModelFromFile(state) {
  const file = state.modelFile;
  if (!file) return;
  
  const loader = new GLTFLoader();
  
  // Convert file to array buffer
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    
    // Load the model from array buffer
    loader.parse(arrayBuffer, '', (gltf) => {
      state.modelObject = gltf.scene;
      state.scene.add(state.modelObject);
      
      // Center model
      centerModel(state);
      
      // Process model structure
      analyzeModelStructure(state);
      
      // Update model info in the debug panel
      updateModelInfo(state);
      
      // Show debug panel
      const debugPanel = document.getElementById('debug-panel');
      if (debugPanel) {
        debugPanel.style.display = 'block';
      }
      
      // Check if both model and texture are loaded
      checkLoadingComplete(state);
    }, undefined, (error) => {
      console.error('Error loading model:', error);
      alert('Error loading the model file. Please try a different file.');
      resetToDropZone(state);
    });
  };
  
  reader.readAsArrayBuffer(file);
}

// Center model in scene and adjust camera
function centerModel(state) {
  if (!state.modelObject) return;
  
  // Create bounding box
  const box = new THREE.Box3().setFromObject(state.modelObject);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  
  // Reset model position to center
  state.modelObject.position.x = -center.x;
  state.modelObject.position.y = -center.y;
  state.modelObject.position.z = -center.z;
  
  // Set camera position based on model size
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = state.camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.5; // Add some extra space
  state.camera.position.z = cameraZ;
  
  // Set camera target to model center
  state.controls.target.set(0, 0, 0);
  state.controls.update();
}

// Create a procedural number atlas texture for testing
export function createNumberAtlasTexture() {
  // Create a canvas to draw the texture
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  
  // Section 1: Number "1" - Bright Red
  ctx.fillStyle = '#FF5733';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', 100, 100);
  
  // Section 2: Number "2" - Bright Green
  ctx.fillStyle = '#33FF57';
  ctx.fillRect(200, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.fillText('2', 300, 100);
  
  // Section 3: Number "3" - Bright Blue 
  ctx.fillStyle = '#3357FF';
  ctx.fillRect(400, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.fillText('3', 500, 100);
  
  // Create a texture from the canvas
  const texture = new THREE.CanvasTexture(canvas);
  
  // Set the texture wrapping mode to allow proper offset/repeat
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  // Important: Set proper filtering for better display
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  
  // Add debugging to verify texture creation
  console.log('Created texture atlas:', texture);
  
  return texture;
}

// Load the test number atlas texture
export function loadNumberAtlasTexture(state) {
  // Create a texture from a canvas
  const texture = createNumberAtlasTexture();
  state.textureObject = texture;
  
  // Log that we created a test texture
  console.log('Created procedural number atlas texture for testing', texture);
  
  // Show texture info in the UI if textureFile is not available
  if (!state.textureFile) {
    state.textureFile = {
      name: "number_atlas.png",
      size: 1024 * 36 // Estimate
    };
    updateTextureInfo(state);
  }
  
  // Apply to model if it's loaded
  if (state.modelObject) {
    applyTextureToModel(state);
  }
}

// Check if both model and texture are loaded and remove loading screen
export function checkLoadingComplete(state) {
  if (state.modelObject && state.textureObject) {
    const loadingScreen = document.getElementById('loading');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }
} 