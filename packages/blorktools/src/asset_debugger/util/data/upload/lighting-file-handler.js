import { updateState } from '../../state/scene-state';
import { processLightingFile } from '../../workers/worker-manager';
import * as worldPanelModule from '../../../panels/world-panel/world-panel';
import { hidePreviewLoading, showPreviewLoading } from '../../../loading-splash/preview-loading-splash';
import { formatFileSize } from './file-upload-manager';
import { createClearButton } from '../../../landing-page/landing-page';

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
    messageDiv.className = 'no-image-message-container hidden';
    
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
