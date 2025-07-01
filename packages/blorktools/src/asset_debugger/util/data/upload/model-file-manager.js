import { createClearButton } from "../../../landing-page/landing-page";
import { hidePreviewLoading, showPreviewLoading } from "../../../loading-splash/preview-loading-splash";
import { updateState } from "../../state/scene-state";
import { formatFileSize } from "./file-upload-manager";
import { createGLBPreview } from "./glb-preview-controller";
import { processGLBFile } from "./glb-file-handler";

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
    processGLBFile(file)
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
            errorMsg.className = 'no-image-message-container visible';
            errorMsg.textContent = 'Error loading model. Please try another file.';
            previewDiv.appendChild(errorMsg);
        });
}
