/**
 * Asset Debugger - UI Entry Point
 * 
 * This file is the main entry point for the Asset Debugger UI.
 * It initializes the application and sets up all necessary components.
 */

// Import the initialization functions
import { init } from '../../main.js';
// Import loadSettings and saveSettings from localstorage-util.js
import { loadSettings, saveSettings } from '../../data/localstorage-util.js';
// Import SettingsModal 
import { SettingsModal } from './settings-modal.js';
import { ExamplesModal } from './examples-modal.js';
// Import World Panel
import { initWorldPanel } from './world-panel.js';
// Import Asset Panel
import { initAssetPanel } from './asset-panel.js';
// Import HTML Editor Modal
import { initHtmlEditorModal } from './html-editor-modal.js';
// Import Mesh Settings Modal
import { initMeshSettingsModal } from './mesh-settings-modal.js';
// Import Model Integration for HTML Editor
import { initModelIntegration } from './model-integration.js';
// Import ZIP utilities
import { 
    processZipContents, 
    loadTextureIntoDropzone, 
    updateStateWithBestTextures,
    loadModelIntoDropzone,
    loadLightingIntoDropzone,
    loadBackgroundIntoDropzone,
    updateStateWithOtherAssets
} from '../../core/zip-util.js';

// Debug flags
const DEBUG_LIGHTING = false;

// Track if World Panel has been initialized
let worldPanelInitialized = false;

// Track if Asset Panel has been initialized
let assetPanelInitialized = false;

// Track loading completion state
let loadingComplete = false;

// Mac dock behavior settings
const HEADER_SHOW_DISTANCE = 20; // px from top to show header
const HEADER_HIDE_DISTANCE = 60; // px from top to hide header
const HEADER_HIDE_DELAY = 1000; // ms to wait before hiding header
let headerHideTimer = null;

// Track loading state
let resourcesLoaded = {
    componentsLoaded: false,
    sceneInitialized: false,
    lightingLoaded: false,
    backgroundLoaded: false,
    modelLoaded: false,
    controlsReady: false
};

// ASSET DEBUGGER CODE

/**
 * Load all component HTML files dynamically
 */
function loadComponentHtml() {
    // Track loading of components
    let componentsToLoad = 6; // Total components to load (increased to include HTML editor and mesh settings modals)
    let componentsLoaded = 0;

    // Function to update progress when a component loads
    const componentLoaded = () => {
        componentsLoaded++;
        updateLoadingProgress(`Loading components (${componentsLoaded}/${componentsToLoad})...`);
        
        if (componentsLoaded === componentsToLoad) {
            resourcesLoaded.componentsLoaded = true;
            checkAllResourcesLoaded();
        }
    };

    // Load World Panel (first in the tab order)
    fetch('../pages/world-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('world-tab-container').innerHTML = html;
            
            // Initialize World Panel once its HTML is loaded
            console.log('World Panel HTML loaded, initializing panel...');
            if (!worldPanelInitialized) {
                initWorldPanel();
                worldPanelInitialized = true;
            }
            
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading world panel:', error);
            componentLoaded();
        });
    
    // Load Asset Panel (second in the tab order)
    fetch('../pages/asset-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('asset-tab-container').innerHTML = html;
            
            // Initialize Asset Panel once its HTML is loaded
            console.log('Asset Panel HTML loaded, initializing panel...');
            if (!assetPanelInitialized) {
                initAssetPanel();
                assetPanelInitialized = true;
            }
            
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading asset panel:', error);
            componentLoaded();
        });
    
    // Load the settings modal component FIRST
    fetch('../pages/settings-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('settings-modal-container').innerHTML = html;
            
            // Now that settings modal is loaded, load the axis indicator settings
            fetch('../pages/axis-indicator.html')
                .then(response => response.text())
                .then(html => {
                    const axisSettingsContainer = document.getElementById('axis-settings-container');
                    if (axisSettingsContainer) {
                        axisSettingsContainer.innerHTML = html;
                        
                        // Make sure the axis settings tab is active if it's currently selected
                        const axisTabButton = document.querySelector('.settings-tab-button[data-tab="axis-settings"]');
                        if (axisTabButton && axisTabButton.classList.contains('active')) {
                            const axisSettings = document.getElementById('axis-settings');
                            if (axisSettings) {
                                axisSettings.classList.add('active');
                            }
                        }
                    } else {
                        console.warn('Element with ID "axis-settings-container" not found in the DOM after loading settings modal');
                    }
                    componentLoaded();
                })
                .catch(error => {
                    console.error('Error loading axis indicator settings:', error);
                    componentLoaded();
                });
        })
        .catch(error => {
            console.error('Error loading settings modal:', error);
            componentLoaded();
        });
        
    // Load the examples modal component
    fetch('../pages/examples-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('examples-modal-container').innerHTML = html;
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading examples modal:', error);
            componentLoaded();
        });
        
    // Load the HTML editor modal component
    fetch('../pages/html-editor-modal.html')
        .then(response => response.text())
        .then(html => {
            // Create a temporary div to parse the HTML
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html.trim();
            
            // Extract the modal element using querySelector instead of firstChild
            const modalElement = tempContainer.querySelector('#html-editor-modal');
            
            // Ensure the modal is hidden before adding it to the DOM
            if (modalElement) {
                modalElement.style.display = 'none';
                
                // Remove any existing modal with the same ID
                const existingModal = document.getElementById('html-editor-modal');
                if (existingModal) {
                    existingModal.remove();
                }
                
                // Append the new modal directly to the body
                document.body.appendChild(modalElement);
                
                // Initialize the modal now that it's in the DOM and hidden
                setTimeout(() => {
                    // Call initHtmlEditorModal and ensure it registers the global function
                    initHtmlEditorModal();
                    
                    // Double-check that the function is registered globally
                    if (typeof window.openEmbeddedHtmlEditor !== 'function') {
                        console.log('Global function not registered properly, manually registering now');
                        
                        // Import the module and manually register the function
                        import('./html-editor-modal.js').then(module => {
                            // Create a wrapper function that calls openEmbeddedHtmlEditor from the module
                            window.openEmbeddedHtmlEditor = function(meshName, meshId) {
                                console.log(`Global wrapper: Opening HTML editor for ${meshName} (ID: ${meshId})`);
                                // Call the module's openEmbeddedHtmlEditor function or its default export's function
                                if (module.openEmbeddedHtmlEditor) {
                                    module.openEmbeddedHtmlEditor(meshName, meshId);
                                } else if (module.default && module.default.openEmbeddedHtmlEditor) {
                                    module.default.openEmbeddedHtmlEditor(meshName, meshId);
                                } else {
                                    console.error('Could not find openEmbeddedHtmlEditor in module');
                                }
                            };
                            
                            console.log('Global function registered:', typeof window.openEmbeddedHtmlEditor === 'function');
                        });
                    } else {
                        console.log('HTML Editor Modal initialized successfully, global function available');
                    }
                }, 100);
            } else {
                console.error('Could not extract HTML editor modal element from HTML: modal element not found');
            }
            
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading HTML editor modal:', error);
            componentLoaded();
        });
        
    // Load the mesh settings modal component
    fetch('../pages/mesh-settings-modal.html')
        .then(response => response.text())
        .then(html => {
            // Create a temporary div to parse the HTML
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html.trim();
            
            // Extract the modal element using querySelector
            const modalElement = tempContainer.querySelector('#mesh-settings-modal');
            
            // Ensure the modal is hidden before adding it to the DOM
            if (modalElement) {
                modalElement.style.display = 'none';
                
                // Remove any existing modal with the same ID
                const existingModal = document.getElementById('mesh-settings-modal');
                if (existingModal) {
                    existingModal.remove();
                }
                
                // Append the new modal directly to the body
                document.body.appendChild(modalElement);
                
                // Initialize the modal now that it's in the DOM and hidden
                setTimeout(() => {
                    // Call initMeshSettingsModal and ensure it registers the global function
                    initMeshSettingsModal();
                    
                    // Double-check that the function is registered globally
                    if (typeof window.openMeshSettingsModal !== 'function') {
                        console.log('Mesh Settings global function not registered properly, manually registering now');
                        
                        // Import the module and manually register the function
                        import('./mesh-settings-modal.js').then(module => {
                            // Create a wrapper function that calls openMeshSettingsModal from the module
                            window.openMeshSettingsModal = function(meshName, meshId) {
                                console.log(`Global wrapper: Opening mesh settings for ${meshName} (ID: ${meshId})`);
                                // Call the module's openMeshSettingsModal function or its default export's function
                                if (module.openMeshSettingsModal) {
                                    module.openMeshSettingsModal(meshName, meshId);
                                } else if (module.default && module.default.openMeshSettingsModal) {
                                    module.default.openMeshSettingsModal(meshName, meshId);
                                } else {
                                    console.error('Could not find openMeshSettingsModal in module');
                                }
                            };
                            
                            console.log('Mesh Settings global function registered:', typeof window.openMeshSettingsModal === 'function');
                        });
                    } else {
                        console.log('Mesh Settings Modal initialized successfully, global function available');
                    }
                }, 100);
            } else {
                console.error('Could not extract mesh settings modal element from HTML: modal element not found');
            }
            
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading mesh settings modal:', error);
            componentLoaded();
        });
}

/**
 * Initialize the debugger with the given settings
 * @param {Object} settings - The application settings
 */
function initializeDebugger(settings) {
    // HTML UI handling code - hide upload section, show debug controls in header
    const uploadSection = document.getElementById('upload-section');
    const debugControls = document.querySelector('.debug-controls');
    const viewport = document.getElementById('viewport');
    const tabContainer = document.getElementById('tab-container');
    
    if (uploadSection) {
        uploadSection.style.display = 'none';
    }
    
    if (debugControls) {
        debugControls.style.display = 'flex';
    }
    
    // Show viewport
    if (viewport) {
        viewport.style.display = 'block';
    }
    
    // Make the tab container visible once debugging starts, respecting saved hidden state
    if (tabContainer) {
        const isPanelHidden = settings && settings.tabPanelHidden;
        
        if (isPanelHidden) {
            // Keep panel hidden if that was the saved state
            tabContainer.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
        } else {
            // Otherwise make it visible
            tabContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
        }
    }
    
    // Set up tab navigation
    setupTabNavigation();
    
    // Set up toggle panel button
    setupTogglePanelButton();
    
    // Now that the user has clicked "Start Debugging", we can initialize all the panels
    console.log('Start debugging clicked - initializing panels...');
    
    // Initialize settings modal with loaded settings
    new SettingsModal(settings);

    
    // Initialize Model Integration for HTML Editor
    initModelIntegration();
    
    // Scene initialization is now handled in startDebugging function
    // to ensure proper sequencing of operations
}

/**
 * Set up theme, UI elements, and basic event listeners
 */
function setupThemeAndUI() {
    // Always use terminal theme (dark mode)
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
    
    // System status button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = 'System Status';
        
        themeToggle.addEventListener('click', function() {
            alert('System Status: Online\nAsset Debugger: Ready\nRig Visualizer: Ready');
        });
    }
    
    // Return to Toolbox functionality
    const returnToToolboxBtn = document.getElementById('return-to-toolbox');
    if (returnToToolboxBtn) {
        returnToToolboxBtn.addEventListener('click', function() {
            window.location.href = '../../';
        });
    }
    
    // Pin button functionality with localStorage persistence
    const pinButton = document.getElementById('pin-button');
    if (pinButton) {
        // No need to initialize state here as it's now done in the HTML
        // Just set up event listener to toggle and save pin state
        pinButton.addEventListener('click', function() {
            this.classList.toggle('pinned');
            
            // Save the new state to settings
            const isPinned = this.classList.contains('pinned');
            const currentSettings = loadSettings() || {};
            currentSettings.pinned = isPinned;
            saveSettings(currentSettings);
            
            // If pinned, ensure header is visible
            const header = document.querySelector('header');
            if (isPinned) {
                header.style.transform = 'translateY(0)';
                header.style.opacity = '1';
            } else {
                // If not pinned, just register the dock behavior
                // but don't hide the header immediately - keep it visible
                // and let the mouse movement behavior handle when to hide it
                setupHeaderDockBehavior(false);
            }
        });
    }
    
    // Set up Mac-like dock behavior for header
    setupHeaderDockBehavior(true);
    
    // Set up the main container as a dropzone for zip files
    setupMainContainerDropzone();
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
        processZipFile(file);
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
        
        // Note: We're defaulting to background dropzone for all images
        // Alternatively, we could use filename heuristics to detect textures:
        // if (file.name.toLowerCase().includes('basecolor') || file.name.toLowerCase().includes('albedo')) {
        //    return 'basecolor-dropzone';
        // } else if (file.name.toLowerCase().includes('normal')) {
        //    return 'normal-dropzone';
        // } else if (file.name.toLowerCase().includes('orm') || file.name.toLowerCase().includes('roughness')) {
        //    return 'orm-dropzone';
        // }
    }
    
    // Not a supported file type
    return null;
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
    
    // Dispatch the drop event on the dropzone
    dropzone.dispatchEvent(dropEvent);
    
    // If it's a model, trigger loading into the viewer
    if (dropzoneId === 'model-dropzone') {
        // Update model in state
        import('../../core/state.js').then(stateModule => {
            stateModule.setState({
                modelFile: file,
                useCustomModel: true
            });
        });
        
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
        
        // If successful, update state with all detected assets
        if (results.success) {
            // Update state with texture assets
            updateStateWithBestTextures(results.atlasResults);
            
            // Update state with model, lighting, and background files
            updateStateWithOtherAssets(results);
        }
    } catch (error) {
        console.error('Error processing ZIP file:', error);
    }
}

/**
 * Load a background image from a file
 * @param {File} file - The image file to load
 */
function loadBackgroundImage(file) {
    // Skip loading background images from ZIP files for now
    console.log('Skipping background image loading from ZIP files as per requirements');
    
    /*
    // Original implementation - commented out
    console.log(`Loading background image into background dropzone: ${file.name}`);
    
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
    
    // Get the background dropzone
    const dropzone = document.getElementById('background-dropzone');
    
    if (dropzone) {
        // Dispatch the drop event on the dropzone
        dropzone.dispatchEvent(dropEvent);
        console.log('Dispatched drop event for background dropzone');
    } else {
        console.warn('Could not find background dropzone element');
    }
    */
}

/**
 * Format file size in bytes to a human-readable format
 * @param {number} bytes - The file size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * First verifies if any files were dropped before proceeding with debugging
 */
function verifyFileDrop() {
    // First check if any files were dropped
    import('../../core/state.js').then(stateModule => {
        const currentState = stateModule.getState();
        const hasTextures = currentState.textureObjects.baseColor || 
                          currentState.textureObjects.orm || 
                          currentState.textureObjects.normal;
        const hasModel = currentState.useCustomModel && currentState.modelFile;
        const hasLightingFile = currentState.lightingFile && 
                              (currentState.lightingFile.name.toLowerCase().endsWith('.hdr') || 
                               currentState.lightingFile.name.toLowerCase().endsWith('.exr'));
        const hasBackgroundFile = currentState.backgroundFile && 
                               (currentState.backgroundFile.name.toLowerCase().endsWith('.hdr') || 
                                currentState.backgroundFile.name.toLowerCase().endsWith('.exr') ||
                                currentState.backgroundFile.name.toLowerCase().endsWith('.jpg') ||
                                currentState.backgroundFile.name.toLowerCase().endsWith('.jpeg') ||
                                currentState.backgroundFile.name.toLowerCase().endsWith('.png') ||
                                currentState.backgroundFile.name.toLowerCase().endsWith('.webp') ||
                                currentState.backgroundFile.name.toLowerCase().endsWith('.tiff'));
        
        // Special case: If only lighting file is provided, we'll use a test cube with multiple materials
        const onlyLightingProvided = hasLightingFile && !hasTextures && !hasModel;
        
        // Special case: If only background file is provided, we'll also use a test cube with multiple materials
        const onlyBackgroundProvided = hasBackgroundFile && !hasTextures && !hasModel && !hasLightingFile;
        
        // Update hasFiles check to include the special lighting-only case
        const hasFiles = hasTextures || hasModel || hasLightingFile || hasBackgroundFile;
        
        // If only lighting file or only background file is provided, set a flag in state to use multi-material test cube
        if (onlyLightingProvided || onlyBackgroundProvided) {
            stateModule.setState({
                useLightingTestCube: true
            });
        }
        
        // If no files were dropped, show examples modal
        if (!hasFiles) {
            // Load settings for use with examples
            const savedSettings = loadSettings();
            
            // Initialize the examples modal with a callback that can handle different examples
            const examplesModal = new ExamplesModal((exampleType) => {
                // Set flag in state to track which example was selected
                stateModule.setState({ selectedExample: exampleType });
                
                // Initialize the debugger with the loaded settings
                initializeDebugger(savedSettings);
            });
            
            // Show the examples modal
            examplesModal.openModal();
        } else {
            // Continue with debugging only if user dropped files
            startDebugging();
        }
    });
}

/**
 * Main function that handles the debugging process
 * Only called when we want to proceed with debugging
 */
function startDebugging() {
    console.log('Starting debugging...');
    
    // Show the loading splash screen first
    showLoadingSplash();
    updateLoadingProgress('Initializing asset debugger...');
    
    // Load settings from localStorage at the start
    const savedSettings = loadSettings();
    
    // Import state to check current values
    import('../../core/state.js').then(stateModule => {
        const initialState = stateModule.getState();
        console.log('[DEBUG] Initial state before debugging:', {
            backgroundFile: initialState.backgroundFile ? 
                `${initialState.backgroundFile.name} (${initialState.backgroundFile.type})` : 'null',
            backgroundTexture: initialState.backgroundTexture ? 'Texture present' : 'null'
        });
    });
    
    // Apply rig options from saved settings if available
    if (savedSettings && savedSettings.rigOptions) {
        import('../../core/rig/rig-manager.js').then(rigManagerModule => {
            console.log('Applying saved rig options:', savedSettings.rigOptions);
            rigManagerModule.updateRigOptions(savedSettings.rigOptions);
        });
    }
    
    // Initialize the debugger with the loaded settings
    // This ensures scene and renderer are created
    initializeDebugger(savedSettings);

    // Get viewport element for scene initialization
    const viewport = document.getElementById('viewport');
    
    // Create a variable to store the scene module for later use
    let sceneModule;
    
    // Sequence the operations properly with better scene initialization handling:
    // 1. Import and initialize scene
    // 2. Apply lighting
    // 3. Load model
    
    // Create a promise chain to ensure proper sequencing
    import('../../core/scene.js')
        .then(module => {
            sceneModule = module;
            console.log('Scene module loaded, initializing scene');
            // Initialize scene and store the result to ensure it's ready
            return sceneModule.initScene(viewport);
        })
        .then(() => {
            // Start animation loop
            sceneModule.startAnimation();
            resourcesLoaded.sceneInitialized = true;
            checkAllResourcesLoaded();
            
            updateLoadingProgress('Setting up scene and lighting...');
            // Check for HDR or EXR lighting files
            return import('../../core/state.js')
                .then(stateModule => {
                    const currentState = stateModule.getState();
                    console.log('[DEBUG] State after scene init:', {
                        backgroundFile: currentState.backgroundFile ? 
                            `${currentState.backgroundFile.name} (${currentState.backgroundFile.type})` : 'null',
                        backgroundTexture: currentState.backgroundTexture ? 'Texture present' : 'null'
                    });
                    
                    const lightingFile = currentState.lightingFile;
                    const backgroundFile = currentState.backgroundFile;
                    const backgroundTexture = currentState.backgroundTexture;
                    
                    // Process lighting and background as separate, sequential operations
                    // This ensures they don't interfere with each other
                    
                    // First, handle lighting if available
                    let setupPromise = Promise.resolve();
                    
                    if (lightingFile) {
                        console.log('Setting up environment lighting from:', lightingFile.name);
                        // Import lighting utilities
                        setupPromise = import('../../core/lighting-util.js')
                            .then(lightingModule => {
                                // First parse the metadata (for info display)
                                return lightingModule.parseLightingData(lightingFile)
                                    .then(metadata => {
                                        // Only log if debugging is enabled
                                        if (DEBUG_LIGHTING) {
                                            console.log('Environment Map Full Analysis:', metadata);
                                        }
                                        
                                        // Update the World Panel with this metadata
                                        return import('./world-panel.js')
                                            .then(worldPanelModule => {
                                                if (worldPanelModule.updateLightingInfo) {
                                                    worldPanelModule.updateLightingInfo(metadata);
                                                }

                                                // Apply the lighting to the scene
                                                return lightingModule.setupEnvironmentLighting(lightingFile)
                                                    .then(texture => {
                                                        // Ensure the lighting preview is rendered in world panel
                                                        if (texture && worldPanelModule.renderEnvironmentPreview) {
                                                            console.log('Rendering environment preview in world panel');
                                                            // Find the canvas in the world panel
                                                            const hdrCanvas = document.getElementById('hdr-preview-canvas');
                                                            const noImageMessage = document.getElementById('no-image-message');
                                                            
                                                            // Render the preview if canvas exists
                                                            if (hdrCanvas) {
                                                                worldPanelModule.renderEnvironmentPreview(texture, hdrCanvas, noImageMessage);
                                                            } else {
                                                                console.warn('HDR preview canvas not found, will be rendered when panel is ready');
                                                                // Store the texture in state for later use
                                                                updateState('environmentTexture', texture);
                                                            }
                                                        }
                                                        return texture;
                                                    });
                                            });
                                    })
                                    .catch(error => {
                                        console.error('Error analyzing environment map:', error);
                                        return Promise.resolve(); // Continue chain
                                    });
                            })
                            .then(() => {
                                resourcesLoaded.lightingLoaded = true;
                                checkAllResourcesLoaded();
                            });
                    } else {
                        resourcesLoaded.lightingLoaded = true;
                        checkAllResourcesLoaded();
                    }
                    
                    // Then, handle background (after lighting is complete)
                    return setupPromise.then(() => {
                        // If we have a texture already loaded from the dropzone preview,
                        // use that directly instead of reloading the file
                        if (backgroundTexture) {
                            console.log('[DEBUG] Using already loaded background texture');
                            
                            // Don't automatically apply the texture to the scene background
                            // Instead, just update the state and dispatch the event
                            
                            // Dispatch an event to notify UI components
                            const event = new CustomEvent('background-updated', { 
                                detail: { texture: backgroundTexture, file: backgroundFile }
                            });
                            document.dispatchEvent(event);
                            
                            // When the background texture is ready, inform the world panel
                            // so it can update the UI to show the Background Image radio option
                            // but NOT automatically select it
                            import('./world-panel.js').then(worldPanelModule => {
                                if (worldPanelModule.updateBackgroundInfo && backgroundFile) {
                                    // Get metadata to display in the UI
                                    const metadata = {
                                        fileName: backgroundFile.name,
                                        type: backgroundFile.type || backgroundFile.name.split('.').pop().toUpperCase(),
                                        dimensions: { 
                                            width: backgroundTexture.image?.width || 0, 
                                            height: backgroundTexture.image?.height || 0 
                                        },
                                        fileSizeBytes: backgroundFile.size
                                    };
                                    
                                    // Update the background info panel with this data
                                    worldPanelModule.updateBackgroundInfo(metadata, false);
                                    
                                    // Make sure the "None" radio is still selected
                                    const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
                                    if (noneRadio) {
                                        noneRadio.checked = true;
                                    }
                                }
                            });
                            
                            resourcesLoaded.backgroundLoaded = true;
                            checkAllResourcesLoaded();
                        }
                        else if (backgroundFile) {
                            console.log('[DEBUG] Setting up background image from:', backgroundFile.name, 'type:', backgroundFile.type);
                            
                            // Import background image utilities
                            return import('../../core/background-util.js')
                                .then(backgroundModule => {
                                    return backgroundModule.setupBackgroundImage(backgroundFile)
                                        .then(texture => {
                                            // After background is set up, explicitly trigger a UI update event
                                            // using the background texture
                                            if (texture) {
                                                console.log('[DEBUG] Background image loaded successfully, texture:', 
                                                    texture.isTexture ? 'valid texture' : 'invalid texture');
                                                
                                                // Check state after background texture is loaded
                                                import('../../core/state.js').then(stateModule => {
                                                    const updatedState = stateModule.getState();
                                                    console.log('[DEBUG] State after background texture loaded:', {
                                                        backgroundFile: updatedState.backgroundFile ? 
                                                            `${updatedState.backgroundFile.name} (${updatedState.backgroundFile.type})` : 'null',
                                                        backgroundTexture: updatedState.backgroundTexture ? 'Texture present' : 'null'
                                                    });
                                                });
                                                
                                                // Manually dispatch the background-updated event
                                                const event = new CustomEvent('background-updated', { 
                                                    detail: { texture }
                                                });
                                                document.dispatchEvent(event);
                                            } else {
                                                console.log('[DEBUG] Background image loading failed - no texture returned');
                                            }
                                            return texture;
                                        })
                                        .catch(error => {
                                            console.error('[DEBUG] Error setting up background image:', error);
                                            return Promise.resolve(); // Continue chain
                                        });
                                })
                                .catch(error => {
                                    console.error('[DEBUG] Error importing background utilities:', error);
                                    return Promise.resolve(); // Continue chain
                                })
                                .then(() => {
                                    resourcesLoaded.backgroundLoaded = true;
                                    checkAllResourcesLoaded();
                                });
                        } else {
                            console.log('[DEBUG] No background file found in state');
                            resourcesLoaded.backgroundLoaded = true;
                            checkAllResourcesLoaded();
                        }
                    });
                })
                .then(() => {
                    // Double check state after all resources are loaded
                    import('../../core/state.js').then(stateModule => {
                        const finalState = stateModule.getState();
                        console.log('[DEBUG] Final state after all resources loaded:', {
                            backgroundFile: finalState.backgroundFile ? 
                                `${finalState.backgroundFile.name} (${finalState.backgroundFile.type})` : 'null',
                            backgroundTexture: finalState.backgroundTexture ? 'Texture present' : 'null'
                        });
                    });
                });
        })
        .then(() => {
            // Now that scene and lighting are set up, load the model
            updateLoadingProgress('Loading 3D model...');
            return import('../../core/models.js')
                .then(modelsModule => {
                    // Ensure state.scene is available before calling loadDebugModel
                    return import('../../core/state.js')
                        .then(stateModule => {
                            const currentState = stateModule.getState();
                            if (!currentState.scene) {
                                console.warn('Scene still not available in state, waiting...');
                                // Wait a moment for scene to be fully registered in state
                                return new Promise(resolve => setTimeout(resolve, 500))
                                    .then(() => modelsModule.loadDebugModel());
                            } else {
                                return modelsModule.loadDebugModel();
                            }
                        });
                })
                .then(() => {
                    resourcesLoaded.modelLoaded = true;
                    checkAllResourcesLoaded();
                });
        })
        .catch(error => {
            console.error('Error in debugging sequence:', error);
            // Even on error, mark as complete to hide splash screen
            resourcesLoaded.lightingLoaded = true;
            resourcesLoaded.modelLoaded = true;
            checkAllResourcesLoaded();
        });
        
    // Add a final check that ensures camera controls are ready
    // This addresses the brief hiccup where the scene is visible but not controllable
    setTimeout(() => {
        updateLoadingProgress('Finalizing camera controls...');
        
        // Import and ensure camera controls are fully initialized
        import('../../core/controls.js').then(controlsModule => {
            // If there's a method to check if controls are ready, use it
            // Otherwise, use a reasonable timeout to ensure everything is ready
            setTimeout(() => {
                updateLoadingProgress('Ready!');
                resourcesLoaded.controlsReady = true;
                checkAllResourcesLoaded();
            }, 300);
        }).catch(error => {
            console.error('Error ensuring controls are ready:', error);
            // Even on error, mark as complete to hide splash screen after a longer timeout
            setTimeout(() => {
                resourcesLoaded.controlsReady = true;
                checkAllResourcesLoaded();
            }, 1000);
        });
    }, 500);
}

/**
 * Restart the debugging process
 */
function restartDebugging() {
    console.log('Restarting debugging...');
    
    // Reload the page to start over
    window.location.reload();
}

// LISTNER SETUP CODE

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Asset Debugger UI: Initializing...');
    // Set up theme and UI elements
    setupThemeAndUI();
    // Load all component HTML files
    loadComponentHtml();
    // Initialize the 3D environment
    init();
    // Set up the event listeners for debugging
    // Initialize 3D scene when Start Debugging is clicked
    const startDebugBtn = document.getElementById('start-debug');
    const restartDebugBtn = document.getElementById('restart-debug');
    if (startDebugBtn) {
        startDebugBtn.addEventListener('click', verifyFileDrop);
    }
    if (restartDebugBtn) {
        restartDebugBtn.addEventListener('click', restartDebugging);
    }
});

// LOADING FUNCTIONS

/**
 * Shows the loading splash screen
 */
function showLoadingSplash() {
    // First check if the splash already exists
    let loadingSplash = document.getElementById('loading-splash');
    
    if (!loadingSplash) {
        // Create and add the loading splash screen from our HTML template
        fetch('../pages/loading-splash.html')
            .then(response => response.text())
            .then(html => {
                document.body.insertAdjacentHTML('beforeend', html);
                // Make sure it's visible
                loadingSplash = document.getElementById('loading-splash');
                if (loadingSplash) {
                    loadingSplash.style.display = 'flex';
                }
            })
            .catch(error => {
                console.error('Error loading splash screen:', error);
            });
    } else {
        // If it exists, make sure it's visible
        loadingSplash.style.display = 'flex';
        loadingSplash.classList.remove('fade-out');
    }
}

/**
 * Updates the loading progress text on the splash screen
 * @param {string} text - The progress message to display
 */
function updateLoadingProgress(text) {
    const progressText = document.getElementById('loading-progress-text');
    if (progressText) {
        progressText.textContent = text;
    }
}

/**
 * Hides the loading splash screen with a fade-out animation
 */
function hideLoadingSplash() {
    const loadingSplash = document.getElementById('loading-splash');
    if (loadingSplash) {
        // Add fade-out class for smooth transition
        loadingSplash.classList.add('fade-out');
        
        // Remove the element after the animation completes
        setTimeout(() => {
            loadingSplash.remove();
        }, 600); // Match the transition duration in CSS
    }
}

/**
 * Checks if all resources have loaded and hides the splash screen when done
 */
function checkAllResourcesLoaded() {
    if (resourcesLoaded.componentsLoaded && 
        resourcesLoaded.sceneInitialized && 
        resourcesLoaded.lightingLoaded && 
        resourcesLoaded.backgroundLoaded && 
        resourcesLoaded.modelLoaded &&
        resourcesLoaded.controlsReady) {
        
        loadingComplete = true;
        console.log('All resources loaded, hiding splash screen');
        
        // Give a small delay to ensure everything is rendered properly
        setTimeout(() => {
            hideLoadingSplash();
        }, 500);
    }
}

/**
 * Sets up the Mac-like dock behavior for the header
 * @param {boolean} hideInitially - Whether to hide the header initially if unpinned
 */
function setupHeaderDockBehavior(hideInitially = true) {
    const header = document.querySelector('header');
    const pinButton = document.getElementById('pin-button');
    
    if (!header || !pinButton) return;
    
    // Add CSS transitions for smooth show/hide
    header.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    
    // Initial state
    const isPinned = pinButton.classList.contains('pinned');
    if (!isPinned && hideInitially) {
        // Start with header hidden if not pinned and hideInitially is true
        header.style.transform = 'translateY(-100%)';
        header.style.opacity = '0';
    }
    
    // Add mouse movement listener to show/hide header
    document.addEventListener('mousemove', (e) => {
        // Get latest pin state
        const isPinned = pinButton.classList.contains('pinned');
        
        // If pinned, keep header visible at all times
        if (isPinned) {
            header.style.transform = 'translateY(0)';
            header.style.opacity = '1';
            
            // Clear any pending hide timer
            if (headerHideTimer) {
                clearTimeout(headerHideTimer);
                headerHideTimer = null;
            }
            return;
        }
        
        // When mouse is near the top, show the header
        if (e.clientY <= HEADER_SHOW_DISTANCE) {
            header.style.transform = 'translateY(0)';
            header.style.opacity = '1';
            
            // Clear any pending hide timer
            if (headerHideTimer) {
                clearTimeout(headerHideTimer);
                headerHideTimer = null;
            }
        } 
        // When mouse moves away, start timer to hide header
        else if (e.clientY > HEADER_HIDE_DISTANCE && !headerHideTimer) {
            headerHideTimer = setTimeout(() => {
                header.style.transform = 'translateY(-100%)';
                header.style.opacity = '0';
                headerHideTimer = null;
            }, HEADER_HIDE_DELAY);
        }
    });
}

/**
 * Set up tab navigation system
 */
function setupTabNavigation() {
    console.log('Setting up tab navigation...');
    
    // Get tab buttons
    const worldTabButton = document.getElementById('world-tab-button');
    const assetTabButton = document.getElementById('asset-tab-button');
    
    // Helper function to get the latest references to tab content elements
    function getTabElements() {
        return {
            worldTab: document.getElementById('world-tab-container'),
            worldContent: document.getElementById('world-tab'),
            assetTab: document.getElementById('asset-tab-container'),
            assetContent: document.getElementById('asset-tab')
        };
    }
    
    // Helper function to hide all tabs
    function hideAllTabs() {
        const tabs = getTabElements();
        Object.values(tabs).forEach(tab => {
            if (tab) tab.classList.remove('active');
        });
    }
    
    // Set up click handlers for each tab button
    if (worldTabButton) {
        worldTabButton.addEventListener('click', () => {
            // Update active button
            worldTabButton.classList.add('active');
            assetTabButton.classList.remove('active');
            
            // Hide all tabs first
            hideAllTabs();
            
            // Show world tab content
            const tabs = getTabElements();
            if (tabs.worldTab) tabs.worldTab.classList.add('active');
            if (tabs.worldContent) tabs.worldContent.classList.add('active');
        });
    }
    
    if (assetTabButton) {
        assetTabButton.addEventListener('click', () => {
            // Update active button
            worldTabButton.classList.remove('active');
            assetTabButton.classList.add('active');
            
            // Hide all tabs first
            hideAllTabs();
            
            // Show asset tab content
            const tabs = getTabElements();
            if (tabs.assetTab) tabs.assetTab.classList.add('active');
            if (tabs.assetContent) tabs.assetContent.classList.add('active');
        });
    }
}

/**
 * Helper function to activate the World tab
 */
function activateWorldTab() {
    // First define the getTabElements function if it's not accessible
    function getTabElements() {
        return {
            worldTab: document.getElementById('world-tab-container'),
            worldContent: document.getElementById('world-tab'),
            assetTab: document.getElementById('asset-tab-container'),
            assetContent: document.getElementById('asset-tab')
        };
    }
    
    // Helper function to hide all tabs
    function hideAllTabs() {
        const tabs = getTabElements();
        Object.values(tabs).forEach(tab => {
            if (tab) tab.classList.remove('active');
        });
    }
    
    // Hide all tabs first
    hideAllTabs();
    
    // Then activate only the world tab
    const tabs = getTabElements();
    if (tabs.worldTab) tabs.worldTab.classList.add('active');
    if (tabs.worldContent) tabs.worldContent.classList.add('active');
    
    // Make sure the World tab button is active and others inactive
    const worldTabButton = document.getElementById('world-tab-button');
    const assetTabButton = document.getElementById('asset-tab-button');
    
    if (worldTabButton) worldTabButton.classList.add('active');
    if (assetTabButton) assetTabButton.classList.remove('active');
}

/**
 * Sets up the toggle panel button to show/hide the panels
 */
function setupTogglePanelButton() {
    // Debug flag - set to false to disable logging
    const DEBUG_TOGGLE_PANEL = false;
    
    const toggleButton = document.getElementById('toggle-panel');
    const tabContainer = document.getElementById('tab-container');
    
    if (!toggleButton || !tabContainer) {
        if (DEBUG_TOGGLE_PANEL) {
            console.error('Toggle panel setup failed: button or tab container not found', {
                toggleButton: toggleButton ? 'found' : 'missing', 
                tabContainer: tabContainer ? 'found' : 'missing'
            });
        }
        return;
    }
    
    if (DEBUG_TOGGLE_PANEL) {
        console.log('Setting up toggle panel button', {
            buttonEl: toggleButton,
            tabContainerEl: tabContainer,
            initialTabDisplay: tabContainer.style.display,
            initialTabVisibility: tabContainer.style.visibility,
            tabClassList: Array.from(tabContainer.classList)
        });
    }
    
    // Load the panel state from localStorage
    import('../../data/localstorage-util.js').then(({ loadSettings, saveSettings }) => {
        const settings = loadSettings() || {};
        
        // Initialize panel hidden state from settings (default to false if not set)
        let isPanelHidden = settings.tabPanelHidden || false;
        
        // Apply the initial state based on loaded settings
        if (isPanelHidden) {
            // Hide the panel initially
            tabContainer.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
            toggleButton.classList.add('active');
            toggleButton.setAttribute('title', 'Show Side Panel');
        } else {
            // Show the panel initially
            tabContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
            toggleButton.classList.remove('active');
            toggleButton.setAttribute('title', 'Hide Side Panel');
        }
        
        // Set up click event
        toggleButton.addEventListener('click', function() {
            isPanelHidden = !isPanelHidden;
            
            if (DEBUG_TOGGLE_PANEL) {
                console.log('Toggle panel clicked, new state:', {
                    isPanelHidden: isPanelHidden,
                    currentDisplayStyle: tabContainer.style.display,
                    currentVisibilityStyle: tabContainer.style.visibility
                });
            }
            
            if (isPanelHidden) {
                // Hide the panel
                if (DEBUG_TOGGLE_PANEL) console.log('Hiding panel...');
                tabContainer.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                
                // Add "active" style when panel is hidden
                toggleButton.classList.add('active');
                
                // Update tooltip to reflect current state
                toggleButton.setAttribute('title', 'Show Side Panel');
                
                if (DEBUG_TOGGLE_PANEL) {
                    console.log('Panel hidden, new styles:', {
                        display: tabContainer.style.display,
                        visibility: tabContainer.style.visibility,
                        opacity: tabContainer.style.opacity
                    });
                }
            } else {
                // Show the panel
                if (DEBUG_TOGGLE_PANEL) console.log('Showing panel...');
                tabContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
                
                // Remove "active" style when panel is visible
                toggleButton.classList.remove('active');
                
                // Update tooltip to reflect current state
                toggleButton.setAttribute('title', 'Hide Side Panel');
                
                if (DEBUG_TOGGLE_PANEL) {
                    console.log('Panel shown, new styles:', {
                        display: tabContainer.style.display,
                        visibility: tabContainer.style.visibility,
                        opacity: tabContainer.style.opacity
                    });
                }
            }
            
            // Save the new state to localStorage
            settings.tabPanelHidden = isPanelHidden;
            saveSettings(settings);
        });
        // Make sure only the World tab is active initially
        activateWorldTab();
    });
}

// Export for external use
export default { init }; 