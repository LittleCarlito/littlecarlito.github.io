// Async loaders for Three.js and Rapier
import { update as updateTween, Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';

// Export for direct use
export { updateTween, Easing, Tween };

let loadedTHREE = null;
let loadedRAPER = null;

/**
 * Asynchronously loads Three.js and related modules
 * @returns {Promise<Object>} An object containing THREE, Easing, and Tween
 */
export async function load_three() {
    if (!loadedTHREE) {
        const threeModule = await import('three');
        // Use the static imports instead of dynamic imports
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
export async function load_rapier() {
    if (!loadedRAPER) {
        const RAPIER = await import('@dimforge/rapier3d-compat');
        await RAPIER.init();
        loadedRAPER = RAPIER;
    }
    return loadedRAPER;
} 