/**
 * Asset Debugger - World Panel Module
 * 
 * This module handles world properties, environment, and lighting visualization and controls.
 */
import { getState, updateState } from '../../core/state.js';

// DOM elements
let environmentIntensity = null;
let environmentIntensityValue = null;
let environmentRotation = null;
let environmentRotationValue = null;
let environmentReset = null;

let lightIntensity = null;
let lightIntensityValue = null;
let lightColor = null;
let lightPositionX = null;
let lightPositionY = null;
let lightPositionZ = null;
let lightPositionXValue = null;
let lightPositionYValue = null;
let lightPositionZValue = null;
let lightReset = null;

let backgroundMode = null;
let solidColorControls = null;
let gradientControls = null;
let backgroundColor = null;
let gradientTopColor = null;
let gradientBottomColor = null;

let groundVisible = null;
let groundReflectivity = null;
let groundReflectivityValue = null;

let currentEnvironment = null;
let lightType = null;

let controlsInitialized = false;

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
            console.log('World panel found, initializing...');
            
            // Now that we have the panel, cache all elements and set up controls
            cacheElements();
            
            // Setup event listeners if not already done
            if (!controlsInitialized) {
                setupEventListeners();
                controlsInitialized = true;
            }
            
            // Initial update
            updateWorldPanel();
        }
    }, 100);
    
    // Set a timeout to stop checking after 10 seconds to prevent infinite checking
    setTimeout(() => {
        clearInterval(checkElements);
        console.warn('Timed out waiting for World panel elements');
    }, 10000);
}

/**
 * Cache all DOM elements
 */
function cacheElements() {
    // Environment controls
    environmentIntensity = document.getElementById('environment-intensity');
    environmentIntensityValue = document.getElementById('environment-intensity-value');
    environmentRotation = document.getElementById('environment-rotation');
    environmentRotationValue = document.getElementById('environment-rotation-value');
    environmentReset = document.getElementById('environment-reset');
    
    // Light controls
    lightIntensity = document.getElementById('light-intensity');
    lightIntensityValue = document.getElementById('light-intensity-value');
    lightColor = document.getElementById('light-color');
    lightPositionX = document.getElementById('light-position-x');
    lightPositionY = document.getElementById('light-position-y');
    lightPositionZ = document.getElementById('light-position-z');
    lightPositionXValue = document.getElementById('light-position-x-value');
    lightPositionYValue = document.getElementById('light-position-y-value');
    lightPositionZValue = document.getElementById('light-position-z-value');
    lightReset = document.getElementById('light-reset');
    
    // Background controls
    backgroundMode = document.getElementById('background-mode');
    solidColorControls = document.getElementById('solid-color-controls');
    gradientControls = document.getElementById('gradient-controls');
    backgroundColor = document.getElementById('background-color');
    gradientTopColor = document.getElementById('gradient-top-color');
    gradientBottomColor = document.getElementById('gradient-bottom-color');
    
    // Ground controls
    groundVisible = document.getElementById('ground-visible');
    groundReflectivity = document.getElementById('ground-reflectivity');
    groundReflectivityValue = document.getElementById('ground-reflectivity-value');
    
    // Info elements
    currentEnvironment = document.getElementById('current-environment');
    lightType = document.getElementById('light-type');
}

/**
 * Set up event listeners for all controls
 */
function setupEventListeners() {
    // Skip if elements aren't loaded yet
    if (!environmentIntensity || !lightIntensity || !backgroundMode) {
        console.warn('World panel elements not found, skipping event setup');
        return;
    }
    
    // Environment controls events
    environmentIntensity.addEventListener('input', function() {
        const value = parseFloat(this.value);
        environmentIntensityValue.textContent = value.toFixed(1);
        updateEnvironmentIntensity(value);
    });
    
    environmentRotation.addEventListener('input', function() {
        const value = parseInt(this.value);
        environmentRotationValue.textContent = `${value}°`;
        updateEnvironmentRotation(value);
    });
    
    environmentReset.addEventListener('click', resetEnvironment);
    
    // Light controls events
    lightIntensity.addEventListener('input', function() {
        const value = parseFloat(this.value);
        lightIntensityValue.textContent = value.toFixed(1);
        updateLightIntensity(value);
    });
    
    lightColor.addEventListener('input', function() {
        updateLightColor(this.value);
    });
    
    lightPositionX.addEventListener('input', function() {
        const value = parseFloat(this.value);
        lightPositionXValue.textContent = value.toFixed(1);
        updateLightPosition();
    });
    
    lightPositionY.addEventListener('input', function() {
        const value = parseFloat(this.value);
        lightPositionYValue.textContent = value.toFixed(1);
        updateLightPosition();
    });
    
    lightPositionZ.addEventListener('input', function() {
        const value = parseFloat(this.value);
        lightPositionZValue.textContent = value.toFixed(1);
        updateLightPosition();
    });
    
    lightReset.addEventListener('click', resetLight);
    
    // Background controls events
    backgroundMode.addEventListener('change', function() {
        updateBackgroundMode(this.value);
    });
    
    backgroundColor.addEventListener('input', function() {
        updateBackgroundColor(this.value);
    });
    
    gradientTopColor.addEventListener('input', function() {
        updateGradientColors();
    });
    
    gradientBottomColor.addEventListener('input', function() {
        updateGradientColors();
    });
    
    // Ground controls events
    groundVisible.addEventListener('change', function() {
        updateGroundVisibility(this.checked);
    });
    
    groundReflectivity.addEventListener('input', function() {
        const value = parseFloat(this.value);
        groundReflectivityValue.textContent = value.toFixed(2);
        updateGroundReflectivity(value);
    });
}

/**
 * Update the World panel with current state
 */
export function updateWorldPanel() {
    const state = getState();
    
    // Re-cache elements if needed
    if (!environmentIntensity || !lightIntensity) {
        cacheElements();
    }
    
    // Skip if elements still aren't loaded
    if (!environmentIntensity || !lightIntensity) {
        console.warn('World panel elements not found, skipping update');
        return;
    }
    
    // Update environment controls from state
    if (state.environmentIntensity !== undefined) {
        environmentIntensity.value = state.environmentIntensity;
        environmentIntensityValue.textContent = state.environmentIntensity.toFixed(1);
    }
    
    if (state.environmentRotation !== undefined) {
        environmentRotation.value = state.environmentRotation;
        environmentRotationValue.textContent = `${state.environmentRotation}°`;
    }
    
    // Update light controls from state
    if (state.lightIntensity !== undefined) {
        lightIntensity.value = state.lightIntensity;
        lightIntensityValue.textContent = state.lightIntensity.toFixed(1);
    }
    
    if (state.lightColor !== undefined) {
        lightColor.value = state.lightColor;
    }
    
    if (state.lightPosition !== undefined) {
        lightPositionX.value = state.lightPosition.x;
        lightPositionY.value = state.lightPosition.y;
        lightPositionZ.value = state.lightPosition.z;
        lightPositionXValue.textContent = state.lightPosition.x.toFixed(1);
        lightPositionYValue.textContent = state.lightPosition.y.toFixed(1);
        lightPositionZValue.textContent = state.lightPosition.z.toFixed(1);
    }
    
    // Update background controls from state
    if (state.backgroundMode !== undefined) {
        backgroundMode.value = state.backgroundMode;
        updateBackgroundControlsVisibility(state.backgroundMode);
    }
    
    if (state.backgroundColor !== undefined) {
        backgroundColor.value = state.backgroundColor;
    }
    
    if (state.gradientTopColor !== undefined) {
        gradientTopColor.value = state.gradientTopColor;
    }
    
    if (state.gradientBottomColor !== undefined) {
        gradientBottomColor.value = state.gradientBottomColor;
    }
    
    // Update ground controls from state
    if (state.groundVisible !== undefined) {
        groundVisible.checked = state.groundVisible;
    }
    
    if (state.groundReflectivity !== undefined) {
        groundReflectivity.value = state.groundReflectivity;
        groundReflectivityValue.textContent = state.groundReflectivity.toFixed(2);
    }
    
    // Update info elements
    if (state.currentEnvironmentMap) {
        currentEnvironment.textContent = state.currentEnvironmentMap;
    } else {
        currentEnvironment.textContent = 'Default';
    }
    
    if (state.lightType) {
        lightType.textContent = state.lightType;
    } else {
        lightType.textContent = 'Directional';
    }
}

/**
 * Update background controls visibility based on selected mode
 * @param {string} mode - The background mode (environment, solid, gradient)
 */
function updateBackgroundControlsVisibility(mode) {
    // Hide all controls first
    if (solidColorControls) solidColorControls.style.display = 'none';
    if (gradientControls) gradientControls.style.display = 'none';
    
    // Show the controls for the selected mode
    if (mode === 'solid' && solidColorControls) {
        solidColorControls.style.display = 'block';
    } else if (mode === 'gradient' && gradientControls) {
        gradientControls.style.display = 'block';
    }
}

/**
 * Update environment intensity
 * @param {number} value - The intensity value
 */
function updateEnvironmentIntensity(value) {
    const state = getState();
    
    // Update the scene's environment intensity if it exists
    if (state.scene && state.scene.environment) {
        // Store the value in state
        updateState('environmentIntensity', value);
        
        // Update the renderer exposure to simulate environment intensity
        if (state.renderer) {
            state.renderer.toneMappingExposure = value;
        }
    }
}

/**
 * Update environment rotation
 * @param {number} value - The rotation value in degrees
 */
function updateEnvironmentRotation(value) {
    const state = getState();
    
    // Update the scene's environment map rotation
    if (state.scene && state.scene.environment) {
        // Store the value in state
        updateState('environmentRotation', value);
        
        // Convert degrees to radians
        const rotationRadians = value * (Math.PI / 180);
        
        // Apply rotation to environment map if possible
        if (state.scene.environment.rotation !== undefined) {
            state.scene.environment.rotation = rotationRadians;
            state.scene.environment.needsUpdate = true;
        }
    }
}

/**
 * Reset environment to default values
 */
function resetEnvironment() {
    // Set default values
    environmentIntensity.value = 1;
    environmentIntensityValue.textContent = '1.0';
    environmentRotation.value = 0;
    environmentRotationValue.textContent = '0°';
    
    // Update state and scene
    updateEnvironmentIntensity(1);
    updateEnvironmentRotation(0);
}

/**
 * Update light intensity
 * @param {number} value - The intensity value
 */
function updateLightIntensity(value) {
    const state = getState();
    
    // Store the value in state
    updateState('lightIntensity', value);
    
    // Update all lights in the scene
    if (state.lights && state.lights.length > 0) {
        state.lights.forEach(light => {
            if (light.intensity !== undefined) {
                light.intensity = value;
            }
        });
    }
}

/**
 * Update light color
 * @param {string} colorValue - The color hex string
 */
function updateLightColor(colorValue) {
    const state = getState();
    
    // Store the value in state
    updateState('lightColor', colorValue);
    
    // Convert hex color to THREE.Color
    if (state.lights && state.lights.length > 0) {
        // Check if THREE is available
        if (window.THREE && window.THREE.Color) {
            const color = new window.THREE.Color(colorValue);
            
            // Update all lights in the scene
            state.lights.forEach(light => {
                if (light.color) {
                    light.color.copy(color);
                }
            });
        }
    }
}

/**
 * Update light position based on X, Y, Z controls
 */
function updateLightPosition() {
    const state = getState();
    
    // Get values from sliders
    const x = parseFloat(lightPositionX.value);
    const y = parseFloat(lightPositionY.value);
    const z = parseFloat(lightPositionZ.value);
    
    // Store in state
    updateState('lightPosition', { x, y, z });
    
    // Update directional lights in the scene
    if (state.lights && state.lights.length > 0) {
        state.lights.forEach(light => {
            // Only update positional lights
            if (light.position) {
                light.position.set(x, y, z);
            }
            
            // Update target for directional lights
            if (light.target && light.target.position) {
                // Point toward origin
                light.target.position.set(0, 0, 0);
            }
        });
    }
}

/**
 * Reset light to default values
 */
function resetLight() {
    // Set default values
    lightIntensity.value = 1;
    lightIntensityValue.textContent = '1.0';
    lightColor.value = '#ffffff';
    lightPositionX.value = 5;
    lightPositionY.value = 5;
    lightPositionZ.value = 5;
    lightPositionXValue.textContent = '5.0';
    lightPositionYValue.textContent = '5.0';
    lightPositionZValue.textContent = '5.0';
    
    // Update state and scene
    updateLightIntensity(1);
    updateLightColor('#ffffff');
    updateLightPosition();
}

/**
 * Update background mode
 * @param {string} mode - The background mode
 */
function updateBackgroundMode(mode) {
    const state = getState();
    
    // Store in state
    updateState('backgroundMode', mode);
    
    // Update visibility of related controls
    updateBackgroundControlsVisibility(mode);
    
    // Apply background change to scene
    if (state.scene) {
        if (mode === 'environment') {
            // Use environment map if available
            if (state.scene.environment) {
                state.scene.background = state.scene.environment;
            }
        } else if (mode === 'solid') {
            // Use solid color
            updateBackgroundColor(backgroundColor.value);
        } else if (mode === 'gradient') {
            // Apply gradient
            updateGradientColors();
        }
    }
}

/**
 * Update background color for solid color mode
 * @param {string} colorValue - The color hex string
 */
function updateBackgroundColor(colorValue) {
    const state = getState();
    
    // Store in state
    updateState('backgroundColor', colorValue);
    
    // Apply to scene if in solid mode
    if (state.scene && state.backgroundMode === 'solid') {
        // Check if THREE is available
        if (window.THREE && window.THREE.Color) {
            state.scene.background = new window.THREE.Color(colorValue);
        }
    }
}

/**
 * Update gradient colors for gradient background mode
 */
function updateGradientColors() {
    const state = getState();
    
    // Store in state
    updateState('gradientTopColor', gradientTopColor.value);
    updateState('gradientBottomColor', gradientBottomColor.value);
    
    // Apply to scene if in gradient mode
    if (state.scene && state.backgroundMode === 'gradient' && window.THREE) {
        // Create gradient texture using THREE.js
        if (window.THREE.CanvasTexture) {
            // Create a canvas for the gradient
            const canvas = document.createElement('canvas');
            canvas.width = 2;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Create gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, 512);
            gradient.addColorStop(0, gradientTopColor.value);
            gradient.addColorStop(1, gradientBottomColor.value);
            
            // Fill canvas with gradient
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 2, 512);
            
            // Create texture
            const texture = new window.THREE.CanvasTexture(canvas);
            state.scene.background = texture;
        }
    }
}

/**
 * Update ground visibility
 * @param {boolean} visible - Whether the ground is visible
 */
function updateGroundVisibility(visible) {
    const state = getState();
    
    // Store in state
    updateState('groundVisible', visible);
    
    // Update ground mesh visibility if it exists
    if (state.ground) {
        state.ground.visible = visible;
    }
}

/**
 * Update ground reflectivity
 * @param {number} value - The reflectivity value
 */
function updateGroundReflectivity(value) {
    const state = getState();
    
    // Store in state
    updateState('groundReflectivity', value);
    
    // Update ground material if it exists
    if (state.ground && state.ground.material) {
        state.ground.material.metalness = value;
        state.ground.material.needsUpdate = true;
    }
}

export default {
    initWorldPanel,
    updateWorldPanel
}; 