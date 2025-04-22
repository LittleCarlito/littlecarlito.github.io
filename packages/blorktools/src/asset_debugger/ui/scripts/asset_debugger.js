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
    // Load World Panel (first in the tab order)
    fetch('../pages/world-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('world-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading world panel:', error);
        });
    
    // Load Atlas Panel
    fetch('../pages/atlas-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('atlas-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading atlas panel:', error);
        });
        
    // Load Mesh Panel
    fetch('../pages/mesh-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('mesh-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading mesh panel:', error);
        });
        
    // Load UV Panel
    fetch('../pages/uv-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('uv-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading UV panel:', error);
        });
        
    // Load Rig Panel
    fetch('../pages/rig-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('rig-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading rig panel:', error);
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
                })
                .catch(error => {
                    console.error('Error loading axis indicator settings:', error);
                });
        })
        .catch(error => {
            console.error('Error loading settings modal:', error);
        });
        
    // Load the examples modal component
    fetch('../pages/examples-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('examples-modal-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading examples modal:', error);
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
        const hasFiles = hasTextures || hasModel || hasLightingFile;
        
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
    
    // Load settings from localStorage at the start
    const savedSettings = loadSettings();
    
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
    
    // Sequence the operations properly:
    // 1. Create scene (already done in initializeDebugger)
    // 2. Apply lighting (HDR/EXR if available)
    // 3. Load model
    
    // Create a promise chain to ensure proper sequencing
    Promise.resolve()
        .then(() => {
            // Check for HDR or EXR lighting files
            return import('../../core/state.js')
                .then(stateModule => {
                    const currentState = stateModule.getState();
                    const lightingFile = currentState.lightingFile;
                    
                    if (lightingFile && 
                        (lightingFile.name.toLowerCase().endsWith('.hdr') || 
                         lightingFile.name.toLowerCase().endsWith('.exr'))) {
                        
                        console.log('Setting up environment lighting from:', lightingFile.name);
                        
                        // Import lighting utilities
                        return import('../../core/lighting-util.js')
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
                                    });
                            });
                    } else {
                        // No lighting file, just continue with the chain
                        return Promise.resolve();
                    }
                });
        })
        .then(() => {
            // Now that lighting is set up, load the model
            return import('../../core/models.js')
                .then(modelsModule => {
                    return modelsModule.loadDebugModel();
                });
        })
        .catch(error => {
            console.error('Error in debugging sequence:', error);
        });
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
    
    // Import and initialize the scene
    import('../../core/scene.js').then(sceneModule => {
        console.log('Scene module loaded, initializing scene');
        sceneModule.initScene(viewport);
        sceneModule.startAnimation();
        
        // Note: We do NOT load models here - this will be handled separately
        // in the startDebugging promise chain to ensure lighting is set up first
    });
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