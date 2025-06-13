/**
 * Asset Debugger - Asset Panel Module
 * 
 * This module handles sample sections and their collapsible functionality.
 */
import { getState } from '../../util/state/scene-state';
import { createMeshVisibilityPanel } from './mesh-heading/mesh-heading';
import { initAtlasPanel, updateAtlasVisualization } from './atlas-heading/atlas-heading';
import { initUvPanel, updateUvPanel } from './uv-heading/uv-heading.js';
import { updateRigPanel } from './rig-heading/rig-heading';
import { downloadUpdatedGlb } from '../../util/scene/glb-controller.js';

// Track initialization state
let controlsInitialized = false;
let atlasInitialized = false;
let uvInitialized = false;
let rigInitialized = false;
let downloadButtonInitialized = false;

/**
 * Initialize the Asset panel and cache DOM elements
 */
export function initAssetPanel() {
    if (controlsInitialized) {
        console.log('Asset Panel already initialized, skipping');
        return;
    }
    
    console.debug('Initializing Asset Panel...');
    
    const assetPanel = document.getElementById('asset-tab') || document.getElementById('asset-tab-container');
    
    if (!assetPanel) {
        console.error('Asset panel elements not found. Panel may not be loaded in DOM yet.');
        return;
    }
    
    console.debug('Asset panel found, initializing...');
    
    // Initialize collapsible functionality
    const collapsibleHeaders = document.querySelectorAll('.asset-section .collapsible-header');
    if (collapsibleHeaders) {
        collapsibleHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const indicator = this.querySelector('.collapse-indicator');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    indicator.textContent = '[-]';
                    
                    const headerText = this.querySelector('.metadata-header').textContent;
                    
                    if (headerText === 'Mesh') {
                        createMeshVisibilityPanel();
                    } 
                    else if (headerText === 'Atlas') {
                        if (!atlasInitialized) {
                            initAtlasPanel();
                            atlasInitialized = true;
                        } else {
                            updateAtlasVisualization();
                        }
                    }
                    else if (headerText === 'UV') {
                        if (!uvInitialized) {
                            initUvPanel();
                            uvInitialized = true;
                        } else {
                            updateUvPanel();
                        }
                    }
                    else if (headerText === 'Rig') {
                        if (!rigInitialized) {
                            updateRigPanel();
                            rigInitialized = true;
                        } else {
                            updateRigPanel();
                        }
                    }
                } else {
                    content.style.display = 'none';
                    indicator.textContent = '[+]';
                }
            });
        });
    }
    
    // Initialize the download button (now always visible)
    initDownloadButton();
    
    // Set up a listener for state changes to update button visibility
    // This could be enhanced with a proper state change listener system
    const originalUpdateState = window.updateState;
    if (originalUpdateState) {
        window.updateState = function(...args) {
            const result = originalUpdateState.apply(this, args);
            // Check if modelFile was updated
            if (args[0] === 'modelFile' || (typeof args[0] === 'object' && 'modelFile' in args[0])) {
                setTimeout(updateDownloadButtonVisibility, 0); // Async to ensure state is updated
            }
            return result;
        };
    }
    
    controlsInitialized = true;
}

/**
 * Initialize the download button
 */
function initDownloadButton() {
    const downloadBtn = document.getElementById('download-asset-btn');
    if (!downloadBtn) {
        console.error('Download button not found');
        return;
    }
    
    if (downloadButtonInitialized) {
        console.log('Download button already initialized, skipping');
        return;
    }
    
    downloadBtn.addEventListener('click', async () => {
        try {
            await downloadUpdatedGlb();
        } catch (error) {
            console.error('Error downloading GLB:', error);
            alert('Error downloading GLB: ' + error.message);
        }
    });
    
    downloadButtonInitialized = true;
    console.log('Download button event listener initialized successfully');
    
    // Update button visibility based on current state
    updateDownloadButtonVisibility();
}

/**
 * Update download button visibility based on whether there's a model loaded
 */
function updateDownloadButtonVisibility() {
    const downloadSection = document.querySelector('.asset-download-section');
    const state = getState();
    
    if (!downloadSection) return;
    
    // Show button only if there's a model file loaded
    const hasModel = state.modelFile !== null;
    downloadSection.style.display = hasModel ? 'block' : 'none';
    
    console.log(`Download button ${hasModel ? 'shown' : 'hidden'} - hasModel: ${hasModel}`);
}

/**
 * Public function to update download button visibility (called from other modules)
 */
export function refreshDownloadButtonVisibility() {
    updateDownloadButtonVisibility();
}