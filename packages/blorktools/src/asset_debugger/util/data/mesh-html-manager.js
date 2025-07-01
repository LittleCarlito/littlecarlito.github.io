import { getState } from "../state/scene-state";
import { deserializeStringFromBinary, serializeStringWithSettingsToBinary } from "./string-serder";
import { defaultSettings, getSettingsFromForm } from "../../modals/html-editor-modal/html-editor-modal";
import { associateBinaryBufferWithMesh, getBinaryBufferForMesh } from "./glb-buffer-manager";
import { updateGlbFile, getCurrentGlbBuffer } from "../scene/glb-controller";
import { meshesWithHtml } from "../../panels/asset-panel/mesh-heading/mesh-heading";

const meshHtmlContent = new Map();
const meshHtmlSettings = new Map();

export function saveSettingsForMesh(meshId, settings) {
    meshHtmlSettings.set(meshId, settings);
    
    const state = getState();
    if (state.meshes && state.meshes[meshId]) {
        if (!state.meshes[meshId].userData) {
            state.meshes[meshId].userData = {};
        }
        state.meshes[meshId].userData.htmlSettings = settings;
        console.log(`Saved HTML settings for mesh: ${state.meshes[meshId].name}`);
    }
}

export function loadSettingsForMesh(meshId) {
    return new Promise(resolve => {
        const state = getState();
        const glbBuffer = getCurrentGlbBuffer();
        
        let settings = meshHtmlSettings.get(meshId);
        
        if (!settings && glbBuffer) {
            getBinaryBufferForMesh(glbBuffer, meshId).then(binaryBuffer => {
                if (binaryBuffer && binaryBuffer.byteLength > 0) {
                    const result = deserializeStringFromBinary(binaryBuffer);
                    if (result.settings) {
                        settings = result.settings;
                        meshHtmlSettings.set(meshId, settings);
                    }
                }
                
                finishLoading();
            }).catch(err => {
                console.error('Error loading settings from buffer:', err);
                finishLoading();
            });
        } else {
            finishLoading();
        }
        
        function finishLoading() {
            settings = settings || { ...defaultSettings };
            console.log('Using settings for UI update:', settings);
            
            const renderTypeSelect = document.getElementById('html-render-type');
            if (renderTypeSelect) {
                if (settings.previewMode && ['threejs', 'css3d', 'longExposure'].includes(settings.previewMode)) {
                    renderTypeSelect.value = settings.previewMode;
                } else {
                    renderTypeSelect.value = defaultSettings.previewMode;
                }
            }
            
            const playbackSpeedSelect = document.getElementById('html-playback-speed');
            if (playbackSpeedSelect) {
                const playbackSpeed = settings.playbackSpeed !== undefined ? settings.playbackSpeed : defaultSettings.playbackSpeed;
                
                let found = false;
                for (let i = 0; i < playbackSpeedSelect.options.length; i++) {
                    const optionValue = parseFloat(playbackSpeedSelect.options[i].value);
                    if (Math.abs(optionValue - playbackSpeed) < 0.01) {
                        playbackSpeedSelect.value = playbackSpeedSelect.options[i].value;
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    console.log(`No matching option found for playback speed: ${playbackSpeed}, using default`);
                    playbackSpeedSelect.value = "1.0";
                }
            }
            
            const animationTypeSelect = document.getElementById('html-animation-type');
            if (animationTypeSelect) {
                const animationType = settings.animation && settings.animation.type !== undefined 
                    ? settings.animation.type 
                    : 'none';
                animationTypeSelect.value = animationType;
            }
            
            const showWireframeCheckbox = document.getElementById('show-wireframe');
            if (showWireframeCheckbox && settings.display) {
                showWireframeCheckbox.checked = settings.display.showBorders !== undefined 
                    ? settings.display.showBorders 
                    : true;
                window.showPreviewBorders = showWireframeCheckbox.checked;
            }
            
            const renderTypeValue = renderTypeSelect ? renderTypeSelect.value : 'threejs';
            const dropdownsContainer = document.getElementById('editor-dropdowns-container');
            if (dropdownsContainer) {
                if (renderTypeValue === 'longExposure') {
                    dropdownsContainer.classList.add('long-exposure-mode');
                } else {
                    dropdownsContainer.classList.remove('long-exposure-mode');
                }
            }
            
            resolve(settings);
        }
    });
}

export async function getHtmlSettingsForMesh(meshId) {
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        console.warn('No GLB buffer available to load settings from');
        return { ...defaultSettings };
    }
    
    try {
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshId);
        
        if (!binaryBuffer || binaryBuffer.byteLength === 0) {
            return { ...defaultSettings };
        }
        
        const result = deserializeStringFromBinary(binaryBuffer);
        return result.settings || { ...defaultSettings };
    } catch (error) {
        console.error('Error loading settings from GLB binary buffer:', error);
        return { ...defaultSettings };
    }
}

export async function loadHtmlForMesh(meshId, forceReload = false) {
    const cachedHtml = meshHtmlContent.get(meshId);
    if (!forceReload && cachedHtml !== undefined) {
        return cachedHtml;
    }
    
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        console.warn('No GLB buffer available to load HTML from');
        return '';
    }
    
    try {
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshId);
        
        if (!binaryBuffer) {
            return '';
        }
        
        const result = deserializeStringFromBinary(binaryBuffer);
        let htmlContent = result.content || '';
        const settings = result.settings;
        
        if (settings) {
            console.log(`Loaded settings for mesh ID ${meshId}:`, settings);
            meshHtmlSettings.set(meshId, settings);
            
            const state = getState();
            if (state.meshes && state.meshes[meshId]) {
                if (!state.meshes[meshId].userData) {
                    state.meshes[meshId].userData = {};
                }
                state.meshes[meshId].userData.htmlSettings = settings;
            }
        }
        
        if (htmlContent.trim() === '') {
            htmlContent = '';
        } else {
            console.log(`Loaded content for mesh ID ${meshId}: ${htmlContent.substring(0, 50)}${htmlContent.length > 50 ? '...' : ''}`);
        }
        
        if (htmlContent && htmlContent.trim() !== '') {
            meshHtmlContent.set(meshId, htmlContent);
            console.log(`Successfully loaded content for mesh ID ${meshId}`);
        } else {
            meshHtmlContent.delete(meshId);
            console.log(`No valid content found for mesh ID ${meshId}`);
        }
        
        return htmlContent;
    } catch (error) {
        console.error('Error loading content from binary buffer:', error);
        throw new Error(`Failed to load data: ${error.message}`);
    }
}

export async function saveHtmlForMesh(meshId, content) {
    const isEmpty = !content || content.trim() === '';
    
    const glbBuffer = getCurrentGlbBuffer();
    
    if (!glbBuffer) {
        console.warn(`No GLB buffer available, content for mesh ID ${meshId} saved in memory only`);
        throw new Error('No GLB buffer available to save content. Your changes are saved in memory but will be lost when you reload.');
    }

    try {
        const settings = getSettingsFromForm();
        
        // Check if settings are different from defaults
        const hasCustomSettings = JSON.stringify(settings) !== JSON.stringify(defaultSettings);
        
        if (isEmpty && !hasCustomSettings) {
            console.log(`Removing content and default settings for mesh ID ${meshId}...`);
            
            meshHtmlContent.delete(meshId);
            meshHtmlSettings.delete(meshId);
            
            const emptyBuffer = new ArrayBuffer(0);
            
            const updatedGlb = await associateBinaryBufferWithMesh(
                glbBuffer, 
                meshId, 
                emptyBuffer
            );
            
            await updateGlbFile(updatedGlb);
            
            console.log(`Successfully removed content for mesh ID ${meshId}`);
            
            window.removeMeshHtmlFlag(meshId);
            
            return true;
        }
        
        console.log(`Serializing content and settings for mesh ID ${meshId}...`);
        
        meshHtmlContent.set(meshId, content);
        saveSettingsForMesh(meshId, settings);
        
        const binaryData = serializeStringWithSettingsToBinary(content || '', settings);
        
        console.log(`Associating binary data with mesh ID ${meshId} in GLB...`);
        const updatedGlb = await associateBinaryBufferWithMesh(
            glbBuffer, 
            meshId, 
            binaryData
        );
        
        await updateGlbFile(updatedGlb);
        
        console.log(`Successfully saved content and settings for mesh ID ${meshId} to GLB`);
        
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

export function clearMeshHtmlSettings(meshId) {
    meshHtmlSettings.delete(meshId);
    console.log(`Cleared cached HTML settings for mesh ID ${meshId}`);
}

/**
 * Check if a mesh has binary content
 * @param {number} meshIndex - The index of the mesh to check
 * @returns {Promise<boolean>} Promise that resolves to true if the mesh has any binary content
 */
export async function checkMeshHasHtmlContent(meshIndex) {
    if (window._forcedHtmlStates && meshIndex in window._forcedHtmlStates) {
        console.log(`Using forced HTML state for mesh ${meshIndex}: ${window._forcedHtmlStates[meshIndex]}`);
        return window._forcedHtmlStates[meshIndex];
    }
    
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        return false;
    }
    
    try {
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshIndex);
        
        if (binaryBuffer && binaryBuffer.byteLength > 0) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking if mesh has binary content:', error);
        return false;
    }
}