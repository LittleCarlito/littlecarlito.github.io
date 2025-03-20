// Camera module
// Handles setup and configuration of camera and controls

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Setup the camera for the scene
 * @param {Object} state - Global state object
 * @returns {THREE.PerspectiveCamera} - The created camera
 */
export function setupCamera(state) {
	// Create camera if it doesn't exist
	if (!state.camera) {
		// Create perspective camera
		const camera = new THREE.PerspectiveCamera(
			45, // FOV
			window.innerWidth / window.innerHeight, // Aspect ratio
			0.1, // Near plane
			1000 // Far plane
		);
    
		// Set initial position
		camera.position.z = 5;
    
		// Store in state
		state.camera = camera;
    
		// Setup orbit controls
		if (state.renderer) {
			setupOrbitControls(state);
		}
    
		console.log('Camera initialized');
	}
  
	return state.camera;
}

/**
 * Setup orbit controls for camera
 * @param {Object} state - Global state object
 * @returns {OrbitControls} - The created controls
 */
export function setupOrbitControls(state) {
	if (!state.controls && state.camera && state.renderer) {
		// Create orbit controls
		const controls = new OrbitControls(state.camera, state.renderer.domElement);
    
		// Configure controls
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.screenSpacePanning = true;
    
		// Set initial rotation and distance
		controls.minDistance = 1;
		controls.maxDistance = 20;
    
		// Store in state
		state.controls = controls;
    
		console.log('Orbit controls initialized');
	}
  
	return state.controls;
}

/**
 * Reset camera to default position
 * @param {Object} state - Global state object
 */
export function resetCamera(state) {
	if (!state.camera) return;
  
	// Reset camera position
	state.camera.position.set(0, 0, 5);
	state.camera.lookAt(0, 0, 0);
  
	// Reset controls if they exist
	if (state.controls) {
		state.controls.target.set(0, 0, 0);
		state.controls.update();
	}
}

/**
 * Focus camera on object
 * @param {Object} state - Global state object
 * @param {THREE.Object3D} object - Object to focus on
 */
export function focusOnObject(state, object) {
	if (!state.camera || !object) return;
  
	// Create bounding box for object
	const box = new THREE.Box3().setFromObject(object);
	const center = box.getCenter(new THREE.Vector3());
	const size = box.getSize(new THREE.Vector3());
  
	// Get max dimension for sizing
	const maxDim = Math.max(size.x, size.y, size.z);
  
	// Calculate ideal distance
	const fov = state.camera.fov * (Math.PI / 180);
	const idealDistance = Math.abs(maxDim / Math.sin(fov / 2)) * 0.6;
  
	// Set new position
	const direction = state.camera.position.clone()
		.sub(state.controls.target)
		.normalize()
		.multiplyScalar(idealDistance);
  
	// Set new target and position
	state.controls.target.copy(center);
	state.camera.position.copy(center).add(direction);
  
	// Update controls
	state.controls.update();
} 