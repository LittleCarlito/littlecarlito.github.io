/**
 * Texture Debugger - File Handler Module
 * 
 * This module manages file uploads and drag & drop operations.
 */
import { getState, updateState } from '../core/state.js';
import { loadTextureFromFile, formatFileSize } from '../core/materials.js';
import { updateAtlasVisualization } from './scripts/atlas-panel.js';
import { setupEnvironmentLighting, parseLightingData } from '../core/lighting-util.js';
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

// Debug flags
const DEBUG_LIGHTING = false;

// Keep track of worker tasks by type
const workerTasks = {
  texture: new Map(),
  model: new Map(),
  lighting: new Map()
};

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
    
    // Ensure the start button is disabled initially
    checkStartButton();
    
    // Set up each dropzone
    if (baseColorDropzone && baseColorInfo) {
        setupDropzone(baseColorDropzone, 'baseColor', baseColorInfo);
    }
    
    if (ormDropzone && ormInfo) {
        setupDropzone(ormDropzone, 'orm', ormInfo);
    }
    
    if (normalDropzone && normalInfo) {
        setupDropzone(normalDropzone, 'normal', normalInfo);
    }
    
    if (modelDropzone && modelInfo) {
        setupDropzone(modelDropzone, 'model', modelInfo);
    }
    
    if (lightingDropzone && lightingInfo) {
        setupDropzone(lightingDropzone, 'lighting', lightingInfo);
    }
    
    if (backgroundDropzone && backgroundInfo) {
        setupDropzone(backgroundDropzone, 'background', backgroundInfo);
    }
    
    console.log('Dropzones setup complete');
}

/**
 * Setup an individual dropzone
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} fileType - The type of file ('baseColor', 'orm', 'normal', 'model', 'lighting')
 * @param {HTMLElement} infoElement - Element to display file info
 */
function setupDropzone(dropzone, fileType, infoElement) {
    // First remove any existing event listeners to prevent duplicates
    const clone = dropzone.cloneNode(true);
    dropzone.parentNode.replaceChild(clone, dropzone);
    dropzone = clone;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, false);
    });

    // Highlight dropzone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('active');
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', event => {
        event.preventDefault();
        event.stopPropagation();
        
        const file = event.dataTransfer.files[0];
        if (fileType === 'model') {
            if (file && file.name.toLowerCase().endsWith('.glb')) {
                handleModelUpload(file, infoElement, dropzone);
            } else {
                alert('Please upload a GLB file for the model');
                return false;
            }
        } else if (fileType === 'lighting') {
            if (file && (file.name.toLowerCase().endsWith('.hdr') || file.name.toLowerCase().endsWith('.exr'))) {
                handleLightingUpload(file, infoElement, null, dropzone);
            } else {
                alert('Please upload an HDR or EXR file for lighting');
                return false;
            }
        } else if (fileType === 'background') {
            const validExtensions = ['.hdr', '.exr', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];
            const isValidFile = file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
            
            if (isValidFile) {
                handleBackgroundUpload(file, infoElement, null, dropzone);
            } else {
                alert('Please upload a valid background image file (HDR, EXR, JPG, PNG, WebP, or TIFF)');
                return false;
            }
        } else {
            // Check for valid texture file extensions
            const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'];
            const isValidTextureFile = file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
            
            if (isValidTextureFile) {
                handleTextureUpload(file, fileType, infoElement, null, dropzone);
            } else if (file) {
                alert('Please upload a valid texture file (PNG, JPG, WEBP, TIF, BMP)');
                return false;
            }
        }
        return false;
    }, false);

    // Handle file upload via click - ONLY if no file is already loaded
    dropzone.addEventListener('click', (event) => {
        // If the click was on a clear button, don't do anything
        if (event.target.closest('.clear-preview-button')) {
            return;
        }
        
        // Only open file dialog if no file is loaded yet
        if (!dropzone.classList.contains('has-file')) {
            const input = document.createElement('input');
            input.type = 'file';
            
            if (fileType === 'model') {
                input.accept = '.glb';
                
                input.onchange = e => {
                    const file = e.target.files[0];
                    if (file && file.name.toLowerCase().endsWith('.glb')) {
                        handleModelUpload(file, infoElement, dropzone);
                    } else if (file) {
                        alert('Please upload a GLB file for the model');
                    }
                };
            } else if (fileType === 'lighting') {
                input.accept = '.hdr,.exr';
                
                input.onchange = e => {
                    const file = e.target.files[0];
                    if (file && (file.name.toLowerCase().endsWith('.hdr') || file.name.toLowerCase().endsWith('.exr'))) {
                        handleLightingUpload(file, infoElement, null, dropzone);
                    } else if (file) {
                        alert('Please upload an HDR or EXR file for lighting');
                    }
                };
            } else if (fileType === 'background') {
                input.accept = '.hdr,.exr,.jpg,.jpeg,.png,.webp,.tiff,.tif';
                
                input.onchange = e => {
                    const file = e.target.files[0];
                    const validExtensions = ['.hdr', '.exr', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];
                    const isValidFile = file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
                    
                    if (isValidFile) {
                        handleBackgroundUpload(file, infoElement, null, dropzone);
                    } else if (file) {
                        alert('Please upload a valid background image file (HDR, EXR, JPG, PNG, WebP, or TIFF)');
                    }
                };
            } else {
                input.accept = '.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp';
                
                input.onchange = e => {
                    const file = e.target.files[0];
                    if (file) {
                        handleTextureUpload(file, fileType, infoElement, null, dropzone);
                    }
                };
            }
            
            input.click();
        }
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

/**
 * Clear a dropzone and reset it to its original state
 * @param {HTMLElement} dropzone - The dropzone element to clear
 * @param {string} fileType - The type of file ('baseColor', 'orm', 'normal', 'model', 'lighting')
 * @param {string} title - The original title of the dropzone
 */
function clearDropzone(dropzone, fileType, title) {
    // Clear the state based on file type
    if (fileType === 'model') {
        // Clean up any model preview resources
        const modelPreview = document.getElementById('model-preview');
        if (modelPreview) {
            // We'll import and call the cleanup function to ensure all WebGL resources are freed
            import('./scripts/model-preview.js').then(module => {
                if (module.cleanupPreview) {
                    module.cleanupPreview();
                }
            }).catch(err => console.error('Error cleaning up model preview:', err));
        }
        
        updateState('modelFile', null);
        updateState('useCustomModel', false);
    } else if (fileType === 'lighting') {
        updateState('lightingFile', null);
        updateState('environmentLightingEnabled', false);
    } else {
        const state = getState();
        state.textureFiles[fileType] = null;
        updateState('textureFiles', state.textureFiles);
    }
    
    // Clear the dropzone classes and content
    dropzone.classList.remove('has-file');
    dropzone.innerHTML = '';
    
    // Recreate the original dropzone content
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    dropzone.appendChild(titleElement);
    
    // Add appropriate instruction text based on file type
    const instructionText = document.createElement('p');
    
    if (fileType === 'model') {
        instructionText.textContent = 'Drag & drop a GLB model file here';
        dropzone.appendChild(instructionText);
        
        const optionalText = document.createElement('p');
        optionalText.textContent = 'If not provided, a cube will be used';
        dropzone.appendChild(optionalText);
    } else if (fileType === 'lighting') {
        instructionText.textContent = 'Drag & drop your HDR or EXR lighting file here';
        dropzone.appendChild(instructionText);
    } else if (fileType === 'baseColor') {
        instructionText.textContent = 'Drag & drop your base color texture atlas here';
        dropzone.appendChild(instructionText);
    } else if (fileType === 'orm') {
        instructionText.textContent = 'Drag & drop your ORM (Occlusion, Roughness, Metalness) texture atlas here';
        dropzone.appendChild(instructionText);
    } else if (fileType === 'normal') {
        instructionText.textContent = 'Drag & drop your normal map texture atlas here';
        dropzone.appendChild(instructionText);
    }
    
    // Add an empty file info element
    const infoElement = document.createElement('p');
    infoElement.className = 'file-info';
    infoElement.id = fileType.toLowerCase() + '-info';
    dropzone.appendChild(infoElement);
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
                    
                    // Check if all textures are loaded to enable the start button
                    checkStartButton();
                    
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
    
    // Add file info
    infoElement = document.createElement('p');
    infoElement.className = 'file-info';
    infoElement.id = 'model-info';
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    dropzone.appendChild(infoElement);
    
    // Create a preview container
    const previewDiv = document.createElement('div');
    previewDiv.className = 'preview';
    previewDiv.id = 'model-preview';
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
            
            // Check if we can enable the start button
            checkStartButton();
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
            
            // Check if we can enable the start button
            checkStartButton();
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
                            
                            // Use the world panel's renderEnvironmentPreview function
                            if (worldPanelModule.renderEnvironmentPreview) {
                                worldPanelModule.renderEnvironmentPreview(texture, canvas, messageDiv);
                            } else {
                                // Fallback to simple sphere if function not available
                                createFallbackSphere(canvas);
                            }
                            
                            // Clean up URL after loading
                            URL.revokeObjectURL(url);
                            
                            // Hide loading indicator
                            hidePreviewLoading(containerDiv);
                            
                            // Check if start button should be enabled
                            checkStartButton();
                        }, undefined, error => {
                            console.error('Error loading EXR texture:', error);
                            createFallbackSphere(canvas);
                            canvas.classList.add('visible');
                            canvas.classList.remove('hidden');
                            hidePreviewLoading(containerDiv);
                            checkStartButton();
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
                            
                            // Use the world panel's renderEnvironmentPreview function
                            if (worldPanelModule.renderEnvironmentPreview) {
                                worldPanelModule.renderEnvironmentPreview(texture, canvas, messageDiv);
                            } else {
                                // Fallback to simple sphere if function not available
                                createFallbackSphere(canvas);
                            }
                            
                            // Clean up URL after loading
                            URL.revokeObjectURL(url);
                            
                            // Hide loading indicator
                            hidePreviewLoading(containerDiv);
                            
                            // Check if start button should be enabled
                            checkStartButton();
                        }, undefined, error => {
                            console.error('Error loading HDR texture:', error);
                            createFallbackSphere(canvas);
                            canvas.classList.add('visible');
                            canvas.classList.remove('hidden');
                            hidePreviewLoading(containerDiv);
                            checkStartButton();
                            if (messageDiv) {
                                messageDiv.classList.remove('hidden');
                                messageDiv.classList.add('visible');
                                messageDiv.textContent = 'Error loading HDR file';
                            }
                        });
                    }).catch(handleLightingError);
                }).catch(handleLightingError);
            }
            // Fallback if type not recognized
            else {
                handleLightingError(new Error('Unsupported file type: ' + fileType));
            }
        })
        .catch(error => {
            console.error('Error processing lighting file:', error);
            handleLightingError(error);
        });
        
    // Helper function to handle lighting errors
    function handleLightingError(error) {
        console.error('Lighting error:', error);
        createFallbackSphere(canvas);
        canvas.classList.add('visible');
        canvas.classList.remove('hidden');
        hidePreviewLoading(containerDiv);
        checkStartButton();
        if (messageDiv) {
            messageDiv.classList.remove('hidden');
            messageDiv.classList.add('visible');
            messageDiv.textContent = 'Error loading lighting file';
        }
    }
}

/**
 * Create a fallback sphere preview for HDR/EXR when actual preview fails
 * @param {HTMLCanvasElement} canvas - The canvas to draw on
 */
function createFallbackSphere(canvas) {
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with dark background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create a sphere-like gradient with a more metallic/chrome look
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;
    
    // Create a metallic-looking sphere with reflective highlights
    const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3, // Highlight origin X
        centerY - radius * 0.3, // Highlight origin Y 
        radius * 0.1,           // Inner radius for highlight
        centerX,                // Center X
        centerY,                // Center Y
        radius                  // Outer radius
    );
    
    // Metallic silver-blue colors
    gradient.addColorStop(0, '#ffffff');       // Bright highlight
    gradient.addColorStop(0.1, '#c0d0f0');     // Near highlight
    gradient.addColorStop(0.4, '#607090');     // Mid tone
    gradient.addColorStop(0.7, '#405070');     // Darker tone
    gradient.addColorStop(0.9, '#203050');     // Edge
    gradient.addColorStop(1, '#101830');       // Outer edge
    
    // Draw the sphere
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Add a sharper highlight
    const highlightGradient = ctx.createRadialGradient(
        centerX - radius * 0.4,  // X
        centerY - radius * 0.4,  // Y
        1,                       // Inner radius
        centerX - radius * 0.4,  // X
        centerY - radius * 0.4,  // Y
        radius * 0.3             // Outer radius
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.4, centerY - radius * 0.4, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = highlightGradient;
    ctx.fill();
    
    // Add subtle environment reflection suggestion
    const bands = 3;
    const bandHeight = radius * 2 / bands;
    
    for (let i = 0; i < bands; i++) {
        const y = centerY - radius + i * bandHeight;
        const opacity = 0.1 - (i * 0.02);  // Decrease opacity for lower bands
        
        // Add a subtle color band
        ctx.beginPath();
        ctx.ellipse(
            centerX,                     // X
            y + bandHeight/2,            // Y
            radius * 0.9,                // X radius
            bandHeight/2,                // Y radius
            0,                           // Rotation
            0, Math.PI * 2               // Start/end angles
        );
        
        // Different colors for each band
        let bandColor;
        if (i === 0) bandColor = 'rgba(100, 150, 255, ' + opacity + ')';  // Blue-ish for top
        else if (i === 1) bandColor = 'rgba(100, 170, 200, ' + opacity + ')';  // Teal-ish for middle
        else bandColor = 'rgba(100, 200, 150, ' + opacity + ')';  // Green-ish for bottom
        
        ctx.fillStyle = bandColor;
        ctx.fill();
    }
}

/**
 * Check if all required textures are loaded and enable start button if they are
 */
function checkStartButton() {
    const startButton = document.getElementById('start-debug');
    
    if (startButton) {
        // Always enable the button regardless of file status
        startButton.disabled = false;
        if (DEBUG_LIGHTING) {
            console.log('Start debugging button is always enabled');
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
        
        // Re-check if start button should be enabled
        checkStartButton();
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
    containerDiv.className = 'hdr-preview-container';
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
                        
                        // Use the world panel's renderEnvironmentPreview function
                        if (worldPanelModule.renderEnvironmentPreview) {
                            worldPanelModule.renderEnvironmentPreview(texture, canvas, messageDiv);
                        } else {
                            // Fallback to simple sphere if function not available
                            createFallbackSphere(canvas);
                        }
                        
                        // Clean up URL after loading
                        URL.revokeObjectURL(url);
                        
                        // Hide loading indicator
                        hidePreviewLoading(containerDiv);
                        
                        // Update state with the background texture
                        updateState({ backgroundTexture: texture });
                        
                        // Re-check if start button should be enabled
                        checkStartButton();
                    }, undefined, error => {
                        console.error('Error loading EXR background texture:', error);
                        createFallbackSphere(canvas);
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
                createFallbackSphere(canvas);
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
                        
                        // Use the world panel's renderEnvironmentPreview function
                        if (worldPanelModule.renderEnvironmentPreview) {
                            worldPanelModule.renderEnvironmentPreview(texture, canvas, messageDiv);
                        } else {
                            // Fallback to simple sphere if function not available
                            createFallbackSphere(canvas);
                        }
                        
                        // Clean up URL after loading
                        URL.revokeObjectURL(url);
                        
                        // Hide loading indicator
                        hidePreviewLoading(containerDiv);
                        
                        // Update state with the background texture
                        updateState({ backgroundTexture: texture });
                        
                        // Re-check if start button should be enabled
                        checkStartButton();
                    }, undefined, error => {
                        console.error('Error loading HDR background texture:', error);
                        createFallbackSphere(canvas);
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
                createFallbackSphere(canvas);
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
                    
                    // Use the world panel's renderEnvironmentPreview function
                    if (worldPanelModule.renderEnvironmentPreview) {
                        worldPanelModule.renderEnvironmentPreview(texture, canvas, messageDiv);
                    } else {
                        // Fallback to simple sphere if function not available
                        createFallbackSphere(canvas);
                    }
                    
                    // Hide loading indicator
                    hidePreviewLoading(containerDiv);
                    
                    // Update state with the background texture
                    updateState({ backgroundTexture: texture });
                    
                    // Re-check if start button should be enabled
                    checkStartButton();
                }, undefined, error => {
                    console.error('Error loading image texture:', error);
                    createFallbackSphere(canvas);
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
    
    // Re-check if start button should be enabled
    checkStartButton();
}

export default {
    setupDropzones
}; 