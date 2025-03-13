// Model analysis module
// Handles examining the structure and texture mapping of 3D models

import * as THREE from 'three';

// Original UV data storage
export const originalUvData = new WeakMap();

// Analyze the structure of the loaded model
export function analyzeModelStructure(state) {
  if (!state.modelObject) return;
  
  // Reset properties
  state.modelInfo = {
    meshCount: 0,
    vertexCount: 0,
    triangleCount: 0,
    materialCount: 0,
    textureCount: 0,
    hasUv: false,
    hasUv2: false,
    hasUv3: false,
    meshes: []
  };
  
  // Set of all materials to avoid duplicates
  const materials = new Set();
  const textures = new Set();
  
  // Traverse the model
  state.modelObject.traverse((node) => {
    // Only process meshes
    if (node.isMesh) {
      state.modelInfo.meshCount++;
      
      // Add to meshes array for later processing
      state.modelInfo.meshes.push(node);
      
      // Process geometry
      const geometry = node.geometry;
      if (geometry) {
        // Count vertices
        const positionAttribute = geometry.getAttribute('position');
        if (positionAttribute) {
          state.modelInfo.vertexCount += positionAttribute.count;
        }
        
        // Count triangles - different handling based on indexed vs non-indexed geometry
        if (geometry.index) {
          state.modelInfo.triangleCount += geometry.index.count / 3;
        } else if (positionAttribute) {
          state.modelInfo.triangleCount += positionAttribute.count / 3;
        }
        
        // Check for UV maps
        if (geometry.getAttribute('uv')) {
          state.modelInfo.hasUv = true;
          
          // Store original UV data for later restoration
          if (!originalUvData.has(node)) {
            const originalUv = geometry.getAttribute('uv').clone();
            originalUvData.set(node, originalUv);
          }
        }
        
        if (geometry.getAttribute('uv2')) {
          state.modelInfo.hasUv2 = true;
        }
        
        if (geometry.getAttribute('uv3')) {
          state.modelInfo.hasUv3 = true;
        }
      }
      
      // Process material(s)
      if (node.material) {
        if (Array.isArray(node.material)) {
          // Handle multi-material objects
          node.material.forEach(mat => {
            materials.add(mat);
            // Check for textures in this material
            collectTexturesFromMaterial(mat, textures);
          });
        } else {
          // Single material
          materials.add(node.material);
          // Check for textures in this material
          collectTexturesFromMaterial(node.material, textures);
        }
      }
    }
  });
  
  // Update counts
  state.modelInfo.materialCount = materials.size;
  state.modelInfo.textureCount = textures.size;
  
  console.log('Model analysis complete:', state.modelInfo);
  return state.modelInfo;
}

// Collect all textures from a material
function collectTexturesFromMaterial(material, textureSet) {
  if (!material) return;
  
  // Common texture properties in standard materials
  const textureProperties = [
    'map', 'normalMap', 'specularMap', 'emissiveMap', 
    'metalnessMap', 'roughnessMap', 'aoMap', 'displacementMap'
  ];
  
  // Check each texture property
  textureProperties.forEach(prop => {
    if (material[prop] && material[prop].isTexture) {
      textureSet.add(material[prop]);
    }
  });
}

/**
 * Switch the active UV channel for viewing
 * @param {Object} state - Global state object
 * @param {Number} channelIndex - Channel index to switch to (0 = uv, 1 = uv2, 2 = uv3)
 */
export function switchUvChannel(state, channelIndex) {
  if (!state.scene || !state.shader) {
    console.warn('Cannot switch UV channel: Scene or shader not initialized');
    return;
  }
  
  console.log(`Switching to UV channel: ${channelIndex}`);
  
  // Update the shader uniform to use the specified UV channel
  if (state.shader.uniforms && state.shader.uniforms.uvChannel) {
    state.shader.uniforms.uvChannel.value = channelIndex;
  }
  
  // Update all materials in the scene that may have this uniform
  state.scene.traverse(object => {
    if (object.material && object.material.uniforms && object.material.uniforms.uvChannel) {
      object.material.uniforms.uvChannel.value = channelIndex;
    }
  });
  
  // Analyze the UV bounds to find the current texture region being used
  const uvBounds = analyzeUvBounds(state, channelIndex);
  if (uvBounds) {
    state.currentUvRegion = uvBounds;
    console.log('Detected UV region:', state.currentUvRegion);
  } else {
    // Default to full texture if no bounds could be determined
    state.currentUvRegion = { min: [0, 0], max: [1, 1] };
  }
  
  // Update the atlas visualization to highlight current UV area
  try {
    // Dynamic import to avoid circular dependencies
    import('../ui/atlasVisualization.js').then(module => {
      // Update atlas visualization if it exists
      module.updateAtlasVisualization(state);
      
      // If atlas visualization doesn't exist, create it
      if (!document.querySelector('.atlas-visualization')) {
        module.createAtlasVisualization(state);
      }
    });
  } catch (error) {
    console.error('Failed to update atlas visualization:', error);
  }
  
  // Check if the model has this UV channel and show a warning if not
  let hasChannel = false;
  
  state.scene.traverse(object => {
    if (object.isMesh && object.geometry && object.geometry.attributes) {
      const geometry = object.geometry;
      
      // Check for matching UV attribute
      switch (channelIndex) {
        case 0:
          hasChannel = hasChannel || !!geometry.attributes.uv;
          break;
        case 1:
          hasChannel = hasChannel || !!geometry.attributes.uv2;
          break;
        case 2:
          hasChannel = hasChannel || !!geometry.attributes.uv3;
          break;
      }
    }
  });
  
  if (!hasChannel) {
    console.warn(`Warning: UV channel ${channelIndex} not found in the model`);
  }
  
  // Update the UI to reflect the change
  updateUvDisplayInformation(state, channelIndex);
  
  // Force a render to update the view
  if (state.renderer && state.camera && state.scene) {
    state.renderer.render(state.scene, state.camera);
  }
}

/**
 * Analyze UV coordinates to determine the bounds (min/max) of the used texture region
 * @param {Object} state - Global state object
 * @param {Number} channelIndex - UV channel to analyze
 * @returns {Object} bounds object with min and max coordinates
 */
function analyzeUvBounds(state, channelIndex) {
  if (!state.scene) return null;
  
  let minU = 1;
  let minV = 1;
  let maxU = 0;
  let maxV = 0;
  let hasValidUV = false;
  
  // Traverse all meshes in the scene to collect UV data
  state.scene.traverse(object => {
    if (object.isMesh && object.geometry && object.geometry.attributes && object.visible) {
      const geometry = object.geometry;
      
      // Get the appropriate UV attribute based on channel
      let uvAttribute;
      switch (channelIndex) {
        case 0:
          uvAttribute = geometry.attributes.uv;
          break;
        case 1:
          uvAttribute = geometry.attributes.uv2;
          break;
        case 2:
          uvAttribute = geometry.attributes.uv3;
          break;
      }
      
      if (uvAttribute && uvAttribute.array) {
        hasValidUV = true;
        
        // Analyze each UV coordinate to find bounds
        for (let i = 0; i < uvAttribute.count; i++) {
          const u = uvAttribute.getX(i);
          const v = uvAttribute.getY(i);
          
          // Skip invalid values
          if (isNaN(u) || isNaN(v)) continue;
          
          // Update bounds
          minU = Math.min(minU, u);
          minV = Math.min(minV, v);
          maxU = Math.max(maxU, u);
          maxV = Math.max(maxV, v);
        }
      }
    }
  });
  
  if (!hasValidUV) {
    return null;
  }
  
  // Apply a small margin to ensure we capture everything
  const margin = 0.01;
  minU = Math.max(0, minU - margin);
  minV = Math.max(0, minV - margin);
  maxU = Math.min(1, maxU + margin);
  maxV = Math.min(1, maxV + margin);
  
  // Return bounds
  return {
    min: [minU, minV],
    max: [maxU, maxV]
  };
}

/**
 * Updates the UV display information in the debug UI
 * @param {Object} state - Global state object
 * @param {Number} activeChannel - Currently active UV channel
 */
function updateUvDisplayInformation(state, activeChannel) {
  const uvInfoContainer = document.getElementById('uv-info-container');
  if (!uvInfoContainer) return;
  
  // Create a summary of UV information to display
  let info = `Active Channel: UV${activeChannel === 0 ? '' : activeChannel + 1}<br>`;
  
  // Count meshes with this UV channel
  let meshesWithChannel = 0;
  let totalMeshes = 0;
  
  state.scene.traverse(object => {
    if (object.isMesh) {
      totalMeshes++;
      const geometry = object.geometry;
      
      if (geometry && geometry.attributes) {
        switch (activeChannel) {
          case 0:
            if (geometry.attributes.uv) meshesWithChannel++;
            break;
          case 1:
            if (geometry.attributes.uv2) meshesWithChannel++;
            break;
          case 2:
            if (geometry.attributes.uv3) meshesWithChannel++;
            break;
        }
      }
    }
  });
  
  info += `Meshes with this channel: ${meshesWithChannel}/${totalMeshes}<br>`;
  
  uvInfoContainer.innerHTML = info;
}

/**
 * Get list of available UV sets in the model
 * @param {Object} state - Global state object
 * @returns {Array} - Array of UV set names found in the model
 */
export function getAvailableUvSets(state) {
  if (!state.scene) return ['uv'];
  
  const uvSets = new Set(['uv']); // Default always included
  
  state.scene.traverse(object => {
    if (object.isMesh && object.geometry && object.geometry.attributes) {
      // Check for UV2
      if (object.geometry.attributes.uv2) {
        uvSets.add('uv2');
      }
      // Check for UV3
      if (object.geometry.attributes.uv3) {
        uvSets.add('uv3');
      }
    }
  });
  
  return Array.from(uvSets);
}

/**
 * Analyze a model and return info about the meshes and UV maps
 * @param {Object} state - Global state object
 * @returns {Object} - Model info including meshes and UV maps
 */
export function analyzeModel(state) {
  if (!state.scene || !state.modelFile) {
    return null;
  }
  
  // Basic info
  const modelInfo = {
    name: state.modelFile.name,
    size: state.modelFile.size,
    uvSets: getAvailableUvSets(state),
    meshes: []
  };
  
  // Collect mesh information
  state.scene.traverse(object => {
    if (object.isMesh) {
      // Push the actual mesh object to the meshes array
      // This ensures we can control its visibility directly
      modelInfo.meshes.push(object);
    }
  });
  
  return modelInfo;
}

// Get UV coordinates for visualization
export function getUvCoordinates(geometry) {
  if (!geometry || !geometry.getAttribute('uv')) return null;
  
  const uvAttribute = geometry.getAttribute('uv');
  const uvs = [];
  
  for (let i = 0; i < uvAttribute.count; i++) {
    uvs.push({
      x: uvAttribute.getX(i),
      y: uvAttribute.getY(i)
    });
  }
  
  return uvs;
} 