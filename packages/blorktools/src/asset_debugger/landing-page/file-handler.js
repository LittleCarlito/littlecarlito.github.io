import * as THREE from 'three';
import { getState, updateState } from '../util/state/scene-state';
import { updateAtlasVisualization } from '../panels/atlas-panel/atlas-panel.js';
import { 
  processTextureFile, 
  processModelFile, 
  terminateAllWorkers 
} from '../util/workers/worker-manager.js';
import { parseLightingData } from '../util/scene/lighting-manager';
import { clearDropzone, setupDropzone } from '../util/upload/file-upload-manager';
import { createGLBPreview } from '../util/upload/glb-preview-controller';
import { processGLBFile } from '../util/upload/handlers/model/glb-file-handler';

// Add event listener to terminate all workers when the page is unloaded
window.addEventListener('beforeunload', () => {
  terminateAllWorkers();
});

/**
 * Shows loading state for a preview element
 * @param {HTMLElement} previewElement - The preview element to show loading for
 */
export function showPreviewLoading(previewElement) {
    // Create loading overlay if it doesn't exist
    if (!previewElement.querySelector('.preview-loading')) {
        const loadingElement = document.createElement('div');
        loadingElement.className = 'preview-loading';
        
        const spinnerContainer = document.createElement('div');
        spinnerContainer.className = 'preview-loading-spinner';
        
        // Create atomic spinner structure
        const atomicSpinner = document.createElement('div');
        atomicSpinner.className = 'atomic-spinner';
        
        const nucleus = document.createElement('div');
        nucleus.className = 'nucleus';
        
        const orbit1 = document.createElement('div');
        orbit1.className = 'electron-orbit';
        const electron1 = document.createElement('div');
        electron1.className = 'electron';
        orbit1.appendChild(electron1);
        
        const orbit2 = document.createElement('div');
        orbit2.className = 'electron-orbit';
        const electron2 = document.createElement('div');
        electron2.className = 'electron';
        orbit2.appendChild(electron2);
        
        const orbit3 = document.createElement('div');
        orbit3.className = 'electron-orbit';
        const electron3 = document.createElement('div');
        electron3.className = 'electron';
        orbit3.appendChild(electron3);
        
        atomicSpinner.appendChild(nucleus);
        atomicSpinner.appendChild(orbit1);
        atomicSpinner.appendChild(orbit2);
        atomicSpinner.appendChild(orbit3);
        
        spinnerContainer.appendChild(atomicSpinner);
        
        const loadingText = document.createElement('div');
        loadingText.className = 'preview-loading-text';
        loadingText.textContent = 'Loading...';
        
        loadingElement.appendChild(spinnerContainer);
        loadingElement.appendChild(loadingText);
        
        previewElement.appendChild(loadingElement);
    }
}

/**
 * Hides loading state for a preview element
 * @param {HTMLElement} previewElement - The preview element to hide loading for
 */
export function hidePreviewLoading(previewElement) {
    const loadingElement = previewElement.querySelector('.preview-loading');
    if (loadingElement) {
        loadingElement.remove();
    }
}

/**
 * Creates a clear button for a dropzone
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} type - The type of asset ('basecolor', 'normal', 'orm', 'model', 'lighting', 'background')
 * @param {string} originalTitle - The original title of the dropzone
 * @returns {HTMLElement} The created clear button
 */
export function createClearButton(dropzone, type, originalTitle) {
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-preview-button';
    clearButton.innerHTML = '&times;';
    clearButton.title = 'Clear file';
    
    clearButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropzone click event
        
        // Clear all relevant state for this type
        clearStateForType(type);
        
        // Clear the dropzone
        clearDropzone(dropzone, type, originalTitle);
        
        // Reattach the dropzone event handlers
        setupDropzone(dropzone, type, document.getElementById(`${type}-info`));
    });
    
    return clearButton;
}

/**
 * Format file size for display
 * @param {number} bytes - The file size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

/**
 * Clears all relevant state for a given asset type
 * @param {string} type - The type of asset ('basecolor', 'normal', 'orm', 'model', 'lighting', 'background')
 */
function clearStateForType(type) {
    const state = getState();
    
    switch (type) {
        case 'basecolor':
        case 'normal':
        case 'orm':
            // Clear texture object and file
            if (state.textureObjects && state.textureObjects[type]) {
                const texture = state.textureObjects[type];
                if (texture && typeof texture.dispose === 'function') {
                    texture.dispose();
                }
            }
            updateState('textureFiles', { ...state.textureFiles, [type]: null });
            break;
            
        case 'model':
            updateState({
                modelFile: null,
                useCustomModel: false
            });
            break;
            
        case 'lighting':
            updateState({
                lightingFile: null,
                environmentTexture: null
            });
            break;
            
        case 'background':
            updateState({
                backgroundFile: null,
                backgroundTexture: null
            });
            break;
    }
    
    // Log the state after clearing
    console.debug(`State after clearing ${type}:`, getState());
}