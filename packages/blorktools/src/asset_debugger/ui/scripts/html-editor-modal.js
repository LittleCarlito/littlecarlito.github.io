/**
 * Embedded HTML Editor Modal
 * 
 * This module handles the functionality of the embedded HTML editor.
 * It allows users to add custom HTML code to a mesh.
 */

import { getState, updateState } from '../../core/state.js';
import { 
    getBinaryBufferForMesh, 
    deserializeBinaryToHTML, 
    serializeHTMLToBinary,
    associateBinaryBufferWithMesh
} from '../../core/glb-utils.js';

// Store HTML content for each mesh
const meshHtmlContent = new Map();

// Store reference to the current GLB array buffer
let currentGlbBuffer = null;

/**
 * Set the current GLB buffer for HTML operations
 * @param {ArrayBuffer} glbBuffer - The GLB file as an ArrayBuffer
 */
export function setCurrentGlbBuffer(glbBuffer) {
    currentGlbBuffer = glbBuffer;
}

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
            console.log('HTML Editor Modal opened successfully');
        }).catch(error => {
            console.error('Error loading HTML content:', error);
            if (textarea) textarea.value = '';
            
            // Still show the modal even if loading fails
            modal.classList.add('visible');
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
    if (!currentGlbBuffer) {
        console.warn('No GLB buffer available to load HTML from');
        return '';
    }
    
    try {
        // Get binary buffer for this mesh
        const binaryBuffer = await getBinaryBufferForMesh(currentGlbBuffer, meshId);
        
        // If no buffer found, return empty string
        if (!binaryBuffer) {
            return '';
        }
        
        // Deserialize buffer to HTML
        const htmlContent = deserializeBinaryToHTML(binaryBuffer);
        
        // Cache the content
        meshHtmlContent.set(meshId, htmlContent);
        
        return htmlContent;
    } catch (error) {
        console.error('Error loading HTML from binary buffer:', error);
        return '';
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
    
    // Save button
    saveBtn.addEventListener('click', async () => {
        try {
            const currentMeshId = modal.dataset.meshId;
            if (currentMeshId) {
                const html = textarea.value;
                await saveHtmlForMesh(parseInt(currentMeshId), html);
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
}

/**
 * Close the HTML Editor Modal
 */
function closeModal() {
    const modal = document.getElementById('html-editor-modal');
    modal.classList.remove('visible');
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
 * Format HTML code
 * @param {string} html - The HTML code to format
 * @returns {string} The formatted HTML
 */
function formatHtml(html) {
    if (!html || html.trim() === '') return '';
    
    // Simple HTML formatting logic
    let formatted = '';
    let indent = 0;
    const lines = html.replace(/>\s*</g, '>\n<').split('\n');
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        
        // Check if line contains closing tag
        if (line.match(/^<\/.*>$/)) {
            indent -= 2; // Reduce indent for closing tag
        }
        
        // Add indentation
        formatted += ' '.repeat(Math.max(0, indent)) + line + '\n';
        
        // Check if line contains opening tag and not self-closing
        if (line.match(/^<[^/].*[^/]>$/) && !line.match(/<.*\/.*>/)) {
            indent += 2; // Increase indent for next line
        }
    });
    
    return formatted;
}

/**
 * Preview HTML code
 * @param {string} html - The HTML code to preview
 */
function previewHtml(html) {
    const previewContent = document.getElementById('html-preview-content');
    
    // Sanitize the HTML before displaying (basic sanitization)
    const sanitizedHtml = sanitizeHtml(html);
    
    // Update the preview
    previewContent.innerHTML = sanitizedHtml;
}

/**
 * Basic HTML sanitization to prevent XSS
 * @param {string} html - The HTML to sanitize
 * @returns {string} The sanitized HTML
 */
function sanitizeHtml(html) {
    // This is a simple sanitization to remove script tags
    // In a production environment, use a proper sanitization library
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/**
 * Save HTML content for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @param {string} html - The HTML content to save
 * @returns {Promise<void>} A promise that resolves when saving is complete
 */
async function saveHtmlForMesh(meshId, html) {
    // Save to our in-memory map
    meshHtmlContent.set(meshId, html);
    
    // If we have a GLB buffer, save to it
    if (currentGlbBuffer) {
        try {
            // Serialize HTML to binary
            const binaryData = serializeHTMLToBinary(html);
            
            // Associate binary data with mesh index in GLB
            const updatedGlb = await associateBinaryBufferWithMesh(
                currentGlbBuffer, 
                meshId, 
                binaryData
            );
            
            // Update the current GLB buffer with the modified version
            currentGlbBuffer = updatedGlb;
            
            // Update state with new buffer (you'll need to implement this in your state management)
            const state = getState();
            if (state.currentGlb) {
                updateState({
                    ...state,
                    currentGlb: {
                        ...state.currentGlb,
                        arrayBuffer: updatedGlb
                    }
                });
            }
            
            console.log(`Saved HTML for mesh ID ${meshId} to GLB`);
        } catch (error) {
            console.error('Error saving HTML to GLB:', error);
            throw error;
        }
    } else {
        console.warn(`No GLB buffer available, HTML for mesh ID ${meshId} saved in memory only`);
    }
    
    const state = getState();
    if (state.meshes && state.meshes[meshId]) {
        console.log(`Saved HTML for mesh: ${state.meshes[meshId].name}`);
    }
}

/**
 * Get HTML content for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @returns {string|null} The HTML content for the mesh, or null if not found
 */
function getHtmlForMesh(meshId) {
    return meshHtmlContent.get(meshId) || null;
}

/**
 * Load HTML content from GLB and apply to editor
 * @param {ArrayBuffer} glbBuffer - The GLB buffer containing HTML data
 * @param {number} meshId - The mesh ID to load HTML for
 * @returns {Promise<string>} - The loaded HTML content
 */
export async function loadHtmlFromGlb(glbBuffer, meshId) {
    if (!glbBuffer) {
        console.warn('No GLB buffer provided to load HTML from');
        return '';
    }

    try {
        // Set the current GLB buffer
        setCurrentGlbBuffer(glbBuffer);
        
        // Get binary buffer for this mesh
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshId);
        
        // If no buffer found, return empty string
        if (!binaryBuffer) {
            return '';
        }
        
        // Deserialize buffer to HTML
        const htmlContent = deserializeBinaryToHTML(binaryBuffer);
        
        // Cache the content
        meshHtmlContent.set(meshId, htmlContent);
        
        return htmlContent;
    } catch (error) {
        console.error('Error loading HTML from binary buffer:', error);
        return '';
    }
}

/**
 * Save HTML content to GLB
 * @param {ArrayBuffer} glbBuffer - The GLB buffer to save HTML to
 * @param {number} meshId - The mesh ID to save HTML for
 * @param {string} html - The HTML content to save
 * @returns {Promise<ArrayBuffer>} - The updated GLB buffer
 */
export async function saveHtmlToGlb(glbBuffer, meshId, html) {
    if (!glbBuffer) {
        console.warn('No GLB buffer provided to save HTML to');
        return null;
    }

    try {
        // Save to our in-memory map
        meshHtmlContent.set(meshId, html);
        
        // Serialize HTML to binary
        const binaryData = serializeHTMLToBinary(html);
        
        // Associate binary data with mesh index in GLB
        const updatedGlb = await associateBinaryBufferWithMesh(
            glbBuffer, 
            meshId, 
            binaryData
        );
        
        // Update current GLB buffer
        setCurrentGlbBuffer(updatedGlb);
        
        console.log(`Saved HTML for mesh ID ${meshId} to GLB`);
        return updatedGlb;
    } catch (error) {
        console.error('Error saving HTML to GLB:', error);
        throw error;
    }
}

// Make sure both the default export and named exports are available
export default {
    initHtmlEditorModal,
    openEmbeddedHtmlEditor,
    setCurrentGlbBuffer,
    loadHtmlFromGlb,
    saveHtmlToGlb
};