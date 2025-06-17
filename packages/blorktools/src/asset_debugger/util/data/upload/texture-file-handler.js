import * as THREE from 'three';
import { getState, updateState } from '../../state/scene-state';
import { processTextureFile } from '../../workers/worker-manager';
import { hidePreviewLoading, showPreviewLoading } from '../../../loading-splash/preview-loading-splash';
import { formatFileSize } from './file-upload-manager';
import { createClearButton } from '../../../landing-page/landing-page';

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
 * Load texture from file object
 * @param {File} file - The file object containing the texture
 * @param {string} textureType - The type of texture (baseColor, orm, normal)
 * @returns {Promise<THREE.Texture>} Promise resolving to the loaded texture
 */
export function loadTextureFromFile(file, textureType) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const texture = new THREE.TextureLoader().load(e.target.result, (texture) => {
                    // Set texture parameters based on type
                    if (textureType === 'baseColor') {
                        texture.encoding = THREE.sRGBEncoding;
                    } else {
                        texture.encoding = THREE.LinearEncoding;
                    }
                    
                    // Common texture settings for all types
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.flipY = false; // Don't flip Y for GLB compatibility
                    
                    // Store the texture in state
                    const state = getState();
                    state.textureObjects[textureType] = texture;
                    updateState('textureObjects', state.textureObjects);
                    
                    resolve(texture);
                });
            } catch (err) {
                reject(err);
            }
        };
        
        reader.onerror = (err) => {
            reject(err);
        };
        
        reader.readAsDataURL(file);
    });
}
