/**
 * Texture Debugger - Mesh Panel Module
 * 
 * This module handles mesh visibility panel UI and interaction.
 */
import { deserializeStringFromBinary, isValidHtml } from '../../../util/data/string-serder.js';
import { openMeshInfoModal } from '../../../modals/mesh-info-modal/mesh-info-modal.js';
import { getBinaryBufferForMesh } from '../../../util/data/glb-buffer-manager.js';
import { getCurrentGlbBuffer } from '../../../util/scene/glb-controller.js';
import { getState, updateState } from '../../../util/state/scene-state.js';
import { checkMeshHasHtmlContent } from '../../../util/data/mesh-html-manager.js';

// Load mesh panel CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = '/asset_debugger/panels/asset-panel/mesh-heading/mesh-heading.css';
document.head.appendChild(link);

// Track meshes with binary content
export const meshesWithHtml = new Set();
// Icon color constants
const ICON_COLORS = {
    HAS_HTML: '#f8d73e', // Yellow color for meshes with binary content (Fallout yellow)
    VALID_HTML: '#4CAF50', // Green color for meshes with valid HTML content
    NO_HTML: '#8a8a8a'   // Default color for meshes without content
};

/**
 * Toggle the binary content icon appearance for a specific mesh
 * @param {number} meshIndex - The index of the mesh to toggle
 * @param {boolean} hasHtml - Whether the mesh has binary content
 * @param {boolean} forceUpdate - If true, forces the update without rechecking
 * @returns {boolean} Whether the operation was successful
 */
export function toggleMeshCodeIcon(meshIndex, hasHtml, forceUpdate = false) {
    console.log(`Toggling mesh code icon for mesh ${meshIndex} to ${hasHtml ? 'has content' : 'no content'}`);
    
    if (hasHtml) {
        meshesWithHtml.add(meshIndex);
    } else {
        meshesWithHtml.delete(meshIndex);
    }
    
    if (forceUpdate) {
        if (!window._forcedHtmlStates) {
            window._forcedHtmlStates = {};
        }
        window._forcedHtmlStates[meshIndex] = hasHtml;
        
        setTimeout(() => {
            if (window._forcedHtmlStates) {
                delete window._forcedHtmlStates[meshIndex];
            }
        }, 500);
    }
    
    const icons = document.querySelectorAll(`.mesh-html-editor-icon[data-mesh-index="${meshIndex}"]`);
    
    if (icons.length === 0) {
        console.log(`No icons found for mesh index ${meshIndex}, trying broader search`);
        const allIcons = document.querySelectorAll('.mesh-html-editor-icon');
        
        allIcons.forEach((icon) => {
            const iconMeshIndex = parseInt(icon.dataset.meshIndex);
            if (iconMeshIndex === meshIndex) {
                updateIconAppearance(icon, hasHtml);
            }
        });
    } else {
        icons.forEach(icon => {
            updateIconAppearance(icon, hasHtml);
        });
    }
    
    return true;
}

/**
 * Create the mesh visibility panel in the UI
 */
export function createMeshVisibilityPanel() {
    window.removeMeshHtmlFlag = removeMeshHtmlFlag;
    window.updateHtmlIcons = updateHtmlIcons;
    window.openMeshInfoModal = openMeshInfoModal;
    
    const state = getState();
    const hasMeshes = state.meshes && state.meshes.length > 0;
    
    if (!hasMeshes) {
        return;
    }
    
    groupMeshesByName();
    
    const meshGroupsContainer = document.getElementById('mesh-groups');
    if (!meshGroupsContainer) return;
    
    meshGroupsContainer.innerHTML = '';
    
    for (const groupName in state.meshGroups) {
        const groupMeshes = state.meshGroups[groupName];
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mesh-group';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'mesh-group-header';
        headerDiv.style.display = 'flex';
        headerDiv.style.alignItems = 'center';
        headerDiv.style.justifyContent = 'space-between';
        headerDiv.style.width = '100%';
        headerDiv.style.cursor = 'pointer';
        
        const headerLeftDiv = document.createElement('div');
        headerLeftDiv.style.display = 'flex';
        headerLeftDiv.style.alignItems = 'center';
        
        const groupToggle = document.createElement('input');
        groupToggle.type = 'checkbox';
        groupToggle.className = 'mesh-group-toggle';
        groupToggle.checked = true;
        groupToggle.dataset.group = groupName;
        
        groupToggle.addEventListener('change', (e) => {
            const isVisible = e.target.checked;
            toggleMeshGroupVisibility(groupName, isVisible);
            
            const meshToggles = groupDiv.querySelectorAll('.mesh-toggle');
            meshToggles.forEach(toggle => {
                toggle.checked = isVisible;
            });
        });
        
        groupToggle.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const groupNameSpan = document.createElement('span');
        groupNameSpan.className = 'mesh-group-name';
        groupNameSpan.textContent = groupName + ' ';
        
        const groupCountSpan = document.createElement('span');
        groupCountSpan.className = 'mesh-group-count';
        groupCountSpan.textContent = `(${groupMeshes.length})`;
        
        const collapseBtn = document.createElement('span');
        collapseBtn.className = 'mesh-group-collapse';
        collapseBtn.textContent = '+';
        collapseBtn.style.cursor = 'pointer';
        collapseBtn.style.marginLeft = 'auto';
        
        const toggleCollapse = () => {
            const meshItemsDiv = groupDiv.querySelector('.mesh-items');
            const isCollapsed = meshItemsDiv.style.display === 'none';
            
            meshItemsDiv.style.display = isCollapsed ? 'block' : 'none';
            collapseBtn.textContent = isCollapsed ? '-' : '+';
        };
        
        headerDiv.addEventListener('click', toggleCollapse);
        
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCollapse();
        });
        
        headerLeftDiv.appendChild(groupToggle);
        headerLeftDiv.appendChild(groupNameSpan);
        headerLeftDiv.appendChild(groupCountSpan);
        
        headerDiv.appendChild(headerLeftDiv);
        headerDiv.appendChild(collapseBtn);
        
        const meshItemsDiv = document.createElement('div');
        meshItemsDiv.className = 'mesh-items';
        meshItemsDiv.style.display = 'none';
        
        const meshPromises = groupMeshes.map(async (mesh, index) => {
            const meshDiv = document.createElement('div');
            meshDiv.className = 'mesh-item';
            meshDiv.style.display = 'flex';
            meshDiv.style.alignItems = 'center';
            
            const meshToggle = document.createElement('input');
            meshToggle.type = 'checkbox';
            meshToggle.className = 'mesh-toggle';
            meshToggle.checked = mesh.visible;
            const meshIndex = state.meshes.indexOf(mesh);
            meshToggle.dataset.meshIndex = meshIndex;
            
            meshToggle.addEventListener('change', (e) => {
                const isVisible = e.target.checked;
                const meshIndex = parseInt(e.target.dataset.meshIndex);
                
                if (!isNaN(meshIndex) && meshIndex >= 0 && meshIndex < state.meshes.length) {
                    state.meshes[meshIndex].visible = isVisible;
                    updateGroupToggleState(groupName);
                }
            });
            
            const meshNameSpan = document.createElement('span');
            meshNameSpan.className = 'mesh-name';
            meshNameSpan.textContent = getMeshDisplayName(mesh);
            meshNameSpan.title = mesh.name || "Unnamed mesh";
            meshNameSpan.style.flexGrow = '1';
            
            const htmlEditorIcon = document.createElement('span');
            htmlEditorIcon.className = 'mesh-html-editor-icon';
            htmlEditorIcon.title = 'Edit HTML';
            htmlEditorIcon.dataset.meshIndex = meshIndex;
            htmlEditorIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                    <path d="M234.8 511.7L196 500.4c-4.2-1.2-6.7-5.7-5.5-9.9L331.3 5.8c1.2-4.2 5.7-6.7 9.9-5.5L380 11.6c4.2 1.2 6.7 5.7 5.5 9.9L244.7 506.2c-1.2 4.3-5.6 6.7-9.9 5.5zm-83.2-121.1l27.2-29c3.1-3.3 2.8-8.5-.5-11.5L72.2 256l106.1-94.1c3.4-3 3.6-8.2.5-11.5l-27.2-29c-3-3.2-8.1-3.4-11.3-.4L2.5 250.2c-3.4 3.2-3.4 8.5 0 11.7L140.3 391c3.2 3 8.2 2.8 11.3-.4zm284.1.4l137.7-129.1c3.4-3.2 3.4-8.5 0-11.7L435.7 121c-3.2-3-8.3-2.9-11.3.4l-27.2 29c-3.1 3.3-2.8 8.5.5 11.5L503.8 256l-106.1 94.1c-3.4 3-3.6 8.2-.5 11.5l27.2 29c3.1 3.2 8.1 3.4 11.3.4z"/>
                </svg>
            `;
            
            const hasHtml = await checkMeshHasHtmlContent(meshIndex);
            htmlEditorIcon.dataset.hasHtml = hasHtml;
            updateIconAppearance(htmlEditorIcon, hasHtml);
            
            htmlEditorIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('HTML editor icon clicked');
                
                try {
                    const meshIndex = parseInt(meshToggle.dataset.meshIndex);
                    const meshName = state.meshes[meshIndex].name || 'Unnamed mesh';
                    
                    console.log(`Opening HTML editor for mesh: ${meshName} (index: ${meshIndex})`);
                    
                    if (typeof window.openEmbeddedHtmlEditor === 'function') {
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
            
            meshInfoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Mesh info icon clicked for mesh index:', meshIndex);
                try {
                    const meshName = state.meshes[meshIndex].name || 'Unnamed mesh';
                    console.log(`Opening mesh info modal for mesh: ${meshName} (index: ${meshIndex})`);
                    if (typeof window.openMeshInfoModal === 'function') {
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
            
            const iconsContainer = document.createElement('div');
            iconsContainer.className = 'mesh-item-icons';
            
            if (mesh.name && mesh.name.toLowerCase().includes('display')) {
                iconsContainer.appendChild(htmlEditorIcon);
            }
            
            iconsContainer.appendChild(meshInfoIcon);
            
            meshDiv.appendChild(meshToggle);
            meshDiv.appendChild(meshNameSpan);
            meshDiv.appendChild(iconsContainer);
            
            return meshDiv;
        });
        
        Promise.all(meshPromises).then(meshDivs => {
            meshDivs.forEach(div => {
                meshItemsDiv.appendChild(div);
            });
            
            groupDiv.appendChild(headerDiv);
            groupDiv.appendChild(meshItemsDiv);
            
            meshGroupsContainer.appendChild(groupDiv);
        });
    }
}

/**
 * Update binary content icons to reflect current content
 * This should be called after saving binary data
 */
export function updateHtmlIcons() {
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
    
    if (name === 'Unnamed' || name === 'Cube') {
        return 'Default';
    }
    
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
    
    const allVisible = state.meshGroups[groupName].every(mesh => mesh.visible);
    const anyVisible = state.meshGroups[groupName].some(mesh => mesh.visible);
    
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
    
    toggleMeshCodeIcon(meshIndex, false, true);
    
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
    icon.dataset.hasHtml = hasHtml ? 'true' : 'false';
    
    if (hasHtml) {
        icon.classList.add('has-html');
        
        const meshIndex = parseInt(icon.dataset.meshIndex);
        
        icon.style.color = ICON_COLORS.HAS_HTML;
        icon.title = 'Edit content (has content)';
        
        if (!isNaN(meshIndex)) {
            (async () => {
                try {
                    const glbBuffer = getCurrentGlbBuffer();
                    if (glbBuffer) {
                        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshIndex);
                        if (binaryBuffer) {
                            const result = deserializeStringFromBinary(binaryBuffer);
                            const content = result.content;
                            if (isValidHtml(content)) {
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