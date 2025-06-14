import * as THREE from 'three';
import { getState } from "../util/state/scene-state";
import { getHtmlSettingsForMesh } from '../util/data/mesh-html-manager';

// Info panel state variables
export let infoPanel = null;
let infoPanelCollapsed = false;
let infoPanelPosition = { x: 10, y: 10 }; // Default position in top-left corner

/**
 * Create a collapsible info panel for the preview that shows mesh details
 * This panel is similar to the axis indicator and can be collapsed/expanded
 * and dragged around the preview area. It shows detailed information about
 * the mesh being previewed including geometry, materials, and transform data.
 * 
 * @param {HTMLElement} container - The container to add the info panel to
 * @param {number} meshId - The ID of the mesh being previewed
 * @returns {HTMLElement} The created info panel element
 */
export function createMeshInfoPanel(container, meshId) {
    // Remove any existing info panel
    if (infoPanel) {
        if (infoPanel.parentNode) {
            infoPanel.parentNode.removeChild(infoPanel);
        }
        infoPanel = null;
    }
    
    // Get mesh data from state
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        return;
    }
    
    // Create the info panel container
    const panel = document.createElement('div');
    panel.id = 'preview-info-panel';
    panel.style.position = 'absolute';
    panel.style.zIndex = '900'; // Lower z-index than the loading overlay (1000)
    panel.style.pointerEvents = 'auto';
    panel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    panel.style.border = '1px solid rgba(50, 50, 50, 0.7)';
    panel.style.borderRadius = '5px';
    panel.style.overflow = 'hidden';
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    panel.style.width = '250px';
    panel.style.left = `${infoPanelPosition.x}px`;
    panel.style.top = `${infoPanelPosition.y}px`;
    
    // Create the header
    const header = document.createElement('div');
    header.id = 'preview-info-header';
    header.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
    header.style.color = 'white';
    header.style.padding = '5px 10px';
    header.style.cursor = 'grab';
    header.style.userSelect = 'none';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.width = '100%';
    header.style.boxSizing = 'border-box';
    
    // Add title
    const title = document.createElement('span');
    title.textContent = 'Mesh Info';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '12px';
    
    // Add collapse/expand button
    const collapseBtn = document.createElement('span');
    collapseBtn.textContent = infoPanelCollapsed ? '▼' : '▲';
    collapseBtn.style.fontSize = '12px';
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.style.marginLeft = '10px';
    collapseBtn.style.width = '15px';
    collapseBtn.style.textAlign = 'center';
    
    // Add elements to header
    header.appendChild(title);
    header.appendChild(collapseBtn);
    
    // Create content container
    const content = document.createElement('div');
    content.id = 'preview-info-content';
    content.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
    content.style.color = 'white';
    content.style.padding = '10px';
    content.style.fontSize = '12px';
    content.style.display = infoPanelCollapsed ? 'none' : 'block';
    content.style.maxHeight = '300px';
    content.style.overflowY = 'auto';
    
    // Gather mesh information
    const info = [];
    
    // Basic Information
    info.push('<strong>Basic Information</strong>');
    info.push(`Name: ${mesh.name || 'Unnamed'}`);
    info.push(`ID: ${meshId}`);
    info.push(`Visible: ${mesh.visible ? 'Yes' : 'No'}`);
    
    // Dimensions
    let dimensions = null;
    if (mesh.geometry) {
        // Compute bounding box if not already computed
        if (!mesh.geometry.boundingBox) {
            mesh.geometry.computeBoundingBox();
        }
        
        if (mesh.geometry.boundingBox) {
            const box = mesh.geometry.boundingBox;
            const width = box.max.x - box.min.x;
            const height = box.max.y - box.min.y;
            const depth = box.max.z - box.min.z;
            
            dimensions = { width, height, depth };
            
            info.push('<strong>Dimensions</strong>');
            info.push(`Width (X): ${width.toFixed(3)}`);
            info.push(`Height (Y): ${height.toFixed(3)}`);
            info.push(`Depth (Z): ${depth.toFixed(3)}`);
        }
    }
    
    // Geometry details
    if (mesh.geometry) {
        info.push('<strong>Geometry</strong>');
        
        // Geometry type
        info.push(`Type: ${mesh.geometry.type || 'Unknown'}`);
        
        // Vertices count
        const vertexCount = mesh.geometry.attributes && mesh.geometry.attributes.position ? 
            mesh.geometry.attributes.position.count : 'Unknown';
        info.push(`Vertices: ${vertexCount}`);
        
        // Faces count (triangles)
        let faceCount = 'Unknown';
        if (mesh.geometry.index) {
            faceCount = Math.floor(mesh.geometry.index.count / 3);
        } else if (mesh.geometry.attributes && mesh.geometry.attributes.position) {
            faceCount = Math.floor(mesh.geometry.attributes.position.count / 3);
        }
        info.push(`Faces: ${faceCount}`);
    }
    
    // Material details
    if (mesh.material) {
        info.push('<strong>Material</strong>');
        
        // Handle multiple materials
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        info.push(`Count: ${materials.length}`);
        
        // Material properties (just show first material if multiple)
        const material = materials[0];
        info.push(`Type: ${material.type || 'Unknown'}`);
        info.push(`Double Sided: ${material.side === THREE.DoubleSide ? 'Yes' : 'No'}`);
        info.push(`Transparent: ${material.transparent ? 'Yes' : 'No'}`);
        
        // Color if available
        if (material.color) {
            const colorHex = '#' + material.color.getHexString();
            info.push(`Color: <span style="color:${colorHex}">■</span> ${colorHex}`);
        }
    }
    
    // Transform information
    info.push('<strong>Transform</strong>');
    info.push(`Position: X:${mesh.position.x.toFixed(3)}, Y:${mesh.position.y.toFixed(3)}, Z:${mesh.position.z.toFixed(3)}`);
    info.push(`Rotation: X:${(mesh.rotation.x * 180 / Math.PI).toFixed(1)}°, Y:${(mesh.rotation.y * 180 / Math.PI).toFixed(1)}°, Z:${(mesh.rotation.z * 180 / Math.PI).toFixed(1)}°`);
    info.push(`Scale: X:${mesh.scale.x.toFixed(3)}, Y:${mesh.scale.y.toFixed(3)}, Z:${mesh.scale.z.toFixed(3)}`);
    
    // HTML settings
    const htmlSettings = getHtmlSettingsForMesh(meshId);
    if (htmlSettings) {
        info.push('<strong>HTML Settings</strong>');
        info.push(`Render Mode: ${htmlSettings.previewMode || 'threejs'}`);
        info.push(`Playback Speed: ${htmlSettings.playbackSpeed || '1'}`);
        info.push(`Animation: ${htmlSettings.animation?.type || 'play'}`);
        info.push(`Show Borders: ${htmlSettings.showBorders !== false ? 'Yes' : 'No'}`);
        info.push(`Display on Mesh: ${htmlSettings.displayOnMesh === true ? 'Yes' : 'No'}`);
        info.push(`Rig Control Node: ${htmlSettings.rigControlNode === true ? 'Yes' : 'No'}`);
    }
    
    // Add content to the panel
    content.innerHTML = info.join('<br>');
    
    // Add header and content to panel
    panel.appendChild(header);
    panel.appendChild(content);
    
    // Add to container
    container.appendChild(panel);
    
    // Store reference
    infoPanel = panel;
    
    // Add collapse functionality
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering drag
        infoPanelCollapsed = !infoPanelCollapsed;
        collapseBtn.textContent = infoPanelCollapsed ? '▼' : '▲';
        content.style.display = infoPanelCollapsed ? 'none' : 'block';
        updatePanelHeight();
    });
    
    // Function to update panel height
    function updatePanelHeight() {
        if (infoPanelCollapsed) {
            panel.style.height = `${header.offsetHeight}px`;
        } else {
            panel.style.height = 'auto';
        }
    }
    
    // Call once to set initial height
    updatePanelHeight();
    
    // Make the header draggable
    let isHeaderDragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        isHeaderDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(panel.style.left);
        startTop = parseInt(panel.style.top);
        header.style.cursor = 'grabbing';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isHeaderDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const newLeft = startLeft + dx;
        const newTop = startTop + dy;
        
        // Get current container dimensions
        const containerRect = container.getBoundingClientRect();
        const maxLeft = containerRect.width - panel.offsetWidth;
        const maxTop = containerRect.height - panel.offsetHeight;
        
        const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
        const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
        
        panel.style.left = `${constrainedLeft}px`;
        panel.style.top = `${constrainedTop}px`;
        
        // Update stored position
        infoPanelPosition.x = constrainedLeft;
        infoPanelPosition.y = constrainedTop;
    });
    
    document.addEventListener('mouseup', () => {
        if (isHeaderDragging) {
            isHeaderDragging = false;
            header.style.cursor = 'grab';
        }
    });
    
    return panel;
}

/**
 * Reset info panel to null
 */
export function resetInfoPanel() {
    infoPanel = null;
}
