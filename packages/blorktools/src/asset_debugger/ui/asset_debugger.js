/**
 * Asset Debugger - UI Entry Point
 * 
 * This file is the main entry point for the Asset Debugger UI.
 * It initializes the application and sets up all necessary components.
 */

// Import the initialization functions
import { init } from '../main.js';
// Import loadSettings from localstorage-util.js
import { loadSettings } from '../data/localstorage-util.js';
// Import SettingsModal 
import { SettingsModal } from './settings-modal.js';
import { ExamplesModal } from './examples-modal.js';

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
    // Load Mesh Panel
    fetch('./mesh-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('mesh-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading mesh panel:', error);
        });
        
    // Load Atlas Panel
    fetch('./atlas-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('atlas-panel-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading atlas panel:', error);
        });
        
    // Load UV Panel
    fetch('./uv-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('uv-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading UV panel:', error);
        });
        
    // Load Rig Panel
    fetch('./rig-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('rig-tab-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading rig panel:', error);
        });
        
    // Load the axis indicator settings component
    fetch('./axis-indicator.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('axis-settings-container').innerHTML = html;
            
            // Make sure the axis settings tab is active if it's currently selected
            const axisTabButton = document.querySelector('.settings-tab-button[data-tab="axis-settings"]');
            if (axisTabButton && axisTabButton.classList.contains('active')) {
                const axisSettings = document.getElementById('axis-settings');
                if (axisSettings) {
                    axisSettings.classList.add('active');
                }
            }
        })
        .catch(error => {
            console.error('Error loading axis indicator settings:', error);
        });
        
    // Load the settings modal component
    fetch('./settings-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('settings-modal-container').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading settings modal:', error);
        });
        
    // Load the examples modal component
    fetch('./examples-modal.html')
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
    
    // Get tab buttons and tab content elements
    const meshTabButton = document.getElementById('mesh-tab-button');
    const atlasTabButton = document.getElementById('atlas-tab-button');
    const uvTabButton = document.getElementById('uv-tab-button');
    const rigTabButton = document.getElementById('rig-tab-button');
    
    const meshTab = document.getElementById('mesh-tab');
    const atlasTab = document.getElementById('atlas-tab');
    const uvTab = document.getElementById('uv-tab');
    const rigTab = document.getElementById('rig-tab');
    
    // Set up click handlers for each tab button
    if (meshTabButton && meshTab) {
        meshTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.add('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.remove('active');
            
            // Update active content
            meshTab.classList.add('active');
            atlasTab.classList.remove('active');
            uvTab.classList.remove('active');
            rigTab.classList.remove('active');
        });
    }
    
    if (atlasTabButton && atlasTab) {
        atlasTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.add('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.remove('active');
            
            // Update active content
            meshTab.classList.remove('active');
            atlasTab.classList.add('active');
            uvTab.classList.remove('active');
            rigTab.classList.remove('active');
            
            // Update atlas visualization without recreating everything
            import('./atlas-panel.js').then(module => {
                if (module.updateAtlasVisualization) {
                    module.updateAtlasVisualization();
                }
            });
        });
    }
    
    if (uvTabButton && uvTab) {
        uvTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.add('active');
            rigTabButton.classList.remove('active');
            
            // Update active content
            meshTab.classList.remove('active');
            atlasTab.classList.remove('active');
            uvTab.classList.add('active');
            rigTab.classList.remove('active');
            
            // Update UV panel without recreating everything
            import('./uv-panel.js').then(module => {
                if (module.updateUvPanel) {
                    module.updateUvPanel();
                }
            });
        });
    }
    
    if (rigTabButton && rigTab) {
        rigTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.add('active');
            
            // Update active content
            meshTab.classList.remove('active');
            atlasTab.classList.remove('active');
            uvTab.classList.remove('active');
            rigTab.classList.add('active');
            
            // We don't need to recreate the rig panel each time, just ensure visualization is up to date
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
    import('../core/state.js').then(stateModule => {
        const currentState = stateModule.getState();
        const hasTextures = currentState.textureObjects.baseColor || 
                          currentState.textureObjects.orm || 
                          currentState.textureObjects.normal;
        const hasModel = currentState.useCustomModel && currentState.modelFile;
        const hasFiles = hasTextures || hasModel;
        
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
        import('../core/rig/rig-manager.js').then(rigManagerModule => {
            console.log('Applying saved rig options:', savedSettings.rigOptions);
            rigManagerModule.updateRigOptions(savedSettings.rigOptions);
        });
    }
    
    // Initialize the debugger with the loaded settings
    initializeDebugger(savedSettings);
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
    
    // Initialize settings modal with loaded settings
    new SettingsModal(settings);
    
    // Import and initialize the scene
    import('../core/scene.js').then(sceneModule => {
        console.log('Scene module loaded');
        sceneModule.initScene(viewport);
        sceneModule.startAnimation();
        
        // Import and initialize the model
        import('../core/models.js').then(modelsModule => {
            modelsModule.loadDebugModel();
        });
    });
}

// Export for external use
export default { init }; 