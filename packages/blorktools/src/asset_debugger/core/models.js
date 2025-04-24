/**
 * Texture Debugger - Models Module
 * 
 * This module handles model loading, cube creation, and model processing.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getState, updateState } from './state.js';
import { createMaterial, applyTransparencySettings, hasTransparentPixels } from './materials.js';
import { fitCameraToObject } from './scene.js';
import { createMeshVisibilityPanel } from '../ui/scripts/mesh-panel.js';
import { updateAtlasVisualization } from '../ui/scripts/atlas-panel.js';
import { updateUvPanel } from '../ui/scripts/uv-panel.js';

/**
 * Create a basic cube with the loaded textures
 */
export function createCube() {
    const state = getState();
    
    // Check if scene is initialized - prevent "state.scene is null" error
    if (!state.scene) {
        console.warn("Scene not initialized yet. Cannot create cube.");
        return Promise.reject(new Error("Scene not initialized. Try again after scene is ready."));
    }
    
    // Create cube geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Add UV2 coordinates for aoMap only if ORM texture is available
    if (state.textureObjects.orm && state.textureObjects.orm.image) {
        geometry.attributes.uv2 = geometry.attributes.uv;
    }
    
    // Create material with the loaded textures - will use whatever textures are available
    const material = createMaterial();
    
    // Apply transparency settings if needed
    if (state.textureObjects.baseColor && state.textureObjects.baseColor.image && 
        hasTransparentPixels(state.textureObjects.baseColor.image)) {
        applyTransparencySettings(material);
    }
    
    // Create mesh and add to scene
    const cube = new THREE.Mesh(geometry, material);
    cube.name = "Cube";
    state.scene.add(cube);
    
    // Store in state
    updateState('cube', cube);
    
    // Add to meshes array for visibility control
    updateState('meshes', [cube]);
    
    // Set up mesh visibility panel
    createMeshVisibilityPanel();
    
    // Update all panels based on active tab
    const atlasTab = document.getElementById('atlas-tab');
    const uvTab = document.getElementById('uv-tab');
    
    if (atlasTab && atlasTab.classList.contains('active')) {
        updateAtlasVisualization();
    }
    if (uvTab && uvTab.classList.contains('active')) {
        updateUvPanel();
    }
}

/**
 * Create a multi-material test cube for lighting showcase
 * Each face will have a different material to show different lighting properties
 */
export function createLightingTestCube() {
    const state = getState();
    
    // Check if scene is initialized
    if (!state.scene) {
        console.warn("Scene not initialized yet. Cannot create lighting test cube.");
        return Promise.reject(new Error("Scene not initialized. Try again after scene is ready."));
    }
    
    // Create cube geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Create an array to hold the 6 different materials
    const materials = [];
    
    // 1. Reflective metal material (high metalness, low roughness)
    const metalMaterial = new THREE.MeshStandardMaterial({
        color: 0x8888ff,
        metalness: 1.0,
        roughness: 0.1,
        name: 'Metal'
    });
    materials.push(metalMaterial);
    
    // 2. Matte material (low metalness, high roughness)
    const matteMaterial = new THREE.MeshStandardMaterial({
        color: 0xcc3333,
        metalness: 0.0,
        roughness: 0.9,
        name: 'Matte'
    });
    materials.push(matteMaterial);
    
    // 3. Wooden material (medium roughness, no metalness)
    const woodMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513, // Saddle brown
        metalness: 0.0,
        roughness: 0.7,
        name: 'Wood'
    });
    materials.push(woodMaterial);
    
    // 4. Plastic material (low metalness, medium roughness)
    const plasticMaterial = new THREE.MeshStandardMaterial({
        color: 0x22cc22,
        metalness: 0.1,
        roughness: 0.5,
        name: 'Plastic'
    });
    materials.push(plasticMaterial);
    
    // 5. Ceramic material (no metalness, low-medium roughness)
    const ceramicMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.3,
        name: 'Ceramic'
    });
    materials.push(ceramicMaterial);
    
    // 6. Glass-like material (slightly transparent)
    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaccff,
        metalness: 0.2,
        roughness: 0.1,
        transparent: true,
        opacity: 0.7,
        name: 'Glass'
    });
    materials.push(glassMaterial);
    
    // Create mesh with all materials
    const cube = new THREE.Mesh(geometry, materials);
    cube.name = "LightingTestCube";
    state.scene.add(cube);
    
    // Store in state
    updateState('cube', cube);
    
    // Add to meshes array for visibility control
    updateState('meshes', [cube]);
    
    // Set up mesh visibility panel
    createMeshVisibilityPanel();
    
    console.log('Created lighting test cube with multiple materials');
    return cube;
}

/**
 * Load and setup a custom model from file
 * @param {HTMLElement} loadingIndicator - Loading indicator element to show/hide
 * @returns {Promise} A promise that resolves when the model is loaded and set up
 */
export function loadAndSetupModel(loadingIndicator) {
    const state = getState();
    
    // Show loading indicator if provided
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    return new Promise((resolve, reject) => {
        // Load model file with GLTFLoader
        const loader = new GLTFLoader();
        
        // Create a FileReader to read the selected file
        const reader = new FileReader();
        reader.onload = function(event) {
            // Parse the model data after reading
            const modelData = event.target.result;
            
            try {
                loader.parse(modelData, '', (gltf) => {
                    try {
                        // Process the loaded model
                        processLoadedModel(gltf);
                        resolve();
                    } catch (processError) {
                        console.error('Error processing model:', processError);
                        reject(processError);
                    } finally {
                        // Always hide loading indicator when finished
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                    }
                }, undefined, function(error) {
                    console.error('Error loading model:', error);
                    alert('Error loading model. Please make sure it is a valid glTF/GLB file.');
                    reject(error);
                    
                    // Hide loading indicator on error
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                });
            } catch (parseError) {
                console.error('Error parsing model data:', parseError);
                alert('Error parsing model data: ' + parseError.message);
                reject(parseError);
                
                // Hide loading indicator on catch
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
            }
        };
        
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            alert('Error reading model file: ' + error);
            reject(error);
            
            // Hide loading indicator on read error
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        };
        
        // Read the file as ArrayBuffer
        reader.readAsArrayBuffer(state.modelFile);
    });
}

/**
 * Process a loaded GLTF model
 * @param {Object} gltf - The loaded GLTF data
 */
function processLoadedModel(gltf) {
    const state = getState();
    
    try {
        // Clear existing model and meshes from the scene
        if (state.scene) {
            // Remove existing objects
            if (state.model) {
                state.scene.remove(state.model);
            }
            if (state.cube) {
                state.scene.remove(state.cube);
            }
        }
        
        // Reset mesh arrays
        updateState('meshes', []);
        updateState('meshGroups', {});
        
        // Extract model from loaded gltf
        const model = gltf.scene;
        updateState('model', model);
        
        // Always create material with the available textures
        // Rather than requiring all textures to be present
        const baseMaterial = createMaterial();
        
        // Process all meshes in the model
        const meshes = [];
        model.traverse(node => {
            if (node.isMesh) {
                // Store original material to copy properties
                const originalMaterial = node.material;
                
                // Create a new material for this mesh
                const material = baseMaterial.clone();
                
                // Apply UV transformations from the original material if both materials have maps
                if (state.textureObjects.baseColor && originalMaterial.map && material.map) {
                    material.map.offset.copy(originalMaterial.map.offset);
                    material.map.repeat.copy(originalMaterial.map.repeat);
                    material.map.rotation = originalMaterial.map.rotation;
                }
                
                // Apply transparency settings based on both the original material and our base texture
                const needsTransparency = 
                    originalMaterial.transparent || 
                    (originalMaterial.map && originalMaterial.map.image && 
                     hasTransparentPixels(originalMaterial.map.image)) ||
                    (state.textureObjects.baseColor && hasTransparentPixels(state.textureObjects.baseColor.image));
                
                if (needsTransparency && state.textureObjects.baseColor) {
                    material.transparent = true;
                    material.alphaTest = 0.1;
                    material.alphaMap = state.textureObjects.baseColor;
                }
                
                // Apply new material to mesh
                node.material = material;
                
                // Create UV2 attribute if needed for aoMap and if we have an ORM texture
                if (state.textureObjects.orm && !node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                    node.geometry.attributes.uv2 = node.geometry.attributes.uv;
                }
                
                // Add to meshes array for visibility control
                meshes.push(node);
            }
        });
        
        // Update meshes in state
        updateState('meshes', meshes);
        
        // Add model to scene
        state.scene.add(model);
        
        // Set up mesh visibility panel
        createMeshVisibilityPanel();
        
        // Fit camera to model
        fitCameraToObject(model);
        
        // Update UI panels based on active tab
        const atlasTab = document.getElementById('atlas-tab');
        const uvTab = document.getElementById('uv-tab');
        const rigTab = document.getElementById('rig-tab');
        
        if (atlasTab && atlasTab.classList.contains('active')) {
            updateAtlasVisualization();
        }
        if (uvTab && uvTab.classList.contains('active')) {
            updateUvPanel();
        }
        
        // Always update rig panel when a model is loaded, regardless of active tab
        // This ensures the rig data is parsed immediately
        import('../ui/scripts/rig-panel.js').then(module => {
            if (module.updateRigPanel) {
                console.log('Updating rig panel after model load');
                module.updateRigPanel();
            }
        }).catch(err => {
            console.error('Error importing rig-panel.js:', err);
        });
        
    } catch (processError) {
        console.error('Error processing model:', processError);
        alert('Error processing model: ' + processError.message);
    }
}

/**
 * Load the appropriate model for debugging
 * - If a custom model file was uploaded, load that
 * - Otherwise, create a default cube if at least one texture is available
 * - Or create a lighting test cube if only a lighting file is provided
 * @returns {Promise} A promise that resolves when the model is loaded
 */
export function loadDebugModel() {
    const state = getState();
    const loadingIndicator = document.getElementById('loading-indicator');
    
    // Show loading indicator
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    return new Promise((resolve, reject) => {
        // Make sure scene is initialized before proceeding
        if (!state.scene) {
            console.log('Scene not initialized yet, waiting for scene initialization...');
            
            // Check periodically for scene initialization
            let attempts = 0;
            const maxAttempts = 10;
            const checkInterval = setInterval(() => {
                attempts++;
                if (state.scene) {
                    clearInterval(checkInterval);
                    console.log('Scene initialized, proceeding with model loading');
                    loadModelBasedOnState()
                        .then(resolve)
                        .catch(reject);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    const error = new Error('Scene initialization timeout');
                    console.error(error);
                    reject(error);
                    
                    // Hide loading indicator
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                }
            }, 300);
        } else {
            // Scene is already initialized, proceed with model loading
            loadModelBasedOnState()
                .then(resolve)
                .catch(reject);
        }
    });
    
    function loadModelBasedOnState() {
        return new Promise((resolve, reject) => {
            try {
                // Check if a custom model was uploaded
                if (state.useCustomModel && state.modelFile) {
                    console.log('Loading custom model...');
                    loadAndSetupModel(loadingIndicator)
                        .then(resolve)
                        .catch(reject);
                } else if (state.textureObjects.baseColor || 
                           state.textureObjects.orm || 
                           state.textureObjects.normal) {
                    // Create a cube if at least one texture is available
                    console.log('Creating default cube...');
                    try {
                        createCube();
                        resolve();
                    } catch (error) {
                        reject(error);
                    } finally {
                        // Hide loading indicator
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                    }
                } else if (state.useLightingTestCube) {
                    // Special case: Create a multi-material test cube for lighting showcase
                    console.log('Creating lighting test cube...');
                    try {
                        createLightingTestCube();
                        resolve();
                    } catch (error) {
                        reject(error);
                    } finally {
                        // Hide loading indicator
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                    }
                } else {
                    // No model, no textures, and not a lighting test - can't proceed with visualization
                    console.log('Cannot create visualization: No model, textures, or lighting file');
                    
                    // Hide loading indicator
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                    
                    // Show error message
                    const error = new Error('Cannot create visualization. Please upload at least one texture atlas or a GLB model.');
                    alert(error.message);
                    reject(error);
                }
            } catch (error) {
                console.error('Error in loadModelBasedOnState:', error);
                reject(error);
                
                // Hide loading indicator
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
            }
        });
    }
}

export default {
    createCube,
    createLightingTestCube,
    loadAndSetupModel,
    loadDebugModel
}; 