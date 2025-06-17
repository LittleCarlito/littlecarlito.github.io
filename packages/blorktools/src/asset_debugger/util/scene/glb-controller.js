import { processGLBFile } from '../data/upload/glb-file-handler.js';
import { getState, updateState } from '../state/scene-state.js';

let currentGlbBuffer = null;
let bufferUpdateListeners = [];
let initialized = false;

export function initModelIntegration() {
    console.log('Initializing model-HTML integration');
    
    const state = getState();
    if (!state.currentGlb) {
        updateState('currentGlb', {
            arrayBuffer: null,
            fileName: null,
            fileSize: null
        });
    }
    
    setupModelObserver();
    initialized = true;
}

function setupModelObserver() {
    let previousModelFile = null;
    
    setInterval(() => {
        const state = getState();
        
        if (state.modelFile !== previousModelFile && state.modelFile) {
            previousModelFile = state.modelFile;
            console.log('Model file changed, processing for HTML editor integration');
            processModelFileForHtmlEditor(state.modelFile);
        }
    }, 1000);
}

export async function processModelFileForHtmlEditor(file) {
    try {
        const result = await processGLBFile(file);
        
        if (!result || !result.arrayBuffer) {
            console.error('processGLBModel failed to return a valid buffer');
            return null;
        }
        
        console.debug(`processModelFileForHtmlEditor: processed buffer size ${result.arrayBuffer.byteLength} bytes`);
        
        const clonedBuffer = result.arrayBuffer.slice(0);
        
        const state = getState();
        updateState('currentGlb', {
            arrayBuffer: clonedBuffer,
            fileName: result.fileName,
            fileSize: result.fileSize
        });
        
        setCurrentGlbBuffer(clonedBuffer);
        
        console.log('Model processed for HTML editor integration:', result.fileName);
        return clonedBuffer;
    } catch (error) {
        console.error('Error processing model file for HTML editor:', error);
        return null;
    }
}

export function onGlbBufferUpdate(callback) {
    if (typeof callback !== 'function') return () => {};
    
    bufferUpdateListeners.push(callback);
    
    return () => {
        const index = bufferUpdateListeners.indexOf(callback);
        if (index >= 0) {
            bufferUpdateListeners.splice(index, 1);
        }
    };
}

function notifyBufferUpdate(glbBuffer) {
    setCurrentGlbBuffer(glbBuffer);
    
    for (const listener of bufferUpdateListeners) {
        try {
            listener(glbBuffer);
        } catch (error) {
            console.error('Error in buffer update listener:', error);
        }
    }
    
    const event = new CustomEvent('glb-buffer-changed', { detail: { buffer: glbBuffer } });
    window.dispatchEvent(event);
}

export async function updateGlbFile(updatedGlb, returnBuffer = false) {
    try {
        console.log(`Updating GLB file with buffer size: ${updatedGlb ? updatedGlb.byteLength : 0} bytes`);
        
        if (!updatedGlb || updatedGlb.byteLength === 0) {
            console.error('Cannot update GLB: Invalid buffer provided');
            return false;
        }
        
        const dataView = new DataView(updatedGlb);
        const magic = dataView.getUint32(0, true);
        const expectedMagic = 0x46546C67;
        
        if (magic !== expectedMagic) {
            console.error(`Invalid GLB file: Incorrect magic bytes`);
            return false;
        }
        
        const clonedBuffer = updatedGlb.slice(0);
        notifyBufferUpdate(clonedBuffer);
        
        const state = getState();
        if (state && state.currentGlb) {
            updateState('currentGlb', { 
                ...state.currentGlb,
                arrayBuffer: clonedBuffer
            });
            
            if (typeof window.updateDownloadLink === 'function') {
                window.updateDownloadLink(clonedBuffer);
            }
        } else {
            console.warn('No currentGlb in state to update');
        }
        
        return returnBuffer ? clonedBuffer : true;
    } catch (error) {
        console.error('Error updating GLB file:', error);
        return false;
    }
}

export async function downloadUpdatedGlb() {
    const glbBuffer = getCurrentGlbBuffer();
    if (!glbBuffer) {
        alert('No GLB file loaded to download.');
        return;
    }
    
    const state = getState();
    let fileName = 'model_' + getCurrentTimestamp() + '.glb';
    
    if (state.currentGlb && state.currentGlb.fileName) {
        const originalName = state.currentGlb.fileName;
        const nameParts = originalName.split('.');
        if (nameParts.length > 1) {
            const extension = nameParts.pop();
            fileName = nameParts.join('.') + '_' + getCurrentTimestamp() + '.' + extension;
        } else {
            fileName = originalName + '_' + getCurrentTimestamp() + '.glb';
        }
    }
    
    const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
    
    console.log(`Downloaded GLB as ${fileName}`);
}

function getCurrentTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

export function getMeshByIndex(meshIndex) {
    const state = getState();
    if (!state || !state.meshes || meshIndex >= state.meshes.length) {
        return null;
    }
    
    return state.meshes[meshIndex];
}


export function setCurrentGlbBuffer(glbBuffer) {
    currentGlbBuffer = glbBuffer;
}

export function getCurrentGlbBuffer() {
    if (currentGlbBuffer) {
        return currentGlbBuffer;
    }
    
    const state = getState();
    if (state && state.currentGlb && state.currentGlb.arrayBuffer) {
        currentGlbBuffer = state.currentGlb.arrayBuffer;
        return currentGlbBuffer;
    }
    
    return null;
}
