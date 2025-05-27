/**
 * Texture Debugger - File Handler Module
 * 
 * This module manages file uploads and drag & drop operations.
 */
import { getState, updateState } from '../scene/state';
import { loadTextureFromFile, formatFileSize } from '../util/materials-util';
import { updateAtlasVisualization } from '../panels/atlas-panel/atlas-panel.js';
// Import for HDR/EXR preview rendering
import * as worldPanelModule from '../panels/world-panel/world-panel.js';
// Import for GLB model preview from the new GLB utility
import { processGLBModel, createGLBPreview } from '../util/glb-utils';
// Import the worker manager
import { 
  processTextureFile, 
  processModelFile, 
  processLightingFile, 
  terminateAllWorkers 
} from '../util/workers/worker-manager.js';
import { parseLightingData } from '../scene/lighting-util';
import { setupDropzone } from './dropzone-util';

// Add event listener to terminate all workers when the page is unloaded
window.addEventListener('beforeunload', () => {
  terminateAllWorkers();
});

// File type configuration object - a centralized definition of properties for each file type
const FILE_TYPE_CONFIG = {
    baseColor: {
        title: 'Base Color Atlas',
        instruction: 'Drag & drop your base color texture atlas here',
        acceptedFileTypes: ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'],
        stateKey: 'textureFiles',
        handler: handleTextureUpload
    },
    orm: {
        title: 'ORM Atlas',
        instruction: 'Drag & drop your ORM (Occlusion, Roughness, Metalness) texture atlas here',
        acceptedFileTypes: ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'],
        stateKey: 'textureFiles',
        handler: handleTextureUpload
    },
    normal: {
        title: 'Normal Atlas',
        instruction: 'Drag & drop your normal map texture atlas here',
        acceptedFileTypes: ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'], 
        stateKey: 'textureFiles',
        handler: handleTextureUpload
    },
    model: {
        title: '3D Model',
        instruction: 'Drag & drop a GLB model file here',
        optionalText: 'If not provided, a cube will be used',
        acceptedFileTypes: ['.glb'],
        stateKey: 'modelFile',
        resetState: () => {
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
        },
        handler: handleModelUpload
    },
    lighting: {
        title: 'Lighting File',
        instruction: 'Drag & drop your HDR or EXR lighting file here',
        acceptedFileTypes: ['.hdr', '.exr'],
        stateKey: 'lightingFile',
        resetState: () => {
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
        },
        handler: handleLightingUpload
    },
    background: {
        title: 'Background Image',
        instruction: 'Drag & drop your HDR, EXR, JPEG, PNG, WebP, or TIFF background image here',
        acceptedFileTypes: ['.hdr', '.exr', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'],
        stateKey: 'backgroundFile',
        resetState: () => {
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
        },
        handler: handleBackgroundUpload
    },
    zip: {
        title: 'ZIP Archive',
        instruction: 'Drag & drop a ZIP file containing asset files here',
        acceptedFileTypes: ['.zip'],
        stateKey: 'zipFile',
        resetState: () => {
            updateState('zipFile', null);
        },
        handler: handleZipUpload
    }
};

/**
 * Shows loading state for a preview element
 * @param {HTMLElement} previewElement - The preview element to show loading for
 */
function showPreviewLoading(previewElement) {
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
function hidePreviewLoading(previewElement) {
    const loadingElement = previewElement.querySelector('.preview-loading');
    if (loadingElement) {
        loadingElement.remove();
    }
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
 * Handle texture file upload
 * @param {File} file - The uploaded file
 * @param {string} textureType - The type of texture ('baseColor', 'orm', 'normal')
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleTextureUpload(file, textureType, infoElement, previewElement, dropzone) {
    // Store the file in the state
    const state = getState();
    state.textureFiles[textureType] = file;
    updateState('textureFiles', state.textureFiles);
    
    // Check if dropzone is defined before using it
    if (!dropzone) {
        console.error(`Error: dropzone is undefined in handleTextureUpload for ${textureType}`);
        return;
    }
    
    // Store original h3 title
    const originalTitle = dropzone.querySelector('h3').textContent;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Clear the entire dropzone content
    dropzone.innerHTML = '';
    
    // Add back just the title as a header
    const titleElement = document.createElement('h3');
    titleElement.textContent = originalTitle;
    dropzone.appendChild(titleElement);
    
    // Add a clear button
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-preview-button';
    clearButton.innerHTML = '&times;';
    clearButton.title = 'Clear file';
    clearButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropzone click event
        
        // Dispose of texture if it exists
        if (state.textureObjects && state.textureObjects[textureType]) {
            const texture = state.textureObjects[textureType];
            if (texture && typeof texture.dispose === 'function') {
                texture.dispose();
            }
        }
        
        // Clear the dropzone
        clearDropzone(dropzone, textureType, originalTitle);
        
        // Reattach the dropzone event handlers
        setupDropzone(dropzone, textureType, document.getElementById(textureType.toLowerCase() + '-info'));
    });
    dropzone.appendChild(clearButton);
    
    // Add file info
    infoElement = document.createElement('p');
    infoElement.className = 'file-info';
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    dropzone.appendChild(infoElement);
    
    // Create a container for the preview that will hold both the image and the loading indicator
    const containerDiv = document.createElement('div');
    containerDiv.className = 'texture-preview-container';
    
    // Add event listener to prevent click events from reaching the dropzone
    containerDiv.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Add event listener to prevent mousedown events to avoid accidental drag interactions
    containerDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    // Add the container directly to the dropzone
    dropzone.appendChild(containerDiv);
    
    // Show loading state directly on the container
    showPreviewLoading(containerDiv);
    
    // Process the texture file in a web worker
    processTextureFile(file, textureType)
        .then(result => {
            // Create preview image using the data URL returned by the worker
            const img = document.createElement('img');
            img.src = result.previewDataUrl;
            img.className = 'texture-preview-img hidden';
            containerDiv.appendChild(img);
            
            // Load texture first, then update the preview
            return loadTextureFromFile(file, textureType)
                .then(() => {
                    // Now that texture is loaded, show the image
                    img.classList.remove('hidden');
                    img.classList.add('visible');
                    
                    // Hide loading indicator
                    hidePreviewLoading(containerDiv);
                    
                    // Update atlas visualization if we're on that tab
                    const atlasTab = document.getElementById('atlas-tab');
                    if (atlasTab && atlasTab.classList.contains('active')) {
                        updateAtlasVisualization();
                    }
                });
        })
        .catch(error => {
            console.error(`Error processing ${textureType} texture:`, error);
            alert(`Error processing ${textureType} texture: ${error.message}`);
            
            // On error, make sure textureObjects entry is null
            const state = getState();
            if (state.textureObjects) {
                state.textureObjects[textureType] = null;
                updateState('textureObjects', state.textureObjects);
            }
            
            // Fall back to direct loading if worker fails
            const reader = new FileReader();
            reader.onload = e => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'texture-preview-img visible';
                containerDiv.appendChild(img);
                
                // Hide loading indicator
                hidePreviewLoading(containerDiv);
            };
            reader.readAsDataURL(file);
        });
}

/**
 * Handle model file upload
 * @param {File} file - The uploaded file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleModelUpload(file, infoElement, dropzone) {
    // Store the file in the state
    updateState('modelFile', file);
    updateState('useCustomModel', true);
    
    // If dropzone is null, find it by ID
    if (!dropzone) {
        console.log("Dropzone parameter is null, attempting to find model dropzone by ID");
        dropzone = document.getElementById('model-dropzone');
        
        // If still null, just update state and return early
        if (!dropzone) {
            console.error("Could not find model-dropzone element, skipping UI update");
            return;
        }
    }
    
    // Store original h3 title
    const originalTitle = dropzone.querySelector('h3').textContent;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Clear the entire dropzone content
    dropzone.innerHTML = '';
    
    // Add back just the title as a header
    const titleElement = document.createElement('h3');
    titleElement.textContent = originalTitle;
    dropzone.appendChild(titleElement);
    
    // Add a clear button for the model dropzone
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-preview-button';
    clearButton.innerHTML = '&times;';
    clearButton.title = 'Clear file';
    clearButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropzone click event
        clearDropzone(dropzone, 'model', originalTitle);
    });
    dropzone.appendChild(clearButton);
    
    // Add file info
    infoElement = document.createElement('p');
    infoElement.className = 'file-info';
    infoElement.id = 'model-info';
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    dropzone.appendChild(infoElement);
    
    // Create a preview container
    const previewDiv = document.createElement('div');
    previewDiv.className = 'preview model-preview-container';
    previewDiv.id = 'model-preview';
    
    // Add event listener to prevent click events from reaching the dropzone
    previewDiv.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Add event listener to prevent mousedown events to avoid accidental drag interactions
    previewDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    dropzone.appendChild(previewDiv);
    
    // Show loading state
    showPreviewLoading(previewDiv);
    
    // Process the model file using our new GLB utility
    processGLBModel(file)
        .then(result => {
            // Create the 3D preview with our new GLB utility
            return createGLBPreview(file, previewDiv);
        })
        .then(result => {
            // Hide loading indicator
            hidePreviewLoading(previewDiv);
            
            // Update the texture dropzone hints to show textures are optional with GLB
            const textureHints = document.querySelectorAll('.texture-hint');
            textureHints.forEach(hint => {
                hint.textContent = 'Textures are optional with GLB';
                hint.classList.add('optional');
            });
        })
        .catch(error => {
            console.error('Error processing model file:', error);
            hidePreviewLoading(previewDiv);
            
            // Show error message in preview
            const errorMsg = document.createElement('div');
            errorMsg.className = 'no-image-message visible';
            errorMsg.textContent = 'Error loading model. Please try another file.';
            previewDiv.appendChild(errorMsg);
        });
}

/**
 * Handle lighting file upload
 * @param {File} file - The uploaded file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleLightingUpload(file, infoElement, previewElement, dropzone) {
    // Validate file type (already done in caller) and store in state
    updateState('lightingFile', file);
    
    // Set the environment lighting enabled flag
    updateState('environmentLightingEnabled', true);
    
    // Store original h3 title
    const originalTitle = dropzone.querySelector('h3').textContent;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Clear the entire dropzone content
    dropzone.innerHTML = '';
    
    // Add back just the title as a header
    const titleElement = document.createElement('h3');
    titleElement.textContent = originalTitle;
    dropzone.appendChild(titleElement);
    
    // Add a clear button
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-preview-button';
    clearButton.innerHTML = '&times;';
    clearButton.title = 'Clear file';
    clearButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropzone click event
        clearDropzone(dropzone, 'lighting', originalTitle);
        
        // Reattach the dropzone event handlers
        setupDropzone(dropzone, 'lighting', document.getElementById('lighting-info'));
    });
    dropzone.appendChild(clearButton);
    
    // Add file info
    infoElement = document.createElement('p');
    infoElement.className = 'file-info';
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    dropzone.appendChild(infoElement);
    
    // Create a container for the preview that will hold both the canvas and the loading indicator
    const previewDiv = document.createElement('div');
    previewDiv.className = 'preview';
    dropzone.appendChild(previewDiv);
    
    const containerDiv = document.createElement('div');
    containerDiv.className = 'hdr-preview-container';
    
    // Add event listener to prevent click events from reaching the dropzone
    containerDiv.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Add event listener to prevent mousedown events to avoid accidental drag interactions
    containerDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    previewDiv.appendChild(containerDiv);
    
    // Show loading state directly on the container
    showPreviewLoading(containerDiv);
    
    // Create canvas for the preview with appropriate size but keep it hidden initially
    const canvas = document.createElement('canvas');
    canvas.className = 'hdr-preview-canvas';
    
    // Make canvas dimensions equal for a square aspect ratio
    const previewSize = 256;
    canvas.width = previewSize;
    canvas.height = previewSize;
    
    canvas.classList.add('hidden'); // Initially hidden until loaded
    
    // Create a message element for errors/status
    const messageDiv = document.createElement('div');
    messageDiv.className = 'no-image-message hidden';
    
    // Add elements to the container
    containerDiv.appendChild(canvas);
    containerDiv.appendChild(messageDiv);
    
    // Process the lighting file in a web worker
    processLightingFile(file)
        .then(result => {
            // Use the worker result to process the lighting file
            const fileType = result.fileType;
            const arrayBuffer = result.arrayBuffer;
            
            // For EXR files
            if (fileType === 'exr') {
                import('three').then(THREE => {
                    import('three/addons/loaders/EXRLoader.js').then(({ EXRLoader }) => {
                        const loader = new EXRLoader();
                        loader.setDataType(THREE.FloatType);
                        
                        // Create a Blob from the array buffer
                        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        
                        loader.load(url, texture => {
                            // Show the canvas
                            canvas.classList.add('visible');
                            canvas.classList.remove('hidden');
                            
                            // Use the world panel's createSpherePreview function
                            if (worldPanelModule.createSpherePreview) {
                                worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                            }
                            
                            // Clean up URL after loading
                            URL.revokeObjectURL(url);
                            
                            // Hide loading indicator
                            hidePreviewLoading(containerDiv);
                            
                            // Always store the lighting texture for use in previews
                            updateState('environmentTexture', texture);
                        }, undefined, error => {
                            console.error('Error loading EXR texture:', error);
                            canvas.classList.add('visible');
                            canvas.classList.remove('hidden');
                            hidePreviewLoading(containerDiv);
                            if (messageDiv) {
                                messageDiv.classList.remove('hidden');
                                messageDiv.classList.add('visible');
                                messageDiv.textContent = 'Error loading EXR file';
                            }
                        });
                    }).catch(handleLightingError);
                }).catch(handleLightingError);
            } 
            // For HDR files
            else if (fileType === 'hdr') {
                import('three').then(THREE => {
                    import('three/addons/loaders/RGBELoader.js').then(({ RGBELoader }) => {
                        const loader = new RGBELoader();
                        
                        // Create a Blob from the array buffer
                        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        
                        loader.load(url, texture => {
                            // Show the canvas
                            canvas.classList.add('visible');
                            canvas.classList.remove('hidden');
                            
                            // Use the world panel's createSpherePreview function
                            if (worldPanelModule.createSpherePreview) {
                                worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                            }
                            
                            // Clean up URL after loading
                            URL.revokeObjectURL(url);
                            
                            // Hide loading indicator
                            hidePreviewLoading(containerDiv);
                            
                            // Always store the lighting texture for use in previews
                            updateState('environmentTexture', texture);
                        }, undefined, error => {
                            console.error('Error loading HDR texture:', error);
                            canvas.classList.add('visible');
                            canvas.classList.remove('hidden');
                            hidePreviewLoading(containerDiv);
                            if (messageDiv) {
                                messageDiv.classList.remove('hidden');
                                messageDiv.classList.add('visible');
                                messageDiv.textContent = 'Error loading HDR file';
                            }
                        });
                    }).catch(handleLightingError);
                }).catch(handleLightingError);
            }
            else {
                handleLightingError(new Error('Unsupported file type: ' + fileType));
                return -1;
            }

            // Handle lighting metadata for world panel
            import('../scene/lighting-util').then(lightingUtil => {
                lightingUtil.parseLightingData(file).then(metadata => {
                    worldPanelModule.updateLightingInfo(metadata);
                    
                    // Explicitly mark that there's no background image but lighting is available
                    const currentState = getState();
                    if (!currentState.backgroundFile) {
                        // Make sure world panel shows "No Background Image" message
                        import('../panels/world-panel/world-panel.js').then(worldPanel => {
                            if (worldPanel.updateBackgroundInfo) {
                                // Pass empty metadata to show no background available
                                worldPanel.updateBackgroundInfo({
                                    fileName: null,
                                    type: null,
                                    dimensions: { width: 0, height: 0 },
                                    fileSizeBytes: 0
                                }, true); // skipRendering=true to prevent trying to render a non-existent background
                                
                                // Make sure UI shows no background but lighting available
                                if (worldPanel.toggleBackgroundMessages) {
                                    worldPanel.toggleBackgroundMessages(false, true);
                                }
                            }
                        });
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error processing lighting file:', error);
            handleLightingError(error);
        });
        
    // Helper function to handle lighting errors
    function handleLightingError(error) {
        console.error('Lighting error:', error);
        canvas.classList.add('visible');
        canvas.classList.remove('hidden');
        hidePreviewLoading(containerDiv);
        if (messageDiv) {
            messageDiv.classList.remove('hidden');
            messageDiv.classList.add('visible');
            messageDiv.textContent = 'Error loading lighting file';
        }
    }
    // Enable visibility of the HDR option - this is the ONLY place where the HDR option visibility should be toggled
    worldPanelModule.toggleOptionVisibility('hdr-option', true);
}

/**
 * Handle background image file upload
 * @param {File} file - The background image file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to show preview (optional)
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleBackgroundUpload(file, infoElement, previewElement, dropzone) {
    if (!file) return;
    
    // Store original h3 title
    const originalTitle = dropzone.querySelector('h3').textContent;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Clear the entire dropzone content
    dropzone.innerHTML = '';
    
    // Add back just the title as a header
    const titleElement = document.createElement('h3');
    titleElement.textContent = originalTitle;
    dropzone.appendChild(titleElement);
    
    // Add a clear button
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-preview-button';
    clearButton.innerHTML = '&times;';
    clearButton.title = 'Clear background image';
    clearButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropzone click event
        clearDropzone(dropzone, 'background', originalTitle);
        
        // Reattach the dropzone event handlers
        setupDropzone(dropzone, 'background', document.getElementById('background-info'));
        
        // Update state to remove the background image
        updateState({ backgroundFile: null, backgroundTexture: null });
    });
    dropzone.appendChild(clearButton);
    
    // Add file info
    infoElement = document.createElement('p');
    infoElement.className = 'file-info';
    infoElement.id = 'background-info';
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    dropzone.appendChild(infoElement);
    
    // Create a container for the preview that will hold both the canvas and the loading indicator
    const previewDiv = document.createElement('div');
    previewDiv.className = 'preview';
    dropzone.appendChild(previewDiv);
    
    const containerDiv = document.createElement('div');
    // TODO rename as HDR is filetype and not always type used
    containerDiv.className = 'hdr-preview-container';
    
    // Add event listener to prevent click events from reaching the dropzone
    containerDiv.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Add event listener to prevent mousedown events to avoid accidental drag interactions
    containerDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    previewDiv.appendChild(containerDiv);
    
    // Show loading state directly on the container
    showPreviewLoading(containerDiv);
    
    // Create canvas for the preview with appropriate size
    const canvas = document.createElement('canvas');
    // TODO Rename ref
    canvas.className = 'hdr-preview-canvas';
    
    // Make canvas dimensions equal for a square aspect ratio
    const previewSize = 256;
    canvas.width = previewSize;
    canvas.height = previewSize;
    
    canvas.classList.add('hidden'); // Initially hidden until loaded
    
    // Create a message element for errors/status
    const messageDiv = document.createElement('div');
    messageDiv.className = 'no-image-message hidden';
    
    // Add elements to the container
    containerDiv.appendChild(canvas);
    containerDiv.appendChild(messageDiv);
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // Process the file based on its type
    if (['exr'].includes(fileExtension)) {
        // EXR needs special loader
        // TODO Change these to static imports
        import('three').then(THREE => {
            import('three/addons/loaders/EXRLoader.js').then(({ EXRLoader }) => {
                const loader = new EXRLoader();
                loader.setDataType(THREE.FloatType);
                
                // Create reader for the file
                const reader = new FileReader();
                reader.onload = function(e) {
                    const arrayBuffer = e.target.result;
                    
                    // Create a Blob and URL from the array buffer
                    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    
                    loader.load(url, texture => {
                        // Show the canvas
                        canvas.classList.add('visible');
                        canvas.classList.remove('hidden');
                        
                        // Use the world panel's createSpherePreview function
                        if (worldPanelModule.createSpherePreview) {
                            worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                        }
                        
                        // Clean up URL after loading
                        URL.revokeObjectURL(url);
                        
                        // Hide loading indicator
                        hidePreviewLoading(containerDiv);
                        
                        // Update state with the background texture
                        updateState({ 
                            backgroundTexture: texture,
                            backgroundFile: file  // Preserve the file reference
                        });
                    }, undefined, error => {
                        console.error('Error loading EXR background texture:', error);
                        canvas.classList.add('visible');
                        canvas.classList.remove('hidden');
                        hidePreviewLoading(containerDiv);
                        
                        if (messageDiv) {
                            messageDiv.classList.remove('hidden');
                            messageDiv.classList.add('visible');
                            messageDiv.textContent = 'Error loading EXR file';
                        }
                    });
                };
                
                reader.onerror = function() {
                    console.error('Error reading file');
                    hidePreviewLoading(containerDiv);
                    if (messageDiv) {
                        messageDiv.classList.remove('hidden');
                        messageDiv.classList.add('visible');
                        messageDiv.textContent = 'Error reading file';
                    }
                };
                
                reader.readAsArrayBuffer(file);
            }).catch(error => {
                console.error('Error loading EXRLoader:', error);
                hidePreviewLoading(containerDiv);
                canvas.classList.add('visible');
                canvas.classList.remove('hidden');
            });
        }).catch(error => {
            console.error('Error loading Three.js:', error);
            hidePreviewLoading(containerDiv);
            if (messageDiv) {
                messageDiv.classList.remove('hidden');
                messageDiv.classList.add('visible');
                messageDiv.textContent = 'Error loading Three.js';
            }
        });
    } else if (['hdr'].includes(fileExtension)) {
        // HDR needs special loader
        import('three').then(THREE => {
            import('three/addons/loaders/RGBELoader.js').then(({ RGBELoader }) => {
                const loader = new RGBELoader();
                
                // Create reader for the file
                const reader = new FileReader();
                reader.onload = function(e) {
                    const arrayBuffer = e.target.result;
                    
                    // Create a Blob and URL from the array buffer
                    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    
                    loader.load(url, texture => {
                        // Show the canvas
                        canvas.classList.add('visible');
                        canvas.classList.remove('hidden');
                        
                        // Use the world panel's createSpherePreview function
                        if (worldPanelModule.createSpherePreview) {
                            worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                        }
                        
                        // Clean up URL after loading
                        URL.revokeObjectURL(url);
                        
                        // Hide loading indicator
                        hidePreviewLoading(containerDiv);
                        
                        // Only update background state if no background file exists already
                        const currentState = getState();
                        if (!currentState.backgroundFile) {
                            // Update state with the background texture only if no background exists
                            updateState({ 
                                backgroundTexture: texture,
                                backgroundFile: file  // Preserve the file reference
                            });
                        }
                        
                        // Always store the lighting texture for use in previews
                        updateState('environmentTexture', texture);
                        
                        // Trigger an update in world panel to show the environment preview
                        import('../panels/world-panel/world-panel.js').then(worldPanel => {
                            if (worldPanel.updateWorldPanel) {
                                worldPanel.updateWorldPanel();
                            }
                        });
                    }, undefined, error => {
                        console.error('Error loading HDR background texture:', error);
                        canvas.classList.add('visible');
                        canvas.classList.remove('hidden');
                        hidePreviewLoading(containerDiv);
                        
                        if (messageDiv) {
                            messageDiv.classList.remove('hidden');
                            messageDiv.classList.add('visible');
                            messageDiv.textContent = 'Error loading HDR file';
                        }
                    });
                };
                
                reader.onerror = function() {
                    console.error('Error reading file');
                    hidePreviewLoading(containerDiv);
                    if (messageDiv) {
                        messageDiv.classList.remove('hidden');
                        messageDiv.classList.add('visible');
                        messageDiv.textContent = 'Error reading file';
                    }
                };
                
                reader.readAsArrayBuffer(file);
            }).catch(error => {
                console.error('Error loading RGBELoader:', error);
                hidePreviewLoading(containerDiv);
                canvas.classList.add('visible');
                canvas.classList.remove('hidden');
            });
        }).catch(error => {
            console.error('Error loading Three.js:', error);
            hidePreviewLoading(containerDiv);
            if (messageDiv) {
                messageDiv.classList.remove('hidden');
                messageDiv.classList.add('visible');
                messageDiv.textContent = 'Error loading Three.js';
            }
        });
    } else if (['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif'].includes(fileExtension)) {
        // Standard image formats - load with regular THREE.TextureLoader
        import('three').then(THREE => {
            // Create a reader to get the data URL
            const reader = new FileReader();
            reader.onload = function(e) {
                // Create a texture from the data URL using THREE.TextureLoader
                const textureLoader = new THREE.TextureLoader();
                textureLoader.load(e.target.result, texture => {
                    // Show the canvas
                    canvas.classList.add('visible');
                    canvas.classList.remove('hidden');
                    
                    // Make sure to set proper texture parameters
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    
                    // Use the world panel's createSpherePreview function
                    if (worldPanelModule.createSpherePreview) {
                        worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                    }
                    
                    // Hide loading indicator
                    hidePreviewLoading(containerDiv);
                    
                    // Update state with the background texture
                    updateState({ 
                        backgroundTexture: texture,
                        backgroundFile: file  // Preserve the file reference
                    });
                    
                    // Trigger an update in world panel to show the environment preview
                    import('../panels/world-panel/world-panel.js').then(worldPanel => {
                        if (worldPanel.updateWorldPanel) {
                            worldPanel.updateWorldPanel();
                        }
                    });
                }, undefined, error => {
                    console.error('Error loading image texture:', error);
                    canvas.classList.add('visible');
                    canvas.classList.remove('hidden');
                    hidePreviewLoading(containerDiv);
                    
                    if (messageDiv) {
                        messageDiv.classList.remove('hidden');
                        messageDiv.classList.add('visible');
                        messageDiv.textContent = 'Error loading image file';
                    }
                });
            };
            
            reader.onerror = function() {
                console.error('Error reading image file');
                hidePreviewLoading(containerDiv);
                if (messageDiv) {
                    messageDiv.classList.remove('hidden');
                    messageDiv.classList.add('visible');
                    messageDiv.textContent = 'Error reading image file';
                }
            };
            
            reader.readAsDataURL(file);
        }).catch(error => {
            console.error('Error loading Three.js:', error);
            hidePreviewLoading(containerDiv);
            if (messageDiv) {
                messageDiv.classList.remove('hidden');
                messageDiv.classList.add('visible');
                messageDiv.textContent = 'Error loading Three.js';
            }
        });
    }
    
    // Update state with the background file
    updateState({
        backgroundFile: file
    });
    // Enable visibility of the background option - this is the ONLY place where the background option visibility should be toggled
    worldPanelModule.toggleOptionVisibility('background-option', true);
}

/**
 * Handle ZIP file upload
 * @param {File} file - The uploaded ZIP file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleZipUpload(file, infoElement, previewElement, dropzone) {
    console.log('Processing ZIP file:', file.name, 'size:', file.size);
    
    // Store the file in the state
    updateState('zipFile', file);
    
    // Display info about the ZIP file
    const zipInfoElement = document.getElementById('zip-info');
    if (zipInfoElement) {
        zipInfoElement.textContent = `ZIP file received: ${file.name} (${formatFileSize(file.size)})`;
        zipInfoElement.style.display = 'block';
        zipInfoElement.style.color = '';
        
        // Hide after 5 seconds
        setTimeout(() => {
            zipInfoElement.style.display = 'none';
        }, 5000);
    }
    
    // In a real implementation, here you would process the ZIP file
    // For example, extract its contents and handle each file accordingly
    
    // Dispatch an event to notify that a ZIP file was uploaded
    const event = new CustomEvent('zip-uploaded', { 
        detail: { file }
    });
    document.dispatchEvent(event);
}

/**
 * Prevent default drag behaviors
 * @param {Event} e - The event object
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}
