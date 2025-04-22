/**
 * Asset Debugger - World Panel Module
 * 
 * This module handles world properties, environment, and lighting visualization and controls.
 */
import { getState, updateState } from '../../core/state.js';

// Simplified version with only lighting section
let controlsInitialized = false;

/**
 * Initialize the World panel and cache DOM elements
 */
export function initWorldPanel() {
    console.log('Initializing World Panel...');
    
    // Wait for panel elements to be available 
    const checkElements = setInterval(() => {
        // Look for world-tab (from world-panel.html) or world-tab-container (from asset_debugger.html)
        const worldPanel = document.getElementById('world-tab') || document.getElementById('world-tab-container');
        
        if (worldPanel) {
            clearInterval(checkElements);
            console.log('World panel found, initializing...');
            
            // Mark as initialized
            controlsInitialized = true;
        }
    }, 100);
    
    // Set a timeout to stop checking after 10 seconds to prevent infinite checking
    setTimeout(() => {
        clearInterval(checkElements);
        console.warn('Timed out waiting for World panel elements');
    }, 10000);
}

/**
 * Update the World panel with current state
 */
export function updateWorldPanel() {
    // Nothing to update in simplified version
    console.log('World panel update called - No lighting data available');
}

export default {
    initWorldPanel,
    updateWorldPanel
}; 