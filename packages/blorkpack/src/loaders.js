// Async loaders for Three.js and Rapier
import * as THREE from 'three';
import { Easing, Tween, update as updateTween } from 'three/examples/jsm/libs/tween.module.js';
import * as RAPIER from '@dimforge/rapier3d-compat';

// Export for direct use
export { updateTween };

let loadedTHREE = null;
let loadedRAPER = null;

/**
 * Asynchronously loads Three.js and related modules
 * @returns {Promise<Object>} An object containing THREE, Easing, and Tween
 */
export async function loadThree() {
    if (!loadedTHREE) {
        const threeModule = await import('three');
        const { Easing, Tween } = await import('three/examples/jsm/libs/tween.module.js');
        loadedTHREE = { 
            THREE: threeModule, 
            Easing, 
            Tween 
        };
    }
    return loadedTHREE;
}

/**
 * Asynchronously loads RAPIER physics engine
 * @returns {Promise<Object>} The RAPIER module
 */
export async function loadRapier() {
    if (!loadedRAPER) {
        const RAPIER = await import('@dimforge/rapier3d-compat');
        await RAPIER.init();
        loadedRAPER = RAPIER;
    }
    return loadedRAPER;
} 