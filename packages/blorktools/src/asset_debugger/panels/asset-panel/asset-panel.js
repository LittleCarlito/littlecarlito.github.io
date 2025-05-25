/**
 * Asset Debugger - Asset Panel Module
 * 
 * This module handles sample sections and their collapsible functionality.
 */
import { getState } from '../../state';
import { createMeshVisibilityPanel } from '../mesh-panel/mesh-panel';
import { initAtlasPanel, updateAtlasVisualization } from '../atlas-panel/atlas-panel';
import { initUvPanel, updateUvPanel } from '../uv-panel/uv-panel.js';
import { updateRigPanel } from '../rig-panel/rig-panel';

// Track initialization state
let controlsInitialized = false;
let atlasInitialized = false;
let uvInitialized = false;
let rigInitialized = false;

/**
 * Initialize the Asset panel and cache DOM elements
 */
export function initAssetPanel() {
    // Only initialize if not already done
    if (controlsInitialized) {
        console.log('Asset Panel already initialized, skipping');
        return;
    }
    
    console.log('[DEBUG] Initializing Asset Panel...');
    
    // Look for asset-tab or asset-tab-container
    const assetPanel = document.getElementById('asset-tab') || document.getElementById('asset-tab-container');
    
    if (!assetPanel) {
        console.error('Asset panel elements not found. Panel may not be loaded in DOM yet.');
        return;
    }
    
    console.log('[DEBUG] Asset panel found, initializing...');
    
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
                    
                    // Initialize panel content based on which section is expanded
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
    
    // Mark as initialized
    controlsInitialized = true;
}