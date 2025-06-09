/**
 * GLB Utility Module
 * 
 * Handles GLB model loading, processing, and preview rendering.
 * Adds functionality for associating binary buffers with mesh indices in GLB extensions.
 */

import * as THREE from 'three';
import { processModelFile } from './workers/worker-manager.js';

// Constants for extension identification
export const MESH_BINARY_EXTENSION = 'BLORK_mesh_binary_data';
export const MESH_INDEX_PROPERTY = 'meshIndex';
export const BINARY_DATA_PROPERTY = 'binaryData';

// Keep track of preview resources for cleanup
export let previewRenderer = null;
export let previewScene = null;
export let previewCamera = null;
export let previewControls = null;
export let previewAnimationFrame = null;

/**
 * Process a GLB model file using web workers
 * @param {File} file - The GLB file to process
 * @returns {Promise} A promise that resolves when processing is complete
 */
export async function processGLBModel(file) {
    // Basic file validation client-side before sending to worker
    if (!file || !file.name.toLowerCase().endsWith('.glb')) {
        throw new Error('Invalid GLB file');
    }
    
    try {
        // Process the file using the worker-manager
        // This handles the file in a separate thread
        const result = await processModelFile(file);
        
        if (result.status !== 'success') {
            throw new Error(result.error || 'Unknown error processing GLB file');
        }
        
        // Convert file to array buffer for further processing
        const arrayBuffer = await file.arrayBuffer();
        
        return {
            arrayBuffer,
            fileName: file.name,
            fileSize: file.size,
            ...result // Include any additional metadata from worker
        };
    } catch (error) {
        console.error('Error in processGLBModel:', error);
        throw error;
    }
}

/**
 * Associate binary buffer data with a mesh index in a GLB file
 * @param {ArrayBuffer} glbArrayBuffer - The GLB file as an ArrayBuffer
 * @param {number} meshIndex - The index of the mesh to associate data with
 * @param {ArrayBuffer} binaryData - The binary data to associate
 * @returns {Promise<ArrayBuffer>} A promise that resolves with the modified GLB
 */
export function associateBinaryBufferWithMesh(glbArrayBuffer, meshIndex, binaryData) {
    return new Promise((resolve, reject) => {
        try {
            // Check if this is a removal operation (empty buffer)
            const isRemoval = !binaryData || binaryData.byteLength === 0;
            console.log(`${isRemoval ? 'Removing' : 'Associating'} binary data for mesh ${meshIndex} (${isRemoval ? 0 : binaryData.byteLength} bytes)`);
            
            // Parse the GLB to access the JSON content
            const dataView = new DataView(glbArrayBuffer);
            
            // GLB header validation
            if (dataView.byteLength < 12) {
                reject(new Error('Invalid GLB: File too small'));
                return;
            }
            
            console.log(`GLB buffer size: ${dataView.byteLength} bytes`);
            
            // Check GLB magic
            const magic = dataView.getUint32(0, true);
            const expectedMagic = 0x46546C67; // 'glTF' in ASCII
            if (magic !== expectedMagic) {
                reject(new Error('Invalid GLB: Incorrect magic bytes'));
                return;
            }
            
            // Get GLB version
            const version = dataView.getUint32(4, true);
            if (version !== 2) {
                reject(new Error(`Unsupported GLB version: ${version}`));
                return;
            }
            
            // Get chunk 0 (JSON) length
            const jsonChunkLength = dataView.getUint32(12, true);
            const jsonChunkType = dataView.getUint32(16, true);
            
            console.log(`JSON chunk length: ${jsonChunkLength} bytes`);
            
            if (jsonChunkType !== 0x4E4F534A) { // 'JSON' in ASCII
                reject(new Error('Invalid GLB: First chunk is not JSON'));
                return;
            }
            
            // Extract the JSON chunk
            const jsonStart = 20;
            const jsonEnd = jsonStart + jsonChunkLength;
            
            // Validate JSON chunk boundaries
            if (jsonEnd > dataView.byteLength) {
                reject(new Error('Invalid GLB: JSON chunk extends beyond file size'));
                return;
            }
            
            const jsonData = glbArrayBuffer.slice(jsonStart, jsonEnd);
            const decoder = new TextDecoder('utf-8');
            const jsonString = decoder.decode(jsonData);
            const gltf = JSON.parse(jsonString);
            
            // Ensure extensions object exists
            if (!gltf.extensions) {
                gltf.extensions = {};
            }
            
            // Create or update our custom extension
            if (!gltf.extensions[MESH_BINARY_EXTENSION]) {
                gltf.extensions[MESH_BINARY_EXTENSION] = {
                    meshBinaryAssociations: []
                };
            }
            
            // Find if there's an existing association for this mesh index
            const associations = gltf.extensions[MESH_BINARY_EXTENSION].meshBinaryAssociations;
            const existingAssociationIndex = associations.findIndex(assoc => assoc[MESH_INDEX_PROPERTY] === meshIndex);
            const existingAssociation = existingAssociationIndex >= 0 ? associations[existingAssociationIndex] : null;
            
            // If this is a removal operation and there's an existing association, remove it
            if (isRemoval && existingAssociation) {
                console.log(`Removing binary association for mesh ${meshIndex}`);
                // Remove the association
                associations.splice(existingAssociationIndex, 1);
                
                // If there are no more associations, remove the extension
                if (associations.length === 0) {
                    delete gltf.extensions[MESH_BINARY_EXTENSION];
                    
                    // If there are no more extensions, remove the extensions object
                    if (Object.keys(gltf.extensions).length === 0) {
                        delete gltf.extensions;
                    }
                }
                
                // Create a new JSON string with the updated extensions
                const newJsonString = JSON.stringify(gltf);
                const newJsonBytes = new TextEncoder().encode(newJsonString);
                
                // Create a new GLB with the updated JSON but keeping the binary chunk
                const updatedGlb = updateGlbJsonOnly(glbArrayBuffer, newJsonBytes);
                resolve(updatedGlb);
                return;
            }
            
            // For non-removal operations, we'll rebuild the entire binary chunk
            // to avoid contamination between buffers
            
            // First, collect all existing buffers except the one we're updating
            const existingBuffers = [];
            let bufferToUpdateIndex = -1;
            
            if (existingAssociation) {
                // Use existing association's buffer index
                bufferToUpdateIndex = existingAssociation[BINARY_DATA_PROPERTY];
            } else {
                // Create a new buffer index
                bufferToUpdateIndex = gltf.buffers ? gltf.buffers.length : 0;
                
                // Add the new association
                associations.push({
                    [MESH_INDEX_PROPERTY]: meshIndex,
                    [BINARY_DATA_PROPERTY]: bufferToUpdateIndex
                });
            }
            
            // Ensure buffers array exists
            if (!gltf.buffers) {
                gltf.buffers = [];
            }
            
            // Store the exact byte length (no padding)
            const exactByteLength = binaryData.byteLength;
            
            // Calculate buffer length with padding to 4 bytes alignment for GLB spec
            const bufferLength = Math.ceil(exactByteLength / 4) * 4;
            
            // Create or update buffer reference
            if (bufferToUpdateIndex < gltf.buffers.length) {
                // Update existing buffer - use exact byte length in the JSON
                gltf.buffers[bufferToUpdateIndex] = {
                    byteLength: exactByteLength
                };
                
                // Remove any URI if it exists
                delete gltf.buffers[bufferToUpdateIndex].uri;
            } else {
                // Add new buffer - use exact byte length in the JSON
                gltf.buffers.push({
                    byteLength: exactByteLength
                });
            }
            
            // Create a new JSON string with the updated extensions and buffers
            const newJsonString = JSON.stringify(gltf);
            const newJsonBytes = new TextEncoder().encode(newJsonString);
            
            // Calculate padded JSON length (must be multiple of 4)
            const paddedJsonLength = Math.ceil(newJsonBytes.length / 4) * 4;
            const jsonPadding = paddedJsonLength - newJsonBytes.length;
            
            // Extract all existing binary data that we want to keep
            const binaryChunkOffset = jsonEnd;
            const existingBinaryData = [];
            
            // Check if there's a binary chunk in the original GLB
            if (binaryChunkOffset + 8 <= dataView.byteLength) {
                try {
                    const binaryChunkHeaderLength = dataView.getUint32(binaryChunkOffset, true);
                    const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
                    
                    if (binaryChunkType === 0x004E4942) { // 'BIN' in ASCII
                        console.log(`Original binary chunk found: ${binaryChunkHeaderLength} bytes`);
                        
                        // Extract all buffers from the existing binary chunk
                        let currentOffset = 0;
                        
                        for (let i = 0; i < gltf.buffers.length; i++) {
                            // Skip the buffer we're updating
                            if (i === bufferToUpdateIndex) {
                                continue;
                            }
                            
                            // Only process buffers stored in the GLB (no URI)
                            if (gltf.buffers[i] && !gltf.buffers[i].uri) {
                                const bufLen = gltf.buffers[i].byteLength;
                                const paddedLen = Math.ceil(bufLen / 4) * 4;
                                
                                // Make sure this buffer is within the binary chunk
                                if (binaryChunkOffset + 8 + currentOffset + bufLen <= dataView.byteLength) {
                                    // Extract this buffer's data - use exact length, not padded
                                    const bufData = glbArrayBuffer.slice(
                                        binaryChunkOffset + 8 + currentOffset,
                                        binaryChunkOffset + 8 + currentOffset + bufLen
                                    );
                                    
                                    // Store the buffer data and its index
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
            
            // Calculate the total size of all binary data
            let totalBinarySize = 0;
            
            // Add size of existing buffers (with padding for alignment)
            for (const buf of existingBuffers) {
                totalBinarySize += Math.ceil(buf.data.byteLength / 4) * 4;
            }
            
            // Add size of the new buffer (with padding for alignment)
            totalBinarySize += bufferLength;
            
            // Calculate new total size for the GLB
            const newTotalSize = 
                12 +                     // GLB header (12 bytes)
                8 + paddedJsonLength +   // JSON chunk header (8 bytes) + padded JSON
                8 + totalBinarySize;     // Binary chunk header (8 bytes) + binary data
            
            console.log(`New GLB total size: ${newTotalSize} bytes`);
            console.log(`New binary chunk size: ${totalBinarySize} bytes`);
            
            // Create the new GLB buffer
            const newGlb = new ArrayBuffer(newTotalSize);
            const newDataView = new DataView(newGlb);
            const newUint8Array = new Uint8Array(newGlb);
            
            // Write GLB header
            newDataView.setUint32(0, 0x46546C67, true); // 'glTF' magic
            newDataView.setUint32(4, 2, true); // Version
            newDataView.setUint32(8, newTotalSize, true); // Total length
            
            // Write JSON chunk header
            newDataView.setUint32(12, paddedJsonLength, true); // JSON chunk length
            newDataView.setUint32(16, 0x4E4F534A, true); // 'JSON'
            
            // Write JSON data
            newUint8Array.set(newJsonBytes, 20);
            
            // Add padding after JSON if needed
            for (let i = 0; i < jsonPadding; i++) {
                newUint8Array[20 + newJsonBytes.length + i] = 0x20; // Space character for padding
            }
            
            // Calculate binary chunk offset
            const newBinaryChunkOffset = 20 + paddedJsonLength;
            
            // Write binary chunk header
            newDataView.setUint32(newBinaryChunkOffset, totalBinarySize, true); // Binary chunk length
            newDataView.setUint32(newBinaryChunkOffset + 4, 0x004E4942, true); // 'BIN'
            
            // Write binary data
            let currentBinaryOffset = newBinaryChunkOffset + 8;
            
            // First, write all existing buffers
            for (let i = 0; i < existingBuffers.length; i++) {
                const buf = existingBuffers[i];
                const bufArray = new Uint8Array(buf.data);
                const paddedLength = Math.ceil(buf.data.byteLength / 4) * 4;
                
                // Write buffer data
                newUint8Array.set(bufArray, currentBinaryOffset);
                
                // Add padding if needed
                const padding = paddedLength - buf.data.byteLength;
                for (let j = 0; j < padding; j++) {
                    newUint8Array[currentBinaryOffset + buf.data.byteLength + j] = 0;
                }
                
                currentBinaryOffset += paddedLength;
            }
            
            // Now write the new buffer
            if (binaryData && binaryData.byteLength > 0) {
                const binaryArray = new Uint8Array(binaryData);
                
                // Write buffer data
                newUint8Array.set(binaryArray, currentBinaryOffset);
                
                // Add padding if needed
                const padding = bufferLength - binaryData.byteLength;
                for (let i = 0; i < padding; i++) {
                    // Use explicit null bytes (0) for padding
                    newUint8Array[currentBinaryOffset + binaryData.byteLength + i] = 0;
                }
            }
            
            console.log('Successfully created new GLB with updated binary data');
            resolve(newGlb);
        } catch (error) {
            console.error('Error in associateBinaryBufferWithMesh:', error);
            reject(new Error(`Error associating binary buffer: ${error.message}`));
        }
    });
}

/**
 * Update only the JSON part of a GLB file, keeping the binary chunk intact
 * @param {ArrayBuffer} glbArrayBuffer - The original GLB file
 * @param {Uint8Array} newJsonBytes - The new JSON data as bytes
 * @returns {ArrayBuffer} The updated GLB file
 */
function updateGlbJsonOnly(glbArrayBuffer, newJsonBytes) {
    // Parse the GLB to access the JSON content
    const dataView = new DataView(glbArrayBuffer);
    
    // Get chunk 0 (JSON) length
    const oldJsonChunkLength = dataView.getUint32(12, true);
    
    // Extract the JSON chunk start and end
    const jsonStart = 20;
    const jsonEnd = jsonStart + oldJsonChunkLength;
    
    // Check for binary chunk
    const binaryChunkOffset = jsonEnd;
    let binaryChunkLength = 0;
    let binaryChunkData = null;
    
    // Check if there's a binary chunk
    if (binaryChunkOffset + 8 <= dataView.byteLength) {
        const binaryChunkHeaderLength = dataView.getUint32(binaryChunkOffset, true);
        const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
        
        if (binaryChunkType === 0x004E4942) { // 'BIN' in ASCII
            binaryChunkLength = binaryChunkHeaderLength;
            
            // Copy the binary chunk data including header
            binaryChunkData = glbArrayBuffer.slice(
                binaryChunkOffset, 
                binaryChunkOffset + 8 + binaryChunkLength
            );
        }
    }
    
    // Calculate padded JSON length (must be multiple of 4)
    const paddedJsonLength = Math.ceil(newJsonBytes.length / 4) * 4;
    const jsonPadding = paddedJsonLength - newJsonBytes.length;
    
    // Calculate new total size
    const newTotalSize = 
        12 +                  // GLB header (12 bytes)
        8 + paddedJsonLength; // JSON chunk header (8 bytes) + padded JSON
    
    // Add binary chunk size if present
    const hasBinaryChunk = binaryChunkData !== null;
    const finalSize = hasBinaryChunk ? newTotalSize + (binaryChunkData.byteLength) : newTotalSize;
    
    // Create the new GLB buffer
    const newGlb = new ArrayBuffer(finalSize);
    const newDataView = new DataView(newGlb);
    const newUint8Array = new Uint8Array(newGlb);
    
    // Write GLB header
    newDataView.setUint32(0, 0x46546C67, true); // 'glTF' magic
    newDataView.setUint32(4, 2, true); // Version
    newDataView.setUint32(8, finalSize, true); // Total length
    
    // Write JSON chunk header
    newDataView.setUint32(12, paddedJsonLength, true); // JSON chunk length
    newDataView.setUint32(16, 0x4E4F534A, true); // 'JSON'
    
    // Write JSON data
    newUint8Array.set(newJsonBytes, 20);
    
    // Add padding after JSON if needed
    for (let i = 0; i < jsonPadding; i++) {
        newUint8Array[20 + newJsonBytes.length + i] = 0x20; // Space character for padding
    }
    
    // Add binary chunk if it exists
    if (hasBinaryChunk) {
        const newBinaryOffset = 20 + paddedJsonLength;
        const binaryArray = new Uint8Array(binaryChunkData);
        newUint8Array.set(binaryArray, newBinaryOffset);
    }
    
    return newGlb;
}

/**
 * Get binary buffer associated with a mesh index
 * @param {ArrayBuffer} glbArrayBuffer - The GLB file as an ArrayBuffer
 * @param {number} meshIndex - The index of the mesh to get data for
 * @returns {Promise<ArrayBuffer|null>} A promise that resolves with the binary data or null if not found
 */
export function getBinaryBufferForMesh(glbArrayBuffer, meshIndex) {
    return new Promise((resolve, reject) => {
        try {
            // Parse the GLB to access the JSON content
            const dataView = new DataView(glbArrayBuffer);
            
            // GLB header validation
            if (dataView.byteLength < 12) {
                reject(new Error('Invalid GLB: File too small'));
                return;
            }
            
            // Check GLB magic
            const magic = dataView.getUint32(0, true);
            const expectedMagic = 0x46546C67; // 'glTF' in ASCII
            if (magic !== expectedMagic) {
                reject(new Error('Invalid GLB: Incorrect magic bytes'));
                return;
            }
            
            // Get GLB version
            const version = dataView.getUint32(4, true);
            if (version !== 2) {
                reject(new Error(`Unsupported GLB version: ${version}`));
                return;
            }
            
            // Get chunk 0 (JSON) length
            const jsonChunkLength = dataView.getUint32(12, true);
            const jsonChunkType = dataView.getUint32(16, true);
            
            if (jsonChunkType !== 0x4E4F534A) { // 'JSON' in ASCII
                reject(new Error('Invalid GLB: First chunk is not JSON'));
                return;
            }
            
            // Extract the JSON chunk
            const jsonStart = 20;
            const jsonEnd = jsonStart + jsonChunkLength;
            const jsonData = glbArrayBuffer.slice(jsonStart, jsonEnd);
            const decoder = new TextDecoder('utf-8');
            const jsonString = decoder.decode(jsonData);
            const gltf = JSON.parse(jsonString);
            
            // Check if our extension exists
            if (!gltf.extensions || !gltf.extensions[MESH_BINARY_EXTENSION]) {
                console.log(`No binary extension found for mesh ${meshIndex}`);
                resolve(null); // No extension found
                return;
            }
            
            // Find the association for this mesh index
            const associations = gltf.extensions[MESH_BINARY_EXTENSION].meshBinaryAssociations;
            if (!associations || !Array.isArray(associations)) {
                console.log(`No binary associations found for mesh ${meshIndex}`);
                resolve(null);
                return;
            }
            
            const association = associations.find(assoc => assoc[MESH_INDEX_PROPERTY] === meshIndex);
            
            if (!association) {
                console.log(`No binary association found for mesh ${meshIndex}`);
                resolve(null); // No association found for this mesh
                return;
            }
            
            // Get the buffer index
            const bufferIndex = association[BINARY_DATA_PROPERTY];
            
            // Access the buffer data
            if (!gltf.buffers || !gltf.buffers[bufferIndex]) {
                console.log(`Buffer ${bufferIndex} not found for mesh ${meshIndex}`);
                resolve(null); // Buffer not found
                return;
            }
            
            const buffer = gltf.buffers[bufferIndex];
            console.log(`Found buffer ${bufferIndex} for mesh ${meshIndex} with length ${buffer.byteLength}`);
            
            // Handle buffer data
            if (buffer.uri) {
                // URI-based buffer
                if (buffer.uri.startsWith('data:')) {
                    // Data URI
                    const base64Data = buffer.uri.split(',')[1];
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    resolve(bytes.buffer);
                } else {
                    // External URI - not supported in this context
                    reject(new Error('External URI buffers not supported'));
                }
            } else {
                // GLB-contained buffer (BIN chunk)
                const binaryChunkOffset = jsonStart + jsonChunkLength;
                
                // Ensure there is a binary chunk
                if (dataView.byteLength <= binaryChunkOffset + 8) {
                    console.log(`No binary chunk found at offset ${binaryChunkOffset}`);
                    resolve(null); // No binary chunk
                    return;
                }
                
                // Get binary chunk details
                const binaryChunkLength = dataView.getUint32(binaryChunkOffset, true);
                const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
                
                if (binaryChunkType !== 0x004E4942) { // 'BIN' in ASCII
                    reject(new Error('Invalid GLB: Second chunk is not BIN'));
                    return;
                }
                
                // Find the correct offset for this buffer within the binary chunk
                let currentOffset = 0;
                let foundBuffer = false;
                
                // Calculate offset by summing up sizes of previous buffers
                for (let i = 0; i < gltf.buffers.length; i++) {
                    if (i === bufferIndex) {
                        foundBuffer = true;
                        break;
                    }
                    
                    // Only count buffers that are stored in the GLB (no URI)
                    if (!gltf.buffers[i].uri) {
                        // Add the length of this buffer (padded to 4-byte boundary)
                        const bufferLength = gltf.buffers[i].byteLength;
                        const paddedLength = Math.ceil(bufferLength / 4) * 4;
                        currentOffset += paddedLength;
                    }
                }
                
                if (!foundBuffer) {
                    console.warn(`Buffer index ${bufferIndex} exceeds buffer count`);
                    resolve(null);
                    return;
                }
                
                // Extract just this buffer's data
                const bufferStartOffset = binaryChunkOffset + 8 + currentOffset;
                const bufferEndOffset = bufferStartOffset + buffer.byteLength;
                
                // Validate buffer boundaries
                if (bufferEndOffset > dataView.byteLength) {
                    console.warn(`Buffer extends beyond GLB file (${bufferEndOffset} > ${dataView.byteLength})`);
                    resolve(null);
                    return;
                }
                
                console.log(`Extracting buffer at offset ${currentOffset} (${bufferStartOffset}-${bufferEndOffset})`);
                const bufferData = glbArrayBuffer.slice(bufferStartOffset, bufferEndOffset);
                
                resolve(bufferData);
            }
        } catch (error) {
            console.error('Error retrieving binary buffer:', error);
            reject(new Error(`Error retrieving binary buffer: ${error.message}`));
        }
    });
}

/**
 * Check if a binary buffer appears to be a GLB structure
 * @param {ArrayBuffer} buffer - The buffer to check
 * @returns {boolean} True if the buffer appears to be a GLB structure
 */
export function isGlbStructure(buffer) {
    if (!buffer || buffer.byteLength < 12) {
        return false;
    }
    
    try {
        const dataView = new DataView(buffer);
        // Check for GLB magic bytes (glTF in ASCII)
        const magic = dataView.getUint32(0, true);
        return magic === 0x46546C67; // 'glTF' in ASCII
    } catch (e) {
        return false;
    }
}

/**
 * Display a custom texture on a mesh
 * @param {boolean} display - Whether to display the custom texture
 * @param {number} meshId - ID of the mesh to display the texture on
 */
export function displayCustomTexture(display, meshId) {
    console.debug("BAZIGNA IT WORKED BITCHES", display, meshId);
} 

export function setPreviewAnimationFrame(incomingValue) {
    previewAnimationFrame = incomingValue;
}

export function setPreviewScene(incomingValue) {
    previewScene = incomingValue;
}

export function setPreviewCamera(incomingValue) {
    previewCamera = incomingValue;
}

export function setPreviewControls(incomingValue) {
    previewControls = incomingValue;
}

export function setPreviewRenderer(incomingValue) {
    previewRenderer = incomingValue;
}