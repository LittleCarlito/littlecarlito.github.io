/**
 * Embedded HTML Editor Modal
 * 
 * This module handles the functionality of the embedded HTML editor.
 * It allows users to add custom HTML code to a mesh.
 */

import { getState, updateState } from '../../scene/state';
import { 
    deserializeStringFromBinary, 
    serializeStringToBinary,
    serializeStringWithSettingsToBinary,
    isValidHtml,
    sanitizeHtml
} from '../../util/string-serder.js';
import { 
    formatHtml as externalFormatHtml, 
    initHtmlFormatter,
    hasExternalFormatter 
} from './html-formatter.js';
import {
    initHtmlLinter,
    lintHtmlContent
} from './html-linter.js';
import { 
    getCurrentGlbBuffer, 
    updateGlbFile,
    onGlbBufferUpdate
} from './model-integration';
import { 
    getBinaryBufferForMesh,
    associateBinaryBufferWithMesh,
    MESH_BINARY_EXTENSION, 
    MESH_INDEX_PROPERTY, 
    BINARY_DATA_PROPERTY 
} from '../../util/glb-utils.js';
import { updateHtmlIcons } from '../../panels/mesh-panel/mesh-panel';
// Import Three.js the same way as other files in the codebase
import * as THREE from 'three';
import { getIsPreviewActive, setLastTextureUpdateTime } from '../../util/custom-animation/animation-util';
import { previewHtml } from '../../util/custom-animation/preview-util';
import { cleanupThreeJsPreview, frameBuffer, previewRenderTarget } from '../../util/custom-animation/threejs-util.js';
import { getHtmlSettingsForMesh, loadHtmlForMesh, loadSettingsForMesh, saveHtmlForMesh, saveSettingsForMesh } from '../../util/mesh-data-util.js';

// Add variables for frame buffering at the top of the file with other variables
 let maxCaptureRate = 0.5;

// Default settings for HTML content (integrated from mesh-settings-modal.js)
export const defaultSettings = {
    previewMode: 'threejs',
    playbackSpeed: 1.0,
    animation: {
        type: 'play'
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

// Debounce timer for linting
let lintDebounceTimer = null;

// Add this class before the previewBtn event listener
/**
 * Class to encapsulate all settings needed for HTML content rendering
 * Used for both preview and actual mesh texture application
 */
export class CustomTextureSettings {
    /**
     * Create a new CustomTextureSettings object
     * @param {string} html - HTML content to render
     * @param {number} meshId - ID of the mesh
     * @param {string} previewMode - Type of rendering (threejs, css3d, or longExposure)
     * @param {number} playbackSpeed - Animation playback speed
     * @param {string} animationType - Type of animation (play, loop, bounce, longExposure)
     * @param {boolean} showPreviewBorders - Whether to show borders in the rendering
     * @param {Function} statusCallback - Function to update status messages
     * @param {Function} errorCallback - Function to handle errors
     * @param {HTMLElement} errorContainer - Container for error messages
     */
    constructor(html, meshId, previewMode, playbackSpeed, animationType, showPreviewBorders, 
                statusCallback = null, errorCallback = null, errorContainer = null) {
        this.html = html;
        this.meshId = meshId;
        this.previewMode = previewMode;
        this.playbackSpeed = playbackSpeed;
        this.animationType = animationType;
        this.showPreviewBorders = showPreviewBorders;
        this.statusCallback = statusCallback;
        this.errorCallback = errorCallback;
        this.errorContainer = errorContainer;
    }
    
    /**
     * Check if the animation type is long exposure
     * @returns {boolean} True if animation type is long exposure
     */
    get isLongExposureMode() {
        return this.animationType === 'longExposure';
    }
    
    /**
     * Update status message
     * @param {string} message - Status message
     * @param {string} type - Status type (info, error, success)
     */
    updateStatus(message, type = 'info') {
        if (this.statusCallback) {
            this.statusCallback(message, type);
        }
    }
    
    /**
     * Handle error
     * @param {string} message - Error message
     */
    handleError(message) {
        if (this.errorCallback) {
            this.errorCallback(message);
        }
    }
}

/**
 * Open the HTML Editor Modal for a specific mesh
 * @param {string} meshName - The name of the mesh
 * @param {number} meshId - The ID/index of the mesh
 */
export async function openEmbeddedHtmlEditor(meshName, meshId) {
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
        
        // Determine if we should force reload from binary buffer
        const forceReload = htmlEditorState.needsReload === true;
        if (forceReload) {
            console.log('Forcing reload from binary buffer for mesh ID:', meshId);
            htmlEditorState.needsReload = false; // Reset flag after using it
        }
        
        // Clear in-memory settings cache if needed to ensure we get the actual saved settings
        if (forceReload) {
            // Import here to avoid circular dependency
            const meshDataUtil = await import('../../util/mesh-data-util');
            // Clear the settings from memory cache so we reload from binary
            meshDataUtil.clearMeshHtmlSettings(meshId);
        }
        
        // Load saved settings for this mesh first, so other UI changes don't interfere
        loadSettingsForMesh(meshId).then(settings => {
            console.log('Loaded settings:', settings); // Debug loaded settings
            
            // After settings are loaded, update the UI based on renderer type
            const renderTypeSelect = document.getElementById('html-render-type');
            const playbackSpeedSelect = document.getElementById('html-playback-speed');
            const animationTypeSelect = document.getElementById('html-animation-type');
            const showWireframeCheckbox = document.getElementById('show-wireframe');
            const displayOnMeshCheckbox = document.getElementById('display-on-mesh');
            const dropdownsContainer = document.getElementById('editor-dropdowns-container');
            
            // Update dropdowns with saved settings
            if (renderTypeSelect) {
                // Make sure we have a valid value before setting
                if (settings.previewMode && ['threejs', 'css3d', 'longExposure'].includes(settings.previewMode)) {
                    renderTypeSelect.value = settings.previewMode;
                } else {
                    renderTypeSelect.value = 'threejs'; // Default to threejs if invalid
                }
            }
            
            if (playbackSpeedSelect) {
                // Convert playbackSpeed to string with one decimal place
                const speedValue = settings.playbackSpeed ? settings.playbackSpeed.toString() : '1.0';
                
                // Check if option exists
                const speedExists = Array.from(playbackSpeedSelect.options).some(option => option.value === speedValue);
                
                if (speedExists) {
                    playbackSpeedSelect.value = speedValue;
                } else {
                    // Fallback to default
                    playbackSpeedSelect.value = '1.0';
                }
            }
            
            if (animationTypeSelect && settings.animation && settings.animation.type) {
                // Make sure we have a valid value
                if (['play', 'loop', 'bounce'].includes(settings.animation.type)) {
                    animationTypeSelect.value = settings.animation.type;
                } else {
                    animationTypeSelect.value = 'play'; // Default
                }
            }
            
            if (showWireframeCheckbox && settings.display) {
                showWireframeCheckbox.checked = settings.display.showBorders !== undefined ? 
                    settings.display.showBorders : true;
            }
            
            if (displayOnMeshCheckbox && settings.display) {
                displayOnMeshCheckbox.checked = settings.display.displayOnMesh || false;
            }
            
            // Apply long-exposure-mode class if needed
            if (renderTypeSelect && renderTypeSelect.value === 'longExposure' && dropdownsContainer) {
                dropdownsContainer.classList.add('long-exposure-mode');
            } else if (dropdownsContainer) {
                dropdownsContainer.classList.remove('long-exposure-mode');
            }
        });
        
        // Load HTML content for this mesh (forcing reload if needed)
        loadHtmlForMesh(meshId, forceReload).then(html => {
            if (textarea) textarea.value = html || '';
            
            // Ensure we're not in preview mode when opening the editor
            modal.classList.remove('preview-mode');
            
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
 * Get settings from form dropdowns
 * @returns {Object} The settings object
 */
export function getSettingsFromForm() {
    const animationType = document.getElementById('html-animation-type').value;
    const showWireframeCheckbox = document.getElementById('show-wireframe');
    const displayOnMeshCheckbox = document.getElementById('display-on-mesh');
    
    return {
        previewMode: document.getElementById('html-render-type').value || defaultSettings.previewMode,
        playbackSpeed: parseFloat(document.getElementById('html-playback-speed').value),
        animation: {
            type: animationType
        },
        display: {
            showBorders: showWireframeCheckbox ? showWireframeCheckbox.checked : true,
            displayOnMesh: displayOnMeshCheckbox ? displayOnMeshCheckbox.checked : false
        }
    };
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
    const applyBtn = document.getElementById('html-editor-apply');
    const formatBtn = document.getElementById('html-editor-format');
    const previewBtn = document.getElementById('html-editor-preview');
    const resetBtn = document.getElementById('html-editor-reset');
    const textarea = modal ? modal.querySelector('#html-editor-textarea') : null;
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
    
    // Check initial renderer selection and update animation dropdown visibility
    if (renderTypeSelect && renderTypeSelect.value === 'longExposure') {
        const dropdownsContainer = document.getElementById('editor-dropdowns-container');
        if (dropdownsContainer) {
            dropdownsContainer.classList.add('long-exposure-mode');
        }
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
                
                // Use CSS class to control animation dropdown visibility
                const dropdownsContainer = document.getElementById('editor-dropdowns-container');
                if (dropdownsContainer) {
                    if (renderTypeSelect.value === 'longExposure') {
                        dropdownsContainer.classList.add('long-exposure-mode');
                    } else {
                        dropdownsContainer.classList.remove('long-exposure-mode');
                    }
                }
            }
        });
    }
    
    if (playbackSpeedSelect) {
        playbackSpeedSelect.addEventListener('change', () => {
            // Update settings when user changes playback speed
            const meshId = parseInt(modal.dataset.meshId);
            if (!isNaN(meshId)) {
                const settings = getSettingsFromForm();
                const oldPlaybackSpeed = settings.playbackSpeed || 1.0;
                const newPlaybackSpeed = parseFloat(playbackSpeedSelect.value);
                
                // Save new settings
                saveSettingsForMesh(meshId, settings);
                
                // Update CSS3D preview if active
                if (getIsPreviewActive()) {
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
            if (getIsPreviewActive() && previewRenderTarget) {
                // Force a texture update
                setLastTextureUpdateTime(0);
                showStatus(`Borders ${showWireframeCheckbox.checked ? 'enabled' : 'disabled'}`, 'info');
            }
        });
    }
    
    // Display on Mesh checkbox
    const displayOnMeshCheckbox = document.getElementById('display-on-mesh');
    if (displayOnMeshCheckbox) {
        displayOnMeshCheckbox.addEventListener('change', () => {
            showStatus(`Display on mesh ${displayOnMeshCheckbox.checked ? 'enabled' : 'disabled'}`, 'info');
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
    
    // Handle the preview button click
    function handlePreviewClick() {
        const modal = document.getElementById('html-editor-modal');
        const textarea = document.getElementById('html-editor-textarea');
        const previewContent = document.getElementById('html-preview-content');
        const errorContainer = document.getElementById('html-editor-errors');
        
        try {
            // Collect all settings from the DOM
            const html = textarea.value;
            const meshId = parseInt(modal.dataset.meshId);
            
            // Get preview mode
            const renderTypeSelect = document.getElementById('html-render-type');
            let previewMode = renderTypeSelect ? renderTypeSelect.value : 'threejs';
            
            // Get playback speed
            const playbackSpeedSelect = document.getElementById('html-playback-speed');
            const playbackSpeed = playbackSpeedSelect ? parseFloat(playbackSpeedSelect.value) : 1.0;
            
            // Get animation type
            const animationTypeSelect = document.getElementById('html-animation-type');
            let animationType = animationTypeSelect ? animationTypeSelect.value : 'play';
            
            // Special handling for Long Exposure rendering
            if (previewMode === 'longExposure') {
                // For Long Exposure, use image2texture renderer but with longExposure animation type
                previewMode = 'threejs'; // Use threejs (which uses image2texture under the hood)
                animationType = 'longExposure'; // Set animation type to longExposure
            }
            
            // Get border display setting
            const showWireframeCheckbox = document.getElementById('show-wireframe');
            const showPreviewBorders = showWireframeCheckbox ? showWireframeCheckbox.checked : true;
            
            // Create settings object with callbacks
            const settings = new CustomTextureSettings(
                html,
                meshId,
                previewMode,
                playbackSpeed,
                animationType,
                showPreviewBorders,
                showStatus,  // Pass the status callback
                (error) => showStatus(error, 'error'),  // Pass the error callback
                errorContainer  // Pass the error container
            );
            
            // Function to set modal data attributes
            const setModalData = (key, value) => {
                modal.dataset[key] = value;
            };
            
            // Generate the preview with the collected settings
            previewHtml(settings, previewContent, setModalData);
            
            // Add preview mode class to modal for CSS control
            modal.classList.add('preview-mode');
            
            // Show a message about the current preview mode
            if (renderTypeSelect) {
                const previewModeName = renderTypeSelect.options[renderTypeSelect.selectedIndex].text;
                showStatus(`Preview mode: ${previewModeName}`, 'info');
            }
        } catch (error) {
            showStatus('Error generating preview: ' + error.message, 'error');
        }
    }

    // Preview button
    previewBtn.addEventListener('click', handlePreviewClick);
    
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
    
    // Apply button
    applyBtn.addEventListener('click', async () => {
        console.debug("BAZINGA; There isn't anything tied to this yet");
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
    const meshId = parseInt(modal.dataset.meshId);
    
    modal.classList.remove('visible');
    htmlEditorState.isOpen = false;
    
    // Clean up Three.js resources when closing the modal
    cleanupThreeJsPreview();
    
    // Discard unsaved changes by forcing a reload from binary buffer next time
    // This ensures that when reopening the modal, we'll see the last saved settings
    if (!isNaN(meshId)) {
        console.log('Discarding unsaved changes for mesh ID:', meshId);
        // Force reloading from binary buffer next time the modal is opened
        htmlEditorState.needsReload = true;
    }
}

/**
 * Show a status message in the editor
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error', 'info')
 */
export function showStatus(message, type = 'info') {
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
 * Verify that the binary extension exists for a mesh in a GLB buffer
 * @param {ArrayBuffer} glbBuffer - The GLB buffer to check
 * @param {number} meshId - The mesh ID to verify
 * @returns {Promise<boolean>} True if the extension exists
 */
async function verifyExtensionExists(glbBuffer, meshId) {
    if (!glbBuffer) {
        console.error('verifyExtensionExists: No GLB buffer provided');
        return false;
    }
    
    try {
        console.log(`Verifying binary extension for mesh ${meshId} in buffer size: ${glbBuffer.byteLength} bytes`);
        
        // Parse the GLB to access the JSON content
        const dataView = new DataView(glbBuffer);
        
        // Basic GLB header checks
        if (dataView.byteLength < 12) {
            console.error('Buffer too small for valid GLB');
            return false;
        }
        
        // Check magic number
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) { // 'glTF' in ASCII
            console.error(`Invalid GLB magic number: ${magic.toString(16)}`);
            return false;
        }
        
        // Get chunk 0 (JSON) length
        const jsonChunkLength = dataView.getUint32(12, true);
        
        // Extract the JSON chunk
        const jsonStart = 20;
        const jsonEnd = jsonStart + jsonChunkLength;
        const jsonData = glbBuffer.slice(jsonStart, jsonEnd);
        const jsonString = new TextDecoder('utf-8').decode(jsonData);
        const gltf = JSON.parse(jsonString);
        
        // Check if our extension exists
        if (!gltf.extensions || !gltf.extensions[MESH_BINARY_EXTENSION]) {
            console.log(`No binary extension found in GLB for mesh ${meshId}`);
            return false;
        }
        
        // Find the association for this mesh index
        const associations = gltf.extensions[MESH_BINARY_EXTENSION].meshBinaryAssociations;
        if (!associations || !Array.isArray(associations)) {
            console.log('No binary associations found');
            return false;
        }
        
        // Check for this specific mesh ID
        const association = associations.find(assoc => assoc[MESH_INDEX_PROPERTY] === meshId);
        const found = !!association;
        
        if (found) {
            // Get the buffer index
            const bufferIndex = association[BINARY_DATA_PROPERTY];
            
            // Check if the buffer exists
            if (!gltf.buffers || !gltf.buffers[bufferIndex]) {
                console.log(`Buffer ${bufferIndex} referenced but not found for mesh ${meshId}`);
                return false;
            }
            
            console.log(`Found binary extension for mesh ${meshId} -> buffer ${bufferIndex}`);
        } else {
            console.log(`No binary association found for mesh ${meshId}`);
        }
        
        return found;
    } catch (error) {
        console.error('Error verifying extension:', error);
        return false;
    }
}

/**
 * Reset initialization state - called during SPA cleanup
 */
export function resetInitialization() {
    listenersInitialized = false;
    console.log('HTML Editor Modal initialization flag reset');
}