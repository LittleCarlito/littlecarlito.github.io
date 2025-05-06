/**
 * Texture Debugger - Mesh Panel Module
 * 
 * This module handles mesh visibility panel UI and interaction.
 */
import { getState, updateState } from '../../core/state.js';
import { getCurrentGlbBuffer } from './model-integration.js';
import { getBinaryBufferForMesh } from '../../core/glb-utils.js';

// Track meshes with HTML content
const meshesWithHtml = new Set();

/**
 * Check if a mesh has HTML content
 * @param {number} meshIndex - The index of the mesh to check
 * @returns {Promise<boolean>} Promise that resolves to true if the mesh has HTML content
 */
async function checkMeshHasHtmlContent(meshIndex) {
    // First check our cache
    if (meshesWithHtml.has(meshIndex)) {
        return true;
    }
    
    // Get the current GLB buffer
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        return false;
    }
    
    try {
        // Try to get binary buffer for this mesh
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshIndex);
        
        // If buffer found, mesh has HTML
        if (binaryBuffer) {
            // Cache the result
            meshesWithHtml.add(meshIndex);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking if mesh has HTML:', error);
        return false;
    }
}

/**
 * Create the mesh visibility panel in the UI
 */
export function createMeshVisibilityPanel() {
    // Organize meshes into groups based on name prefixes
    groupMeshesByName();
    
    // Get the container element
    const meshGroupsContainer = document.getElementById('mesh-groups');
    if (!meshGroupsContainer) return;
    
    // Clear previous content
    meshGroupsContainer.innerHTML = '';
    
    const state = getState();
    
    // Create elements for each mesh group
    for (const groupName in state.meshGroups) {
        const groupMeshes = state.meshGroups[groupName];
        
        // Create group container
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mesh-group';
        
        // Create group header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'mesh-group-header';
        headerDiv.style.display = 'flex';
        headerDiv.style.alignItems = 'center';
        headerDiv.style.justifyContent = 'space-between';
        headerDiv.style.width = '100%';
        headerDiv.style.cursor = 'pointer'; // Make the header appear clickable
        
        // Create left part of header (checkbox + name + count)
        const headerLeftDiv = document.createElement('div');
        headerLeftDiv.style.display = 'flex';
        headerLeftDiv.style.alignItems = 'center';
        
        // Create group toggle checkbox
        const groupToggle = document.createElement('input');
        groupToggle.type = 'checkbox';
        groupToggle.className = 'mesh-group-toggle';
        groupToggle.checked = true;
        groupToggle.dataset.group = groupName;
        
        // Add event listener for group toggle
        groupToggle.addEventListener('change', (e) => {
            const isVisible = e.target.checked;
            toggleMeshGroupVisibility(groupName, isVisible);
            
            // Update individual mesh checkboxes
            const meshToggles = groupDiv.querySelectorAll('.mesh-toggle');
            meshToggles.forEach(toggle => {
                toggle.checked = isVisible;
            });
        });
        
        // Prevent checkbox click from triggering the header click
        groupToggle.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Create group name element
        const groupNameSpan = document.createElement('span');
        groupNameSpan.className = 'mesh-group-name';
        groupNameSpan.textContent = groupName + ' ';
        
        // Create group count element and put it right after the name
        const groupCountSpan = document.createElement('span');
        groupCountSpan.className = 'mesh-group-count';
        groupCountSpan.textContent = `(${groupMeshes.length})`;
        
        // Create collapse/expand button
        const collapseBtn = document.createElement('span');
        collapseBtn.className = 'mesh-group-collapse';
        collapseBtn.textContent = '+';  // Start with + (collapsed)
        collapseBtn.style.cursor = 'pointer';
        collapseBtn.style.marginLeft = 'auto'; // Push to right side
        
        // Function to toggle collapse/expand state
        const toggleCollapse = () => {
            const meshItemsDiv = groupDiv.querySelector('.mesh-items');
            const isCollapsed = meshItemsDiv.style.display === 'none';
            
            // Toggle visibility
            meshItemsDiv.style.display = isCollapsed ? 'block' : 'none';
            
            // Update icon
            collapseBtn.textContent = isCollapsed ? '-' : '+';
        };
        
        // Add event listener for collapse/expand to the entire header
        headerDiv.addEventListener('click', toggleCollapse);
        
        // Add event listener for collapse/expand to the button
        collapseBtn.addEventListener('click', (e) => {
            // Prevent the event from bubbling to the header
            e.stopPropagation();
            toggleCollapse();
        });
        
        // Assemble header left part
        headerLeftDiv.appendChild(groupToggle);
        headerLeftDiv.appendChild(groupNameSpan);
        headerLeftDiv.appendChild(groupCountSpan);
        
        // Assemble header
        headerDiv.appendChild(headerLeftDiv);
        headerDiv.appendChild(collapseBtn);
        
        // Create container for mesh items
        const meshItemsDiv = document.createElement('div');
        meshItemsDiv.className = 'mesh-items';
        // Start collapsed
        meshItemsDiv.style.display = 'none';
        
        // Create elements for each mesh in the group
        groupMeshes.forEach(mesh => {
            const meshDiv = document.createElement('div');
            meshDiv.className = 'mesh-item';
            meshDiv.style.display = 'flex';
            meshDiv.style.alignItems = 'center';
            
            // Create mesh toggle checkbox
            const meshToggle = document.createElement('input');
            meshToggle.type = 'checkbox';
            meshToggle.className = 'mesh-toggle';
            meshToggle.checked = mesh.visible;
            meshToggle.dataset.meshIndex = state.meshes.indexOf(mesh);
            
            // Add event listener for mesh toggle
            meshToggle.addEventListener('change', (e) => {
                const isVisible = e.target.checked;
                const meshIndex = parseInt(e.target.dataset.meshIndex);
                
                if (!isNaN(meshIndex) && meshIndex >= 0 && meshIndex < state.meshes.length) {
                    state.meshes[meshIndex].visible = isVisible;
                    
                    // Update group checkbox if needed
                    updateGroupToggleState(groupName);
                }
            });
            
            // Create mesh name element
            const meshNameSpan = document.createElement('span');
            meshNameSpan.className = 'mesh-name';
            meshNameSpan.textContent = getMeshDisplayName(mesh);
            meshNameSpan.title = mesh.name || "Unnamed mesh";
            meshNameSpan.style.flexGrow = '1';
            
            // Create HTML editor icon
            const htmlEditorIcon = document.createElement('span');
            htmlEditorIcon.className = 'mesh-html-editor-icon';
            htmlEditorIcon.title = 'Edit HTML';
            htmlEditorIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                    <path d="M234.8 511.7L196 500.4c-4.2-1.2-6.7-5.7-5.5-9.9L331.3 5.8c1.2-4.2 5.7-6.7 9.9-5.5L380 11.6c4.2 1.2 6.7 5.7 5.5 9.9L244.7 506.2c-1.2 4.3-5.6 6.7-9.9 5.5zm-83.2-121.1l27.2-29c3.1-3.3 2.8-8.5-.5-11.5L72.2 256l106.1-94.1c3.4-3 3.6-8.2.5-11.5l-27.2-29c-3-3.2-8.1-3.4-11.3-.4L2.5 250.2c-3.4 3.2-3.4 8.5 0 11.7L140.3 391c3.2 3 8.2 2.8 11.3-.4zm284.1.4l137.7-129.1c3.4-3.2 3.4-8.5 0-11.7L435.7 121c-3.2-3-8.3-2.9-11.3.4l-27.2 29c-3.1 3.3-2.8 8.5.5 11.5L503.8 256l-106.1 94.1c-3.4 3-3.6 8.2-.5 11.5l27.2 29c3.1 3.2 8.1 3.4 11.3.4z"/>
                </svg>
            `;
            
            // Add event listener to open HTML editor modal
            htmlEditorIcon.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent propagation to parent elements
                console.log('HTML editor icon clicked');
                
                try {
                    const meshIndex = parseInt(meshToggle.dataset.meshIndex);
                    const meshName = state.meshes[meshIndex].name || 'Unnamed mesh';
                    
                    console.log(`Opening HTML editor for mesh: ${meshName} (index: ${meshIndex})`);
                    
                    // Check if the function exists before calling it
                    if (typeof window.openEmbeddedHtmlEditor === 'function') {
                        // Call the embedded HTML editor modal
                        window.openEmbeddedHtmlEditor(meshName, meshIndex);
                    } else {
                        console.error('HTML Editor function not found. Modal may not be initialized yet.');
                        alert('HTML Editor not ready. Please try again in a moment.');
                    }
                } catch (error) {
                    console.error('Error opening HTML editor modal:', error);
                    alert('Error opening HTML editor. See console for details.');
                }
            });
            
            // Assemble mesh item
            meshDiv.appendChild(meshToggle);
            meshDiv.appendChild(meshNameSpan);
            meshDiv.appendChild(htmlEditorIcon);
            
            // Add to mesh items container
            meshItemsDiv.appendChild(meshDiv);
        });
        
        // Assemble group
        groupDiv.appendChild(headerDiv);
        groupDiv.appendChild(meshItemsDiv);
        
        // Add to groups container
        meshGroupsContainer.appendChild(groupDiv);
    }
}

/**
 * Group meshes by name prefix
 */
function groupMeshesByName() {
    const state = getState();
    const meshGroups = {};
    
    state.meshes.forEach(mesh => {
        const groupName = getGroupName(mesh);
        
        if (!meshGroups[groupName]) {
            meshGroups[groupName] = [];
        }
        
        meshGroups[groupName].push(mesh);
    });
    
    updateState('meshGroups', meshGroups);
}

/**
 * Get group name from mesh based on naming pattern
 * @param {THREE.Mesh} mesh - The mesh to get group name for
 * @returns {string} Group name for the mesh
 */
function getGroupName(mesh) {
    const name = mesh.name || 'Unnamed';
    
    // Common patterns to detect groups by prefixes
    // Example patterns: "Body_part", "Head_1", "Head_2" etc.
    const patterns = [
        /^([^_]+)_.*$/,  // Anything before first underscore
        /^([^.]+)\..*$/, // Anything before first period
        /^([^0-9]+).*$/  // Anything before first number
    ];
    
    for (const pattern of patterns) {
        const match = name.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // If no pattern matches or no name, use default group
    if (name === 'Unnamed' || name === 'Cube') {
        return 'Default';
    }
    
    // If nothing matches, use first 4 characters as group
    return name.substring(0, 4);
}

/**
 * Get display name for a mesh
 * @param {THREE.Mesh} mesh - The mesh to get display name for
 * @returns {string} Display name for the mesh
 */
function getMeshDisplayName(mesh) {
    return mesh.name || "Unnamed mesh";
}

/**
 * Toggle visibility of all meshes in a group
 * @param {string} groupName - The name of the group to toggle
 * @param {boolean} isVisible - Whether the meshes should be visible
 */
export function toggleMeshGroupVisibility(groupName, isVisible) {
    const state = getState();
    if (state.meshGroups[groupName]) {
        state.meshGroups[groupName].forEach(mesh => {
            mesh.visible = isVisible;
        });
    }
}

/**
 * Update group toggle state based on individual mesh visibility
 * @param {string} groupName - The name of the group to update
 */
export function updateGroupToggleState(groupName) {
    const groupToggle = document.querySelector(`.mesh-group-toggle[data-group="${groupName}"]`);
    const state = getState();
    
    if (!groupToggle || !state.meshGroups[groupName]) return;
    
    // Check if all meshes in the group are visible
    const allVisible = state.meshGroups[groupName].every(mesh => mesh.visible);
    const anyVisible = state.meshGroups[groupName].some(mesh => mesh.visible);
    
    // Set the indeterminate state if some but not all are visible
    if (anyVisible && !allVisible) {
        groupToggle.indeterminate = true;
    } else {
        groupToggle.indeterminate = false;
        groupToggle.checked = allVisible;
    }
}

export default {
    createMeshVisibilityPanel,
    toggleMeshGroupVisibility,
    updateGroupToggleState
}; 