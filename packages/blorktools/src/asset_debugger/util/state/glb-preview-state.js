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