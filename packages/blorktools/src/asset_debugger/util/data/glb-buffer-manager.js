import { BINARY_DATA_PROPERTY, MESH_BINARY_EXTENSION, MESH_INDEX_PROPERTY } from "../state/glb-preview-state";
import { validateGLBHeader, validateJSONChunk, validateBinaryChunk, isRemovalOperation, hasExtension, hasBufferURI, isDataURI, getChunkInfo } from './glb-classifier.js';

export function associateBinaryBufferWithMesh(glbArrayBuffer, meshIndex, binaryData) {
    return new Promise((resolve, reject) => {
        try {
            const isRemoval = isRemovalOperation(binaryData);
            console.log(`${isRemoval ? 'Removing' : 'Associating'} binary data for mesh ${meshIndex} (${isRemoval ? 0 : binaryData.byteLength} bytes)`);
            
            const dataView = new DataView(glbArrayBuffer);
            validateGLBHeader(dataView);
            
            console.log(`GLB buffer size: ${dataView.byteLength} bytes`);
            
            const chunkInfo = getChunkInfo(dataView);
            console.log(`JSON chunk length: ${chunkInfo.jsonChunkLength} bytes`);
            
            validateJSONChunk(dataView, chunkInfo.jsonChunkLength);
            
            const gltf = parseJSONChunk(glbArrayBuffer, chunkInfo);
            ensureExtensions(gltf);
            
            const associations = gltf.extensions[MESH_BINARY_EXTENSION].meshBinaryAssociations;
            const existingAssociationIndex = associations.findIndex(assoc => assoc[MESH_INDEX_PROPERTY] === meshIndex);
            const existingAssociation = existingAssociationIndex >= 0 ? associations[existingAssociationIndex] : null;
            
            if (isRemoval && existingAssociation) {
                resolve(removeBinaryAssociation(glbArrayBuffer, gltf, associations, existingAssociationIndex, meshIndex));
                return;
            }
            
            resolve(addOrUpdateBinaryAssociation(glbArrayBuffer, gltf, meshIndex, binaryData, existingAssociation, associations, chunkInfo));
        } catch (error) {
            console.error('Error in associateBinaryBufferWithMesh:', error);
            reject(new Error(`Error associating binary buffer: ${error.message}`));
        }
    });
}

export function getBinaryBufferForMesh(glbArrayBuffer, meshIndex) {
    return new Promise((resolve, reject) => {
        try {
            const dataView = new DataView(glbArrayBuffer);
            validateGLBHeader(dataView);
            
            const chunkInfo = getChunkInfo(dataView);
            validateJSONChunk(dataView, chunkInfo.jsonChunkLength);
            
            const gltf = parseJSONChunk(glbArrayBuffer, chunkInfo);
            
            if (!hasExtension(gltf, MESH_BINARY_EXTENSION)) {
                resolve(null);
                return;
            }
            
            const associations = gltf.extensions[MESH_BINARY_EXTENSION].meshBinaryAssociations;
            if (!associations || !Array.isArray(associations)) {
                resolve(null);
                return;
            }
            
            const association = associations.find(assoc => assoc[MESH_INDEX_PROPERTY] === meshIndex);
            
            if (!association) {
                resolve(null);
                return;
            }
            
            const bufferIndex = association[BINARY_DATA_PROPERTY];
            
            if (!gltf.buffers || !gltf.buffers[bufferIndex]) {
                console.log(`Buffer ${bufferIndex} not found for mesh ${meshIndex}`);
                resolve(null);
                return;
            }
            
            const buffer = gltf.buffers[bufferIndex];
            console.log(`Found buffer ${bufferIndex} for mesh ${meshIndex} with length ${buffer.byteLength}`);
            
            resolve(extractBufferData(glbArrayBuffer, gltf, buffer, bufferIndex, chunkInfo));
        } catch (error) {
            console.error('Error retrieving binary buffer:', error);
            reject(new Error(`Error retrieving binary buffer: ${error.message}`));
        }
    });
}

function parseJSONChunk(glbArrayBuffer, chunkInfo) {
    const jsonData = glbArrayBuffer.slice(chunkInfo.jsonStart, chunkInfo.jsonEnd);
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(jsonData);
    return JSON.parse(jsonString);
}

function ensureExtensions(gltf) {
    if (!gltf.extensions) {
        gltf.extensions = {};
    }
    
    if (!gltf.extensions[MESH_BINARY_EXTENSION]) {
        gltf.extensions[MESH_BINARY_EXTENSION] = {
            meshBinaryAssociations: []
        };
    }
}

function removeBinaryAssociation(glbArrayBuffer, gltf, associations, existingAssociationIndex, meshIndex) {
    console.log(`Removing binary association for mesh ${meshIndex}`);
    associations.splice(existingAssociationIndex, 1);
    
    if (associations.length === 0) {
        delete gltf.extensions[MESH_BINARY_EXTENSION];
        
        if (Object.keys(gltf.extensions).length === 0) {
            delete gltf.extensions;
        }
    }
    
    const newJsonString = JSON.stringify(gltf);
    const newJsonBytes = new TextEncoder().encode(newJsonString);
    
    return updateGlbJsonOnly(glbArrayBuffer, newJsonBytes);
}

function addOrUpdateBinaryAssociation(glbArrayBuffer, gltf, meshIndex, binaryData, existingAssociation, associations, chunkInfo) {
    let bufferToUpdateIndex = -1;
    
    if (existingAssociation) {
        bufferToUpdateIndex = existingAssociation[BINARY_DATA_PROPERTY];
    } else {
        bufferToUpdateIndex = gltf.buffers ? gltf.buffers.length : 0;
        
        associations.push({
            [MESH_INDEX_PROPERTY]: meshIndex,
            [BINARY_DATA_PROPERTY]: bufferToUpdateIndex
        });
    }
    
    if (!gltf.buffers) {
        gltf.buffers = [];
    }
    
    const exactByteLength = binaryData.byteLength;
    const bufferLength = Math.ceil(exactByteLength / 4) * 4;
    
    if (bufferToUpdateIndex < gltf.buffers.length) {
        gltf.buffers[bufferToUpdateIndex] = {
            byteLength: exactByteLength
        };
        
        delete gltf.buffers[bufferToUpdateIndex].uri;
    } else {
        gltf.buffers.push({
            byteLength: exactByteLength
        });
    }
    
    return rebuildGLBWithBinaryData(glbArrayBuffer, gltf, bufferToUpdateIndex, binaryData, bufferLength, chunkInfo);
}

function rebuildGLBWithBinaryData(glbArrayBuffer, gltf, bufferToUpdateIndex, binaryData, bufferLength, chunkInfo) {
    const newJsonString = JSON.stringify(gltf);
    const newJsonBytes = new TextEncoder().encode(newJsonString);
    
    const paddedJsonLength = Math.ceil(newJsonBytes.length / 4) * 4;
    const jsonPadding = paddedJsonLength - newJsonBytes.length;
    
    const existingBuffers = extractExistingBuffers(glbArrayBuffer, gltf, bufferToUpdateIndex, chunkInfo);
    
    let totalBinarySize = 0;
    
    for (const buf of existingBuffers) {
        totalBinarySize += Math.ceil(buf.data.byteLength / 4) * 4;
    }
    
    totalBinarySize += bufferLength;
    
    const newTotalSize = 
        12 +
        8 + paddedJsonLength +
        8 + totalBinarySize;
    
    console.log(`New GLB total size: ${newTotalSize} bytes`);
    console.log(`New binary chunk size: ${totalBinarySize} bytes`);
    
    return buildNewGLB(newTotalSize, newJsonBytes, paddedJsonLength, jsonPadding, totalBinarySize, existingBuffers, binaryData, bufferLength);
}

function extractExistingBuffers(glbArrayBuffer, gltf, excludeBufferIndex, chunkInfo) {
    const dataView = new DataView(glbArrayBuffer);
    const existingBuffers = [];
    
    if (chunkInfo.binaryChunkOffset + 8 <= dataView.byteLength) {
        try {
            const binaryChunkHeaderLength = dataView.getUint32(chunkInfo.binaryChunkOffset, true);
            const binaryChunkType = dataView.getUint32(chunkInfo.binaryChunkOffset + 4, true);
            
            if (binaryChunkType === 0x004E4942) {
                console.log(`Original binary chunk found: ${binaryChunkHeaderLength} bytes`);
                
                let currentOffset = 0;
                
                for (let i = 0; i < gltf.buffers.length; i++) {
                    if (i === excludeBufferIndex) {
                        continue;
                    }
                    
                    if (gltf.buffers[i] && !hasBufferURI(gltf.buffers[i])) {
                        const bufLen = gltf.buffers[i].byteLength;
                        const paddedLen = Math.ceil(bufLen / 4) * 4;
                        
                        if (chunkInfo.binaryChunkOffset + 8 + currentOffset + bufLen <= dataView.byteLength) {
                            const bufData = glbArrayBuffer.slice(
                                chunkInfo.binaryChunkOffset + 8 + currentOffset,
                                chunkInfo.binaryChunkOffset + 8 + currentOffset + bufLen
                            );
                            
                            existingBuffers.push({
                                index: i,
                                data: bufData
                            });
                        }
                        
                        currentOffset += paddedLen;
                    }
                }
            }
        } catch (e) {
            console.warn('Error extracting existing binary data:', e);
        }
    }
    
    return existingBuffers;
}

function extractBufferData(glbArrayBuffer, gltf, buffer, bufferIndex, chunkInfo) {
    if (hasBufferURI(buffer)) {
        if (isDataURI(buffer.uri)) {
            const base64Data = buffer.uri.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        } else {
            throw new Error('External URI buffers not supported');
        }
    } else {
        return extractGLBBuffer(glbArrayBuffer, gltf, buffer, bufferIndex, chunkInfo);
    }
}

function extractGLBBuffer(glbArrayBuffer, gltf, buffer, bufferIndex, chunkInfo) {
    const dataView = new DataView(glbArrayBuffer);
    
    if (!validateBinaryChunk(dataView, chunkInfo.binaryChunkOffset)) {
        console.log(`No binary chunk found at offset ${chunkInfo.binaryChunkOffset}`);
        return null;
    }
    
    let currentOffset = 0;
    let foundBuffer = false;
    
    for (let i = 0; i < gltf.buffers.length; i++) {
        if (i === bufferIndex) {
            foundBuffer = true;
            break;
        }
        
        if (!hasBufferURI(gltf.buffers[i])) {
            const bufferLength = gltf.buffers[i].byteLength;
            const paddedLength = Math.ceil(bufferLength / 4) * 4;
            currentOffset += paddedLength;
        }
    }
    
    if (!foundBuffer) {
        console.warn(`Buffer index ${bufferIndex} exceeds buffer count`);
        return null;
    }
    
    const bufferStartOffset = chunkInfo.binaryChunkOffset + 8 + currentOffset;
    const bufferEndOffset = bufferStartOffset + buffer.byteLength;
    
    if (bufferEndOffset > dataView.byteLength) {
        console.warn(`Buffer extends beyond GLB file (${bufferEndOffset} > ${dataView.byteLength})`);
        return null;
    }
    
    console.log(`Extracting buffer at offset ${currentOffset} (${bufferStartOffset}-${bufferEndOffset})`);
    return glbArrayBuffer.slice(bufferStartOffset, bufferEndOffset);
}

function buildNewGLB(newTotalSize, newJsonBytes, paddedJsonLength, jsonPadding, totalBinarySize, existingBuffers, binaryData, bufferLength) {
    const newGlb = new ArrayBuffer(newTotalSize);
    const newDataView = new DataView(newGlb);
    const newUint8Array = new Uint8Array(newGlb);
    
    newDataView.setUint32(0, 0x46546C67, true);
    newDataView.setUint32(4, 2, true);
    newDataView.setUint32(8, newTotalSize, true);
    
    newDataView.setUint32(12, paddedJsonLength, true);
    newDataView.setUint32(16, 0x4E4F534A, true);
    
    newUint8Array.set(newJsonBytes, 20);
    
    for (let i = 0; i < jsonPadding; i++) {
        newUint8Array[20 + newJsonBytes.length + i] = 0x20;
    }
    
    const newBinaryChunkOffset = 20 + paddedJsonLength;
    
    newDataView.setUint32(newBinaryChunkOffset, totalBinarySize, true);
    newDataView.setUint32(newBinaryChunkOffset + 4, 0x004E4942, true);
    
    let currentBinaryOffset = newBinaryChunkOffset + 8;
    
    for (let i = 0; i < existingBuffers.length; i++) {
        const buf = existingBuffers[i];
        const bufArray = new Uint8Array(buf.data);
        const paddedLength = Math.ceil(buf.data.byteLength / 4) * 4;
        
        newUint8Array.set(bufArray, currentBinaryOffset);
        
        const padding = paddedLength - buf.data.byteLength;
        for (let j = 0; j < padding; j++) {
            newUint8Array[currentBinaryOffset + buf.data.byteLength + j] = 0;
        }
        
        currentBinaryOffset += paddedLength;
    }
    
    if (binaryData && binaryData.byteLength > 0) {
        const binaryArray = new Uint8Array(binaryData);
        
        newUint8Array.set(binaryArray, currentBinaryOffset);
        
        const padding = bufferLength - binaryData.byteLength;
        for (let i = 0; i < padding; i++) {
            newUint8Array[currentBinaryOffset + binaryData.byteLength + i] = 0;
        }
    }
    
    console.log('Successfully created new GLB with updated binary data');
    return newGlb;
}

function updateGlbJsonOnly(glbArrayBuffer, newJsonBytes) {
    const dataView = new DataView(glbArrayBuffer);
    
    const oldJsonChunkLength = dataView.getUint32(12, true);
    
    const jsonStart = 20;
    const jsonEnd = jsonStart + oldJsonChunkLength;
    
    const binaryChunkOffset = jsonEnd;
    let binaryChunkData = null;
    
    if (binaryChunkOffset + 8 <= dataView.byteLength) {
        const binaryChunkHeaderLength = dataView.getUint32(binaryChunkOffset, true);
        const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
        
        if (binaryChunkType === 0x004E4942) {
            binaryChunkData = glbArrayBuffer.slice(
                binaryChunkOffset, 
                binaryChunkOffset + 8 + binaryChunkHeaderLength
            );
        }
    }
    
    const paddedJsonLength = Math.ceil(newJsonBytes.length / 4) * 4;
    const jsonPadding = paddedJsonLength - newJsonBytes.length;
    
    const newTotalSize = 
        12 +
        8 + paddedJsonLength;
    
    const hasBinaryChunk = binaryChunkData !== null;
    const finalSize = hasBinaryChunk ? newTotalSize + (binaryChunkData.byteLength) : newTotalSize;
    
    const newGlb = new ArrayBuffer(finalSize);
    const newDataView = new DataView(newGlb);
    const newUint8Array = new Uint8Array(newGlb);
    
    newDataView.setUint32(0, 0x46546C67, true);
    newDataView.setUint32(4, 2, true);
    newDataView.setUint32(8, finalSize, true);
    
    newDataView.setUint32(12, paddedJsonLength, true);
    newDataView.setUint32(16, 0x4E4F534A, true);
    
    newUint8Array.set(newJsonBytes, 20);
    
    for (let i = 0; i < jsonPadding; i++) {
        newUint8Array[20 + newJsonBytes.length + i] = 0x20;
    }
    
    if (hasBinaryChunk) {
        const newBinaryOffset = 20 + paddedJsonLength;
        const binaryArray = new Uint8Array(binaryChunkData);
        newUint8Array.set(binaryArray, newBinaryOffset);
    }
    
    return newGlb;
}