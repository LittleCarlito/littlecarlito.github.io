/**
 * Lighting Utilities Module
 * 
 * This module handles lighting setup and management for the Asset Debugger.
 */
import * as THREE from 'three';
import { getState, updateState } from '../state/scene-state';

// Default exposure value for HDR/EXR environment maps
let environmentExposure = 1.0;

// Debug flag to control logging - set to false to disable logs
const DEBUG_LIGHTING = false;

/**
 * Add standard lighting to the scene
 * @param {THREE.Scene} scene - The scene to add lighting to
 */
export function addLighting(scene) {
    if (DEBUG_LIGHTING) {
        console.log('Adding standard lighting to scene');
    }
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Store lighting references in the state
    updateState('ambientLight', ambientLight);
    updateState('directionalLight', directionalLight);
    
    // Expose exposure update function globally
    window.updateExposure = updateExposure;
    
    if (DEBUG_LIGHTING) {
        console.log('Standard lighting setup complete');
    }
}

/**
 * Update lighting parameters
 * @param {Object} params - Lighting parameters
 * @param {Object} [params.ambient] - Ambient light parameters
 * @param {string} [params.ambient.color] - Ambient light color in hex
 * @param {number} [params.ambient.intensity] - Ambient light intensity
 * @param {Object} [params.directional] - Directional light parameters
 * @param {string} [params.directional.color] - Directional light color in hex
 * @param {number} [params.directional.intensity] - Directional light intensity
 * @param {Object} [params.directional.position] - Directional light position
 */
export function updateLighting(params = {}) {
    const state = getState();
    
    if (params.ambient && state.ambientLight) {
        if (params.ambient.color !== undefined) {
            state.ambientLight.color.set(params.ambient.color);
        }
        if (params.ambient.intensity !== undefined) {
            state.ambientLight.intensity = params.ambient.intensity;
        }
    }
    
    if (params.directional && state.directionalLight) {
        if (params.directional.color !== undefined) {
            state.directionalLight.color.set(params.directional.color);
        }
        if (params.directional.intensity !== undefined) {
            state.directionalLight.intensity = params.directional.intensity;
        }
        if (params.directional.position) {
            const pos = params.directional.position;
            if (pos.x !== undefined) state.directionalLight.position.x = pos.x;
            if (pos.y !== undefined) state.directionalLight.position.y = pos.y;
            if (pos.z !== undefined) state.directionalLight.position.z = pos.z;
        }
    }
}

/**
 * Update the exposure of the environment map
 * @param {number} value - Exposure value (0-2)
 */
export function updateExposure(value) {
    const state = getState();
    if (!state.renderer) return;
    
    environmentExposure = value;
    state.renderer.toneMappingExposure = value;
    
    if (DEBUG_LIGHTING) {
        console.log(`Environment exposure updated to ${value}`);
    }
}

/**
 * Set up environment lighting from an HDR or EXR file
 * @param {File} file - HDR or EXR file object
 * @returns {Promise<THREE.Texture>} - Promise resolving to the loaded environment texture
 */
export function setupEnvironmentLighting(file) {
    const state = getState();
    if (!state.scene || !state.renderer) {
        console.error('Cannot setup environment lighting: scene or renderer not available');
        return Promise.reject(new Error('Scene or renderer not available'));
    }
    
    // Ensure viewport is visible before setting up lighting
    const viewport = document.getElementById('viewport');
    if (viewport) {
        console.log('DEBUG: Ensuring viewport is visible before environment lighting setup', {
            currentDisplay: viewport.style.display
        });
        viewport.style.display = 'block';
    }
    
    // Configure renderer for HDR/EXR
    state.renderer.outputEncoding = THREE.sRGBEncoding;
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = environmentExposure;
    
    if (DEBUG_LIGHTING) {
        console.log(`Setting up environment lighting from ${file.name} (${file.size} bytes)`);
        console.log('Renderer config:', {
            outputEncoding: state.renderer.outputEncoding,
            toneMapping: state.renderer.toneMapping,
            exposure: state.renderer.toneMappingExposure
        });
    }
    
    // Return a promise that resolves with the loaded texture
    return new Promise((resolve, reject) => {
        // First parse and log all lighting data
        parseLightingData(file).catch(error => {
            console.error('Error parsing lighting data:', error);
            // Continue even if metadata parsing fails
        });
        
        // Determine if this is an EXR file
        const isEXR = file.name.toLowerCase().endsWith('.exr');
        
        // Create object URL from the file
        const url = URL.createObjectURL(file);
        
        // Function to handle successful texture loading
        const handleTextureLoaded = (texture) => {
            if (DEBUG_LIGHTING) {
                console.log(`${isEXR ? 'EXR' : 'HDR'} texture loaded successfully:`, texture);
            }
            
            texture.mapping = THREE.EquirectangularReflectionMapping;
            
            // Set scene environment but NOT background
            state.scene.environment = texture;
            
            // Store the texture in state for later reference if needed
            updateState('environmentTexture', texture);
            
            // Clean up object URL
            URL.revokeObjectURL(url);
            
            // Update exposure control if it exists
            const exposureControl = document.getElementById('exposure-value');
            if (exposureControl) {
                exposureControl.value = environmentExposure;
                const valueDisplay = exposureControl.previousElementSibling.querySelector('.value-display');
                if (valueDisplay) {
                    valueDisplay.textContent = environmentExposure.toFixed(1);
                }
            }
            
            // Hide no data message since we now have lighting data
            const noDataMessage = document.querySelector('.no-data-message');
            if (noDataMessage) {
                noDataMessage.style.display = 'none';
            }
            
            // Check viewport again to ensure it's still visible
            const viewportAfter = document.getElementById('viewport');
            if (viewportAfter && viewportAfter.style.display !== 'block') {
                console.log(`DEBUG: Restoring viewport visibility after ${isEXR ? 'EXR' : 'HDR'} loading`);
                viewportAfter.style.display = 'block';
            }
            
            // Ensure controls are properly set up for the current scene
            import('./camera-controller.js').then(controlsModule => {
                console.log('Setting up camera and controls after environment lighting setup');
                
                if (state.camera && state.renderer) {
                    // Reset camera position
                    state.camera.position.set(3, 2, 5);
                    state.camera.lookAt(0, 0, 0);
                    state.camera.updateProjectionMatrix();
                    
                    // Instead of resetting existing controls, recreate them entirely
                    if (controlsModule.recreateControls) {
                        controlsModule.recreateControls(state.camera, state.renderer.domElement);
                        console.log('Controls recreated successfully - scene should now be interactive');
                    } else {
                        console.warn('recreateControls function not found, controls may not work properly');
                    }
                    
                    // Trigger a resize event to ensure everything is rendered correctly
                    window.dispatchEvent(new Event('resize'));
                }
            }).catch(error => {
                console.error('Error fixing controls:', error);
            });
            
            // Resolve the promise with the texture
            resolve(texture);
        };
        
        if (isEXR) {
            // Use EXRLoader for EXR files
            if (DEBUG_LIGHTING) {
                console.log('Loading EXR file with EXRLoader');
            }
            
            import('three/addons/loaders/EXRLoader.js').then(({ EXRLoader }) => {
                if (DEBUG_LIGHTING) {
                    console.log('EXRLoader imported successfully');
                    console.log('Created URL for EXR file:', url);
                    console.log('Starting EXR texture loading...');
                }
                
                const loader = new EXRLoader();
                loader.setDataType(THREE.FloatType);
                
                loader.load(url, 
                    // Success callback
                    handleTextureLoaded,
                    // Progress callback
                    undefined,
                    // Error callback
                    (error) => {
                        console.error('Error loading EXR texture:', error);
                        URL.revokeObjectURL(url);
                        reject(error);
                    }
                );
            }).catch(error => {
                console.error('Error importing EXRLoader:', error);
                URL.revokeObjectURL(url);
                reject(error);
            });
        } else {
            // Use RGBELoader for HDR files
            if (DEBUG_LIGHTING) {
                console.log('Loading HDR file with RGBELoader');
            }
            
            import('three/addons/loaders/RGBELoader.js').then(({ RGBELoader }) => {
                if (DEBUG_LIGHTING) {
                    console.log('RGBELoader imported successfully');
                    console.log('Created URL for HDR file:', url);
                    console.log('Starting HDR texture loading...');
                }
                
                const loader = new RGBELoader();
                
                loader.load(url, 
                    // Success callback
                    handleTextureLoaded,
                    // Progress callback
                    undefined,
                    // Error callback
                    (error) => {
                        console.error('Error loading HDR texture:', error);
                        URL.revokeObjectURL(url);
                        reject(error);
                    }
                );
            }).catch(error => {
                console.error('Error importing RGBELoader:', error);
                URL.revokeObjectURL(url);
                reject(error);
            });
        }
    });
}

/**
 * Reset lighting to default values
 */
export function resetLighting() {
    const state = getState();
    
    if (state.ambientLight) {
        state.ambientLight.color.set(0xffffff);
        state.ambientLight.intensity = 0.5;
    }
    
    if (state.directionalLight) {
        state.directionalLight.color.set(0xffffff);
        state.directionalLight.intensity = 1.0;
        state.directionalLight.position.set(5, 5, 5);
    }
    
    // Reset environment exposure
    environmentExposure = 1.0;
    if (state.renderer) {
        state.renderer.toneMappingExposure = environmentExposure;
    }
    
    // Update exposure control if it exists
    const exposureControl = document.getElementById('exposure-value');
    if (exposureControl) {
        exposureControl.value = environmentExposure;
        const valueDisplay = exposureControl.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = environmentExposure.toFixed(1);
        }
    }
    
    // Only reset environment lighting if we don't have HDR/EXR data loaded
    // Check if we have an environment texture loaded
    const hasEnvironmentTexture = state.scene && state.scene.environment !== null;
    
    if (!hasEnvironmentTexture && state.scene) {
        // Only clear environment if no HDR/EXR is loaded
        state.scene.environment = null;
        state.scene.background = new THREE.Color(0x111111);
        
        // Show no data message only if we don't have HDR/EXR data
        const noDataMessage = document.querySelector('.no-data-message');
        if (noDataMessage) {
            noDataMessage.style.display = 'block';
        }
    }
}

/**
 * Parse lighting data from an HDR or EXR file without applying it to the scene
 * @param {File} file - HDR or EXR file object
 * @returns {Promise<Object>} - Promise resolving to lighting data
 */
export function parseLightingData(file) {
    return new Promise((resolve, reject) => {
        // Determine file type
        const isEXR = file.name.toLowerCase().endsWith('.exr');
        const isHDR = file.name.toLowerCase().endsWith('.hdr');
        
        if (!isEXR && !isHDR) {
            reject(new Error('Unsupported file type. Only HDR and EXR files are supported.'));
            return;
        }
        
        if (DEBUG_LIGHTING) {
            console.log(`Parsing ${isEXR ? 'EXR' : 'HDR'} lighting data from ${file.name}`);
        }
        
        // Load appropriate loaders based on file type
        const loaderPromise = isEXR ? 
            Promise.all([
                import('three/addons/loaders/EXRLoader.js'),
                import('three/addons/loaders/RGBELoader.js')
            ]) : 
            import('three/addons/loaders/RGBELoader.js');
            
        loaderPromise.then((modules) => {
            const url = URL.createObjectURL(file);
            
            if (isEXR) {
                const { EXRLoader } = modules[0];
                const loader = new EXRLoader();
                loader.setDataType(THREE.FloatType);
                
                loader.load(url, (texture) => {
                    // Basic texture metadata
                    const basicMetadata = {
                        type: 'EXR',
                        fileName: file.name,
                        fileSizeBytes: file.size,
                        dimensions: {
                            width: texture.image.width || null,
                            height: texture.image.height || null
                        },
                        aspectRatio: texture.image.width && texture.image.height ? 
                            (texture.image.width / texture.image.height).toFixed(2) : null,
                        format: texture.format || null,
                        dataType: texture.type || null,
                        internalFormat: texture.internalFormat || null
                    };
                    
                    // Extract advanced metadata where possible
                    const advancedMetadata = extractEXRMetadata(texture);
                    
                    // Combine metadata
                    const completeMetadata = {
                        ...basicMetadata,
                        ...advancedMetadata,
                        // Physical properties
                        maxLuminance: estimateMaxLuminance(texture),
                        averageLuminance: estimateAverageLuminance(texture),
                        dynamicRange: estimateDynamicRange(texture),
                        // Technical details
                        compression: texture.compressionType || null,
                        colorSpace: texture.colorSpace || null,
                        encoding: texture.encoding || null,
                        isHDR: true
                    };
                    
                    if (DEBUG_LIGHTING) {
                        console.log('EXR Detailed Metadata:', completeMetadata);
                    }
                    URL.revokeObjectURL(url);
                    resolve(completeMetadata);
                }, undefined, reject);
            } else {
                // HDR file
                const RGBELoader = isEXR ? modules[1].RGBELoader : modules.RGBELoader;
                const loader = new RGBELoader();
                
                loader.load(url, (texture) => {
                    // Basic texture metadata
                    const basicMetadata = {
                        type: 'HDR',
                        fileName: file.name,
                        fileSizeBytes: file.size,
                        dimensions: {
                            width: texture.image.width || null,
                            height: texture.image.height || null
                        },
                        aspectRatio: texture.image.width && texture.image.height ? 
                            (texture.image.width / texture.image.height).toFixed(2) : null,
                        format: texture.format || null,
                        mappingType: texture.mapping || null
                    };
                    
                    // Extract advanced metadata where possible
                    const advancedMetadata = extractHDRMetadata(texture);
                    
                    // Combine metadata
                    const completeMetadata = {
                        ...basicMetadata,
                        ...advancedMetadata,
                        // Physical properties
                        maxLuminance: estimateMaxLuminance(texture),
                        averageLuminance: estimateAverageLuminance(texture),
                        dynamicRange: estimateDynamicRange(texture),
                        // Technical details
                        colorSpace: texture.colorSpace || null,
                        encoding: texture.encoding || null,
                        isHDR: true
                    };
                    
                    if (DEBUG_LIGHTING) {
                        console.log('HDR Detailed Metadata:', completeMetadata);
                    }
                    URL.revokeObjectURL(url);
                    resolve(completeMetadata);
                }, undefined, reject);
            }
        }).catch(error => {
            console.error('Error loading lighting data parser:', error);
            reject(error);
        });
    });
}

/**
 * Extract EXR-specific metadata from texture
 * @private
 * @param {THREE.Texture} texture - The EXR texture
 * @returns {Object} EXR metadata
 */
function extractEXRMetadata(texture) {
    const metadata = {
        // Standard EXR metadata fields
        version: null,
        channels: null,
        compression: null,
        pixelAspectRatio: null,
        displayWindow: null,
        dataWindow: null,
        lineOrder: null,
        chromaticities: null,
        owner: null,
        comments: null,
        creationTimestamp: null,
        creationSoftware: null,
        exposureValue: null,
        gamma: null,
        whitePoint: null
    };
    
    try {
        // Attempt to extract header data if available
        if (texture.exrData) {
            const header = texture.exrData.header || {};
            
            metadata.version = header.version || null;
            metadata.channels = header.channels ? Object.keys(header.channels) : null;
            metadata.compression = header.compression || null;
            metadata.pixelAspectRatio = header.pixelAspectRatio || null;
            metadata.displayWindow = header.displayWindow || null;
            metadata.dataWindow = header.dataWindow || null;
            metadata.lineOrder = header.lineOrder || null;
            metadata.chromaticities = header.chromaticities || null;
            
            // Extract any custom attributes
            if (header.attributes) {
                metadata.owner = header.attributes.owner || null;
                metadata.comments = header.attributes.comments || null;
                metadata.creationTimestamp = header.attributes.creationTime || null;
                metadata.creationSoftware = header.attributes.software || null;
                metadata.exposureValue = header.attributes.exposure || null;
                metadata.gamma = header.attributes.gamma || null;
                metadata.whitePoint = header.attributes.whitePoint || null;
            }
        }
    } catch (e) {
        console.warn('Could not extract EXR header data:', e);
    }
    
    return metadata;
}

/**
 * Extract HDR-specific metadata from texture
 * @private
 * @param {THREE.Texture} texture - The HDR texture
 * @returns {Object} HDR metadata
 */
function extractHDRMetadata(texture) {
    const metadata = {
        // Standard HDR metadata fields
        formatIdentifier: null,
        exposureValue: null,
        gamma: null,
        pixelAspectRatio: null,
        creationSoftware: null,
        comments: null,
        colorSpace: null,
        whitePoint: null,
        sceneBrightness: null,
        creationTimestamp: null
    };
    
    try {
        // Attempt to extract header data if available
        if (texture.hdrData) {
            const header = texture.hdrData || {};
            
            metadata.formatIdentifier = header.format || null;
            metadata.exposureValue = header.exposure || null;
            metadata.gamma = header.gamma || null;
            metadata.pixelAspectRatio = header.pixelAspectRatio || null;
            metadata.creationSoftware = header.software || null;
            metadata.comments = header.comments || null;
            metadata.colorSpace = header.colorSpace || null;
            metadata.whitePoint = header.whitePoint || null;
            metadata.sceneBrightness = header.sceneBrightness || null;
            metadata.creationTimestamp = header.creationTime || null;
        }
    } catch (e) {
        console.warn('Could not extract HDR header data:', e);
    }
    
    return metadata;
}

/**
 * Estimate the average luminance from a texture
 * @private
 * @param {THREE.Texture} texture - The texture to analyze
 * @returns {number|null} - Estimated average luminance
 */
function estimateAverageLuminance(texture) {
    if (!texture || !texture.image) return null;
    
    try {
        // Check if we can access image data
        if (texture.image.data) {
            const data = texture.image.data;
            let totalLuminance = 0;
            let samples = 0;
            
            // Sample a subset of pixels for performance
            const step = Math.max(1, Math.floor(data.length / 5000));
            for (let i = 0; i < data.length; i += step * 4) {
                if (i + 2 >= data.length) break;
                
                // Calculate luminance from RGB
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                
                totalLuminance += luminance;
                samples++;
            }
            
            return samples > 0 ? totalLuminance / samples : null;
        }
    } catch (e) {
        console.warn('Could not calculate average luminance:', e);
    }
    
    return null;
}

/**
 * Estimate the dynamic range from a texture
 * @private
 * @param {THREE.Texture} texture - The texture to analyze
 * @returns {number|null} - Estimated dynamic range in stops
 */
function estimateDynamicRange(texture) {
    if (!texture || !texture.image) return null;
    
    try {
        // Check if we can access image data
        if (texture.image.data) {
            const data = texture.image.data;
            let minLuminance = Infinity;
            let maxLuminance = 0;
            
            // Sample a subset of pixels for performance
            const step = Math.max(1, Math.floor(data.length / 5000));
            for (let i = 0; i < data.length; i += step * 4) {
                if (i + 2 >= data.length) break;
                
                // Calculate luminance from RGB
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                
                if (luminance > 0) { // Avoid log(0)
                    minLuminance = Math.min(minLuminance, luminance);
                    maxLuminance = Math.max(maxLuminance, luminance);
                }
            }
            
            if (minLuminance < maxLuminance && minLuminance > 0) {
                // Calculate dynamic range in stops (powers of 2)
                return Math.log2(maxLuminance / minLuminance);
            }
        }
    } catch (e) {
        console.warn('Could not calculate dynamic range:', e);
    }
    
    return null;
}

/**
 * Estimate the maximum luminance from a texture
 * @private
 * @param {THREE.Texture} texture - The texture to analyze
 * @returns {number} - Estimated maximum luminance
 */
function estimateMaxLuminance(texture) {
    if (!texture || !texture.image) return 0;
    
    // For a more accurate implementation, we would need to analyze the texture data
    // This is a simplified estimation based on texture properties
    try {
        // Check if we can access image data
        if (texture.image.data) {
            const data = texture.image.data;
            let maxLuminance = 0;
            
            // Sample a subset of pixels for performance
            const step = Math.max(1, Math.floor(data.length / 1000));
            for (let i = 0; i < data.length; i += step * 4) {
                if (i + 2 >= data.length) break;
                
                // Calculate rough luminance from RGB
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                
                maxLuminance = Math.max(maxLuminance, luminance);
            }
            
            return maxLuminance;
        }
    } catch (e) {
        console.warn('Could not analyze texture data:', e);
    }
    
    // Fallback to a nominal value
    return 1.0;
}
