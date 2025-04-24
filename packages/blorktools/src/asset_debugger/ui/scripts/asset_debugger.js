/**
 * Asset Debugger - UI Entry Point
 * 
 * This file is the main entry point for the Asset Debugger UI.
 * It initializes the application and sets up all necessary components.
 */

// Import the initialization functions
import { init } from '../../main.js';
// Import loadSettings from localstorage-util.js
import { loadSettings } from '../../data/localstorage-util.js';
// Import SettingsModal 
import { SettingsModal } from './settings-modal.js';
import { ExamplesModal } from './examples-modal.js';
// Import World Panel
import { initWorldPanel } from './world-panel.js';

// Debug flags
const DEBUG_LIGHTING = false;

// Track loading state
let loadingComplete = false;
let resourcesLoaded = {
    componentsLoaded: false,
    sceneInitialized: false,
    lightingLoaded: false,
    backgroundLoaded: false,
    modelLoaded: false,
    controlsReady: false
};

// Track mouse follower
let mouseX = 0;
let mouseY = 0;

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
    setupDebuggerEvents();
});

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
                    
                    // Initialize mouse follower effect
                    initMouseFollower();
                }
            })
            .catch(error => {
                console.error('Error loading splash screen:', error);
            });
    } else {
        // If it exists, make sure it's visible
        loadingSplash.style.display = 'flex';
        loadingSplash.classList.remove('fade-out');
        
        // Re-initialize mouse follower
        initMouseFollower();
    }
}

/**
 * Initialize mouse follower effect for the loading screen
 */
function initMouseFollower() {
    const mouseFollower = document.getElementById('mouse-follower');
    const loadingSplash = document.getElementById('loading-splash');
    
    if (mouseFollower && loadingSplash) {
        // Show the mouse follower
        mouseFollower.style.opacity = '1';
        
        // Set initial position
        mouseFollower.style.left = '50%';
        mouseFollower.style.top = '50%';
        
        // Add mouse move event listener to the loading splash
        loadingSplash.addEventListener('mousemove', handleMouseMove);
        
        // Clean up on mouse leave
        loadingSplash.addEventListener('mouseleave', () => {
            mouseFollower.style.opacity = '0';
        });
        
        // Show on mouse enter
        loadingSplash.addEventListener('mouseenter', () => {
            mouseFollower.style.opacity = '1';
        });
    }
}

/**
 * Handle mouse movement for the mouse follower effect
 * @param {MouseEvent} e - The mouse event
 */
function handleMouseMove(e) {
    const mouseFollower = document.getElementById('mouse-follower');
    
    if (mouseFollower) {
        // Get mouse position
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Apply smooth movement using requestAnimationFrame
        requestAnimationFrame(() => {
            mouseFollower.style.left = `${mouseX}px`;
            mouseFollower.style.top = `${mouseY}px`;
            
            // Scale effect based on mouse speed
            const speedFactor = 1.2;
            mouseFollower.style.transform = `translate(-50%, -50%) scale(${speedFactor})`;
        });
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
        // Remove event listeners to prevent memory leaks
        loadingSplash.removeEventListener('mousemove', handleMouseMove);
        
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
}

/**
 * Load all component HTML files dynamically
 */
function loadComponentHtml() {
    // Track loading of components
    let componentsToLoad = 7; // Total components to load
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
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading world panel:', error);
            componentLoaded();
        });
    
    // Load Atlas Panel
    fetch('../pages/atlas-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('atlas-tab-container').innerHTML = html;
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading atlas panel:', error);
            componentLoaded();
        });
        
    // Load Mesh Panel
    fetch('../pages/mesh-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('mesh-tab-container').innerHTML = html;
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading mesh panel:', error);
            componentLoaded();
        });
        
    // Load UV Panel
    fetch('../pages/uv-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('uv-tab-container').innerHTML = html;
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading UV panel:', error);
            componentLoaded();
        });
        
    // Load Rig Panel
    fetch('../pages/rig-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('rig-tab-container').innerHTML = html;
            componentLoaded();
        })
        .catch(error => {
            console.error('Error loading rig panel:', error);
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
}

/**
 * Set up event listeners for the Start Debug and Restart buttons
 */
function setupDebuggerEvents() {
    // Initialize 3D scene when Start Debugging is clicked
    const startDebugBtn = document.getElementById('start-debug');
    const restartDebugBtn = document.getElementById('restart-debug');
    const viewport = document.getElementById('viewport');
    const tabContainer = document.getElementById('tab-container');
    
    if (startDebugBtn) {
        startDebugBtn.addEventListener('click', verifyFileDrop);
    }
    
    if (restartDebugBtn) {
        restartDebugBtn.addEventListener('click', restartDebugging);
    }
}

/**
 * Set up tab navigation system
 */
function setupTabNavigation() {
    console.log('Setting up tab navigation...');
    
    // Get tab buttons
    const worldTabButton = document.getElementById('world-tab-button');
    const meshTabButton = document.getElementById('mesh-tab-button');
    const atlasTabButton = document.getElementById('atlas-tab-button');
    const uvTabButton = document.getElementById('uv-tab-button');
    const rigTabButton = document.getElementById('rig-tab-button');
    
    // Helper function to get the latest references to tab content elements
    function getTabElements() {
        return {
            worldTab: document.getElementById('world-tab-container'),
            worldContent: document.getElementById('world-tab'),
            meshTab: document.getElementById('mesh-tab-container'),
            meshContent: document.getElementById('mesh-tab'),
            atlasTab: document.getElementById('atlas-tab-container'),
            atlasContent: document.getElementById('atlas-tab-container').querySelector('.tab-content-inner'),
            uvTab: document.getElementById('uv-tab-container'),
            uvContent: document.getElementById('uv-tab'),
            rigTab: document.getElementById('rig-tab-container'),
            rigContent: document.getElementById('rig-tab')
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
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.remove('active');
            
            // Hide all tabs first
            hideAllTabs();
            
            // Show world tab content
            const tabs = getTabElements();
            if (tabs.worldTab) tabs.worldTab.classList.add('active');
            if (tabs.worldContent) tabs.worldContent.classList.add('active');
            
            // Initialize World panel if needed
            initWorldPanel();
        });
    }
    
    if (meshTabButton) {
        meshTabButton.addEventListener('click', () => {
            // Update active button
            worldTabButton.classList.remove('active');
            meshTabButton.classList.add('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.remove('active');
            
            // Hide all tabs first
            hideAllTabs();
            
            // Show mesh tab content
            const tabs = getTabElements();
            if (tabs.meshTab) tabs.meshTab.classList.add('active');
            if (tabs.meshContent) tabs.meshContent.classList.add('active');
        });
    }
    
    if (atlasTabButton) {
        atlasTabButton.addEventListener('click', () => {
            // Update active button
            worldTabButton.classList.remove('active');
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.add('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.remove('active');
            
            // Hide all tabs first
            hideAllTabs();
            
            // Show atlas tab content
            const tabs = getTabElements();
            if (tabs.atlasTab) tabs.atlasTab.classList.add('active');
            if (tabs.atlasContent) tabs.atlasContent.classList.add('active');
            
            // Update atlas visualization without recreating everything
            import('./atlas-panel.js').then(module => {
                if (module.updateAtlasVisualization) {
                    module.updateAtlasVisualization();
                }
            });
        });
    }
    
    if (uvTabButton) {
        uvTabButton.addEventListener('click', () => {
            // Update active button
            worldTabButton.classList.remove('active');
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.add('active');
            rigTabButton.classList.remove('active');
            
            // Hide all tabs first
            hideAllTabs();
            
            // Show UV tab content
            const tabs = getTabElements();
            if (tabs.uvTab) tabs.uvTab.classList.add('active');
            if (tabs.uvContent) tabs.uvContent.classList.add('active');
            
            // Update UV panel without recreating everything
            import('./uv-panel.js').then(module => {
                if (module.updateUvPanel) {
                    module.updateUvPanel();
                }
            });
        });
    }
    
    if (rigTabButton) {
        rigTabButton.addEventListener('click', () => {
            // Update active button
            worldTabButton.classList.remove('active');
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.add('active');
            
            // Hide all tabs first
            hideAllTabs();
            
            // Show rig tab content
            const tabs = getTabElements();
            if (tabs.rigTab) tabs.rigTab.classList.add('active');
            if (tabs.rigContent) tabs.rigContent.classList.add('active');
            
            // Update rig panel if needed
            import('./rig-panel.js').then(module => {
                // Only update the panel if it hasn't been initialized yet
                if (document.getElementById('rig-content') && 
                    document.getElementById('rig-content').children.length === 0) {
                    if (module.updateRigPanel) {
                        module.updateRigPanel();
                    }
                }
            });
        });
    }
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
        
        // Update hasFiles check to include the special lighting-only case
        const hasFiles = hasTextures || hasModel || hasLightingFile || hasBackgroundFile;
        
        // If only lighting file is provided, set a flag in state to use multi-material test cube
        if (onlyLightingProvided) {
            stateModule.setState({
                useLightingTestCube: true
            });
        }
        
        // If no files were dropped, show examples modal
        if (!hasFiles) {
            // Load settings for use with examples
            const savedSettings = loadSettings();
            
            // Initialize the examples modal with initializeDebugger as the callback
            // This bypasses startDebugging to avoid circular reference
            const examplesModal = new ExamplesModal(() => {
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
                    let lightingPromise = Promise.resolve();
                    let backgroundPromise = Promise.resolve();
                    
                    if (lightingFile && 
                        (lightingFile.name.toLowerCase().endsWith('.hdr') || 
                         lightingFile.name.toLowerCase().endsWith('.exr'))) {
                        
                        console.log('Setting up environment lighting from:', lightingFile.name);
                        
                        // Import lighting utilities
                        lightingPromise = import('../../core/lighting-util.js')
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
                                                return lightingModule.setupEnvironmentLighting(lightingFile);
                                            });
                                    })
                                    .catch(error => {
                                        console.error('Error analyzing environment map:', error);
                                        return Promise.resolve(); // Continue chain
                                    });
                            });
                    }
                    
                    if (backgroundFile) {
                        console.log('[DEBUG] Setting up background image from:', backgroundFile.name, 'type:', backgroundFile.type);
                        
                        // Import background image utilities (this would need to be implemented)
                        backgroundPromise = import('../../core/background-util.js')
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
                            });
                    } else {
                        console.log('[DEBUG] No background file found in state');
                    }
                    
                    // Return a promise that resolves when both operations are complete
                    return Promise.all([lightingPromise, backgroundPromise]);
                })
                .then(() => {
                    resourcesLoaded.lightingLoaded = true;
                    resourcesLoaded.backgroundLoaded = true;
                    checkAllResourcesLoaded();
                    
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

/**
 * Initialize the debugger with the given settings
 * @param {Object} settings - The application settings
 */
function initializeDebugger(settings) {
    // HTML UI handling code - hide upload section, show restart button
    const uploadSection = document.getElementById('upload-section');
    const restartContainer = document.getElementById('debug-button-container');
    if (uploadSection) {
        uploadSection.style.display = 'none';
    }
    if (restartContainer) {
        restartContainer.style.display = 'flex';
    }
    
    // Get elements
    const viewport = document.getElementById('viewport');
    const tabContainer = document.getElementById('tab-container');
    
    // Show viewport and tab container
    if (viewport) {
        viewport.style.display = 'block';
    }
    
    if (tabContainer) {
        tabContainer.style.display = 'flex';
    }
    
    // Set up tab navigation
    setupTabNavigation();
    
    // Initialize the World panel first (it's the default active tab)
    initWorldPanel();
    
    // Make sure only the World tab is active
    activateWorldTab();
    
    // Initialize settings modal with loaded settings
    new SettingsModal(settings);
    
    // Scene initialization is now handled in startDebugging function
    // to ensure proper sequencing of operations
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
            meshTab: document.getElementById('mesh-tab-container'),
            meshContent: document.getElementById('mesh-tab'),
            atlasTab: document.getElementById('atlas-tab-container'),
            atlasContent: document.getElementById('atlas-tab-container').querySelector('.tab-content-inner'),
            uvTab: document.getElementById('uv-tab-container'),
            uvContent: document.getElementById('uv-tab'),
            rigTab: document.getElementById('rig-tab-container'),
            rigContent: document.getElementById('rig-tab')
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
    const meshTabButton = document.getElementById('mesh-tab-button');
    const atlasTabButton = document.getElementById('atlas-tab-button');
    const uvTabButton = document.getElementById('uv-tab-button');
    const rigTabButton = document.getElementById('rig-tab-button');
    
    if (worldTabButton) worldTabButton.classList.add('active');
    if (meshTabButton) meshTabButton.classList.remove('active');
    if (atlasTabButton) atlasTabButton.classList.remove('active');
    if (uvTabButton) uvTabButton.classList.remove('active');
    if (rigTabButton) rigTabButton.classList.remove('active');
}

// Export for external use
export default { init }; 