import ExamplesModal from "../modals/examples-modal/examples-modal";
import { startDebugging } from "../scene/asset_debugger";
import { getBackgroundFile, getBaseColorFile, getLightingFile, getModelFile, getNormalFile, getOrmFile, hasFiles, initDraftState, setState, printStateReport } from "../scene/state";
import { loadSettings } from "../util/localstorage-util";
import { setupDropzones } from "./dropzone-util";
import { handleBackgroundUpload, handleLightingUpload, handleModelUpload, handleTextureUpload } from "./file-handler";
import { handleAutoLoad, loadLightingIntoDropzone, loadModelIntoDropzone, processZipContents } from "./zip-util";

export function initalizeLandingPage() {
    preventDefaultDragBehavior();
    initDraftState();
    setupDropzones();
    setupMainContainerDropzone();
    
    // Load the examples modal HTML content
    fetch('./modals/examples-modal/examples-modal.html')
        .then(response => response.text())
        .then(html => {
            // Insert the HTML into the container
            document.getElementById('examples-modal-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading examples modal:', error);
        });
    
    // Setup listeners
    const startDebugBtn = document.getElementById('start-debug');
    if (startDebugBtn) {
        startDebugBtn.addEventListener('click', verifyFileDrop);
    }
}

function verifyFileDrop() {
    printStateReport('Landing Page');

    if (hasFiles()) {
        // Start debugging and save current state before navigating
        startDebugging();
        window.location.href = '../scene/asset_debugger.html';
    } else {
        showExamplesModal();
    }
}

function showExamplesModal() {
    // Load settings for use with examples
    const savedSettings = loadSettings();
    
    // Create and show the modal
    const examplesModal = new ExamplesModal((exampleType) => {
        // Set flag in state to track which example was selected
        setState({ selectedExample: exampleType });
        // Navigate to the asset debugger page
        window.location.href = '../scene/asset_debugger.html';
    });
    
    // Show the examples modal
    examplesModal.openModal();
}

// Prevent default drag-and-drop behavior for the entire document
function preventDefaultDragBehavior() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            // Only prevent if it's actually a file drag operation
            if (e.dataTransfer && e.dataTransfer.types && 
                (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moz-file'))) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, false);
    });
}

/**
 * Set up the main container as a dropzone for zip files
 */
function setupMainContainerDropzone() {
    const mainContainer = document.getElementById('upload-section');
    const zipInfoElement = document.getElementById('zip-info');
    
    if (!mainContainer) return;
    
    // Function to check if an element is a child of any dropzone
    const isChildOfDropzone = (element) => {
        if (!element) return false;
        
        // Check if element itself is a dropzone
        if (element.classList && element.classList.contains('dropzone')) {
            return true;
        }
        
        // Check if element is a child of a dropzone
        let parent = element.parentElement;
        while (parent) {
            if (parent.classList && parent.classList.contains('dropzone')) {
                return true;
            }
            parent = parent.parentElement;
        }
        
        return false;
    };
    
    // Add drag enter event
    mainContainer.addEventListener('dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't apply styling if dragging over a child dropzone
        if (isChildOfDropzone(e.target)) return;
        
        // Add active class to show it's a valid drop target
        mainContainer.classList.add('dropzone-container-active');
    });
    
    // Add drag over event
    mainContainer.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't apply styling if dragging over a child dropzone
        if (isChildOfDropzone(e.target)) return;
        
        // Set the drop effect
        e.dataTransfer.dropEffect = 'copy';
    });
    
    // Add drag leave event
    mainContainer.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't remove styling if entering a child element within the container
        // that isn't a dropzone
        if (mainContainer.contains(e.relatedTarget) && !isChildOfDropzone(e.relatedTarget)) return;
        
        // Remove active class
        mainContainer.classList.remove('dropzone-container-active');
    });
    
    // Add drop event
    mainContainer.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove active class
        mainContainer.classList.remove('dropzone-container-active');
        
        // Don't handle drop if dropping on a child dropzone
        if (isChildOfDropzone(e.target)) return;
        
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        
        // Process the files based on type
        processMainDroppedFiles(files, zipInfoElement);
    });
}

/**
 * Process files dropped on the main container
 * @param {FileList} files - The files dropped
 * @param {HTMLElement} infoElement - The element to display information
 */
function processMainDroppedFiles(files, infoElement) {
    if (!files || files.length === 0) return;
    
    const file = files[0]; // Process only the first file for simplicity
    
    // Show starting message
    infoElement.textContent = `Processing ${file.name}...`;
    infoElement.style.display = 'block';
    infoElement.style.color = '#007bff';
    
    // Check file type and extension
    const extension = file.name.split('.').pop().toLowerCase();
    console.debug('Processing dropped file:', {
        name: file.name,
        type: file.type,
        extension: extension,
        size: file.size
    });
    
    // ZIP file handling
    if (file.type === 'application/zip' || extension === 'zip') {
        console.debug('Processing ZIP file:', file.name);
        processZipFile(file);
        return;
    }
    
    // Determine which dropzone to use based on file type/extension
    let targetDropzone = determineTargetDropzone(file);
    console.debug('Determined target dropzone:', targetDropzone, 'for file:', file.name);
    
    if (targetDropzone) {
        // Upload to the appropriate dropzone
        uploadToDropzone(file, targetDropzone);
        
        // Show success message
        infoElement.textContent = `File "${file.name}" loaded into ${getDropzoneName(targetDropzone)}`;
        infoElement.style.display = 'block';
        infoElement.style.color = 'green';
    } else {
        // No appropriate dropzone found
        console.error('No appropriate dropzone found for file:', file.name);
        infoElement.textContent = `Error: Could not determine target for "${file.name}". 
            Supported types: ZIP, GLB, GLTF, HDR, EXR, JPG, PNG, WebP, TIFF`;
        infoElement.style.display = 'block';
        infoElement.style.color = 'red';
    }
}

/**
 * Determine the appropriate dropzone for a file
 * @param {File} file - The file to check
 * @returns {string|null} - The ID of the target dropzone or null if not supported
 */
function determineTargetDropzone(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const mimeType = file.type.toLowerCase();
    
    // 3D Model files
    if (extension === 'glb' || extension === 'gltf') {
        return 'model-dropzone';
    }
    
    // Lighting files - HDR, EXR
    if (extension === 'hdr' || extension === 'exr') {
        return 'lighting-dropzone';
    }
    
    // Image files - could be background, basecolor, normal, or ORM
    // Let's use mime type to determine if it's an image
    if (mimeType.startsWith('image/')) {
        // Background images - any image type
        return 'background-dropzone';
    }
    
    // Not a supported file type
    return null;
}

/**
 * Upload a file to a specific dropzone
 * @param {File} file - The file to upload
 * @param {string} dropzoneId - The ID of the target dropzone
 */
function uploadToDropzone(file, dropzoneId) {
    const dropzone = document.getElementById(dropzoneId);
    if (!dropzone) {
        throw new Error(`Dropzone "${dropzoneId}" not found`);
    }
    
    console.debug(`Uploading ${file.name} to ${dropzoneId}`);
    
    // Get the info element for this dropzone
    const infoElement = document.getElementById(`${dropzoneId.split('-')[0]}-info`);
    
    // Handle file based on dropzone type directly instead of creating a new drop event
    switch(dropzoneId) {
        case 'model-dropzone':
            console.debug('Loading model into dropzone:', file.name);
            handleModelUpload(file, infoElement, dropzone);
            break;
        case 'background-dropzone':
            console.debug('Loading background into dropzone:', file.name);
            handleBackgroundUpload(file, infoElement, null, dropzone);
            break;
        case 'lighting-dropzone':
            console.debug('Loading lighting into dropzone:', file.name);
            handleLightingUpload(file, infoElement, null, dropzone);
            break;
        case 'basecolor-dropzone':
        case 'orm-dropzone':
        case 'normal-dropzone':
            console.debug('Loading texture into dropzone:', file.name, 'type:', dropzoneId);
            const textureType = dropzoneId.split('-')[0];
            handleTextureUpload(file, textureType, infoElement, null, dropzone);
            break;
    }
}

/**
 * Get a user-friendly name for a dropzone
 * @param {string} dropzoneId - The dropzone ID
 * @returns {string} - A user-friendly name
 */
function getDropzoneName(dropzoneId) {
    const names = {
        'basecolor-dropzone': 'Base Color Atlas',
        'orm-dropzone': 'ORM Atlas',
        'normal-dropzone': 'Normal Atlas',
        'model-dropzone': '3D Model',
        'lighting-dropzone': 'Lighting',
        'background-dropzone': 'Background'
    };
    
    return names[dropzoneId] || dropzoneId;
}

/**
 * Process a ZIP file
 * @param {File} file - The ZIP file to process
 */
async function processZipFile(file) {
    console.log(`ZIP file received: ${file.name} size: ${file.size}`);
    
    try {
        // Process the ZIP file contents using the zip-util module
        const results = await processZipContents(file);
        
        // Log the results
        console.log('ZIP processing successful:', results);
        
        // If successful, load files into dropzones
        if (results.success) {
            handleAutoLoad(results);
        }
    } catch (error) {
        console.error('Error processing ZIP file:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initalizeLandingPage();
});