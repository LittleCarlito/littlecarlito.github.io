/**
 * Model Integration for HTML Editor
 * 
 * This module integrates the HTML editor with model loading
 * to support storing and retrieving HTML content in GLB files.
 */

import { getState, updateState } from '../../core/state.js';
import { setCurrentGlbBuffer } from './html-editor-modal.js';
import { processGLBModel } from '../../core/glb-utils.js';

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
 * Get the current GLB buffer from state
 * @returns {ArrayBuffer|null} The current GLB buffer or null if not available
 */
export function getCurrentGlbBuffer() {
    const state = getState();
    return state.currentGlb?.arrayBuffer || null;
}

export default {
    initModelIntegration,
    getCurrentGlbBuffer
}; 