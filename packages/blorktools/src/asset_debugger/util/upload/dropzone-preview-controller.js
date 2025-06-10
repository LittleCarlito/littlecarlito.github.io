/**
 * Model Preview - Handles GLB preview in the model dropzone
 * 
 * This module provides functionality to:
 * 1. Create a mini Three.js scene for GLB preview
 * 2. Add orbit controls for interactive preview
 * 3. Load and display GLB models in the dropzone
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Keep track of the preview resources for cleanup
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewControls = null;
let previewAnimationFrame = null;

/**
 * Creates a preview of a GLB model file in the model dropzone
 * @param {File} modelFile - The GLB file to preview
 */
export function createModelPreview(modelFile) {
    if (!modelFile) return;
    
    // Get the preview container
    const previewContainer = document.getElementById('model-preview');
    if (!previewContainer) return;
    
    // Clean up any existing preview
    cleanupPreview();
    
    // Create the preview elements
    previewContainer.innerHTML = '';
    previewContainer.style.position = 'relative';
    
    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'preview-loading';
    loadingIndicator.innerHTML = `
        <div class="preview-loading-spinner"></div>
        <div class="preview-loading-text">Loading model...</div>
    `;
    previewContainer.appendChild(loadingIndicator);
    
    // Create renderer
    previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setPixelRatio(window.devicePixelRatio);
    previewRenderer.setClearColor(0x000000, 0);
    previewRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
    previewRenderer.outputEncoding = THREE.sRGBEncoding;
    previewContainer.appendChild(previewRenderer.domElement);
    
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
        45, previewContainer.clientWidth / previewContainer.clientHeight, 0.1, 100
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
    const modelUrl = URL.createObjectURL(modelFile);
    
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
            const aspectRatio = previewContainer.clientWidth / previewContainer.clientHeight;
            
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
            let bufferMultiplier = 1.6; // Base buffer multiplier
            
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
            
            // Animation loop
            const animate = () => {
                previewAnimationFrame = requestAnimationFrame(animate);
                previewControls.update();
                previewRenderer.render(previewScene, previewCamera);
            };
            animate();
            
            // Add clear button
            addClearButton(previewContainer, modelFile);
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
            errorMsg.className = 'no-image-message-container visible';
            errorMsg.textContent = 'Error loading model. Please try another file.';
            previewContainer.appendChild(errorMsg);
        }
    );
    
    // Clean up object URL when done
    return () => {
        URL.revokeObjectURL(modelUrl);
        cleanupPreview();
    };
}

/**
 * Adds a clear button to the preview
 * @param {HTMLElement} container - The preview container
 * @param {File} file - The model file
 */
function addClearButton(container, file) {
    // Find the parent dropzone element
    const dropzone = document.getElementById('model-dropzone');
    
    if (dropzone) {
        // Create clear button
        const clearButton = document.createElement('button');
        clearButton.className = 'clear-preview-button';
        clearButton.innerHTML = '×';
        clearButton.title = 'Clear preview';
        
        // Add to the dropzone instead of the preview container to match other previews
        dropzone.appendChild(clearButton);
        
        // Add click event
        clearButton.addEventListener('click', (event) => {
            event.stopPropagation();
            
            // Clean up preview
            cleanupPreview();
            
            // Store the original title before clearing
            const originalTitle = dropzone.querySelector('h3')?.textContent || '3D Model';
            
            // Clean up the dropzone
            if (dropzone) {
                dropzone.classList.remove('has-file');
                
                // Clear the dropzone content
                dropzone.innerHTML = '';
                
                // Import the file handler module to properly restore the dropzone
                import('./file-upload-manager.js').then(module => {
                    // Use the clearDropzone function to restore the original content
                    if (module.clearDropzone) {
                        module.clearDropzone(dropzone, 'model', originalTitle);
                    } else {
                        // Fallback if clearDropzone isn't directly accessible
                        
                        // Recreate basic content
                        const titleElement = document.createElement('h3');
                        titleElement.textContent = originalTitle;
                        dropzone.appendChild(titleElement);
                        
                        // Add instruction text
                        const instructionText = document.createElement('p');
                        instructionText.textContent = 'Drag & drop a GLB model file here';
                        dropzone.appendChild(instructionText);
                        
                        // Add optional text
                        const optionalText = document.createElement('p');
                        optionalText.textContent = 'If not provided, a cube will be used';
                        dropzone.appendChild(optionalText);
                        
                        // Add file info element
                        const infoElement = document.createElement('p');
                        infoElement.className = 'file-info';
                        infoElement.id = 'model-info';
                        dropzone.appendChild(infoElement);
                        
                        // Re-setup the dropzone
                        if (module.setupDropzone) {
                            module.setupDropzone(dropzone, 'model', infoElement);
                        }
                    }
                });
                
                // Reset state model file
                import('../state/scene-state.js').then(stateModule => {
                    const state = stateModule.getState();
                    state.modelFile = null;
                    state.useCustomModel = false;
                });
                
                // Clear preview container
                container.innerHTML = '';
            }
        });
    }
}

/**
 * Cleans up all preview resources
 */
export function cleanupPreview() {
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
    
    // Clear references
    previewScene = null;
    previewCamera = null;
}

/**
 * Handles window resize for the preview
 */
export function handlePreviewResize() {
    const previewContainer = document.getElementById('model-preview');
    if (!previewContainer || !previewRenderer || !previewCamera) return;
    
    // Update camera aspect ratio
    previewCamera.aspect = previewContainer.clientWidth / previewContainer.clientHeight;
    previewCamera.updateProjectionMatrix();
    
    // Update renderer size
    previewRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
}

// Add window resize listener
window.addEventListener('resize', handlePreviewResize); 