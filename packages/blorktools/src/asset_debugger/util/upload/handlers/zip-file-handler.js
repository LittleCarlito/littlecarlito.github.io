import { formatFileSize } from "../file-upload-manager";

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