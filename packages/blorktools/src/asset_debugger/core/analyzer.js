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
  
  // Determine the channel name based on the input
  // The input could be a number (0, 1, 2) or a string ('uv', 'uv2', 'uv3')
  let channelName;
  if (typeof uvChannel === 'number') {
    // Convert numeric index to channel name
    channelName = uvChannel === 0 ? 'uv' : `uv${uvChannel + 1}`;
  } else if (typeof uvChannel === 'string') {
    // If it's already a channel name, use it directly
    channelName = uvChannel;
    // Convert to numeric index for state tracking (0 for 'uv', 1 for 'uv2', etc.)
    const uvIndex = channelName === 'uv' ? 0 : parseInt(channelName.replace('uv', '')) - 1;
    state.currentUvSet = uvIndex;
  } else {
    console.error('Invalid UV channel type:', typeof uvChannel);
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
        const hasUvChannel = child.geometry && child.geometry.attributes[channelName] !== undefined;
        
        // Log for debugging
        console.log(`Processing screen mesh: ${child.name}, has ${channelName}: ${hasUvChannel}`);
        
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
          
          // Store original UV data if we haven't already
          if (!originalUvData.has(child) && child.geometry.attributes.uv) {
            originalUvData.set(child, child.geometry.attributes.uv.clone());
            console.log(`Stored original UV data for ${child.name}`);
          }
          
          // Apply texture to material
          newMaterial.map = tex;
          newMaterial.emissiveMap = tex;
          newMaterial.emissive.set(1, 1, 1);
          
          // Handle UV channel swapping
          if (channelName === 'uv') {
            // For default UV channel, restore original UV data if available
            if (originalUvData.has(child)) {
              // Replace the entire UV attribute with the original, don't just copy values
              child.geometry.attributes.uv = originalUvData.get(child).clone();
              child.geometry.attributes.uv.needsUpdate = true;
              console.log(`Restored original UV data for ${child.name}`);
            }
          } else if (child.geometry.attributes[channelName]) {
            // For non-default UV channels (uv2, uv3, etc.), we need to swap the UV sets
            // This works by replacing the primary UV attribute with the target UV set
            
            // Create a backup of the current UV data if we haven't already
            if (!originalUvData.has(child)) {
              originalUvData.set(child, child.geometry.attributes.uv.clone());
              console.log(`Stored original UV data for ${child.name}`);
            }
            
            // Replace the primary UV attribute with the target UV attribute
            child.geometry.attributes.uv = child.geometry.attributes[channelName].clone();
            child.geometry.attributes.uv.needsUpdate = true;
            console.log(`Applied ${channelName} to primary UV channel for ${child.name}`);
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
  updateUvDisplayInformation(state, typeof uvChannel === 'number' ? uvChannel : 
      (channelName === 'uv' ? 0 : parseInt(channelName.replace('uv', '')) - 1));
  
  // Log the result
  console.log(`Switched to UV channel ${channelName}: ${meshesWithThisUV}/${screenMeshesProcessed} screen meshes affected`);
  
  // Force a render update
  if (state.renderer && state.camera && state.scene) {
    state.renderer.render(state.scene, state.camera);
  }
  
  // Analyze the current UV bounds
  analyzeUvBounds(state, channelName);
}

/**
 * Analyze UV coordinates to determine the bounds (min/max) of the used texture region
 * @param {Object} state - Global state object
 * @param {Number|String} channelIndex - UV channel to analyze (index or name)
 * @returns {Object} bounds object with min and max coordinates
 */
function analyzeUvBounds(state, channelIndex) {
  if (!state.scene) return null;
  
  let minU = 1;
  let minV = 1;
  let maxU = 0;
  let maxV = 0;
  let hasValidUV = false;
  
  // Determine which attribute to look for
  let attributeName;
  if (typeof channelIndex === 'number') {
    attributeName = channelIndex === 0 ? 'uv' : `uv${channelIndex + 1}`;
  } else if (typeof channelIndex === 'string') {
    attributeName = channelIndex;
  } else {
    console.error('Invalid channel type in analyzeUvBounds:', typeof channelIndex);
    return null;
  }
  
  // Traverse all meshes in the scene to collect UV data
  state.scene.traverse(object => {
    if (object.isMesh && object.geometry && object.geometry.attributes && object.visible) {
      const geometry = object.geometry;
      
      // Get the appropriate UV attribute
      const uvAttribute = geometry.attributes[attributeName];
      
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
 * @param {Number|String} activeChannel - Currently active UV channel (index or name)
 */
function updateUvDisplayInformation(state, activeChannel) {
  const uvInfoContainer = document.getElementById('uv-info-container');
  if (!uvInfoContainer) return;
  
  // Get the UV channel name 
  let channelName;
  if (typeof activeChannel === 'number') {
    channelName = activeChannel === 0 ? 'uv' : `uv${activeChannel + 1}`;
  } else if (typeof activeChannel === 'string') {
    channelName = activeChannel;
  } else {
    console.error('Invalid UV channel type in updateUvDisplayInformation:', typeof activeChannel);
    return;
  }
  
  // Check if any meshes have this UV channel
  let meshesWithChannel = 0;
  let screenMeshesWithChannel = 0;
  let totalMeshes = 0;
  let totalVertices = 0;
  
  // UV bounds analysis
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  
  // Sample mesh for display
  let sampleMeshName = "";
  let sampleUvCoordinates = [];
  
  state.scene.traverse(object => {
    if (object.isMesh) {
      totalMeshes++;
      const geometry = object.geometry;
      
      if (geometry && geometry.attributes) {
        const isScreenMesh = object.name.toLowerCase().includes('screen') || 
                           object.name.toLowerCase().includes('display') ||
                           object.name.toLowerCase().includes('monitor');
        
        // Check if mesh has this UV channel
        const uvAttribute = geometry.attributes[channelName];
        if (uvAttribute) {
          meshesWithChannel++;
          if (isScreenMesh) screenMeshesWithChannel++;
          
          // Count vertices
          totalVertices += uvAttribute.count;
          
          // Analyze UV coordinates
          for (let i = 0; i < uvAttribute.count; i++) {
            const u = uvAttribute.getX(i);
            const v = uvAttribute.getY(i);
            
            // Skip invalid values
            if (isNaN(u) || isNaN(v)) continue;
            
            // Update bounds
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, v);
            maxV = Math.max(maxV, v);
          }
          
          // Save sample UV coordinates from the first screen mesh
          if (isScreenMesh && sampleUvCoordinates.length === 0) {
            sampleMeshName = object.name;
            // Save up to 5 vertex examples
            const sampleCount = Math.min(5, uvAttribute.count);
            for (let i = 0; i < sampleCount; i++) {
              sampleUvCoordinates.push({
                index: i,
                u: uvAttribute.getX(i),
                v: uvAttribute.getY(i)
              });
            }
            
            // Add a note about the total vertex count
            if (uvAttribute.count > sampleCount) {
              sampleUvCoordinates.push({
                note: `... and ${uvAttribute.count - sampleCount} more vertices`
              });
            }
          }
        }
      }
    }
  });
  
  // Determine mapping type based on UV range
  let mappingType = "Unknown";
  let textureUsage = "Unknown";
  
  if (minU === Infinity) {
    // No valid UV data
    uvInfoContainer.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">No meshes with ${channelName} channel found</span>`;
    return;
  }
  
  if (maxU > 1 || minU < 0 || maxV > 1 || minV < 0) {
    mappingType = "Tiling / Repeating";
  } else {
    mappingType = "Standard (0-1 Range)";
    
    // Check if it's using a small portion of the texture
    const uRange = maxU - minU;
    const vRange = maxV - minV;
    
    if (uRange < 0.5 || vRange < 0.5) {
      textureUsage = "Partial Texture";
    } else {
      textureUsage = "Full Texture";
    }
  }
  
  // Update uvSelect options to show UV bounds
  const uvSelect = document.getElementById('uv-channel-select');
  if (uvSelect) {
    // Find the option for this channel
    for (let i = 0; i < uvSelect.options.length; i++) {
      if (uvSelect.options[i].value === channelName) {
        uvSelect.options[i].textContent = `${channelName.toUpperCase()} - ${textureUsage} (U: ${minU.toFixed(2)}-${maxU.toFixed(2)}, V: ${minV.toFixed(2)}-${maxV.toFixed(2)})`;
      }
    }
  }
  
  // Create formatted HTML for display
  let html = `<div style="background-color: #222; padding: 10px; border-radius: 5px;">`;
  
  // Channel info
  html += `<div style="color: #f1c40f; font-weight: bold; margin-bottom: 5px;">UV Channel Info:</div>`;
  html += `<div>Channel Name: <span style="color: #3498db;">${channelName}</span></div>`;
  html += `<div>Mapping Type: <span style="color: #3498db;">${mappingType}</span></div>`;
  html += `<div>Texture Usage: <span style="color: #3498db;">${textureUsage}</span></div>`;
  
  // Mesh statistics
  html += `<div style="color: #f1c40f; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">Mesh Statistics:</div>`;
  html += `<div>Meshes with this UV: <span style="color: #3498db;">${meshesWithChannel} of ${totalMeshes}</span></div>`;
  html += `<div>Screen Meshes: <span style="color: #3498db;">${screenMeshesWithChannel}</span></div>`;
  html += `<div>Total Vertices: <span style="color: #3498db;">${totalVertices}</span></div>`;
  html += `<div>UV Range: U: <span style="color: #3498db;">${minU.toFixed(4)} to ${maxU.toFixed(4)}</span>, V: <span style="color: #3498db;">${minV.toFixed(4)} to ${maxV.toFixed(4)}</span></div>`;
  
  // Sample UV coordinates
  if (sampleMeshName && sampleUvCoordinates.length > 0) {
    html += `<div style="color: #f1c40f; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">Sample UV Coordinates from ${sampleMeshName}:</div>`;
    
    sampleUvCoordinates.forEach(coord => {
      if (coord.note) {
        html += `<div>${coord.note}</div>`;
      } else {
        html += `<div>Vertex ${coord.index}: (${coord.u.toFixed(4)}, ${coord.v.toFixed(4)})</div>`;
      }
    });
  }
  
  html += `</div>`;
  
  uvInfoContainer.innerHTML = html;
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