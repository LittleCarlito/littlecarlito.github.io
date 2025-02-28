// Async loaders for Three.js and Rapier
import * as THREE from 'three';
import { Easing, Tween, update as updateTween } from 'three/examples/jsm/libs/tween.module.js';
import * as RAPIER from '@dimforge/rapier3d-compat';

// Re-export Three.js and Rapier for existing code
export { THREE, Easing, Tween, updateTween, RAPIER };

let loadedTHREE = { THREE, Easing, Tween };
let loadedRAPER = null;

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

export async function loadRapier() {
    if (!loadedRAPER) {
        const RAPIER = await import('@dimforge/rapier3d-compat');
        await RAPIER.init();
        loadedRAPER = RAPIER;
    }
    return loadedRAPER;
}

// Re-export other common utilities
export * from './flags'
export * from './app_renderer'
export * from './types'
export * from './names'
export * from './asset_management/asset_manager'
