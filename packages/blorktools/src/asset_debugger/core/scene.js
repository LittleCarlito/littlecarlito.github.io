/**
 * Texture Debugger - Scene Management Module
 * 
 * This module handles Three.js scene setup, rendering, and animation.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getState, updateState } from './state.js';

// Store the updateRigAnimation function once it's loaded
let updateRigAnimationFn = null;

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
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    updateState('renderer', renderer);
    
    // Create orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    updateState('controls', controls);
    
    // Add lighting
    addLighting(scene);
    
    // Set up window resize handler
    setupResizeHandler(container);
    
    // Force a resize event
    window.dispatchEvent(new Event('resize'));
    
    // Render once immediately
    renderer.render(scene, camera);
    
    // Preload the rig animation function
    import('../ui/rig-panel.js').then(module => {
        if (module.updateRigAnimation) {
            updateRigAnimationFn = module.updateRigAnimation;
            console.log('Rig animation function loaded');
        }
    }).catch(err => {
        console.error('Error loading rig-panel.js:', err);
    });
    
    return { scene, camera, renderer, controls };
}

/**
 * Add standard lighting to the scene
 * @param {THREE.Scene} scene - The scene to add lighting to
 */
function addLighting(scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
}

/**
 * Set up window resize handler
 * @param {HTMLElement} container - The viewport container
 */
function setupResizeHandler(container) {
    window.addEventListener('resize', () => {
        const state = getState();
        if (state.camera && state.renderer) {
            state.camera.aspect = container.clientWidth / container.clientHeight;
            state.camera.updateProjectionMatrix();
            state.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
}

/**
 * Start the animation loop
 * @returns {number} The animation frame ID
 */
export function startAnimation() {
    const state = getState();
    
    // Cancel any existing animation
    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
    }
    
    // If rig animation function isn't loaded yet, try to load it
    if (!updateRigAnimationFn) {
        import('../ui/rig-panel.js').then(module => {
            if (module.updateRigAnimation) {
                updateRigAnimationFn = module.updateRigAnimation;
                console.log('Rig animation function loaded');
            }
        }).catch(err => {
            console.error('Error loading rig-panel.js:', err);
        });
    }
    
    // Define the animation function
    function animate() {
        const currentState = getState();
        const animationId = requestAnimationFrame(animate);
        updateState('animationId', animationId);
        
        // Rotate the cube if it exists
        if (currentState.cube) {
            currentState.cube.rotation.y += 0.01;
        }
        
        // Update controls
        if (currentState.controls) {
            currentState.controls.update();
        }
        
        // Update rig animations if the Rig tab is active
        const rigTab = document.getElementById('rig-tab');
        if (rigTab && rigTab.classList.contains('active') && updateRigAnimationFn) {
            updateRigAnimationFn();
        }
        
        // Render the scene
        if (currentState.renderer && currentState.scene && currentState.camera) {
            currentState.renderer.render(currentState.scene, currentState.camera);
        }
    }
    
    // Start the animation loop
    const animationId = requestAnimationFrame(animate);
    updateState('animationId', animationId);
    
    return animationId;
}

/**
 * Stop the animation loop
 */
export function stopAnimation() {
    const state = getState();
    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
        updateState('animationId', null);
    }
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
 * @param {THREE.Object3D} object - The object to fit camera to
 * @param {number} offset - Offset multiplier for the camera distance
 */
export function fitCameraToObject(object, offset = 1.5) {
    const state = getState();
    if (!state.camera || !state.controls) return;
    
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Get the max side of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = state.camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * offset;
    
    // Update camera position
    state.camera.position.z = cameraZ;
    
    // Update the target of the controls
    state.controls.target = center;
    state.controls.update();
}

export default {
    initScene,
    startAnimation,
    stopAnimation,
    clearScene,
    fitCameraToObject
}; 