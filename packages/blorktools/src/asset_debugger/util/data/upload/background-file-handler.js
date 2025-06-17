import { createClearButton } from '../../../landing-page/landing-page';
import { hidePreviewLoading, showPreviewLoading } from '../../../loading-splash/preview-loading-splash';
import { updateState } from '../../state/scene-state';
import { formatFileSize } from './file-upload-manager';

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
    messageDiv.className = 'no-image-message-container hidden';
    
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
