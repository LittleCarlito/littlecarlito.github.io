/**
 * GLB Utility Module
 * 
 * Handles GLB model loading, processing, and preview rendering.
 * Adds functionality for associating binary buffers with mesh indices in GLB extensions.
 */

import * as THREE from 'three';
import { processModelFile } from './workers/worker-manager.js';

// Constants for extension identification
export const MESH_BINARY_EXTENSION = 'BLORK_mesh_binary_data';
export const MESH_INDEX_PROPERTY = 'meshIndex';
export const BINARY_DATA_PROPERTY = 'binaryData';

// Keep track of preview resources for cleanup
export let previewRenderer = null;
export let previewScene = null;
export let previewCamera = null;
export let previewControls = null;
export let previewAnimationFrame = null;

/**
 * Display a custom texture on a mesh
 * @param {boolean} display - Whether to display the custom texture
 * @param {number} meshId - ID of the mesh to display the texture on
 */
export function displayCustomTexture(display, meshId) {
    console.debug("BAZIGNA IT WORKED BITCHES", display, meshId);
} 

export function setPreviewAnimationFrame(incomingValue) {
    previewAnimationFrame = incomingValue;
}

export function setPreviewScene(incomingValue) {
    previewScene = incomingValue;
}

export function setPreviewCamera(incomingValue) {
    previewCamera = incomingValue;
}

export function setPreviewControls(incomingValue) {
    previewControls = incomingValue;
}

export function setPreviewRenderer(incomingValue) {
    previewRenderer = incomingValue;
}