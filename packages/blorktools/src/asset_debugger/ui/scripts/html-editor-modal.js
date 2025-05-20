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
    serializeStringWithSettingsToBinary,
    isValidHtml,
    sanitizeHtml
} from '../../core/string-serder.js';
import { 
    formatHtml as externalFormatHtml, 
    initHtmlFormatter,
    hasExternalFormatter 
} from '../../core/html-formatter.js';
import {
    initHtmlLinter,
    lintHtmlContent
} from '../../core/html-linter.js';
import { updateGlbFile } from './model-integration.js';
import { updateHtmlIcons } from './mesh-panel.js';

// Import Three.js the same way as other files in the codebase
import * as THREE from 'three';
import { createLongExposureTexture, createTextureFromIframe } from '../../core/texture-util.js';
import { isPreviewActive, maxCaptureRate, previewHtml, setLastTextureUpdateTime  } from '../../core/preview/preview-util.js';
import { cleanupThreeJsPreview, frameBuffer, previewRenderTarget } from '../../core/preview/threejs-util.js';
import { getHtmlSettingsForMesh, loadHtmlForMesh, loadSettingsForMesh, saveHtmlForMesh, saveSettingsForMesh } from '../../core/mesh-data-util.js';

export let originalAnimationStartTime = 0;

// Store HTML settings for each mesh (integrated from mesh-settings-modal.js)

// Default settings for HTML content (integrated from mesh-settings-modal.js)
export const defaultSettings = {
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

// Debounce timer for linting
let lintDebounceTimer = null;

// Add this class before the previewBtn event listener
/**
 * Class to encapsulate all settings needed for HTML preview
 */
export class PreviewSettings {
    /**
     * Create a new PreviewSettings object
     * @param {string} html - HTML content to preview
     * @param {number} meshId - ID of the mesh
     * @param {string} previewMode - Type of preview (threejs or css3d)
     * @param {number} playbackSpeed - Animation playback speed
     * @param {string} animationType - Type of animation (none, loop, bounce, longExposure)
     * @param {boolean} showPreviewBorders - Whether to show borders in the preview
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
            const meshDataUtil = await import('../../core/mesh-data-util');
            // Clear the settings from memory cache so we reload from binary
            meshDataUtil.clearMeshHtmlSettings(meshId);
        }
        
        // Load saved settings for this mesh first, so other UI changes don't interfere
        loadSettingsForMesh(meshId).then(settings => {
            // After settings are loaded, update the UI based on renderer type
            const renderTypeSelect = document.getElementById('html-render-type');
            const dropdownsContainer = document.getElementById('editor-dropdowns-container');
            
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
    
    return {
        previewMode: document.getElementById('html-render-type').value || defaultSettings.previewMode,
        playbackSpeed: parseFloat(document.getElementById('html-playback-speed').value),
        animation: {
            type: animationType,
            enabled: animationType !== 'none'
        },
        display: {
            showBorders: showWireframeCheckbox ? showWireframeCheckbox.checked : true
        },
        active: false // Default to false, will be set to true when using Save and Apply
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
    const saveBtn = document.getElementById('html-editor-save');
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
                        
                        // For image2texture preview - adjust timing without resetting frames
                        if (frameBuffer.length > 0) {
                            // Calculate how much animation time has elapsed at the old speed
                            const currentTime = Date.now();
                            const realElapsedTime = currentTime - originalAnimationStartTime;
                            const animationElapsedTime = realElapsedTime * oldPlaybackSpeed;
                            
                            // Reset the animation start time to maintain current position
                            // but continue with the new speed
                            originalAnimationStartTime = currentTime - (animationElapsedTime / newPlaybackSpeed);
                            
                            // For speeds > 1x, we need to ensure we have enough frames in the buffer
                            // to maintain smooth playback
                            if (newPlaybackSpeed > 1.0) {
                                // Increase capture rate for faster playback
                                maxCaptureRate = Math.max(1, Math.floor(1 / newPlaybackSpeed));
                                console.log(`Adjusted capture rate for ${newPlaybackSpeed}x speed: ${maxCaptureRate}ms`);
                            } else {
                                // Reset to normal capture rate
                                maxCaptureRate = 1;
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
            if (isPreviewActive && previewRenderTarget) {
                // Force a texture update
                setLastTextureUpdateTime(0);
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
            let animationType = animationTypeSelect ? animationTypeSelect.value : 'none';
            
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
            const settings = new PreviewSettings(
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
    
    // Save button
    saveBtn.addEventListener('click', async () => {
        try {
            const currentMeshId = modal.dataset.meshId;
            if (currentMeshId) {
                const html = textarea.value;
                
                // Save HTML content
                await saveHtmlForMesh(parseInt(currentMeshId), html, false); // Pass false for isActive
                
                // Update HTML icons to reflect the new state
                updateHtmlIcons();
                
                // Reset the needs reload flag since we've just saved
                htmlEditorState.needsReload = false;
                
                // Don't close the modal, just show success message
                showStatus('HTML saved successfully', 'success');
            }
        } catch (error) {
            showStatus('Error saving HTML: ' + error.message, 'error');
        }
    });
    
    // Save and Apply button
    const saveApplyBtn = document.getElementById('html-editor-save-apply');
    if (saveApplyBtn) {
        saveApplyBtn.addEventListener('click', async () => {
            try {
                const currentMeshId = modal.dataset.meshId;
                if (currentMeshId) {
                    const html = textarea.value;
                    
                    // Save HTML content with active flag set to true
                    await saveHtmlForMesh(parseInt(currentMeshId), html, true); // Pass true for isActive
                    
                    // Update HTML icons to reflect the new state
                    updateHtmlIcons();
                    
                    // Reset the needs reload flag since we've just saved
                    htmlEditorState.needsReload = false;
                    
                    // Close the modal
                    closeModal();
                    showStatus('HTML saved and applied successfully', 'success');
                }
            } catch (error) {
                showStatus('Error saving and applying HTML: ' + error.message, 'error');
            }
        });
    }
    
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
 * Set original animation start time
 * @param {number} incomingValue - The new value to set
 */
export function setOriginalAnimationStartTime(incomingValue) {
    originalAnimationStartTime = incomingValue;
}
