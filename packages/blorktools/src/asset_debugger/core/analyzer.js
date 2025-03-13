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

// Switch to a specific UV channel for texture display
export function switchUvChannel(state, uvChannel) {
  console.log(`Switching to UV channel: ${uvChannel}`);
  
  if (!state.modelObject || !state.textureObject) {
    console.warn('Cannot switch UV channel: Model or texture not loaded');
    return;
  }
  
  // Track how many meshes were affected
  let meshesWithThisUV = 0;
  let screenMeshesProcessed = 0;
  
  // Store current UV channel in state
  state.currentUvSet = uvChannel;
  
  state.modelObject.traverse((child) => {
    if (child.isMesh) {
      // Store original material if not already done
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material.clone();
      }
      
      // Check if this is a screen/display mesh
      const isScreenMesh = child.name.toLowerCase().includes('screen') || 
                          child.name.toLowerCase().includes('display') || 
                          child.name.toLowerCase().includes('monitor');
      
      // Special handling for screen meshes
      if (isScreenMesh) {
        screenMeshesProcessed++;
        
        // Check if this mesh has this UV channel
        const hasUvChannel = child.geometry && child.geometry.attributes[uvChannel] !== undefined;
        
        // Log for debugging
        console.log(`Processing screen mesh: ${child.name}, has ${uvChannel}: ${hasUvChannel}`);
        
        // Only apply texture if the mesh has this UV channel
        if (state.textureObject && hasUvChannel) {
          meshesWithThisUV++;
          
          // Create a fresh material
          const newMaterial = new THREE.MeshStandardMaterial();
          newMaterial.roughness = 0.1;
          newMaterial.metalness = 0.2;
          
          // Clone the texture to avoid affecting other materials
          const tex = state.textureObject.clone();
          tex.flipY = false; // Important - keep consistent with texture loading
          tex.encoding = THREE.sRGBEncoding;
          
          // Reset offset/repeat - we're using the actual UV coordinates
          tex.offset.set(0, 0);
          tex.repeat.set(1, 1);
          tex.needsUpdate = true;
          
          // Set which UV channel the texture should use
          const uvIndex = uvChannel === 'uv' ? 0 : parseInt(uvChannel.replace('uv', '')) || 0;
          
          // Store original UV data if we haven't already
          if (!originalUvData.has(child) && child.geometry.attributes.uv) {
            originalUvData.set(child, child.geometry.attributes.uv.clone());
            console.log(`Stored original UV data for ${child.name}`);
          }
          
          // Apply texture to material
          newMaterial.map = tex;
          newMaterial.emissiveMap = tex;
          newMaterial.emissive.set(1, 1, 1);
          
          if (uvIndex === 0) {
            // For default UV channel, restore original UV data if available
            if (originalUvData.has(child)) {
              child.geometry.attributes.uv.copy(originalUvData.get(child));
              console.log(`Restored original UV data for ${child.name}`);
            }
          } else if (child.geometry.attributes[`uv${uvIndex}`]) {
            // For non-default UV channels, we need to swap the UV sets
            // This works by copying the target UV set (uvN) to the primary UV attribute
            // that Three.js always uses by default
            
            // Create a backup of the current UV data if we haven't already
            if (!originalUvData.has(child)) {
              originalUvData.set(child, child.geometry.attributes.uv.clone());
            }
            
            // Copy the target UV set to the primary UV attribute
            const targetAttribute = child.geometry.attributes[`uv${uvIndex}`];
            const uvAttribute = child.geometry.attributes.uv;
            
            // Ensure the UV attribute has the right size
            if (uvAttribute.count !== targetAttribute.count) {
              console.warn(`UV attribute count mismatch: ${uvAttribute.count} vs ${targetAttribute.count}`);
              // This shouldn't happen in well-formed models, but we'll handle it
              child.geometry.attributes.uv = targetAttribute.clone();
            } else {
              // Copy the data from the target UV set to the primary UV attribute
              for (let i = 0; i < targetAttribute.count; i++) {
                uvAttribute.setXY(
                  i,
                  targetAttribute.getX(i),
                  targetAttribute.getY(i)
                );
              }
            }
            
            // Mark that the attribute needs update
            uvAttribute.needsUpdate = true;
            console.log(`Applied UV${uvIndex} to primary UV channel for ${child.name}`);
          }
          
          // Apply the new material
          newMaterial.needsUpdate = true;
          child.material = newMaterial;
          
          // Add to screen meshes array if not already there
          if (!state.screenMeshes) {
            state.screenMeshes = [];
          }
          if (!state.screenMeshes.includes(child)) {
            state.screenMeshes.push(child);
          }
        }
      }
    }
  });

  // Update UI with the newly selected UV channel
  updateUvDisplayInformation(state, uvChannel);
  
  // Log the result
  console.log(`Switched to UV channel ${uvChannel}: ${meshesWithThisUV}/${screenMeshesProcessed} screen meshes affected`);
  
  // Force a render update
  if (state.renderer && state.camera && state.scene) {
    state.renderer.render(state.scene, state.camera);
  }
  
  // Analyze the current UV bounds
  analyzeUvBounds(state, uvChannel);
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