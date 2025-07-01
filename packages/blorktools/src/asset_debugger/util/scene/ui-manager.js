/**
 * Texture Debugger - UI Manager Module
 * 
 * This module handles the UI interactions and tab switching.
 */
import { getState } from '../state/scene-state.js';
import { updateUvPanel } from '../../panels/asset-panel/uv-heading/uv-heading.js';
import { updateAtlasVisualization } from '../../panels/asset-panel/atlas-heading/atlas-heading.js';

/**
 * Initialize the UI manager and set up event listeners
 */
export function initUiManager() {
    // Set up the tab switching
    setupTabs();
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
}

/**
 * Set up tab switching handlers
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    // Add click event for each tab
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and panels
            tabs.forEach(t => t.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            // Add active class to current tab
            tab.classList.add('active');
            
            // Show the corresponding panel
            const panelId = tab.getAttribute('data-tab');
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('active');
                
                // If switching to atlas tab, update atlas visualization
                if (panelId === 'atlas-heading') {
                    updateAtlasVisualization();
                }
                
                // If switching to UV tab, update UV visualization
                if (panelId === 'uv-heading') {
                    updateUvPanel();
                }
            }
        });
    });
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
                e.target !== document.getElementById('model-dropzone') &&
                e.target !== document.getElementById('lighting-dropzone') &&
                e.target !== document.getElementById('background-dropzone') &&
                e.target !== document.getElementById('upload-section') &&
                !e.target.closest('#upload-section')) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, false);
    });
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Tab switching with number keys
        if (event.key === '1') {
            document.getElementById('atlas-tab')?.click();
        } else if (event.key === '2') {
            document.getElementById('uv-tab')?.click();
        }
    });
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