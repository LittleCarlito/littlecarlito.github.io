import { getBinaryBufferForMesh, associateBinaryBufferWithMesh } from "./glb-utils";
import { getState } from "../scene/state";
import { deserializeStringFromBinary, serializeStringWithSettingsToBinary } from "./string-serder";
import { getCurrentGlbBuffer, updateGlbFile } from "../modals/html-editor-modal/model-integration";
import { defaultSettings, getSettingsFromForm } from "../modals/html-editor-modal/html-editor-modal";

// Store HTML content for each mesh
const meshHtmlContent = new Map();
const meshHtmlSettings = new Map();

/**
 * Save settings for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @param {Object} settings - The settings to save
 */
export function saveSettingsForMesh(meshId, settings) {
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
 * Load settings for a specific mesh and update the UI
 * @param {number} meshId - The ID/index of the mesh
 * @returns {Promise<Object>} The loaded settings
 */
export function loadSettingsForMesh(meshId) {
    return new Promise(resolve => {
        // First try to load from binary buffer if needed
        const state = getState();
        const glbBuffer = getCurrentGlbBuffer();
        
        // Get settings for this mesh from memory cache
        let settings = meshHtmlSettings.get(meshId);
        
        // If no settings in cache, try to load from binary buffer
        if (!settings && glbBuffer) {
            getBinaryBufferForMesh(glbBuffer, meshId).then(binaryBuffer => {
                if (binaryBuffer && binaryBuffer.byteLength > 0) {
                    const result = deserializeStringFromBinary(binaryBuffer);
                    if (result.settings) {
                        settings = result.settings;
                        // Cache the loaded settings
                        meshHtmlSettings.set(meshId, settings);
                    }
                }
                
                finishLoading();
            }).catch(err => {
                console.error('Error loading settings from buffer:', err);
                finishLoading();
            });
        } else {
            // If we already have settings or no GLB buffer, proceed
            finishLoading();
        }
        
        function finishLoading() {
            // Use cached settings or defaults
            settings = settings || { ...defaultSettings };
            console.log('Using settings for UI update:', settings);
            
            // Update render type dropdown
            const renderTypeSelect = document.getElementById('html-render-type');
            if (renderTypeSelect) {
                // Make sure the value is valid
                if (settings.previewMode && ['threejs', 'css3d', 'longExposure'].includes(settings.previewMode)) {
                    renderTypeSelect.value = settings.previewMode;
                } else {
                    renderTypeSelect.value = defaultSettings.previewMode;
                }
            }
            
            // Update playback speed dropdown
            const playbackSpeedSelect = document.getElementById('html-playback-speed');
            if (playbackSpeedSelect) {
                // Convert the numeric playback speed to string format that matches the dropdown options
                const playbackSpeed = settings.playbackSpeed !== undefined ? settings.playbackSpeed : defaultSettings.playbackSpeed;
                
                // Try to find exact match first
                let found = false;
                for (let i = 0; i < playbackSpeedSelect.options.length; i++) {
                    const optionValue = parseFloat(playbackSpeedSelect.options[i].value);
                    if (Math.abs(optionValue - playbackSpeed) < 0.01) {
                        playbackSpeedSelect.value = playbackSpeedSelect.options[i].value;
                        found = true;
                        break;
                    }
                }
                
                // If no exact match found, fallback to default
                if (!found) {
                    console.log(`No matching option found for playback speed: ${playbackSpeed}, using default`);
                    playbackSpeedSelect.value = "1.0";
                }
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
            
            // Update the dropdowns container class based on renderer selection
            const renderTypeValue = renderTypeSelect ? renderTypeSelect.value : 'threejs';
            const dropdownsContainer = document.getElementById('editor-dropdowns-container');
            if (dropdownsContainer) {
                if (renderTypeValue === 'longExposure') {
                    dropdownsContainer.classList.add('long-exposure-mode');
                } else {
                    dropdownsContainer.classList.remove('long-exposure-mode');
                }
            }
            
            // Resolve the promise with the settings
            resolve(settings);
        }
    });
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
 * Load HTML content for a specific mesh from GLB binary buffer
 * @param {number} meshId - The ID/index of the mesh
 * @param {boolean} forceReload - Force reload from binary buffer, ignoring cache
 * @returns {Promise<string>} The HTML content for the mesh
 */
export async function loadHtmlForMesh(meshId, forceReload = false) {
    // First check if we have cached content and not forcing reload
    const cachedHtml = meshHtmlContent.get(meshId);
    if (!forceReload && cachedHtml !== undefined) {
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
        
        // Deserialize buffer to HTML/text content and settings
        const result = deserializeStringFromBinary(binaryBuffer);
        let htmlContent = result.content || '';
        const settings = result.settings;
        
        // If we have settings, store them
        if (settings) {
            console.log(`Loaded settings for mesh ID ${meshId}:`, settings);
            meshHtmlSettings.set(meshId, settings);
            
            // Also store in mesh userData for persistence
            const state = getState();
            if (state.meshes && state.meshes[meshId]) {
                if (!state.meshes[meshId].userData) {
                    state.meshes[meshId].userData = {};
                }
                state.meshes[meshId].userData.htmlSettings = settings;
            }
        }
        
        // Validate the content
        if (htmlContent.trim() === '') {
            htmlContent = ''; // Ensure it's an empty string, not null or undefined
        } else {
            console.log(`Loaded content for mesh ID ${meshId}: ${htmlContent.substring(0, 50)}${htmlContent.length > 50 ? '...' : ''}`);
        }
        
        // Cache the content if it's not empty
        if (htmlContent && htmlContent.trim() !== '') {
            meshHtmlContent.set(meshId, htmlContent);
            console.log(`Successfully loaded content for mesh ID ${meshId}`);
        } else {
            // If empty, ensure we remove any cached content
            meshHtmlContent.delete(meshId);
            console.log(`No valid content found for mesh ID ${meshId}`);
        }
        
        return htmlContent;
    } catch (error) {
        console.error('Error loading content from binary buffer:', error);
        throw new Error(`Failed to load data: ${error.message}`);
    }
}

/**
 * Save content for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @param {string} content - The content to save
 * @returns {Promise<boolean>} A promise that resolves when saving is complete
 */
export async function saveHtmlForMesh(meshId, content) {
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
            meshHtmlSettings.delete(meshId);
            
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
        
        // Get current settings from the form
        const settings = getSettingsFromForm();
        
        // Save settings to our in-memory map
        saveSettingsForMesh(meshId, settings);
        
        // Serialize content with settings to binary
        const binaryData = serializeStringWithSettingsToBinary(content, settings);
        
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
 * Clear the HTML settings for a specific mesh from the in-memory cache
 * @param {number} meshId - The ID/index of the mesh to clear settings for
 */
export function clearMeshHtmlSettings(meshId) {
    meshHtmlSettings.delete(meshId);
    console.log(`Cleared cached HTML settings for mesh ID ${meshId}`);
}