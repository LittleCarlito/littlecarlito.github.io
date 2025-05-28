/**
 * Asset Debugger - UI Entry Point
 * 
 * This file is the main entry point for the Asset Debugger UI.
 * It initializes the application and sets up all necessary components.
 */

// Import loadSettings and saveSettings from localstorage-util.js
import { loadSettings, saveSettings } from '../util/localstorage-util.js';
// Import SettingsModal 
import { SettingsModal } from '../modals/settings-modal/settings-modal.js';
// Import Asset Panel
import { initAssetPanel } from '../panels/asset-panel/asset-panel.js';
// Import Model Integration for HTML Editor
import { initModelIntegration } from '../modals/html-editor-modal/model-integration.js';
// Import ZIP utilities
import { 
    processZipContents, 
    loadTextureIntoDropzone, 
    updateStateWithBestTextures,
    loadModelIntoDropzone,
    loadLightingIntoDropzone,
    loadBackgroundIntoDropzone,
    updateStateWithOtherAssets
} from '../landing-page/zip-util.js';
import { initHtmlEditorModal } from '../modals/html-editor-modal/html-editor-modal.js';
import { initWorldPanel } from '../panels/world-panel/world-panel.js';
import { updateState } from './state.js';
import { initUiManager } from '../util/ui-manager.js';
import { hideLoadingSplash, showLoadingSplash, updateLoadingProgress } from '../loading-splash/loading-splash.js';
import { setupDropzones } from '../landing-page/dropzone-util.js';

// Debug flags
const DEBUG_LIGHTING = false;

// Component loading state tracker
const componentsLoaded = {
    worldPanel: false,
    assetPanel: false,
    settingsModal: false,
    htmlEditor: false,
    scene: false
};

// Resource loading state tracker
const resourcesLoaded = {
    componentsLoaded: false,
    sceneInitialized: false,
    lightingLoaded: false,
    backgroundLoaded: false,
    modelLoaded: false,
    controlsReady: false
};

// Track if loading is complete
let loadingComplete = false;

/**
 * Main entry point for the Asset Debugger.
 * Sets up the UI, loads components, and initializes the 3D scene.
 */
export function setupAssetDebugger() {
    // Show loading splash screen
    showLoadingSplash();
    updateLoadingProgress('Initializing asset debugger...');
    
    console.log('Asset Debugger UI: Initializing...');
    
    // Initialize UI components
    initUiManager();
    
    // Load all component HTML files
    loadComponentHtml();
    
    // Initialize the 3D environment
    initializeScene();
    
    // Set up the event listeners for debugging
    const restartDebugBtn = document.getElementById('restart-debug');
    if (restartDebugBtn) {
        restartDebugBtn.addEventListener('click', restartDebugging);
    }
    
    // Update loading text to show we're done with initialization
    updateLoadingProgress('Asset debugger initialized - waiting for all components to load...');
}

/**
 * Load all component HTML files dynamically and initialize components
 */
function loadComponentHtml() {
    // Create promises for each component load
    const worldPanelPromise = fetch('../panels/world-panel/world-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('world-tab-container').innerHTML = html;
            console.log('World Panel HTML loaded, initializing panel...');
            initWorldPanel();
            componentsLoaded.worldPanel = true;
        })
        .catch(error => {
            console.error('Error loading world panel:', error);
            throw error;
        });

    const assetPanelPromise = fetch('../panels/asset-panel/asset-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('asset-tab-container').innerHTML = html;
            console.log('Asset Panel HTML loaded, initializing panel...');
            initAssetPanel();
            componentsLoaded.assetPanel = true;
        })
        .catch(error => {
            console.error('Error loading asset panel:', error);
            throw error;
        });

    const settingsModalPromise = fetch('../modals/settings-modal/settings-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('settings-modal-container').innerHTML = html;
            
            // Now that settings modal is loaded, load the axis indicator settings
            return fetch('./axis-indicator/axis-indicator.html')
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
                    
                    // Initialize settings modal with loaded settings
                    new SettingsModal();
                    componentsLoaded.settingsModal = true;
                });
        })
        .catch(error => {
            console.error('Error loading settings modal:', error);
            throw error;
        });

    const htmlEditorPromise = fetch('../modals/html-editor-modal/html-editor-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('html-editor-modal-container').innerHTML = html;
            
            const modalElement = document.getElementById('html-editor-modal');
            if (modalElement) {
                modalElement.style.display = 'none';
                initHtmlEditorModal();
                initModelIntegration();
                componentsLoaded.htmlEditor = true;
            } else {
                throw new Error('Could not extract HTML editor modal element from HTML: modal element not found');
            }
        })
        .catch(error => {
            console.error('Error loading HTML editor modal:', error);
            throw error;
        });

    // Wait for all components to load
    Promise.all([
        worldPanelPromise,
        assetPanelPromise,
        settingsModalPromise,
        htmlEditorPromise
    ])
    .then(() => {
        console.log('All components loaded successfully');
        resourcesLoaded.componentsLoaded = true;
        // Start the debugging process after components are loaded
        startDebugging();
    })
    .catch(errors => {
        // Log any errors that occurred during loading
        console.error('Some components failed to load with errors:', errors);
        // Still mark components as loaded to prevent hanging
        resourcesLoaded.componentsLoaded = true;
        // Start debugging even if some components failed
        startDebugging();
    });
}

/**
 * Initialize the 3D scene
 */
function initializeScene() {
    // Get viewport element for scene initialization
    const viewport = document.getElementById('viewport');
    
    // Import and initialize scene
    import('./scene.js')
        .then(sceneModule => {
            console.log('Scene module loaded, initializing scene');
            try {
                // Initialize scene - handle case where it doesn't return a Promise
                const result = sceneModule.initScene(viewport);
                
                // Start animation loop
                sceneModule.startAnimation();
                componentsLoaded.scene = true;
                resourcesLoaded.sceneInitialized = true;
                checkAllResourcesLoaded();
                
                // Ensure camera controls are ready after a short delay
                setTimeout(() => {
                    updateLoadingProgress('Finalizing camera controls...');
                    
                    // Import and ensure camera controls are fully initialized
                    import('./controls.js')
                        .then(() => {
                            resourcesLoaded.controlsReady = true;
                            checkAllResourcesLoaded();
                        })
                        .catch(error => {
                            console.error('Error ensuring controls are ready:', error);
                            resourcesLoaded.controlsReady = true;
                            checkAllResourcesLoaded();
                        });
                }, 500);
            } catch (error) {
                console.error('Error initializing scene:', error);
                componentsLoaded.scene = true; // Mark as loaded to prevent hanging
                resourcesLoaded.sceneInitialized = true;
                checkAllResourcesLoaded();
            }
        })
        .catch(error => {
            console.error('Error loading scene module:', error);
            componentsLoaded.scene = true; // Mark as loaded to prevent hanging
            resourcesLoaded.sceneInitialized = true;
            checkAllResourcesLoaded();
        });
}

/**
 * Main function that handles the debugging process
 */
export function startDebugging() {
    console.log('Starting debugging...');
    
    // Show the loading splash screen first
    showLoadingSplash();
    updateLoadingProgress('Initializing asset debugger...');
    
    // Load settings from localStorage at the start
    const savedSettings = loadSettings();
    
    // Apply rig options from saved settings if available
    if (savedSettings && savedSettings.rigOptions) {
        import('../util/rig/rig-manager.js').then(rigManagerModule => {
            console.log('Applying saved rig options:', savedSettings.rigOptions);
            rigManagerModule.updateRigOptions(savedSettings.rigOptions);
        });
    }
    
    // Initialize the debugger with the loaded settings
    initializeDebugger(savedSettings);

    // Get current state for loading lighting and background
    import('./state.js')
        .then(stateModule => {
            const currentState = stateModule.getState();
            console.log('[DEBUG] Initial state before debugging:', {
                backgroundFile: currentState.backgroundFile ? 
                    `${currentState.backgroundFile.name} (${currentState.backgroundFile.type})` : 'null',
                backgroundTexture: currentState.backgroundTexture ? 'Texture present' : 'null'
            });

            // Initialize all resource flags to false
            resourcesLoaded.lightingLoaded = false;
            resourcesLoaded.backgroundLoaded = false;
            resourcesLoaded.modelLoaded = false;
            resourcesLoaded.controlsReady = false;

            // Process all files from state in sequence
            let promiseChain = Promise.resolve();

            // Handle lighting file if it exists
            if (stateModule.hasLightingFile()) {
                const lightingFile = stateModule.getLightingFile();
                promiseChain = promiseChain.then(() => {
                    console.log('Setting up environment lighting from:', lightingFile.name);
                    return import('./lighting-util.js')
                        .then(lightingModule => {
                            return lightingModule.setupEnvironmentLighting(lightingFile)
                                .then(texture => {
                                    // Update world panel with lighting info
                                    return import('../panels/world-panel/world-panel.js')
                                        .then(worldPanelModule => {
                                            if (worldPanelModule.updateLightingInfo) {
                                                worldPanelModule.updateLightingInfo({
                                                    fileName: lightingFile.name,
                                                    type: lightingFile.name.split('.').pop().toUpperCase(),
                                                    fileSizeBytes: lightingFile.size
                                                });
                                            }
                                            return texture;
                                        });
                                });
                        })
                        .then(() => {
                            console.log('Lighting loaded successfully');
                            resourcesLoaded.lightingLoaded = true;
                            checkAllResourcesLoaded();
                        });
                });
            } else {
                console.log('No lighting file to load');
                resourcesLoaded.lightingLoaded = true;
                checkAllResourcesLoaded();
            }

            // Handle background file if it exists
            if (stateModule.hasBackgroundFile()) {
                const backgroundFile = stateModule.getBackgroundFile();
                promiseChain = promiseChain.then(() => {
                    console.log('Setting up background from:', backgroundFile.name);
                    return import('../util/background-util.js')
                        .then(backgroundModule => {
                            return backgroundModule.setupBackgroundImage(backgroundFile)
                                .then(texture => {
                                    if (texture) {
                                        const event = new CustomEvent('background-updated', { 
                                            detail: { texture, file: backgroundFile }
                                        });
                                        document.dispatchEvent(event);
                                    }
                                    return texture;
                                });
                        })
                        .then(() => {
                            console.log('Background loaded successfully');
                            resourcesLoaded.backgroundLoaded = true;
                            checkAllResourcesLoaded();
                        });
                });
            } else {
                console.log('No background file to load');
                resourcesLoaded.backgroundLoaded = true;
                checkAllResourcesLoaded();
            }

            // Handle model file if it exists
            if (stateModule.hasModelFile()) {
                const modelFile = stateModule.getModelFile();
                promiseChain = promiseChain.then(() => {
                    console.log('Loading model from:', modelFile.name);
                    return import('../util/models-util.js')
                        .then(modelsModule => {
                            return modelsModule.loadDebugModel();
                        })
                        .then(() => {
                            console.log('Model loaded successfully');
                            resourcesLoaded.modelLoaded = true;
                            checkAllResourcesLoaded();
                        });
                });
            } else {
                console.log('No model file to load');
                resourcesLoaded.modelLoaded = true;
                checkAllResourcesLoaded();
            }

            // Handle texture files if they exist
            if (stateModule.hasBaseColorFile() || stateModule.hasOrmFile() || stateModule.hasNormalFile()) {
                promiseChain = promiseChain.then(() => {
                    return import('../util/custom-animation/texture-util.js')
                        .then(textureModule => {
                            const promises = [];
                            
                            if (stateModule.hasBaseColorFile()) {
                                promises.push(textureModule.loadTexture(stateModule.getBaseColorFile(), 'baseColor'));
                            }
                            if (stateModule.hasOrmFile()) {
                                promises.push(textureModule.loadTexture(stateModule.getOrmFile(), 'orm'));
                            }
                            if (stateModule.hasNormalFile()) {
                                promises.push(textureModule.loadTexture(stateModule.getNormalFile(), 'normal'));
                            }
                            
                            return Promise.all(promises);
                        });
                });
            }

            // Ensure camera controls are ready after all other resources
            return promiseChain.then(() => {
                console.log('Finalizing camera controls...');
                updateLoadingProgress('Finalizing camera controls...');
                return import('./controls.js')
                    .then(() => {
                        console.log('Camera controls initialized');
                        resourcesLoaded.controlsReady = true;
                        checkAllResourcesLoaded();
                    });
            });
        })
        .catch(error => {
            console.error('Error in debugging sequence:', error);
            // Even on error, mark as complete to hide splash screen
            resourcesLoaded.lightingLoaded = true;
            resourcesLoaded.backgroundLoaded = true;
            resourcesLoaded.modelLoaded = true;
            resourcesLoaded.controlsReady = true;
            checkAllResourcesLoaded();
        });
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
        
        if (!loadingComplete) {
            loadingComplete = true;
            console.log('All resources loaded, hiding splash screen');
            
            // Give a small delay to ensure everything is rendered properly
            setTimeout(() => {
                hideLoadingSplash();
            }, 500);
        }
    } else {
        // Log which resources are still not loaded
        const notLoaded = Object.entries(resourcesLoaded)
            .filter(([_, loaded]) => !loaded)
            .map(([name]) => name);
        console.log('Waiting for resources to load:', notLoaded);
    }
}

/**
 * Initialize the debugger with the given settings
 * @param {Object} settings - The application settings
 */
function initializeDebugger(settings) {
    // HTML UI handling code - hide upload section, show debug controls in header
    const uploadSection = document.getElementById('upload-section');
    
    // Make sure the header is loaded before trying to access its elements
    const checkHeaderAndInit = () => {
        const debugControls = document.querySelector('.debug-controls');
        const viewport = document.getElementById('viewport');
        const tabContainer = document.getElementById('tab-container');
        
        if (!debugControls) {
            // Header might not be fully loaded yet, retry after a short delay
            setTimeout(checkHeaderAndInit, 50);
            return;
        }
        
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
    };
    
    // Start checking for the header
    checkHeaderAndInit();
}

/**
 * Restart the debugging process
 */
function restartDebugging() {
    console.log('Restarting debugging...');
    
    // Reload the page to start over
    window.location.reload();
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
    
    // Make sure only the World tab is active initially
    activateWorldTab();
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
    import('../util/localstorage-util.js').then(({ loadSettings, saveSettings }) => {
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
    });
}
