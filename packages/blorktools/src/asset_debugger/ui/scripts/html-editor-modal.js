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
    formatHtml,
    sanitizeHtml
} from '../../core/string-serder.js';
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
    formatBtn.addEventListener('click', () => {
        try {
            const formattedHtml = formatHtml(textarea.value);
            textarea.value = formattedHtml;
            showStatus('HTML formatted', 'success');
        } catch (error) {
            showStatus('Error formatting HTML: ' + error.message, 'error');
        }
    });
    
    // Preview button
    previewBtn.addEventListener('click', () => {
        try {
            previewHtml(textarea.value);
            previewContainer.style.display = 'block';
            textarea.style.display = 'none';
            previewBtn.style.display = 'none';
            resetBtn.style.display = 'inline-block';
            const editorContainer = document.querySelector('.editor-container');
            if (editorContainer) {
                editorContainer.style.display = 'none'; // Hide editor container
            }
            const label = document.querySelector('.editor-controls label');
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
        const editorContainer = document.querySelector('.editor-container');
        if (editorContainer) {
            editorContainer.style.display = 'block'; // Show editor container
        }
        const label = document.querySelector('.editor-controls label');
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
    
    // Sanitize the HTML before displaying
    const sanitizedHtml = sanitizeHtml(html);
    
    // Update the preview
    previewContent.innerHTML = sanitizedHtml;
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

// Make sure both the default export and named exports are available
export default {
    initHtmlEditorModal,
    openEmbeddedHtmlEditor
};