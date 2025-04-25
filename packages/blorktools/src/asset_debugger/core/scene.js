/**
 * Texture Debugger - Scene Management Module
 * 
 * This module handles Three.js scene setup, rendering, and animation.
 */
import * as THREE from 'three';
import { getState, updateState } from './state.js';
import { updateRigAnimation } from './rig/rig-manager.js';
import { addLighting, setupEnvironmentLighting } from './lighting-util.js';
import { createControls, updateControls, setControlsTarget } from './controls.js';

/**
 * Initialize the Three.js scene, camera, renderer and controls
 * @param {HTMLElement} container - The container element for the renderer
 * @returns {Object} Scene, camera, renderer, and controls
 */
export function initScene(container) {
    const state = getState();
    
    // Create scene
    const scene = new THREE.Scene();
    updateState('scene', scene);
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
        75, 
        container.clientWidth / container.clientHeight, 
        0.1, 
        1000
    );
    camera.position.z = 3;
    updateState('camera', camera);
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    updateState('renderer', renderer);
    
    // Create orbit controls using our controls module
    const controls = createControls(camera, renderer.domElement);
    // No need to update state here as the controls module does it
    
    // Check if we have an HDR/EXR lighting file to use
    const lightingFile = state.lightingFile;
    const hasValidLightingFile = lightingFile && 
        (lightingFile.name.toLowerCase().endsWith('.hdr') || 
         lightingFile.name.toLowerCase().endsWith('.exr'));
    
    if (hasValidLightingFile) {
        // Set default black background until the HDR/EXR is loaded
        scene.background = new THREE.Color(0x000000);
        
        // We'll set up the environment lighting after the scene is initialized
        // The lighting setup is handled in the startDebugging function
        console.log('HDR/EXR lighting file found, will be applied after scene initialization');
    } else {
        // No HDR/EXR file, add standard lighting
        addLighting(scene);
    }
    
    // Set up window resize handler
    setupResizeHandler(container);
    
    // Force a resize event
    window.dispatchEvent(new Event('resize'));
    
    // Render once immediately
    renderer.render(scene, camera);
    
    return { scene, camera, renderer, controls };
}

/**
 * Set up window resize handler
 * @param {HTMLElement} container - The container element for the renderer
 */
function setupResizeHandler(container) {
    window.addEventListener('resize', () => {
        const state = getState();
        
        if (state.camera && state.renderer) {
            // Update camera aspect ratio
            state.camera.aspect = container.clientWidth / container.clientHeight;
            state.camera.updateProjectionMatrix();
            
            // Update renderer size
            state.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
}

/**
 * Start animation loop
 */
export function startAnimation() {
    const state = getState();
    
    if (!state.animating) {
        state.animating = true;
        animate();
    }
}

/**
 * Animation loop
 */
function animate() {
    const state = getState();
    
    if (!state.animating) return;
    
    requestAnimationFrame(animate);
    
    // Time tracking for smooth animation
    const now = performance.now();
    const delta = now - (state.lastFrameTime || now);
    updateState('lastFrameTime', now);
    
    // Update rig animation if available
    updateRigAnimation();
    
    // Always update orbit controls to ensure smooth inertia/damping
    updateControls();
    
    // Render the scene
    if (state.renderer && state.scene && state.camera) {
        state.renderer.render(state.scene, state.camera);
    }
}

/**
 * Stop animation loop
 */
export function stopAnimation() {
    const state = getState();
    state.animating = false;
}

/**
 * Clear the scene of all objects
 */
export function clearScene() {
    const state = getState();
    
    // Remove existing model from scene if it exists
    if (state.model) {
        state.scene.remove(state.model);
        updateState('model', null);
    }
    
    // Remove existing cube if it exists
    if (state.cube) {
        state.scene.remove(state.cube);
        updateState('cube', null);
    }
    
    // Clear meshes array
    updateState('meshes', []);
    
    // Clear mesh groups
    updateState('meshGroups', {});
}

/**
 * Fit camera to object
 * @param {THREE.Object3D} object - The object to fit the camera to
 * @param {number} offset - Offset factor
 */
export function fitCameraToObject(object, offset = 1.2) {
    const state = getState();
    
    if (!object || !state.camera) return;
    
    // Create a bounding box for the object
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Get the max side of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = state.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    // Apply the offset
    cameraZ *= offset;
    
    // Update camera position and target
    state.camera.position.z = cameraZ;
    
    // Update orbit controls target using our controls module's setControlsTarget
    setControlsTarget(center);
}

export default {
    initScene,
    startAnimation,
    stopAnimation,
    clearScene,
    fitCameraToObject
}; 