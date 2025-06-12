import { getState } from '../state/scene-state.js';

let currentGlbBuffer = null;

export function setCurrentGlbBuffer(glbBuffer) {
    currentGlbBuffer = glbBuffer;
}

export function getCurrentGlbBuffer() {
    if (currentGlbBuffer) {
        return currentGlbBuffer;
    }
    
    const state = getState();
    if (state && state.currentGlb && state.currentGlb.arrayBuffer) {
        currentGlbBuffer = state.currentGlb.arrayBuffer;
        return currentGlbBuffer;
    }
    
    return null;
}

export function getMeshByIndex(meshIndex) {
    const state = getState();
    if (!state || !state.meshes || meshIndex >= state.meshes.length) {
        return null;
    }
    
    return state.meshes[meshIndex];
}
