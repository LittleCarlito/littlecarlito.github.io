/**
 * Models Module
 * 
 * Handles creation and loading of 3D models for debugging.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getState, updateState } from '../scene/state.js';
import { createMaterial, applyTransparencySettings, hasTransparentPixels } from './materials-util.js';
import { fitCameraToObject } from '../scene/scene.js';
import { createMeshVisibilityPanel } from '../panels/mesh-panel/mesh-panel.js';
import { updateAtlasVisualization } from '../panels/atlas-panel/atlas-panel.js';
import { updateUvPanel } from '../panels/uv-panel/uv-panel.js';

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
    
    // Position camera for optimal view
    fitCameraToObject(cube);
    
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
    
    // Position camera for optimal view
    fitCameraToObject(cube);
    
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
    
    // Loading indicator is now managed by the parent function
    
    return new Promise((resolve, reject) => {
        // Load model file with GLTFLoader
        const loader = new GLTFLoader();
        
        // Create a FileReader to read the selected file
        const reader = new FileReader();
        reader.onload = function(event) {
            // Parse the model data after reading
            const modelData = event.target.result;
            
            try {
                // First, set the GLB buffer for HTML editor integration
                Promise.all([
                    import('./mesh-data-util.js'),
                    import('../modals/html-editor-modal/model-integration.js')
                ]).then(([meshDataUtil, modelIntegration]) => {
                    let bufferPromises = [];
                    
                    // Set current GLB buffer directly
                    if (typeof meshDataUtil.setCurrentGlbBuffer === 'function') {
                        console.debug('Setting current GLB buffer in loadAndSetupModel');
                        meshDataUtil.setCurrentGlbBuffer(modelData);
                    }
                    
                    // Also update the state through the model integration
                    if (modelIntegration.processModelFileForHtmlEditor && state.modelFile) {
                        console.debug('Processing model file for HTML editor in loadAndSetupModel');
                        bufferPromises.push(modelIntegration.processModelFileForHtmlEditor(state.modelFile));
                    }
                    
                    // Ensure the GLB buffer is set in state directly as well
                    if (!state.currentGlb) {
                        updateState('currentGlb', {
                            arrayBuffer: modelData,
                            fileName: state.modelFile?.name || 'model.glb',
                            fileSize: state.modelFile?.size || modelData.byteLength
                        });
                    } else {
                        state.currentGlb.arrayBuffer = modelData;
                    }
                    
                    // Wait for all promises to complete
                    return Promise.all(bufferPromises).then(() => {
                        // Verify the buffer was properly set
                        const buffer = state.currentGlb?.arrayBuffer || 
                                      (modelIntegration.getCurrentGlbBuffer && modelIntegration.getCurrentGlbBuffer());
                        
                        if (!buffer) {
                            console.warn('GLB buffer was not set during processing. This may cause issues later.');
                        } else {
                            console.debug(`GLB buffer successfully set, size: ${buffer.byteLength} bytes`);
                        }
                        
                        return buffer;
                    });
                }).then((buffer) => {
                    // Now load and parse the model, knowing the buffer is set
                    loader.parse(modelData, '', (gltf) => {
                        try {
                            // Process the loaded model
                            processLoadedModel(gltf);
                            resolve();
                        } catch (processError) {
                            console.error('Error processing model:', processError);
                            reject(processError);
                        }
                    }, undefined, function(error) {
                        console.error('Error loading model:', error);
                        alert('Error loading model. Please make sure it is a valid glTF/GLB file.');
                        reject(error);
                    });
                }).catch(error => {
                    console.error('Error setting up GLB buffer:', error);
                    // Still try to parse the model even if buffer setup fails
                    loader.parse(modelData, '', (gltf) => {
                        try {
                            processLoadedModel(gltf);
                            resolve();
                        } catch (processError) {
                            console.error('Error processing model:', processError);
                            reject(processError);
                        }
                    }, undefined, function(error) {
                        console.error('Error loading model:', error);
                        alert('Error loading model. Please make sure it is a valid glTF/GLB file.');
                        reject(error);
                    });
                });
            } catch (parseError) {
                console.error('Error parsing model data:', parseError);
                alert('Error parsing model data: ' + parseError.message);
                reject(parseError);
            }
        };
        
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            alert('Error reading model file: ' + error);
            reject(error);
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
                
                // Store mesh index in userData for reference
                const meshIndex = meshes.length - 1;
                node.userData.meshId = meshIndex;
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
        import('../panels/rig-panel/rig-panel.js').then(module => {
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
 * - Or load an example if one was selected from the examples modal
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
                    
                    // Load model, then check for custom display settings
                    handleModelLoading()
                        .then(() => checkAndApplyCustomDisplaySettings())
                        .then(() => {
                            // Hide loading indicator after everything is done
                            if (loadingIndicator) {
                                loadingIndicator.style.display = 'none';
                            }
                            resolve();
                        })
                        .catch((error) => {
                            // Hide loading indicator on error
                            if (loadingIndicator) {
                                loadingIndicator.style.display = 'none';
                            }
                            reject(error);
                        });
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    const error = new Error('Scene initialization timeout');
                    console.error(error);
                    // Hide loading indicator on timeout
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                    reject(error);
                }
            }, 300);
        } else {
            // Scene is already initialized, proceed with model loading
            handleModelLoading()
                .then(() => checkAndApplyCustomDisplaySettings())
                .then(() => {
                    // Hide loading indicator after everything is done
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                    resolve();
                })
                .catch((error) => {
                    // Hide loading indicator on error
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                    reject(error);
                });
        }
    });
}

/**
 * Handle model loading based on current state
 * @returns {Promise} A promise that resolves when the model is loaded
 */
function handleModelLoading() {
    const state = getState();
    
    // First prepare GLB buffer if needed, then load the model
    return prepareGlbBuffer().then(loadModelBasedOnState);
}

/**
 * Prepare the GLB buffer for HTML editor integration if a custom model file is available
 * @returns {Promise} A promise that resolves when the GLB buffer is prepared
 */
function prepareGlbBuffer() {
    const state = getState();
    
    // If we have a model file, pre-process it to set up the GLB buffer
    if (state.useCustomModel && state.modelFile) {
        return Promise.all([
            import('./mesh-data-util.js'),
            import('../modals/html-editor-modal/model-integration.js')
        ]).then(([meshDataUtil, modelIntegration]) => {
            // Process the model file to set up the GLB buffer
            if (modelIntegration.processModelFileForHtmlEditor) {
                console.debug('Pre-processing model file for HTML editor integration...');
                return modelIntegration.processModelFileForHtmlEditor(state.modelFile)
                    .then(() => {
                        // Verify the buffer was properly set
                        const updatedState = getState();
                        const buffer = updatedState.currentGlb?.arrayBuffer || modelIntegration.getCurrentGlbBuffer();
                        
                        if (!buffer) {
                            console.warn('GLB buffer was not set during pre-processing. This may cause issues later.');
                        } else {
                            console.debug(`GLB buffer successfully set, size: ${buffer.byteLength} bytes`);
                        }
                        
                        return buffer;
                    });
            }
            return Promise.resolve(null);
        }).catch(error => {
            console.error('Error pre-processing model file:', error);
            // Continue even if pre-processing fails
            return Promise.resolve(null);
        });
    }
    
    // No custom model file, nothing to prepare
    return Promise.resolve(null);
}

/**
 * Load the appropriate model based on current state
 * @returns {Promise} A promise that resolves when the model is loaded
 */
function loadModelBasedOnState() {
    const state = getState();
    
    return new Promise((resolve, reject) => {
        try {
            // Check if an example was selected
            if (state.selectedExample) {
                console.log(`Loading selected example: ${state.selectedExample}`);
                
                // Handle the rig example by loading a wireframe cube first
                if (state.selectedExample === 'rig') {
                    import('../modals/examples-modal/examples.js').then(examplesModule => {
                        examplesModule.loadExample('wireframe-cube')
                            .then(() => {
                                console.log('Loaded wireframe cube for rig example');
                                resolve();
                            })
                            .catch(error => {
                                console.error('Error loading wireframe cube for rig example:', error);
                                // Even if there's an error, continue with the rig setup
                                resolve();
                            });
                    }).catch(error => {
                        console.error('Error importing examples module:', error);
                        // Continue with rig setup even if there's an error
                        resolve();
                    });
                }
                // Handle future examples here
                else {
                    console.warn(`Unknown example type: ${state.selectedExample}`);
                    resolve();
                }
            }
            // Check if a custom model was uploaded
            else if (state.useCustomModel && state.modelFile) {
                console.log('Loading custom model...');
                loadAndSetupModel(null) // Pass null to prevent hiding loading indicator
                    .then(resolve)
                    .catch(reject);
            } 
            // Check if we should create a test cube for lighting
            else if (state.useLightingTestCube) {
                console.log('Creating lighting test cube...');
                try {
                    createLightingTestCube();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }
            // Create a cube if at least one texture is available
            else if (state.textureObjects.baseColor || 
                    state.textureObjects.orm || 
                    state.textureObjects.normal) {
                console.log('Creating default cube...');
                try {
                    createCube();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }
            // No options available, just resolve
            else {
                console.log('No model, textures, or examples selected.');
                resolve();
            }
        } catch (error) {
            console.error('Error in loadModelBasedOnState:', error);
            reject(error);
        }
    });
}

/**
 * Check for custom display settings in the binary buffer and apply them
 * @returns {Promise} A promise that resolves when all custom display settings are checked
 */
function checkAndApplyCustomDisplaySettings() {
    return new Promise((resolve) => {
        const state = getState();
        const meshes = state.meshes || [];
        
        // Import necessary modules
        Promise.all([
            import('../util/glb-utils.js'),
            import('../util/string-serder.js'),
            import('../util/custom-animation/texture-util.js'),
            import('../util/custom-animation/css3d-util.js'),
            import('../modals/html-editor-modal/model-integration.js') // Add model integration import
        ]).then(([glbUtils, stringSerder, textureUtil, css3dUtil, modelIntegration]) => {
            // If no meshes, resolve immediately
            if (meshes.length === 0) {
                console.debug('No meshes to check for custom display settings');
                resolve();
                return;
            }
            
            console.debug('Checking for custom display settings in GLB buffer...');
            
            // Get the GLB buffer from multiple sources to ensure we find it
            let glbBuffer = state.currentGlb?.arrayBuffer;
            
            // If not in state, try to get from model integration module
            if (!glbBuffer && modelIntegration && typeof modelIntegration.getCurrentGlbBuffer === 'function') {
                glbBuffer = modelIntegration.getCurrentGlbBuffer();
                
                // If found via model integration, update state for future use
                if (glbBuffer && state.currentGlb) {
                    state.currentGlb.arrayBuffer = glbBuffer;
                }
            }
            
            if (!glbBuffer) {
                console.debug('No GLB buffer available, skipping custom display check');
                resolve();
                return;
            }
            
            console.debug(`GLB buffer available, size: ${glbBuffer.byteLength} bytes`);
            
            // Create an array to hold all promises for checking each mesh
            const checkPromises = meshes.map((mesh, index) => {
                return new Promise((resolveCheck) => {
                    console.debug(`Checking mesh ${index} (${mesh.name || 'unnamed'}) for custom display data...`);
                    
                    glbUtils.getBinaryBufferForMesh(glbBuffer, index)
                        .then((binaryBuffer) => {
                            if (!binaryBuffer) {
                                console.debug(`No binary buffer found for mesh ${index}`);
                                resolveCheck();
                                return;
                            }
                            
                            console.debug(`Found binary buffer for mesh ${index}, size: ${binaryBuffer.byteLength} bytes`);
                            
                            if (binaryBuffer.byteLength > 0) {
                                // Deserialize data to get HTML content and settings
                                const result = stringSerder.deserializeStringFromBinary(binaryBuffer);
                                
                                console.debug(`Deserialized data for mesh ${index}:`, 
                                    result ? `Settings: ${!!result.settings}, Content length: ${result.content ? result.content.length : 0}` : 'No result');
                                
                                if (result && result.settings) {
                                    const settings = result.settings;
                                    const content = result.content;
                                    
                                    console.debug(`Settings for mesh ${index}:`, settings);
                                    
                                    // Check if display on mesh is enabled
                                    if (settings.display && settings.display.displayOnMesh === true) {
                                        console.debug(`Mesh ${index} has display_on_mesh enabled with render type: ${settings.previewMode}`);
                                        
                                        // Create mesh data object
                                        const meshData = {
                                            id: index,
                                            mesh: mesh,
                                            html: content
                                        };
                                        
                                        // Call appropriate function based on render type
                                        if (settings.previewMode === 'css3d') {
                                            // Use CSS3D rendering
                                            console.debug(`Calling handleCustomDisplay for mesh ${index}`);
                                            css3dUtil.setCustomDisplay(meshData, settings);
                                        } else {
                                            // Use texture-based rendering (either threejs or longExposure)
                                            console.debug(`Calling handleCustomTexture for mesh ${index} with renderType: ${settings.previewMode}`);
                                            textureUtil.setCustomTexture(meshData, settings.previewMode, settings);
                                        }
                                    } else {
                                        console.debug(`Display on mesh is not enabled for mesh ${index}`);
                                    }
                                }
                            }
                            resolveCheck();
                        })
                        .catch((error) => {
                            console.error(`Error checking display settings for mesh ${index}:`, error);
                            resolveCheck(); // Still resolve even on error to continue the process
                        });
                });
            });
            
            // Wait for all mesh checks to complete
            Promise.all(checkPromises)
                .then(() => {
                    console.debug('Finished checking all meshes for custom display settings');
                    resolve();
                })
                .catch((error) => {
                    console.error('Error checking custom display settings:', error);
                    resolve(); // Still resolve even on error to continue the process
                });
        }).catch((error) => {
            console.error('Error loading utility modules:', error);
            resolve(); // Still resolve even on error to continue the process
        });
    });
}

export default {
    createCube,
    createLightingTestCube,
    loadAndSetupModel,
    loadDebugModel
}; 