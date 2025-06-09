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
import { processGLBModel } from '../util/glb-utils';
// Import the worker manager
import { 
  processTextureFile, 
  processModelFile, 
  processLightingFile, 
  terminateAllWorkers 
} from '../util/workers/worker-manager.js';
import { parseLightingData } from '../util/scene/lighting-util';
import { clearDropzone, setupDropzone } from '../util/dropzone/dropzone-util';
import { createGLBPreview } from '../util/preview/glb-preview-util';

// Add event listener to terminate all workers when the page is unloaded
window.addEventListener('beforeunload', () => {
  terminateAllWorkers();
});



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

/**
 * Creates a clear button for a dropzone
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} type - The type of asset ('basecolor', 'normal', 'orm', 'model', 'lighting', 'background')
 * @param {string} originalTitle - The original title of the dropzone
 * @returns {HTMLElement} The created clear button
 */
function createClearButton(dropzone, type, originalTitle) {
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
 * Handle texture file upload
 * @param {File} file - The uploaded file
 * @param {string} textureType - The type of texture ('baseColor', 'orm', 'normal')
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview
 * @param {HTMLElement} dropzone - The dropzone element
 */
export function handleTextureUpload(file, textureType, infoElement, previewElement, dropzone) {
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
    
    // Add the clear button using the shared function with the specific texture type
    dropzone.appendChild(createClearButton(dropzone, textureType, originalTitle));
    
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
export function handleModelUpload(file, infoElement, dropzone) {
    // Store the file in the state with a single update
    updateState({
        modelFile: file,
        useCustomModel: true
    });
    
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
    
    // Add the clear button using the shared function
    dropzone.appendChild(createClearButton(dropzone, 'model', originalTitle));
    
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
export function handleLightingUpload(file, infoElement, previewElement, dropzone) {
    // Store the file in the state
    updateState('lightingFile', file);
    
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
    
    // Add the clear button using the shared function
    dropzone.appendChild(createClearButton(dropzone, 'lighting', originalTitle));
    
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
                            
                            // Create a sphere preview with proper controls
                            worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                            
                            // Clean up URL after loading
                            URL.revokeObjectURL(url);
                            
                            // Hide loading indicator
                            hidePreviewLoading(containerDiv);
                            
                            // Store the lighting texture for use in previews
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
                            
                            // Create a sphere preview with proper controls
                            worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                            
                            // Clean up URL after loading
                            URL.revokeObjectURL(url);
                            
                            // Hide loading indicator
                            hidePreviewLoading(containerDiv);
                            
                            // Store the lighting texture for use in previews
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
}

/**
 * Handle background image file upload
 * @param {File} file - The background image file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to show preview (optional)
 * @param {HTMLElement} dropzone - The dropzone element
 */
export function handleBackgroundUpload(file, infoElement, previewElement, dropzone) {
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
    
    // Add the clear button using the shared function
    dropzone.appendChild(createClearButton(dropzone, 'background', originalTitle));
    
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
                        
                        // Create a sphere preview with proper controls
                        worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                        
                        // Clean up URL after loading
                        URL.revokeObjectURL(url);
                        
                        // Hide loading indicator
                        hidePreviewLoading(containerDiv);
                        
                        // Store the background texture for use in previews
                        updateState('backgroundTexture', texture);
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
                        
                        // Create a sphere preview with proper controls
                        worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                        
                        // Clean up URL after loading
                        URL.revokeObjectURL(url);
                        
                        // Hide loading indicator
                        hidePreviewLoading(containerDiv);
                        
                        // Store the background texture for use in previews
                        updateState('backgroundTexture', texture);
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
                    
                    // Create a sphere preview with proper controls
                    worldPanelModule.createSpherePreview(THREE, texture, canvas, messageDiv);
                    
                    // Hide loading indicator
                    hidePreviewLoading(containerDiv);
                    
                    // Store the background texture for use in previews
                    updateState('backgroundTexture', texture);
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
}

/**
 * Handle ZIP file upload
 * @param {File} file - The uploaded ZIP file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview
 * @param {HTMLElement} dropzone - The dropzone element
 */
export function handleZipUpload(file, infoElement, previewElement, dropzone) {
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
