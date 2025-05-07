/**
 * GLB Utility Module
 * 
 * Handles GLB model loading, processing, and preview rendering.
 * Adds functionality for associating binary buffers with mesh indices in GLB extensions.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { processModelFile } from './worker-manager.js';

// Constants for extension identification
const MESH_BINARY_EXTENSION = 'BLORK_mesh_binary_data';
const MESH_INDEX_PROPERTY = 'meshIndex';
const BINARY_DATA_PROPERTY = 'binaryData';

// Keep track of preview resources for cleanup
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewControls = null;
let previewAnimationFrame = null;

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
 * Clean up the preview resources
 */
function cleanupPreview() {
    if (previewAnimationFrame) {
        cancelAnimationFrame(previewAnimationFrame);
        previewAnimationFrame = null;
    }
    
    if (previewControls) {
        previewControls.dispose();
        previewControls = null;
    }
    
    if (previewRenderer) {
        previewRenderer.dispose();
        previewRenderer = null;
    }
    
    previewScene = null;
    previewCamera = null;
}

/**
 * Create a 3D preview of a GLB model
 * @param {File} file - The GLB file to preview
 * @param {HTMLElement} container - The container element to render the preview in
 * @returns {Promise} A promise that resolves with the scene and renderer when preview is created
 */
export function createGLBPreview(file, container) {
    return new Promise((resolve, reject) => {
        if (!file || !container) {
            reject(new Error('Missing required parameters for GLB preview'));
            return;
        }
        
        // Clean up any existing preview
        cleanupPreview();
        
        // Create the preview elements
        container.innerHTML = '';
        container.style.position = 'relative';
        
        // Create loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'preview-loading';
        loadingIndicator.innerHTML = `
            <div class="preview-loading-spinner"></div>
            <div class="preview-loading-text">Loading model...</div>
        `;
        container.appendChild(loadingIndicator);
        
        // Create renderer
        previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        previewRenderer.setPixelRatio(window.devicePixelRatio);
        previewRenderer.setClearColor(0x000000, 0);
        previewRenderer.setSize(container.clientWidth, container.clientHeight);
        previewRenderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(previewRenderer.domElement);
        
        // Create scene
        previewScene = new THREE.Scene();
        previewScene.background = new THREE.Color(0x111111);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        previewScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 2, 3);
        previewScene.add(directionalLight);
        
        // Create camera
        previewCamera = new THREE.PerspectiveCamera(
            45, container.clientWidth / container.clientHeight, 0.1, 100
        );
        previewCamera.position.set(0, 0, 2);
        
        // Create controls
        previewControls = new OrbitControls(previewCamera, previewRenderer.domElement);
        previewControls.enableDamping = true;
        previewControls.dampingFactor = 0.1;
        previewControls.rotateSpeed = 0.8;
        previewControls.enableZoom = true;
        previewControls.zoomSpeed = 0.5;
        previewControls.enablePan = false;
        
        // Create a URL for the model file
        const modelUrl = URL.createObjectURL(file);
        
        // Load the model
        const loader = new GLTFLoader();
        loader.load(
            modelUrl,
            (gltf) => {
                // Remove loading indicator
                loadingIndicator.remove();
                
                // Add the model to the scene
                const model = gltf.scene;
                
                // Calculate bounding box to properly scale and center the model
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                // Reset position to center
                model.position.x = -center.x;
                model.position.y = -center.y;
                model.position.z = -center.z;
                
                // Scale to fit
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 0) {
                    const scale = 1.5 / maxDim; // Scale to fit within a 1.5 unit sphere
                    model.scale.multiplyScalar(scale);
                    
                    // Update bounding box after scaling
                    box.setFromObject(model);
                    box.getSize(size);
                    box.getCenter(center);
                }
                
                // Create center group to help with positioning
                const modelGroup = new THREE.Group();
                modelGroup.add(model);
                
                // Position the model on the grid properly
                // Find the lowest point of the model after centering
                const minY = box.min.y;
                
                // If the model's minY isn't at the grid level, adjust it
                if (minY !== 0) {
                    // Move the model so its bottom is just above the grid
                    model.position.y -= minY - 0.01; // Slight offset to avoid z-fighting
                }
                
                // Update the bounding box after repositioning
                box.setFromObject(model);
                box.getSize(size);
                box.getCenter(center);
                
                // Add to scene
                previewScene.add(modelGroup);
                
                // Add a grid helper
                const gridSize = Math.max(2, Math.ceil(Math.max(size.x, size.z) * 1.5));
                const gridHelper = new THREE.GridHelper(gridSize, gridSize * 2, 0x888888, 0x444444);
                // Position grid at y=0 (standard ground plane)
                gridHelper.position.y = 0;
                previewScene.add(gridHelper);
                
                // Calculate optimal camera position to ensure the model is fully visible
                const fov = previewCamera.fov * (Math.PI / 180); // convert to radians
                const aspectRatio = container.clientWidth / container.clientHeight;
                
                // Get model dimensions after scaling
                const scaledSizeX = size.x;
                const scaledSizeY = size.y;
                const scaledSizeZ = size.z;
                
                // Calculate the center point of the model for camera targeting
                // This should be the geometric center, not just (0,0,0)
                const modelCenter = new THREE.Vector3(0, box.getCenter(new THREE.Vector3()).y, 0);
                
                // Calculate required distance for each dimension
                // For Z dimension, we need to consider the model's depth and our angle of view
                const distanceForHeight = scaledSizeY / (2 * Math.tan(fov / 2));
                const distanceForWidth = scaledSizeX / (2 * Math.tan(fov / 2) * aspectRatio);
                const distanceForDepth = scaledSizeZ * 1.2; // Add more space for depth
                
                // Base distance calculation
                let optimalDistance = Math.max(distanceForWidth, distanceForHeight, distanceForDepth);
                
                // Detect extreme model shapes and adjust accordingly
                const aspectRatioXY = scaledSizeX / scaledSizeY;
                const aspectRatioXZ = scaledSizeX / scaledSizeZ;
                const aspectRatioYZ = scaledSizeY / scaledSizeZ;
                
                // Add extra buffer for camera distance
                let bufferMultiplier = 1.6;
                
                // Add more buffer for flat/wide models (high aspect ratios)
                if (aspectRatioXY > 4 || aspectRatioXY < 0.25 || 
                    aspectRatioXZ > 4 || aspectRatioXZ < 0.25 || 
                    aspectRatioYZ > 4 || aspectRatioYZ < 0.25) {
                    bufferMultiplier = 2.0; // More space for extreme shapes
                    console.log('Extreme model shape detected - using larger buffer');
                }
                
                // Apply buffer to optimal distance
                optimalDistance *= bufferMultiplier;
                
                // Set minimum distance
                const finalDistance = Math.max(optimalDistance, 2.5);
                
                // Calculate X and Y offsets for perspective view
                const xOffset = finalDistance * 0.4;
                let yOffset = finalDistance * 0.3;
                
                // Auto orient the model for better visibility for flat models
                if (scaledSizeZ < scaledSizeX * 0.25 && scaledSizeZ < scaledSizeY * 0.25) {
                    // Model is very flat - orient it to face the camera better
                    modelGroup.rotation.x = -Math.PI / 12; // Slight tilt
                    
                    // Adjust model position to remain on grid after tilting
                    const elevationOffset = scaledSizeX * Math.sin(Math.PI / 12) / 2;
                    model.position.y += elevationOffset;
                }
                
                // Calculate optimal camera target (vertical center of the model)
                // This ensures the camera is looking at the middle of the model, not the bottom
                const targetY = modelCenter.y;
                
                // Special handling for very tall models
                if (scaledSizeY > scaledSizeX * 3 && scaledSizeY > scaledSizeZ * 3) {
                    // For very tall models, position camera higher to see from middle
                    yOffset = Math.min(targetY + finalDistance * 0.2, finalDistance * 0.7);
                } else if (scaledSizeY < 0.5) {
                    // For very flat horizontal models, don't position camera too low
                    yOffset = Math.max(targetY * 2, finalDistance * 0.2);
                } else {
                    // For normal models, position camera to see the entire height
                    // We need to raise the camera enough to see the top of the model
                    yOffset = Math.max(targetY, finalDistance * 0.2);
                }
                
                // Final camera positioning - position relative to the model's center point
                previewCamera.position.set(
                    xOffset,
                    yOffset,
                    finalDistance
                );
                
                // Ensure controls target is at the center of the model (y-center, not ground level)
                previewControls.target.set(0, targetY, 0);
                previewControls.update();
                
                // Animation loop - only updates controls, no auto-rotation
                const animate = () => {
                    previewAnimationFrame = requestAnimationFrame(animate);
                    previewControls.update();
                    previewRenderer.render(previewScene, previewCamera);
                };
                animate();
                
                // Handle window resize
                const handleResize = () => {
                    if (!container) return;
                    
                    const width = container.clientWidth;
                    const height = container.clientHeight;
                    
                    previewCamera.aspect = width / height;
                    previewCamera.updateProjectionMatrix();
                    
                    previewRenderer.setSize(width, height);
                };
                
                window.addEventListener('resize', handleResize);
                
                // Clean up object URL and event listener when done
                const cleanup = () => {
                    URL.revokeObjectURL(modelUrl);
                    window.removeEventListener('resize', handleResize);
                    cleanupPreview();
                };
                
                // Resolve with the scene, model, and cleanup function
                resolve({ 
                    scene: previewScene, 
                    camera: previewCamera, 
                    renderer: previewRenderer,
                    controls: previewControls, 
                    model: model, 
                    gltf: gltf,
                    cleanup: cleanup 
                });
            },
            (xhr) => {
                // Update loading progress
                const percent = Math.floor((xhr.loaded / xhr.total) * 100);
                loadingIndicator.querySelector('.preview-loading-text').textContent = 
                    `Loading model... ${percent}%`;
            },
            (error) => {
                console.error('Error loading model:', error);
                loadingIndicator.remove();
                
                // Show error message
                const errorMsg = document.createElement('div');
                errorMsg.className = 'no-image-message visible';
                errorMsg.textContent = 'Error loading model. Please try another file.';
                container.appendChild(errorMsg);
                
                // Reject the promise with the error
                reject(error);
            }
        );
    });
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
                
                // We don't need to keep the buffer, but we could mark it as unused
                // For simplicity, we'll just leave the buffer data in the file
                // A more advanced implementation could remove the buffer and update all references
                
                // Create a new JSON string with the updated extensions
                const newJsonString = JSON.stringify(gltf);
                const newJsonBytes = new TextEncoder().encode(newJsonString);
                
                // Create a new GLB with the updated JSON but keeping the binary chunk
                const updatedGlb = updateGlbJsonOnly(glbArrayBuffer, newJsonBytes);
                resolve(updatedGlb);
                return;
            }
            
            // If not a removal operation, continue with normal association
            // Determine the binary buffer index
            let binaryBufferIndex;
            if (existingAssociation) {
                // Replace existing association
                binaryBufferIndex = existingAssociation[BINARY_DATA_PROPERTY];
                
                // Update buffer if it exists
                if (gltf.buffers && gltf.buffers[binaryBufferIndex]) {
                    const bufferLength = Math.ceil(binaryData.byteLength / 4) * 4;
                    gltf.buffers[binaryBufferIndex].byteLength = bufferLength;
                    
                    // Important: Remove any existing URI if we're updating
                    delete gltf.buffers[binaryBufferIndex].uri;
                }
            } else {
                // Create a new buffer for the binary data
                if (!gltf.buffers) {
                    gltf.buffers = [];
                }
                
                // Calculate buffer length with padding to 4 bytes alignment
                const bufferLength = Math.ceil(binaryData.byteLength / 4) * 4;
                
                // Create new buffer reference
                binaryBufferIndex = gltf.buffers.length;
                gltf.buffers.push({
                    byteLength: bufferLength
                    // Don't add URI - we'll include in BIN chunk
                });
                
                // Add the new association
                associations.push({
                    [MESH_INDEX_PROPERTY]: meshIndex,
                    [BINARY_DATA_PROPERTY]: binaryBufferIndex
                });
            }
            
            // Create a new JSON string with the extensions
            const newJsonString = JSON.stringify(gltf);
            const newJsonBytes = new TextEncoder().encode(newJsonString);
            
            // Calculate padded JSON length (must be multiple of 4)
            const paddedJsonLength = Math.ceil(newJsonBytes.length / 4) * 4;
            const jsonPadding = paddedJsonLength - newJsonBytes.length;
            
            // Check for binary chunk in the original GLB
            const binaryChunkOffset = jsonEnd;
            let hasOriginalBinaryChunk = false;
            let binaryChunkLength = 0;
            let binaryChunkData = null;
            
            if (binaryChunkOffset + 8 <= dataView.byteLength) {
                // Try to read binary chunk header
                try {
                    const binaryChunkHeaderLength = dataView.getUint32(binaryChunkOffset, true);
                    const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
                    
                    if (binaryChunkType === 0x004E4942) { // 'BIN' in ASCII
                        hasOriginalBinaryChunk = true;
                        binaryChunkLength = binaryChunkHeaderLength;
                        
                        console.log(`Original binary chunk found: ${binaryChunkLength} bytes`);
                        
                        // Validate binary chunk boundaries
                        if (binaryChunkOffset + 8 + binaryChunkLength <= dataView.byteLength) {
                            // Copy the original binary chunk data
                            binaryChunkData = glbArrayBuffer.slice(
                                binaryChunkOffset + 8, 
                                binaryChunkOffset + 8 + binaryChunkLength
                            );
                        } else {
                            console.warn('Binary chunk length exceeds file size, ignoring');
                            hasOriginalBinaryChunk = false;
                            binaryChunkLength = 0;
                        }
                    }
                } catch (e) {
                    console.warn('Error reading binary chunk, treating as not present:', e);
                    hasOriginalBinaryChunk = false;
                }
            }
            
            // Create binary chunk for the new file
            // We need to include our new binary data plus any existing binary data
            // Ensure binary data is aligned to 4 bytes
            const paddedBinaryDataLength = Math.ceil(binaryData.byteLength / 4) * 4;
            const binaryDataPadding = paddedBinaryDataLength - binaryData.byteLength;
            
            let newBinaryChunkLength = 0;
            
            if (hasOriginalBinaryChunk) {
                // Include existing binary data plus our new data
                newBinaryChunkLength = binaryChunkLength + paddedBinaryDataLength;
            } else {
                // Only our new data
                newBinaryChunkLength = paddedBinaryDataLength;
            }
            
            console.log(`New binary chunk size: ${newBinaryChunkLength} bytes`);
            
            // Calculate new total size
            const newTotalSize = 
                12 +                     // GLB header (12 bytes)
                8 + paddedJsonLength +   // JSON chunk header (8 bytes) + padded JSON
                8 + newBinaryChunkLength; // Binary chunk header (8 bytes) + binary data
            
            console.log(`New GLB total size: ${newTotalSize} bytes`);
            
            // Create the new GLB buffer
            const newGlb = new ArrayBuffer(newTotalSize);
            const newDataView = new DataView(newGlb);
            const newUint8Array = new Uint8Array(newGlb);
            
            // Write GLB header
            newDataView.setUint32(0, expectedMagic, true); // GLB magic
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
            newDataView.setUint32(newBinaryChunkOffset, newBinaryChunkLength, true); // Binary chunk length
            newDataView.setUint32(newBinaryChunkOffset + 4, 0x004E4942, true); // 'BIN'
            
            // Copy existing binary data if available
            let binaryDataOffset = newBinaryChunkOffset + 8;
            
            if (hasOriginalBinaryChunk && binaryChunkData) {
                try {
                    // Use the previously extracted binary chunk data
                    const originalBinaryArray = new Uint8Array(binaryChunkData);
                    newUint8Array.set(originalBinaryArray, binaryDataOffset);
                    binaryDataOffset += binaryChunkLength;
                } catch (e) {
                    console.error('Error copying original binary data:', e);
                    // Continue without the original binary data
                }
            }
            
            // Add our new binary data
            try {
                const binaryArray = new Uint8Array(binaryData);
                newUint8Array.set(binaryArray, binaryDataOffset);
                
                // Add padding to the binary data if needed
                for (let i = 0; i < binaryDataPadding; i++) {
                    newUint8Array[binaryDataOffset + binaryData.byteLength + i] = 0;
                }
            } catch (e) {
                console.error('Error adding binary data:', e);
                reject(new Error(`Error adding binary data: ${e.message}`));
                return;
            }
            
            console.log('Successfully created new GLB with added binary data');
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
            
            // GLB header validation (same as above)
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
                resolve(null); // No extension found
                return;
            }
            
            // Find the association for this mesh index
            const associations = gltf.extensions[MESH_BINARY_EXTENSION].meshBinaryAssociations;
            const association = associations.find(assoc => assoc[MESH_INDEX_PROPERTY] === meshIndex);
            
            if (!association) {
                resolve(null); // No association found for this mesh
                return;
            }
            
            // Get the buffer index
            const bufferIndex = association[BINARY_DATA_PROPERTY];
            
            // Access the buffer data
            if (!gltf.buffers || !gltf.buffers[bufferIndex]) {
                resolve(null); // Buffer not found
                return;
            }
            
            const buffer = gltf.buffers[bufferIndex];
            
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
                
                // We need to locate the specific buffer data within the binary chunk
                // The buffer data is stored sequentially in the binary chunk
                
                // Calculate the offset of this buffer within the binary chunk
                let currentOffset = 0;
                for (let i = 0; i < bufferIndex; i++) {
                    if (gltf.buffers[i] && !gltf.buffers[i].uri) {
                        // Add the length of each preceding buffer, padded to 4-byte boundary
                        const bufferLength = gltf.buffers[i].byteLength;
                        currentOffset += Math.ceil(bufferLength / 4) * 4;
                    }
                }
                
                // Get the length of this buffer
                const bufferLength = buffer.byteLength;
                
                // Extract just this buffer's data from the binary chunk
                const bufferStartOffset = binaryChunkOffset + 8 + currentOffset;
                const bufferData = glbArrayBuffer.slice(
                    bufferStartOffset,
                    bufferStartOffset + bufferLength
                );
                
                resolve(bufferData);
            }
        } catch (error) {
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