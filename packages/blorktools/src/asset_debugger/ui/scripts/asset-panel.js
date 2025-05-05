/**
 * Asset Debugger - Asset Panel Module
 * 
 * This module handles sample sections and their collapsible functionality.
 */
import { getState } from '../../core/state.js';

// Track initialization state
let controlsInitialized = false;

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
                } else {
                    content.style.display = 'none';
                    indicator.textContent = '[+]';
                }
            });
        });
    }
    
    // Example data for demonstration
    populateSampleData();
    
    // Mark as initialized
    controlsInitialized = true;
}

/**
 * Update a sample section with the provided data
 * @param {number} sampleNumber - The sample number (1-5)
 * @param {Object} data - The sample data object (name, type, size, created)
 */
export function updateSampleInfo(sampleNumber, data) {
    if (!data) return;
    
    // Find elements for this sample
    const nameEl = document.getElementById(`sample${sampleNumber}-name`);
    const typeEl = document.getElementById(`sample${sampleNumber}-type`);
    const sizeEl = document.getElementById(`sample${sampleNumber}-size`);
    const createdEl = document.getElementById(`sample${sampleNumber}-created`);
    
    // Update values if elements exist
    if (nameEl) nameEl.textContent = data.name || '-';
    if (typeEl) typeEl.textContent = data.type || '-';
    if (sizeEl) sizeEl.textContent = data.size || '-';
    if (createdEl) createdEl.textContent = data.created || '-';
    
    // Show data info and hide "no data" message
    toggleSampleMessages(sampleNumber, true);
}

/**
 * Toggle visibility of sample messages for a specific sample
 * @param {number} sampleNumber - The sample number (1-5)
 * @param {boolean} hasData - Whether the sample has data
 */
export function toggleSampleMessages(sampleNumber, hasData) {
    const assetSections = document.querySelectorAll('.asset-section');
    
    if (!assetSections || assetSections.length < sampleNumber) {
        console.warn(`[DEBUG] Sample section ${sampleNumber} not found`);
        return;
    }
    
    const assetSection = assetSections[sampleNumber - 1];
    const noSampleMessage = assetSection.querySelector('.no-sample-message');
    const sampleDataInfo = assetSection.querySelector('.sample-data-info');
    
    if (!noSampleMessage || !sampleDataInfo) {
        console.warn(`[DEBUG] Sample message elements not found for sample ${sampleNumber}`);
        return;
    }
    
    if (hasData) {
        // We have data, show data info and hide the "no data" message
        noSampleMessage.style.display = 'none';
        sampleDataInfo.style.display = 'block';
    } else {
        // No data, show the "no data" message and hide data info
        noSampleMessage.style.display = 'block';
        sampleDataInfo.style.display = 'none';
    }
}

/**
 * Clear all sample data
 */
export function clearSampleData() {
    for (let i = 1; i <= 5; i++) {
        // Reset all values
        const nameEl = document.getElementById(`sample${i}-name`);
        const typeEl = document.getElementById(`sample${i}-type`);
        const sizeEl = document.getElementById(`sample${i}-size`);
        const createdEl = document.getElementById(`sample${i}-created`);
        
        if (nameEl) nameEl.textContent = '-';
        if (typeEl) typeEl.textContent = '-';
        if (sizeEl) sizeEl.textContent = '-';
        if (createdEl) createdEl.textContent = '-';
        
        // Hide data info and show "no data" message
        toggleSampleMessages(i, false);
    }
}

/**
 * Populate sample data with example values
 * This is for demonstration purposes only
 */
function populateSampleData() {
    const sampleData = [
        {
            name: 'Example Asset 1',
            type: 'Texture',
            size: '2.4 MB',
            created: '2023-05-15'
        },
        {
            name: 'Example Asset 2',
            type: 'Model',
            size: '8.7 MB',
            created: '2023-06-22'
        },
        {
            name: 'Example Asset 3',
            type: 'Audio',
            size: '1.2 MB',
            created: '2023-07-10'
        },
        {
            name: 'Example Asset 4',
            type: 'Material',
            size: '0.5 MB',
            created: '2023-08-05'
        },
        {
            name: 'Example Asset 5',
            type: 'Environment',
            size: '15.3 MB',
            created: '2023-09-18'
        }
    ];
    
    // Update UI with sample data
    for (let i = 0; i < sampleData.length; i++) {
        updateSampleInfo(i + 1, sampleData[i]);
    }
} 