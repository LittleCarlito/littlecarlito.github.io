// Atlas Visualization module
// Creates a minimap/visualization of the texture atlas with UV coordinates

import * as THREE from 'three';
import { createAtlasVisualizationShader } from '../core/shaders.js';

// Keep track of created atlas visualization
let atlasVisualization = null;

/**
 * Create or toggle a visualization of the texture atlas
 * @param {Object} state - Global state object
 */
export function createAtlasVisualization(state) {
  if (!state.textureObject) {
    alert('No texture loaded. Please load a texture first.');
    return;
  }
  
  // If visualization exists, toggle visibility
  if (atlasVisualization) {
    atlasVisualization.visible = !atlasVisualization.visible;
    console.log(`Atlas visualization ${atlasVisualization.visible ? 'shown' : 'hidden'}`);
    return;
  }
  
  // Get the texture dimensions
  const textureWidth = state.textureObject.image.width;
  const textureHeight = state.textureObject.image.height;
  
  // Calculate aspect ratio
  const aspectRatio = textureWidth / textureHeight;
  
  // Size of the visualization (responsive)
  const visualizationWidth = Math.min(window.innerWidth * 0.3, 300);
  const visualizationHeight = visualizationWidth / aspectRatio;
  
  // Create the visualization plane
  const geometry = new THREE.PlaneGeometry(visualizationWidth, visualizationHeight);
  const material = createAtlasVisualizationShader(state.textureObject);
  
  // Create mesh
  atlasVisualization = new THREE.Mesh(geometry, material);
  
  // Position in bottom-left corner
  atlasVisualization.position.set(visualizationWidth / 2 - window.innerWidth / 2 + 20, 
                                  visualizationHeight / 2 - window.innerHeight / 2 + 20, 
                                  -10);
  
  // Add to the scene if it exists, otherwise create an overlay scene
  if (state.scene) {
    // Add to camera
    if (state.camera) {
      state.camera.add(atlasVisualization);
      
      // Update controls if needed
      if (state.controls) {
        state.controls.update();
      }
    } else {
      state.scene.add(atlasVisualization);
    }
  } else {
    console.error('No scene available for atlas visualization');
    return;
  }
  
  console.log('Atlas visualization created');
  
  // Update visualization when window is resized
  window.addEventListener('resize', () => {
    if (!atlasVisualization) return;
    
    // Recalculate dimensions
    const newWidth = Math.min(window.innerWidth * 0.3, 300);
    const newHeight = newWidth / aspectRatio;
    
    // Update geometry
    atlasVisualization.geometry.dispose();
    atlasVisualization.geometry = new THREE.PlaneGeometry(newWidth, newHeight);
    
    // Update position
    atlasVisualization.position.set(newWidth / 2 - window.innerWidth / 2 + 20, 
                                   newHeight / 2 - window.innerHeight / 2 + 20, 
                                   -10);
  });
  
  return atlasVisualization;
}

/**
 * Update the atlas visualization with new texture
 * @param {Object} state - Global state object
 */
export function updateAtlasVisualization(state) {
  if (!atlasVisualization || !state.textureObject) return;
  
  // Update texture
  atlasVisualization.material.uniforms.diffuseMap.value = state.textureObject;
  atlasVisualization.material.needsUpdate = true;
}

/**
 * Remove atlas visualization
 */
export function removeAtlasVisualization() {
  if (!atlasVisualization) return;
  
  // Remove from parent
  if (atlasVisualization.parent) {
    atlasVisualization.parent.remove(atlasVisualization);
  }
  
  // Dispose resources
  atlasVisualization.geometry.dispose();
  atlasVisualization.material.dispose();
  
  // Clear reference
  atlasVisualization = null;
} 