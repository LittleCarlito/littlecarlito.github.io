/**
 * Texture Debugger - File Handler Module
 * 
 * This module manages file uploads and drag & drop operations.
 */
import { getState, updateState } from '../core/state.js';
import { loadTextureFromFile, formatFileSize } from '../core/materials.js';
import { updateAtlasVisualization } from './scripts/atlas-panel.js';
// Import for HDR/EXR preview rendering
import * as worldPanelModule from './scripts/world-panel.js';
// Import for GLB model preview
import { createModelPreview } from './scripts/model-preview.js';
// Import the worker manager
import { 
  processTextureFile, 
  processModelFile, 
  processLightingFile, 
  terminateAllWorkers 
} from '../core/worker-manager.js';
import { parseLightingData } from '../core/lighting-util.js';

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
            updateState('modelFile', null);
            updateState('useCustomModel', false);
        },
        handler: handleModelUpload
    },
    lighting: {
        title: 'Lighting File',
        instruction: 'Drag & drop your HDR or EXR lighting file here',
        acceptedFileTypes: ['.hdr', '.exr'],
        stateKey: 'lightingFile',
        resetState: () => {
            updateState('lightingFile', null);
            updateState('environmentLightingEnabled', false);
        },
        handler: handleLightingUpload
    },
    background: {
        title: 'Background Image',
        instruction: 'Drag & drop your HDR, EXR, JPEG, PNG, WebP, or TIFF background image here',
        acceptedFileTypes: ['.hdr', '.exr', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'],
        stateKey: 'backgroundFile',
        resetState: () => {
            updateState({ backgroundFile: null, backgroundTexture: null });
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
    
    // Process the model file in a web worker
    processModelFile(file)
        .then(result => {
            // Create the 3D preview with the model-preview module after worker has processed it
            createModelPreview(file);
            
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
            
            // Fall back to direct loading if worker fails
            createModelPreview(file);
            
            // Hide loading indicator
            hidePreviewLoading(previewDiv);
            
            // Update the texture dropzone hints
            const textureHints = document.querySelectorAll('.texture-hint');
            textureHints.forEach(hint => {
                hint.textContent = 'Textures are optional with GLB';
                hint.classList.add('optional');
            });
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
            import('../core/lighting-util.js').then(lightingUtil => {
                lightingUtil.parseLightingData(file).then(metadata => {
                    worldPanelModule.updateLightingInfo(metadata);
                    
                    // Explicitly mark that there's no background image but lighting is available
                    const currentState = getState();
                    if (!currentState.backgroundFile) {
                        // Make sure world panel shows "No Background Image" message
                        import('./scripts/world-panel.js').then(worldPanel => {
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
                        import('../ui/scripts/world-panel.js').then(worldPanel => {
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
                    import('../ui/scripts/world-panel.js').then(worldPanel => {
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
    dropzone.parentNode.replaceChild(clone, dropzone);
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
 * Prevent default drag behaviors
 * @param {Event} e - The event object
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

export default {
    setupDropzones
}; 