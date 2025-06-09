/**
 * Asset Debugger - UI Entry Point
 * 
 * This file is the main entry point for the Asset Debugger UI.
 * It initializes the application and sets up all necessary components.
 */

// Import loadSettings and saveSettings from localstorage-util.js
import { loadSettings, saveSettings } from '../util/data/localstorage-manager.js';
// Import SettingsModal 
import { SettingsModal } from '../modals/settings-modal/settings-modal.js';
// Import Asset Panel
import { initAssetPanel } from '../panels/asset-panel/asset-panel.js';
// Import Model Integration for HTML Editor
import { initModelIntegration } from '../modals/html-editor-modal/model-integration.js';
import { initHtmlEditorModal } from '../modals/html-editor-modal/html-editor-modal.js';
import { initWorldPanel } from '../panels/world-panel/world-panel.js';
import { getState, printStateReport, hasFiles } from '../util/state/scene-state.js';
import { initUiManager } from '../util/scene/ui-manager.js';
import { hideLoadingSplash, showLoadingSplash, updateLoadingProgress } from '../loading-splash/loading-splash.js';
import { setupDropzones } from '../util/upload/file-upload-handler.js';

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

// Flag to indicate that page is being unloaded - used to abort long operations
let isPageUnloading = false;

/**
 * Main entry point for the Asset Debugger.
 * Sets up the UI, loads components, and initializes the 3D scene.
 */
export function setupAssetDebugger() {
    showLoadingSplash("Setting up debugging environment");
    // Reset the state before initializing
    resetThreeJSState();
    
    getState();
    printStateReport('Asset-Debugger');
    console.debug('Asset Debugger UI: Initializing...');
    // Initialize UI components
    updateLoadingProgress("Initializing UI");
    initUiManager();
    // Load all component HTML files
    updateLoadingProgress("Loading HTML components");
    loadComponentHtml();
    // // Initialize the 3D environment
    updateLoadingProgress("Setting up 3D scene");
    initializeScene();
    // // Set up the event listeners for debugging
    updateLoadingProgress("Setting up event listeners");
    const restartDebugBtn = document.getElementById('restart-debug');
    if (restartDebugBtn) {
        restartDebugBtn.addEventListener('click', restartDebugging);
    }
    // Ensure collapsible headers will work by adding direct event handlers
    // This runs after all components are loaded
    setTimeout(ensureCollapsibleHeadersWork, 500);
    // Return a cleanup function that the router can call
    updateLoadingProgress("Finalizing startup");
    return cleanupAssetDebugger;
}

/**
 * Reset ThreeJS state to ensure clean initialization
 */
function resetThreeJSState() {
    console.log('Resetting ThreeJS state for clean initialization');
    try {
        // Import state module directly
        import('../util/state/scene-state.js').then(stateModule => {
            const state = stateModule.getState();
            
            // Clear ThreeJS objects
            if (state.scene) {
                console.log('Disposing existing scene');
                // Remove all objects from scene
                while(state.scene.children && state.scene.children.length > 0) { 
                    state.scene.remove(state.scene.children[0]); 
                }
            }
            
            // Dispose renderer
            if (state.renderer) {
                console.log('Disposing existing renderer');
                state.renderer.dispose();
            }
            
            // Dispose controls
            if (state.controls) {
                console.log('Disposing existing controls');
                state.controls.dispose();
            }
            
            // Reset critical state values
            stateModule.updateState('scene', null);
            stateModule.updateState('camera', null);
            stateModule.updateState('renderer', null);
            stateModule.updateState('controls', null);
            stateModule.updateState('cube', null);
            stateModule.updateState('animating', false);
            
            // Reset background option via DOM directly - safer than trying to import module
            setTimeout(() => {
                console.log('Resetting background option radio buttons');
                // Find the 'none' radio button and check it
                const noneRadioBtn = document.querySelector('input[name="bg-option"][value="none"]');
                if (noneRadioBtn) {
                    noneRadioBtn.checked = true;
                }
                
                // Reset all canvas opacities
                const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
                const hdrPreviewCanvas = document.getElementById('hdr-preview-canvas');
                
                if (bgPreviewCanvas) bgPreviewCanvas.style.opacity = '0.3';
                if (hdrPreviewCanvas) hdrPreviewCanvas.style.opacity = '0.3';
                
                console.log('Background options reset complete');
            }, 100);
            
            console.log('ThreeJS state reset complete');
        }).catch(error => {
            console.error('Error importing state module:', error);
        });
    } catch (error) {
        console.error('Error resetting ThreeJS state:', error);
    }
}

/**
 * Cleanup function for the asset debugger
 * This is called by the router when navigating away
 */
function cleanupAssetDebugger() {
    console.log('Cleaning up Asset Debugger resources...');
    
    // Set unloading flag to abort any ongoing operations
    isPageUnloading = true;
    
    // Reset HTML editor initialization flag
    try {
        import('../modals/html-editor-modal/html-editor-modal.js').then(htmlEditorModule => {
            // Reset the listeners initialized flag
            if (htmlEditorModule.resetInitialization) {
                htmlEditorModule.resetInitialization();
            }
        });
    } catch (error) {
        console.warn('Could not reset HTML editor initialization:', error);
    }

    // Set unloading flag to abort any ongoing operations
    isPageUnloading = true;
    
    // Immediately hide UI elements - this should be done synchronously
    const debugControls = document.querySelector('.debug-controls');
    if (debugControls) {
        debugControls.style.display = 'none';
        console.log('Debug controls hidden during cleanup');
    }
    
    // Force terminate any active workers
    try {
        const workerManager = window.workerManager || window.appWorkerManager;
        if (workerManager && typeof workerManager.terminateAllWorkers === 'function') {
            workerManager.terminateAllWorkers();
            console.log('Forcibly terminated all worker threads');
        }
    } catch (error) {
        console.warn('Could not terminate workers:', error);
    }
    
    // Schedule non-critical cleanup to happen asynchronously
    setTimeout(() => {
        try {
            // FIRST: Clean up World Panel event listeners
            import('../panels/world-panel/world-panel.js').then(worldPanelModule => {
                if (worldPanelModule.cleanupWorldPanel) {
                    worldPanelModule.cleanupWorldPanel();
                }
            }).catch(error => {
                console.warn('Could not cleanup world panel:', error);
            });
            
            // SECOND: Clear all file state to prevent pollution - but skip localStorage
            import('../util/state/scene-state.js').then(stateModule => {
                // Clear all files without saving to localStorage
                if (stateModule.clearAllFiles) {
                    try {
                        // Try to call with skipLocalStorage option if available
                        stateModule.clearAllFiles(true);
                    } catch (error) {
                        // If that fails, the method doesn't support that option
                        console.warn('Could not skip localStorage in clearAllFiles, using default');
                        stateModule.clearAllFiles();
                    }
                }
                
                const state = stateModule.getState();
                
                // Stop animation loop
                if (state.animating) {
                    import('../util/scene/threejs-scene-controller.js').then(sceneModule => {
                        if (sceneModule.stopAnimation) {
                            sceneModule.stopAnimation();
                        }
                    });
                }
                
                // Dispose ThreeJS resources
                if (state.renderer) {
                    console.log('Disposing renderer');
                    state.renderer.dispose();
                    stateModule.updateState('renderer', null);
                }
                
                // Dispose of controls
                if (state.controls) {
                    console.log('Disposing controls');
                    // Import and use the proper disposal function from controls module
                    import('../util/scene/camera-controller.js').then(controlsModule => {
                        if (controlsModule.disposeControls) {
                            controlsModule.disposeControls();
                        }
                    });
                    state.controls.dispose();
                    stateModule.updateState('controls', null);
                }
                
                // Clean up scene
                if (state.scene) {
                    console.log('Cleaning up scene');
                    // Remove all objects
                    while(state.scene.children && state.scene.children.length > 0) {
                        const obj = state.scene.children[0];
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                            if (Array.isArray(obj.material)) {
                                obj.material.forEach(mat => mat.dispose());
                            } else {
                                obj.material.dispose();
                            }
                        }
                        state.scene.remove(obj);
                    }
                    stateModule.updateState('scene', null);
                }
                
                // Clean up any canvas elements with cleanup functions
                const canvasElements = document.querySelectorAll('canvas[data-animation-id]');
                canvasElements.forEach(canvas => {
                    if (typeof canvas.cleanup === 'function') {
                        console.log('Cleaning up canvas:', canvas.id);
                        canvas.cleanup();
                    }
                    
                    // Cancel any animation frames
                    const animId = canvas.getAttribute('data-animation-id');
                    if (animId) {
                        cancelAnimationFrame(parseInt(animId, 10));
                    }
                });
                
                // Reset radio button selection and canvas opacities directly
                const noneRadioBtn = document.querySelector('input[name="bg-option"][value="none"]');
                if (noneRadioBtn) {
                    noneRadioBtn.checked = true;
                }
                
                const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
                const hdrPreviewCanvas = document.getElementById('hdr-preview-canvas');
                
                if (bgPreviewCanvas) bgPreviewCanvas.style.opacity = '0.3';
                if (hdrPreviewCanvas) hdrPreviewCanvas.style.opacity = '0.3';
                
                console.log('Asset Debugger cleanup complete');
            }).catch(error => {
                console.error('Error importing state module during cleanup:', error);
            });
        } catch (error) {
            console.error('Error during Asset Debugger cleanup:', error);
        }
    }, 0);
    
    // Return immediately to allow navigation to proceed
    return null;
}

/**
 * Load all component HTML files dynamically and initialize components
 */
function loadComponentHtml() {
    // Create promises for each component load
    const worldPanelPromise = fetch('./panels/world-panel/world-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('world-tab-container').innerHTML = html;
            console.log('World Panel HTML loaded, initializing panel...');
            // Always force reset to ensure radio buttons are properly initialized
            initWorldPanel(true);
            componentsLoaded.worldPanel = true;
        })
        .catch(error => {
            console.error('Error loading world panel:', error);
            throw error;
        });

    const assetPanelPromise = fetch('./panels/asset-panel/asset-panel.html')
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

    const settingsModalPromise = fetch('./modals/settings-modal/settings-modal.html')
        .then(response => response.text())
        .then(html => {
            // Use a safer approach to access the container
            let container;
            try {
                container = document.querySelector('settings-modal-container');
            } catch (error) {
                console.warn('Error accessing settings modal container:', error);
                container = null;
            }
            
            if (container) {
                console.log('Settings Modal HTML loaded, initializing modal...');
                container.innerHTML = html;
                
                // Delay the modal initialization to avoid interference
                setTimeout(() => {
                    try {
                        new SettingsModal();
                    } catch (error) {
                        console.error('Error initializing SettingsModal:', error);
                    }
                }, 0);
            } else {
                console.warn('Settings modal container not found, skipping modal initialization');
            }
            componentsLoaded.settingsModal = true;
        })
        .catch(error => {
            console.error('Error loading settings modal:', error);
            componentsLoaded.settingsModal = true;
            throw error;
        });
    
        // Separate promise for axis indicator
        const axisIndicatorPromise = fetch('./axis-indicator/axis-indicator.html')
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
            })
            .catch(error => {
                console.error('Error loading axis indicator:', error);
                // Don't throw here to prevent blocking if axis indicator fails
            });

        const htmlEditorPromise = fetch('./modals/html-editor-modal/html-editor-modal.html')
            .then(response => response.text())
            .then(html => {
                document.getElementById('html-editor-modal-container').innerHTML = html;
                
                const modalElement = document.getElementById('html-editor-modal');
                if (modalElement) {
                    modalElement.style.display = 'none';
                    
                    // Force reset initialization state for SPA
                    import('../modals/html-editor-modal/html-editor-modal.js').then(htmlEditorModule => {
                        if (htmlEditorModule.resetInitialization) {
                            htmlEditorModule.resetInitialization();
                        }
                        initHtmlEditorModal();
                        initModelIntegration();
                        componentsLoaded.htmlEditor = true;
                    });
                } else {
                    throw new Error('Could not extract HTML editor modal element from HTML: modal element not found');
                }
            })

    // Wait for all components to load
    Promise.all([
        worldPanelPromise,
        assetPanelPromise,
        // settingsModalPromise,
        axisIndicatorPromise,
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
            console.debug('All resources loaded...');
            hideLoadingSplash();
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
 * Initialize the 3D scene
 */
function initializeScene() {
    // Get viewport element for scene initialization
    const viewport = document.getElementById('viewport');
    
    // Import and initialize scene
    import('../util/scene/threejs-scene-controller.js')
        .then(sceneModule => {
            console.log('Scene module loaded, initializing scene');
            try {
                // Wait for viewport to be properly sized
                const ensureViewportSize = () => {
                    if (viewport.offsetWidth === 0 || viewport.offsetHeight === 0) {
                        console.log('Viewport not sized yet, waiting...');
                        // Try again after a short delay
                        setTimeout(ensureViewportSize, 50);
                        return;
                    }
                    
                    console.log(`Viewport properly sized: ${viewport.offsetWidth}x${viewport.offsetHeight}`);
                    
                    // Initialize scene - handle case where it doesn't return a Promise
                    const result = sceneModule.initScene(viewport, false);
                    
                    // Start animation loop
                    sceneModule.startAnimation();
                    componentsLoaded.scene = true;
                    resourcesLoaded.sceneInitialized = true;
                    checkAllResourcesLoaded();
                    
                    // Ensure camera controls are ready after a short delay
                    setTimeout(() => {
                        
                        // Import and ensure camera controls are fully initialized
                        import('../util/scene/camera-controller.js')
                            .then(controlsModule => {
                                // Reset controls if we're loading files from landing page
                                if (hasFiles()) {
                                    console.log('Files detected from landing page, ensuring controls are properly initialized');
                                    controlsModule.resetControls && controlsModule.resetControls();
                                }
                                resourcesLoaded.controlsReady = true;
                                checkAllResourcesLoaded();
                            })
                            .catch(error => {
                                console.error('Error ensuring controls are ready:', error);
                                resourcesLoaded.controlsReady = true;
                                checkAllResourcesLoaded();
                            });
                    }, 500);
                };
                
                // Start ensuring viewport size
                ensureViewportSize();
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
/**
 * Main function that handles the debugging process
 */
function startDebugging() {
    console.log('Starting debugging...');
    
    // Load settings from localStorage at the start
    const savedSettings = loadSettings();
    
    // Apply rig options from saved settings if available
    if (savedSettings && savedSettings.rigOptions) {
        import('../util/scene/rig/rig-controller.js').then(rigManagerModule => {
            console.log('Applying saved rig options:', savedSettings.rigOptions);
            rigManagerModule.updateRigOptions(savedSettings.rigOptions);
        });
    }
    
    // Initialize the debugger with the loaded settings
    initializeDebugger(savedSettings);

    // WAIT for scene to be initialized before processing files
    const waitForSceneAndProcessFiles = () => {
        if (!resourcesLoaded.sceneInitialized) {
            console.log('Waiting for scene initialization before processing files...');
            setTimeout(waitForSceneAndProcessFiles, 100);
            return;
        }

        // Now that scene is ready, process files
        processFilesFromState();
    };

    // Start waiting for scene
    waitForSceneAndProcessFiles();
}

/**
 * Process all files from state after scene is initialized
 */
function processFilesFromState() {
    // Skip processing if page is unloading
    if (isPageUnloading) {
        console.log('Page is unloading, skipping file processing');
        
        // Mark all as complete to prevent hanging
        resourcesLoaded.lightingLoaded = true;
        resourcesLoaded.backgroundLoaded = true;
        resourcesLoaded.modelLoaded = true;
        resourcesLoaded.controlsReady = true;
        checkAllResourcesLoaded();
        return;
    }
    
    // Get current state for loading lighting and background
    import('../util/state/scene-state.js')
        .then(stateModule => {
            const currentState = stateModule.getState();
            console.debug('Processing files after scene initialization:', {
                backgroundFile: currentState.backgroundFile ? 
                    `${currentState.backgroundFile.name} (${currentState.backgroundFile.type})` : 'null',
                backgroundTexture: currentState.backgroundTexture ? 'Texture present' : 'null'
            });

            // Initialize resource flags for files
            resourcesLoaded.lightingLoaded = false;
            resourcesLoaded.backgroundLoaded = false;
            resourcesLoaded.modelLoaded = false;

            // Process all files from state in sequence
            let promiseChain = Promise.resolve();

            // Function to check if page is unloading and abort processing if needed
            const checkContinueProcessing = () => {
                if (isPageUnloading) {
                    console.log('Page unloading detected during processing, aborting further operations');
                    throw new Error('Page unloading - processing aborted');
                }
                return true;
            };

            // IMPORTANT: Process lighting first to ensure proper controls creation
            if (stateModule.hasLightingFile() && checkContinueProcessing()) {
                const lightingFile = stateModule.getLightingFile();
                promiseChain = promiseChain.then(() => {
                    console.log('Setting up environment lighting from:', lightingFile.name);
                    return import('../util/scene/lighting-manager.js')
                        .then(lightingModule => {
                            return lightingModule.setupEnvironmentLighting(lightingFile)
                                .then(texture => {
                                    // Log texture details for debugging
                                    console.log('Environment texture loaded:', {
                                        isValid: !!texture,
                                        name: lightingFile.name,
                                        dimensions: texture && texture.image ? 
                                            `${texture.image.width}x${texture.image.height}` : 'unknown'
                                    });
                                    
                                    // Verify texture is set in the scene
                                    const state = stateModule.getState();
                                    if (state && state.scene) {
                                        console.log('Scene environment before update:', !!state.scene.environment);
                                        // Ensure the texture is set as the scene's environment
                                        if (texture && !state.scene.environment) {
                                            state.scene.environment = texture;
                                            console.log('Environment texture manually set to scene');
                                        }
                                        console.log('Scene environment after update:', !!state.scene.environment);
                                    }
                                    
                                    // Update world panel with lighting info
                                    return import('../panels/world-panel/world-panel.js')
                                        .then(worldPanelModule => {
                                            if (worldPanelModule.updateLightingInfo) {
                                                // Create more detailed metadata
                                                const lightingMetadata = {
                                                    fileName: lightingFile.name,
                                                    type: lightingFile.name.split('.').pop().toUpperCase(),
                                                    fileSizeBytes: lightingFile.size,
                                                    // Add texture info if available
                                                    dimensions: texture && texture.image ? {
                                                        width: texture.image.width || 0,
                                                        height: texture.image.height || 0
                                                    } : { width: 0, height: 0 }
                                                };
                                                
                                                // Important: Log the metadata being sent
                                                console.log('Sending lighting metadata to world panel:', lightingMetadata);
                                                
                                                // Call updateLightingInfo with the metadata
                                                worldPanelModule.updateLightingInfo(lightingMetadata);
                                                
                                                // Also ensure the HDR radio option is visible
                                                if (worldPanelModule.toggleOptionVisibility) {
                                                    worldPanelModule.toggleOptionVisibility('hdr-option', true);
                                                    console.log('Explicitly setting HDR radio option visible from asset_debugger');
                                                }
                                            }
                                            return texture;
                                        });
                                });
                        })
                        .then(() => {
                            console.log('Lighting loaded successfully');
                            resourcesLoaded.lightingLoaded = true;
                            checkAllResourcesLoaded();
                        })
                        .catch(error => {
                            console.error('Error setting up lighting:', error);
                            resourcesLoaded.lightingLoaded = true; // Mark as complete even on error
                            checkAllResourcesLoaded();
                        });
                });
            } else {
                console.log('No lighting file to load');
                resourcesLoaded.lightingLoaded = true;
                checkAllResourcesLoaded();
            }

            // Handle background file if it exists
            if (stateModule.hasBackgroundFile() && checkContinueProcessing()) {
                const backgroundFile = stateModule.getBackgroundFile();
                promiseChain = promiseChain.then(() => {
                    console.log('Setting up background from:', backgroundFile.name);
                    return import('../util/scene/background-manager.js')
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
                        })
                        .catch(error => {
                            console.error('Error setting up background:', error);
                            resourcesLoaded.backgroundLoaded = true; // Mark as complete even on error
                            checkAllResourcesLoaded();
                        });
                });
            } else {
                console.log('No background file to load');
                resourcesLoaded.backgroundLoaded = true;
                checkAllResourcesLoaded();
            }

            // Handle model file if it exists
            if (stateModule.hasModelFile() && checkContinueProcessing()) {
                const modelFile = stateModule.getModelFile();
                promiseChain = promiseChain.then(() => {
                    console.log('Loading model from:', modelFile.name);
                    return import('../util/scene/model-handler.js')
                        .then(modelsModule => {
                            return modelsModule.loadDebugModel();
                        })
                        .then(() => {
                            console.log('Model loaded successfully');
                            resourcesLoaded.modelLoaded = true;
                            checkAllResourcesLoaded();
                        })
                        .catch(error => {
                            console.error('Error loading model:', error);
                            resourcesLoaded.modelLoaded = true; // Mark as complete even on error
                            checkAllResourcesLoaded();
                        });
                });
            } else {
                console.log('No model file to load');
                resourcesLoaded.modelLoaded = true;
                checkAllResourcesLoaded();
            }

            // Handle texture files if they exist
            if ((stateModule.hasBaseColorFile() || stateModule.hasOrmFile() || stateModule.hasNormalFile()) && checkContinueProcessing()) {
                promiseChain = promiseChain.then(() => {
                    return import('../landing-page/file-handler.js')
                        .then(fileHandler => {
                            const promises = [];
                            
                            if (stateModule.hasBaseColorFile()) {
                                promises.push(fileHandler.loadTextureFromFile(stateModule.getBaseColorFile(), 'baseColor'));
                            }
                            if (stateModule.hasOrmFile()) {
                                promises.push(fileHandler.loadTextureFromFile(stateModule.getOrmFile(), 'orm'));
                            }
                            if (stateModule.hasNormalFile()) {
                                promises.push(fileHandler.loadTextureFromFile(stateModule.getNormalFile(), 'normal'));
                            }
                            
                            return Promise.all(promises);
                        });
                });
            }

            // Initialize UI panels AFTER all resources are loaded
            promiseChain = promiseChain.then(() => {
                console.log('All resources processed, initializing UI panels...');
                
                // Initialize World Panel
                import('../panels/world-panel/world-panel.js').then(worldPanelModule => {
                    if (worldPanelModule.initWorldPanel) {
                        console.log('Initializing World Panel after resource processing');
                        // Initialize without force reset to prevent hiding radio buttons
                        worldPanelModule.initWorldPanel(false);
                        
                        // Explicitly update the panel to reflect the current state
                        if (worldPanelModule.updateWorldPanel) {
                            console.log('Explicitly updating World Panel to show radio buttons for loaded files');
                            worldPanelModule.updateWorldPanel();
                        }
                        
                        // Double-check lighting file visibility - but don't select it
                        const state = stateModule.getState();
                        if (state.lightingFile && worldPanelModule.toggleOptionVisibility) {
                            console.log('Ensuring HDR radio option is visible for lighting file:', state.lightingFile.name);
                            worldPanelModule.toggleOptionVisibility('hdr-option', true);
                            
                            // If lighting metadata exists, make sure it's applied (without selecting the radio button)
                            if (state.lightingFile && worldPanelModule.updateLightingInfo) {
                                const lightingMetadata = {
                                    fileName: state.lightingFile.name,
                                    type: state.lightingFile.name.split('.').pop().toUpperCase(),
                                    fileSizeBytes: state.lightingFile.size
                                };
                                worldPanelModule.updateLightingInfo(lightingMetadata);
                            }
                            
                            // Ensure "None" is selected as the default
                            const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
                            if (noneRadio) {
                                noneRadio.checked = true;
                                console.log('Setting "None" as the default background option');
                            }
                        }
                    }
                });
                
                // Initialize Asset Panel
                import('../panels/asset-panel/asset-panel.js').then(assetPanelModule => {
                    if (assetPanelModule.initAssetPanel) {
                        console.log('Initializing Asset Panel after resource processing');
                        assetPanelModule.initAssetPanel();
                    }
                });
            });

            // Return the promise chain
            return promiseChain;
        })
        .catch(error => {
            console.error('Error in file processing sequence:', error);
            // Mark all as complete to prevent hanging
            resourcesLoaded.lightingLoaded = true;
            resourcesLoaded.backgroundLoaded = true;
            resourcesLoaded.modelLoaded = true;
            checkAllResourcesLoaded();
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
    import('../util/data/localstorage-manager.js').then(({ loadSettings, saveSettings }) => {
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

/**
 * Ensures collapsible headers work correctly despite SPA routing
 * This directly adds click handlers to all collapsible headers
 */
function ensureCollapsibleHeadersWork() {
    const headers = document.querySelectorAll('.collapsible-header');
    console.log(`Found ${headers.length} collapsible headers to fix after SPA navigation`);
    
    headers.forEach(header => {
        // First, remove existing event listeners by cloning the node
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        // Now add our direct click handler to the new element
        newHeader.addEventListener('click', function(event) {
            // Prevent event bubbling and stop any other handlers
            event.preventDefault();
            event.stopPropagation();
            
            const content = this.nextElementSibling;
            if (!content || !content.classList.contains('metadata-content')) {
                console.log("No valid content section found for header");
                return;
            }
            
            // Get the current actual computed display style
            const currentDisplay = window.getComputedStyle(content).display;
            console.log(`Header clicked: ${this.textContent.trim()}, content display: ${currentDisplay}`);
            
            // Toggle visibility - force block if not already visible
            if (currentDisplay === 'none') {
                // EXPAND the content
                content.style.display = 'block';
                
                // Update indicator
                const indicator = this.querySelector('.collapse-indicator');
                if (indicator) {
                    indicator.textContent = '[-]';
                }
                
                // Log expanded section for debugging
                console.log(`Expanded section: ${this.querySelector('.metadata-header')?.textContent}`);
            } else {
                // COLLAPSE the content
                content.style.display = 'none';
                
                // Update indicator
                const indicator = this.querySelector('.collapse-indicator');
                if (indicator) {
                    indicator.textContent = '[+]';
                }
                
                // Log collapsed section for debugging
                console.log(`Collapsed section: ${this.querySelector('.metadata-header')?.textContent}`);
            }
            
            // Return false to prevent default behavior
            return false;
        }, true);  // Use capture phase to ensure our handler runs first
    });
}
