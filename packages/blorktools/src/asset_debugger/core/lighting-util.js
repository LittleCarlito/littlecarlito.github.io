/**
 * Lighting Utilities Module
 * 
 * This module handles lighting setup and management for the Asset Debugger.
 */
import * as THREE from 'three';
import { getState, updateState } from './state.js';

// Default exposure value for HDR/EXR environment maps
let environmentExposure = 1.0;

/**
 * Add standard lighting to the scene
 * @param {THREE.Scene} scene - The scene to add lighting to
 */
export function addLighting(scene) {
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
    
    console.log(`Environment exposure updated to ${value}`);
}

/**
 * Set up environment lighting from an HDR or EXR file
 * @param {File} file - HDR or EXR file object
 */
export function setupEnvironmentLighting(file) {
    const state = getState();
    if (!state.scene || !state.renderer) return;
    
    // Configure renderer for HDR/EXR
    state.renderer.outputEncoding = THREE.sRGBEncoding;
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = environmentExposure;
    
    // Require Three.js RGBELoader
    import('three/addons/loaders/RGBELoader.js').then(({ RGBELoader }) => {
        const loader = new RGBELoader();
        
        // For EXR files, higher quality settings
        if (file.name.toLowerCase().endsWith('.exr')) {
            loader.setDataType(THREE.FloatType);
        }
        
        // Create object URL from the file
        const url = URL.createObjectURL(file);
        
        // Show loading message
        console.log(`Loading ${file.name.toLowerCase().endsWith('.exr') ? 'EXR' : 'HDR'} environment map...`);
        
        loader.load(url, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            
            // Set scene environment and background
            state.scene.environment = texture;
            state.scene.background = texture;
            
            // Clean up object URL
            URL.revokeObjectURL(url);
            
            // Update exposure control if it exists
            const exposureControl = document.getElementById('exposure-value');
            if (exposureControl) {
                exposureControl.value = environmentExposure;
                exposureControl.nextElementSibling.textContent = environmentExposure.toFixed(1);
            }
            
            // Hide no data message since we now have lighting data
            const noDataMessage = document.querySelector('.no-data-message');
            if (noDataMessage) {
                noDataMessage.style.display = 'none';
            }
            
            console.log('Environment lighting loaded successfully');
            
            // Parse and display metadata if it's an EXR file
            if (file.name.toLowerCase().endsWith('.exr')) {
                console.log('EXR metadata: High dynamic range, ACESFilmic tone mapping applied');
            }
        }, 
        // Progress callback
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                console.log(`Environment map loading: ${Math.round(percentComplete)}%`);
            }
        }, 
        // Error callback
        (error) => {
            console.error('Error loading environment map:', error);
        });
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
        exposureControl.nextElementSibling.textContent = environmentExposure.toFixed(1);
    }
    
    // Reset environment lighting
    if (state.scene) {
        state.scene.environment = null;
        state.scene.background = new THREE.Color(0x111111);
    }
    
    // Show no data message
    const noDataMessage = document.querySelector('.no-data-message');
    if (noDataMessage) {
        noDataMessage.style.display = 'block';
    }
}
