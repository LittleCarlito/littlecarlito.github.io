import { 
    formatHtml as externalFormatHtml, 
    initHtmlFormatter 
} from '../../util/data/html-formatter.js';
import {
    initHtmlLinter,
    lintHtmlContent
} from '../../util/data/html-linter.js';
import { 
    MESH_BINARY_EXTENSION, 
    MESH_INDEX_PROPERTY, 
    BINARY_DATA_PROPERTY 
} from '../../util/state/glb-preview-state.js';
import * as THREE from 'three';
import { isPreviewActive, setLastTextureUpdateTime } from '../../util/state/animation-state';
import { initalizePreview } from '../../util/animation/playback/animation-preview-controller';
import { previewRenderTarget } from '../../util/state/threejs-state.js';
import { 
    getHtmlSettingsForMesh, 
    loadHtmlForMesh, 
    loadSettingsForMesh, 
    saveHtmlForMesh, 
    saveSettingsForMesh 
} from '../../util/data/mesh-html-manager.js';
import { cleanupThreeJsPreview } from '../../util/scene/threejs-preview-manager';
import { updateHtmlIcons } from '../../panels/asset-panel/mesh-heading/mesh-heading.js';

let maxCaptureRate = 0.5;

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

let listenersInitialized = false;

let htmlEditorState = {
    isOpen: false,
    changesSaved: false
};

let lintDebounceTimer = null;

export class CustomTextureSettings {
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
    
    get isLongExposureMode() {
        return this.animationType === 'longExposure';
    }
    
    updateStatus(message, type = 'info') {
        if (this.statusCallback) {
            this.statusCallback(message, type);
        }
    }
    
    handleError(message) {
        if (this.errorCallback) {
            this.errorCallback(message);
        }
    }
}

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
        
        if (meshNameEl) meshNameEl.textContent = meshName;
        
        modal.dataset.meshId = meshId;
        
        const forceReload = htmlEditorState.needsReload === true;
        if (forceReload) {
            console.log('Forcing reload from binary buffer for mesh ID:', meshId);
            htmlEditorState.needsReload = false;
        }
        
        if (forceReload) {
            const meshDataUtil = await import('../../util/data/mesh-html-manager');
            meshDataUtil.clearMeshHtmlSettings(meshId);
        }
        
        loadSettingsForMesh(meshId).then(settings => {
            console.log('Loaded settings:', settings);
            
            const renderTypeSelect = document.getElementById('html-render-type');
            const playbackSpeedSelect = document.getElementById('html-playback-speed');
            const animationTypeSelect = document.getElementById('html-animation-type');
            const showWireframeCheckbox = document.getElementById('show-wireframe');
            const displayOnMeshCheckbox = document.getElementById('display-on-mesh');
            const rigControlNodeCheckbox = document.getElementById('rig-control-node');
            const dropdownsContainer = document.getElementById('editor-dropdowns-container');
            
            if (renderTypeSelect) {
                if (settings.previewMode && ['threejs', 'css3d', 'longExposure'].includes(settings.previewMode)) {
                    renderTypeSelect.value = settings.previewMode;
                } else {
                    renderTypeSelect.value = 'threejs';
                }
            }
            
            if (playbackSpeedSelect) {
                const speedValue = settings.playbackSpeed ? settings.playbackSpeed.toString() : '1.0';
                
                const speedExists = Array.from(playbackSpeedSelect.options).some(option => option.value === speedValue);
                
                if (speedExists) {
                    playbackSpeedSelect.value = speedValue;
                } else {
                    playbackSpeedSelect.value = '1.0';
                }
            }
            
            if (animationTypeSelect && settings.animation && settings.animation.type) {
                if (['play', 'loop', 'bounce'].includes(settings.animation.type)) {
                    animationTypeSelect.value = settings.animation.type;
                } else {
                    animationTypeSelect.value = 'play';
                }
            }
            
            if (showWireframeCheckbox && settings.display) {
                showWireframeCheckbox.checked = settings.display.showBorders !== undefined ? 
                    settings.display.showBorders : true;
            }
            
            if (displayOnMeshCheckbox && settings.display) {
                displayOnMeshCheckbox.checked = settings.display.displayOnMesh || false;
            }

            if (rigControlNodeCheckbox && settings.display) {
                rigControlNodeCheckbox.checked = settings.display.rigControlNode || false;
            }
            
            if (renderTypeSelect && renderTypeSelect.value === 'longExposure' && dropdownsContainer) {
                dropdownsContainer.classList.add('long-exposure-mode');
            } else if (dropdownsContainer) {
                dropdownsContainer.classList.remove('long-exposure-mode');
            }
        });
        
        loadHtmlForMesh(meshId, forceReload).then(html => {
            if (textarea) textarea.value = html || '';
            
            modal.classList.remove('preview-mode');
            
            modal.classList.add('visible');
            htmlEditorState.isOpen = true;
            console.log('HTML Editor Modal opened successfully');
            
            lintHtmlContent();
        }).catch(error => {
            console.error('Error loading HTML content:', error);
            if (textarea) textarea.value = '';
            if (statusEl) showStatus(`Error loading HTML: ${error.message}`, 'error');
            
            modal.classList.remove('preview-mode');
            
            modal.classList.add('visible');
            htmlEditorState.isOpen = true;
        });
    } catch (error) {
        console.error('Error opening HTML Editor Modal:', error);
        alert('Failed to open HTML Editor. See console for details.');
    }
}

export function getSettingsFromForm() {
    const animationType = document.getElementById('html-animation-type').value;
    const showWireframeCheckbox = document.getElementById('show-wireframe');
    const displayOnMeshCheckbox = document.getElementById('display-on-mesh');
    const rigControlNodeCheckbox = document.getElementById('rig-control-node');
    
    return {
        previewMode: document.getElementById('html-render-type').value || defaultSettings.previewMode,
        playbackSpeed: parseFloat(document.getElementById('html-playback-speed').value),
        animation: {
            type: animationType
        },
        display: {
            showBorders: showWireframeCheckbox ? showWireframeCheckbox.checked : true,
            displayOnMesh: displayOnMeshCheckbox ? displayOnMeshCheckbox.checked : false,
            rigControlNode: rigControlNodeCheckbox ? rigControlNodeCheckbox.checked : false
        }
    };
}

export function initHtmlEditorModal() {
    console.log('Initializing HTML Editor Modal');
    
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
    
    const renderTypeSelect = document.getElementById('html-render-type');
    const playbackSpeedSelect = document.getElementById('html-playback-speed');
    const animationTypeSelect = document.getElementById('html-animation-type');
    
    const showWireframeCheckbox = document.getElementById('show-wireframe');
    
    window.showPreviewBorders = showWireframeCheckbox ? showWireframeCheckbox.checked : true;
    
    window.openEmbeddedHtmlEditor = openEmbeddedHtmlEditor;
    window.getHtmlSettingsForMesh = getHtmlSettingsForMesh;
    console.log('Registered global function: window.openEmbeddedHtmlEditor =', 
                typeof window.openEmbeddedHtmlEditor === 'function' ? 'Function successfully registered' : 'Failed to register function');

    if (!modal) {
        console.error('HTML Editor Modal not found in the DOM');
        return;
    }
    
    if (renderTypeSelect && renderTypeSelect.value === 'longExposure') {
        const dropdownsContainer = document.getElementById('editor-dropdowns-container');
        if (dropdownsContainer) {
            dropdownsContainer.classList.add('long-exposure-mode');
        }
    }

    if (listenersInitialized) {
        console.log('HTML Editor Modal event listeners already initialized, skipping');
        return;
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    if (renderTypeSelect) {
        renderTypeSelect.addEventListener('change', () => {
            const meshId = parseInt(modal.dataset.meshId);
            if (!isNaN(meshId)) {
                const settings = getSettingsFromForm();
                saveSettingsForMesh(meshId, settings);
                showStatus(`Render type set to: ${renderTypeSelect.options[renderTypeSelect.selectedIndex].text}`, 'info');
                
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
            const meshId = parseInt(modal.dataset.meshId);
            if (!isNaN(meshId)) {
                const settings = getSettingsFromForm();
                const oldPlaybackSpeed = settings.playbackSpeed || 1.0;
                const newPlaybackSpeed = parseFloat(playbackSpeedSelect.value);
                
                saveSettingsForMesh(meshId, settings);
                
                if (isPreviewActive) {
                    try {
                        const css3dIframe = document.getElementById('css3d-panel-iframe');
                        if (css3dIframe && css3dIframe.contentDocument) {
                            const styleEl = css3dIframe.contentDocument.querySelector('style');
                            if (styleEl) {
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
            const meshId = parseInt(modal.dataset.meshId);
            if (!isNaN(meshId)) {
                const settings = getSettingsFromForm();
                saveSettingsForMesh(meshId, settings);
                showStatus(`Animation type set to: ${animationTypeSelect.options[animationTypeSelect.selectedIndex].text}`, 'info');
            }
        });
    }
    
    if (showWireframeCheckbox) {
        showWireframeCheckbox.addEventListener('change', () => {
            window.showPreviewBorders = showWireframeCheckbox.checked;
            
            if (isPreviewActive && previewRenderTarget) {
                setLastTextureUpdateTime(0);
                showStatus(`Borders ${showWireframeCheckbox.checked ? 'enabled' : 'disabled'}`, 'info');
            }
        });
    }
    
    const displayOnMeshCheckbox = document.getElementById('display-on-mesh');
    if (displayOnMeshCheckbox) {
        displayOnMeshCheckbox.addEventListener('change', () => {
            showStatus(`Display on mesh ${displayOnMeshCheckbox.checked ? 'enabled' : 'disabled'}`, 'info');
        });
    }

    const rigControlNodeCheckbox = document.getElementById('rig-control-node');
    if (rigControlNodeCheckbox) {
        rigControlNodeCheckbox.addEventListener('change', () => {
            showStatus(`Rig control node ${rigControlNodeCheckbox.checked ? 'enabled' : 'disabled'}`, 'info');
        });
    }
    
    formatBtn.addEventListener('click', async () => {
        try {
            const selectionStart = textarea.selectionStart;
            const selectionEnd = textarea.selectionEnd;
            const hasSelection = selectionStart !== selectionEnd;
            
            let htmlToFormat, formattedHtml;
            
            if (hasSelection) {
                htmlToFormat = textarea.value.substring(selectionStart, selectionEnd);
            } else {
                htmlToFormat = textarea.value;
            }
            
            formattedHtml = await externalFormatHtml(htmlToFormat);
            
            if (hasSelection) {
                textarea.value = 
                    textarea.value.substring(0, selectionStart) + 
                    formattedHtml + 
                    textarea.value.substring(selectionEnd);
                
                textarea.selectionStart = selectionStart;
                textarea.selectionEnd = selectionStart + formattedHtml.length;
            } else {
                textarea.value = formattedHtml;
            }
            
            showStatus(`${hasSelection ? 'Selection' : 'HTML'} formatted successfully`, 'success');
            
            lintHtmlContent();
        } catch (error) {
            showStatus('Error formatting HTML: ' + error.message, 'error');
        }
    });
    
    textarea.addEventListener('input', () => {
        clearTimeout(lintDebounceTimer);
        lintDebounceTimer = setTimeout(() => {
            lintHtmlContent();
        }, 500);
    });
    
    function handlePreviewClick() {
        const modal = document.getElementById('html-editor-modal');
        const textarea = document.getElementById('html-editor-textarea');
        const previewContent = document.getElementById('html-preview-content');
        const errorContainer = document.getElementById('html-editor-errors');
        
        try {
            const html = textarea.value;
            const meshId = parseInt(modal.dataset.meshId);
            
            const renderTypeSelect = document.getElementById('html-render-type');
            let previewMode = renderTypeSelect ? renderTypeSelect.value : 'threejs';
            
            const playbackSpeedSelect = document.getElementById('html-playback-speed');
            const playbackSpeed = playbackSpeedSelect ? parseFloat(playbackSpeedSelect.value) : 1.0;
            
            const animationTypeSelect = document.getElementById('html-animation-type');
            let animationType = animationTypeSelect ? animationTypeSelect.value : 'play';
            
            if (previewMode === 'longExposure') {
                previewMode = 'threejs';
                animationType = 'longExposure';
            }
            
            const showWireframeCheckbox = document.getElementById('show-wireframe');
            const showPreviewBorders = showWireframeCheckbox ? showWireframeCheckbox.checked : true;
            
            const settings = new CustomTextureSettings(
                html,
                meshId,
                previewMode,
                playbackSpeed,
                animationType,
                showPreviewBorders,
                showStatus,
                (error) => showStatus(error, 'error'),
                errorContainer
            );
            
            const setModalData = (key, value) => {
                modal.dataset[key] = value;
            };
            
            initalizePreview(settings, previewContent, setModalData);
            
            modal.classList.add('preview-mode');
            
            if (renderTypeSelect) {
                const previewModeName = renderTypeSelect.options[renderTypeSelect.selectedIndex].text;
                showStatus(`Preview mode: ${previewModeName}`, 'info');
            }
        } catch (error) {
            showStatus('Error generating preview: ' + error.message, 'error');
        }
    }

    previewBtn.addEventListener('click', handlePreviewClick);
    
    resetBtn.addEventListener('click', () => {
        modal.classList.remove('preview-mode');
        
        cleanupThreeJsPreview();
        
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
        
        const controlsContainer = document.getElementById('html-preview-content').querySelector('.preview-controls');
        if (controlsContainer) {
            controlsContainer.remove();
        }
        
        showStatus('Editor view restored', 'info');
    });
    
    applyBtn.addEventListener('click', async () => {
        const modal = document.getElementById('html-editor-modal');
        const textarea = document.getElementById('html-editor-textarea');
        const meshId = parseInt(modal.dataset.meshId);
        if (isNaN(meshId)) {
            showStatus('Error: No mesh ID found', 'error');
            return;
        }
        const htmlContent = textarea.value;
        try {
            showStatus('Saving HTML content and settings...', 'info');
            await saveHtmlForMesh(meshId, htmlContent);
            htmlEditorState.changesSaved = true;
            updateHtmlIcons();
            showStatus('HTML content and settings saved successfully!', 'success');
            closeModal();
        } catch (error) {
            console.error('Error saving HTML content:', error);
            showStatus(`Error saving: ${error.message}`, 'error');
        }
    });
    
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            
            this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
            
            this.selectionStart = this.selectionEnd = start + 4;
        }
    });
    
    listenersInitialized = true;
    console.log('HTML Editor Modal event listeners initialized successfully');
}

function closeModal() {
    const modal = document.getElementById('html-editor-modal');
    const meshId = parseInt(modal.dataset.meshId);
    
    modal.classList.remove('visible');
    htmlEditorState.isOpen = false;
    
    cleanupThreeJsPreview();
    
    if (!isNaN(meshId) && !htmlEditorState.changesSaved) {
        console.log('Discarding unsaved changes for mesh ID:', meshId);
        htmlEditorState.needsReload = true;
    }
    
    htmlEditorState.changesSaved = false;
}

export function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('html-editor-status');
    statusEl.textContent = message;
    statusEl.className = `editor-status ${type}`;
    
    const delay = (type === 'success' || type === 'error') ? 5000 : 3000;
    
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'editor-status';
    }, delay);
}

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
    
    const modal = document.getElementById('html-editor-modal');
    const editorContainer = modal ? modal.querySelector('.editor-container') : null;
    
    if (editorContainer) {
        editorContainer.style.position = 'relative';
        editorContainer.appendChild(container);
    } else {
        if (modal) {
            modal.appendChild(container);
        }
    }
    
    return container;
}

async function verifyExtensionExists(glbBuffer, meshId) {
    if (!glbBuffer) {
        console.error('verifyExtensionExists: No GLB buffer provided');
        return false;
    }
    
    try {
        console.log(`Verifying binary extension for mesh ${meshId} in buffer size: ${glbBuffer.byteLength} bytes`);
        
        const dataView = new DataView(glbBuffer);
        
        if (dataView.byteLength < 12) {
            console.error('Buffer too small for valid GLB');
            return false;
        }
        
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) {
            console.error(`Invalid GLB magic number: ${magic.toString(16)}`);
            return false;
        }
        
        const jsonChunkLength = dataView.getUint32(12, true);
        
        const jsonStart = 20;
        const jsonEnd = jsonStart + jsonChunkLength;
        const jsonData = glbBuffer.slice(jsonStart, jsonEnd);
        const jsonString = new TextDecoder('utf-8').decode(jsonData);
        const gltf = JSON.parse(jsonString);
        
        if (!gltf.extensions || !gltf.extensions[MESH_BINARY_EXTENSION]) {
            return false;
        }
        
        const associations = gltf.extensions[MESH_BINARY_EXTENSION].meshBinaryAssociations;
        if (!associations || !Array.isArray(associations)) {
            return false;
        }
        
        const association = associations.find(assoc => assoc[MESH_INDEX_PROPERTY] === meshId);
        const found = !!association;
        
        if (found) {
            const bufferIndex = association[BINARY_DATA_PROPERTY];
            
            if (!gltf.buffers || !gltf.buffers[bufferIndex]) {
                console.log(`Buffer ${bufferIndex} referenced but not found for mesh ${meshId}`);
                return false;
            }
            
            console.log(`Found binary extension for mesh ${meshId} -> buffer ${bufferIndex}`);
        }
        
        return found;
    } catch (error) {
        console.error('Error verifying extension:', error);
        return false;
    }
}

export function resetInitialization() {
    listenersInitialized = false;
    console.log('HTML Editor Modal initialization flag reset');
}