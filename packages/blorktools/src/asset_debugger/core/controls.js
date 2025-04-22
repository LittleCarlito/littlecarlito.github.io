/**
 * Asset Debugger - Camera Controls Module
 * 
 * This module handles camera controls for the Asset Debugger.
 * It provides functions to initialize, configure, and check the status of camera controls.
 * This is the single source of truth for OrbitControls in the application.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getState, updateState } from './state.js';

// Store a reference to the controls instance
let controlsInstance = null;
let previousState = { target: new THREE.Vector3(), position: new THREE.Vector3() };

/**
 * Initialize camera controls
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element for control events
 * @returns {OrbitControls} The initialized controls
 */
export function initControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    
    // Configure controls
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI;
    
    // Track mouse state to prevent inertia interruption
    let isMouseDown = false;
    
    // Store the previous camera state on mouse down
    domElement.addEventListener('mousedown', () => {
        isMouseDown = true;
        previousState.target.copy(controls.target);
        previousState.position.copy(camera.position);
    });
    
    // Handle movement continuation on mouse up
    domElement.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    
    // Ensure continuous updating when not interacting
    controls.addEventListener('change', () => {
        updateState('lastControlsChange', Date.now());
    });
    
    // Store controls in state and in local reference
    controlsInstance = controls;
    updateState('controls', controls);
    
    return controls;
}

/**
 * Get the OrbitControls instance
 * This allows other modules to access the controls without importing OrbitControls directly
 * @returns {OrbitControls|null} The controls instance or null if not initialized
 */
export function getControls() {
    return controlsInstance || getState().controls;
}

/**
 * Create controls for the scene
 * Function signature matches what's used in scene.js
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element for control events
 * @returns {OrbitControls} The initialized controls
 */
export function createControls(camera, domElement) {
    return initControls(camera, domElement);
}

/**
 * Check if controls are initialized and ready
 * @returns {boolean} True if controls are ready, false otherwise
 */
export function areControlsReady() {
    return !!getControls();
}

/**
 * Reset controls to default position
 */
export function resetControls() {
    const controls = getControls();
    if (controls) {
        controls.reset();
    }
}

/**
 * Update control settings
 * @param {Object} settings - Control settings to update
 */
export function updateControlSettings(settings = {}) {
    const controls = getControls();
    if (!controls) return;
    
    // Apply settings if provided
    if (settings.enableDamping !== undefined) controls.enableDamping = settings.enableDamping;
    if (settings.dampingFactor !== undefined) controls.dampingFactor = settings.dampingFactor;
    if (settings.enableZoom !== undefined) controls.enableZoom = settings.enableZoom;
    if (settings.enableRotate !== undefined) controls.enableRotate = settings.enableRotate;
    if (settings.enablePan !== undefined) controls.enablePan = settings.enablePan;
    if (settings.minDistance !== undefined) controls.minDistance = settings.minDistance;
    if (settings.maxDistance !== undefined) controls.maxDistance = settings.maxDistance;
}

/**
 * Update the controls in the animation loop
 * Allows animation code to just call this instead of checking for controls
 */
export function updateControls() {
    const controls = getControls();
    if (!controls) return;
    
    // Always update controls if they exist, no need for extra checks
    // This ensures smooth camera movement regardless of interaction state
    controls.update();
}

/**
 * Set the target for the controls
 * @param {THREE.Vector3} position - The target position
 */
export function setControlsTarget(position) {
    const controls = getControls();
    if (controls) {
        controls.target.copy(position);
        controls.update();
    }
}

export default {
    initControls,
    getControls,
    createControls,
    areControlsReady,
    resetControls,
    updateControlSettings,
    updateControls,
    setControlsTarget
}; 