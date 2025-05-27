import ExamplesModal from "../modals/examples-modal/examples-modal";
import { hasFiles, initState } from "../scene/state";
import { loadSettings } from "../util/localstorage-util";
import { setupDropzones } from "./dropzone-util";
import { handleAutoLoad, loadLightingIntoDropzone, loadModelIntoDropzone, processZipContents } from "./zip-util";

export function initalizeLandingPage() {
    preventDefaultDragBehavior();
    initState();
    setupDropzones();
    setupMainContainerDropzone();
    
    // Load the examples modal HTML content
    fetch('../modals/examples-modal/examples-modal.html')
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
    // Verify if any files were dropped
    if (hasFiles()) {
        // Start debugging
        // startDebugging();
        console.info("BAZINGA");
    } else {
        // Show examples modal
        showExamplesModal();
        console.error("BAZLORPA");
    }
}

function showExamplesModal() {
    // Load settings for use with examples
    const savedSettings = loadSettings();
    
    // Create and show the modal
    const examplesModal = new ExamplesModal((exampleType) => {
        // Set flag in state to track which example was selected
        stateModule.setState({ selectedExample: exampleType });
        // Initialize the debugger with the loaded settings
        initializeDebugger(savedSettings);
    });
    
    // Show the examples modal
    examplesModal.openModal();
}

// Prevent default drag-and-drop behavior for the entire document
function preventDefaultDragBehavior() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
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
    if (infoElement) {
        infoElement.textContent = `Processing ${file.name}...`;
        infoElement.style.display = 'block';
        infoElement.style.color = '#007bff';
    }
    
    // Check file type and extension
    const extension = file.name.split('.').pop().toLowerCase();
    
    // ZIP file handling
    if (file.type === 'application/zip' || extension === 'zip') {
        processZipFile(file).finally(() => {
            // Clear the message after ZIP processing is complete
            if (infoElement) {
                infoElement.style.display = 'none';
            }
        });
        return;
    }
    
    // Determine which dropzone to use based on file type/extension
    let targetDropzone = determineTargetDropzone(file);
    
    if (targetDropzone) {
        // Upload to the appropriate dropzone
        uploadToDropzone(file, targetDropzone);
        
        // Show success message
        if (infoElement) {
            infoElement.textContent = `File "${file.name}" loaded into ${getDropzoneName(targetDropzone)}`;
            infoElement.style.display = 'block';
            infoElement.style.color = 'green';
            
            // Hide after 3 seconds
            setTimeout(() => {
                infoElement.style.display = 'none';
            }, 3000);
        }
    } else {
        // No appropriate dropzone found
        if (infoElement) {
            infoElement.textContent = `Error: Could not determine target for "${file.name}". 
                Supported types: ZIP, GLB, GLTF, HDR, EXR, JPG, PNG, WebP, TIFF`;
            infoElement.style.display = 'block';
            infoElement.style.color = 'red';
            
            // Hide after 5 seconds
            setTimeout(() => {
                infoElement.style.display = 'none';
            }, 5000);
        }
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
        console.error(`Dropzone "${dropzoneId}" not found`);
        return;
    }
    
    console.log(`Uploading ${file.name} to ${dropzoneId}`);
    
    // Create a FileList-like object
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    // Create a drop event
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    // Add dataTransfer property with files
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    // dataTransfer info report log
    console.info('dataTransfer info report:');
    console.info(dropEvent.dataTransfer);

    // Dispatch the drop event on the dropzone
    dropzone.dispatchEvent(dropEvent);
    
    // TODO Convert this to a switch based off enum or something other than string
    // If it's a model, trigger loading into the viewer
    if (dropzoneId === 'model-dropzone') {       
        // Load the model
        loadModelIntoDropzone(file);
    }
    // If it's a background, load it properly
    else if (dropzoneId === 'background-dropzone') {
        loadBackgroundIntoDropzone(file);
    }
    // If it's a lighting file, load it properly
    else if (dropzoneId === 'lighting-dropzone') {
        loadLightingIntoDropzone(file);
    }
    // If it's a texture atlas file, handle it appropriately
    else if (['basecolor-dropzone', 'orm-dropzone', 'normal-dropzone'].includes(dropzoneId)) {
        loadTextureIntoDropzone(file, dropzoneId);
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