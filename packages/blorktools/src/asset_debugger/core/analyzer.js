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

// Switch between different UV channels
export function switchUvChannel(channel, state) {
  if (!state.modelObject) return;
  
  const screenMeshes = state.screenMeshes || [];
  const isScreen = screenMeshes.length > 0;
  
  // Handle screen meshes
  for (const screenMesh of screenMeshes) {
    if (!screenMesh || !screenMesh.geometry) continue;
    
    const geometry = screenMesh.geometry;
    
    // Restore original UV data if going back to default UV channel
    if (channel === 'uv' && originalUvData.has(screenMesh)) {
      const originalUv = originalUvData.get(screenMesh);
      geometry.setAttribute('uv', originalUv);
      console.log('Restored original UV data for screen mesh', screenMesh.name || 'unnamed');
    } 
    // Store original UV data if not already stored
    else if (channel !== 'uv' && !originalUvData.has(screenMesh) && geometry.getAttribute('uv')) {
      const originalUv = geometry.getAttribute('uv').clone();
      originalUvData.set(screenMesh, originalUv);
    }
    
    // Handle specific UV channels for screen meshes
    if (channel === 'uv2') {
      // Copy UV2 to UV if available
      if (geometry.getAttribute('uv2')) {
        geometry.setAttribute('uv', geometry.getAttribute('uv2').clone());
        console.log('Switched to UV2 for screen mesh');
      } else {
        console.log('UV2 not available for screen mesh');
        // Apply fallback material if needed
      }
    } 
    else if (channel === 'uv3') {
      // Copy UV3 to UV if available
      if (geometry.getAttribute('uv3')) {
        geometry.setAttribute('uv', geometry.getAttribute('uv3').clone());
        console.log('Switched to UV3 for screen mesh');
      } else {
        console.log('UV3 not available for screen mesh');
        // Apply fallback material if needed
      }
    }
  }
  
  // Handle non-screen meshes (regular 3D models)
  if (!isScreen && state.modelObject) {
    state.modelObject.traverse((node) => {
      if (node.isMesh && node.geometry) {
        const geometry = node.geometry;
        
        // First check if this mesh has the requested UV channel
        const hasRequestedChannel = channel === 'uv' || 
                                   (channel === 'uv2' && geometry.getAttribute('uv2')) || 
                                   (channel === 'uv3' && geometry.getAttribute('uv3'));
                                   
        if (!hasRequestedChannel) {
          console.log(`Mesh ${node.name || 'unnamed'} doesn't have ${channel}`);
          return;
        }
        
        // Restore original UV data if going back to default UV channel
        if (channel === 'uv' && originalUvData.has(node)) {
          const originalUv = originalUvData.get(node);
          geometry.setAttribute('uv', originalUv);
          console.log('Restored original UV data for mesh', node.name || 'unnamed');
        } 
        // Store original UV data if not already stored
        else if (channel !== 'uv' && !originalUvData.has(node) && geometry.getAttribute('uv')) {
          const originalUv = geometry.getAttribute('uv').clone();
          originalUvData.set(node, originalUv);
        }
        
        // Map higher UV index to first UV channel temporarily
        if (channel === 'uv2' && geometry.getAttribute('uv2')) {
          geometry.setAttribute('uv', geometry.getAttribute('uv2').clone());
        } else if (channel === 'uv3' && geometry.getAttribute('uv3')) {
          geometry.setAttribute('uv', geometry.getAttribute('uv3').clone());
        }
        
        // Apply texture transformations
        // Check if the map property is present in the material
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach(mat => resetTextureTransforms(mat));
          } else {
            resetTextureTransforms(node.material);
          }
        }
      }
    });
  }
  
  // Reset texture transformations for material
  function resetTextureTransforms(material) {
    if (material.map) {
      material.map.offset.set(0, 0);
      material.map.repeat.set(1, 1);
      material.needsUpdate = true;
    }
  }
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