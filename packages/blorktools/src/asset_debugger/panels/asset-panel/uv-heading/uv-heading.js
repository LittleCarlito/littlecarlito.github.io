/**
 * Texture Debugger - UV Panel Module
 * 
 * This module handles UV mapping visualization and controls.
 */
import { getState, updateState } from '../../../util/state/scene-state.js';
import { updateUvRegion } from '../atlas-heading/atlas-heading.js';

// DOM elements
let uvInfoContainer = null;
let uvManualControls = null;
let uvOffsetX = null;
let uvOffsetY = null;
let uvScaleW = null;
let uvScaleH = null;
let uvPredefinedSegments = null;
let controlsInitialized = false;
let uvChannelSelectContainer = null;

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
    
    // Identify display/screen meshes
    identifyScreenMeshes();
    
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
    
    // Update or create UV channel selector for display meshes if needed
    updateUvChannelSelector();
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
    
    // Analyze and collect detailed UV mapping info for each channel
    const uvMappingInfo = {};
    availableSets.forEach(uvChannel => {
        const info = {
            mappingType: 'Standard',
            textureUsage: 'Full Texture',
            meshes: [],
            minU: 1, maxU: 0,
            minV: 1, maxV: 0,
            sampleUVs: null,
            sampleMesh: null
        };
        
        // Find all meshes using this UV channel
        state.meshes.forEach(mesh => {
            if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes[uvChannel]) {
                info.meshes.push(mesh);
                
                // Use this as a sample mesh if we don't have one yet
                if (!info.sampleMesh) {
                    info.sampleMesh = mesh;
                    
                    // Calculate UV min/max range
                    const uvAttr = mesh.geometry.attributes[uvChannel];
                    for (let i = 0; i < uvAttr.count; i++) {
                        const u = uvAttr.getX(i);
                        const v = uvAttr.getY(i);
                        info.minU = Math.min(info.minU, u);
                        info.minV = Math.min(info.minV, v);
                        info.maxU = Math.max(info.maxU, u);
                        info.maxV = Math.max(info.maxV, v);
                    }
                }
            }
        });
        
        // Determine mapping type based on UV range
        if (info.minU < 0 || info.maxU > 1 || info.minV < 0 || info.maxV > 1) {
            info.mappingType = 'Extended Range';
        }
        
        // If we have a good sample of UVs, calculate texture usage
        if (info.maxU - info.minU < 0.5 || info.maxV - info.minV < 0.5) {
            info.textureUsage = 'Partial (Atlas Segment)';
        }
        
        uvMappingInfo[uvChannel] = info;
    });
    
    updateState('uvMappingInfo', uvMappingInfo);
}

/**
 * Identify screen/display meshes in the model
 */
function identifyScreenMeshes() {
    const state = getState();
    
    // Return if no meshes
    if (!state.meshes || state.meshes.length === 0) {
        updateState('screenMeshes', []);
        return;
    }
    
    // Find meshes with names that look like displays
    const screenRegex = /display|screen|monitor|lcd|led|panel|tv/i;
    const screenMeshes = state.meshes.filter(mesh => 
        mesh.name && screenRegex.test(mesh.name)
    );
    
    // Update state
    updateState('screenMeshes', screenMeshes);
    
    console.log(`Found ${screenMeshes.length} screen/display meshes:`, 
        screenMeshes.map(m => m.name));
}

/**
 * Update the UV channel selector for display meshes
 */
function updateUvChannelSelector() {
    const state = getState();
    
    // Don't show selector if no display meshes or no UV channels
    if (!state.screenMeshes || state.screenMeshes.length === 0 || 
        !state.availableUvSets || state.availableUvSets.length === 0) {
        if (uvChannelSelectContainer) {
            uvChannelSelectContainer.style.display = 'none';
        }
        return;
    }
    
    // Create container if it doesn't exist
    if (!uvChannelSelectContainer) {
        uvChannelSelectContainer = document.createElement('div');
        uvChannelSelectContainer.id = 'uv-channel-select-container';
        uvChannelSelectContainer.className = 'uv-control-group';
        uvChannelSelectContainer.style.marginBottom = '15px';
        uvChannelSelectContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        uvChannelSelectContainer.style.padding = '10px';
        uvChannelSelectContainer.style.borderRadius = '5px';
        
        const title = document.createElement('label');
        title.textContent = 'Display Mesh UV Channel:';
        title.style.display = 'block';
        title.style.marginBottom = '5px';
        title.style.fontWeight = 'bold';
        title.style.color = '#f1c40f';
        uvChannelSelectContainer.appendChild(title);
        
        const description = document.createElement('div');
        description.textContent = 'Select UV channel for display meshes';
        description.style.fontSize = '11px';
        description.style.color = '#bbb';
        description.style.marginBottom = '10px';
        uvChannelSelectContainer.appendChild(description);
        
        // Create the dropdown
        const select = document.createElement('select');
        select.id = 'display-uv-channel-select';
        select.style.width = '100%';
        select.style.padding = '5px';
        select.style.backgroundColor = '#333';
        select.style.border = '1px solid #555';
        select.style.borderRadius = '3px';
        select.style.color = 'white';
        
        // Add event listener
        select.addEventListener('change', function() {
            switchUvChannelForDisplays(this.value);
        });
        
        uvChannelSelectContainer.appendChild(select);
        
        // Show count of display meshes
        const screenCount = document.createElement('div');
        screenCount.id = 'screen-mesh-count';
        screenCount.style.marginTop = '5px';
        screenCount.style.fontSize = '11px';
        screenCount.style.color = '#3498db';
        uvChannelSelectContainer.appendChild(screenCount);
        
        // Add to UV panel container
        if (uvManualControls && uvManualControls.parentNode) {
            uvManualControls.parentNode.insertBefore(uvChannelSelectContainer, uvManualControls);
        }
    }
    
    // Update dropdown options
    const select = document.getElementById('display-uv-channel-select');
    if (select) {
        // Clear existing options
        select.innerHTML = '';
        
        // Add options for each UV set
        state.availableUvSets.forEach((uvSet, index) => {
            const option = document.createElement('option');
            option.value = uvSet;
            option.textContent = state.uvSetNames[index];
            select.appendChild(option);
        });
        
        // Set default selection to match current UV set
        if (state.currentUvSet !== undefined && state.availableUvSets[state.currentUvSet]) {
            select.value = state.availableUvSets[state.currentUvSet];
        }
    }
    
    // Update screen mesh count
    const screenCount = document.getElementById('screen-mesh-count');
    if (screenCount) {
        screenCount.textContent = `Found ${state.screenMeshes.length} display/screen meshes`;
    }
    
    // Show the container
    uvChannelSelectContainer.style.display = 'block';
}

/**
 * Switch UV channel for all display meshes
 * @param {string} uvChannel - The UV channel to switch to
 */
function switchUvChannelForDisplays(uvChannel) {
    const state = getState();
    
    if (!state.screenMeshes || state.screenMeshes.length === 0) {
        console.warn('No display meshes to update');
        return;
    }
    
    console.log(`Switching ${state.screenMeshes.length} display meshes to UV channel: ${uvChannel}`);
    
    state.screenMeshes.forEach(mesh => {
        // Skip if mesh doesn't have this UV channel
        if (!mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes[uvChannel]) {
            console.warn(`Mesh ${mesh.name} doesn't have UV channel ${uvChannel}`);
            return;
        }
        
        // Get the UV attribute
        const uvAttribute = mesh.geometry.attributes[uvChannel];
        
        // Skip if mesh doesn't have a material
        if (!mesh.material) {
            console.warn(`Mesh ${mesh.name} doesn't have a material`);
            return;
        }
        
        // If mesh has material array, update all materials
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
                if (mat.map) {
                    mat.map.needsUpdate = true;
                }
                mat.needsUpdate = true;
            });
        } else {
            // Update textures
            if (mesh.material.map) {
                mesh.material.map.needsUpdate = true;
            }
            mesh.material.needsUpdate = true;
        }
        
        // Update mesh with new UV channel
        mesh.geometry.setAttribute('uv', uvAttribute);
        mesh.geometry.attributes.uv.needsUpdate = true;
    });
    
    // Register the function for switching UV channels
    if (!state.switchUvChannel) {
        updateState('switchUvChannel', switchUvChannelForDisplays);
    }
    
    // Update UV info
    updateUvInfo();
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
    
    // Add display mesh info if available
    const displayMeshesWithUv = state.screenMeshes.filter(mesh => 
        mesh.geometry && mesh.geometry.attributes && 
        mesh.geometry.attributes[currentSetName]);
        
    if (displayMeshesWithUv.length > 0) {
        content += `<div style="margin-top: 5px; color: #e74c3c;">Display Meshes: <span style="color: white">${displayMeshesWithUv.length}</span></div>`;
    }
    
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
    
    // Clear and populate predefined segments dropdown
    uvPredefinedSegments.innerHTML = '';
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
        
        // Apply mapping to all meshes (or just display meshes if available)
        const targetMeshes = state.screenMeshes.length > 0 ? state.screenMeshes : state.meshes;
        
        targetMeshes.forEach(mesh => {
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
        
        // Update our state function
        if (!state.setCurrentUvRegion) {
            updateState('setCurrentUvRegion', (min, max) => {
                updateUvRegion(min, max);
            });
        }
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
    
    // Initialize values
    uvOffsetX.value = 0;
    uvOffsetY.value = 0;
    uvScaleW.value = 1;
    uvScaleH.value = 1;
    
    // Create atlas segment cycle function
    const state = getState();
    const cycleAtlasSegments = () => {
        // Get the current segment index
        let currentIndex = parseInt(uvPredefinedSegments.value);
        // Move to the next segment
        currentIndex = (currentIndex + 1) % segments.length;
        // Update the dropdown
        uvPredefinedSegments.value = currentIndex;
        // Trigger the change
        const event = new Event('change');
        uvPredefinedSegments.dispatchEvent(event);
    };
    
    // Register the function in the state
    updateState('cycleAtlasSegments', cycleAtlasSegments);
}

export default {
    initUvPanel,
    updateUvPanel
}; 