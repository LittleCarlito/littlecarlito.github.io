// Async loaders for Three.js and Rapier
import { update as updateTween, Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';
// Export for direct use
export { updateTween, Easing, Tween };
let loadedTHREE = null;
let loadedRAPER = null;
let rapierInitialized = false;
/**
 * Asynchronously loads Three.js 
 * @returns {Promise<Object>} The THREE module
 */
export async function load_three() {
	if (!loadedTHREE) {
		const threeModule = await import('three');
		loadedTHREE = { 
			THREE: threeModule
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
		loadedRAPER = RAPIER;
	}
	return loadedRAPER;
}
/**
 * Ensures RAPIER is loaded and initialized
 * @returns {Promise<Object>} The initialized RAPIER module
 */
export async function ensure_rapier_initialized() {
	const RAPIER = await load_rapier();
	if (!rapierInitialized) {
		await RAPIER.init();
		rapierInitialized = true;
	}
	return RAPIER;
} 