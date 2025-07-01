/**
 * Asset Debugger - Examples Module
 * 
 * This module provides examples that can be loaded in the asset debugger
 * when no files are uploaded by the user.
 */
import * as THREE from 'three';
import { getState, updateState } from '../../util/state/scene-state.js';
import { createMeshVisibilityPanel } from '../../panels/mesh-heading/mesh-heading.js';

/**
 * Load a specific example by name
 * @param {string} exampleName - The name of the example to load
 * @returns {Promise} A promise that resolves when the example is loaded
 */
export function loadExample(exampleName) {
    console.log(`Loading example: ${exampleName}`);
    
    switch(exampleName) {
        case 'rig':
            // For the rig example, create a wireframe cube as the base
            return createWireframeCubeExample();
            
        case 'wireframe-cube':
            return createWireframeCubeExample();
            
        default:
            console.warn(`Unknown example: ${exampleName}`);
            return Promise.reject(new Error(`Unknown example: ${exampleName}`));
    }
}

/**
 * Create a wireframe cube example
 * @returns {Promise} A promise that resolves when the example is loaded
 */
export function createWireframeCubeExample() {
    return new Promise((resolve, reject) => {
        const state = getState();
        
        // Check if scene is initialized
        if (!state.scene) {
            console.warn("Scene not initialized yet. Cannot create wireframe cube example.");
            reject(new Error("Scene not initialized. Try again after scene is ready."));
            return;
        }
        
        try {
            console.log('[EXAMPLE] Creating wireframe cube example');
            
            // Create a default dark gray background color
            state.scene.background = new THREE.Color(0x222222);
            console.log('[EXAMPLE] Background color set to #222222');
            
            // Import lighting utilities to use their default lighting
            import('../../util/scene/lighting-manager.js').then(lightingUtil => {
                // Add standard lighting from lighting-util.js
                lightingUtil.addLighting(state.scene);
                console.log('[EXAMPLE] Added standard lighting using lighting-util.js');
                
                // Create cube geometry (make it larger for visibility)
                const geometry = new THREE.BoxGeometry(3, 3, 3);
                
                // Create wireframe material with a bright color
                const material = new THREE.MeshBasicMaterial({
                    color: 0x00ff00, // Bright green
                    wireframe: true,
                    wireframeLinewidth: 3
                });
                
                // Create mesh and add to scene
                const cube = new THREE.Mesh(geometry, material);
                cube.name = "WireframeCube";
                state.scene.add(cube);
                console.log('[EXAMPLE] Added wireframe cube to scene');
                
                // Position the cube at the center
                cube.position.set(0, 0, 0);
                
                // Explicitly position the camera to view the cube
                if (state.camera) {
                    // Position camera far enough to see the cube
                    state.camera.position.set(0, 0, 10);
                    state.camera.lookAt(0, 0, 0);
                    console.log('[EXAMPLE] Positioned camera at (0,0,10) looking at cube');
                    
                    // If we have camera controls, reset them
                    if (state.controls) {
                        state.controls.target.set(0, 0, 0);
                        state.controls.update();
                        console.log('[EXAMPLE] Updated camera controls to target cube');
                    }
                } else {
                    console.warn('[EXAMPLE] Camera not found in state, may not be able to see cube');
                }
                
                // Store in state
                updateState('cube', cube);
                updateState('meshes', [cube]);
                console.log('[EXAMPLE] Updated state with cube reference');
                
                // Set up mesh visibility panel
                createMeshVisibilityPanel();
                
                // Log scene contents for debugging
                console.log('[EXAMPLE] Scene children:', state.scene.children);
                console.log('[EXAMPLE] Camera position:', state.camera ? state.camera.position : 'Camera not found');
                
                console.log('[EXAMPLE] Created wireframe cube example with standard lighting');
                resolve(cube);
            }).catch(error => {
                console.error('[EXAMPLE] Error importing lighting-util.js:', error);
                reject(error);
            });
        } catch (error) {
            console.error('[EXAMPLE] Error creating wireframe cube example:', error);
            reject(error);
        }
    });
}

export default {
    loadExample,
    createWireframeCubeExample
}; 