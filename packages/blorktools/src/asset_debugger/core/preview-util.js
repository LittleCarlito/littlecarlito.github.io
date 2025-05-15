import * as THREE from 'three';
import { createTextureFromIframe } from './texture-util';
import { showStatus } from '../ui/scripts/html-editor-modal';
import { resetPreRender, startPreRendering } from './animation-util';
import { sanitizeHtml } from './string-serder';
import { getState } from './state';
import { initCSS3DPreview } from './css3d-util';
import { cleanupThreeJsPreview, initThreeJsPreview, previewPlane, setPreviewRenderTarget } from './threejs-util';

// Add variables for CSS3D rendering
let webglRenderer;
// Three.js variables for preview
export let isPreviewAnimationPaused = false;
let lastTextureUpdateTime = 0;
// Add at the top of the file, with other variables
// Info panel state variables
export let infoPanel = null;
let infoPanelCollapsed = false;
let infoPanelPosition = { x: 10, y: 10 }; // Default position in top-left corner

// Add variables for frame buffering at the top of the file with other variables
export let maxCaptureRate = 0.5; // Reduce to 0.5ms between captures for more frames (was 1)
export let isPreviewActive = false; // Track if preview is currently active

/**
 * Initialize the preview based on the selected mode
 * @param {string} previewMode - The preview mode (threejs or css3d)
 * @param {HTMLElement} canvasContainer - The container for the preview
 * @param {HTMLIFrameElement} renderIframe - The iframe containing the HTML content
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} startAnimation - Whether to start the animation immediately
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
function initializePreview(previewMode, canvasContainer, renderIframe, currentMeshId, startAnimation = true, createInfoPanel = true) {
    // Get animation type
    const animationTypeSelect = document.getElementById('html-animation-type');
    const animationType = animationTypeSelect ? animationTypeSelect.value : 'none';

    // Remove the special case for long exposure that immediately pauses animation
    // For long exposure, we want to see the actual animation

    // If not starting animation immediately, pause it
    if (!startAnimation) {
        isPreviewAnimationPaused = true;
    }

    // Initialize preview based on mode
    if (previewMode === 'css3d') {
        showStatus('Initializing CSS3D preview mode...', 'info');
        // Get the iframe that may have been created earlier, or create a new one if needed
        const directPreviewIframe = document.createElement('iframe');
        initCSS3DPreview(canvasContainer, directPreviewIframe.cloneNode(true), currentMeshId, createInfoPanel);
    } else {
        // Default to threejs mode
        showStatus('Initializing 3D cube preview...', 'info');
        initThreeJsPreview(canvasContainer, renderIframe, currentMeshId, createInfoPanel);
    }
}

/**
 * Preview HTML code using Three.js
 * @param {string} html - The HTML code to preview
 */
export function previewHtml(html) {
    const previewContent = document.getElementById('html-preview-content');
    if (!previewContent) return;

    try {
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);

        // Get preview mode from render type dropdown
        const renderTypeSelect = document.getElementById('html-render-type');
        let previewMode = renderTypeSelect ? renderTypeSelect.value : 'threejs';

        // Get playback speed from dropdown
        const playbackSpeedSelect = document.getElementById('html-playback-speed');
        const playbackSpeed = playbackSpeedSelect ? parseFloat(playbackSpeedSelect.value) : 1.0;

        // Get animation type from dropdown
        const animationTypeSelect = document.getElementById('html-animation-type');
        const animationType = animationTypeSelect ? animationTypeSelect.value : 'none';

        // For long exposure, set a flag to indicate we should create the long exposure immediately
        // This prevents showing the first frame before the long exposure
        const isLongExposureMode = animationType === 'longExposure';
        window.createLongExposureImmediately = isLongExposureMode;

        resetPreRender();

        // Store the preview mode in the modal dataset for access elsewhere
        modal.dataset.previewMode = previewMode;

        // Always do a full cleanup for a new preview
        console.log('Cleaning up previous preview');
        // Clean up any existing preview
        cleanupThreeJsPreview();

        // Clear the preview container
        previewContent.innerHTML = '';

        // Set preview as active
        isPreviewActive = true;

        // The sanitizeHtml function handles wrapping fragments if needed
        const sanitizedHtml = sanitizeHtml(html);

        // Create a hidden iframe for rendering HTML to texture (if needed)
        const renderIframe = document.createElement('iframe');
        renderIframe.id = 'html-render-iframe';
        renderIframe.style.width = '960px';
        renderIframe.style.height = '540px';
        renderIframe.style.position = 'absolute';
        renderIframe.style.left = '-9999px';
        renderIframe.style.top = '0';
        renderIframe.style.border = 'none';
        renderIframe.style.backgroundColor = 'transparent';
        document.body.appendChild(renderIframe);

        // Store reference to the iframe
        setPreviewRenderTarget(renderIframe);

        // Make sure the preview content container has proper positioning for absolute children
        previewContent.style.position = 'relative';
        previewContent.style.minHeight = '400px';
        previewContent.style.height = '100%';

        // Always pre-render for all speeds
        const needsPreRendering = true;

        // For long exposure, show a different status message
        if (isLongExposureMode) {
            showStatus('Pre-rendering animation for long exposure capture...', 'info');
        } else {
            showStatus('Pre-rendering animation for smooth playback...', 'info');
        }

        // Wait for iframe to be ready
        renderIframe.onload = () => {
            // Only proceed if preview is still active
            if (!isPreviewActive) return;

            // Create container for Three.js canvas
            const canvasContainer = document.createElement('div');
            canvasContainer.style.width = '100%';
            canvasContainer.style.height = '100%';
            canvasContainer.style.position = 'absolute';
            canvasContainer.style.top = '0';
            canvasContainer.style.left = '0';
            canvasContainer.style.right = '0';
            canvasContainer.style.bottom = '0';
            canvasContainer.style.overflow = 'hidden';
            canvasContainer.style.display = 'block'; // Always display since 'direct' mode is removed
            previewContent.appendChild(canvasContainer);

            // Add error log container
            const errorLog = document.createElement('div');
            errorLog.id = 'html-preview-error-log';
            errorLog.className = 'preview-error-log';
            errorLog.style.display = 'none';
            previewContent.appendChild(errorLog);

            // Add a loading overlay that matches the loading-splash.html style
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'pre-rendering-overlay';
            loadingOverlay.className = 'loading-splash';
            loadingOverlay.style.position = 'absolute';
            loadingOverlay.style.top = '0';
            loadingOverlay.style.left = '0';
            loadingOverlay.style.width = '100%';
            loadingOverlay.style.height = '100%';
            loadingOverlay.style.backgroundColor = '#000000'; // Solid black background
            loadingOverlay.style.zIndex = '1000';

            // Remove any border/outline that might be causing green lines
            loadingOverlay.style.border = 'none';
            loadingOverlay.style.outline = 'none';
            loadingOverlay.style.boxShadow = 'none';

            // Create content container similar to loading-splash.html
            const loadingContent = document.createElement('div');
            loadingContent.className = 'loading-content';
            loadingContent.style.display = 'flex';
            loadingContent.style.flexDirection = 'column';
            loadingContent.style.alignItems = 'center';
            loadingContent.style.justifyContent = 'center';
            loadingContent.style.height = '100%';
            loadingContent.style.width = '100%';
            loadingContent.style.backgroundColor = '#000000'; // Ensure content background is also black

            // Create title
            const loadingTitle = document.createElement('h2');
            loadingTitle.className = 'loading-title';
            loadingTitle.textContent = 'PRE-RENDERING';
            loadingTitle.style.color = 'white';
            loadingTitle.style.margin = '0 0 20px 0';

            // Create spinner container
            const spinnerContainer = document.createElement('div');
            spinnerContainer.className = 'loading-spinner-container';

            // Create atomic spinner
            const atomicSpinner = document.createElement('div');
            atomicSpinner.className = 'atomic-spinner';

            // Create nucleus
            const nucleus = document.createElement('div');
            nucleus.className = 'nucleus';
            atomicSpinner.appendChild(nucleus);

            // Create electron orbits (3)
            for (let i = 0; i < 3; i++) {
                const orbit = document.createElement('div');
                orbit.className = 'electron-orbit';

                const electron = document.createElement('div');
                electron.className = 'electron';

                orbit.appendChild(electron);
                atomicSpinner.appendChild(orbit);
            }

            spinnerContainer.appendChild(atomicSpinner);

            // Create progress text
            const progressText = document.createElement('div');
            progressText.id = 'loading-progress-text';
            progressText.className = 'loading-progress-text';
            progressText.textContent = 'Pre-rendering animation...';
            progressText.style.color = 'white';
            progressText.style.marginTop = '20px';

            // Create progress bar
            const progressContainer = document.createElement('div');
            progressContainer.style.width = '80%';
            progressContainer.style.height = '4px';
            progressContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            progressContainer.style.borderRadius = '2px';
            progressContainer.style.overflow = 'hidden';
            progressContainer.style.marginTop = '10px';

            const progressBar = document.createElement('div');
            progressBar.id = 'pre-rendering-progress';
            progressBar.style.width = '0%';
            progressBar.style.height = '100%';
            progressBar.style.backgroundColor = '#3498db';
            progressBar.style.transition = 'width 0.3s ease-out'; // Smoother transition

            progressContainer.appendChild(progressBar);

            // Assemble the loading overlay
            loadingContent.appendChild(loadingTitle);
            loadingContent.appendChild(spinnerContainer);
            loadingContent.appendChild(progressText);
            loadingContent.appendChild(progressContainer);
            loadingOverlay.appendChild(loadingContent);
            canvasContainer.appendChild(loadingOverlay);

            // Initialize the preview first, but don't start animation yet
            // Pass false for createInfoPanel to prevent creating the info panel until pre-rendering is complete
            initializePreview(previewMode, canvasContainer, renderIframe, currentMeshId, false, false);

            // Start pre-rendering with a callback for when it's done
            startPreRendering(renderIframe, () => {
                // The callback is now called from the final animation completion
                console.log('Pre-rendering complete callback executed');
            }, progressBar);
        };

        // Write content to iframe
        try {
            renderIframe.srcdoc = sanitizedHtml;
        } catch (error) {
            console.error('Error setting iframe srcdoc:', error);
            // Fallback method
            renderIframe.contentDocument.open();
            renderIframe.contentDocument.write(sanitizedHtml);
            renderIframe.contentDocument.close();
        }
    } catch (error) {
        logPreviewError(`Preview error: ${error.message}`);
        console.error('HTML Preview error:', error);
        showStatus('Error generating preview: ' + error.message, 'error');
    }
}

/**
 * Log errors to the preview error console
 * @param {string} message - Error message to display
 */
function logPreviewError(message) {
    const errorLog = document.getElementById('html-preview-error-log') || 
                     document.createElement('div');
    
    if (!errorLog.id) {
        errorLog.id = 'html-preview-error-log';
        errorLog.className = 'preview-error-log';
        
        const previewContent = document.getElementById('html-preview-content');
        if (previewContent) {
            previewContent.appendChild(errorLog);
        }
    }
    
    // Make error log visible
    errorLog.style.display = 'block';
    
    // Create error entry
    const errorEntry = document.createElement('div');
    errorEntry.className = 'error-entry';
    errorEntry.textContent = message;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'error-time';
    timeSpan.textContent = `[${timestamp}] `;
    errorEntry.prepend(timeSpan);
    
    // Add to log
    errorLog.appendChild(errorEntry);
    
    // Show the error in the editor status as well
    showStatus(message, 'error');
    
    console.error(message);
}

/**
 * Set the isPreviewAnimationPaused flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsPreviewAnimationPaused(incomingValue) {
    isPreviewAnimationPaused = incomingValue;
}

/**
 * Set the lastTextureUpdateTime
 * @param {number} incomingValue - The new value to set
 */
export function setLastTextureUpdateTime(incomingValue) {
    lastTextureUpdateTime = incomingValue;
}


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
        try {
            if (infoPanel.parentNode) {
                infoPanel.parentNode.removeChild(infoPanel);
            }
        } catch (e) {
            console.log('Error removing existing info panel:', e);
        }
        infoPanel = null;
    }
    
    // Get mesh data from state
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        console.warn(`No mesh data found for mesh ID ${meshId}`);
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
    
    // Basic mesh info
    info.push(`<strong>Name:</strong> ${mesh.name || 'Unnamed'}`);
    info.push(`<strong>ID:</strong> ${meshId}`);
    
    // Geometry details
    if (mesh.geometry) {
        info.push('<strong>Geometry:</strong>');
        
        // Vertices count
        const vertexCount = mesh.geometry.attributes && mesh.geometry.attributes.position ? 
            mesh.geometry.attributes.position.count : 'Unknown';
        info.push(`• Vertices: ${vertexCount}`);
        
        // Faces count (triangles)
        let faceCount = 'Unknown';
        if (mesh.geometry.index) {
            faceCount = Math.floor(mesh.geometry.index.count / 3);
        } else if (mesh.geometry.attributes && mesh.geometry.attributes.position) {
            faceCount = Math.floor(mesh.geometry.attributes.position.count / 3);
        }
        info.push(`• Faces: ${faceCount}`);
        
        // Geometry type
        info.push(`• Type: ${mesh.geometry.type || 'Unknown'}`);
    }
    
    // Material details
    if (mesh.material) {
        info.push('<strong>Material:</strong>');
        
        // Handle multiple materials
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        info.push(`• Count: ${materials.length}`);
        
        // Material properties
        materials.forEach((material, index) => {
            if (materials.length > 1) {
                info.push(`• Material ${index + 1}:`);
            }
            
            info.push(`  • Type: ${material.type || 'Unknown'}`);
            info.push(`  • Double Sided: ${material.side === THREE.DoubleSide ? 'Yes' : 'No'}`);
            info.push(`  • Transparent: ${material.transparent ? 'Yes' : 'No'}`);
            
            // Color if available
            if (material.color) {
                const colorHex = '#' + material.color.getHexString();
                info.push(`  • Color: <span style="color:${colorHex}">■</span> ${colorHex}`);
            }
        });
    }
    
    // Transform information
    info.push('<strong>Transform:</strong>');
    info.push(`• Position: X:${mesh.position.x.toFixed(2)}, Y:${mesh.position.y.toFixed(2)}, Z:${mesh.position.z.toFixed(2)}`);
    info.push(`• Rotation: X:${(mesh.rotation.x * 180 / Math.PI).toFixed(2)}°, Y:${(mesh.rotation.y * 180 / Math.PI).toFixed(2)}°, Z:${(mesh.rotation.z * 180 / Math.PI).toFixed(2)}°`);
    info.push(`• Scale: X:${mesh.scale.x.toFixed(2)}, Y:${mesh.scale.y.toFixed(2)}, Z:${mesh.scale.z.toFixed(2)}`);
    
    // HTML settings
    const htmlSettings = getHtmlSettingsForMesh(meshId);
    if (htmlSettings) {
        info.push('<strong>HTML Settings:</strong>');
        info.push(`• Render Mode: ${htmlSettings.previewMode || 'threejs'}`);
        info.push(`• Playback Speed: ${htmlSettings.playbackSpeed || '1.0'}`);
        info.push(`• Animation: ${htmlSettings.animation?.type || 'none'}`);
    }
    
    // Add any custom user data
    if (mesh.userData && Object.keys(mesh.userData).length > 0) {
        info.push('<strong>Custom Data:</strong>');
        
        // Filter out htmlSettings which we already displayed
        const userDataKeys = Object.keys(mesh.userData).filter(key => key !== 'htmlSettings');
        
        if (userDataKeys.length > 0) {
            userDataKeys.forEach(key => {
                const value = mesh.userData[key];
                info.push(`• ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
            });
        } else {
            info.push('• No custom data');
        }
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
 * Set the isPreviewActive flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsPreviewActive(incomingValue) {
    isPreviewActive = incomingValue;
}

/**
 * Reset info panel to null
 */
export function resetInfoPanel() {
    infoPanel = null;
}

