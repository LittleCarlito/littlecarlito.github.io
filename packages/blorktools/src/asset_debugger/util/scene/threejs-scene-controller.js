/**
 * Texture Debugger - Scene Management Module
 * 
 * This module handles Three.js scene setup, rendering, and animation.
 */
import * as THREE from 'three';
import { getState, updateState } from '../state/scene-state.js';
import { updateRigAnimation } from '../rig/rig-controller.js';
import { addLighting, setupEnvironmentLighting } from './lighting-manager.js';
import { createControls, updateControls, setControlsTarget } from './camera-controller.js';

/**
 * Initialize the Three.js scene, camera, renderer and controls
 * @param {HTMLElement} container - The container element for the renderer
 * @param {boolean} showDebugCube - Whether to show the debug cube (default: false)
 * @returns {Object} Scene, camera, renderer, and controls
 */
export function initScene(container, showDebugCube = false) {
    console.log('DEBUG: initScene called', {
        containerExists: !!container,
        containerDimensions: container ? `${container.clientWidth}x${container.clientHeight}` : 'N/A',
        parentNode: container?.parentNode?.tagName || 'None',
        viewportID: container?.id || 'Unknown',
        showDebugCube: showDebugCube
    });
    
    // Add a debug cube to confirm scene is rendering
    const addDebugCube = (scene) => {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 0.5, 0);
        scene.add(cube);
        return cube;
    };
    
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
    
    // Set initial camera position with better perspective angle
    camera.position.set(3, 2, 5); // Position at a diagonal angle instead of just along Z
    updateState('camera', camera);
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    updateState('renderer', renderer);
    
    // Ensure viewport is visible
    container.style.display = 'block';
    console.log('DEBUG: Set viewport display to block');
    
    // Create orbit controls using our controls module
    const controls = createControls(camera, renderer.domElement);
    // No need to update state here as the controls module does it
    
    // Add a debug cube to verify the scene is working if showDebugCube is true
    let cube = null;
    if (showDebugCube) {
        cube = addDebugCube(scene);
        console.log('DEBUG: Added green debug cube to scene');
    } else {
        console.log('DEBUG: Debug cube disabled');
    }
    updateState('cube', cube);
    
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

// Animation loop
let lastFrameTime = performance.now();

function animate() {
    const state = getState();
    
    if (!state.animating) return;
    
    requestAnimationFrame(animate);
    
    // Time tracking for smooth animation
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    
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
 * Fit camera to object with sophisticated positioning
 * @param {THREE.Object3D} object - The object to fit the camera to
 * @param {number} offset - Optional base offset factor (default: 1.2)
 */
export function fitCameraToObject(object, offset = 1.2) {
    const state = getState();
    
    if (!object || !state.camera) return;
    
    // Create a bounding box for the object
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Get the camera aspect ratio
    const aspect = state.renderer.domElement.clientWidth / state.renderer.domElement.clientHeight;
    
    // Calculate optimal camera position to ensure the model is fully visible
    const fov = state.camera.fov * (Math.PI / 180); // convert to radians
    
    // Get model dimensions
    const scaledSizeX = size.x;
    const scaledSizeY = size.y;
    const scaledSizeZ = size.z;
    
    // Calculate the center point of the model for camera targeting
    // This is the geometric center, not just (0,0,0)
    const modelCenter = new THREE.Vector3(center.x, center.y, center.z);
    
    // Calculate required distance for each dimension
    const distanceForHeight = scaledSizeY / (2 * Math.tan(fov / 2));
    const distanceForWidth = scaledSizeX / (2 * Math.tan(fov / 2) * aspect);
    const distanceForDepth = scaledSizeZ * 1.2; // Add more space for depth
    
    // Base distance calculation
    let optimalDistance = Math.max(distanceForWidth, distanceForHeight, distanceForDepth);
    
    // Detect extreme model shapes and adjust accordingly
    const aspectRatioXY = scaledSizeX / (scaledSizeY || 0.001); // Avoid division by zero
    const aspectRatioXZ = scaledSizeX / (scaledSizeZ || 0.001);
    const aspectRatioYZ = scaledSizeY / (scaledSizeZ || 0.001);
    
    // Add extra buffer for camera distance
    let bufferMultiplier = 1.6; // Base buffer multiplier
    
    // Add more buffer for flat/wide models (high aspect ratios)
    if (aspectRatioXY > 4 || aspectRatioXY < 0.25 || 
        aspectRatioXZ > 4 || aspectRatioXZ < 0.25 || 
        aspectRatioYZ > 4 || aspectRatioYZ < 0.25) {
        bufferMultiplier = 2.0; // More space for extreme shapes
        console.log('Extreme model shape detected - using larger buffer');
    }
    
    // Apply buffer to optimal distance
    optimalDistance *= bufferMultiplier;
    
    // Set minimum distance
    const finalDistance = Math.max(optimalDistance, 2.5);
    
    // Calculate X and Y offsets for perspective view
    const xOffset = finalDistance * 0.4;
    let yOffset = finalDistance * 0.3;
    
    // Special handling for very tall models
    if (scaledSizeY > scaledSizeX * 3 && scaledSizeY > scaledSizeZ * 3) {
        // For very tall models, position camera higher to see from middle
        yOffset = Math.min(modelCenter.y + finalDistance * 0.2, finalDistance * 0.7);
    } else if (scaledSizeY < 0.5) {
        // For very flat horizontal models, don't position camera too low
        yOffset = Math.max(modelCenter.y * 2, finalDistance * 0.2);
    } else {
        // For normal models, position camera to see the entire height
        yOffset = Math.max(modelCenter.y, finalDistance * 0.2);
    }
    
    // Final camera positioning - position relative to the model's center point
    state.camera.position.set(
        modelCenter.x + xOffset,
        modelCenter.y + yOffset,
        modelCenter.z + finalDistance
    );
    
    // Update orbit controls target to the center of the model
    setControlsTarget(modelCenter);
}
