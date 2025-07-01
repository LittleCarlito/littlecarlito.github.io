import { getState, updateState } from "../../state/scene-state";
import { handleLightingUpload } from "./lighting-file-handler";
import { handleModelUpload } from "./model-file-manager";
import { handleBackgroundUpload } from "./background-file-handler";
import { handleTextureUpload } from "./texture-file-handler";
import { handleZipUpload } from "./zip-handler";

// File type configuration object - a centralized definition of properties for each file type
const FILE_TYPE_CONFIG = {
    baseColor: {
        title: 'Base Color Atlas',
        instruction: 'Drag & drop your base color texture atlas here',
        acceptedFileTypes: ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'],
        stateKey: 'textureFiles',
        handler: handleTextureUpload,
        resetState: resetBaseColorState
    },
    orm: {
        title: 'ORM Atlas',
        instruction: 'Drag & drop your ORM (Occlusion, Roughness, Metalness) texture atlas here',
        acceptedFileTypes: ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'],
        stateKey: 'textureFiles',
        handler: handleTextureUpload,
        resetState: resetOrmState
    },
    normal: {
        title: 'Normal Atlas',
        instruction: 'Drag & drop your normal map texture atlas here',
        acceptedFileTypes: ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'], 
        stateKey: 'textureFiles',
        handler: handleTextureUpload,
        resetState: resetNormalState
    },
    model: {
        title: '3D Model',
        instruction: 'Drag & drop a GLB model file here',
        optionalText: 'If not provided, a cube will be used',
        acceptedFileTypes: ['.glb'],
        stateKey: 'modelFile',
        handler: handleModelUpload,
        resetState: resetModelState
    },
    lighting: {
        title: 'Lighting File',
        instruction: 'Drag & drop your HDR or EXR lighting file here',
        acceptedFileTypes: ['.hdr', '.exr'],
        stateKey: 'lightingFile',
        handler: handleLightingUpload,
        resetState: resetLightingState
    },
    background: {
        title: 'Background Image',
        instruction: 'Drag & drop your HDR, EXR, JPEG, PNG, WebP, or TIFF background image here',
        acceptedFileTypes: ['.hdr', '.exr', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'],
        stateKey: 'backgroundFile',
        handler: handleBackgroundUpload,
        resetState: resetBackgroundState
    },
    zip: {
        title: 'ZIP Archive',
        instruction: 'Drag & drop a ZIP file containing asset files here',
        acceptedFileTypes: ['.zip'],
        stateKey: 'zipFile',
        handler: handleZipUpload,
        resetState: resetZipState
    }
};

/**
 * Reset state for base color texture
 */
function resetBaseColorState() {
    console.debug('Resetting base color texture state');
    const state = getState();
    if (state.textureFiles) {
        state.textureFiles.baseColor = null;
        updateState('textureFiles', state.textureFiles);
    }
}

/**
 * Reset state for ORM texture
 */
function resetOrmState() {
    console.debug('Resetting ORM texture state');
    const state = getState();
    if (state.textureFiles) {
        state.textureFiles.orm = null;
        updateState('textureFiles', state.textureFiles);
    }
}

/**
 * Reset state for normal texture
 */
function resetNormalState() {
    console.debug('Resetting normal texture state');
    const state = getState();
    if (state.textureFiles) {
        state.textureFiles.normal = null;
        updateState('textureFiles', state.textureFiles);
    }
}

/**
 * Reset state for model file
 */
function resetModelState() {
    // Get current model and clear it from the scene if needed
    const state = getState();
    if (state.model && state.scene) {
        // Remove model from scene
        state.scene.remove(state.model);
        // Dispose of any textures or geometries within the model
        if (state.model.traverse) {
            state.model.traverse((node) => {
                if (node.geometry) node.geometry.dispose();
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(mat => {
                            Object.values(mat).forEach(value => {
                                if (value && typeof value.dispose === 'function') value.dispose();
                            });
                            mat.dispose();
                        });
                    } else {
                        Object.values(node.material).forEach(value => {
                            if (value && typeof value.dispose === 'function') value.dispose();
                        });
                        node.material.dispose();
                    }
                }
            });
        }
    }
    
    // Clear model-related state
    updateState('modelFile', null);
    updateState('useCustomModel', false);
    updateState('model', null);
}

/**
 * Reset state for lighting file
 */
function resetLightingState() {
    // Get current state
    const state = getState();
    
    // Remove environment map from scene if it exists
    if (state.scene && state.scene.environment) {
        // Dispose of the environment texture
        if (state.scene.environment.dispose) {
            state.scene.environment.dispose();
        }
        state.scene.environment = null;
        
        // Also reset the background if it was using the same environment map
        if (state.scene.background === state.scene.environment) {
            state.scene.background = null;
        }
    }
    
    // Clear lighting-related state
    updateState('lightingFile', null);
    updateState('environmentLightingEnabled', false);
    updateState('environmentTexture', null);
}

/**
 * Reset state for background file
 */
function resetBackgroundState() {
    // Get current state
    const state = getState();
    
    // Dispose of background texture if it exists
    if (state.backgroundTexture && state.backgroundTexture.dispose) {
        state.backgroundTexture.dispose();
    }
    
    // Remove background from scene if it exists and is different from environment
    if (state.scene && state.scene.background && state.scene.background !== state.scene.environment) {
        if (state.scene.background.dispose) {
            state.scene.background.dispose();
        }
        state.scene.background = null;
    }
    
    // Clear background-related state
    updateState({ 
        backgroundFile: null, 
        backgroundTexture: null,
        backgroundEnabled: false
    });
}

/**
 * Reset state for ZIP file
 */
function resetZipState() {
    console.debug('Resetting ZIP file state');
    updateState('zipFile', null);
}

/**
 * Setup dropzones for file input
 */
export function setupDropzones() {
    console.log('Setting up dropzones for file input...');
    
    // Get dropzone elements
    const baseColorDropzone = document.getElementById('basecolor-dropzone');
    const ormDropzone = document.getElementById('orm-dropzone');
    const normalDropzone = document.getElementById('normal-dropzone');
    const modelDropzone = document.getElementById('model-dropzone');
    const lightingDropzone = document.getElementById('lighting-dropzone');
    const backgroundDropzone = document.getElementById('background-dropzone');
    
    console.log('Dropzone elements found:', {
        baseColor: !!baseColorDropzone,
        orm: !!ormDropzone,
        normal: !!normalDropzone,
        model: !!modelDropzone,
        lighting: !!lightingDropzone,
        background: !!backgroundDropzone
    });
    
    // Get info elements
    const baseColorInfo = document.getElementById('basecolor-info');
    const ormInfo = document.getElementById('orm-info');
    const normalInfo = document.getElementById('normal-info');
    const modelInfo = document.getElementById('model-info');
    const lightingInfo = document.getElementById('lighting-info');
    const backgroundInfo = document.getElementById('background-info');
    
    // Set up each dropzone using the configuration
    const dropzones = [
        { element: baseColorDropzone, type: 'baseColor', info: baseColorInfo },
        { element: ormDropzone, type: 'orm', info: ormInfo },
        { element: normalDropzone, type: 'normal', info: normalInfo },
        { element: modelDropzone, type: 'model', info: modelInfo },
        { element: lightingDropzone, type: 'lighting', info: lightingInfo },
        { element: backgroundDropzone, type: 'background', info: backgroundInfo }
    ];
    
    dropzones.forEach(dz => {
        if (dz.element && dz.info) {
            setupDropzone(dz.element, dz.type, dz.info);
        } else if (dz.element) {
            // If info element not found, still set up the dropzone
            console.warn(`Info element for ${dz.type} not found, setting up with null infoElement`);
            setupDropzone(dz.element, dz.type, null);
        }
    });
    
    console.log('Dropzones setup complete');
}

/**
 * Set up a single dropzone with event handlers
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} fileType - The type of file this dropzone accepts
 * @param {HTMLElement} infoElement - Element to display file info
 */
export function setupDropzone(dropzone, fileType, infoElement) {
    if (!dropzone) {
        console.error(`Error: dropzone is null or undefined for type ${fileType}`);
        return;
    }
    
    // First remove any existing event listeners to prevent duplicates
    const clone = dropzone.cloneNode(true);
    if(dropzone.parentNode != null) {
        dropzone.parentNode.replaceChild(clone, dropzone);
    }
    dropzone = clone;

    const config = FILE_TYPE_CONFIG[fileType];
    
    if (!config) {
        console.error(`No configuration found for file type: ${fileType}`);
        return;
    }
    
    // Refresh infoElement reference if it's null (likely after clearing)
    if (!infoElement) {
        infoElement = document.getElementById(fileType.toLowerCase() + '-info');
    }
    
    // Set up the drop event for this dropzone
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
        dropzone.classList.add('active');
    }
    
    function unhighlight(e) {
        dropzone.classList.remove('active');
    }
    
    // Handle file drop
    dropzone.addEventListener('drop', event => {
        event.preventDefault();
        
        const dt = event.dataTransfer;
        const files = dt.files;
        
        if (files.length === 0) {
            return false;
        }
        
        const file = files[0]; // Use only the first file
        
        // Check if file extension is valid for this dropzone
        const validExtensions = config.acceptedFileTypes;
        const isValidFile = file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        
        if (isValidFile) {
            // Use the handler function from the configuration
            // For texture uploads, we need to pass the actual texture type string
            if (['baseColor', 'orm', 'normal'].includes(fileType)) {
                config.handler(file, fileType, infoElement, null, dropzone);
            } else {
                // Ensure we pass the current dropzone element to the handler
                config.handler(file, infoElement, null, dropzone);
            }
        } else if (file) {
            alert(`Please upload a valid file format: ${validExtensions.join(', ')}`);
            return false;
        }
        
        return false;
    }, false);
    
    // Handle click to select file using file input
    dropzone.addEventListener('click', (event) => {
        // If the click was on a clear button, don't do anything
        if (event.target.classList.contains('clear-preview-button')) {
            return;
        }
        
        // If the dropzone has a file (has-file class), only allow drag and drop to replace or clear button
        if (dropzone.classList.contains('has-file')) {
            // Check if the click was on a preview element (for example, the 3D model preview or image)
            // Don't open file dialog if click is on any preview element or inside a preview container
            const isOnPreview = event.target.closest('.preview') || 
                               event.target.classList.contains('texture-preview-img') || 
                               event.target.classList.contains('hdr-preview-canvas') ||
                               event.target.classList.contains('texture-preview-container') ||
                               event.target.classList.contains('hdr-preview-container');
            
            if (isOnPreview) {
                // If this is a click on a preview element, just return without opening the file picker
                return;
            }
            
            // If we get here, this is a click on the dropzone but not on a preview element
            // Since the dropzone already has a file, do nothing (don't open file dialog)
            return;
        }
        
        // Create a file input element - only for empty dropzones
        const input = document.createElement('input');
        input.type = 'file';
        
        // Set accept attribute based on file type
        input.accept = config.acceptedFileTypes.join(',');
        
        // Handle file selection
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            const isValidFile = config.acceptedFileTypes.some(ext => file.name.toLowerCase().endsWith(ext));
            
            if (isValidFile) {
                // Pass the dropzone element to the handler
                // For texture uploads, we need to pass the actual texture type string
                if (['baseColor', 'orm', 'normal'].includes(fileType)) {
                    config.handler(file, fileType, infoElement, null, dropzone);
                } else {
                    // Make sure to pass the dropzone parameter for all handlers
                    config.handler(file, infoElement, null, dropzone);
                }
            } else {
                alert(`Please upload a valid file format: ${config.acceptedFileTypes.join(', ')}`);
            }
        };
        
        input.click();
    });
}

/**
 * Clear a dropzone and reset it to its original state
 * @param {HTMLElement} dropzone - The dropzone element to clear
 * @param {string} fileType - The type of file ('baseColor', 'orm', 'normal', 'model', 'lighting', 'background')
 * @param {string} title - The original title of the dropzone
 */
export function clearDropzone(dropzone, fileType, title) {
    const config = FILE_TYPE_CONFIG[fileType];
    
    if (!config) {
        console.error(`No configuration found for file type: ${fileType}`);
        return;
    }
    
    // Reset state based on file type configuration
    if (config.resetState) {
        // Use custom reset function if defined
        config.resetState();
    } else if (config.stateKey === 'textureFiles') {
        // Handle texture file state
        const state = getState();
        state.textureFiles[fileType] = null;
        updateState('textureFiles', state.textureFiles);
        
        // BUGFIX: Also clear the corresponding texture object
        // This ensures the texture doesn't continue to be used after clearing
        if (state.textureObjects && state.textureObjects[fileType]) {
            state.textureObjects[fileType] = null;
            updateState('textureObjects', state.textureObjects);
        }
    } else if (config.stateKey) {
        // Handle other state keys
        updateState(config.stateKey, null);
    }
    
    // Clear the dropzone classes and content
    dropzone.classList.remove('has-file');
    dropzone.innerHTML = '';
    
    // Recreate the original dropzone content
    const titleElement = document.createElement('h3');
    titleElement.textContent = config.title || title;
    dropzone.appendChild(titleElement);
    
    // Add instruction text
    if (config.instruction) {
        const instructionText = document.createElement('p');
        instructionText.textContent = config.instruction;
        dropzone.appendChild(instructionText);
    }
    
    // Add optional text if present
    if (config.optionalText) {
        const optionalText = document.createElement('p');
        optionalText.textContent = config.optionalText;
        dropzone.appendChild(optionalText);
    }
    
    // Add an empty file info element
    const infoElement = document.createElement('p');
    infoElement.className = 'file-info';
    infoElement.id = fileType.toLowerCase() + '-info';
    dropzone.appendChild(infoElement);
    
    // Get the newly created info element to pass to setupDropzone
    const newInfoElement = document.getElementById(fileType.toLowerCase() + '-info');
    
    // Reattach the dropzone event handlers
    setupDropzone(dropzone, fileType, newInfoElement || infoElement);
}

/**
 * Prevent default drag behaviors
 * @param {Event} e - The event object
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
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