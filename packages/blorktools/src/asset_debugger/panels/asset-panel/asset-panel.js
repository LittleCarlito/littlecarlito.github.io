import { getState } from '../../util/state/scene-state';
import { createMeshVisibilityPanel } from './mesh-heading/mesh-heading';
import { initAtlasPanel, updateAtlasVisualization } from './atlas-heading/atlas-heading';
import { initUvPanel, updateUvPanel } from './uv-heading/uv-heading.js';
import { updateRigPanel } from './rig-heading/rig-heading';
import { downloadUpdatedGlb, onGlbBufferUpdate } from '../../util/scene/glb-controller.js';

let controlsInitialized = false;
let atlasInitialized = false;
let uvInitialized = false;
let rigInitialized = false;
let downloadButtonInitialized = false;

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
    
    initDownloadButton();
    setupBufferListener();
    updateDownloadButtonVisibility();
    
    controlsInitialized = true;
}

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
}

function setupBufferListener() {
    onGlbBufferUpdate(() => {
        updateDownloadButtonVisibility();
    });
    
    window.addEventListener('glb-buffer-changed', () => {
        updateDownloadButtonVisibility();
    });
}

function updateDownloadButtonVisibility() {
    const downloadSection = document.querySelector('.asset-download-section');
    const state = getState();
    
    if (!downloadSection) return;
    
    const hasModel = state.modelFile !== null;
    
    downloadSection.style.display = hasModel ? 'block' : 'none';
    
    console.log(`Download button ${hasModel ? 'shown' : 'hidden'} - hasModel: ${hasModel}`);
}

export function refreshDownloadButtonVisibility() {
    updateDownloadButtonVisibility();
}