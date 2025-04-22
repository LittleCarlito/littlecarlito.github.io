/**
 * Asset Debugger - World Panel Module
 * 
 * This module handles world properties, environment, and lighting visualization and controls.
 */
import { getState } from '../../core/state.js';
import { updateLighting, resetLighting, updateExposure } from '../../core/lighting-util.js';

// Track initialization state
let controlsInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 20;

// Store HDR/EXR metadata for display
let currentLightingMetadata = null;

// Store the environment texture for preview
let environmentTexture = null;

/**
 * Initialize the World panel and cache DOM elements
 */
export function initWorldPanel() {
    console.log('Initializing World Panel...');
    
    // Wait for panel elements to be available 
    const checkElements = setInterval(() => {
        // Look for world-tab (from world-panel.html) or world-tab-container (from asset_debugger.html)
        const worldPanel = document.getElementById('world-tab') || document.getElementById('world-tab-container');
        
        if (worldPanel) {
            clearInterval(checkElements);
            clearTimeout(timeoutId); // Clear the timeout too when panel is found
            console.log('World panel found, initializing...');
            
            // Set up event listeners for lighting controls
            setupLightingControls();
            
            // Mark as initialized
            controlsInitialized = true;
            
            // Update lighting info if we have it already
            if (currentLightingMetadata) {
                updateLightingInfo(currentLightingMetadata);
                
                // If we have an environment texture, render the preview
                if (environmentTexture) {
                    renderEnvironmentPreview(environmentTexture);
                }
            }
        }
    }, 100);
    
    // Store the timeout ID so we can clear it if the panel is found
    const timeoutId = setTimeout(() => {
        clearInterval(checkElements);
        console.warn('Timed out waiting for World panel elements');
    }, 10000);
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
    
    if (noDataMessage && lightingDataInfo) {
        if (state.scene && state.scene.environment) {
            noDataMessage.style.display = 'none';
            lightingDataInfo.style.display = 'block';
        } else {
            noDataMessage.style.display = 'block';
            lightingDataInfo.style.display = 'none';
        }
    }
}

/**
 * Update the lighting info display with metadata
 * @param {Object} metadata - The HDR/EXR metadata
 */
export function updateLightingInfo(metadata) {
    // Store the metadata for later use if the panel isn't ready yet
    currentLightingMetadata = metadata;
    
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
        console.warn('Lighting info elements not found, panel may not be initialized yet');
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
    
    if (noDataMessage && lightingDataInfo) {
        noDataMessage.style.display = 'none';
        lightingDataInfo.style.display = 'block';
        
        // Make sure the collapsible content is still hidden by default
        const metadataContents = document.querySelectorAll('.metadata-content');
        if (metadataContents) {
            metadataContents.forEach(content => {
                content.style.display = 'none';
            });
            
            // Make sure all indicators show the right symbol
            const indicators = document.querySelectorAll('.collapse-indicator');
            if (indicators) {
                indicators.forEach(indicator => {
                    indicator.textContent = '+';
                });
            }
        }
    }
    
    // Try to get environment texture and render it
    const state = getState();
    if (state.scene && state.scene.environment) {
        // Store the environment texture for later use
        environmentTexture = state.scene.environment;
        
        // Try to render the preview if elements exist
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
        console.warn('HDR preview canvas not found, panel may not be initialized yet');
        return;
    }
    
    // If texture doesn't have image data, show error message
    if (!texture || !texture.image) {
        showNoImageMessage(canvas, noImageMessage, 'No image data available.');
        return;
    }
    
    try {
        const ctx = canvas.getContext('2d');
        
        // For HDR/EXR textures in Three.js, the image could be:
        // 1. A DataTexture with a data array
        // 2. A cube texture with 6 faces
        // 3. An equirectangular texture with image data
        
        // If we have an actual HTMLImageElement, we can render it directly
        if (texture.image instanceof HTMLImageElement) {
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
            
            console.log('Rendered image from HTMLImageElement');
        }
        // If texture is a cube texture, draw one of its faces
        else if (Array.isArray(texture.image) && texture.image.length >= 1) {
            const faceImage = texture.image[0];
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
                
                console.log('Rendered image from cubemap face');
            } else {
                showNoImageMessage(canvas, noImageMessage, 'Cannot display cubemap face.');
            }
        }
        // If it's a data texture, create a visualization of the data
        else if (texture.image.data) {
            console.log('Processing data texture with dimensions:', 
                texture.image.width, 'x', texture.image.height, 
                'Data length:', texture.image.data.length);
            
            // Create a simple visualization of the HDR data
            const data = texture.image.data;
            const width = texture.image.width || 256;
            const height = texture.image.height || 128;
            
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

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    // Calculate source position in original data
                    const srcX = Math.floor(x * scaleX);
                    const srcY = Math.floor(y * scaleY);
                    
                    // Calculate source index in data array (RGBA format)
                    const srcIndex = (srcY * width + srcX) * 4;
                    
                    // Calculate destination index in imageData
                    const destIndex = (y * canvas.width + x) * 4;
                    
                    // Make sure we're within bounds
                    if (srcIndex < data.length - 3) {
                        // Apply simple tone mapping (exposure + gamma correction)
                        // and convert from float HDR values to 8-bit display values
                        const r = Math.max(0, Math.min(255, Math.pow(data[srcIndex] * exposure, 1/gamma) * 255));
                        const g = Math.max(0, Math.min(255, Math.pow(data[srcIndex + 1] * exposure, 1/gamma) * 255));
                        const b = Math.max(0, Math.min(255, Math.pow(data[srcIndex + 2] * exposure, 1/gamma) * 255));
                        
                        imageData.data[destIndex] = r;
                        imageData.data[destIndex + 1] = g;
                        imageData.data[destIndex + 2] = b;
                        imageData.data[destIndex + 3] = 255; // Alpha
                    } else {
                        // If we're out of bounds or have missing data, use black
                        imageData.data[destIndex] = 0;
                        imageData.data[destIndex + 1] = 0;
                        imageData.data[destIndex + 2] = 0;
                        imageData.data[destIndex + 3] = 255; // Alpha
                    }
                }
            }
            
            // Put the ImageData to the canvas
            ctx.putImageData(imageData, 0, 0);
            
            // Add "HDR Data Preview" text
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('HDR Data Preview (Tone Mapped)', canvas.width / 2, canvas.height - 12);
            
            // Make canvas visible
            canvas.style.display = 'block';
            if (noImageMessage) noImageMessage.style.display = 'none';
            
            console.log('Rendered data texture visualization');
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
    console.log('Showing no image message:', message);
    
    // Hide canvas
    if (canvas) canvas.style.display = 'none';
    
    // Show message
    if (messageEl) {
        messageEl.style.display = 'block';
        messageEl.textContent = message;
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