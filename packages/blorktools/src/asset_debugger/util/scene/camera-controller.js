/**
 * Asset Debugger - Camera Controls Module
 * 
 * This module handles camera controls for the Asset Debugger.
 * It provides functions to initialize, configure, and check the status of camera controls.
 * This is the single source of truth for OrbitControls in the application.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getState, updateState } from '../state/scene-state';

// Store a reference to the controls instance
let controlsInstance = null;
let previousState = { target: new THREE.Vector3(), position: new THREE.Vector3() };
let isInitialized = false;

/**
 * Initialize camera controls
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element for control events
 * @returns {OrbitControls} The initialized controls
 */
export function initControls(camera, domElement) {
    console.log('Controls: initControls called');
    
    // Prevent multiple initializations - but only if we actually have a valid instance
    if (isInitialized && controlsInstance && !controlsInstance._disposed) {
        console.warn('Controls already initialized, returning existing instance');
        return controlsInstance;
    }
    
    // Reset flags in case of stale state
    isInitialized = false;
    controlsInstance = null;
    
    if (!camera) {
        throw new Error('Camera is required to initialize controls');
    }
    
    if (!domElement) {
        throw new Error('DOM element is required to initialize controls');
    }

    // TODO If works refactor to function
    // Prevent standard right click behavior
    let controlsActive = false;
    let isDragging = false;
    // Set state when orbit controls are engaged
    document.addEventListener('mousedown', function(e) {
        if (e.button === 2) { // Right mouse button
            controlsActive = true;
            isDragging = true;
        }
    });
    document.addEventListener('mouseup', function(e) {
        if (e.button === 2) {
            isDragging = false;
            // Keep controlsActive true briefly to prevent context menu
            setTimeout(() => controlsActive = false, 50);
        }
    });
    document.addEventListener('contextmenu', function(e) {
        if (controlsActive || isDragging) {
            e.preventDefault();
            return false;
        }
    });

    
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
    
    // Store controls in local reference first
    controlsInstance = controls;
    isInitialized = true;
    
    // Store in state
    console.log('Controls: Storing controls in state');
    updateState('controls', controls);
    
    console.log('Controls initialized successfully');
    return controls;
}

/**
 * Get the OrbitControls instance
 * This allows other modules to access the controls without importing OrbitControls directly
 * @returns {OrbitControls|null} The controls instance or null if not initialized
 */
export function getControls() {
    return controlsInstance;
}

/**
 * Create controls for the scene
 * Function signature matches what's used in scene.js
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element for control events
 * @returns {OrbitControls} The initialized controls
 */
export function createControls(camera, domElement) {
    console.log('Controls: createControls called');
    return initControls(camera, domElement);
}

/**
 * Check if controls are initialized and ready
 * @returns {boolean} True if controls are ready, false otherwise
 */
export function areControlsReady() {
    return isInitialized && !!controlsInstance;
}

/**
 * Reset controls to default position
 */
export function resetControls() {
    const controls = getControls();
    if (!controls) {
        console.warn('Cannot reset controls: not initialized');
        return;
    }
    
    controls.reset();
}

/**
 * Force recreation of controls - use when controls are not working properly
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element for control events
 * @returns {OrbitControls} The new controls instance
 */
export function recreateControls(camera, domElement) {
    console.log('Controls: Forcibly recreating controls');
    
    // Clean up existing controls
    disposeControls();
    
    // Reset flags
    isInitialized = false;
    controlsInstance = null;
    
    // Create new controls
    return initControls(camera, domElement);
}

/**
 * Dispose controls properly to prevent memory leaks
 */
export function disposeControls() {
    const controls = getControls();
    if (!controls) {
        return;
    }
    
    console.log('Controls: Disposing controls');
    
    // Remove from state
    updateState('controls', null);
    
    // Dispose and remove the controls
    controls.dispose();
    controlsInstance = null;
    isInitialized = false;
}

/**
 * Update control settings
 * @param {Object} settings - Control settings to update
 */
export function updateControlSettings(settings = {}) {
    const controls = getControls();
    if (!controls) {
        console.warn('Cannot update control settings: not initialized');
        return;
    }
    
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
    if (!controls) {
        return;
    }
    
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
    if (!controls) {
        console.warn('Cannot set controls target: not initialized');
        return;
    }
    
    if (!position) {
        console.warn('Cannot set controls target: position is required');
        return;
    }
    
    controls.target.copy(position);
    controls.update();
}