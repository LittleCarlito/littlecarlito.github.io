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
            const valueDisplay = e.target.nextElementSibling;
            if (valueDisplay && valueDisplay.classList.contains('value-display')) {
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
            const valueDisplay = e.target.nextElementSibling;
            if (valueDisplay && valueDisplay.classList.contains('value-display')) {
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
            const valueDisplay = e.target.nextElementSibling;
            if (valueDisplay && valueDisplay.classList.contains('value-display')) {
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
                const valueDisplay = ambientIntensityControl.nextElementSibling;
                if (valueDisplay && valueDisplay.classList.contains('value-display')) {
                    valueDisplay.textContent = '0.5';
                }
            }
            
            if (directionalIntensityControl) {
                directionalIntensityControl.value = 1.0;
                const valueDisplay = directionalIntensityControl.nextElementSibling;
                if (valueDisplay && valueDisplay.classList.contains('value-display')) {
                    valueDisplay.textContent = '1.0';
                }
            }
            
            if (exposureControl) {
                exposureControl.value = 1.0;
                const valueDisplay = exposureControl.nextElementSibling;
                if (valueDisplay && valueDisplay.classList.contains('value-display')) {
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
    }
}

/**
 * Clear the lighting info display
 */
function clearLightingInfo() {
    // Clear the stored metadata
    currentLightingMetadata = null;
    
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
        const valueDisplay = ambientIntensityControl.nextElementSibling;
        if (valueDisplay && valueDisplay.classList.contains('value-display')) {
            valueDisplay.textContent = state.ambientLight.intensity.toFixed(1);
        }
    }
    
    if (state.directionalLight && directionalIntensityControl) {
        directionalIntensityControl.value = state.directionalLight.intensity;
        const valueDisplay = directionalIntensityControl.nextElementSibling;
        if (valueDisplay && valueDisplay.classList.contains('value-display')) {
            valueDisplay.textContent = state.directionalLight.intensity.toFixed(1);
        }
    }
    
    if (state.renderer && exposureControl) {
        exposureControl.value = state.renderer.toneMappingExposure || 1.0;
        const valueDisplay = exposureControl.nextElementSibling;
        if (valueDisplay && valueDisplay.classList.contains('value-display')) {
            valueDisplay.textContent = (state.renderer.toneMappingExposure || 1.0).toFixed(1);
        }
    }
    
    // Update lighting message visibility
    updateLightingMessage();
} 