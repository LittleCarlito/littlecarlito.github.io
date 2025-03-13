// Texture Manager Module
// Handles loading, managing, and applying textures to models

import * as THREE from 'three';
import { createMultiTextureMaterial } from './multiTextureMaterial.js';
import { originalUvData } from '../core/analyzer.js';
import { updateTextureInfo } from '../ui/debugPanel.js';

/**
 * Load texture from file
 * @param {Object} state - Global state object
 * @param {File} file - Texture file to load
 * @returns {Promise} - Promise that resolves when texture is loaded
 */
export async function loadTexture(state, file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No texture file provided'));
      return;
    }
    
    // Create texture loader
    const loader = new THREE.TextureLoader();
    
    // Create object URL from file
    const fileUrl = URL.createObjectURL(file);
    
    // Load texture
    loader.load(
      fileUrl,
      (texture) => {
        console.log('Texture loaded:', texture);
        
        // Store texture in state
        state.textureObject = texture;
        
        // Configure texture
        texture.flipY = true; // Flip texture vertically (common for 3D models)
        
        // Apply to model if model is already loaded
        if (state.modelLoaded && state.modelObject) {
          applyTextureToModel(state);
        }
        
        // Create texture info for UI
        const textureInfo = {
          name: file.name,
          size: file.size,
          dimensions: {
            width: texture.image.width,
            height: texture.image.height
          }
        };
        
        // Update texture info in UI
        if (updateTextureInfo) {
          updateTextureInfo(textureInfo);
        }
        
        // Clean up URL
        URL.revokeObjectURL(fileUrl);
        
        resolve(texture);
      },
      undefined, // Progress callback
      (error) => {
        console.error('Error loading texture:', error);
        URL.revokeObjectURL(fileUrl);
        reject(error);
      }
    );
  });
}

/**
 * Apply loaded texture to all materials in the model
 * @param {Object} state - Global state object
 */
export function applyTextureToModel(state) {
  if (!state.modelObject || !state.textureObject) {
    console.warn('Cannot apply texture: Model or texture not loaded', {
      modelExists: !!state.modelObject,
      textureExists: !!state.textureObject
    });
    return;
  }
  
  console.log('Applying texture to model', state.textureObject);
  
  // Apply to all meshes in the scene
  let meshCount = 0;
  let appliedCount = 0;
  
  state.modelObject.traverse((node) => {
    if (node.isMesh) {
      meshCount++;
      
      // Simply apply a MeshBasicMaterial with the texture
      // This ensures the texture is clearly visible without any lighting effects
      const newMaterial = new THREE.MeshBasicMaterial({
        map: state.textureObject,
        side: THREE.DoubleSide  // Show texture on both sides
      });
      
      // Assign the new material
      node.material = newMaterial;
      appliedCount++;
      
      console.log(`Applied basic material with texture to mesh ${node.name || 'unnamed'}`);
    }
  });
  
  console.log(`Applied texture to ${appliedCount} materials across ${meshCount} meshes`);
  
  // Force a render update
  if (state.renderer && state.camera && state.scene) {
    console.log('Forcing render update');
    state.renderer.render(state.scene, state.camera);
    
    // Automatically show the texture atlas visualization
    try {
      // Import and call createAtlasVisualization asynchronously to avoid circular dependencies
      import('../ui/atlasVisualization.js').then(module => {
        console.log('Auto-showing texture atlas visualization');
        module.createAtlasVisualization(state);
        
        // Force another render to ensure atlas is visible
        if (state.renderer && state.camera && state.scene) {
          setTimeout(() => {
            state.renderer.render(state.scene, state.camera);
            console.log('Atlas visualization should now be visible');
          }, 100);
        }
      });
    } catch (error) {
      console.error('Failed to auto-show atlas visualization:', error);
    }
  } else {
    console.warn('Cannot force render update: Missing renderer, camera, or scene', {
      rendererExists: !!state.renderer,
      cameraExists: !!state.camera,
      sceneExists: !!state.scene
    });
  }
}

/**
 * Apply texture to a specific material
 * @param {THREE.Material} material - Three.js material
 * @param {THREE.Texture} texture - Three.js texture
 */
function applyTextureToMaterial(material, texture) {
  if (!material) return;
  
  console.log(`Applying texture to material type: ${material.type}`);
  
  // Clone texture to avoid affecting other materials
  const textureClone = texture.clone();
  textureClone.needsUpdate = true;
  
  // Set basic properties for all material types
  material.map = textureClone;
  
  // For MeshStandardMaterial (most common)
  if (material.type === 'MeshStandardMaterial') {
    // Use texture for all common map types as a starting point
    material.roughnessMap = textureClone;
    material.roughness = 0.8;
    material.metalnessMap = textureClone;
    material.metalness = 0.2;
  } 
  // For MeshBasicMaterial
  else if (material.type === 'MeshBasicMaterial') {
    material.color.set(0xffffff); // Reset color to white to show texture properly
  }
  
  // Make sure to update the material
  material.needsUpdate = true;
}

/**
 * Toggle texture editor UI
 * @param {Object} state - Global state object
 */
export function toggleTextureEditor(state) {
  // Implementation will be in a separate file (textureEditor.js)
  console.log('Toggle texture editor requested - implementation in textureEditor.js');
  
  // Display a message if texture editor is not yet implemented
  alert('Texture editor will be implemented in a future update');
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