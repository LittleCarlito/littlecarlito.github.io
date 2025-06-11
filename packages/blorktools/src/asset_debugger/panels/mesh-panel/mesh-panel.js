/**
 * Texture Debugger - Mesh Panel Module
 * 
 * This module handles mesh visibility panel UI and interaction.
 */
import { getState, updateState } from '../../util/state/scene-state.js';
import { getCurrentGlbBuffer, setCurrentGlbBuffer } from '../../util/asset/glb-state-manager.js';
import { deserializeStringFromBinary, isValidHtml } from '../../util/data/string-serder.js';
import { getBinaryBufferForMesh } from '../../util/data/glb-binary-buffer-handler.js';
import { openMeshInfoModal } from '../../modals/mesh-info-modal/mesh-info-modal.js';

// Load mesh panel CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = '/asset_debugger/panels/mesh-panel/mesh-panel.css';
document.head.appendChild(link);

// Track meshes with binary content
const meshesWithHtml = new Set();
// Icon color constants
const ICON_COLORS = {
    HAS_HTML: '#f8d73e', // Yellow color for meshes with binary content (Fallout yellow)
    VALID_HTML: '#4CAF50', // Green color for meshes with valid HTML content
    NO_HTML: '#8a8a8a'   // Default color for meshes without content
};
// Track initialization state
let downloadButtonInitialized = false;
let meshPanelInitialized = false;

/**
 * Toggle the binary content icon appearance for a specific mesh
 * @param {number} meshIndex - The index of the mesh to toggle
 * @param {boolean} hasHtml - Whether the mesh has binary content
 * @param {boolean} forceUpdate - If true, forces the update without rechecking
 * @returns {boolean} Whether the operation was successful
 */
export function toggleMeshCodeIcon(meshIndex, hasHtml, forceUpdate = false) {
    console.log(`Toggling mesh code icon for mesh ${meshIndex} to ${hasHtml ? 'has content' : 'no content'}`);
    
    // Update tracking set
    if (hasHtml) {
        meshesWithHtml.add(meshIndex);
    } else {
        meshesWithHtml.delete(meshIndex);
    }
    
    // If forcing update, temporarily store this state to prevent automatic rechecking
    if (forceUpdate) {
        // Use a data attribute on the document to store forced states temporarily
        if (!window._forcedHtmlStates) {
            window._forcedHtmlStates = {};
        }
        window._forcedHtmlStates[meshIndex] = hasHtml;
        
        // Clear this forced state after a short delay
        setTimeout(() => {
            if (window._forcedHtmlStates) {
                delete window._forcedHtmlStates[meshIndex];
            }
        }, 500);
    }
    
    // Find all icons for this mesh index
    const icons = document.querySelectorAll(`.mesh-html-editor-icon[data-mesh-index="${meshIndex}"]`);
    
    if (icons.length === 0) {
        console.log(`No icons found for mesh index ${meshIndex}, trying broader search`);
        // Try broader search - get all icons and look for the right one
        const allIcons = document.querySelectorAll('.mesh-html-editor-icon');
        
        allIcons.forEach((icon) => {
            const iconMeshIndex = parseInt(icon.dataset.meshIndex);
            if (iconMeshIndex === meshIndex) {
                updateIconAppearance(icon, hasHtml);
            }
        });
    } else {
        // Update all found icons
        icons.forEach(icon => {
            updateIconAppearance(icon, hasHtml);
        });
    }
    
    return true;
}

/**
 * Check if a mesh has binary content
 * @param {number} meshIndex - The index of the mesh to check
 * @returns {Promise<boolean>} Promise that resolves to true if the mesh has any binary content
 */
async function checkMeshHasHtmlContent(meshIndex) {
    // Check if there's a forced state for this mesh
    if (window._forcedHtmlStates && meshIndex in window._forcedHtmlStates) {
        console.log(`Using forced HTML state for mesh ${meshIndex}: ${window._forcedHtmlStates[meshIndex]}`);
        return window._forcedHtmlStates[meshIndex];
    }

    // First check our cache
    if (meshesWithHtml.has(meshIndex)) {
        // Double check that it's still valid by getting the actual content
        const glbBuffer = getCurrentGlbBuffer();
        if (glbBuffer) {
            try {
                const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshIndex);
                // Consider valid if buffer exists and has content
                if (!binaryBuffer || binaryBuffer.byteLength === 0) {
                    // Remove from cache if no longer valid
                    meshesWithHtml.delete(meshIndex);
                    return false;
                }
                return true;
            } catch (e) {
                // Remove from cache if error
                meshesWithHtml.delete(meshIndex);
                return false;
            }
        }
        return true; // Keep the cached value if we can't check
    }
    
    // Get the current GLB buffer
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        return false;
    }
    
    try {
        // Try to get binary buffer for this mesh
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshIndex);
        
        // If buffer found and has data, it has content
        if (binaryBuffer && binaryBuffer.byteLength > 0) {
            // Cache the result
            meshesWithHtml.add(meshIndex);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking if mesh has binary content:', error);
        return false;
    }
}

/**
 * Create the mesh visibility panel in the UI
 */
export function createMeshVisibilityPanel() {
    // Register utility functions globally
    window.removeMeshHtmlFlag = removeMeshHtmlFlag;
    window.updateHtmlIcons = updateHtmlIcons;
    window.openMeshInfoModal = openMeshInfoModal;
    
    // Get the state to check for mesh data
    const state = getState();
    const hasMeshes = state.meshes && state.meshes.length > 0;
    
    // Update button container visibility
    const buttonContainer = document.querySelector('.button-container');
    const downloadBtn = document.getElementById('download-asset-btn');
    if (buttonContainer && downloadBtn) {
        buttonContainer.dataset.hasMeshes = hasMeshes.toString();
        downloadBtn.style.display = hasMeshes ? 'inline-block' : 'none';
    }
    
    // If no meshes, return early
    if (!hasMeshes) {
        return;
    }
    
    // Organize meshes into groups based on name prefixes
    groupMeshesByName();
    
    // Get the container element
    const meshGroupsContainer = document.getElementById('mesh-groups');
    if (!meshGroupsContainer) return;
    
    // Clear previous content
    meshGroupsContainer.innerHTML = '';
    
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
        const meshPromises = groupMeshes.map(async (mesh, index) => {
            const meshDiv = document.createElement('div');
            meshDiv.className = 'mesh-item';
            meshDiv.style.display = 'flex';
            meshDiv.style.alignItems = 'center';
            
            // Create mesh toggle checkbox
            const meshToggle = document.createElement('input');
            meshToggle.type = 'checkbox';
            meshToggle.className = 'mesh-toggle';
            meshToggle.checked = mesh.visible;
            const meshIndex = state.meshes.indexOf(mesh);
            meshToggle.dataset.meshIndex = meshIndex;
            
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
            htmlEditorIcon.dataset.meshIndex = meshIndex;
            htmlEditorIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                    <path d="M234.8 511.7L196 500.4c-4.2-1.2-6.7-5.7-5.5-9.9L331.3 5.8c1.2-4.2 5.7-6.7 9.9-5.5L380 11.6c4.2 1.2 6.7 5.7 5.5 9.9L244.7 506.2c-1.2 4.3-5.6 6.7-9.9 5.5zm-83.2-121.1l27.2-29c3.1-3.3 2.8-8.5-.5-11.5L72.2 256l106.1-94.1c3.4-3 3.6-8.2.5-11.5l-27.2-29c-3-3.2-8.1-3.4-11.3-.4L2.5 250.2c-3.4 3.2-3.4 8.5 0 11.7L140.3 391c3.2 3 8.2 2.8 11.3-.4zm284.1.4l137.7-129.1c3.4-3.2 3.4-8.5 0-11.7L435.7 121c-3.2-3-8.3-2.9-11.3.4l-27.2 29c-3.1 3.3-2.8 8.5.5 11.5L503.8 256l-106.1 94.1c-3.4 3-3.6 8.2-.5 11.5l27.2 29c3.1 3.2 8.1 3.4 11.3.4z"/>
                </svg>
            `;
            
            // Check if mesh has HTML content
            const hasHtml = await checkMeshHasHtmlContent(meshIndex);
            
            // Add a data attribute to the icon indicating if it has HTML content
            htmlEditorIcon.dataset.hasHtml = hasHtml;
            
            // Style the icon based on HTML content status
            updateIconAppearance(htmlEditorIcon, hasHtml);
            
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
            
            // Create mesh info icon
            const meshInfoIcon = document.createElement('span');
            meshInfoIcon.className = 'mesh-info-icon';
            meshInfoIcon.title = 'View mesh details';
            meshInfoIcon.dataset.meshIndex = meshIndex;
            meshInfoIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                    <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                    <circle cx="12" cy="8" r="1" fill="currentColor"/>
                </svg>
            `;
            meshInfoIcon.style.color = '#6c757d';
            meshInfoIcon.style.cursor = 'pointer';
            meshInfoIcon.style.marginLeft = '8px';
            
            // Add event listener to show mesh info panel
            meshInfoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Mesh info icon clicked for mesh index:', meshIndex);
                try {
                    const meshName = state.meshes[meshIndex].name || 'Unnamed mesh';
                    console.log(`Opening mesh info modal for mesh: ${meshName} (index: ${meshIndex})`);
                    // Check if the function exists before calling it
                    if (typeof window.openMeshInfoModal === 'function') {
                        // Call the mesh info modal
                        window.openMeshInfoModal(meshName, meshIndex);
                    } else {
                        console.error('Mesh Info Modal function not found. Modal may not be initialized yet.');
                        alert('Mesh Info Modal not ready. Please try again in a moment.');
                    }
                } catch (error) {
                    console.error('Error opening mesh info modal:', error);
                    alert('Error opening mesh info modal. See console for details.');
                }
            });
            
            // Create icons container
            const iconsContainer = document.createElement('div');
            iconsContainer.className = 'mesh-item-icons';
            
            // Add the HTML editor icon if the mesh name contains "display"
            if (mesh.name && mesh.name.toLowerCase().includes('display')) {
                iconsContainer.appendChild(htmlEditorIcon);
            }
            
            // Always add the info icon
            iconsContainer.appendChild(meshInfoIcon);
            
            // Assemble mesh item
            meshDiv.appendChild(meshToggle);
            meshDiv.appendChild(meshNameSpan);
            meshDiv.appendChild(iconsContainer);
            
            return meshDiv;
        });
        
        // Wait for all mesh promises to resolve
        Promise.all(meshPromises).then(meshDivs => {
            // Add all mesh divs to the mesh items container
            meshDivs.forEach(div => {
                meshItemsDiv.appendChild(div);
            });
            
            // Add group header and mesh items to group container
            groupDiv.appendChild(headerDiv);
            groupDiv.appendChild(meshItemsDiv);
            
            // Add group container to mesh groups container
            meshGroupsContainer.appendChild(groupDiv);
        });
    }
    
    // Initialize the download button only once
    if (!meshPanelInitialized) {
        initDownloadButton();
        meshPanelInitialized = true;
        console.log('Mesh panel initialized');
    }
}

/**
 * Initialize the download button
 */
function initDownloadButton() {
    const downloadBtn = document.getElementById('download-asset-btn');
    if (!downloadBtn) return;
    
    // Only register event listener once
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
    
    // Mark as initialized
    downloadButtonInitialized = true;
    console.log('Download button event listener initialized successfully');
}

/**
 * Download the updated GLB file
 */
async function downloadUpdatedGlb() {
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        alert('No GLB file loaded to download.');
        return;
    }
    
    // Get state for filename
    const state = getState();
    let fileName = 'model_' + getCurrentTimestamp() + '.glb';
    
    // Use original filename if available
    if (state.currentGlb && state.currentGlb.fileName) {
        // Add timestamp to the filename
        const originalName = state.currentGlb.fileName;
        const nameParts = originalName.split('.');
        if (nameParts.length > 1) {
            // Insert the timestamp before the file extension
            const extension = nameParts.pop();
            fileName = nameParts.join('.') + '_' + getCurrentTimestamp() + '.' + extension;
        } else {
            fileName = originalName + '_' + getCurrentTimestamp() + '.glb';
        }
    }
    
    // Create a blob from the array buffer
    const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    // Add the link to the document
    document.body.appendChild(link);
    
    // Trigger the download
    link.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
    
    console.log(`Downloaded GLB as ${fileName}`);
}

/**
 * Get a formatted timestamp string for filenames
 * @returns {string} Formatted timestamp (YYYYMMDD_HHMMSS)
 */
function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Update binary content icons to reflect current content
 * This should be called after saving binary data
 */
export function updateHtmlIcons() {
    // Update all content editor icons to reflect their current state
    document.querySelectorAll('.mesh-html-editor-icon').forEach(async (icon) => {
        const meshIndex = parseInt(icon.dataset.meshIndex);
        if (!isNaN(meshIndex)) {
            const hasHtml = await checkMeshHasHtmlContent(meshIndex);
            toggleMeshCodeIcon(meshIndex, hasHtml);
        }
    });
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

/**
 * Remove binary content flag for a specific mesh
 * @param {number} meshIndex - The index of the mesh to update
 */
export function removeMeshHtmlFlag(meshIndex) {
    console.log(`Removing binary content flag for mesh index ${meshIndex}`);
    
    // Use the new toggle function to update the icon state to 'no content'
    // Force the update to prevent inconsistent state
    toggleMeshCodeIcon(meshIndex, false, true);
    
    // Force refresh of cache
    checkMeshHasHtmlContent(meshIndex).then(() => {
        console.log(`Re-checked mesh binary content status for mesh ${meshIndex}`);
    });
}

/**
 * Update an icon's appearance based on content status
 * @param {HTMLElement} icon - The icon element to update
 * @param {boolean} hasHtml - Whether the mesh has content
 */
function updateIconAppearance(icon, hasHtml) {
    // Update all visual properties
    icon.dataset.hasHtml = hasHtml ? 'true' : 'false';
    
    if (hasHtml) {
        icon.classList.add('has-html');
        
        // Check if the binary content is valid HTML
        const meshIndex = parseInt(icon.dataset.meshIndex);
        
        // Asynchronously check if content is valid HTML
        // We'll set the default color first, then update if it's valid HTML
        icon.style.color = ICON_COLORS.HAS_HTML;
        icon.title = 'Edit content (has content)';
        
        // Only proceed if we have a valid mesh index
        if (!isNaN(meshIndex)) {
            // Use an immediately invoked async function to handle the promise
            (async () => {
                try {
                    const glbBuffer = getCurrentGlbBuffer();
                    if (glbBuffer) {
                        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshIndex);
                        if (binaryBuffer) {
                            const result = deserializeStringFromBinary(binaryBuffer);
                            const content = result.content;
                            if (isValidHtml(content)) {
                                // It's valid HTML - set icon to green
                                icon.style.color = ICON_COLORS.VALID_HTML;
                                icon.title = 'Edit content (valid HTML)';
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error checking if content is valid HTML:', error);
                }
            })();
        }
    } else {
        icon.classList.remove('has-html');
        icon.style.color = ICON_COLORS.NO_HTML;
        icon.title = 'Edit content';
    }
    
    console.log(`Updated icon appearance, hasContent=${hasHtml}, color=${icon.style.color}`);
}

/**
 * Force update mesh binary icon state - to be called from html-editor-modal.js
 * This avoids race conditions when saving/removing binary content
 * @param {number} meshIndex - The index of the mesh to update
 * @param {boolean} hasHtml - Whether the mesh has binary content
 */
export function forceUpdateMeshHtmlState(meshIndex, hasHtml) {
    return toggleMeshCodeIcon(meshIndex, hasHtml, true);
}

export default {
    createMeshVisibilityPanel,
    toggleMeshGroupVisibility,
    updateGroupToggleState,
    toggleMeshCodeIcon,
    forceUpdateMeshHtmlState
};