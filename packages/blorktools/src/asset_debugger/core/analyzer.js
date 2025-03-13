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
          
          // Reset offset/repeat - we're using the actual UV coordinates
          tex.offset.set(0, 0);
          tex.repeat.set(1, 1);
          
          // Set which UV channel the texture should use
          const uvIndex = parseInt(uvChannel.replace('uv', '')) || 0;
          
          // Important change: Define UV transform for materials
          // We need to modify the material to use the specific UV channel
          if (uvIndex === 0) {
            // For default UV (uv), restore original UV data if we stored it
            if (originalUvData.has(child)) {
              // Restore the original UV data
              child.geometry.attributes.uv = originalUvData.get(child);
              console.log(`Restored original UV data for ${child.name}`);
            } else {
              console.log(`Using default UV mapping for ${child.name} (no stored original)`);
            }
          } else {
            // For non-default UV channels, store original UV data if we haven't already
            if (!originalUvData.has(child) && child.geometry.attributes.uv) {
              // Store a clone of the original UV attribute
              originalUvData.set(child, child.geometry.attributes.uv.clone());
              console.log(`Stored original UV data for ${child.name}`);
            }
            
            if (uvIndex === 2) {
              // For uv2, use THREE.UVMapping and set uvTransform
              newMaterial.defines = newMaterial.defines || {};
              newMaterial.defines.USE_UV = '';
              newMaterial.defines.USE_UV2 = '';
              
              // Force material to use uv2
              child.geometry.attributes.uv = child.geometry.attributes.uv2;
              console.log(`Mapped UV2 to UV for ${child.name}`);
            } else if (uvIndex === 3) {
              // For uv3, use THREE.UVMapping and set uvTransform
              newMaterial.defines = newMaterial.defines || {};
              newMaterial.defines.USE_UV = '';
              newMaterial.defines.USE_UV3 = '';
              
              // Force material to use uv3
              child.geometry.attributes.uv = child.geometry.attributes.uv3;
              console.log(`Mapped UV3 to UV for ${child.name}`);
            } else if (uvIndex > 3) {
              console.log(`Warning: ${uvChannel} (index ${uvIndex}) exceeds Three.js support`);
              // For higher UV indices, we need a custom approach
              child.geometry.attributes.uv = child.geometry.attributes[uvChannel];
              console.log(`Mapped ${uvChannel} to UV for ${child.name}`);
            }
          }
          
          // Apply the texture
          newMaterial.map = tex;
          newMaterial.emissiveMap = tex;
          newMaterial.emissive.set(1, 1, 1);
          
          // Apply the material
          child.material = newMaterial;
          
          // Force geometry update
          child.geometry.attributes.uv.needsUpdate = true;
        } else {
          // If this mesh doesn't have this UV channel, restore original material
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        }
      }
    }
  });
  
  console.log(`Switched to UV channel ${uvChannel}: ${meshesWithThisUV}/${screenMeshesProcessed} screen meshes affected`);
  
  // Force a render update
  if (state.renderer && state.camera && state.scene) {
    state.renderer.render(state.scene, state.camera);
  }
  
  return meshesWithThisUV;
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