// landing-page.js - Landing page module with proper imports and event handling

// Import all dependencies at the top
import ExamplesModal from "../modals/examples-modal/examples-modal.js";
import { 
    getBackgroundFile, 
    getBaseColorFile, 
    getLightingFile, 
    getModelFile, 
    getNormalFile, 
    getOrmFile, 
    hasFiles, 
    initDraftState, 
    setState, 
    printStateReport 
} from "../util/state/scene-state.js";
import { loadSettings } from "../util/data/localstorage-manager.js";
import { handleTextureUpload } from "../util/data/upload/texture-file-handler.js";
import { terminateAllWorkers } from "../util/workers/worker-manager.js";
import { setupDropzones } from "../util/data/upload/file-upload-manager.js";
import { handleAutoLoad, processZipContents } from "../util/data/upload/zip-handler.js";
import { handleLightingUpload } from "../util/data/upload/lighting-file-handler.js";
import { handleModelUpload } from "../util/data/upload/model-file-manager.js";

// Module state
let isInitialized = false;
let eventListeners = [];

// Add event listener to terminate all workers when the page is unloaded
window.addEventListener('beforeunload', () => {
  terminateAllWorkers();
});

// Main initialization function
export async function initalizeLandingPage() {
    console.log('🌟 Initializing landing page...');
    
    // Prevent double initialization
    if (isInitialized) {
        console.warn('⚠️ Landing page already initialized, skipping...');
        return Promise.resolve(cleanup);
    }
    
    // Check if required DOM elements exist
    if (!validateRequiredElements()) {
        console.warn('⏳ Required DOM elements not found, waiting for them...');
        // Use MutationObserver to wait for elements to be added
        await waitForElements();
        return initializeLandingPageInternal();
    }
    
    return Promise.resolve(initializeLandingPageInternal());
}

function validateRequiredElements() {
    const requiredElements = [
        'upload-section',
        'start-debug'
    ];
    
    const results = requiredElements.map(id => {
        const element = document.getElementById(id);
        const found = !!element;
        console.log(`Element ${id}: ${found ? 'found' : 'NOT FOUND'}`);
        return found;
    });
    
    const allFound = results.every(found => found);
    console.log(`All required elements found: ${allFound}`);
    return allFound;
}

function waitForElements() {
    return new Promise((resolve) => {
        const observer = new MutationObserver((mutations) => {
            if (validateRequiredElements()) {
                observer.disconnect();
                resolve();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 5000);
    });
}

function initializeLandingPageInternal() {
    console.log('🔧 Starting landing page internal initialization...');
    
    try {
        // Initialize core functionality
        preventDefaultDragBehavior();
        initDraftState();
        setupDropzones();
        setupMainContainerDropzone();
        setupEventListeners();
        loadExamplesModal();
        
        isInitialized = true;
        console.log('✅ Landing page initialization complete');
        
        return cleanup;
        
    } catch (error) {
        console.error('💥 Error during landing page initialization:', error);
        return cleanup;
    }
}

function setupEventListeners() {
    // Setup start debug button listener
    const startDebugBtn = document.getElementById('start-debug');
    if (startDebugBtn) {
        const verifyFileDropHandler = () => verifyFileDrop();
        startDebugBtn.addEventListener('click', verifyFileDropHandler);
        eventListeners.push({ element: startDebugBtn, event: 'click', handler: verifyFileDropHandler });
        console.log('Start debug button listener attached');
    } else {
        console.warn('start-debug button not found in DOM');
    }
}

function loadExamplesModal() {
    const examplesModalContainer = document.getElementById('examples-modal-container');
    if (examplesModalContainer) {
        fetch('./modals/examples-modal/examples-modal.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                examplesModalContainer.innerHTML = html;
                console.log('Examples modal HTML loaded');
            })
            .catch(error => {
                console.error('Error loading examples modal:', error);
            });
    } else {
        console.warn('examples-modal-container not found in DOM');
    }
}

function verifyFileDrop() {
    printStateReport('Landing Page');

    if (hasFiles()) {
        // DON'T start debugging here - let the asset debugger page handle it
        console.log('Files detected, navigating to asset debugger...');
        
        // Use router navigation instead of direct window.location.href
        if (window.appRouter) {
            window.appRouter.navigateToPage('debugger-scene', {
                hasFiles: true,
                source: 'landing_page_verify'
            });
        } else {
            console.error('Router not available, falling back to direct navigation');
            window.location.href = '../debugger-scene/debugger-scene.html';
        }
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
        
        // Use router navigation instead of direct window.location.href
        if (window.appRouter) {
            window.appRouter.navigateToPage('debugger-scene', {
                selectedExample: exampleType,
                source: 'examples_modal'
            });
        } else {
            console.error('Router not available, falling back to direct navigation');
            window.location.href = '../debugger-scene/debugger-scene.js';
        }
    });
    
    // Show the examples modal
    examplesModal.openModal();
}

// Prevent default drag-and-drop behavior for the entire document
function preventDefaultDragBehavior() {
    const dragEventHandler = (e) => {
        // Only prevent if it's actually a file drag operation
        if (e.dataTransfer && e.dataTransfer.types && 
            (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moz-file'))) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, dragEventHandler, false);
        eventListeners.push({ element: document, event: eventName, handler: dragEventHandler });
    });
}

/**
 * Set up the main container as a dropzone for zip files
 */
function setupMainContainerDropzone() {
    const mainContainer = document.getElementById('upload-section');
    const zipInfoElement = document.getElementById('zip-info');
    
    if (!mainContainer) {
        console.warn('upload-section not found in DOM, skipping main container dropzone setup');
        return;
    }
    
    console.log('Setting up main container dropzone');
    
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
    
    // Event handlers
    const dragEnterHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't apply styling if dragging over a child dropzone
        if (isChildOfDropzone(e.target)) return;
        
        // Add active class to show it's a valid drop target
        mainContainer.classList.add('dropzone-container-active');
    };
    
    const dragOverHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't apply styling if dragging over a child dropzone
        if (isChildOfDropzone(e.target)) return;
        
        // Set the drop effect
        e.dataTransfer.dropEffect = 'copy';
    };
    
    const dragLeaveHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't remove styling if entering a child element within the container
        // that isn't a dropzone
        if (mainContainer.contains(e.relatedTarget) && !isChildOfDropzone(e.relatedTarget)) return;
        
        // Remove active class
        mainContainer.classList.remove('dropzone-container-active');
    };
    
    const dropHandler = function(e) {
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
    };
    
    // Add event listeners and track them for cleanup
    mainContainer.addEventListener('dragenter', dragEnterHandler);
    mainContainer.addEventListener('dragover', dragOverHandler);
    mainContainer.addEventListener('dragleave', dragLeaveHandler);
    mainContainer.addEventListener('drop', dropHandler);
    
    eventListeners.push(
        { element: mainContainer, event: 'dragenter', handler: dragEnterHandler },
        { element: mainContainer, event: 'dragover', handler: dragOverHandler },
        { element: mainContainer, event: 'dragleave', handler: dragLeaveHandler },
        { element: mainContainer, event: 'drop', handler: dropHandler }
    );
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
        if (infoElement) {
            infoElement.textContent = `File "${file.name}" loaded into ${getDropzoneName(targetDropzone)}`;
            infoElement.style.display = 'block';
            infoElement.style.color = 'green';
        }
    } else {
        // No appropriate dropzone found
        console.error('No appropriate dropzone found for file:', file.name);
        if (infoElement) {
            infoElement.textContent = `Error: Could not determine target for "${file.name}". 
                Supported types: ZIP, GLB, GLTF, HDR, EXR, JPG, PNG, WebP, TIFF`;
            infoElement.style.display = 'block';
            infoElement.style.color = 'red';
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
    
    // Get the zip info element to show status
    const zipInfoElement = document.getElementById('zip-info');
    
    try {
        // Show processing message
        if (zipInfoElement) {
            zipInfoElement.textContent = `Processing ${file.name}...`;
            zipInfoElement.style.display = 'block';
            zipInfoElement.style.color = '#007bff';
        }
        
        // Process the ZIP file contents using the zip-util module
        const results = await processZipContents(file);
        
        // Log the results
        console.log('ZIP processing successful:', results);
        
        // If successful, load files into dropzones
        if (results.success) {
            handleAutoLoad(results);
            
            // Show success message
            if (zipInfoElement) {
                zipInfoElement.textContent = `ZIP file "${file.name}" processed successfully`;
                zipInfoElement.style.color = 'green';
                
                // Hide after 3 seconds
                setTimeout(() => {
                    zipInfoElement.style.display = 'none';
                }, 1000);
            }
        } else {
            // Show error message
            if (zipInfoElement) {
                zipInfoElement.textContent = `Error processing ZIP file: ${results.error}`;
                zipInfoElement.style.color = 'red';
            }
        }
    } catch (error) {
        console.error('Error processing ZIP file:', error);
        
        // Show error message
        if (zipInfoElement) {
            zipInfoElement.textContent = `Error processing ZIP file: ${error.message}`;
            zipInfoElement.style.color = 'red';
        }
    }
}

// Cleanup function to remove event listeners and reset state
function cleanup() {
    console.log('Cleaning up landing page...');
    
    // Remove all event listeners
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    // Reset state
    isInitialized = false;
    
    console.log('Landing page cleanup complete');
}

/**
 * Creates a clear button for a dropzone
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} type - The type of asset ('basecolor', 'normal', 'orm', 'model', 'lighting', 'background')
 * @param {string} originalTitle - The original title of the dropzone
 * @returns {HTMLElement} The created clear button
 */
export function createClearButton(dropzone, type, originalTitle) {
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