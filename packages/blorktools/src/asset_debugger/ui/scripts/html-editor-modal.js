/**
 * Embedded HTML Editor Modal
 * 
 * This module handles the functionality of the embedded HTML editor.
 * It allows users to add custom HTML code to a mesh.
 */

import { getState, updateState } from '../../core/state.js';
import { 
    getBinaryBufferForMesh, 
    associateBinaryBufferWithMesh
} from '../../core/glb-utils.js';
import { 
    deserializeStringFromBinary, 
    serializeStringToBinary,
    isValidHtml,
    sanitizeHtml
} from '../../core/string-serder.js';
import { 
    formatHtml as externalFormatHtml, 
    initHtmlFormatter,
    hasExternalFormatter 
} from '../../core/html-formatter.js';
import {
    lintHtml,
    initHtmlLinter,
    hasExternalLinter
} from '../../core/html-linter.js';
import { getCurrentGlbBuffer, updateGlbFile } from './model-integration.js';
import { updateHtmlIcons } from './mesh-panel.js';

// Import Three.js the same way as other files in the codebase
import * as THREE from 'three';

// Store HTML content for each mesh
const meshHtmlContent = new Map();

// Store HTML settings for each mesh (integrated from mesh-settings-modal.js)
const meshHtmlSettings = new Map();

// Default settings for HTML content (integrated from mesh-settings-modal.js)
const defaultSettings = {
    previewMode: 'threejs',
    playbackSpeed: 1.0,
    animation: {
        type: 'none',
        enabled: false
    },
    display: {
        showBorders: true
    }
};

// Flag to track if event listeners have been initialized
let listenersInitialized = false;

// Store HTML editor state to restore after mesh settings modal closes
let htmlEditorState = {
    isOpen: false
};

// Store current lint errors
let currentLintErrors = [];

// Debounce timer for linting
let lintDebounceTimer = null;

// Three.js variables for preview
let previewScene, previewCamera, previewRenderer, previewPlane;
let previewAnimationId = null;
let previewRenderTarget = null;
let isPreviewAnimationPaused = false;
let lastTextureUpdateTime = 0;
let textureUpdateInterval = 16; // Update texture every 16ms (approximately 60fps) for smoother animation
let isPreviewActive = false; // Track if preview is currently active

// Add variables for CSS3D rendering
let css3dScene, css3dRenderer, css3dObject;
let webglScene, webglRenderer;
let combinedRenderRequired = false;

// Add at the top of the file, with other variables
let lastFrameTime = 0;
const targetFrameRate = 60; // Target 60 FPS for better performance/animation balance
const frameInterval = 1000 / targetFrameRate;
let pendingTextureUpdate = false;

// Info panel state variables
let infoPanel = null;
let infoPanelCollapsed = false;
let infoPanelPosition = { x: 10, y: 10 }; // Default position in top-left corner

/**
 * Open the HTML Editor Modal for a specific mesh
 * @param {string} meshName - The name of the mesh
 * @param {number} meshId - The ID/index of the mesh
 */
export function openEmbeddedHtmlEditor(meshName, meshId) {
    console.log(`openEmbeddedHtmlEditor called for mesh: ${meshName} (ID: ${meshId})`);
    
    try {
        const modal = document.getElementById('html-editor-modal');
        if (!modal) {
            console.error('HTML Editor Modal element not found in the DOM');
            alert('Error: Could not find HTML Editor Modal. Please try again.');
            return;
        }
        
        const meshNameEl = document.getElementById('html-editor-mesh-name');
        const textarea = document.getElementById('html-editor-textarea');
        const previewContainer = document.getElementById('html-preview-container');
        const statusEl = document.getElementById('html-editor-status');
        
        console.log('Found all required modal elements:', {
            modal: !!modal,
            meshNameEl: !!meshNameEl,
            textarea: !!textarea,
            previewContainer: !!previewContainer
        });
        
        // Set mesh name in the modal title
        if (meshNameEl) meshNameEl.textContent = meshName;
        
        // Store the mesh ID in the modal's dataset
        modal.dataset.meshId = meshId;
        
        // Load HTML content for this mesh
        loadHtmlForMesh(meshId).then(html => {
            if (textarea) textarea.value = html || '';
            
            // Ensure we're not in preview mode when opening the editor
            modal.classList.remove('preview-mode');
            
            // Show the modal by adding the visible class
            modal.classList.add('visible');
            htmlEditorState.isOpen = true;
            console.log('HTML Editor Modal opened successfully');
            
            // Load and set settings for this mesh
            loadSettingsForMesh(meshId);
            
            // Run linting after content is loaded
            lintHtmlContent();
        }).catch(error => {
            console.error('Error loading HTML content:', error);
            if (textarea) textarea.value = '';
            if (statusEl) showStatus(`Error loading HTML: ${error.message}`, 'error');
            
            // Ensure we're not in preview mode when opening the editor
            modal.classList.remove('preview-mode');
            
            // Still show the modal even if loading fails
            modal.classList.add('visible');
            htmlEditorState.isOpen = true;
        });
    } catch (error) {
        console.error('Error opening HTML Editor Modal:', error);
        alert('Failed to open HTML Editor. See console for details.');
    }
}

/**
 * Load settings for a specific mesh and update the UI
 * @param {number} meshId - The ID/index of the mesh
 */
function loadSettingsForMesh(meshId) {
    // Get settings for this mesh or use defaults
    const settings = meshHtmlSettings.get(meshId) || { ...defaultSettings };
    
    // Update render type dropdown
    const renderTypeSelect = document.getElementById('html-render-type');
    if (renderTypeSelect) {
        renderTypeSelect.value = settings.previewMode || defaultSettings.previewMode;
    }
    
    // Update animation type dropdown
    const animationTypeSelect = document.getElementById('html-animation-type');
    if (animationTypeSelect) {
        const animationType = settings.animation && settings.animation.type !== undefined 
            ? settings.animation.type 
            : 'none';
        animationTypeSelect.value = animationType;
    }
    
    // Update show borders checkbox
    const showWireframeCheckbox = document.getElementById('show-wireframe');
    if (showWireframeCheckbox && settings.display) {
        showWireframeCheckbox.checked = settings.display.showBorders !== undefined 
            ? settings.display.showBorders 
            : true;
        window.showPreviewBorders = showWireframeCheckbox.checked;
    }
}

/**
 * Get HTML settings for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @returns {Object} The HTML settings for the mesh, or default settings if not found
 */
export function getHtmlSettingsForMesh(meshId) {
    return meshHtmlSettings.get(meshId) || { ...defaultSettings };
}

/**
 * Get settings from form dropdowns
 * @returns {Object} The settings object
 */
function getSettingsFromForm() {
    const animationType = document.getElementById('html-animation-type').value;
    const showWireframeCheckbox = document.getElementById('show-wireframe');
    
    return {
        previewMode: document.getElementById('html-render-type').value || defaultSettings.previewMode,
        playbackSpeed: parseFloat(document.getElementById('html-playback-speed').value),
        animation: {
            type: animationType,
            enabled: animationType !== 'none'
        },
        display: {
            showBorders: showWireframeCheckbox ? showWireframeCheckbox.checked : true
        }
    };
}

/**
 * Save settings for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @param {Object} settings - The settings to save
 */
function saveSettingsForMesh(meshId, settings) {
    meshHtmlSettings.set(meshId, settings);
    
    const state = getState();
    if (state.meshes && state.meshes[meshId]) {
        // Store settings in mesh userData for persistence
        if (!state.meshes[meshId].userData) {
            state.meshes[meshId].userData = {};
        }
        state.meshes[meshId].userData.htmlSettings = settings;
        console.log(`Saved HTML settings for mesh: ${state.meshes[meshId].name}`);
    }
}

/**
 * Load HTML content for a specific mesh from GLB binary buffer
 * @param {number} meshId - The ID/index of the mesh
 * @returns {Promise<string>} The HTML content for the mesh
 */
async function loadHtmlForMesh(meshId) {
    // First check if we have cached content
    const cachedHtml = meshHtmlContent.get(meshId);
    if (cachedHtml !== undefined) {
        return cachedHtml;
    }
    
    // No cached content, try to load from GLB
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        console.warn('No GLB buffer available to load HTML from');
        return '';
    }
    
    try {
        // Get binary buffer for this mesh
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshId);
        
        // If no buffer found, return empty string
        if (!binaryBuffer) {
            console.log(`No binary data found for mesh ID ${meshId}`);
            return '';
        }
        
        // Deserialize buffer to HTML/text content
        let content = deserializeStringFromBinary(binaryBuffer);
        
        // Validate the content
        if (!content || content.trim() === '') {
            content = ''; // Ensure it's an empty string, not null or undefined
        } else {
            console.log(`Loaded content for mesh ID ${meshId}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
        }
        
        // Cache the content if it's not empty
        if (content && content.trim() !== '') {
            meshHtmlContent.set(meshId, content);
            console.log(`Successfully loaded content for mesh ID ${meshId}`);
        } else {
            // If empty, ensure we remove any cached content
            meshHtmlContent.delete(meshId);
            console.log(`No valid content found for mesh ID ${meshId}`);
        }
        
        return content;
    } catch (error) {
        console.error('Error loading content from binary buffer:', error);
        throw new Error(`Failed to load data: ${error.message}`);
    }
}

/**
 * Initialize the HTML Editor Modal
 */
export function initHtmlEditorModal() {
    console.log('Initializing HTML Editor Modal');
    
    // Initialize the HTML formatter and linter
    Promise.all([
        initHtmlFormatter().then(() => {
            console.log('HTML formatter initialized');
        }),
        initHtmlLinter().then(() => {
            console.log('HTML linter initialized');
        })
    ]).catch(error => {
        console.warn('Error initializing HTML tools:', error);
    });
    
    // Get modal elements
    const modal = document.getElementById('html-editor-modal');
    const closeBtn = document.getElementById('html-editor-close');
    const cancelBtn = document.getElementById('html-editor-cancel');
    const saveBtn = document.getElementById('html-editor-save');
    const formatBtn = document.getElementById('html-editor-format');
    const previewBtn = document.getElementById('html-editor-preview');
    const resetBtn = document.getElementById('html-editor-reset');
    const textarea = document.getElementById('html-editor-textarea');
    const previewContainer = document.getElementById('html-preview-container');
    const previewContent = document.getElementById('html-preview-content');
    const statusEl = document.getElementById('html-editor-status');
    const errorContainer = document.getElementById('html-editor-errors') || createErrorContainer();
    const dropdownsContainer = document.getElementById('editor-dropdowns-container');
    
    // Get new dropdown elements
    const renderTypeSelect = document.getElementById('html-render-type');
    const playbackSpeedSelect = document.getElementById('html-playback-speed');
    const animationTypeSelect = document.getElementById('html-animation-type');
    
    // Get additional UI controls
    const showWireframeCheckbox = document.getElementById('show-wireframe');
    
    // Default state for wireframe display
    window.showPreviewBorders = showWireframeCheckbox ? showWireframeCheckbox.checked : true;
    
    // Make the modal available globally - do this first before any potential errors
    window.openEmbeddedHtmlEditor = openEmbeddedHtmlEditor;
    window.getHtmlSettingsForMesh = getHtmlSettingsForMesh;
    console.log('Registered global function: window.openEmbeddedHtmlEditor =', 
                typeof window.openEmbeddedHtmlEditor === 'function' ? 'Function successfully registered' : 'Failed to register function');

    if (!modal) {
        console.error('HTML Editor Modal not found in the DOM');
        return;
    }

    // Only register event listeners once
    if (listenersInitialized) {
        console.log('HTML Editor Modal event listeners already initialized, skipping');
        return;
    }

    // Close modal events
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside (on the overlay)
    modal.addEventListener('click', function(e) {
        // Check if the click was directly on the modal (overlay) and not on its children
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Add event listeners for dropdown changes
    if (renderTypeSelect) {
        renderTypeSelect.addEventListener('change', () => {
            // Update settings when user changes render type
            const meshId = parseInt(modal.dataset.meshId);
            if (!isNaN(meshId)) {
                const settings = getSettingsFromForm();
                saveSettingsForMesh(meshId, settings);
                showStatus(`Render type set to: ${renderTypeSelect.options[renderTypeSelect.selectedIndex].text}`, 'info');
            }
        });
    }
    
    if (playbackSpeedSelect) {
        playbackSpeedSelect.addEventListener('change', () => {
            // Update settings when user changes playback speed
            const meshId = parseInt(modal.dataset.meshId);
            if (!isNaN(meshId)) {
                const settings = getSettingsFromForm();
                saveSettingsForMesh(meshId, settings);
                
                // Get the new playback speed
                const newPlaybackSpeed = parseFloat(playbackSpeedSelect.value);
                
                // Update CSS3D preview if active
                if (isPreviewActive) {
                    try {
                        // For CSS3D preview - update animation speed via CSS
                        const css3dIframe = document.getElementById('css3d-panel-iframe');
                        if (css3dIframe && css3dIframe.contentDocument) {
                            const styleEl = css3dIframe.contentDocument.querySelector('style');
                            if (styleEl) {
                                // Update animation-duration and transition-duration
                                styleEl.textContent = styleEl.textContent.replace(
                                    /animation-duration:\s*[^;]+/,
                                    `animation-duration: ${1.0/newPlaybackSpeed}s !important`
                                ).replace(
                                    /transition-duration:\s*[^;]+/,
                                    `transition-duration: ${1.0/newPlaybackSpeed}s !important`
                                );
                            }
                        }
                        
                        // Force texture update for texture-based preview
                        lastTextureUpdateTime = 0;
                        textureUpdateInterval = Math.max(1, Math.floor(16 / newPlaybackSpeed));
                    } catch (err) {
                        console.debug('Error updating playback speed in preview:', err);
                    }
                }
                
                showStatus(`Playback speed set to: ${playbackSpeedSelect.options[playbackSpeedSelect.selectedIndex].text}`, 'info');
            }
        });
    }
    
    if (animationTypeSelect) {
        animationTypeSelect.addEventListener('change', () => {
            // Update settings when user changes animation type
            const meshId = parseInt(modal.dataset.meshId);
            if (!isNaN(meshId)) {
                const settings = getSettingsFromForm();
                saveSettingsForMesh(meshId, settings);
                showStatus(`Animation type set to: ${animationTypeSelect.options[animationTypeSelect.selectedIndex].text}`, 'info');
            }
        });
    }
    
    // Show Borders checkbox
    if (showWireframeCheckbox) {
        showWireframeCheckbox.addEventListener('change', () => {
            window.showPreviewBorders = showWireframeCheckbox.checked;
            
            // If preview is active, update it immediately
            if (isPreviewActive && previewRenderTarget) {
                // Force a texture update
                lastTextureUpdateTime = 0;
                showStatus(`Borders ${showWireframeCheckbox.checked ? 'enabled' : 'disabled'}`, 'info');
            }
        });
    }
    
    // Format button
    formatBtn.addEventListener('click', async () => {
        try {
            // Check if there's a selection
            const selectionStart = textarea.selectionStart;
            const selectionEnd = textarea.selectionEnd;
            const hasSelection = selectionStart !== selectionEnd;
            
            let htmlToFormat, formattedHtml;
            
            if (hasSelection) {
                // Format only the selected text
                htmlToFormat = textarea.value.substring(selectionStart, selectionEnd);
            } else {
                // Format the entire content
                htmlToFormat = textarea.value;
            }
            
            // Use the formatter
            formattedHtml = await externalFormatHtml(htmlToFormat);
            
            if (hasSelection) {
                // Replace only the selected portion
                textarea.value = 
                    textarea.value.substring(0, selectionStart) + 
                    formattedHtml + 
                    textarea.value.substring(selectionEnd);
                
                // Restore selection (approximately, as formatting changes length)
                textarea.selectionStart = selectionStart;
                textarea.selectionEnd = selectionStart + formattedHtml.length;
            } else {
                // Replace the entire content
                textarea.value = formattedHtml;
            }
            
            showStatus(`${hasSelection ? 'Selection' : 'HTML'} formatted successfully`, 'success');
            
            // Run linting after formatting
            lintHtmlContent();
        } catch (error) {
            showStatus('Error formatting HTML: ' + error.message, 'error');
        }
    });
    
    // Add linting on input
    textarea.addEventListener('input', () => {
        // Debounce the linting to avoid performance issues
        clearTimeout(lintDebounceTimer);
        lintDebounceTimer = setTimeout(() => {
            lintHtmlContent();
        }, 500); // Wait 500ms after typing stops
    });
    
    // Preview button
    previewBtn.addEventListener('click', () => {
        try {
            // Generate the preview
            previewHtml(textarea.value);
            
            // Add preview mode class to modal for CSS control
            modal.classList.add('preview-mode');
            
            // Show a message about the current preview mode
            const renderTypeSelect = document.getElementById('html-render-type');
            if (renderTypeSelect) {
                const previewMode = renderTypeSelect.options[renderTypeSelect.selectedIndex].text;
                showStatus(`Preview mode: ${previewMode}`, 'info');
            }
        } catch (error) {
            showStatus('Error generating preview: ' + error.message, 'error');
        }
    });
    
    // Reset button
    resetBtn.addEventListener('click', () => {
        // Remove preview mode class from modal
        modal.classList.remove('preview-mode');
        
        // Clean up Three.js resources
        cleanupThreeJsPreview();
        
        // Clean up any direct preview iframe
        const directPreviewIframe = document.getElementById('html-preview-content').querySelector('iframe');
        if (directPreviewIframe) {
            try {
                if (directPreviewIframe.contentDocument) {
                    directPreviewIframe.contentDocument.open();
                    directPreviewIframe.contentDocument.write('');
                    directPreviewIframe.contentDocument.close();
                }
                directPreviewIframe.remove();
            } catch (error) {
                console.debug('Error cleaning up direct preview iframe:', error);
            }
        }
        
        // Clean up any control buttons
        const controlsContainer = document.getElementById('html-preview-content').querySelector('.preview-controls');
        if (controlsContainer) {
            controlsContainer.remove();
        }
        
        showStatus('Editor view restored', 'info');
    });
    
    // Save button
    saveBtn.addEventListener('click', async () => {
        try {
            const currentMeshId = modal.dataset.meshId;
            if (currentMeshId) {
                const html = textarea.value;
                
                // Save HTML content
                await saveHtmlForMesh(parseInt(currentMeshId), html);
                
                // Save current settings
                const settings = getSettingsFromForm();
                saveSettingsForMesh(parseInt(currentMeshId), settings);
                
                // Update HTML icons to reflect the new state
                updateHtmlIcons();
                
                closeModal();
                showStatus('HTML saved successfully', 'success');
            }
        } catch (error) {
            showStatus('Error saving HTML: ' + error.message, 'error');
        }
    });
    
    // Make textarea tab-friendly
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            
            // Insert tab character at cursor position
            this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
            
            // Put cursor after the inserted tab
            this.selectionStart = this.selectionEnd = start + 4;
        }
    });
    
    // Initial setup for the modal - rely on CSS classes instead of direct style manipulation
    
    // Set flag to indicate listeners have been initialized
    listenersInitialized = true;
    console.log('HTML Editor Modal event listeners initialized successfully');
}

/**
 * Close the HTML Editor Modal
 */
function closeModal() {
    const modal = document.getElementById('html-editor-modal');
    modal.classList.remove('visible');
    htmlEditorState.isOpen = false;
    
    // Clean up Three.js resources when closing the modal
    cleanupThreeJsPreview();
}

/**
 * Show a status message in the editor
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error', 'info')
 */
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('html-editor-status');
    statusEl.textContent = message;
    statusEl.className = `editor-status ${type}`;
    
    // Clear the message after 5 seconds for important messages, 3 seconds for others
    const delay = (type === 'success' || type === 'error') ? 5000 : 3000;
    
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'editor-status';
    }, delay);
}

/**
 * Preview HTML code using Three.js
 * @param {string} html - The HTML code to preview
 */
function previewHtml(html) {
    const previewContent = document.getElementById('html-preview-content');
    if (!previewContent) return;
    
    try {
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);
        
        // Get preview mode from render type dropdown
        const renderTypeSelect = document.getElementById('html-render-type');
        let previewMode = renderTypeSelect ? renderTypeSelect.value : 'threejs';
        
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
        previewRenderTarget = renderIframe;
        
        // Make sure the preview content container has proper positioning for absolute children
        previewContent.style.position = 'relative';
        previewContent.style.minHeight = '400px';
        previewContent.style.height = '100%';
        
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
            
            // Initialize preview based on mode
            if (previewMode === 'css3d') {
                showStatus('Initializing CSS3D preview mode...', 'info');
                // Get the iframe that may have been created earlier, or create a new one if needed
                const directPreviewIframe = document.createElement('iframe');
                initCSS3DPreview(canvasContainer, directPreviewIframe.cloneNode(true));
            } else {
                // Default to threejs mode
                showStatus('Initializing 3D cube preview...', 'info');
                initThreeJsPreview(canvasContainer, renderIframe);
            }
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
 * Initialize Three.js for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 */
function initThreeJsPreview(container, iframe) {
    try {
        // We already have THREE imported at the top of the file
        console.log('Using imported Three.js module');
        
        // Only need to load html2canvas
        loadHtml2Canvas(() => {
            setupThreeJsScene(container, iframe);
        });
    } catch (error) {
        console.error('Error initializing Three.js preview:', error);
        logPreviewError(`Three.js initialization error: ${error.message}`);
    }
}

/**
 * Load html2canvas library
 * @param {Function} callback - Function to call when loading is complete
 */
function loadHtml2Canvas(callback) {
    // Check if html2canvas is already loaded
    if (typeof window.html2canvas !== 'undefined') {
        callback();
        return;
    }
    
    // Check if it's already being loaded
    if (document.querySelector('script[src*="html2canvas"]')) {
        const checkInterval = setInterval(() => {
            if (typeof window.html2canvas !== 'undefined') {
                clearInterval(checkInterval);
                callback();
            }
        }, 100);
        return;
    }
    
    // Load html2canvas
    console.log('Loading html2canvas library');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = callback;
    script.onerror = (error) => {
        console.error('Failed to load html2canvas:', error);
    };
    document.head.appendChild(script);
}

/**
 * Set up the Three.js scene for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 */
function setupThreeJsScene(container, iframe) {
    try {
        // Create scene with dark gray background
        previewScene = new THREE.Scene();
        previewScene.background = new THREE.Color(0x303030); // Dark gray background like Unreal Editor
        
        // Create camera
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        // Use perspective camera for better 3D viewing
        previewCamera = new THREE.PerspectiveCamera(
            60, containerAspectRatio, 0.1, 1000
        );
        previewCamera.position.z = 3;
        
        // Create renderer with enhanced quality settings
        previewRenderer = new THREE.WebGLRenderer({ 
            antialias: true,
            preserveDrawingBuffer: true // Preserve the buffer for screenshots
        });
        previewRenderer.setSize(containerWidth, containerHeight);
        previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
        previewRenderer.setClearColor(0x303030); // Set clear color to dark gray
        previewRenderer.outputEncoding = THREE.sRGBEncoding; // Use sRGB encoding for better color accuracy
        
        // Performance optimizations
        previewRenderer.shadowMap.enabled = false; // Disable shadows for performance
        
        // Ensure the renderer canvas fits perfectly in the container
        const rendererCanvas = previewRenderer.domElement;
        rendererCanvas.style.display = 'block';
        rendererCanvas.style.width = '100%';
        rendererCanvas.style.height = '100%';
        container.appendChild(rendererCanvas);
        
        // Create a render target for the iframe
        previewRenderTarget = iframe;
        
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);
        
        // Create info panel
        createInfoPanel(container, currentMeshId);
        
        // Create initial texture from iframe content with improved quality
        createTextureFromIframe(iframe).then(texture => {
            // Get the mesh from the state if available
            const state = getState();
            const originalMesh = state.meshes && state.meshes[currentMeshId];
            let geometry;
            
            if (originalMesh && originalMesh.geometry) {
                try {
                    // Try to use the original mesh geometry
                    geometry = originalMesh.geometry.clone();
                    console.log("Using original mesh geometry for preview");
                    
                    // Detect if this is a rectangle/plane-like mesh
                    const isPlaneOrRectangle = geometry.attributes.position.count <= 8; // 4 vertices (8 corners) usually indicates a plane/rectangle
                    
                    // Variables to store mesh analysis results - defined in this scope to be accessible later
                    let dominantPlane = 'xy';
                    let normalVector = new THREE.Vector3(0, 0, 1);
                    let upVector = new THREE.Vector3(0, 1, 0);
                    
                    // Find the dominant axis and create appropriate UVs
                    if (geometry.attributes.position) {
                        // Analyze the geometry to find the dominant plane
                        let minX = Infinity, maxX = -Infinity;
                        let minY = Infinity, maxY = -Infinity;
                        let minZ = Infinity, maxZ = -Infinity;
                        
                        const positions = geometry.attributes.position;
                        const count = positions.count;
                        
                        // Find bounds
                        for (let i = 0; i < count; i++) {
                            const x = positions.getX(i);
                            const y = positions.getY(i);
                            const z = positions.getZ(i);
                            
                            minX = Math.min(minX, x);
                            maxX = Math.max(maxX, x);
                            minY = Math.min(minY, y);
                            maxY = Math.max(maxY, y);
                            minZ = Math.min(minZ, z);
                            maxZ = Math.max(maxZ, z);
                        }
                        
                        // Calculate ranges
                        const rangeX = maxX - minX;
                        const rangeY = maxY - minY;
                        const rangeZ = maxZ - minZ;
                        
                        console.log(`Mesh dimensions: X: ${rangeX.toFixed(2)}, Y: ${rangeY.toFixed(2)}, Z: ${rangeZ.toFixed(2)}`);
                        
                        // Determine dominant plane based on which dimension is smallest (indicating flatness)
                        if (rangeZ < rangeX && rangeZ < rangeY) {
                            dominantPlane = 'xy'; // Flat in Z direction
                            normalVector = new THREE.Vector3(0, 0, 1);
                            upVector = new THREE.Vector3(0, 1, 0);
                        } else if (rangeY < rangeX && rangeY < rangeZ) {
                            dominantPlane = 'xz'; // Flat in Y direction
                            normalVector = new THREE.Vector3(0, 1, 0);
                            upVector = new THREE.Vector3(0, 0, 1);
                        } else {
                            dominantPlane = 'yz'; // Flat in X direction
                            normalVector = new THREE.Vector3(1, 0, 0);
                            upVector = new THREE.Vector3(0, 1, 0);
                        }
                        
                        // Try to detect "forward" and "up" by analyzing the mesh
                        if (geometry.index) {
                            // For indexed geometries, we can compute face normals
                            try {
                                geometry.computeVertexNormals();
                                // Find the most common normal direction
                                let normalSum = new THREE.Vector3(0, 0, 0);
                                
                                // If normal attribute exists, average the normals
                                if (geometry.attributes.normal) {
                                    const normals = geometry.attributes.normal;
                                    for (let i = 0; i < normals.count; i++) {
                                        normalSum.x += normals.getX(i);
                                        normalSum.y += normals.getY(i);
                                        normalSum.z += normals.getZ(i);
                                    }
                                    normalSum.divideScalar(normals.count);
                                    normalSum.normalize();
                                    
                                    // If we found a clear normal, use it
                                    if (normalSum.length() > 0.5) {
                                        normalVector = normalSum;
                                        console.log(`Detected normal vector: (${normalVector.x.toFixed(2)}, ${normalVector.y.toFixed(2)}, ${normalVector.z.toFixed(2)})`);
                                        
                                        // Find up vector (perpendicular to normal)
                                        if (Math.abs(normalVector.y) < 0.7) {
                                            // If normal is not pointing up/down, use world up as reference
                                            upVector = new THREE.Vector3(0, 1, 0);
                                            // Make sure up is perpendicular to normal
                                            upVector.sub(normalVector.clone().multiplyScalar(normalVector.dot(upVector)));
                                            upVector.normalize();
                                        } else {
                                            // If normal is pointing up/down, use world forward as reference for up
                                            upVector = new THREE.Vector3(0, 0, 1);
                                            // Make sure up is perpendicular to normal
                                            upVector.sub(normalVector.clone().multiplyScalar(normalVector.dot(upVector)));
                                            upVector.normalize();
                                        }
                                        console.log(`Calculated up vector: (${upVector.x.toFixed(2)}, ${upVector.y.toFixed(2)}, ${upVector.z.toFixed(2)})`);
                                    }
                                }
                            } catch (e) {
                                console.warn("Error computing normals:", e);
                            }
                        }
                        
                        console.log(`Using plane: ${dominantPlane}, normal: (${normalVector.x.toFixed(2)}, ${normalVector.y.toFixed(2)}, ${normalVector.z.toFixed(2)})`);
                        
                        // Create UVs based on the dominant plane
                        const uvs = new Float32Array(count * 2);
                        
                        // Define transform matrices to help with UV mapping based on orientation
                        const transformMatrix = new THREE.Matrix4();
                        
                        // Create a quaternion that aligns the normal with the +Z axis
                        const quaternion = new THREE.Quaternion().setFromUnitVectors(normalVector, new THREE.Vector3(0, 0, 1));
                        transformMatrix.makeRotationFromQuaternion(quaternion);
                        
                        // Temporary vectors for transformed coordinates
                        const tempVector = new THREE.Vector3();
                        
                        for (let i = 0; i < count; i++) {
                            const x = positions.getX(i);
                            const y = positions.getY(i);
                            const z = positions.getZ(i);
                            
                            // Transform point to orient according to detected normal
                            tempVector.set(x, y, z);
                            tempVector.applyMatrix4(transformMatrix);
                            
                            // Now we can map the transformed X,Y to U,V
                            const transformedX = tempVector.x;
                            const transformedY = tempVector.y;
                            
                            // Map to 0-1 range based on the bounds of the geometry
                            const u = (transformedX - minX) / Math.max(0.0001, rangeX);
                            const v = (transformedY - minY) / Math.max(0.0001, rangeY); // Remove the 1.0 - to fix upside down orientation
                            
                            uvs[i * 2] = u;
                            uvs[i * 2 + 1] = v;
                        }
                        
                        // Apply the UVs, replacing any existing ones
                        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                        console.log("Created custom UVs for rectangle/plane geometry");
                        
                        // Store these values for camera positioning
                        geometry.userData = geometry.userData || {};
                        geometry.userData.dominantPlane = dominantPlane;
                        geometry.userData.normalVector = normalVector;
                        geometry.userData.upVector = upVector;
                    }
                } catch (e) {
                    console.warn("Could not clone original mesh geometry, falling back to cube", e);
                    geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
                }
            } else {
                // Fallback to cube if mesh not found
                console.log("No mesh found with ID " + currentMeshId + ", using cube geometry");
                geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
            }
            
            // Create material with the HTML texture
            const material = new THREE.MeshBasicMaterial({ 
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: true,
                fog: false
            });
            
            // Create mesh
            previewPlane = new THREE.Mesh(geometry, material);
            
            // Optimize with frustum culling off (we know it's always visible)
            previewPlane.frustumCulled = false;
            
            // Add to scene
            previewScene.add(previewPlane);
            
            // Position the camera to look at the dominant face of the mesh
            if (geometry.userData && geometry.userData.normalVector) {
                const normalVector = geometry.userData.normalVector;
                const upVector = geometry.userData.upVector;
                const dominantPlane = geometry.userData.dominantPlane;
                
                // Position camera along the normal vector for optimal viewing
                const cameraPosition = normalVector.clone().multiplyScalar(2); // Closer view (was 3)
                previewCamera.position.copy(cameraPosition);
                
                // Look at the center of the mesh
                previewCamera.lookAt(0, 0, 0);
                
                // Ensure the camera's "up" direction aligns with our computed up vector
                previewCamera.up.copy(upVector);
                
                // Configure mesh orientation to present the front face to the camera
                // Create a rotation that aligns the normal with the camera view
                const lookAtMatrix = new THREE.Matrix4();
                lookAtMatrix.lookAt(
                    new THREE.Vector3(0, 0, 0),  // Object position
                    normalVector.clone().negate(), // Look at the reverse of the normal vector
                    upVector                       // Up vector
                );
                
                // Extract the rotation from the matrix
                const rotation = new THREE.Quaternion();
                rotation.setFromRotationMatrix(lookAtMatrix);
                previewPlane.quaternion.copy(rotation);
                
                console.log(`Camera positioned based on detected normal and up vectors`);
            } else if (dominantPlane) {
                // Fallback to using just the dominant plane if no normal vector
                // Position the camera based on the dominant plane
                if (dominantPlane === 'xy') {
                    // Position camera to look at the XY plane
                    previewCamera.position.set(0, 0, 3);
                    previewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, 0, 0);
                } else if (dominantPlane === 'xz') {
                    // Position camera to look at the XZ plane
                    previewCamera.position.set(0, 3, 0);
                    previewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(-Math.PI/2, 0, 0);
                } else { // yz
                    // Position camera to look at the YZ plane
                    previewCamera.position.set(3, 0, 0);
                    previewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, Math.PI/2, 0);
                }
                
                console.log(`Camera positioned to view the ${dominantPlane} plane`);
            } else {
                // Default position if no dominant plane was determined
                previewCamera.position.z = 3;
                
                // Set initial rotation but don't animate it
                previewPlane.rotation.x = Math.PI / 10;
                previewPlane.rotation.y = Math.PI / 6;
            }
            
            // Add orbit controls for better user interaction
            setupOrbitControls(previewCamera, previewRenderer.domElement)
                .then(controls => {
                    // Start animation loop after controls are set up
                    animatePreview();
                    
                    // Show helpful message about keyboard shortcuts
                    showStatus('Preview ready. Use +/- keys to zoom in/out', 'success');
                    
                    // Add keyboard shortcuts for zooming
                    const handleKeydown = (event) => {
                        if (!isPreviewActive) return;
                        
                        // Get current controls - they should be attached to the camera by this point
                        const controls = previewCamera.userData.controls;
                        if (!controls) return;
                        
                        const zoomSpeed = 0.2; // How fast to zoom with keyboard
                        
                        switch (event.key) {
                            case '+':
                            case '=': // Common + key without shift
                                // Zoom in - decrease distance to target
                                controls.dollyIn(1 + zoomSpeed);
                                controls.update();
                                break;
                            case '-':
                            case '_': // Common - key with shift
                                // Zoom out - increase distance to target
                                controls.dollyOut(1 + zoomSpeed);
                                controls.update();
                                break;
                        }
                    };
                    
                    // Register keyboard handler
                    document.addEventListener('keydown', handleKeydown);
                    
                    // Store for cleanup
                    previewCamera.userData.keyHandler = handleKeydown;
                })
                .catch(error => {
                    console.error('Failed to setup orbit controls:', error);
                    // Still start animation even if controls fail
                    animatePreview();
                });
        }).catch(error => {
            console.error('Error creating texture from iframe:', error);
            showStatus('Error creating texture from HTML: ' + error.message, 'error');
            // Still try to start animation with fallback texture
            animatePreview();
        });
        
        // Handle window resize
        window.addEventListener('resize', onPreviewResize);
    } catch (error) {
        console.error('Error setting up Three.js scene:', error);
        showStatus('Error in Three.js scene setup: ' + error.message, 'error');
    }
}

/**
 * Setup OrbitControls for camera interaction
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element to attach controls to
 * @returns {Promise<THREE.OrbitControls>} A promise that resolves to orbit controls
 */
function setupOrbitControls(camera, domElement) {
    return new Promise((resolve, reject) => {
        try {
            // Import OrbitControls dynamically
            import('three/examples/jsm/controls/OrbitControls.js')
                .then(module => {
                    const { OrbitControls } = module;
                    
                    // Create controls
                    const controls = new OrbitControls(camera, domElement);
                    controls.enableDamping = true;
                    controls.dampingFactor = 0.2;
                    controls.rotateSpeed = 0.5;
                    controls.minDistance = 0.5; // Allow much closer zooming for WebGL
                    controls.maxDistance = 20;  // Allow zooming out for WebGL
                    controls.zoomSpeed = 1.2;   // Faster zoom
                    
                    // Store controls with camera for access elsewhere
                    camera.userData = camera.userData || {};
                    camera.userData.controls = controls;
                    
                    resolve(controls);
                })
                .catch(error => {
                    console.error('Error loading OrbitControls:', error);
                    reject(error);
                });
        } catch (error) {
            console.error('Error setting up OrbitControls:', error);
            reject(error);
        }
    });
}

/**
 * Animation loop for the Three.js preview
 */
function animatePreview() {
    // If preview is no longer active, don't continue the animation loop
    if (!isPreviewActive) {
        console.log('Preview no longer active, stopping animation loop');
        return;
    }
    
    // Schedule next frame immediately for high priority
    previewAnimationId = requestAnimationFrame(animatePreview);
    
    try {
        // Throttle to target framerate
        const now = performance.now();
        const elapsed = now - lastFrameTime;
        
        if (elapsed < frameInterval) {
            return; // Skip rendering this frame if we're ahead of schedule
        }
        
        // Calculate actual FPS for monitoring (once per second)
        if (now - lastFrameTime > 1000) {
            console.log(`Current framerate: ${Math.round(1000 / elapsed)} FPS`);
        }
        
        // Remember last frame time for throttling
        lastFrameTime = now - (elapsed % frameInterval);
        
        // Apply any animation effects to the mesh based on settings
        if (previewPlane) {
            // Get current mesh ID from the modal
            const modal = document.getElementById('html-editor-modal');
            const currentMeshId = parseInt(modal.dataset.meshId);
            
            // Get animation settings for this mesh
            const settings = getHtmlSettingsForMesh(currentMeshId);
            const animationType = settings.animation?.type || 'none';
            const playbackSpeed = settings.playbackSpeed || 1.0;
            
            // Apply animation based on type
            if (animationType !== 'none' && !isPreviewAnimationPaused) {
                const rotationSpeed = 0.005 * playbackSpeed;
                const time = performance.now() * 0.001;
                
                // Get the geometry's orientation data
                const geometry = previewPlane.geometry;
                const hasOrientationData = geometry && geometry.userData && geometry.userData.normalVector;
                
                switch (animationType) {
                    case 'loop':
                        if (hasOrientationData) {
                            // For oriented meshes, animate in a way that respects the face orientation
                            const normalVector = geometry.userData.normalVector;
                            const upVector = geometry.userData.upVector;
                            
                            // Create a rotation axis perpendicular to the normal
                            const rightVector = new THREE.Vector3().crossVectors(normalVector, upVector).normalize();
                            
                            // Create a quaternion for small rotations
                            const wobbleAmount = 0.05; // Smaller angle for subtle effect
                            const wobbleQuaternion = new THREE.Quaternion().setFromAxisAngle(
                                rightVector,
                                Math.sin(time * rotationSpeed * 5) * wobbleAmount
                            );
                            
                            // Apply this rotation relative to the mesh's base orientation
                            const baseQuaternion = previewPlane._baseQuaternion || previewPlane.quaternion.clone();
                            previewPlane._baseQuaternion = baseQuaternion;
                            
                            // Combine the base orientation with the animation
                            previewPlane.quaternion.copy(baseQuaternion).multiply(wobbleQuaternion);
                        } else {
                            // Fallback for meshes without orientation data
                            previewPlane.rotation.y = Math.PI / 6 + Math.sin(time * rotationSpeed * 5) * 0.2;
                        }
                        break;
                    case 'bounce':
                        if (hasOrientationData) {
                            // For oriented meshes, bounce along the normal vector
                            const normalVector = geometry.userData.normalVector;
                            const bounceOffset = Math.sin(time * rotationSpeed * 3) * 0.1;
                            const bounceVector = normalVector.clone().multiplyScalar(bounceOffset);
                            
                            // Apply bounce to position
                            previewPlane.position.copy(bounceVector);
                        } else {
                            // Fallback bounce for non-oriented meshes
                            previewPlane.position.y = Math.sin(time * rotationSpeed * 3) * 0.1;
                        }
                        break;
                    case 'longExposure':
                        // For long exposure, we update the texture more frequently
                        textureUpdateInterval = 8; // Update texture very frequently
                        break;
                    default:
                        textureUpdateInterval = 16; // Default update interval
                }
            }
        }
        
        // Control the texture update rate based on playback speed
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);
        const settings = getHtmlSettingsForMesh(currentMeshId);
        const playbackSpeed = settings.playbackSpeed || 1.0;
        
        // Adjust texture update interval based on playback speed
        // Slower playback = less frequent updates, faster playback = more frequent updates
        const baseInterval = 16; // Base interval at 1x speed (60fps)
        const adjustedInterval = Math.max(1, Math.floor(baseInterval / playbackSpeed));
        
        // Request texture update if it's time and we're not already processing one
        const currentTime = Date.now();
        if (!isPreviewAnimationPaused && previewPlane && previewRenderTarget && 
            !pendingTextureUpdate &&
            (currentTime - lastTextureUpdateTime > adjustedInterval)) {
            
            // Schedule texture update for when browser is idle
            pendingTextureUpdate = true;
            
            // Use requestIdleCallback if available, otherwise setTimeout
            const scheduleIdleTask = window.requestIdleCallback || 
                                    (callback => setTimeout(callback, 1));
            
            scheduleIdleTask(() => {
                // Update the last time
                lastTextureUpdateTime = Date.now();
                
                // Check if iframe is still valid before trying to update texture
                if (previewRenderTarget && document.body.contains(previewRenderTarget)) {
                    // Update texture from iframe content
                    createTextureFromIframe(previewRenderTarget).then(texture => {
                        // Check if preview is still active before updating
                        if (!isPreviewActive) return;
                        
                        if (previewPlane && previewPlane.material) {
                            // Handle array of materials for cube
                            if (Array.isArray(previewPlane.material)) {
                                previewPlane.material.forEach(material => {
                                    if (material.map) {
                                        material.map.dispose();
                                    }
                                    material.map = texture;
                                    material.needsUpdate = true;
                                });
                            } else {
                                // For backwards compatibility
                                if (previewPlane.material.map) {
                                    previewPlane.material.map.dispose();
                                }
                                previewPlane.material.map = texture;
                                previewPlane.material.needsUpdate = true;
                            }
                        }
                        
                        // Allow new texture updates
                        pendingTextureUpdate = false;
                    }).catch(error => {
                        console.error('Error updating texture:', error);
                        // Allow new texture updates even on error
                        pendingTextureUpdate = false;
                    });
                } else {
                    // If iframe is invalid, still reset the flag
                    pendingTextureUpdate = false;
                }
            }, { timeout: 100 }); // Allow max 100ms for the idle task
        }
        
        // Render the scene - this is always done at the target framerate
        if (previewRenderer && previewScene && previewCamera) {
            previewRenderer.render(previewScene, previewCamera);
        }
    } catch (error) {
        console.error('Error in animation loop:', error);
        // Don't stop the animation loop for errors, just log them
    }
}

/**
 * Handle window resize for the Three.js preview
 */
function onPreviewResize() {
    const container = previewRenderer.domElement.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Update camera aspect ratio
    if (previewCamera) {
        previewCamera.aspect = containerWidth / containerHeight;
        previewCamera.updateProjectionMatrix();
    }
    
    // Update renderer
    previewRenderer.setSize(containerWidth, containerHeight);
}

/**
 * Create a texture from the iframe content using html2canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @returns {Promise<THREE.Texture>} A promise that resolves to a Three.js texture
 */
async function createTextureFromIframe(iframe) {
    return new Promise((resolve, reject) => {
        try {
            // Check if preview is still active
            if (!isPreviewActive) {
                reject(new Error('Preview is no longer active'));
                return;
            }
            
            // Make sure we can access the iframe
            if (!iframe || !document.body.contains(iframe)) {
                reject(new Error('Iframe not found in DOM or removed'));
                return;
            }
            
            // Create a simple delay function
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            
            // Give more time for the iframe to fully load
            delay(300).then(async () => {
                try {
                    // Create a fallback texture if there's an issue
                    const createEmptyTexture = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 512;
                        canvas.height = 512;
                        const ctx = canvas.getContext('2d');
                        // Use white background to match HTML default
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        // Add a border to make the texture boundary visible if enabled
                        if (window.showPreviewBorders) {
                            ctx.strokeStyle = '#3498db';
                            ctx.lineWidth = 8;
                            ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
                            
                            // Add text to indicate it's a placeholder
                            ctx.fillStyle = '#333333';
                            ctx.font = 'bold 24px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('HTML Content', canvas.width / 2, canvas.height / 2);
                        }
                        
                        const texture = new THREE.CanvasTexture(canvas);
                        texture.needsUpdate = true;
                        return texture;
                    };
                    
                    // Check if we can access the iframe content safely
                    if (!iframe.contentDocument || !iframe.contentWindow) {
                        console.log('Cannot access iframe content, using empty texture');
                        resolve(createEmptyTexture());
                        return;
                    }
                    
                    // Check if html2canvas is available
                    if (typeof window.html2canvas === 'undefined') {
                        console.log('html2canvas not available, using empty texture');
                        resolve(createEmptyTexture());
                        return;
                    }
                    
                    // Make sure the body is fully loaded
                    if (!iframe.contentDocument.body) {
                        console.log('Iframe body not available, using empty texture');
                        resolve(createEmptyTexture());
                        return;
                    }
                    
                    // Apply a frame to the content to make it more visible on the texture
                    const styleElement = iframe.contentDocument.createElement('style');
                    styleElement.textContent = `
                        body {
                            margin: 0;
                            padding: 15px;
                            ${window.showPreviewBorders ? 'border: 5px solid #3498db;' : ''}
                            box-sizing: border-box;
                            background-color: white;
                            font-size: 20px !important; /* Increase base font size for better readability */
                        }
                        
                        /* Add a subtle grid to help with alignment */
                        body::before {
                            content: "";
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-image: ${window.showPreviewBorders ? 
                                'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)' : 
                                'none'};
                            background-size: 20px 20px;
                            pointer-events: none;
                            z-index: -1;
                        }
                        
                        /* Increase font size of common elements */
                        h1, h2, h3, h4, h5, h6 {
                            font-size: 1.5em !important;
                        }
                        
                        p, div, span, a, li, td, th {
                            font-size: 1.2em !important;
                        }
                        
                        /* Make sure buttons and inputs are readable */
                        button, input, select, textarea {
                            font-size: 1.2em !important;
                            padding: 5px !important;
                        }
                    `;
                    
                    try {
                        // Add the style element temporarily for rendering
                        iframe.contentDocument.head.appendChild(styleElement);
                        
                        // Use html2canvas to capture the iframe content
                        const targetElement = iframe.contentDocument.body;
                        
                        try {
                            // Use higher scale factor for better quality
                            const canvas = await window.html2canvas(targetElement, {
                                backgroundColor: '#FFFFFF', // Explicitly set to white to match HTML default
                                scale: 4, // Increase resolution for crisper text and animations
                                logging: false,
                                allowTaint: true,
                                useCORS: true,
                                foreignObjectRendering: true
                            });
                            
                            // Remove the temporary style element after rendering
                            if (styleElement && styleElement.parentNode) {
                                styleElement.parentNode.removeChild(styleElement);
                            }
                            
                            // Create a texture from the canvas
                            const texture = new THREE.CanvasTexture(canvas);
                            
                            // Improve texture quality settings
                            texture.anisotropy = 8; // Increase anisotropy for better quality at angles
                            texture.minFilter = THREE.LinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.generateMipmaps = false;
                            texture.needsUpdate = true;
                            
                            resolve(texture);
                        } catch (error) {
                            console.error('Error capturing with html2canvas:', error);
                            
                            // Remove the temporary style element if it exists
                            if (styleElement && styleElement.parentNode) {
                                styleElement.parentNode.removeChild(styleElement);
                            }
                            
                            // On error, return empty texture instead of failing
                            resolve(createEmptyTexture());
                        }
                    } catch (error) {
                        console.error('Error in texture creation:', error);
                        // Return empty texture on error rather than failing completely
                        const emptyTexture = createEmptyTexture();
                        resolve(emptyTexture);
                    }
                } catch (error) {
                    console.error('Error in texture creation:', error);
                    // Return empty texture on error rather than failing completely
                    const emptyTexture = createEmptyTexture();
                    resolve(emptyTexture);
                }
            });
        } catch (error) {
            console.error('Error in createTextureFromIframe:', error);
            // Create a simple empty texture on error instead of failing
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF'; // White background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            resolve(texture);
        }
    });
}

/**
 * Create a fallback texture when iframe content can't be accessed
 * @returns {THREE.Texture} A simple fallback texture
 */
function createFallbackTexture() {
    console.log('Creating fallback texture');
    
    // Create a canvas element with 16:9 aspect ratio
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a semi-transparent background for the message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(10, 10, 400, 150);
    
    // Draw a message about preview limitations
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HTML Preview', 20, 40);
    
    ctx.font = '16px sans-serif';
    ctx.fillText('Preview content cannot be displayed.', 20, 80);
    ctx.fillText('This may be due to security restrictions', 20, 110);
    ctx.fillText('or content that requires special rendering.', 20, 140);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.premultiplyAlpha = true; // Handle transparency correctly
    return texture;
}

/**
 * Clean up Three.js resources
 */
function cleanupThreeJsPreview() {
    // Mark preview as inactive to stop animation loop first
    isPreviewActive = false;
    combinedRenderRequired = false;
    
    // Clean up info panel
    cleanupInfoPanel();
    
    // Clear pending update operations and animation frames first
    if (pendingTextureUpdate) {
        pendingTextureUpdate = false;
    }
    
    if (previewAnimationId !== null) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
    }
    
    // Reset debug flag
    window._css3dDebugLogged = false;
    
    // Remove event listener
    window.removeEventListener('resize', onPreviewResize);
    
    // Clean up HTML texture preview elements
    try {
        const textureCanvas = document.getElementById('html-texture-canvas');
        if (textureCanvas && textureCanvas.parentNode) {
            textureCanvas.parentNode.removeChild(textureCanvas);
        }
        
        const hiddenContent = document.getElementById('hidden-html-content');
        if (hiddenContent && hiddenContent.parentNode) {
            hiddenContent.parentNode.removeChild(hiddenContent);
        }
    } catch (e) {
        console.log('HTML element cleanup error (non-critical):', e);
    }
    
    // Clean up and nullify previewRenderTarget - save a local copy for safety
    const localRenderTarget = previewRenderTarget;
    previewRenderTarget = null; // Set to null first to prevent new render attempts
    
    // Clean up the render target if it exists
    if (localRenderTarget) {
        try {
            if (localRenderTarget.texture) {
                localRenderTarget.texture.dispose();
            }
        } catch (e) {
            console.log('Render target cleanup error (non-critical):', e);
        }
    }
    
    // Clean up CSS3D resources
    try {
        if (css3dScene) {
            // Remove all objects from the scene
            while (css3dScene.children.length > 0) {
                const object = css3dScene.children[0];
                css3dScene.remove(object);
                
                // If it's a CSS3D object with an iframe element, remove it from DOM
                if (object.element && object.element.parentNode) {
                    try {
                        if (object.element.contentDocument) {
                            object.element.contentDocument.open();
                            object.element.contentDocument.write('');
                            object.element.contentDocument.close();
                        }
                        object.element.parentNode.removeChild(object.element);
                    } catch (err) {
                        console.log('Iframe cleanup error (non-critical):', err);
                    }
                }
            }
            css3dScene = null;
        }
        
        css3dObject = null;
        
        if (css3dRenderer) {
            if (css3dRenderer.domElement && css3dRenderer.domElement.parentElement) {
                css3dRenderer.domElement.parentElement.removeChild(css3dRenderer.domElement);
            }
            css3dRenderer = null;
        }
    } catch (e) {
        console.log('CSS3D cleanup error (non-critical):', e);
    }
    
    // Original cleanup code for texture-based preview
    try {
        if (previewPlane) {
            if (previewPlane.geometry) previewPlane.geometry.dispose();
            if (previewPlane.material) {
                if (Array.isArray(previewPlane.material)) {
                    previewPlane.material.forEach(material => {
                        if (material.map) material.map.dispose();
                        material.dispose();
                    });
                } else {
                    if (previewPlane.material.map) previewPlane.material.map.dispose();
                    previewPlane.material.dispose();
                }
            }
            if (previewScene) previewScene.remove(previewPlane);
            previewPlane = null;
        }
        
        if (previewScene) {
            // Clean up any other objects in the scene
            if (previewScene.children) {
                while (previewScene.children.length > 0) {
                    const object = previewScene.children[0];
                    previewScene.remove(object);
                    
                    // Dispose of geometry and materials
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => {
                                if (material.map) material.map.dispose();
                                material.dispose();
                            });
                        } else {
                            if (object.material.map) object.material.map.dispose();
                            object.material.dispose();
                        }
                    }
                }
            }
            previewScene = null;
        }
    } catch (e) {
        console.log('Three.js scene cleanup error (non-critical):', e);
    }
    
    previewCamera = null;
    
    try {
        if (previewRenderer) {
            previewRenderer.dispose();
            if (previewRenderer.domElement && previewRenderer.domElement.parentElement) {
                previewRenderer.domElement.parentElement.removeChild(previewRenderer.domElement);
            }
            previewRenderer = null;
        }
    } catch (e) {
        console.log('Renderer cleanup error (non-critical):', e);
    }
    
    // Remove the render iframe
    try {
        const renderIframe = document.getElementById('html-render-iframe');
        if (renderIframe) {
            // Clear iframe content first
            if (renderIframe.contentDocument) {
                renderIframe.contentDocument.open();
                renderIframe.contentDocument.write('');
                renderIframe.contentDocument.close();
            }
            
            // Then remove from DOM
            if (renderIframe.parentElement) {
                renderIframe.parentElement.removeChild(renderIframe);
            }
        }
    } catch (error) {
        // Suppress iframe access errors during cleanup
        console.log('Iframe cleanup error (non-critical)');
    }
    
    // Reset animation state
    isPreviewAnimationPaused = false;
    lastTextureUpdateTime = 0;
    pendingTextureUpdate = false;
    lastFrameTime = 0;
    
    // Clean up keyboard event handlers
    if (previewCamera && previewCamera.userData && previewCamera.userData.keyHandler) {
        document.removeEventListener('keydown', previewCamera.userData.keyHandler);
        console.log('Keyboard event handlers cleaned up');
    }
    
    // Clean up the global animateMessages function
    if (window.animateMessages) {
        window.animateMessages = null;
    }
    
    console.log('Three.js and CSS3D resources cleaned up');
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
 * Save content for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @param {string} content - The content to save
 * @returns {Promise<boolean>} A promise that resolves when saving is complete
 */
async function saveHtmlForMesh(meshId, content) {
    // Check if content is empty or just whitespace
    const isEmpty = !content || content.trim() === '';
    
    // Get GLB buffer from the model integration
    const glbBuffer = getCurrentGlbBuffer();
    
    // If we have no GLB buffer, we can't save
    if (!glbBuffer) {
        console.warn(`No GLB buffer available, content for mesh ID ${meshId} saved in memory only`);
        throw new Error('No GLB buffer available to save content. Your changes are saved in memory but will be lost when you reload.');
    }

    try {
        if (isEmpty) {
            // If content is empty, we want to remove the association
            console.log(`Removing content for mesh ID ${meshId}...`);
            
            // Remove from our in-memory map
            meshHtmlContent.delete(meshId);
            
            // Create an empty buffer to signal removal
            const emptyBuffer = new ArrayBuffer(0);
            
            // Call the association function which will handle removal
            const updatedGlb = await associateBinaryBufferWithMesh(
                glbBuffer, 
                meshId, 
                emptyBuffer
            );
            
            // Update the GLB file
            await updateGlbFile(updatedGlb);
            
            console.log(`Successfully removed content for mesh ID ${meshId}`);
            
            // Update the UI
            // Remove from the set of meshes with HTML
            window.removeMeshHtmlFlag(meshId);
            
            return true;
        }
        
        // For non-empty content, continue with normal save
        console.log(`Serializing content for mesh ID ${meshId}...`);
        
        // Save to our in-memory map
        meshHtmlContent.set(meshId, content);
        
        // Serialize content to binary
        const binaryData = serializeStringToBinary(content);
        
        console.log(`Associating binary data with mesh ID ${meshId} in GLB...`);
        // Associate binary data with mesh index in GLB
        const updatedGlb = await associateBinaryBufferWithMesh(
            glbBuffer, 
            meshId, 
            binaryData
        );
        
        // Update the GLB file
        await updateGlbFile(updatedGlb);
        
        console.log(`Successfully saved content for mesh ID ${meshId} to GLB`);
        
        const state = getState();
        if (state.meshes && state.meshes[meshId]) {
            console.log(`Saved content for mesh: ${state.meshes[meshId].name}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error saving content to GLB:', error);
        throw error;
    }
}

/**
 * Create the error container for displaying lint errors
 * @returns {HTMLElement} The created error container
 */
function createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'html-editor-errors';
    container.className = 'html-editor-errors';
    container.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        max-height: 100px;
        overflow-y: auto;
        background-color: #f8d7da;
        color: #721c24;
        border-top: 1px solid #f5c6cb;
        padding: 8px;
        font-size: 12px;
        display: none;
    `;
    
    // Find the editor container only within the modal
    const modal = document.getElementById('html-editor-modal');
    const editorContainer = modal ? modal.querySelector('.editor-container') : null;
    
    if (editorContainer) {
        editorContainer.style.position = 'relative';
        editorContainer.appendChild(container);
    } else {
        // Fallback to appending to the modal
        if (modal) {
            modal.appendChild(container);
        }
    }
    
    return container;
}

/**
 * Lint the HTML content in the editor
 */
async function lintHtmlContent() {
    const modal = document.getElementById('html-editor-modal');
    const textarea = modal ? modal.querySelector('#html-editor-textarea') : null;
    const errorContainer = modal ? modal.querySelector('#html-editor-errors') : null;
    
    if (!textarea) return;
    
    const html = textarea.value;
    
    try {
        // Run the linter
        const errors = await lintHtml(html);
        currentLintErrors = errors;
        
        // Clear previous error indicators
        clearErrorIndicators();
        
        // Create error container if it doesn't exist
        const container = errorContainer || createErrorContainer();
        
        // Display errors if any
        if (errors && errors.length > 0) {
            displayLintErrors(errors);
            container.style.display = 'block';
        } else {
            if (container) container.style.display = 'none';
        }
    } catch (error) {
        console.error('Error linting HTML:', error);
    }
}

/**
 * Clear error indicators from the editor
 */
function clearErrorIndicators() {
    const modal = document.getElementById('html-editor-modal');
    const textarea = modal ? modal.querySelector('#html-editor-textarea') : null;
    if (!textarea) return;
    
    // Remove any existing error styling
    textarea.classList.remove('has-errors');
    
    // Clear the error container
    const errorContainer = modal ? modal.querySelector('#html-editor-errors') : null;
    if (errorContainer) {
        errorContainer.innerHTML = '';
    }
}

/**
 * Display lint errors in the editor
 * @param {Array} errors - The lint errors to display
 */
function displayLintErrors(errors) {
    const modal = document.getElementById('html-editor-modal');
    const textarea = modal ? modal.querySelector('#html-editor-textarea') : null;
    const errorContainer = modal ? modal.querySelector('#html-editor-errors') : null;
    
    if (!textarea || !errorContainer) return;
    
    // Add error class to textarea
    textarea.classList.add('has-errors');
    
    // Create error messages
    const errorList = document.createElement('ul');
    errorList.style.margin = '0';
    errorList.style.padding = '0 0 0 20px';
    
    errors.forEach(error => {
        const errorItem = document.createElement('li');
        errorItem.textContent = `Line ${error.line}, Col ${error.col}: ${error.message}`;
        errorItem.style.cursor = 'pointer';
        
        // Add click handler to navigate to the error position
        errorItem.addEventListener('click', () => {
            navigateToErrorPosition(textarea, error.line, error.col);
        });
        
        errorList.appendChild(errorItem);
    });
    
    errorContainer.innerHTML = '';
    errorContainer.appendChild(errorList);
}

/**
 * Navigate to a specific position in the textarea
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {number} line - The line number (1-based)
 * @param {number} col - The column number (1-based)
 */
function navigateToErrorPosition(textarea, line, col) {
    const lines = textarea.value.split('\n');
    
    // Calculate position
    let position = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
        position += lines[i].length + 1; // +1 for the newline character
    }
    
    // Add column position (ensuring we don't go past the end of the line)
    position += Math.min(col - 1, lines[line - 1] ? lines[line - 1].length : 0);
    
    // Set cursor position
    textarea.focus();
    textarea.setSelectionRange(position, position);
}

/**
 * Initialize CSS3D renderer for HTML preview
 * @param {HTMLElement} container - The container element for the renderers
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 */
function initCSS3DPreview(container, iframe) {
    try {
        // Directly import Three.js CSS3D renderer
        import('three/examples/jsm/renderers/CSS3DRenderer.js')
            .then(module => {
                const { CSS3DRenderer, CSS3DObject } = module;
                
                // Now that we have the correct classes, set up the CSS3D scene
                setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject);
            })
            .catch(error => {
                console.error('Error loading CSS3DRenderer:', error);
                // Use console.error instead of logPreviewError
                console.error('CSS3D initialization error:', error.message);
                
                // Fallback to texture-based preview
                showStatus('CSS3D renderer not available, falling back to texture-based preview', 'warning');
                initThreeJsPreview(container, iframe);
            });
    } catch (error) {
        console.error('Error in initCSS3DPreview:', error);
        // Use console.error instead of logPreviewError
        console.error('CSS3D initialization error:', error.message);
        
        // Fallback to texture-based preview
        showStatus('Error initializing CSS3D preview, falling back to texture-based preview', 'error');
        initThreeJsPreview(container, iframe);
    }
}

function setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject) {
    try {
        console.log('Setting up CSS3D scene with container:', container);
        
        // Clear any existing content
        container.innerHTML = '';
        
        // Basic variables
        const userHtml = document.getElementById('html-editor-textarea').value || '';
        
        // Panel size - use a single panel instead of a cube
        const panelWidth = 500;
        const panelHeight = 400;
        
        // Setup camera with proper distance to see the panel
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
        camera.position.set(0, 0, 700); // Position to see panel straight on
        
        // Create CSS3D scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x303030); // Dark gray background like Unreal Editor
        
        // Create CSS3D renderer
        const renderer = new CSS3DRenderer();
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        container.appendChild(renderer.domElement);
        
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);
        
        // Get settings for this mesh
        const settings = getHtmlSettingsForMesh(currentMeshId);
        const playbackSpeed = settings.playbackSpeed || 1.0;
        
        // Create info panel
        createInfoPanel(container, currentMeshId);
        
        // Function to create HTML content - simplified to avoid layout warnings
        const wrapContent = (content) => {
            return `<!DOCTYPE html>
<html>
<head>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            box-sizing: border-box;
        }
        body {
            background-color: white;
            color: #333;
            font-family: Arial, sans-serif;
            padding: 10px;
            display: flex;
            flex-direction: column;
        }
        .panel-title {
            background: #f0f0f0;
            padding: 5px;
            margin-bottom: 10px;
            text-align: center;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            font-size: 14px;
            flex-shrink: 0;
        }
        .content {
            flex: 1;
            overflow: hidden;
            padding: 5px;
            position: relative;
            width: calc(100% - 10px);
        }
        
        /* Add a border if enabled */
        ${window.showPreviewBorders ? 
            `body { border: 5px solid #3498db; }` : 
            ''}
            
        /* Control animation speed - apply to all animations */
        * {
            animation-duration: ${1.0/playbackSpeed}s !important;
            transition-duration: ${1.0/playbackSpeed}s !important;
        }
        
        /* Ensure content doesn't overflow */
        .content > * {
            max-width: 100%;
            box-sizing: border-box;
        }
        
        /* Override any styles that might cause horizontal scrollbars */
        .content div, .content p, .content span, .content img {
            max-width: 100%;
        }
    </style>
</head>
<body>
    <div class="panel-title">HTML Preview</div>
    <div class="content">${content}</div>
</body>
</html>`;
        };
        
        // Create a DOM container to hold the iframe temporarily
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px'; // Off-screen
        tempContainer.style.top = '0';
        tempContainer.style.zIndex = '-1'; // Behind everything
        tempContainer.style.opacity = '0.01'; // Almost invisible, but still rendered
        tempContainer.style.pointerEvents = 'none'; // Don't interact with user input
        document.body.appendChild(tempContainer);
        
        // Create a single iframe for the panel
        const element = document.createElement('iframe');
        element.id = 'css3d-panel-iframe';
        element.style.width = `${panelWidth}px`;
        element.style.height = `${panelHeight}px`;
        element.style.border = 'none'; // Remove border - we'll add it in the content if needed
        element.style.borderRadius = '5px';
        element.style.backgroundColor = 'white';
        element.style.overflow = 'hidden'; // Prevent scrollbars
        element.style.boxSizing = 'border-box';
        
        // Add the iframe to DOM first
        tempContainer.appendChild(element);
        
        // Create a CSS3D object with the iframe
        const object = new CSS3DObject(element);
        
        // Add to scene
        scene.add(object);
        
        // Store references for cleanup
        css3dScene = scene;
        css3dRenderer = renderer;
        previewCamera = camera;
        
        // Store for replay
        previewRenderTarget = element;
        css3dObject = object;
        
        // Write content to the iframe after a brief delay
        setTimeout(() => {
            try {
                if (element.contentDocument) {
                    element.contentDocument.open();
                    element.contentDocument.write(wrapContent(userHtml));
                    element.contentDocument.close();
                }
            } catch (err) {
                console.error('Error writing content to iframe:', err);
            }
        }, 50);
        
        // Set up OrbitControls
        import('three/examples/jsm/controls/OrbitControls.js').then(module => {
            const { OrbitControls } = module;
            
            // Create controls
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.2;
            controls.rotateSpeed = 0.5;
            controls.minDistance = 100;   // CSS3D needs larger distances
            controls.maxDistance = 2000;
            controls.zoomSpeed = 1.2;
            
            // Initial look at origin
            camera.lookAt(0, 0, 0);
            
            // Animation loop
            function animate() {
                if (!isPreviewActive) {
                    return;
                }
                
                requestAnimationFrame(animate);
                
                // Update controls
                controls.update();
                
                // Render scene
                renderer.render(scene, camera);
            }
            
            // Start animation loop
            animate();
            
            // Show success status
            showStatus('CSS3D preview ready. Use +/- keys to zoom in/out', 'success');
            
            // Add keyboard shortcuts for zooming
            const handleKeydown = (event) => {
                if (!isPreviewActive) return;
                
                // Get current controls - they should be attached to the camera by this point
                const controls = previewCamera.userData.controls;
                if (!controls) return;
                
                const zoomSpeed = 0.2; // How fast to zoom with keyboard
                
                switch (event.key) {
                    case '+':
                    case '=': // Common + key without shift
                        // Zoom in - decrease distance to target
                        controls.dollyIn(1 + zoomSpeed);
                        controls.update();
                        break;
                    case '-':
                    case '_': // Common - key with shift
                        // Zoom out - increase distance to target
                        controls.dollyOut(1 + zoomSpeed);
                        controls.update();
                        break;
                }
            };
            
            // Register keyboard handler
            document.addEventListener('keydown', handleKeydown);
            
            // Store for cleanup
            previewCamera.userData.keyHandler = handleKeydown;
        }).catch(error => {
            console.error('Error loading OrbitControls:', error);
            showStatus('Error loading 3D controls: ' + error.message, 'error');
            return false;
        });
        
        // Success
        return true;
    } catch (error) {
        console.error('Error in setupCSS3DScene:', error);
        showStatus('Error creating 3D view: ' + error.message, 'error');
        return false;
    }
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
function createInfoPanel(container, meshId) {
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
    panel.style.zIndex = '1000';
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
 * Clean up info panel resources
 * Removes the info panel from the DOM and resets the infoPanel reference
 * This is called when closing the preview or switching between preview modes
 */
function cleanupInfoPanel() {
    if (infoPanel) {
        try {
            if (infoPanel.parentNode) {
                infoPanel.parentNode.removeChild(infoPanel);
            }
        } catch (e) {
            console.log('Error removing info panel:', e);
        }
        infoPanel = null;
    }
}
