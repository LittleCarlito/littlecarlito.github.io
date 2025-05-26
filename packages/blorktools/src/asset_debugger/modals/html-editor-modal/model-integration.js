/**
 * Model Integration for HTML Editor
 * 
 * This module integrates the HTML editor with model loading
 * to support storing and retrieving HTML content in GLB files.
 */

import { getState, updateState } from '../../scene/state.js';
import { processGLBModel } from '../../util/glb-utils.js';

// Current GLB buffer storage
let currentGlbBuffer = null;
let bufferUpdateListeners = [];

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
 * @returns {Promise<ArrayBuffer>} - Promise that resolves to the processed GLB buffer
 */
export async function processModelFileForHtmlEditor(file) {
    try {
        // Process the model file using our GLB utility
        const result = await processGLBModel(file);
        
        if (!result || !result.arrayBuffer) {
            console.error('[DEBUG] processGLBModel failed to return a valid buffer');
            return null;
        }
        
        console.log(`[DEBUG] processModelFileForHtmlEditor: processed buffer size ${result.arrayBuffer.byteLength} bytes`);
        
        // Clone the buffer to ensure we don't have reference issues
        const clonedBuffer = result.arrayBuffer.slice(0);
        
        // Update the state with the GLB buffer
        const state = getState();
        updateState('currentGlb', {
            arrayBuffer: clonedBuffer,
            fileName: result.fileName,
            fileSize: result.fileSize
        });
        
        // Set the current GLB buffer for the HTML editor
        setCurrentGlbBuffer(clonedBuffer);
        
        console.log('Model processed for HTML editor integration:', result.fileName);
        return clonedBuffer;
    } catch (error) {
        console.error('Error processing model file for HTML editor:', error);
        return null;
    }
}

/**
 * Register a listener for GLB buffer updates
 * @param {Function} callback - Function to call when buffer is updated
 * @returns {Function} Unregister function
 */
export function onGlbBufferUpdate(callback) {
    if (typeof callback !== 'function') return () => {};
    
    bufferUpdateListeners.push(callback);
    
    // Return unregister function
    return () => {
        const index = bufferUpdateListeners.indexOf(callback);
        if (index >= 0) {
            bufferUpdateListeners.splice(index, 1);
        }
    };
}

/**
 * Set the current GLB buffer for the application
 * @param {ArrayBuffer} glbBuffer - The GLB file as an ArrayBuffer
 */
export function setCurrentGlbBuffer(glbBuffer) {
    currentGlbBuffer = glbBuffer;
    
    // Notify all listeners
    for (const listener of bufferUpdateListeners) {
        try {
            listener(glbBuffer);
        } catch (error) {
            console.error('Error in buffer update listener:', error);
        }
    }
    
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
 * @param {boolean} [returnBuffer=false] - Whether to return the updated buffer
 * @returns {Promise<ArrayBuffer|boolean>} Promise that resolves to the updated buffer if returnBuffer is true, otherwise true if successful
 */
export async function updateGlbFile(updatedGlb, returnBuffer = false) {
    try {
        console.log(`Updating GLB file with buffer size: ${updatedGlb ? updatedGlb.byteLength : 0} bytes`);
        
        // Verify that we have a valid buffer before updating
        if (!updatedGlb || updatedGlb.byteLength === 0) {
            console.error('Cannot update GLB: Invalid buffer provided');
            return false;
        }
        
        // Verify this is a valid GLB file by checking the magic bytes
        const dataView = new DataView(updatedGlb);
        const magic = dataView.getUint32(0, true);
        const expectedMagic = 0x46546C67; // 'glTF' in ASCII
        
        if (magic !== expectedMagic) {
            console.error(`Invalid GLB file: Incorrect magic bytes`);
            return false;
        }
        
        // Clone the buffer to ensure we don't have reference issues
        const clonedBuffer = updatedGlb.slice(0);
        
        // Update our local reference using the setter function to trigger notifications
        setCurrentGlbBuffer(clonedBuffer);
        
        // Update state with cloned buffer
        const state = getState();
        if (state && state.currentGlb) {
            // Explicitly update state to ensure any listeners get notified
            updateState('currentGlb', { 
                ...state.currentGlb,
                arrayBuffer: clonedBuffer
            });
            
            // If there's a download function available, call it
            if (typeof window.updateDownloadLink === 'function') {
                window.updateDownloadLink(clonedBuffer);
            }
        } else {
            console.warn('No currentGlb in state to update');
        }
        
        return returnBuffer ? clonedBuffer : true;
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
    updateGlbFile,
    processModelFileForHtmlEditor
}; 