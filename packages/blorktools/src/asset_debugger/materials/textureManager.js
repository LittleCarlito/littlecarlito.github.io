// Texture Manager Module
// Handles loading, managing, and applying textures to models

import * as THREE from 'three';
import { createMultiTextureMaterial } from './multiTextureMaterial.js';
import { originalUvData } from '../core/analyzer.js';

// Load texture from file
export function loadTextureFromFile(state) {
  const file = state.textureFile;
  if (!file) return;
  
  // Create a URL from the file
  const textureUrl = URL.createObjectURL(file);
  
  // Create a new texture loader
  const loader = new THREE.TextureLoader();
  
  // Load the texture
  loader.load(textureUrl, (texture) => {
    // Store texture in state
    state.textureObject = texture;
    
    // Set texture parameters
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // Apply texture to model if it's loaded
    if (state.modelObject) {
      applyTextureToModel(state);
    }
    
    // Revoke the object URL to free up memory
    URL.revokeObjectURL(textureUrl);
    
    // Check if both model and texture are loaded and hide loading screen
    if (state.modelObject) {
      const loadingScreen = document.getElementById('loading');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }
  }, 
  undefined, // onProgress callback not needed
  (error) => {
    console.error('Error loading texture:', error);
    alert('Error loading the texture file. Please try a different file.');
    // Reset the UI if needed
  });
}

// Apply texture to model
export function applyTextureToModel(state) {
  if (!state.modelObject || !state.textureObject) return;
  
  const isMultiTextureMode = state.multiTextureMode;
  
  // If multi-texture mode is enabled, apply multi-texture material
  if (isMultiTextureMode && state.additionalTextures && state.additionalTextures.length > 0) {
    applyMultiTextureMaterial(state);
    return;
  }
  
  // For standard single texture application
  // Create a basic material with the texture
  const material = new THREE.MeshStandardMaterial({
    map: state.textureObject,
    metalness: 0.0,
    roughness: 0.8
  });
  
  // Apply material to all meshes in the model
  state.modelObject.traverse((node) => {
    if (node.isMesh) {
      // Check if this is screen mesh
      const isScreenMesh = (state.screenMeshes || []).includes(node);
      
      if (isScreenMesh) {
        // Special handling for screen meshes
        node.material = material;
      } else {
        // Standard handling for regular meshes
        node.material = material;
      }
    }
  });
  
  console.log('Applied texture to model:', state.textureObject);
}

// Load additional texture (for multi-texture support)
export function loadAdditionalTexture(file, state, uvIndex = 0) {
  // Create a URL from the file
  const textureUrl = URL.createObjectURL(file);
  
  // Create a new texture loader
  const loader = new THREE.TextureLoader();
  
  // Initialize additional textures array if it doesn't exist
  if (!state.additionalTextures) {
    state.additionalTextures = [];
  }
  
  // Load the texture
  loader.load(textureUrl, (texture) => {
    // Set texture parameters
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // Create a texture info object
    const textureInfo = {
      texture: texture,
      file: file,
      uvIndex: uvIndex,
      enabled: true,
      blendMode: 'normal',  // normal, add, multiply, etc.
      intensity: 1.0
    };
    
    // Add to additional textures array
    state.additionalTextures.push(textureInfo);
    
    // If in multi-texture mode, update the material
    if (state.multiTextureMode) {
      applyMultiTextureMaterial(state);
    }
    
    // Revoke the object URL to free up memory
    URL.revokeObjectURL(textureUrl);
    
    console.log('Added additional texture:', textureInfo);
  }, 
  undefined, // onProgress callback not needed
  (error) => {
    console.error('Error loading additional texture:', error);
    alert('Error loading the additional texture file. Please try a different file.');
  });
}

// Remove a texture from additional textures
export function removeTexture(index, state) {
  if (!state.additionalTextures || index >= state.additionalTextures.length) return;
  
  // Remove the texture at the specified index
  state.additionalTextures.splice(index, 1);
  
  // If in multi-texture mode, update the material
  if (state.multiTextureMode) {
    applyMultiTextureMaterial(state);
  }
  
  console.log('Removed texture at index:', index);
}

// Update texture settings (uvIndex, enabled, blendMode, intensity)
export function updateTextureSettings(index, settings, state) {
  if (!state.additionalTextures || index >= state.additionalTextures.length) return;
  
  // Update the settings for the texture
  const textureInfo = state.additionalTextures[index];
  Object.assign(textureInfo, settings);
  
  // If in multi-texture mode, update the material
  if (state.multiTextureMode) {
    applyMultiTextureMaterial(state);
  }
  
  console.log('Updated texture settings at index:', index, settings);
}

// Apply multi-texture material to the model
export function applyMultiTextureMaterial(state) {
  if (!state.modelObject) return;
  
  // Get all active textures
  const activeTextures = [
    { texture: state.textureObject, uvIndex: 0, enabled: true, blendMode: 'normal', intensity: 1.0 }
  ];
  
  if (state.additionalTextures) {
    // Add enabled additional textures
    state.additionalTextures.forEach(texInfo => {
      if (texInfo.enabled) {
        activeTextures.push(texInfo);
      }
    });
  }
  
  // Apply multi-texture material to all meshes
  state.modelObject.traverse((node) => {
    if (node.isMesh) {
      // Save original UV data if not already saved
      const geometry = node.geometry;
      
      if (geometry && geometry.getAttribute('uv')) {
        // Store original UV data if not already stored
        activeTextures.forEach(texInfo => {
          if (texInfo.uvIndex > 0 && !originalUvData.has(node)) {
            const originalUv = geometry.getAttribute('uv').clone();
            originalUvData.set(node, originalUv);
          }
        });
        
        // Create and apply custom shader material
        node.material = createMultiTextureMaterial(activeTextures, node, state);
      }
    }
  });
  
  console.log('Applied multi-texture material with textures:', activeTextures);
} 