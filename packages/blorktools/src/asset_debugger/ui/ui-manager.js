/**
 * Texture Debugger - UI Manager Module
 * 
 * This module handles tab switching and general UI functions.
 */
import { getState } from '../core/state.js';
import { updateAtlasVisualization } from './atlas-panel.js';
import { updateUvPanel } from './uv-panel.js';
import { updateRigVisualization } from './rig-panel.js';

// Tab elements
let meshTabButton = null;
let atlasTabButton = null;
let uvTabButton = null;
let rigTabButton = null;
let meshTab = null;
let atlasTab = null;
let uvTab = null;
let rigTab = null;

/**
 * Initialize the UI manager
 */
export function initUiManager() {
    // Prevent default drag-and-drop behavior for the entire document
    preventDefaultDragBehavior();

    // Cache tab elements
    meshTabButton = document.getElementById('mesh-tab-button');
    atlasTabButton = document.getElementById('atlas-tab-button');
    uvTabButton = document.getElementById('uv-tab-button');
    rigTabButton = document.getElementById('rig-tab-button');
    meshTab = document.getElementById('mesh-tab');
    atlasTab = document.getElementById('atlas-tab');
    uvTab = document.getElementById('uv-tab');
    rigTab = document.getElementById('rig-tab');
    
    // Set up tab switching
    setupTabs();
    
    // Set up start/restart buttons
    setupButtons();
}

/**
 * Prevent default drag-and-drop behavior for the entire document
 */
function preventDefaultDragBehavior() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => {
            if (e.target !== document.getElementById('basecolor-dropzone') &&
                e.target !== document.getElementById('orm-dropzone') &&
                e.target !== document.getElementById('normal-dropzone') &&
                e.target !== document.getElementById('model-dropzone')) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, false);
    });
}

/**
 * Setup tab switching
 */
function setupTabs() {
    if (!meshTabButton || !atlasTabButton || !uvTabButton || !rigTabButton || 
        !meshTab || !atlasTab || !uvTab || !rigTab) return;
    
    // Create a function to handle tab activation
    const activateTab = (tabButton, tabContent) => {
        // Deactivate all tabs
        [meshTabButton, atlasTabButton, uvTabButton, rigTabButton].forEach(btn => {
            btn.classList.remove('active');
        });
        [meshTab, atlasTab, uvTab, rigTab].forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Activate the selected tab
        tabButton.classList.add('active');
        tabContent.classList.add('active');
    };
    
    // Tab button click handlers
    meshTabButton.addEventListener('click', () => {
        activateTab(meshTabButton, meshTab);
    });
    
    atlasTabButton.addEventListener('click', () => {
        activateTab(atlasTabButton, atlasTab);
        updateAtlasVisualization();
    });
    
    uvTabButton.addEventListener('click', () => {
        activateTab(uvTabButton, uvTab);
        updateUvPanel();
    });
    
    rigTabButton.addEventListener('click', () => {
        activateTab(rigTabButton, rigTab);
        updateRigVisualization();
    });
}

/**
 * Set up start and restart buttons
 */
function setupButtons() {
    const startButton = document.getElementById('start-debug');
    const restartButton = document.getElementById('restart-debug');
    
    if (startButton) {
        startButton.addEventListener('click', handleStartDebugClick);
    }
    
    if (restartButton) {
        restartButton.addEventListener('click', handleRestartClick);
    }
}

/**
 * Handle start debug button click
 */
function handleStartDebugClick() {
    const state = getState();
    
    // Import modules dynamically to avoid circular dependencies
    import('../core/scene.js').then(({ initScene, startAnimation }) => {
        import('../core/models.js').then(({ createCube, loadAndSetupModel }) => {
            // Get viewport and loading indicator
            const viewport = document.getElementById('viewport');
            const tabContainer = document.getElementById('tab-container');
            const loadingIndicator = document.getElementById('loading-indicator');
            
            // Show viewport and tab container
            if (viewport) viewport.style.display = 'block';
            if (tabContainer) tabContainer.style.display = 'flex';
            
            if (!state.isDebugStarted) {
                // First time starting
                // Initialize scene
                if (viewport) {
                    initScene(viewport);
                    
                    // Create model or cube
                    if (state.useCustomModel && state.modelFile) {
                        loadAndSetupModel(loadingIndicator);
                    } else {
                        createCube();
                    }
                    
                    // Start animation
                    startAnimation();
                    
                    // Update button text
                    const startButton = document.getElementById('start-debug');
                    if (startButton) startButton.textContent = 'Restart';
                    
                    // Set debug started flag
                    state.isDebugStarted = true;
                }
            } else {
                // Subsequent starts (restart)
                // Clean up previous scene
                import('../core/scene.js').then(({ stopAnimation, clearScene }) => {
                    stopAnimation();
                    clearScene();
                    
                    // Initialize new scene
                    if (viewport) {
                        initScene(viewport);
                        
                        // Create model or cube
                        if (state.useCustomModel && state.modelFile) {
                            loadAndSetupModel(loadingIndicator);
                        } else {
                            createCube();
                        }
                        
                        // Start animation
                        startAnimation();
                    }
                });
            }
        });
    });
}

/**
 * Handle restart button click
 */
function handleRestartClick() {
    // Reload the entire page to completely restart the tool
    window.location.reload();
}

/**
 * Show/hide the loading indicator
 * @param {boolean} show - Whether to show or hide the indicator
 */
export function toggleLoadingIndicator(show) {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }
}

export default {
    initUiManager,
    toggleLoadingIndicator
}; 