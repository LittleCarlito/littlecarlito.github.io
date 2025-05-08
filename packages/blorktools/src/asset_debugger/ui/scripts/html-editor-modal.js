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
let textureUpdateInterval = 100; // Update texture every 100ms
let isPreviewActive = false; // Track if preview is currently active

// Add variables for CSS3D rendering
let css3dScene, css3dRenderer, css3dObject;
let webglScene, webglRenderer;
let combinedRenderRequired = false;

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
            
            // Hide preview by default
            if (previewContainer) previewContainer.style.display = 'none';
            
            // Show the modal by adding the visible class
            modal.classList.add('visible');
            htmlEditorState.isOpen = true;
            console.log('HTML Editor Modal opened successfully');
            
            // Run linting after content is loaded
            lintHtmlContent();
        }).catch(error => {
            console.error('Error loading HTML content:', error);
            if (textarea) textarea.value = '';
            if (statusEl) showStatus(`Error loading HTML: ${error.message}`, 'error');
            
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
    const settingsBtn = document.getElementById('html-editor-settings');
    const textarea = document.getElementById('html-editor-textarea');
    const previewContainer = document.getElementById('html-preview-container');
    const previewContent = document.getElementById('html-preview-content');
    const statusEl = document.getElementById('html-editor-status');
    const errorContainer = document.getElementById('html-editor-errors') || createErrorContainer();
    
    // Create replay animation button
    const replayBtn = document.createElement('button');
    replayBtn.id = 'html-editor-replay';
    replayBtn.className = 'editor-button';
    replayBtn.innerHTML = '<i class="fas fa-redo"></i> Replay';
    replayBtn.title = 'Replay animation';
    
    // Insert the replay button after format button and before preview button
    if (formatBtn && formatBtn.parentNode && previewBtn) {
        formatBtn.parentNode.insertBefore(replayBtn, previewBtn);
    }
    
    // Make the modal available globally - do this first before any potential errors
    window.openEmbeddedHtmlEditor = openEmbeddedHtmlEditor;
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
    
    // Replay animation button
    replayBtn.addEventListener('click', () => {
        try {
            // Get the preview iframe
            const previewIframe = previewContent.querySelector('iframe');
            if (previewIframe && previewIframe.contentWindow) {
                // Try to call the animation function
                if (typeof previewIframe.contentWindow.animateMessages === 'function') {
                    previewIframe.contentWindow.animateMessages();
                    showStatus('Animation replayed', 'success');
                } else {
                    showStatus('No animation function found', 'error');
                }
            } else if (css3dObject && css3dObject.element) {
                // Try with CSS3D object
                try {
                    if (css3dObject.element.contentWindow && 
                        typeof css3dObject.element.contentWindow.animateMessages === 'function') {
                        css3dObject.element.contentWindow.animateMessages();
                        showStatus('Animation replayed', 'success');
                    } else {
                        showStatus('No animation function found in CSS3D object', 'error');
                    }
                } catch (error) {
                    showStatus('Error replaying animation: ' + error.message, 'error');
                }
            } else {
                showStatus('No preview available', 'error');
            }
        } catch (error) {
            showStatus('Error replaying animation: ' + error.message, 'error');
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
            // Find editor container and get its dimensions
            const editorContainer = modal.querySelector('.editor-container');
            const editorHeight = editorContainer ? editorContainer.clientHeight : 400;
            
            // Generate the preview
            previewHtml(textarea.value);
            
            // Set the preview container to take up the full editor space
            previewContainer.style.display = 'block';
            previewContainer.style.height = `${editorHeight}px`;
            previewContainer.style.minHeight = '400px';
            
            // Hide textarea and show reset button
            textarea.style.display = 'none';
            previewBtn.style.display = 'none';
            resetBtn.style.display = 'inline-block';
            
            // Hide editor container
            if (editorContainer) {
                editorContainer.style.display = 'none';
            }
            
            // Find label only within the modal
            const label = modal.querySelector('.editor-controls label');
            if (label) {
                label.textContent = 'Preview:'; // Update label text
            }
            
            // Show a message about changing preview mode in mesh settings
            const settingsBtn = document.getElementById('html-editor-settings');
            if (settingsBtn) {
                showStatus('Preview mode can be changed in mesh settings', 'info');
            }
        } catch (error) {
            showStatus('Error generating preview: ' + error.message, 'error');
        }
    });
    
    // Reset button
    resetBtn.addEventListener('click', () => {
        previewContainer.style.display = 'none';
        textarea.style.display = 'block';
        previewBtn.style.display = 'inline-block';
        resetBtn.style.display = 'none';
        
        // Find editor container only within the modal
        const editorContainer = modal.querySelector('.editor-container');
        if (editorContainer) {
            editorContainer.style.display = 'block'; // Show editor container
        }
        
        // Find label only within the modal
        const label = modal.querySelector('.editor-controls label');
        if (label) {
            label.textContent = 'Edit HTML for this mesh:'; // Restore label text
        }
        
        // Clean up Three.js resources
        cleanupThreeJsPreview();
        
        // Clean up any direct preview iframe
        const directPreviewIframe = previewContent.querySelector('iframe');
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
        const controlsContainer = previewContent.querySelector('.preview-controls');
        if (controlsContainer) {
            controlsContainer.remove();
        }
        
        showStatus('Editor view restored', 'info');
    });
    
    // Settings button - opens mesh settings modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            try {
                const meshId = parseInt(modal.dataset.meshId);
                const meshName = document.getElementById('html-editor-mesh-name').textContent;
                
                if (!isNaN(meshId)) {
                    console.log(`Opening mesh settings from HTML editor for mesh: ${meshName} (ID: ${meshId})`);
                    
                    // Store HTML editor state
                    htmlEditorState.isOpen = true;
                    
                    // Call the mesh settings modal
                    if (typeof window.openMeshSettingsModal === 'function') {
                        // Call with a special flag to indicate it was opened from HTML editor
                        window.openMeshSettingsModal(meshName, meshId, {fromHtmlEditor: true});
                    } else {
                        console.error('Mesh Settings function not found');
                        alert('Mesh Settings not available');
                    }
                } else {
                    console.error('Invalid mesh ID in HTML editor');
                }
            } catch (error) {
                console.error('Error opening mesh settings from HTML editor:', error);
                showStatus('Error opening settings', 'error');
            }
        });
    }
    
    // Save button
    saveBtn.addEventListener('click', async () => {
        try {
            const currentMeshId = modal.dataset.meshId;
            if (currentMeshId) {
                const html = textarea.value;
                await saveHtmlForMesh(parseInt(currentMeshId), html);
                
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
    
    // Initial setup for the modal
    previewContainer.style.display = 'none';
    
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
 * Re-open the HTML Editor Modal (used after mesh settings modal closes)
 */
export function reopenHtmlEditorModal() {
    if (htmlEditorState.isOpen) {
        const modal = document.getElementById('html-editor-modal');
        if (modal) {
            modal.classList.add('visible');
        }
    }
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
    
    // Clear the message after 3 seconds
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'editor-status';
    }, 3000);
}

/**
 * Preview HTML code using Three.js
 * @param {string} html - The HTML code to preview
 */
function previewHtml(html) {
    const previewContent = document.getElementById('html-preview-content');
    if (!previewContent) return;
    
    try {
        // First clean up any existing preview
        cleanupThreeJsPreview();
        
        // Set preview as active
        isPreviewActive = true;
        
        // Clear the preview container
        previewContent.innerHTML = '';
        
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);
        
        // Get mesh settings to determine preview mode
        let previewMode = 'direct'; // Default to direct preview
        
        try {
            // Try to get preview mode from mesh settings
            if (typeof window.getMeshHtmlSettings === 'function') {
                const meshSettings = window.getMeshHtmlSettings(currentMeshId);
                if (meshSettings && meshSettings.previewMode) {
                    previewMode = meshSettings.previewMode;
                    console.log(`Using preview mode from settings: ${previewMode}`);
                }
            }
        } catch (error) {
            console.error('Error getting mesh settings:', error);
        }
        
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
        
        // For direct preview without Three.js (fallback method)
        const directPreviewIframe = document.createElement('iframe');
        directPreviewIframe.style.width = '100%';
        directPreviewIframe.style.height = '100%';
        directPreviewIframe.style.border = 'none';
        directPreviewIframe.style.backgroundColor = 'transparent';
        directPreviewIframe.style.display = previewMode === 'direct' ? 'block' : 'none'; // Show if direct mode
        directPreviewIframe.style.position = 'absolute';
        directPreviewIframe.style.top = '0';
        directPreviewIframe.style.left = '0';
        directPreviewIframe.style.right = '0';
        directPreviewIframe.style.bottom = '0';
        previewContent.appendChild(directPreviewIframe);
        
        // Make sure the preview content container has proper positioning for absolute children
        previewContent.style.position = 'relative';
        previewContent.style.minHeight = '400px';
        previewContent.style.height = '100%';
        
        // Wait for iframe to be ready
        renderIframe.onload = () => {
            // Only proceed if preview is still active
            if (!isPreviewActive) return;
            
            try {
                // Set up the direct preview iframe with the content
                if (directPreviewIframe.contentDocument) {
                    directPreviewIframe.contentDocument.open();
                    directPreviewIframe.contentDocument.write(sanitizedHtml);
                    directPreviewIframe.contentDocument.close();
                    
                    // Trigger animation if it exists
                    setTimeout(() => {
                        try {
                            if (directPreviewIframe.contentWindow && directPreviewIframe.contentWindow.animateMessages) {
                                directPreviewIframe.contentWindow.animateMessages();
                            }
                        } catch (error) {
                            console.log('No animation function found in direct preview');
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Error setting up direct preview:', error);
            }
            
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
            canvasContainer.style.display = (previewMode === 'threejs' || previewMode === 'css3d') ? 'block' : 'none';
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
                initCSS3DPreview(canvasContainer, directPreviewIframe.cloneNode(true));
            } else if (previewMode === 'threejs') {
                showStatus('Initializing 3D texture preview mode...', 'info');
                initThreeJsPreview(canvasContainer, renderIframe);
            } else {
                showStatus('Preview generated in direct HTML mode', 'success');
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
        // Create scene with transparent background
        previewScene = new THREE.Scene();
        previewScene.background = null; // Set to null for transparency
        
        // Create camera
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        // Use a different approach for the camera to better fit content
        const cameraDistance = 1.5;
        previewCamera = new THREE.OrthographicCamera(
            -1, 1, 1, -1, 0.1, 10
        );
        previewCamera.position.z = cameraDistance;
        
        // Create renderer with proper sizing to fit container exactly and enable transparency
        previewRenderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true // Enable transparency
        });
        previewRenderer.setSize(containerWidth, containerHeight);
        previewRenderer.setPixelRatio(window.devicePixelRatio);
        previewRenderer.setClearColor(0x000000, 0); // Set clear color with 0 alpha (transparent)
        
        // Ensure the renderer canvas fits perfectly in the container
        const rendererCanvas = previewRenderer.domElement;
        rendererCanvas.style.display = 'block';
        rendererCanvas.style.width = '100%';
        rendererCanvas.style.height = '100%';
        container.appendChild(rendererCanvas);
        
        // Create a render target for the iframe
        previewRenderTarget = iframe;
        
        // Create initial texture from iframe content
        createTextureFromIframe(iframe).then(texture => {
            // Get the texture's aspect ratio (default to 1:1 if not available)
            // This ensures we respect the content's natural aspect ratio
            const textureAspectRatio = texture.image ? texture.image.width / texture.image.height : 1;
            
            // Calculate dimensions to fit the content properly in view
            // We'll make the content fill most of the view while maintaining aspect ratio
            let planeWidth, planeHeight;
            
            if (textureAspectRatio >= 1) {
                // For landscape or square content
                planeWidth = 1.8; // Fill most of the view width
                planeHeight = planeWidth / textureAspectRatio;
            } else {
                // For portrait content
                planeHeight = 1.8; // Fill most of the view height
                planeWidth = planeHeight * textureAspectRatio;
            }
            
            // Update camera to match content aspect ratio
            updateCameraForContent(previewCamera, containerAspectRatio, textureAspectRatio);
            
            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const material = new THREE.MeshBasicMaterial({ 
                map: texture,
                side: THREE.DoubleSide,
                transparent: true // Enable transparency
            });
            
            // Create plane mesh
            previewPlane = new THREE.Mesh(geometry, material);
            previewScene.add(previewPlane);
            
            // Start animation loop
            animatePreview();
        }).catch(error => {
            console.error('Error creating texture from iframe:', error);
            logPreviewError(`Texture creation error: ${error.message}`);
        });
        
        // Handle window resize
        window.addEventListener('resize', onPreviewResize);
    } catch (error) {
        console.error('Error setting up Three.js scene:', error);
        logPreviewError(`Scene setup error: ${error.message}`);
    }
}

/**
 * Update camera parameters to better fit content with different aspect ratios
 * @param {THREE.OrthographicCamera} camera - The camera to update
 * @param {number} containerAspect - The container's aspect ratio
 * @param {number} contentAspect - The content's aspect ratio
 */
function updateCameraForContent(camera, containerAspect, contentAspect) {
    // Base size for the camera frustum
    const baseSize = 1;
    
    if (containerAspect >= contentAspect) {
        // Container is wider than content - fit to height
        camera.top = baseSize;
        camera.bottom = -baseSize;
        camera.left = -baseSize * containerAspect;
        camera.right = baseSize * containerAspect;
    } else {
        // Container is taller than content - fit to width
        camera.left = -baseSize;
        camera.right = baseSize;
        camera.top = baseSize / containerAspect;
        camera.bottom = -baseSize / containerAspect;
    }
    
    camera.updateProjectionMatrix();
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
                // Silent return of fallback during cleanup
                resolve(createFallbackTexture());
                return;
            }
            
            // Check if iframe is still in the DOM and accessible
            if (!iframe || !document.body.contains(iframe)) {
                // Only log if not during cleanup
                if (isPreviewActive) {
                    console.warn('Iframe not found in DOM or removed');
                }
                resolve(createFallbackTexture());
                return;
            }
            
            // Wait a bit for the iframe content to load
            setTimeout(async () => {
                try {
                    // Check if preview is still active
                    if (!isPreviewActive) {
                        resolve(createFallbackTexture());
                        return;
                    }
                    
                    // Check if we can access the iframe content
                    if (!iframe.contentDocument || !iframe.contentWindow) {
                        // Only log if not during cleanup
                        if (isPreviewActive) {
                            console.warn('Cannot access iframe content, using fallback texture');
                        }
                        resolve(createFallbackTexture());
                        return;
                    }
                    
                    // Check if html2canvas is available
                    if (typeof window.html2canvas === 'undefined') {
                        console.warn('html2canvas not available, using fallback texture');
                        resolve(createFallbackTexture());
                        return;
                    }
                    
                    // Get iframe dimensions
                    const iframeWidth = parseInt(iframe.style.width) || 960;
                    const iframeHeight = parseInt(iframe.style.height) || 540;
                    
                    // Use html2canvas to capture the iframe content
                    const canvas = await window.html2canvas(iframe.contentDocument.body, {
                        backgroundColor: null, // Transparent background
                        scale: 1,
                        width: iframeWidth,
                        height: iframeHeight,
                        logging: false,
                        allowTaint: true,
                        useCORS: true
                    });
                    
                    // Create a texture from the canvas
                    const texture = new THREE.CanvasTexture(canvas);
                    texture.needsUpdate = true;
                    
                    resolve(texture);
                } catch (error) {
                    if (isPreviewActive) {
                        console.error('Error capturing iframe with html2canvas:', error);
                    }
                    // Use fallback texture instead of rejecting
                    resolve(createFallbackTexture());
                }
            }, 200);
        } catch (error) {
            if (isPreviewActive) {
                console.warn('Error in createTextureFromIframe:', error);
            }
            resolve(createFallbackTexture());
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
 * Animation loop for the Three.js preview
 */
function animatePreview() {
    // If preview is no longer active, don't continue the animation loop
    if (!isPreviewActive) {
        console.log('Preview no longer active, stopping animation loop');
        return;
    }
    
    previewAnimationId = requestAnimationFrame(animatePreview);
    
    try {
        // Only update texture if animation is not paused and enough time has passed
        const currentTime = Date.now();
        if (!isPreviewAnimationPaused && previewPlane && previewRenderTarget && 
            (currentTime - lastTextureUpdateTime > textureUpdateInterval)) {
            
            // Update the last update time
            lastTextureUpdateTime = currentTime;
            
            // Check if iframe is still valid before trying to update texture
            if (previewRenderTarget && document.body.contains(previewRenderTarget)) {
                // Update texture from iframe content
                createTextureFromIframe(previewRenderTarget).then(texture => {
                    // Check if preview is still active before updating
                    if (!isPreviewActive) return;
                    
                    if (previewPlane && previewPlane.material) {
                        if (previewPlane.material.map) {
                            previewPlane.material.map.dispose();
                        }
                        previewPlane.material.map = texture;
                        previewPlane.material.transparent = true; // Ensure transparency is maintained
                        previewPlane.material.needsUpdate = true;
                        
                        // Update the plane geometry to match the new texture's aspect ratio
                        if (texture.image) {
                            const textureAspectRatio = texture.image.width / texture.image.height;
                            
                            // Calculate dimensions to fit the content properly in view
                            let planeWidth, planeHeight;
                            
                            if (textureAspectRatio >= 1) {
                                // For landscape or square content
                                planeWidth = 1.8; // Fill most of the view width
                                planeHeight = planeWidth / textureAspectRatio;
                            } else {
                                // For portrait content
                                planeHeight = 1.8; // Fill most of the view height
                                planeWidth = planeHeight * textureAspectRatio;
                            }
                            
                            // Only update geometry if aspect ratio has changed significantly
                            const currentGeometry = previewPlane.geometry;
                            const currentWidth = currentGeometry.parameters.width;
                            const currentHeight = currentGeometry.parameters.height;
                            const currentAspectRatio = currentWidth / currentHeight;
                            
                            if (Math.abs(currentAspectRatio - textureAspectRatio) > 0.01) {
                                // Dispose of old geometry
                                if (currentGeometry) currentGeometry.dispose();
                                
                                // Create new geometry with correct aspect ratio
                                const newGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
                                previewPlane.geometry = newGeometry;
                                
                                // Update camera to match content aspect ratio
                                if (previewRenderer && previewRenderer.domElement && previewRenderer.domElement.parentElement) {
                                    const container = previewRenderer.domElement.parentElement;
                                    const containerAspectRatio = container.clientWidth / container.clientHeight;
                                    updateCameraForContent(previewCamera, containerAspectRatio, textureAspectRatio);
                                }
                            }
                        }
                    }
                }).catch(error => {
                    console.error('Error updating texture:', error);
                });
            }
        }
        
        // Render the scene
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
    const containerAspectRatio = containerWidth / containerHeight;
    
    // Update camera using our helper function
    if (previewPlane && previewPlane.material && previewPlane.material.map && previewPlane.material.map.image) {
        const texture = previewPlane.material.map;
        const textureAspectRatio = texture.image.width / texture.image.height;
        updateCameraForContent(previewCamera, containerAspectRatio, textureAspectRatio);
    } else {
        // Fallback if we don't have texture information
        updateCameraForContent(previewCamera, containerAspectRatio, 1);
    }
    
    // Update renderer
    previewRenderer.setSize(containerWidth, containerHeight);
}

/**
 * Clean up Three.js resources
 */
function cleanupThreeJsPreview() {
    // Mark preview as inactive to stop animation loop
    isPreviewActive = false;
    combinedRenderRequired = false;
    
    // Reset debug flag
    window._css3dDebugLogged = false;
    
    // Cancel animation loop
    if (previewAnimationId !== null) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
    }
    
    // Remove event listener
    window.removeEventListener('resize', onPreviewResize);
    
    // Clean up CSS3D controls
    const controlsContainer = document.querySelector('.css3d-controls');
    if (controlsContainer && controlsContainer.parentElement) {
        controlsContainer.parentElement.removeChild(controlsContainer);
    }
    
    // Clean up CSS3D resources
    if (css3dObject) {
        if (css3dScene) css3dScene.remove(css3dObject);
        
        // Remove iframe if it's still in the DOM
        if (css3dObject.element && css3dObject.element.parentNode) {
            css3dObject.element.parentNode.removeChild(css3dObject.element);
        }
        
        css3dObject = null;
    }
    
    if (css3dRenderer) {
        if (css3dRenderer.domElement && css3dRenderer.domElement.parentElement) {
            css3dRenderer.domElement.parentElement.removeChild(css3dRenderer.domElement);
        }
        css3dRenderer = null;
    }
    
    if (css3dScene) {
        css3dScene = null;
    }
    
    if (webglRenderer) {
        if (webglRenderer.domElement && webglRenderer.domElement.parentElement) {
            webglRenderer.domElement.parentElement.removeChild(webglRenderer.domElement);
        }
        webglRenderer = null;
    }
    
    if (webglScene) {
        webglScene = null;
    }
    
    // Original cleanup code for texture-based preview
    // Dispose of Three.js resources
    if (previewPlane) {
        if (previewPlane.geometry) previewPlane.geometry.dispose();
        if (previewPlane.material) {
            if (previewPlane.material.map) previewPlane.material.map.dispose();
            previewPlane.material.dispose();
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
    
    if (previewCamera) {
        previewCamera = null;
    }
    
    if (previewRenderer) {
        previewRenderer.dispose();
        if (previewRenderer.domElement && previewRenderer.domElement.parentElement) {
            previewRenderer.domElement.parentElement.removeChild(previewRenderer.domElement);
        }
        previewRenderer = null;
    }
    
    // Remove the render iframe
    const renderIframe = document.getElementById('html-render-iframe');
    if (renderIframe) {
        try {
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
        } catch (error) {
            // Suppress iframe access errors during cleanup
            console.debug('Cleaning up iframe (access errors expected)');
        }
    }
    
    // Reset animation state
    isPreviewAnimationPaused = false;
    previewRenderTarget = null;
    lastTextureUpdateTime = 0;
    
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
        console.log('Initializing CSS3D preview');
        
        // Directly import our standalone CSS3D renderer
        import('../../core/css3d-renderer.js')
            .then(module => {
                const { CSS3DRenderer, CSS3DObject, isCSS3DRendererAvailable } = module;
                
                // Log the imported objects to verify they're functions/classes
                console.log('CSS3D imports:', {
                    CSS3DRenderer: typeof CSS3DRenderer,
                    CSS3DObject: typeof CSS3DObject,
                    isCSS3DRendererAvailable: typeof isCSS3DRendererAvailable
                });
                
                if (isCSS3DRendererAvailable && isCSS3DRendererAvailable()) {
                    console.log('CSS3D renderer loaded successfully');
                    
                    // Debug logging to verify our imports
                    console.log('THREE availability check:',
                               'THREE:', typeof THREE !== 'undefined',
                               'CSS3DRenderer:', typeof CSS3DRenderer === 'function',
                               'CSS3DObject:', typeof CSS3DObject === 'function');
                    
                    setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject);
                } else {
                    throw new Error('CSS3D renderer not available');
                }
            })
            .catch(error => {
                console.error('Error initializing CSS3D preview:', error);
                logPreviewError(`CSS3D initialization error: ${error.message}`);
                
                // Don't fall back - we want to see the error
                showStatus('CSS3D error: ' + error.message, 'error');
            });
    } catch (error) {
        console.error('Error in initCSS3DPreview:', error);
        logPreviewError(`CSS3D initialization error: ${error.message}`);
        
        // Don't fall back - we want to see the error
        showStatus('CSS3D init error: ' + error.message, 'error');
    }
}

/**
 * Set up CSS3D scene for HTML preview
 * @param {HTMLElement} container - The container element
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {Function} CSS3DRenderer - The CSS3DRenderer class
 * @param {Function} CSS3DObject - The CSS3DObject class
 */
function setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject) {
    try {
        // Debug logging
        console.log('Setting up CSS3D scene with:', 
                   'THREE:', typeof THREE, 
                   'CSS3DRenderer:', typeof CSS3DRenderer, 
                   'CSS3DObject:', typeof CSS3DObject);
        
        // Get container dimensions
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        // Create shared camera
        previewCamera = new THREE.PerspectiveCamera(60, containerAspectRatio, 0.1, 5000);
        // Move camera back a bit to see the content better
        previewCamera.position.z = 800;
        
        // Create CSS3D scene and renderer using the provided classes
        css3dScene = new THREE.Scene();
        
        // Create instance of CSS3DRenderer from the imported class
        console.log('Creating CSS3DRenderer with imported class:', typeof CSS3DRenderer);
        css3dRenderer = new CSS3DRenderer();
        
        // Debug check
        console.log('Created CSS3DRenderer instance:', css3dRenderer);
        
        css3dRenderer.setSize(containerWidth, containerHeight);
        css3dRenderer.domElement.style.position = 'absolute';
        css3dRenderer.domElement.style.top = '0';
        css3dRenderer.domElement.style.pointerEvents = 'none'; // Let events pass through to WebGL layer
        container.appendChild(css3dRenderer.domElement);
        
        // Create WebGL scene and renderer for any 3D objects
        webglScene = new THREE.Scene();
        webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        webglRenderer.setSize(containerWidth, containerHeight);
        webglRenderer.setClearColor(0x000000, 0); // Transparent background
        webglRenderer.domElement.style.position = 'absolute';
        webglRenderer.domElement.style.top = '0';
        container.appendChild(webglRenderer.domElement);
        
        // Add debug helpers to WebGL scene - disabled now that CSS3D is working
        addDebugHelpers(webglScene, false);
        
        // Get the content from the textarea
        const textarea = document.getElementById('html-editor-textarea');
        const userHtml = textarea ? textarea.value : '';
        
        // Create a new iframe for CSS3D
        const css3dIframe = document.createElement('iframe');
        css3dIframe.style.width = '960px';
        css3dIframe.style.height = '540px';
        css3dIframe.style.border = 'none';
        css3dIframe.style.overflow = 'hidden';
        css3dIframe.style.backgroundColor = 'transparent';
        
        // Append the iframe to the document body temporarily to ensure it loads
        document.body.appendChild(css3dIframe);
        
        // Wait for iframe to load before creating CSS3D object
        css3dIframe.onload = () => {
            console.log('CSS3D iframe loaded');
            
            try {
                // Create CSS3D object with the loaded iframe
                console.log('Creating CSS3DObject with imported class:', typeof CSS3DObject);
                
                // Always use the 'new' keyword when creating CSS3DObject
                css3dObject = new CSS3DObject(css3dIframe);
                
                console.log('Created CSS3DObject:', css3dObject);
                
                // Position the object in front of the camera - centered
                css3dObject.position.set(0, 0, 0);
                
                // Scale to fit nicely in view - adjusted for better visibility
                const scale = 0.5;
                css3dObject.scale.set(scale, scale, scale);
                
                css3dScene.add(css3dObject);
                
                // Start animation loop
                animateCSS3D();
                
                // Trigger the animation if it's in the user's HTML
                setTimeout(() => {
                    try {
                        if (css3dIframe.contentWindow && css3dIframe.contentWindow.animateMessages) {
                            css3dIframe.contentWindow.animateMessages();
                            showStatus('Animation started', 'success');
                        }
                    } catch (error) {
                        console.log('No animation function found in iframe content');
                    }
                }, 300);
                
                console.log('CSS3D scene setup complete with user content');
            } catch (error) {
                console.error('Error creating CSS3D object:', error);
                logPreviewError(`Error creating CSS3D object: ${error.message}`);
            }
        };
        
        // Always use the content from the textarea
        css3dIframe.srcdoc = userHtml;
        
        // Add simple controls
        setupOrbitControls(previewCamera, css3dRenderer.domElement);
        
        // Mark that combined rendering is needed
        combinedRenderRequired = true;
        
        // Store for cleanup
        previewRenderTarget = css3dIframe;

        // Create control buttons for the CSS3D view
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'css3d-controls';
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.bottom = '10px';
        controlsContainer.style.left = '10px';
        controlsContainer.style.zIndex = '1000';
        controlsContainer.style.background = 'rgba(0,0,0,0.5)';
        controlsContainer.style.padding = '5px';
        controlsContainer.style.borderRadius = '5px';
        container.appendChild(controlsContainer);

        // Zoom buttons
        const zoomInBtn = document.createElement('button');
        zoomInBtn.textContent = '+ Zoom In';
        zoomInBtn.style.marginRight = '5px';
        zoomInBtn.addEventListener('click', () => {
            if (css3dObject) {
                const currentScale = css3dObject.scale.x;
                css3dObject.scale.set(currentScale * 1.2, currentScale * 1.2, currentScale * 1.2);
            }
        });
        controlsContainer.appendChild(zoomInBtn);

        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.textContent = '- Zoom Out';
        zoomOutBtn.style.marginRight = '5px';
        zoomOutBtn.addEventListener('click', () => {
            if (css3dObject) {
                const currentScale = css3dObject.scale.x;
                css3dObject.scale.set(currentScale * 0.8, currentScale * 0.8, currentScale * 0.8);
            }
        });
        controlsContainer.appendChild(zoomOutBtn);

        // Reset button
        const resetViewBtn = document.createElement('button');
        resetViewBtn.textContent = 'Reset View';
        resetViewBtn.addEventListener('click', () => {
            if (css3dObject) {
                css3dObject.position.set(0, 0, 0);
                css3dObject.scale.set(0.5, 0.5, 0.5);
                if (previewCamera) {
                    previewCamera.position.set(0, 0, 800);
                    previewCamera.lookAt(0, 0, 0);
                }
            }
        });
        controlsContainer.appendChild(resetViewBtn);
    } catch (error) {
        console.error('Error setting up CSS3D scene:', error);
        logPreviewError(`CSS3D scene setup error: ${error.message}`);
        
        // Don't fall back - we want to see the error
        showStatus('CSS3D setup error: ' + error.message, 'error');
    }
}

/**
 * Add debug helpers to the scene
 * @param {THREE.Scene} scene - The scene to add helpers to
 * @param {boolean} showHelpers - Whether to show the helpers
 */
function addDebugHelpers(scene, showHelpers = false) {
    if (!showHelpers) return;
    
    // Add axes helper
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(200, 10);
    scene.add(gridHelper);
    
    // Add a cube as a reference object
    const geometry = new THREE.BoxGeometry(50, 50, 50);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(100, 0, 0);
    scene.add(cube);
}

/**
 * Set up orbit controls for the preview
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element to attach controls to
 */
function setupOrbitControls(camera, domElement) {
    try {
        // Use dynamic import to get OrbitControls directly from three.js
        console.log('Loading OrbitControls directly from three.js');
        import('three/examples/jsm/controls/OrbitControls.js')
            .then(module => {
                const { OrbitControls } = module;
                const controls = new OrbitControls(camera, domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.25;
                controls.screenSpacePanning = true;
                console.log('OrbitControls initialized successfully');
            })
            .catch(error => {
                console.error('Failed to load OrbitControls module:', error);
                logPreviewError(`OrbitControls error: ${error.message}`);
            });
    } catch (error) {
        console.error('Error setting up OrbitControls:', error);
        logPreviewError(`OrbitControls error: ${error.message}`);
    }
}

/**
 * Animation loop for CSS3D preview
 */
function animateCSS3D() {
    if (!isPreviewActive || !combinedRenderRequired) return;
    
    previewAnimationId = requestAnimationFrame(animateCSS3D);
    
    try {
        // Log debug info occasionally, only when debugging is needed
        if (css3dObject && css3dScene) {
            // Only log every 10 seconds to avoid console spam
            const now = Date.now();
            if (!window._lastCSS3DDebugTime || now - window._lastCSS3DDebugTime > 10000) {
                // Check if the object is in the scene
                const isInScene = css3dScene.children.includes(css3dObject);
                
                console.log('CSS3D Status:', isInScene ? 'Working correctly' : 'Object not in scene');
                
                // Only log full debug if there's a problem
                if (!isInScene) {
                    console.log('CSS3D Animation debugging:');
                    console.log(`- css3dObject exists: ${!!css3dObject}`);
                    console.log(`- css3dScene exists: ${!!css3dScene}`);
                    console.log(`- CSS3D object in scene: ${isInScene}`);
                    console.log(`- css3dRenderer exists: ${!!css3dRenderer}`);
                    
                    // Check if the element is in the DOM
                    if (css3dObject && css3dObject.element) {
                        const isInDOM = document.body.contains(css3dObject.element);
                        console.log(`- CSS3D element in DOM: ${isInDOM}`);
                        console.log(`- CSS3D element dimensions: ${css3dObject.element.offsetWidth}x${css3dObject.element.offsetHeight}`);
                        console.log(`- CSS3D object position: ${JSON.stringify({
                            x: css3dObject.position.x,
                            y: css3dObject.position.y,
                            z: css3dObject.position.z
                        })}`);
                    }
                }
                
                window._lastCSS3DDebugTime = now;
            }
        }
        
        // Render both scenes
        if (css3dRenderer && css3dScene && previewCamera) {
            try {
                css3dRenderer.render(css3dScene, previewCamera);
            } catch (renderError) {
                console.error('Error rendering CSS3D scene:', renderError);
                logPreviewError(`CSS3D render error: ${renderError.message}`);
            }
        }
        
        if (webglRenderer && webglScene && previewCamera) {
            try {
                webglRenderer.render(webglScene, previewCamera);
            } catch (renderError) {
                console.error('Error rendering WebGL scene:', renderError);
            }
        }
    } catch (error) {
        console.error('Error in CSS3D animation loop:', error);
        logPreviewError(`CSS3D animation error: ${error.message}`);
    }
}

// Make sure both the default export and named exports are available
export default {
    initHtmlEditorModal,
    openEmbeddedHtmlEditor
};