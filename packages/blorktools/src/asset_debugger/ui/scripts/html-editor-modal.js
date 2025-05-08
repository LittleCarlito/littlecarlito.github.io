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
            previewHtml(textarea.value);
            previewContainer.style.display = 'block';
            textarea.style.display = 'none';
            previewBtn.style.display = 'none';
            resetBtn.style.display = 'inline-block';
            
            // Find editor container only within the modal
            const editorContainer = modal.querySelector('.editor-container');
            if (editorContainer) {
                editorContainer.style.display = 'none'; // Hide editor container
            }
            
            // Find label only within the modal
            const label = modal.querySelector('.editor-controls label');
            if (label) {
                label.textContent = 'Preview:'; // Update label text
            }
            showStatus('Preview updated', 'success');
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
 * Preview HTML code
 * @param {string} html - The HTML code to preview
 */
function previewHtml(html) {
    const previewContent = document.getElementById('html-preview-content');
    if (!previewContent) return;
    
    try {
        // First clear the preview container
        previewContent.innerHTML = '';
        
        // Create a sandboxed iframe using srcdoc instead of directly writing to the document
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '400px';
        iframe.style.border = 'none';
        iframe.style.backgroundColor = 'white';
        // Remove allow-same-origin to prevent sandbox escape
        iframe.sandbox = 'allow-scripts';
        
        // Add message event listener for iframe content
        window.addEventListener('message', function iframeMessageHandler(event) {
            try {
                // Only handle resize messages
                if (event.data && event.data.type === 'resize') {
                    const height = event.data.height + 40; // Add padding
                    iframe.style.height = `${height}px`;
                    
                    // Log successful resize
                    console.log(`Iframe resized to ${height}px`);
                }
            } catch (error) {
                logPreviewError(`Resize error: ${error.message}`);
            }
        });
        
        // The sanitizeHtml function handles wrapping fragments if needed
        const sanitizedHtml = sanitizeHtml(html);
        
        // Use srcdoc attribute to set the content (avoids cross-origin issues)
        iframe.srcdoc = sanitizedHtml;
        
        // Append the iframe
        previewContent.appendChild(iframe);
        
        // Add error log container
        const errorLog = document.createElement('div');
        errorLog.id = 'html-preview-error-log';
        errorLog.className = 'preview-error-log';
        // Start hidden until there are errors
        errorLog.style.display = 'none';
        previewContent.appendChild(errorLog);
        
        // Log success message
        showStatus('Preview generated successfully', 'success');
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

// Make sure both the default export and named exports are available
export default {
    initHtmlEditorModal,
    openEmbeddedHtmlEditor
};