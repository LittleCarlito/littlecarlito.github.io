/**
 * Model Integration for HTML Editor
 * 
 * This module integrates the HTML editor with model loading
 * to support storing and retrieving HTML content in GLB files.
 */

import { getState, updateState } from '../../core/state.js';
import { processGLBModel } from '../../core/glb-utils.js';

// Current GLB buffer storage
let currentGlbBuffer = null;

/**
 * Initialize the model-HTML integration
 * This should be called when the application starts
 */
export function initModelIntegration() {
    console.log('Initializing model-HTML integration');
    
    // Extend the state object to include currentGlb property if it doesn't exist
    const state = getState();
    if (!state.currentGlb) {
        updateState('currentGlb', {
            arrayBuffer: null,
            fileName: null,
            fileSize: null
        });
    }
    
    // Set up observers for model file changes
    setupModelObserver();
}

/**
 * Set up an observer to watch for changes to the model file in the state
 */
function setupModelObserver() {
    // This is a polling-based implementation
    // In a production environment, you might want to use a proper state management
    // solution with subscriptions/observers
    
    let previousModelFile = null;
    
    // Check every second if the model file has changed
    setInterval(() => {
        const state = getState();
        
        // If the model file has changed
        if (state.modelFile !== previousModelFile && state.modelFile) {
            previousModelFile = state.modelFile;
            console.log('Model file changed, processing for HTML editor integration');
            
            // Process the model file to get the GLB buffer
            processModelFileForHtmlEditor(state.modelFile);
        }
    }, 1000);
}

/**
 * Process a model file and set it up for HTML editor integration
 * @param {File} file - The GLB file to process
 */
async function processModelFileForHtmlEditor(file) {
    try {
        // Process the model file using our GLB utility
        const result = await processGLBModel(file);
        
        // Update the state with the GLB buffer
        const state = getState();
        updateState('currentGlb', {
            arrayBuffer: result.arrayBuffer,
            fileName: result.fileName,
            fileSize: result.fileSize
        });
        
        // Set the current GLB buffer for the HTML editor
        setCurrentGlbBuffer(result.arrayBuffer);
        
        console.log('Model processed for HTML editor integration:', result.fileName);
    } catch (error) {
        console.error('Error processing model file for HTML editor:', error);
    }
}

/**
 * Set the current GLB buffer for the application
 * @param {ArrayBuffer} glbBuffer - The GLB file as an ArrayBuffer
 */
export function setCurrentGlbBuffer(glbBuffer) {
    currentGlbBuffer = glbBuffer;
    
    // Optionally notify other components that the buffer has changed
    const event = new CustomEvent('glb-buffer-changed', { detail: { buffer: glbBuffer } });
    window.dispatchEvent(event);
}

/**
 * Get the current GLB buffer
 * @returns {ArrayBuffer|null} The current GLB buffer or null if not set
 */
export function getCurrentGlbBuffer() {
    // First check our local variable
    if (currentGlbBuffer) {
        return currentGlbBuffer;
    }
    
    // If not available, try to get from state
    const state = getState();
    if (state && state.currentGlb && state.currentGlb.arrayBuffer) {
        // Update our local variable for next time
        currentGlbBuffer = state.currentGlb.arrayBuffer;
        return currentGlbBuffer;
    }
    
    return null;
}

/**
 * Get mesh by index from the loaded model
 * @param {number} meshIndex - Index of the mesh to retrieve
 * @returns {THREE.Mesh|null} The mesh object or null if not found
 */
export function getMeshByIndex(meshIndex) {
    const state = getState();
    if (!state || !state.meshes || meshIndex >= state.meshes.length) {
        return null;
    }
    
    return state.meshes[meshIndex];
}

/**
 * @deprecated Use getMeshByIndex instead
 * Get mesh by ID (same as getMeshByIndex for backward compatibility)
 * @param {number} meshId - ID of the mesh to retrieve (same as index)
 * @returns {THREE.Mesh|null} The mesh object or null if not found
 */
export function getMeshById(meshId) {
    console.warn(`DEPRECATED: getMeshById is deprecated, use getMeshByIndex instead. Called with ID: ${meshId}`);
    return getMeshByIndex(meshId);
}

/**
 * Update the GLB file with modified data and save it
 * @param {ArrayBuffer} updatedGlb - The updated GLB file
 * @returns {Promise<boolean>} Promise that resolves to true if successful
 */
export async function updateGlbFile(updatedGlb) {
    try {
        // Update our local reference
        setCurrentGlbBuffer(updatedGlb);
        
        // Update state
        const state = getState();
        if (state && state.currentGlb) {
            state.currentGlb.arrayBuffer = updatedGlb;
            
            // If there's a download function available, call it
            if (typeof window.updateDownloadLink === 'function') {
                window.updateDownloadLink(updatedGlb);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error updating GLB file:', error);
        return false;
    }
}

export default {
    initModelIntegration,
    getCurrentGlbBuffer,
    getMeshByIndex,
    getMeshById,
    updateGlbFile
}; 