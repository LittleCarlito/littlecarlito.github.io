/**
 * Asset Debugger - World Panel Module
 * 
 * This module handles world properties, environment, and lighting visualization and controls.
 */
import { getState } from '../../util/state/scene-state';
import { updateLighting, resetLighting, updateExposure } from '../../util/scene/lighting-manager';
import * as THREE from 'three';

// Track initialization state
let controlsInitialized = false;

// Store environment (HDR/EXR) metadata for display
let currentLightingMetadata = null;

// Store background image metadata for display
let currentBackgroundMetadata = null;

// Store the environment texture for preview
let environmentTexture = null;

// Store the background texture for preview
let backgroundTexture = null;

// Track the currently selected background option
let currentBackgroundOption = null; // Initialize to null for proper first-time selection logic

// Track if an EXR/HDR file is currently being loaded
let exrLoadInProgress = false;

// Add a single flag to track when an EXR/HDR file is being loaded
let isLoadingEnvironmentFile = false;

// NEW: Track event listeners for proper cleanup
let eventListeners = [];

/**
 * NEW: Cleanup function to remove all event listeners
 */
function cleanupEventListeners() {
    console.log('Cleaning up world panel event listeners...');
    eventListeners.forEach(({ element, event, handler }) => {
        if (element && typeof element.removeEventListener === 'function') {
            element.removeEventListener(event, handler);
        }
    });
    eventListeners = [];
}

/**
 * NEW: Helper to add tracked event listeners
 */
function addTrackedEventListener(element, event, handler) {
    if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(event, handler);
        eventListeners.push({ element, event, handler });
    }
}

/**
 * Set the scene background to null and save the current background if it exists
 * @param {THREE.Scene} scene - The Three.js scene
 */
function setNullBackground(scene) {
    if (scene.background) {
        if (!scene.userData) scene.userData = {};
        scene.userData.savedBackground = scene.background;
        scene.background = null;
    }
}

/**
 * Determine the current background UI state based on available data
 * This centralizes all the logic for determining what should be visible
 * @returns {Object} UI state object with flags for visibility control
 */
function determineBackgroundUIState() {
    const state = getState();
    return {
        // Background image state
        hasBackgroundImage: Boolean(state.backgroundFile || state.backgroundTexture),
        // Environment (HDR/EXR) state
        hasEnvironment: Boolean(state.scene && state.scene.environment),
        // Currently selected option
        currentSelection: currentBackgroundOption || 'none',
        // Detailed state data for debugging
        details: {
            backgroundFile: state.backgroundFile ? 
                `${state.backgroundFile.name} (${state.backgroundFile.type})` : null,
            backgroundTexture: state.backgroundTexture ? 'present' : null,
            environmentTexture: (state.scene && state.scene.environment) ? 'present' : null,
            backgroundMetadata: currentBackgroundMetadata ? 'present' : null,
            lightingMetadata: currentLightingMetadata ? 'present' : null
        }
    };
}

/**
 * Toggle visibility of a specific background option
 * @param {string} optionId - The ID of the option element to toggle ('background-option' or 'hdr-option')
 * @param {boolean} visible - Whether the option should be visible
 */
export function toggleOptionVisibility(optionId, visible) {
    const option = document.getElementById(optionId);
    if (!option) {
        console.warn(`Cannot toggle visibility: Option with ID '${optionId}' not found`);
        return;
    }
    
    // Get input and label elements specifically (not all children)
    const input = option.querySelector('input[type="radio"]');
    const label = option.querySelector('label');
    
    if (!input || !label) {
        console.warn(`Radio input or label not found in option with ID '${optionId}'`);
        return;
    }
    
    // Set display style for the elements
    // Radio buttons use inline-block, labels use inline
    input.style.display = visible ? 'inline-block' : 'none';
    label.style.display = visible ? 'inline' : 'none';
    
    // For debugging
    console.log(`Background option '${optionId}' visibility set to ${visible ? 'visible' : 'hidden'}`);
}

/**
 * Update all background UI elements based on the current state
 * @param {Object} uiState - The UI state object from determineBackgroundUIState
 */
function updateBackgroundUIVisibility(uiState) {
    // Log the current state for debugging
    console.debug('Updating background UI visibility with state:', uiState);
    
    // 1. Update the preview canvas opacity
    updateCanvasOpacity(currentBackgroundOption);
    
    // 2. Update message visibility - show the "no data" message only if BOTH background types are missing
    const hasAnyBackground = uiState.hasBackgroundImage || uiState.hasEnvironment;
    toggleBackgroundMessages(hasAnyBackground);
    
    // Helper function to update canvas opacity
    function updateCanvasOpacity(selectedValue) {
        const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
        const environmentPreviewCanvas = document.getElementById('hdr-preview-canvas');
        
        if (bgPreviewCanvas) {
            bgPreviewCanvas.style.opacity = (selectedValue === 'background') ? '1' : '0.3';
        }
        
        if (environmentPreviewCanvas) {
            environmentPreviewCanvas.style.opacity = (selectedValue === 'hdr') ? '1' : '0.3';
        }
    }
}

/**
 * Refresh all background UI based on current state
 * This is the main entry point to update all background UI elements
 */
function refreshBackgroundUI() {
    const uiState = determineBackgroundUIState();
    updateBackgroundUIVisibility(uiState);
}

/**
 * Initialize the World panel and cache DOM elements
 * @param {boolean} [forceReset=false] - Force reset even if already initialized
 */
export function initWorldPanel(forceReset = false) {
    // Only initialize if not already done, and only if we're in the debug phase
    // where the panel was explicitly requested to be initialized
    if (controlsInitialized && !forceReset) {
        console.log('World Panel already initialized, skipping');
        return;
    }
    
    // ALWAYS cleanup existing event listeners first
    cleanupEventListeners();
    
    // If we're already initialized but forcing a reset, just reset the critical state
    if (controlsInitialized && forceReset) {
        console.log('World Panel already initialized, but forcing reset of critical state');
        // Reset background related state on reinitialization
        currentBackgroundOption = 'none';
        currentBackgroundMetadata = null;
        currentLightingMetadata = null;
        backgroundTexture = null;
        environmentTexture = null;
        
        // Reset radio button visibility
        toggleOptionVisibility('background-option', false);
        toggleOptionVisibility('hdr-option', false);
        
        console.log('Continuing initialization to check for loaded files');
        
        // Get current state to check for loaded files
        const state = getState();
        const hasEnvironmentTexture = state.lightingFile !== null || (state.scene && state.scene.environment);
        const hasBackgroundTexture = state.backgroundTexture !== null || state.backgroundFile !== null;
        
        // Show options based on available files
        toggleOptionVisibility('hdr-option', hasEnvironmentTexture);
        toggleOptionVisibility('background-option', hasBackgroundTexture);
        console.log(`Updated radio visibility after reset - HDR: ${hasEnvironmentTexture}, Background: ${hasBackgroundTexture}`);
        
        // Set up event listeners again
        setupBgToggleListener();
        
        // Also update the background UI
        refreshBackgroundUI();
        return;
    }
    
    console.debug('Initializing World Panel...');
    
    // Look for world-tab (from world-panel.html) or world-tab-container (from debugger-scene.html)
    const worldPanel = document.getElementById('world-tab') || document.getElementById('world-tab-container');
    
    if (!worldPanel) {
        console.error('World panel elements not found. Panel may not be loaded in DOM yet.');
        return;
    }
    
    console.debug('World panel found, initializing...');
    
    // Reset background related state on initialization
    currentBackgroundOption = 'none';
    currentBackgroundMetadata = null;
    currentLightingMetadata = null;
    backgroundTexture = null;
    environmentTexture = null;
    
    // Initially hide background and HDR options until content is loaded
    toggleOptionVisibility('background-option', false);
    toggleOptionVisibility('hdr-option', false);

    // Initialize value displays on sliders and set up event listeners
    document.querySelectorAll('.control-group input[type="range"]').forEach(slider => {
        const valueDisplay = slider.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = slider.value;
        }
        
        // Add input event listener to update value display when dragging
        const inputHandler = function() {
            const valueDisplay = this.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = this.value;
            }
        };
        
        addTrackedEventListener(slider, 'input', inputHandler);
    });
    
    // Initialize collapsible functionality
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
    if (collapsibleHeaders) {
        collapsibleHeaders.forEach(header => {
            const clickHandler = function() {
                const content = this.nextElementSibling;
                const indicator = this.querySelector('.collapse-indicator');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    indicator.textContent = '[-]';
                } else {
                    content.style.display = 'none';
                    indicator.textContent = '[+]';
                }
            };
            
            addTrackedEventListener(header, 'click', clickHandler);
        });
    }
    
    // Set up event listeners for lighting controls
    setupLightingControls();
    
    // Set up Background toggle event listener
    setupBgToggleListener();
    
    // Add event listener for background updates from background-util.js
    const backgroundUpdateHandler = function(e) {
        const texture = e.detail.texture;
        if (texture) {
            console.log('Background texture updated event received');
            
            // Extract metadata from the texture
            let width = 0;
            let height = 0;
            let type = 'Unknown Texture';
            let fileName = 'Background Texture';
            
            // Get dimensions
            if (texture.image) {
                width = texture.image.width || 0;
                height = texture.image.height || 0;
            }
            
            // Determine type
            if (texture.isHDRTexture) {
                type = 'HDR Texture';
            } else if (texture.isCompressedTexture) {
                type = 'Compressed Texture';
            } else if (texture.isDataTexture) {
                type = 'Data Texture';
            } else if (texture.isTexture) {
                type = 'Standard Texture';
            }
            
            // Try to get filename from userData if available
            if (texture.userData && texture.userData.fileName) {
                fileName = texture.userData.fileName;
            }
            
            // Create metadata
            const metadata = {
                fileName: fileName,
                type: type,
                dimensions: { width, height },
                // Estimate file size based on dimensions and encoding
                fileSizeBytes: (width * height * 4) // Rough estimate: pixels * 4 bytes per pixel
            };
            
            // Update the UI with the texture metadata
            updateBackgroundInfo(metadata);
            
            // Store the texture for preview rendering
            backgroundTexture = texture;
            
            // Render the preview using the texture
            renderBackgroundPreview(texture);
        }
    };
    
    addTrackedEventListener(document, 'background-updated', backgroundUpdateHandler);
    
    // Mark as initialized
    controlsInitialized = true;
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
        const ambientHandler = (e) => {
            const value = parseFloat(e.target.value);
            updateLighting({
                ambient: { intensity: value }
            });
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        };
        
        addTrackedEventListener(ambientIntensityControl, 'input', ambientHandler);
    }
    
    // Set up directional light intensity control
    if (directionalIntensityControl) {
        const directionalHandler = (e) => {
            const value = parseFloat(e.target.value);
            updateLighting({
                directional: { intensity: value }
            });
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        };
        
        addTrackedEventListener(directionalIntensityControl, 'input', directionalHandler);
    }
    
    // Set up exposure control
    if (exposureControl) {
        const exposureHandler = (e) => {
            const value = parseFloat(e.target.value);
            updateExposure(value);
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        };
        
        addTrackedEventListener(exposureControl, 'input', exposureHandler);
    }
    
    // Set up reset lighting button
    if (resetLightingButton) {
        const resetHandler = () => {
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
            
            // Don't clear lighting info if we have an environment texture
            const state = getState();
            const hasEnvironmentTexture = state.scene && state.scene.environment !== null;
            
            if (!hasEnvironmentTexture) {
                // Only clear lighting info if no environment texture is loaded
                clearLightingInfo();
            }
            
            // Update slider visibility based on whether environment is loaded
            updateSliderVisibility(hasEnvironmentTexture);
        };
        
        addTrackedEventListener(resetLightingButton, 'click', resetHandler);
    }
    
    // Initialize message visibility
    updateLightingMessage();
}

/**
 * Set up listener for Background radio button selection
 */
function setupBgToggleListener() {
    // Find all background toggle radio buttons
    const backgroundOptions = document.querySelectorAll('input[name="bg-option"]');
    const state = getState();
    
    // Initial selection based on loaded files
    let initialOption = 'none'; // Default is none
    
    // Always default to 'none' unless otherwise specified
    const selectedRadio = document.querySelector(`input[name="bg-option"][value="${initialOption}"]`);
    if (selectedRadio) {
        selectedRadio.checked = true;
        currentBackgroundOption = initialOption;
    }
    
    // Process UI state based on available resources
    const uiState = determineBackgroundUIState();
    updateBackgroundUIVisibility(uiState);
    
    // CRITICAL FIX: Remove any existing change listeners before adding new ones
    backgroundOptions.forEach(option => {
        // Clone the node to remove all existing event listeners
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
    });
    
    // Now get the fresh nodes and add new listeners
    const freshBackgroundOptions = document.querySelectorAll('input[name="bg-option"]');
    
    // Add event listeners to each radio button
    freshBackgroundOptions.forEach(option => {
        const changeHandler = function() {
            if (this.checked) {
                const selectedValue = this.value;
                currentBackgroundOption = selectedValue;
                
                console.log(`Background option changed to: ${selectedValue}`);
                
                // Get scene from state
                const state = getState();
                if (!state.scene) {
                    console.error('Cannot update background - scene not found in state');
                    return;
                }
                
                // Apply the appropriate background based on selection
                switch (selectedValue) {
                    case 'none':
                        // Set background to null or a dark color
                        setNullBackground(state.scene);
                        console.log('Background set to none');
                        break;
                        
                    case 'hdr':
                        // Only apply HDR/EXR background if we have one
                        if (state.scene.environment) {
                            console.log('Setting background to HDR/EXR environment map');
                            state.scene.background = state.scene.environment;
                            console.log('HDR/EXR background applied successfully:', state.scene.environment);
                        } else if (environmentTexture) {
                            // Try using the cached environment texture if the scene doesn't have one
                            console.log('Using cached environment texture');
                            state.scene.background = environmentTexture;
                            // Also set it as the environment if not already set
                            if (!state.scene.environment) {
                                state.scene.environment = environmentTexture;
                            }
                        } else if (state.lightingFile) {
                            // If we have a lighting file but no texture, try to reload it
                            console.log('Attempting to reload environment texture from lighting file');
                            
                            // Import lighting utility and load the texture again
                            import('../../util/scene/lighting-manager.js').then(lightingModule => {
                                if (lightingModule.setupEnvironmentLighting && state.lightingFile) {
                                    lightingModule.setupEnvironmentLighting(state.lightingFile)
                                        .then(newTexture => {
                                            if (newTexture) {
                                                console.log('Successfully reloaded environment texture');
                                                state.scene.background = newTexture;
                                                state.scene.environment = newTexture;
                                                environmentTexture = newTexture;
                                            }
                                        })
                                        .catch(error => {
                                            console.error('Error reloading environment texture:', error);
                                        });
                                }
                            });
                        } else {
                            console.warn('No HDR/EXR environment map available');
                            // Fall back to null background but KEEP the radio selection
                            setNullBackground(state.scene);
                        }
                        break;
                        
                    case 'background':
                        // Only apply background texture if we have one
                        if (state.backgroundTexture) {
                            console.log('Setting background to loaded background texture');
                            state.scene.background = state.backgroundTexture;
                        } else if (backgroundTexture) {
                            // Try using the cached background texture if the state doesn't have one
                            console.log('Using cached background texture');
                            state.scene.background = backgroundTexture;
                        } else {
                            console.warn('No background texture available');
                            // Fall back to null background but KEEP the radio selection
                            setNullBackground(state.scene);
                        }
                        break;
                }
                
                // Update canvas opacity based on selection
                updateCanvasOpacity(selectedValue);
            }
        };
        
        // Add the event listener and track it for cleanup
        addTrackedEventListener(option, 'change', changeHandler);
    });
    
    // Helper function to update canvas opacity based on selection
    function updateCanvasOpacity(selectedValue) {
        const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
        const environmentPreviewCanvas = document.getElementById('hdr-preview-canvas');
        
        if (bgPreviewCanvas) {
            bgPreviewCanvas.style.opacity = (selectedValue === 'background') ? '1' : '0.3';
        }
        
        if (environmentPreviewCanvas) {
            environmentPreviewCanvas.style.opacity = (selectedValue === 'hdr') ? '1' : '0.3';
        }
    }
}

/**
 * Toggle visibility of background messages based on whether environment texture or background is loaded
 * @param {boolean} hasContent - Whether environment texture or background is loaded
 * @param {boolean} [forceShow=false] - Force show/hide the data info regardless of content status
 */
export function toggleBackgroundMessages(hasContent, forceShow = false) {
    const noBackgroundMessage = document.querySelector('.no-background-message');
    const backgroundDataInfo = document.querySelector('.background-data-info');
    
    if (!noBackgroundMessage || !backgroundDataInfo) {
        console.warn('Background message elements not found');
        return;
    }
    
    if (hasContent || forceShow) {
        console.log("Revealing Background Data section in World Panel");
        // We have content, so show the data info and hide the "no data" message
        noBackgroundMessage.style.display = 'none';
        backgroundDataInfo.style.display = 'block';
    } else {
        console.log("Hiding Background Data section in World Panel");
        // No content, show the "no data" message and hide the data info
        noBackgroundMessage.style.display = 'block';
        backgroundDataInfo.style.display = 'none';
    }
}

/**
 * Toggle visibility of lighting messages based on whether environment lighting is loaded
 * @param {boolean} hasContent - Whether environment lighting is loaded
 * @param {boolean} [forceShow=false] - Force show/hide the data info regardless of content status
 */
function toggleLightingMessages(hasContent, forceShow = false) {
    const noDataMessage = document.querySelector('.no-data-message');
    const lightingDataInfo = document.querySelector('.lighting-data-info');
    
    if (!noDataMessage || !lightingDataInfo) {
        console.warn('Lighting message elements not found');
        return;
    }
    
    if (hasContent || forceShow) {
        noDataMessage.style.display = 'none';
        lightingDataInfo.style.display = 'block';
    } else {
        noDataMessage.style.display = 'block';
        lightingDataInfo.style.display = 'none';
    }
}

/**
 * Update lighting message visibility based on whether environment lighting is loaded
 */
function updateLightingMessage() {
    const state = getState();
    
    const hasEnvironment = state.scene && state.scene.environment;
    
    // Use the standardized toggle function
    toggleLightingMessages(hasEnvironment);
    
    // Update slider visibility based on environment presence
    updateSliderVisibility(hasEnvironment);
}

/**
 * Update slider visibility based on whether HDR/EXR is loaded
 * @param {boolean} hasEnvironment - Whether environment lighting is loaded
 */
function updateSliderVisibility(hasEnvironment) {
    const ambientControl = document.querySelector('.ambient-control');
    const directionalControl = document.querySelector('.directional-control');
    const exposureControl = document.querySelector('.exposure-control');
    
    if (!ambientControl || !directionalControl || !exposureControl) {
        console.warn('Could not find slider controls for visibility update');
        return;
    }
    
    if (hasEnvironment) {
        // When HDR/EXR is loaded: hide ambient/directional, show exposure
        ambientControl.style.display = 'none';
        directionalControl.style.display = 'none';
        exposureControl.style.display = 'flex';
    } else {
        // When no HDR/EXR is loaded: show ambient/directional, hide exposure
        ambientControl.style.display = 'flex';
        directionalControl.style.display = 'flex';
        exposureControl.style.display = 'none';
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
        console.warn('Panel not initialized yet, storing metadata for later');
        return;
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
    console.log('Showing lighting data info and hiding no data message');
    toggleLightingMessages(true);
    
    // Make the HDR option visible since we have environment lighting
    toggleOptionVisibility('hdr-option', true);
    console.log('Making HDR/EXR radio option visible');
    
    // Update slider visibility - we have HDR/EXR data
    updateSliderVisibility(true);
    
    // IMPORTANT: We no longer auto-select the HDR/EXR option
    // The "None" option will remain selected by default
    // Only update the radio option if it doesn't exist yet
    console.log('HDR/EXR radio option is available but not auto-selected');
    
    // Make sure any collapsible content is still properly collapsed
    const metadataContents = document.querySelectorAll('.metadata-content');
    if (metadataContents && metadataContents.length > 0) {
        console.log('Ensuring collapsible content is collapsed initially');
        metadataContents.forEach(content => {
            content.style.display = 'none';
        });
        
        // Make sure any indicators show the right symbol
        const indicators = document.querySelectorAll('.collapse-indicator');
        if (indicators && indicators.length > 0) {
            indicators.forEach(indicator => {
                // Always set to '+' to indicate collapsed state
                indicator.textContent = '[+]';
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
 * @param {HTMLCanvasElement} [externalCanvas] - Optional external canvas to render on
 * @param {HTMLElement} [externalNoImageMessage] - Optional external message element
 * @returns {boolean} - Whether preview was rendered successfully
 */
export function renderEnvironmentPreview(texture, externalCanvas, externalNoImageMessage) {
    // Look for the canvas element - either use provided external one or find in DOM
    const canvas = externalCanvas || document.getElementById('hdr-preview-canvas');
    const noImageMessage = externalNoImageMessage || document.getElementById('no-image-message');
    
    // If canvas not found, panel may not be initialized yet
    if (!canvas) {
        console.error('HDR preview canvas not found, cannot render preview');
        return false;
    }
    
    // If texture doesn't have image data, show error message
    if (!texture || !texture.image) {
        console.warn('No texture or image data found:', texture);
        showNoImageMessage(canvas, noImageMessage, 'No image data available.');
        return false;
    }
    
    console.log('Rendering environment texture preview as 3D sphere');
    
    // Hide the no image message
    if (noImageMessage) noImageMessage.style.display = 'none';
    
    // Make canvas visible
    canvas.style.display = 'block';
    
    // Show background data info and hide no background message
    toggleBackgroundMessages(true);
    
    // Set canvas size (always square for the sphere preview)
    const previewSize = externalCanvas ? Math.max(canvas.width, canvas.height) : 260;
    
    // Always enforce a square aspect ratio regardless of container dimensions
    canvas.width = previewSize;
    canvas.height = previewSize;
    
    // Apply class to ensure proper scaling with CSS
    canvas.classList.add('square-preview');
    
    try {
        // Create a mini Three.js scene for the sphere preview
        // Use the imported THREE directly
        createSpherePreview(THREE, texture, canvas, noImageMessage);
        
        return true;
    } catch (error) {
        console.error('Error rendering HDR preview as sphere:', error);
    }
    
    return true;
}

/**
 * Create a 3D sphere preview with the environment texture
 * @param {Object} THREE - The Three.js library
 * @param {THREE.Texture} texture - The environment texture
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} noImageMessage - The no image message element
 */
export function createSpherePreview(THREE, texture, canvas, noImageMessage) {
    try {
        // Create a mini renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        // Critical for HDR/EXR: set proper encoding and tone mapping
        // Update to use modern THREE.js properties
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        
        // Create a mini scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111); // Dark background
        
        // Set the environment texture for the scene - this affects reflective materials
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        
        // Create a mini camera - move it back a bit more to make the sphere appear smaller
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.z = 3.2; // Increased camera distance to make sphere smaller
        
        // Create a 3D sphere with high polygon count for smooth reflections
        // Make the sphere slightly smaller
        const sphereGeometry = new THREE.SphereGeometry(0.8, 64, 64);
        
        // Create a metallic material
        const metallicMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.05,
            envMapIntensity: 1.0
        });
        
        // Create and add the metallic sphere
        const sphere = new THREE.Mesh(sphereGeometry, metallicMaterial);
        scene.add(sphere);
        
        // Add some lighting - even with environment lighting, we need some direct light
        // for better highlights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);
        
        // Add a directional light for highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);
        
        // Add a point light for additional dimension
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-1, 1, 0.5);
        scene.add(pointLight);
        
        let animationFrameId;
        const clock = new THREE.Clock();
        
        // Add a simple message to indicate the sphere is interactive
        const interactiveHint = document.createElement('div');
        interactiveHint.style.position = 'absolute';
        interactiveHint.style.bottom = '5px';
        interactiveHint.style.left = '50%';
        interactiveHint.style.transform = 'translateX(-50%)';
        interactiveHint.style.fontSize = '10px';
        interactiveHint.style.color = 'rgba(255,255,255,0.7)';
        interactiveHint.style.pointerEvents = 'none';
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(interactiveHint);
        
        // Initial slight rotation to show it's 3D
        sphere.rotation.y = Math.PI / 6;
        sphere.rotation.x = Math.PI / 12;
        
        // Create dedicated OrbitControls for the preview sphere
        // We need to dynamically import it for this specific use case
        let previewControls = null;
        let previewControlsReady = false;
        
        // Function to dynamically import and create OrbitControls
        const initPreviewControls = async () => {
            try {
                // Use dynamic import to get OrbitControls
                const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
                
                // Create dedicated controls for this preview only
                previewControls = new OrbitControls(camera, canvas);
                
                // Configure the preview controls
                previewControls.enableDamping = true;
                previewControls.dampingFactor = 0.05;
                previewControls.rotateSpeed = 1.0;
                previewControls.enableZoom = false;
                previewControls.enablePan = false;
                
                // Mark as ready
                previewControlsReady = true;
                
                console.log('Preview controls initialized successfully');
            } catch (error) {
                console.error('Failed to initialize preview controls:', error);
            }
        };
        
        // Initialize the controls
        initPreviewControls();
        
        function renderSphere() {
            animationFrameId = requestAnimationFrame(renderSphere);
            
            const delta = clock.getDelta();
            
            // Update preview controls if available
            if (previewControlsReady && previewControls) {
                previewControls.update();
            } else {
                // If no controls yet, add a very slow rotation to show it's 3D
                sphere.rotation.y += delta * 0.1;
            }
            
            renderer.render(scene, camera);
        }
        
        // Start the animation
        renderSphere();
        
        // Store the animation frame ID for cleanup
        canvas.setAttribute('data-animation-id', animationFrameId);
        
        // Add cleanup function when tab changes or element is removed
        const cleanup = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            
            // Remove the interactive hint
            if (interactiveHint && interactiveHint.parentElement) {
                interactiveHint.parentElement.removeChild(interactiveHint);
            }
            
            // Dispose of the preview controls if they exist
            if (previewControls) {
                previewControls.dispose();
                previewControls = null;
            }
            
            // Proper disposal of Three.js resources
            renderer.dispose();
            sphereGeometry.dispose();
            metallicMaterial.dispose();
            
            // Remove references
            sphere.geometry = null;
            sphere.material = null;
            scene.remove(sphere);
        };
        
        // Store cleanup function for later use
        canvas.cleanup = cleanup;
        console.log('Successfully rendered environment map as interactive 3D sphere');
    } catch (error) {
        console.error('Error in createSpherePreview:', error);
    }
}

/**
 * Show "No image data" message
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} messageEl - The message element to show
 * @param {string} message - The error message to display
 */
export function showNoImageMessage(canvas, messageEl, message = 'No image data available.') {
    // Hide canvas
    if (canvas) {
        canvas.style.display = 'none';
    }
    
    // Set error message if provided
    if (messageEl) {
        messageEl.textContent = message;
    }
    
    // Use the standardized toggle function to show/hide appropriate messages
    toggleLightingMessages(false);
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
    toggleLightingMessages(false);
    
    // Hide the HDR/EXR radio option since we no longer have environment lighting
    toggleOptionVisibility('hdr-option', false);
    console.log('Hiding HDR/EXR radio option');
    
    // Hide background info and show no background message
    toggleBackgroundMessages(false);
    
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
            indicator.textContent = '[+]';
        });
    }
    
    // Update slider visibility - we have no HDR/EXR data
    updateSliderVisibility(false);
    
    // Clean up any ThreeJS resources
    const canvas = document.getElementById('hdr-preview-canvas');
    if (canvas) {
        // Execute cleanup function if it exists
        if (typeof canvas.cleanup === 'function') {
            canvas.cleanup();
            canvas.cleanup = null;
        }
        
        // Cancel any animation frame
        const animationId = canvas.getAttribute('data-animation-id');
        if (animationId) {
            cancelAnimationFrame(parseInt(animationId, 10));
            canvas.removeAttribute('data-animation-id');
        }
        
        // Clear the canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
    }
}

/**
 * Update the background info display with metadata
 * @param {Object} metadata - The background image metadata
 * @param {boolean} [skipRendering=false] - Whether to skip rendering the preview
 */
export function updateBackgroundInfo(metadata, skipRendering = false) {
    console.log('Updating background info with metadata:', metadata.fileName, metadata.type);
    
    // Store the metadata for later use if the panel isn't ready yet
    currentBackgroundMetadata = metadata;
    
    // Try to initialize the panel if not already done
    if (!controlsInitialized) {
        console.warn('Panel not initialized yet, storing metadata for later');
        return;
    }
    
    // Find the UI elements
    const filenameEl = document.getElementById('bg-filename');
    const typeEl = document.getElementById('bg-type');
    const resolutionEl = document.getElementById('bg-resolution');
    const sizeEl = document.getElementById('bg-size');
    
    // Make sure all elements exist
    if (!filenameEl || !typeEl || !resolutionEl || !sizeEl) {
        console.error('Cannot update background info: UI elements not found');
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
    
    // Make the background option visible since we have a background image
    toggleOptionVisibility('background-option', true);
    console.log('Making Background Image radio option visible');
    
    // Respect the current radio selection without changing it on automatic background updates
    // Only auto-select the option if this is a fresh load (no option selected yet)
    if (currentBackgroundOption === null || currentBackgroundOption === undefined) {
        // First-time initialization - default to 'none' but don't change scene background
        const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
        if (noneRadio) {
            noneRadio.checked = true;
            currentBackgroundOption = 'none';
        }
    } else {
        // Make sure the correct radio button matches our stored selection
        const selectedRadio = document.querySelector(`input[name="bg-option"][value="${currentBackgroundOption}"]`);
        if (selectedRadio) {
            selectedRadio.checked = true;
        }
    }
    
    // Make sure any collapsible content is still properly collapsed
    const metadataContents = document.querySelectorAll('.metadata-content');
    if (metadataContents && metadataContents.length > 0) {
        console.log('Ensuring collapsible content is collapsed initially');
        metadataContents.forEach(content => {
            if (!content.classList.contains('active')) {
                content.style.display = 'none';
            }
        });
        
        // Make sure any indicators show the right symbol
        const indicators = document.querySelectorAll('.collapse-indicator');
        if (indicators && indicators.length > 0) {
            indicators.forEach(indicator => {
                // Always set to '+' to indicate collapsed state
                indicator.textContent = '[+]';
            });
        }
    }
    
    // Only render preview if not skipped and we have a file in state
    if (!skipRendering) {
        const state = getState();
        if (state.backgroundFile && !backgroundTexture) {
            console.log('Found background file in state, rendering preview');
            // Create a preview of the background image
            renderBackgroundPreview(state.backgroundFile);
        }
    }
}

/**
 * Render the background image preview on canvas
 * @param {File|Blob|THREE.Texture} fileOrTexture - The background file or texture to render
 * @returns {boolean} - Whether preview was rendered successfully
 */
export function renderBackgroundPreview(fileOrTexture) {
    // Simple prevention of recursive calls
    if (isLoadingEnvironmentFile) {
        console.log('Already loading an HDR/EXR file, preventing recursive calls');
        return true;
    }
    
    // Look for the canvas element
    const canvas = document.getElementById('bg-preview-canvas');
    const noImageMessage = document.getElementById('no-bg-image-message');
    
    // If canvas not found, panel may not be initialized yet
    if (!canvas) {
        console.error('Background preview canvas not found, cannot render preview');
        return false;
    }
    
    // Store the texture for later use
    backgroundTexture = fileOrTexture;
    
    // If there's no file or texture, show error message
    if (!fileOrTexture) {
        console.warn('No background file or texture provided');
        showNoBackgroundImageMessage(canvas, noImageMessage, 'No image data available.');
        return false;
    }
    
    console.log('Rendering background image preview for:', 
                typeof fileOrTexture === 'object' && fileOrTexture.isTexture 
                    ? 'Texture object' 
                    : (fileOrTexture.name || 'Unknown file'));
    
    // Hide the no image message
    if (noImageMessage) noImageMessage.style.display = 'none';
    
    // Make canvas visible
    canvas.style.display = 'block';
    
    // Show background data info and hide no background message
    toggleBackgroundMessages(true);

    try {
        // Different handling based on what type of data we have
        if (fileOrTexture instanceof File || fileOrTexture instanceof Blob) {
            const fileName = fileOrTexture.name ? fileOrTexture.name.toLowerCase() : '';
            const isEXR = fileName.endsWith('.exr');
            const isHDR = fileName.endsWith('.hdr');
            
            // Special handling for EXR/HDR files
            if (isEXR || isHDR) {
                console.log(`Handling ${isEXR ? 'EXR' : 'HDR'} file with special loader`);
                
                // Set loading flag to prevent recursion
                isLoadingEnvironmentFile = true;
                
                // Create metadata early for better UX
                if (!currentBackgroundMetadata) {
                    currentBackgroundMetadata = {
                        fileName: fileOrTexture.name,
                        type: isEXR ? 'EXR' : 'HDR',
                        dimensions: { width: 0, height: 0 }, // Will be updated when loaded
                        fileSizeBytes: fileOrTexture.size
                    };
                    updateBackgroundInfo(currentBackgroundMetadata);
                }
                
                // Set canvas to square for sphere preview
                const previewSize = 260;
                canvas.width = previewSize;
                canvas.height = previewSize;
                
                // Load the file with the appropriate loader
                const loadHDRorEXR = async () => {
                    try {
                        // Use the statically imported THREE
                        // Choose the right loader based on file type
                        let loader;
                        if (isEXR) {
                            const { EXRLoader } = await import('three/addons/loaders/EXRLoader.js');
                            loader = new EXRLoader();
                        } else {
                            const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
                            loader = new RGBELoader();
                        }
                        
                        // Create a file URL
                        const url = URL.createObjectURL(fileOrTexture);
                        
                        // Load the texture
                        loader.load(url, 
                            // onLoad callback
                            (texture) => {
                                // Update metadata with actual dimensions
                                if (currentBackgroundMetadata) {
                                    currentBackgroundMetadata.dimensions = {
                                        width: texture.image.width,
                                        height: texture.image.height
                                    };
                                    // Important: skip updateBackgroundInfo's render step
                                    // to prevent recursive loading
                                    // Just update UI fields directly
                                    const widthHeight = `${texture.image.width} × ${texture.image.height}`;
                                    const resolutionEl = document.getElementById('bg-resolution');
                                    if (resolutionEl) {
                                        resolutionEl.textContent = widthHeight;
                                    }
                                }
                                
                                // Create sphere preview with the texture
                                createSpherePreview(THREE, texture, canvas, noImageMessage);
                                
                                // Clean up URL object
                                URL.revokeObjectURL(url);
                                
                                // Clear the loading flag
                                isLoadingEnvironmentFile = false;
                            },
                            // onProgress callback
                            (xhr) => {
                                const percentComplete = xhr.loaded / xhr.total * 100;
                                console.log(`${isEXR ? 'EXR' : 'HDR'} loading: ${Math.round(percentComplete)}%`);
                            },
                            // onError callback
                            (error) => {
                                console.error(`Error loading ${isEXR ? 'EXR' : 'HDR'} file:`, error);
                                showNoBackgroundImageMessage(canvas, noImageMessage, `Error loading ${isEXR ? 'EXR' : 'HDR'} file`);
                                URL.revokeObjectURL(url);
                                
                                // Clear the loading flag on error
                                isLoadingEnvironmentFile = false;
                            }
                        );
                    } catch (error) {
                        console.error(`Error in ${isEXR ? 'EXR' : 'HDR'} loading:`, error);
                        showNoBackgroundImageMessage(canvas, noImageMessage, `Error: Could not load ${isEXR ? 'EXR' : 'HDR'} file`);
                        
                        // Clear the loading flag on error
                        isLoadingEnvironmentFile = false;
                    }
                };
                
                // Start loading
                loadHDRorEXR();
                return true;
            }
            
            // For standard image files, create a texture and use 3D sphere preview
            const url = URL.createObjectURL(fileOrTexture);
            const img = new Image();
            
            img.onload = function() {
                // Get file dimensions
                const width = img.width;
                const height = img.height;
                
                // Update metadata if needed
                if (!currentBackgroundMetadata) {
                    currentBackgroundMetadata = {
                        fileName: fileOrTexture.name,
                        type: fileOrTexture.type || 'Image',
                        dimensions: { width, height },
                        fileSizeBytes: fileOrTexture.size
                    };
                    updateBackgroundInfo(currentBackgroundMetadata);
                }
                
                // Set canvas size (square for the sphere preview)
                const previewSize = 260;
                canvas.width = previewSize;
                canvas.height = previewSize;
                
                // Create texture from loaded image and create sphere preview
                try {
                    // Use the statically imported THREE
                    const textureLoader = new THREE.TextureLoader();
                    const texture = textureLoader.load(url);
                    
                    // Use the same sphere preview as for environment maps
                    createSpherePreview(THREE, texture, canvas, noImageMessage);
                    
                    // Clean up URL object after texture is loaded
                    URL.revokeObjectURL(url);
                } catch (error) {
                    console.error('Error creating sphere preview:', error);
                    
                    // Fall back to 2D canvas if sphere preview fails
                    const ctx = canvas.getContext('2d');
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    URL.revokeObjectURL(url);
                }
            };
            
            img.onerror = function() {
                console.error('Error loading background image');
                showNoBackgroundImageMessage(canvas, noImageMessage, 'Error loading image');
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
            return true;
        } else if (typeof fileOrTexture === 'object' && fileOrTexture.isTexture) {
            // For THREE.Texture objects, use sphere preview directly
            
            // Create metadata if not present
            if (!currentBackgroundMetadata) {
                currentBackgroundMetadata = {
                    fileName: fileOrTexture.userData?.fileName || 'Background Texture',
                    type: fileOrTexture.isHDRTexture ? 'HDR Texture' : 'Standard Texture',
                    dimensions: { 
                        width: fileOrTexture.image ? fileOrTexture.image.width : 0, 
                        height: fileOrTexture.image ? fileOrTexture.image.height : 0 
                    },
                    fileSizeBytes: 0 // Unknown size
                };
                updateBackgroundInfo(currentBackgroundMetadata);
            }
            
            // Set canvas size (square for the sphere preview)
            const previewSize = 260;
            canvas.width = previewSize;
            canvas.height = previewSize;
            
            try {
                // Use the statically imported THREE
                createSpherePreview(THREE, fileOrTexture, canvas, noImageMessage);
                return true;
            } catch (error) {
                console.error('Error creating sphere preview for texture:', error);
            }
            return true;
        } else {
            console.error('Unknown fileOrTexture type:', fileOrTexture);
            showNoBackgroundImageMessage(canvas, noImageMessage, 'Unsupported background format.');
            return false;
        }

    } catch (error) {
        console.error('Error in renderBackgroundPreview:', error);
        showNoBackgroundImageMessage(canvas, noImageMessage, `Error: ${error.message}`);
        return false;
    }
}

/**
 * Show "No background image data" message
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} messageEl - The message element to show
 * @param {string} message - The error message to display
 */
export function showNoBackgroundImageMessage(canvas, messageEl, message = 'No image data available.') {
    // Hide canvas
    if (canvas) {
        canvas.style.display = 'none';
    }
    
    // Set error message if provided
    if (messageEl) {
        messageEl.textContent = message;
    }
    
    // Use the standardized toggle function to show/hide appropriate messages
    toggleBackgroundMessages(false);
}

/**
 * Update the World panel with current state
 */
export function updateWorldPanel() {   
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
    
    // Get the current state for file existence - be more thorough with checks
    const hasEnvironmentTexture = state.lightingFile !== null || 
                               (state.scene && state.scene.environment) || 
                               currentLightingMetadata !== null;
                               
    const hasBackgroundTexture = state.backgroundTexture !== null || 
                              state.backgroundFile !== null || 
                              currentBackgroundMetadata !== null;
    
    // Log the current state for debugging
    console.log('Updating world panel with state:', {
        hasEnvironmentTexture,
        hasBackgroundTexture,
        lightingFile: state.lightingFile ? state.lightingFile.name : null,
        backgroundFile: state.backgroundFile ? state.backgroundFile.name : null,
        environment: state.scene && state.scene.environment ? 'present' : null,
        backgroundTexture: state.backgroundTexture ? 'present' : null,
        metadata: {
            lighting: currentLightingMetadata ? 'present' : null,
            background: currentBackgroundMetadata ? 'present' : null
        }
    });
    
    // Always update radio button visibility based on current state
    toggleOptionVisibility('hdr-option', hasEnvironmentTexture);
    toggleOptionVisibility('background-option', hasBackgroundTexture);
    
    console.log(`Radio button visibility updated - HDR: ${hasEnvironmentTexture}, Background: ${hasBackgroundTexture}`);
    
    // First render any available previews
    
    // If we have an environment texture, render its preview
    if (state.scene && state.scene.environment && !environmentTexture) {
        environmentTexture = state.scene.environment;
        renderEnvironmentPreview(environmentTexture);
    }
    
    // If we have a background file, render its preview
    if (state.backgroundFile && !backgroundTexture) {
        backgroundTexture = state.backgroundFile;
        renderBackgroundPreview(backgroundTexture);
    }
    
    // Update background UI with our centralized system
    refreshBackgroundUI();
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
}

// Make the test function available globally for debugging
window.testRenderExr = testRenderExr;

/**
 * Generate a preview for HDR/EXR files without affecting the world panel
 * This is specifically for the drop zone preview
 * @param {File} file - The HDR/EXR file
 * @param {HTMLElement} previewElement - The element to show the preview in
 */
export function generatePreviewOnly(file, previewElement) {
    if (!file || !previewElement) return;
    
    // Check if we've already generated a texture for this file
    const cachedTexture = backgroundTextureCache.get(file.name);
    if (cachedTexture) {
        console.log('Using cached texture for preview:', file.name);
        displayCachedPreview(cachedTexture, previewElement);
        return;
    }
    
    console.log('Generating standalone preview for:', file.name);
    
    // Create a canvas for the preview
    const canvas = document.createElement('canvas');
    canvas.width = 100;  // Small size for the dropzone preview
    canvas.height = 100;
    
    // Use appropriate loader based on file extension
    const extension = file.name.split('.').pop().toLowerCase();
    const isEXR = extension === 'exr';
    const isHDR = extension === 'hdr';
    
    // Load and display the preview
    Promise.resolve().then(async () => {
        try {
            // Create a URL for the file
            const url = URL.createObjectURL(file);
            
            // Select the appropriate loader
            let loader;
            if (isEXR) {
                const { EXRLoader } = await import('three/addons/loaders/EXRLoader.js');
                loader = new EXRLoader();
            } else {
                const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
                loader = new RGBELoader();
            }
            
            // Load the texture
            loader.load(
                url,
                (texture) => {
                    // Store texture in the cache for future use
                    texture.userData = { fileName: file.name };
                    backgroundTextureCache.set(file.name, texture);
                    
                    // Also store in state for use with debugging
                    import('../../util/state/scene-state.js').then(stateModule => {
                        stateModule.updateState({
                            backgroundTexture: texture
                        });
                    });
                    
                    // Clear the preview element and display the preview
                    while (previewElement.firstChild) {
                        previewElement.removeChild(previewElement.firstChild);
                    }
                    previewElement.textContent = '';
                    previewElement.appendChild(canvas);
                    
                    // Create a mini 3D preview
                    createSimplePreview(THREE, texture, canvas);
                    
                    // Clean up
                    URL.revokeObjectURL(url);
                },
                (xhr) => {
                    // Update progress
                    if (xhr.lengthComputable) {
                        const percentComplete = xhr.loaded / xhr.total * 100;
                        previewElement.textContent = `Loading: ${Math.round(percentComplete)}%`;
                    }
                },
                (error) => {
                    console.error('Error loading preview:', error);
                    previewElement.textContent = 'Preview unavailable';
                    URL.revokeObjectURL(url);
                }
            );
        } catch (error) {
            console.error('Error generating preview:', error);
            previewElement.textContent = 'Preview unavailable';
        }
    });
}

/**
 * Display a cached texture in the preview element
 * @param {THREE.Texture} texture - The cached texture
 * @param {HTMLElement} previewElement - The element to display in
 */
function displayCachedPreview(texture, previewElement) {
    // Clear the preview element
    while (previewElement.firstChild) {
        previewElement.removeChild(previewElement.firstChild);
    }
    previewElement.textContent = '';
    
    // Create a canvas for the preview
    const canvas = document.createElement('canvas');
    canvas.width = 100;  // Small size for the dropzone preview
    canvas.height = 100;
    previewElement.appendChild(canvas);
    
    // Create a mini 3D preview
    createSimplePreview(THREE, texture, canvas);
}

/**
 * Create a simple 3D preview using Three.js
 * @param {Object} THREE - The Three.js library
 * @param {THREE.Texture} texture - The texture to display
 * @param {HTMLCanvasElement} canvas - The canvas to render on
 */
export function createSimplePreview(THREE, texture, canvas) {
    // Create renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(canvas.width, canvas.height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.z = 3;
    
    // Create sphere with material
    const geometry = new THREE.SphereGeometry(0.8, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.05,
        envMapIntensity: 1.0
    });
    
    // Set the texture as environment map
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    
    // Create mesh
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Auto rotate the sphere
    let animationId;
    function animate() {
        animationId = requestAnimationFrame(animate);
        sphere.rotation.y += 0.01;
        renderer.render(scene, camera);
    }
    
    // Start animation
    animate();
    
    // Add cleanup on canvas removal
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && !document.contains(canvas)) {
                cancelAnimationFrame(animationId);
                renderer.dispose();
                geometry.dispose();
                material.dispose();
                observer.disconnect();
                break;
            }
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

// Add event listener for lighting-updated custom event
document.addEventListener('lighting-updated', function(e) {
    console.log('Received lighting-updated event:', e.detail);
    
    // Show the lighting info section and hide the no data message
    console.log('Updating UI for example lighting');
    toggleLightingMessages(true);
    
    // Update the lighting info with example data
    const metadata = {
        fileName: e.detail.description || 'Example Lighting',
        type: e.detail.type || 'default',
        description: e.detail.description || 'Default Example Lighting',
        dimensions: { width: 0, height: 0 },
        fileSizeBytes: 0
    };
    
    // Update UI with simplified metadata
    const filenameEl = document.getElementById('lighting-filename');
    const typeEl = document.getElementById('lighting-type');
    
    if (filenameEl) filenameEl.textContent = metadata.fileName;
    if (typeEl) typeEl.textContent = metadata.type;
    
    // Update lighting controls visibility
    updateSliderVisibility(true);
    
    // Update lighting message to show information
    updateLightingMessage();
    
    console.log('Updated lighting info UI with example lighting data');
});

/**
 * Set the current background option without triggering UI updates
 * @param {string} option - The option to set ('none', 'background', or 'hdr')
 */
export function setCurrentBackgroundOption(option) {
    if (['none', 'background', 'hdr'].includes(option)) {
        console.log('Setting current background option to:', option);
        currentBackgroundOption = option;
    } else {
        console.warn('Invalid background option:', option);
    }
}

/**
 * NEW: Add cleanup function for the module
 */
export function cleanupWorldPanel() {
    console.log('Cleaning up World Panel...');
    cleanupEventListeners();
    
    // Reset state variables
    controlsInitialized = false;
    currentLightingMetadata = null;
    currentBackgroundMetadata = null;
    environmentTexture = null;
    backgroundTexture = null;
    currentBackgroundOption = null;
    exrLoadInProgress = false;
    isLoadingEnvironmentFile = false;
    
    console.log('World Panel cleanup complete');
}