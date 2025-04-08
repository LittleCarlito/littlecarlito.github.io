/**
 * Texture Debugger - UV Panel Module
 * 
 * This module handles UV mapping visualization and controls.
 */
import { getState, updateState } from '../core/state.js';
import { updateUvRegion } from './atlas-panel.js';

// DOM elements
let uvInfoContainer = null;
let uvManualControls = null;
let uvOffsetX = null;
let uvOffsetY = null;
let uvScaleW = null;
let uvScaleH = null;
let uvPredefinedSegments = null;
let controlsInitialized = false;

/**
 * Initialize the UV panel and cache DOM elements
 */
export function initUvPanel() {
    // Cache DOM elements
    uvInfoContainer = document.getElementById('uv-info-container');
    uvManualControls = document.getElementById('uv-manual-controls');
    uvOffsetX = document.getElementById('uv-offset-x');
    uvOffsetY = document.getElementById('uv-offset-y');
    uvScaleW = document.getElementById('uv-scale-w');
    uvScaleH = document.getElementById('uv-scale-h');
    uvPredefinedSegments = document.getElementById('uv-predefined-segments');
    
    // Initial setup
    updateUvPanel();
}

/**
 * Update the UV panel with current state
 */
export function updateUvPanel() {
    const state = getState();
    
    if (!uvInfoContainer || !uvManualControls) {
        // Cache DOM elements if not already done
        uvInfoContainer = document.getElementById('uv-info-container');
        uvManualControls = document.getElementById('uv-manual-controls');
        uvOffsetX = document.getElementById('uv-offset-x');
        uvOffsetY = document.getElementById('uv-offset-y');
        uvScaleW = document.getElementById('uv-scale-w');
        uvScaleH = document.getElementById('uv-scale-h');
        uvPredefinedSegments = document.getElementById('uv-predefined-segments');
    }
    
    if (!state.model || state.meshes.length === 0) {
        // Hide manual controls and show no data message
        if (uvManualControls) uvManualControls.style.display = 'none';
        if (uvInfoContainer) {
            uvInfoContainer.innerHTML = `
                <p>No model loaded or no UV data available.</p>
                <p>Load a model to view UV information.</p>
            `;
        }
        return;
    }
    
    // Analyze UV sets in the model
    analyzeUvSets();
    
    // If we have UV data, show controls and update info
    if (state.availableUvSets.length > 0) {
        if (uvManualControls) uvManualControls.style.display = 'block';
        updateUvInfo();
        
        // Setup UV manual control handlers if not already done
        if (!controlsInitialized) {
            setupUvControls();
            controlsInitialized = true;
        }
    } else {
        if (uvManualControls) uvManualControls.style.display = 'none';
        if (uvInfoContainer) {
            uvInfoContainer.innerHTML = `
                <p>No UV data found in this model.</p>
                <p>The model doesn't contain any UV mapping information.</p>
            `;
        }
    }
}

/**
 * Analyze UV sets available in the model
 */
function analyzeUvSets() {
    const state = getState();
    const availableUvSets = [];
    const uvSetNames = [];
    
    // Return if no meshes
    if (!state.meshes || state.meshes.length === 0) {
        updateState('availableUvSets', availableUvSets);
        updateState('uvSetNames', uvSetNames);
        return;
    }
    
    // Collect all available UV sets from all meshes
    const uvSets = new Set();
    state.meshes.forEach(mesh => {
        if (mesh.geometry && mesh.geometry.attributes) {
            Object.keys(mesh.geometry.attributes).forEach(key => {
                if (key === 'uv' || key.startsWith('uv')) {
                    uvSets.add(key);
                }
            });
        }
    });
    
    // Convert to array and sort
    const availableSets = Array.from(uvSets);
    availableSets.sort(); // Sort for consistent order
    
    // Create friendly names
    const setNames = availableSets.map(name => {
        if (name === 'uv') return 'UV Channel 0 (Default)';
        if (name === 'uv2') return 'UV Channel 1 (Secondary)';
        // Extract number for other UV channels
        const match = name.match(/uv(\d+)/);
        if (match) {
            return `UV Channel ${match[1]} (Custom)`;
        }
        return name;
    });
    
    // Update state
    updateState('availableUvSets', availableSets);
    updateState('uvSetNames', setNames);
    
    // If we don't have a current set but have available sets, select the first
    if ((state.currentUvSet === undefined || state.currentUvSet >= availableSets.length) && 
        availableSets.length > 0) {
        updateState('currentUvSet', 0);
    }
}

/**
 * Update UV info display
 */
function updateUvInfo() {
    const state = getState();
    
    // Exit if no UV sets or no container
    if (state.availableUvSets.length === 0 || !uvInfoContainer) return;
    
    // Get current UV set
    const currentSetName = state.availableUvSets[state.currentUvSet] || 'uv';
    
    // Build HTML content
    let content = '<div style="color: #f1c40f; font-weight: bold;">UV Channel Info:</div>';
    content += `<div>Channel Name: <span style="color: #3498db">${currentSetName}</span></div>`;
    
    // Get a sample mesh that has this UV set
    const sampleMesh = state.meshes.find(mesh => 
        mesh.geometry && mesh.geometry.attributes && 
        mesh.geometry.attributes[currentSetName]);
        
    if (sampleMesh) {
        // Get UV attribute
        const uvAttr = sampleMesh.geometry.attributes[currentSetName];
        
        // Add sample UV coordinates
        content += '<div style="margin-top: 5px; color: #f1c40f;">Sample UV Coordinates:</div>';
        content += `<div>From: <span style="color: #3498db">${sampleMesh.name || 'Unnamed mesh'}</span></div>`;
        
        // Get a few sample vertices
        const sampleCount = Math.min(5, uvAttr.count);
        let minU = 1, minV = 1, maxU = 0, maxV = 0;
        
        for (let i = 0; i < sampleCount; i++) {
            const u = uvAttr.getX(i);
            const v = uvAttr.getY(i);
            minU = Math.min(minU, u);
            minV = Math.min(minV, v);
            maxU = Math.max(maxU, u);
            maxV = Math.max(maxV, v);
            content += `<div>Vertex ${i}: <span style="color: #3498db">(${u.toFixed(4)}, ${v.toFixed(4)})</span></div>`;
        }
        
        if (uvAttr.count > sampleCount) {
            content += `<div>... and ${uvAttr.count - sampleCount} more vertices</div>`;
        }
        
        // Add UV range
        content += '<div style="margin-top: 5px; color: #f1c40f;">UV Range:</div>';
        content += `<div>U: <span style="color: #3498db">${minU.toFixed(4)} to ${maxU.toFixed(4)}</span></div>`;
        content += `<div>V: <span style="color: #3498db">${minV.toFixed(4)} to ${maxV.toFixed(4)}</span></div>`;
        
        // Add mesh statistics
        const meshesWithUv = state.meshes.filter(mesh => 
            mesh.geometry && mesh.geometry.attributes && 
            mesh.geometry.attributes[currentSetName]);
            
        content += '<div style="margin-top: 5px; color: #f1c40f;">Mesh Statistics:</div>';
        content += `<div>Meshes with this UV: <span style="color: #3498db">${meshesWithUv.length} of ${state.meshes.length}</span></div>`;
    } else {
        content += '<div style="color: #e74c3c;">No meshes use this UV channel</div>';
    }
    
    uvInfoContainer.innerHTML = content;
}

/**
 * Setup UV manual controls
 */
function setupUvControls() {
    if (!uvOffsetX || !uvOffsetY || !uvScaleW || !uvScaleH || !uvPredefinedSegments) return;
    
    // Define common segment options
    const segments = [
        { name: 'Full texture (1×1)', u: 0, v: 0, w: 1, h: 1 },
        { name: 'Top-left quarter (1/2×1/2)', u: 0, v: 0, w: 0.5, h: 0.5 },
        { name: 'Top-right quarter (1/2×1/2)', u: 0.5, v: 0, w: 0.5, h: 0.5 },
        { name: 'Bottom-left quarter (1/2×1/2)', u: 0, v: 0.5, w: 0.5, h: 0.5 },
        { name: 'Bottom-right quarter (1/2×1/2)', u: 0.5, v: 0.5, w: 0.5, h: 0.5 },
        { name: 'Top-left ninth (1/3×1/3)', u: 0, v: 0, w: 0.33, h: 0.33 },
        { name: 'Top-center ninth (1/3×1/3)', u: 0.33, v: 0, w: 0.33, h: 0.33 },
        { name: 'Top-right ninth (1/3×1/3)', u: 0.66, v: 0, w: 0.33, h: 0.33 },
        { name: 'Middle-left ninth (1/3×1/3)', u: 0, v: 0.33, w: 0.33, h: 0.33 }
    ];
    
    // Populate predefined segments dropdown
    segments.forEach((segment, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = segment.name;
        uvPredefinedSegments.appendChild(option);
    });
    
    // Function to apply mapping changes
    const applyMapping = () => {
        // Get values
        const offsetX = parseFloat(uvOffsetX.value) || 0;
        const offsetY = parseFloat(uvOffsetY.value) || 0;
        const scaleW = parseFloat(uvScaleW.value) || 1;
        const scaleH = parseFloat(uvScaleH.value) || 1;
        
        // Check if all values are valid
        if (offsetX < 0 || offsetX > 1 || 
            offsetY < 0 || offsetY > 1 || 
            scaleW <= 0 || scaleW > 1 || 
            scaleH <= 0 || scaleH > 1) {
            return;
        }
        
        const state = getState();
        
        // Apply mapping to all meshes
        state.meshes.forEach(mesh => {
            if (mesh.material) {
                // Apply to all texture maps
                const textureMaps = ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'alphaMap'];
                
                textureMaps.forEach(mapName => {
                    if (mesh.material[mapName]) {
                        mesh.material[mapName].offset.set(offsetX, offsetY);
                        mesh.material[mapName].repeat.set(scaleW, scaleH);
                        mesh.material[mapName].needsUpdate = true;
                    }
                });
                
                mesh.material.needsUpdate = true;
            }
        });
        
        // Update the current UV region for visualization
        updateUvRegion([offsetX, offsetY], [offsetX + scaleW, offsetY + scaleH]);
    };
    
    // Set up event listeners
    uvOffsetX.addEventListener('input', applyMapping);
    uvOffsetY.addEventListener('input', applyMapping);
    uvScaleW.addEventListener('input', applyMapping);
    uvScaleH.addEventListener('input', applyMapping);
    
    // Set up predefined segments
    uvPredefinedSegments.addEventListener('change', function() {
        const selectedSegment = segments[this.value];
        
        // Update input fields
        uvOffsetX.value = selectedSegment.u;
        uvOffsetY.value = selectedSegment.v;
        uvScaleW.value = selectedSegment.w;
        uvScaleH.value = selectedSegment.h;
        
        // Apply the mapping immediately
        applyMapping();
    });
    
    // Initialize with full texture
    uvOffsetX.value = 0;
    uvOffsetY.value = 0;
    uvScaleW.value = 1;
    uvScaleH.value = 1;
}

export default {
    initUvPanel,
    updateUvPanel
}; 