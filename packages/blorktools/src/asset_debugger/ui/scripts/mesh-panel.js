/**
 * Texture Debugger - Mesh Panel Module
 * 
 * This module handles mesh visibility panel UI and interaction.
 */
import { getState, updateState } from '../../core/state.js';

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
            
            // Assemble mesh item
            meshDiv.appendChild(meshToggle);
            meshDiv.appendChild(meshNameSpan);
            
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