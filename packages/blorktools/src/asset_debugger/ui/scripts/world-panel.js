/**
 * Asset Debugger - World Panel Module
 * 
 * This module handles world properties, environment, and lighting visualization and controls.
 */
import { getState } from '../../core/state.js';
import { updateLighting, resetLighting, updateExposure } from '../../core/lighting-util.js';

// Track initialization state
let controlsInitialized = false;

// Store HDR/EXR metadata for display
let currentLightingMetadata = null;

// Store the environment texture for preview
let environmentTexture = null;

/**
 * Initialize the World panel and cache DOM elements
 */
export function initWorldPanel() {
    console.log('Initializing World Panel...');
    
    // Look for world-tab (from world-panel.html) or world-tab-container (from asset_debugger.html)
    const worldPanel = document.getElementById('world-tab') || document.getElementById('world-tab-container');
    
    if (!worldPanel) {
        console.error('World panel elements not found. Panel may not be loaded in DOM yet.');
        return;
    }
    
    console.log('World panel found, initializing...');
    
    // Set up event listeners for lighting controls
    setupLightingControls();
    
    // Mark as initialized
    controlsInitialized = true;
    
    // Update lighting info if we have it already
    if (currentLightingMetadata) {
        console.log('We have existing metadata, updating lighting info');
        updateLightingInfo(currentLightingMetadata);
        
        // If we have an environment texture, render the preview
        if (environmentTexture) {
            console.log('We have existing environment texture, rendering preview');
            renderEnvironmentPreview(environmentTexture);
        }
    } else {
        console.log('No lighting metadata available yet during initialization');
    }
}

/**
 * Set up event listeners for lighting controls
 */
function setupLightingControls() {
    // Look for lighting control elements
    const ambientIntensityControl = document.getElementById('ambient-light-intensity');
    const directionalIntensityControl = document.getElementById('directional-light-intensity');
    const exposureControl = document.getElementById('exposure-value');
    const resetLightingButton = document.getElementById('reset-lighting');
    
    // Log if elements are not found
    if (!ambientIntensityControl) {
        console.warn('Ambient light intensity control not found');
    }
    if (!directionalIntensityControl) {
        console.warn('Directional light intensity control not found');
    }
    if (!exposureControl) {
        console.warn('Exposure control not found');
    }
    if (!resetLightingButton) {
        console.warn('Reset lighting button not found');
    }
    
    // Set up ambient light intensity control
    if (ambientIntensityControl) {
        ambientIntensityControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateLighting({
                ambient: { intensity: value }
            });
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        });
    }
    
    // Set up directional light intensity control
    if (directionalIntensityControl) {
        directionalIntensityControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateLighting({
                directional: { intensity: value }
            });
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        });
    }
    
    // Set up exposure control
    if (exposureControl) {
        exposureControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateExposure(value);
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        });
    }
    
    // Set up reset lighting button
    if (resetLightingButton) {
        resetLightingButton.addEventListener('click', () => {
            resetLighting();
            
            // Reset control values if they exist
            if (ambientIntensityControl) {
                ambientIntensityControl.value = 0.5;
                const valueDisplay = ambientIntensityControl.previousElementSibling.querySelector('.value-display');
                if (valueDisplay) {
                    valueDisplay.textContent = '0.5';
                }
            }
            
            if (directionalIntensityControl) {
                directionalIntensityControl.value = 1.0;
                const valueDisplay = directionalIntensityControl.previousElementSibling.querySelector('.value-display');
                if (valueDisplay) {
                    valueDisplay.textContent = '1.0';
                }
            }
            
            if (exposureControl) {
                exposureControl.value = 1.0;
                const valueDisplay = exposureControl.previousElementSibling.querySelector('.value-display');
                if (valueDisplay) {
                    valueDisplay.textContent = '1.0';
                }
            }
            
            // Clear lighting metadata display
            clearLightingInfo();
        });
    }
    
    // Initialize message visibility
    updateLightingMessage();
}

/**
 * Update lighting message visibility based on whether environment lighting is loaded
 */
function updateLightingMessage() {
    const state = getState();
    const noDataMessage = document.querySelector('.no-data-message');
    const lightingDataInfo = document.querySelector('.lighting-data-info');
    
    if (!noDataMessage || !lightingDataInfo) {
        console.warn('Lighting message elements not found');
        return;
    }
    
    if (state.scene && state.scene.environment) {
        noDataMessage.style.display = 'none';
        lightingDataInfo.style.display = 'block';
    } else {
        noDataMessage.style.display = 'block';
        lightingDataInfo.style.display = 'none';
    }
}

/**
 * Attempt to initialize the panel if not already initialized
 * This can be called when new data becomes available
 */
export function tryInitializePanel() {
    if (!controlsInitialized) {
        console.log('Attempting to initialize World panel due to new data');
        initWorldPanel();
    }
}

/**
 * Update the lighting info display with metadata
 * @param {Object} metadata - The HDR/EXR metadata
 */
export function updateLightingInfo(metadata) {
    console.log('Updating lighting info with metadata:', metadata.fileName, metadata.type);
    
    // Store the metadata for later use if the panel isn't ready yet
    currentLightingMetadata = metadata;
    
    // Try to initialize the panel if not already done
    if (!controlsInitialized) {
        tryInitializePanel();
        // If initialization fails, we'll still keep the metadata for later
        if (!controlsInitialized) {
            console.warn('Panel not initialized yet, storing metadata for later');
            return;
        }
    }
    
    // Find the UI elements
    const filenameEl = document.getElementById('lighting-filename');
    const typeEl = document.getElementById('lighting-type');
    const resolutionEl = document.getElementById('lighting-resolution');
    const sizeEl = document.getElementById('lighting-size');
    const rangeEl = document.getElementById('lighting-range');
    const luminanceEl = document.getElementById('lighting-luminance');
    const softwareEl = document.getElementById('lighting-software');
    
    // Make sure all elements exist
    if (!filenameEl || !typeEl || !resolutionEl || !sizeEl || !rangeEl || !luminanceEl || !softwareEl) {
        console.error('Cannot update lighting info: UI elements not found');
        return;
    }
    
    // Update the UI with metadata
    filenameEl.textContent = metadata.fileName || '-';
    typeEl.textContent = metadata.type || '-';
    
    const width = metadata.dimensions?.width || 0;
    const height = metadata.dimensions?.height || 0;
    resolutionEl.textContent = (width && height) ? `${width} × ${height}` : '-';
    
    const fileSizeMB = metadata.fileSizeBytes ? (metadata.fileSizeBytes / 1024 / 1024).toFixed(2) + ' MB' : '-';
    sizeEl.textContent = fileSizeMB;
    
    rangeEl.textContent = metadata.dynamicRange ? metadata.dynamicRange.toFixed(2) + ' stops' : '-';
    luminanceEl.textContent = metadata.maxLuminance ? metadata.maxLuminance.toFixed(2) : '-';
    softwareEl.textContent = metadata.creationSoftware || '-';
    
    // Show the lighting info section and hide the no data message
    const noDataMessage = document.querySelector('.no-data-message');
    const lightingDataInfo = document.querySelector('.lighting-data-info');
    
    if (!noDataMessage || !lightingDataInfo) {
        console.error('Cannot update lighting info display: message elements not found');
        return;
    }
    
    console.log('Showing lighting data info and hiding no data message');
    noDataMessage.style.display = 'none';
    lightingDataInfo.style.display = 'block';
    
    // Make sure any collapsible content is still properly collapsed
    const metadataContents = document.querySelectorAll('.metadata-content');
    if (metadataContents && metadataContents.length > 0) {
        console.log('Ensuring collapsible content is collapsed initially');
        metadataContents.forEach(content => {
            content.style.display = 'none';
        });
        
        // Make sure all indicators show the right symbol
        const indicators = document.querySelectorAll('.collapse-indicator');
        if (indicators && indicators.length > 0) {
            indicators.forEach(indicator => {
                indicator.textContent = '+';
            });
        }
    }
    
    // Try to get environment texture and render it
    const state = getState();
    if (state.scene && state.scene.environment) {
        console.log('Found environment texture in scene, rendering preview');
        
        // Store the environment texture for later use
        environmentTexture = state.scene.environment;
        
        // Render the preview
        renderEnvironmentPreview(environmentTexture);
    }
}

/**
 * Render the HDR/EXR environment texture preview on canvas
 * @param {THREE.Texture} texture - The environment texture to render
 */
function renderEnvironmentPreview(texture) {
    // Look for the canvas element
    const canvas = document.getElementById('hdr-preview-canvas');
    const noImageMessage = document.getElementById('no-image-message');
    
    // If canvas not found, panel may not be initialized yet
    if (!canvas) {
        console.error('HDR preview canvas not found, cannot render preview');
        return;
    }
    
    // If texture doesn't have image data, show error message
    if (!texture || !texture.image) {
        console.warn('No texture or image data found:', texture);
        showNoImageMessage(canvas, noImageMessage, 'No image data available.');
        return;
    }
    
    console.log('Rendering environment texture preview, texture type:', 
        texture.constructor.name,
        'Image type:', texture.image.constructor.name);
    
    try {
        const ctx = canvas.getContext('2d');
        
        // For HDR/EXR textures in Three.js, the image could be:
        // 1. A DataTexture with a data array
        // 2. A cube texture with 6 faces
        // 3. An equirectangular texture with image data
        
        // If we have an actual HTMLImageElement, we can render it directly
        if (texture.image instanceof HTMLImageElement) {
            console.log('Processing HTMLImageElement with dimensions:', 
                texture.image.width, 'x', texture.image.height);
                
            // Set canvas size based on image dimensions but maintain aspect ratio
            const aspectRatio = texture.image.width / texture.image.height;
            canvas.width = 500; // Fixed width for better quality
            canvas.height = canvas.width / aspectRatio;
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw the image to the canvas
            ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
            
            // Make canvas visible
            canvas.style.display = 'block';
            if (noImageMessage) noImageMessage.style.display = 'none';
            
            console.log('Successfully rendered image from HTMLImageElement');
        }
        // If texture is a cube texture, draw one of its faces
        else if (Array.isArray(texture.image) && texture.image.length >= 1) {
            const faceImage = texture.image[0];
            console.log('Processing cubemap face with type:', faceImage?.constructor.name);
            
            if (faceImage instanceof HTMLImageElement) {
                // Set canvas size based on face image dimensions
                const aspectRatio = faceImage.width / faceImage.height;
                canvas.width = 500; // Fixed width for better quality
                canvas.height = canvas.width / aspectRatio;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw the face image
                ctx.drawImage(faceImage, 0, 0, canvas.width, canvas.height);
                
                // Add "Cubemap Preview" text
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Cubemap Preview (Front Face)', canvas.width / 2, canvas.height - 12);
                
                // Make canvas visible
                canvas.style.display = 'block';
                if (noImageMessage) noImageMessage.style.display = 'none';
                
                console.log('Successfully rendered image from cubemap face');
            } else {
                console.warn('Cannot display cubemap face, invalid format:', faceImage);
                showNoImageMessage(canvas, noImageMessage, 'Cannot display cubemap face.');
            }
        }
        // If it's a data texture, create a visualization of the data
        else if (texture.image.data) {
            console.log('Processing data texture with dimensions:', 
                texture.image.width, 'x', texture.image.height, 
                'Data length:', texture.image.data.length,
                'Data type:', texture.image.data.constructor.name);
            
            // Get a sample of the data to check if it's valid
            const data = texture.image.data;
            const dataType = data.constructor.name;
            const sampleSize = Math.min(10, data.length);
            const dataSample = Array.from(data.slice(0, sampleSize));
            console.log(`Data sample (${dataType}):`, dataSample);
            
            // Create a simple visualization of the HDR data
            const width = texture.image.width || 256;
            const height = texture.image.height || 128;
            
            console.log(`Using dimensions: ${width}x${height} for canvas preview`);
            
            // Set canvas size
            canvas.width = Math.min(500, width); // Cap width at 500px
            canvas.height = (canvas.width / width) * height; // Maintain aspect ratio
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Create an ImageData object to display the data
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            
            // Sample the data from the texture
            const scaleX = width / canvas.width;
            const scaleY = height / canvas.height;
            
            // For EXR/HDR formats, we need to apply tone mapping to make them visible
            const exposure = 1.0; // Adjust as needed
            const gamma = 2.2;   // Standard gamma correction

            try {
                // Detect if we have a Float32Array (typical for EXR)
                const isFloatData = data instanceof Float32Array;
                console.log('Data is Float32Array:', isFloatData);
                
                // Check if the data layout is standard RGBA (4 components)
                const dataComponents = data.length / (width * height);
                console.log(`Data components per pixel: ${dataComponents}`);
                
                // Special case for non-standard data formats
                const isNonStandardFormat = dataComponents !== 4;
                
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        // Calculate source position in original data
                        const srcX = Math.floor(x * scaleX);
                        const srcY = Math.floor(y * scaleY);
                        
                        // Calculate destination index in imageData
                        const destIndex = (y * canvas.width + x) * 4;
                        
                        // Default to black
                        let r = 0, g = 0, b = 0;
                        
                        // Handle different data layouts
                        if (isNonStandardFormat) {
                            // Handle non-standard formats (like RGB without alpha)
                            const srcIndex = (srcY * width + srcX) * dataComponents;
                            
                            if (srcIndex < data.length - (dataComponents - 1)) {
                                // Just take the first 3 components as RGB
                                r = data[srcIndex];
                                g = dataComponents > 1 ? data[srcIndex + 1] : r;
                                b = dataComponents > 2 ? data[srcIndex + 2] : g;
                            }
                        } else {
                            // Standard RGBA format
                            const srcIndex = (srcY * width + srcX) * 4;
                            
                            if (srcIndex < data.length - 3) {
                                r = data[srcIndex];
                                g = data[srcIndex + 1];
                                b = data[srcIndex + 2];
                            }
                        }
                        
                        // For float data (EXR), we need to apply more aggressive tone mapping
                        if (isFloatData) {
                            // Ensure values are positive and not NaN or Infinity
                            r = isNaN(r) || !isFinite(r) ? 0 : Math.abs(r);
                            g = isNaN(g) || !isFinite(g) ? 0 : Math.abs(g);
                            b = isNaN(b) || !isFinite(b) ? 0 : Math.abs(b);
                            
                            // Apply simple tone mapping (exposure + gamma correction)
                            // and convert from float HDR values to 8-bit display values
                            r = Math.max(0, Math.min(255, Math.pow(r * exposure, 1/gamma) * 255));
                            g = Math.max(0, Math.min(255, Math.pow(g * exposure, 1/gamma) * 255));
                            b = Math.max(0, Math.min(255, Math.pow(b * exposure, 1/gamma) * 255));
                        } else {
                            // For RGBE (HDR) data, simple scaling might be enough
                            r = Math.max(0, Math.min(255, r));
                            g = Math.max(0, Math.min(255, g));
                            b = Math.max(0, Math.min(255, b));
                        }
                        
                        imageData.data[destIndex] = r;
                        imageData.data[destIndex + 1] = g;
                        imageData.data[destIndex + 2] = b;
                        imageData.data[destIndex + 3] = 255; // Alpha
                    }
                }
                
                // Put the ImageData to the canvas
                ctx.putImageData(imageData, 0, 0);
                
                // Add an informative text overlay
                const textLabel = isFloatData ? 'EXR Data Preview' : 'HDR Data Preview';
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${textLabel} (Tone Mapped)`, canvas.width / 2, canvas.height - 12);
                
                // Make canvas visible
                canvas.style.display = 'block';
                if (noImageMessage) noImageMessage.style.display = 'none';
                
                console.log('Successfully rendered data texture visualization');
            } catch (dataError) {
                console.error('Error processing texture data:', dataError);
                showNoImageMessage(canvas, noImageMessage, `Error processing data: ${dataError.message}`);
            }
        } else {
            console.warn('Unsupported texture format:', texture);
            showNoImageMessage(canvas, noImageMessage, 'Unsupported image format for preview.');
        }
    } catch (error) {
        console.error('Error rendering HDR preview:', error);
        showNoImageMessage(canvas, noImageMessage, `Error: ${error.message}`);
    }
}

/**
 * Show "No image data" message
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} messageEl - The message element to show
 * @param {string} message - The error message to display
 */
function showNoImageMessage(canvas, messageEl, message = 'No image data available.') {
    console.warn('Showing no image message:', message);
    
    // Hide canvas
    if (canvas) {
        canvas.style.display = 'none';
        console.log('Canvas hidden');
    }
    
    // Show message
    if (messageEl) {
        messageEl.style.display = 'block';
        messageEl.textContent = message;
        console.log('Message displayed:', message);
    } else {
        // Last resort: try to find the parent container and add a message
        const container = document.querySelector('.lighting-status');
        if (container) {
            console.log('Found parent container, adding error message directly');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            errorDiv.style.color = 'red';
            errorDiv.style.padding = '10px';
            container.appendChild(errorDiv);
        }
    }
}

/**
 * Clear the lighting info display
 */
function clearLightingInfo() {
    // Clear the stored metadata
    currentLightingMetadata = null;
    environmentTexture = null;
    
    // Find the UI elements
    const filenameEl = document.getElementById('lighting-filename');
    const typeEl = document.getElementById('lighting-type');
    const resolutionEl = document.getElementById('lighting-resolution');
    const sizeEl = document.getElementById('lighting-size');
    const rangeEl = document.getElementById('lighting-range');
    const luminanceEl = document.getElementById('lighting-luminance');
    const softwareEl = document.getElementById('lighting-software');
    
    // Reset all values
    if (filenameEl) filenameEl.textContent = '-';
    if (typeEl) typeEl.textContent = '-';
    if (resolutionEl) resolutionEl.textContent = '-';
    if (sizeEl) sizeEl.textContent = '-';
    if (rangeEl) rangeEl.textContent = '-';
    if (luminanceEl) luminanceEl.textContent = '-';
    if (softwareEl) softwareEl.textContent = '-';
    
    // Hide lighting info and show no data message
    const noDataMessage = document.querySelector('.no-data-message');
    const lightingDataInfo = document.querySelector('.lighting-data-info');
    
    if (noDataMessage && lightingDataInfo) {
        noDataMessage.style.display = 'block';
        lightingDataInfo.style.display = 'none';
        
        // Reset collapse state
        const metadataContents = document.querySelectorAll('.metadata-content');
        if (metadataContents) {
            metadataContents.forEach(content => {
                content.style.display = 'none';
            });
        }
        
        const indicators = document.querySelectorAll('.collapse-indicator');
        if (indicators) {
            indicators.forEach(indicator => {
                indicator.textContent = '+';
            });
        }
        
        // Clear canvas
        const canvas = document.getElementById('hdr-preview-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
}

/**
 * Update the World panel with current state
 */
export function updateWorldPanel() {
    // Try to initialize if not done yet
    if (!controlsInitialized) {
        tryInitializePanel();
    }
    
    // If still not initialized, log error and return
    if (!controlsInitialized) {
        console.error('Cannot update World panel: not initialized');
        return;
    }
    
    const state = getState();
    
    // Update lighting controls with current values
    const ambientIntensityControl = document.getElementById('ambient-light-intensity');
    const directionalIntensityControl = document.getElementById('directional-light-intensity');
    const exposureControl = document.getElementById('exposure-value');
    
    if (state.ambientLight && ambientIntensityControl) {
        ambientIntensityControl.value = state.ambientLight.intensity;
        const valueDisplay = ambientIntensityControl.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = state.ambientLight.intensity.toFixed(1);
        }
    }
    
    if (state.directionalLight && directionalIntensityControl) {
        directionalIntensityControl.value = state.directionalLight.intensity;
        const valueDisplay = directionalIntensityControl.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = state.directionalLight.intensity.toFixed(1);
        }
    }
    
    if (state.renderer && exposureControl) {
        exposureControl.value = state.renderer.toneMappingExposure || 1.0;
        const valueDisplay = exposureControl.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = (state.renderer.toneMappingExposure || 1.0).toFixed(1);
        }
    }
    
    // Update lighting message visibility
    updateLightingMessage();
    
    // If we have an environment texture, try to render it
    if (state.scene && state.scene.environment && !environmentTexture) {
        environmentTexture = state.scene.environment;
        renderEnvironmentPreview(environmentTexture);
    }
}

/**
 * Export a debug function to test EXR rendering directly
 * This can be called from the console for testing
 */
export function testRenderExr(file) {
    console.log('Manual EXR rendering test with file:', file);
    
    if (!file) {
        console.error('No file provided');
        return;
    }
    
    // First make sure to import Three.js if needed
    import('three').then((THREE) => {
        console.log('Three.js imported for manual testing');
        
        // Import the EXRLoader
        import('three/addons/loaders/EXRLoader.js').then(({ EXRLoader }) => {
            console.log('EXRLoader imported successfully');
            
            const loader = new EXRLoader();
            loader.setDataType(THREE.FloatType);
            
            // Create URL
            const url = URL.createObjectURL(file);
            console.log('Created URL for manual test:', url);
            
            // Load the texture
            loader.load(url, (texture) => {
                console.log('EXR loaded for manual test:', texture);
                console.log('EXR image data:', texture.image);
                
                // Render it
                renderEnvironmentPreview(texture);
                
                // Clean up
                URL.revokeObjectURL(url);
            }, 
            // Progress
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percentComplete = xhr.loaded / xhr.total * 100;
                    console.log(`Manual test loading: ${Math.round(percentComplete)}%`);
                }
            },
            // Error
            (error) => {
                console.error('Error in manual test:', error);
            });
        }).catch(err => {
            console.error('Error importing EXRLoader for manual test:', err);
        });
    }).catch(err => {
        console.error('Error importing Three.js for manual test:', err);
    });
}

// Make the test function available globally for debugging
window.testRenderExr = testRenderExr; 