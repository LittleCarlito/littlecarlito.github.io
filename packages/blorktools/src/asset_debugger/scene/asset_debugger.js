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
import { initState } from './state.js';
import { initUiManager } from '../util/ui-manager.js';
import { hideLoadingSplash, showLoadingSplash, updateLoadingProgress } from '../loading-splash/loading-splash.js';
import { setupDropzones } from '../landing-page/dropzone-util.js';

// Debug flags
const DEBUG_LIGHTING = false;

// Track if World Panel has been initialized
let worldPanelInitialized = false;

// Track if Asset Panel has been initialized
let assetPanelInitialized = false;

// Track loading completion state
let loadingComplete = false;

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
 * Initialize the asset debugger application
 */
export function init() {
    // Initialize state
    initState();
    
    // Initialize UI components
    initUiManager();
    setupDropzones();
    
    // Handle theme switching if needed
    setupThemeSwitching();
}

/**
 * Set up theme switching
 */
function setupThemeSwitching() {
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const html = document.documentElement;
            if (html.classList.contains('dark-mode')) {
                html.classList.remove('dark-mode');
                html.classList.add('light-mode');
            } else {
                html.classList.remove('light-mode');
                html.classList.add('dark-mode');
            }
        });
    }
}

/**
 * Load all component HTML files dynamically
 */
function loadComponentHtml() {
    // Track loading of components
    let componentsToLoad = 5; // Total components to load (reduced by 1 since we removed mesh settings modal)
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
    fetch('../panels/world-panel/world-panel.html')
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
    fetch('../panels/asset-panel/asset-panel.html')
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
    fetch('../modals/settings-modal/settings-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('settings-modal-container').innerHTML = html;
            
            // Now that settings modal is loaded, load the axis indicator settings
            fetch('./axis-indicator/axis-indicator.html')
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
        
    // Load the HTML editor modal component
    fetch('../modals/html-editor-modal/html-editor-modal.html')
        .then(response => response.text())
        .then(html => {
            // Insert the entire HTML into the container, which includes the CSS link
            document.getElementById('html-editor-modal-container').innerHTML = html;
            
            // Get a reference to the modal element
            const modalElement = document.getElementById('html-editor-modal');
            
            // Ensure the modal is hidden
            if (modalElement) {
                modalElement.style.display = 'none';
                
                // Initialize the modal now that it's in the DOM and hidden
                setTimeout(() => {
                    // Call initHtmlEditorModal and ensure it registers the global function
                    initHtmlEditorModal();
                    
                    // Double-check that the function is registered globally
                    if (typeof window.openEmbeddedHtmlEditor !== 'function') {
                        console.log('Global function not registered properly, manually registering now');
                        
                        // Import the module and manually register the function
                        import('../modals/html-editor-modal/html-editor-modal.js').then(module => {
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
        
        // Now that the user has clicked "Start Debugging", we can initialize all the panels
        console.log('Start debugging clicked - initializing panels...');
        
        // Initialize settings modal with loaded settings
        new SettingsModal(settings);
        
        // Initialize Model Integration for HTML Editor
        initModelIntegration();
    };
    
    // Start checking for the header
    checkHeaderAndInit();
}

/**
 * Set up theme, UI elements, and basic event listeners
 */
function setupThemeAndUI() {
    // Always use terminal theme (dark mode)
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
}

/**
 * Main function that handles the debugging process
 * Only called when we want to proceed with debugging
 */
export function startDebugging() {
    console.log('Starting debugging...');
    
    // Show the loading splash screen first
    showLoadingSplash();
    updateLoadingProgress('Initializing asset debugger...');
    
    // Load settings from localStorage at the start
    const savedSettings = loadSettings();
    
    // Import state to check current values
    import('./state.js').then(stateModule => {
        const initialState = stateModule.getState();
        console.log('[DEBUG] Initial state before debugging:', {
            backgroundFile: initialState.backgroundFile ? 
                `${initialState.backgroundFile.name} (${initialState.backgroundFile.type})` : 'null',
            backgroundTexture: initialState.backgroundTexture ? 'Texture present' : 'null'
        });
    });
    
    // Apply rig options from saved settings if available
    if (savedSettings && savedSettings.rigOptions) {
        import('../util/rig/rig-manager.js').then(rigManagerModule => {
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
    import('./scene.js')
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
            return import('./state.js')
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
                        setupPromise = import('./lighting-util.js')
                            .then(lightingModule => {
                                // First parse the metadata (for info display)
                                return lightingModule.parseLightingData(lightingFile)
                                    .then(metadata => {
                                        // Only log if debugging is enabled
                                        if (DEBUG_LIGHTING) {
                                            console.log('Environment Map Full Analysis:', metadata);
                                        }
                                        
                                        // Update the World Panel with this metadata
                                        return import('../panels/world-panel/world-panel.js')
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
                            import('../panels/world-panel/world-panel.js').then(worldPanelModule => {
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
                            return import('../util/background-util.js')
                                .then(backgroundModule => {
                                    return backgroundModule.setupBackgroundImage(backgroundFile)
                                        .then(texture => {
                                            // After background is set up, explicitly trigger a UI update event
                                            // using the background texture
                                            if (texture) {
                                                console.log('[DEBUG] Background image loaded successfully, texture:', 
                                                    texture.isTexture ? 'valid texture' : 'invalid texture');
                                                
                                                // Check state after background texture is loaded
                                                import('./state.js').then(stateModule => {
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
                    import('./state.js').then(stateModule => {
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
            return import('../util/models-util.js')
                .then(modelsModule => {
                    // Ensure state.scene is available before calling loadDebugModel
                    return import('./state.js')
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
        import('./controls.js').then(controlsModule => {
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

// Instead, export a function to initialize the debugger
export function setupAssetDebugger() {
    console.log('Asset Debugger UI: Initializing...');
    // Set up theme and UI elements
    setupThemeAndUI();
    // Load all component HTML files
    loadComponentHtml();
    // Initialize the 3D environment
    init();
    // Set up the event listeners for debugging
    const restartDebugBtn = document.getElementById('restart-debug');
    if (restartDebugBtn) {
        restartDebugBtn.addEventListener('click', restartDebugging);
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
        // Make sure only the World tab is active initially
        activateWorldTab();
    });
}
