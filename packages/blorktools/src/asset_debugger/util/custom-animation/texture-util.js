import * as THREE from 'three';
import { getIsPreviewActive, setLastTextureUpdateTime, getLastTextureUpdateTime } from '../../util/custom-animation/animation-util';
import * as modelIntegration from '../../modals/html-editor-modal/model-integration.js';
import { updateMeshTexture } from '../../util/custom-animation/animation-util';
import { createTextureFromIframe } from './html2canvas-util';

// Track active textures and animations
const activeTextureData = new Map();

// Add a variable to track if we're capturing frames for long exposure
export let isCapturingForLongExposure = false;

/**
 * Create a long exposure texture from all animation frames
 * @param {Array} frames - Array of frames with textures
 * @param {number} playbackSpeed - The playback speed affecting opacity
 * @returns {THREE.Texture} A static long exposure texture
 */
export function createLongExposureTexture(frames, playbackSpeed) {
    if (!frames || frames.length === 0) {
        return createEmptyTexture();
    }
    
    try {
        // Create a canvas for the blended result
        const canvas = document.createElement('canvas');
        
        // Use the dimensions of the first frame's texture
        const firstTexture = frames[0].texture;
        if (!firstTexture || !firstTexture.image) {
            return createEmptyTexture();
        }
        
        canvas.width = firstTexture.image.width;
        canvas.height = firstTexture.image.height;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate base opacity based on playback speed
        // Faster playback = fainter traces (lower opacity per frame)
        // Slower playback = more solid impressions (higher opacity per frame)
        // Use a direct inverse relationship between speed and opacity
        // This makes the effect much more noticeable between different speeds
        const baseOpacity = Math.min(0.3, Math.max(0.01, 0.075 / playbackSpeed));
        
        console.log(`Creating long exposure with ${frames.length} frames at base opacity ${baseOpacity.toFixed(4)} (speed: ${playbackSpeed}x)`);
        
        // Draw all frames with calculated opacity
        frames.forEach((frame) => {
            if (!frame.texture || !frame.texture.image) return;
            
            // Set global alpha for this frame
            ctx.globalAlpha = baseOpacity;
            
            // Draw the frame
            ctx.drawImage(frame.texture.image, 0, 0, canvas.width, canvas.height);
        });
        
        // Reset global alpha
        ctx.globalAlpha = 1.0;
        
        // Create texture from the blended canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Apply high quality settings
        texture.anisotropy = 16;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        
        // Reset the capture flag
        isCapturingForLongExposure = false;
        
        // Restore original border setting
        if (window._originalBorderSetting !== undefined) {
            window.showPreviewBorders = window._originalBorderSetting;
            console.log(`Long exposure complete, borders restored to: ${window.showPreviewBorders}`);
            window._originalBorderSetting = undefined;
        }
        
        return texture;
    } catch (error) {
        console.error('Error creating long exposure texture:', error);
        
        // Reset the capture flag
        isCapturingForLongExposure = false;
        
        // Restore original border setting even on error
        if (window._originalBorderSetting !== undefined) {
            window.showPreviewBorders = window._originalBorderSetting;
            window._originalBorderSetting = undefined;
        }
        
        return createEmptyTexture();
    }
}

/**
 * Create a debug texture with error information
 * @param {string} errorMessage - The error message to display
 * @returns {THREE.Texture} A debug texture with error info
 */
function createDebugTexture(errorMessage) {
    console.log('[DEBUG_TEXTURE] Creating debug texture with message:', errorMessage);
    
    // Create a canvas element with 16:9 aspect ratio
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    
    // Draw a more attention-grabbing background with error pattern
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#ff6b6b');  // Reddish start
    gradient.addColorStop(1, '#f5f5f5');  // Light gray end
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw diagonal error stripes
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    for (let i = -canvas.height * 2; i < canvas.width * 2; i += 40) {
        ctx.fillRect(i, 0, 20, canvas.height);
    }
    ctx.restore();
    
    // Add border for visibility
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Draw a message about the error
    ctx.fillStyle = '#333';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('HTML Texture Debug', 20, 50);
    
    // Add version info
    ctx.font = '16px sans-serif';
    const versionInfo = `Debug Version: ${new Date().toISOString().split('T')[0]}`;
    ctx.fillText(versionInfo, 20, 80);
    
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Error rendering HTML content:', 20, 120);
    
    // Wrap error message
    const maxWidth = canvas.width - 40;
    let y = 160;
    ctx.font = '18px monospace';
    ctx.fillStyle = '#000';
    
    // Split error message into words
    const words = errorMessage.split(' ');
    let line = '';
    
    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && i > 0) {
            ctx.fillText(line, 20, y);
            line = words[i] + ' ';
            y += 30;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, 20, y);
    
    // Add visual markers to show texture is being rendered
    y += 60;
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Texture Rendering Information:', 20, y);
    
    y += 30;
    ctx.font = '16px sans-serif';
    ctx.fillText(`Canvas size: ${canvas.width}x${canvas.height}`, 20, y);
    
    y += 30;
    ctx.fillText(`Time created: ${new Date().toLocaleTimeString()}`, 20, y);
    
    // Add checkerboard pattern at the bottom to verify texture mapping
    const squareSize = 40;
    const startY = canvas.height - 160;
    let isBlack = false;
    
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < canvas.width / squareSize; col++) {
            ctx.fillStyle = isBlack ? '#000' : '#fff';
            ctx.fillRect(col * squareSize, startY + row * squareSize, squareSize, squareSize);
            isBlack = !isBlack;
        }
        isBlack = !isBlack; // Start the next row with alternating pattern
    }
    
    // Add timestamp
    const timestamp = new Date().toISOString();
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#333';
    ctx.fillText(`Debug ID: ${Math.random().toString(36).substring(2, 10)}`, 20, canvas.height - 20);
    ctx.fillText(`Time: ${timestamp}`, canvas.width - 250, canvas.height - 20);
    
    // Create texture from canvas with high quality settings
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16; // Higher anisotropy for better quality
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    
    console.log('[DEBUG_TEXTURE] Debug texture created successfully');
    return texture;
}

/**
 * Create a fallback texture when iframe content can't be accessed
 * @returns {THREE.Texture} A simple fallback texture
 */
function createEmptyTexture() {    
    // Create a canvas element with 16:9 aspect ratio
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a semi-transparent background for the message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(10, 10, 400, 150);
    
    // Draw a message about preview limitations
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HTML Preview', 20, 40);
    
    ctx.font = '16px sans-serif';
    ctx.fillText('Preview content cannot be displayed.', 20, 80);
    ctx.fillText('This may be due to security restrictions', 20, 110);
    ctx.fillText('or content that requires special rendering.', 20, 140);
    
    // Create texture from canvas with high quality settings
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16; // Higher anisotropy for better quality
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.premultiplyAlpha = true; // Handle transparency correctly
    return texture;
}

/**
 * Set the capturing for long exposure flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setCapturingForLongExposure(incomingValue) {
    if(incomingValue === Boolean(incomingValue)) {
        isCapturingForLongExposure = incomingValue;
    }
}

/**
 * Calculate a simple hash of a texture to detect changes between frames
 * @param {THREE.Texture} texture - The texture to hash
 * @returns {string} A simple hash of the texture
 */
export function calculateTextureHash(texture) {
    if (!texture || !texture.image) return '';
    
    try {
        // Create a small canvas to sample the texture
        const canvas = document.createElement('canvas');
        const size = 16; // Small sample size for performance
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Draw the texture to the canvas
        ctx.drawImage(texture.image, 0, 0, size, size);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, size, size).data;
        
        // Sample pixels at regular intervals
        const samples = [];
        const step = 4 * 4; // Sample every 4th pixel (RGBA)
        for (let i = 0; i < imageData.length; i += step) {
            // Use just the RGB values (skip alpha)
            samples.push(imageData[i], imageData[i+1], imageData[i+2]);
        }
        
        // Create a simple hash from the samples
        return samples.join(',');
    } catch (e) {
        console.error('Error calculating texture hash:', e);
        return '';
    }
}

/**
 * Trigger a render using the best available renderer
 * @returns {Promise<boolean>} Promise that resolves when rendering is complete
 */
function triggerRender() {
    return new Promise((resolve, reject) => {
        try {
            // Import state to get renderer
            import('../../scene/state.js').then(stateModule => {
                const state = stateModule.getState();
                
                if (state && state.renderer && state.scene && state.camera) {
                    console.log('[TEXTURE_DEBUG] Triggering render using state.renderer');
                    
                    // Use requestAnimationFrame to ensure we render in the next frame
                    // This helps ensure textures have had time to load properly
                    requestAnimationFrame(() => {
                        state.renderer.render(state.scene, state.camera);
                        console.log('[TEXTURE_DEBUG] Render complete');
                        resolve(true);
                    });
                } else if (window.renderer) {
                    console.log('[TEXTURE_DEBUG] Triggering render using window.renderer');
                    
                    requestAnimationFrame(() => {
                        window.renderer.render();
                        console.log('[TEXTURE_DEBUG] Render complete');
                        resolve(true);
                    });
                } else if (typeof window.render === 'function') {
                    console.log('[TEXTURE_DEBUG] Triggering render using window.render()');
                    
                    requestAnimationFrame(() => {
                        window.render();
                        console.log('[TEXTURE_DEBUG] Render complete');
                        resolve(true);
                    });
                } else {
                    console.warn('[TEXTURE_DEBUG] No renderer found, cannot trigger render');
                    resolve(false);
                }
            }).catch(error => {
                console.error('[TEXTURE_DEBUG] Error importing state module:', error);
                reject(error);
            });
        } catch (error) {
            console.error('[TEXTURE_DEBUG] Error in triggerRender:', error);
            reject(error);
        }
    });
}

/**
 * Set material properties to ensure a texture displays correctly
 * @param {THREE.Material} material - The material to modify
 */
function setMaterialForTextureDisplay(material) {
    // For MeshStandardMaterial or similar PBR materials
    if (material.type.includes('Standard') || material.type.includes('Physical')) {
        if (material.color) {
            // Set color to white to allow texture to display at full brightness
            material.color.setRGB(1, 1, 1);
        }
        
        // Adjust roughness and metalness for better texture visibility
        material.roughness = 0.1;  // Lower roughness for less diffuse scattering
        material.metalness = 0.0;  // Lower metalness for less reflection
    } 
    // For MeshBasicMaterial or similar non-PBR materials
    else if (material.color) {
        // Set color to white to allow texture to display at full brightness
        material.color.setRGB(1, 1, 1);
    }
    
    // For emissive materials, can optionally set emissive to allow the texture to "glow"
    if (material.emissive) {
        // Optional: make the material slightly emissive to ensure it's visible in all lighting
        material.emissive.setRGB(0.1, 0.1, 0.1);
    }
    
    // Set up transparency
    material.transparent = true;
    material.opacity = 1.0;
    material.alphaTest = 0.01;  // Helps with transparency issues
    
    // Ensure proper material settings for correct rendering
    material.side = THREE.DoubleSide; // Render both sides
    material.depthWrite = true;
    material.depthTest = true;
    material.needsUpdate = true;
}

/**
 * Disable custom texture display on a mesh
 * @param {Object} meshData - Data about the mesh to remove display from
 * @returns {Promise<boolean>} Promise that resolves when texture is removed
 */
export function disableCustomTexture(meshData) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Disabling custom texture for mesh:', meshData?.id);
            
            if (!meshData || !meshData.id) {
                console.error('Invalid mesh data provided to disableCustomTexture');
                reject(new Error('Invalid mesh data'));
                return;
            }
            
            // Generate the unique ID for this mesh
            const meshId = `mesh_${meshData.id}`;
            
            // Clean up animation resources for this mesh
            if (activeTextureData.has(meshId)) {
                const data = activeTextureData.get(meshId);
                
                // Remove iframe if it exists
                if (data.iframe) {
                    try {
                        document.body.removeChild(data.iframe);
                    } catch (error) {
                        console.debug('Error removing iframe:', error);
                    }
                }
                
                // Restore the original mesh material if we have the mesh
                if (data.mesh) {
                    await restoreMeshMaterial(data.mesh, meshData.id);
                } else {
                    // If we don't have the mesh, try to find it
                    await fallbackDisableTexture();
                }
                
                // Remove from active textures
                activeTextureData.delete(meshId);
                resolve(true);
            } else {
                // Fall back to old method if not in our tracking system
                await fallbackDisableTexture();
                resolve(true);
            }
        } catch (error) {
            console.error('Error disabling custom texture:', error);
            reject(error);
        }
        
        // Fallback method to find and disable texture if not in our tracking system
        async function fallbackDisableTexture() {
            return new Promise(async (resolve, reject) => {
                try {
                    // Try to get the mesh directly from meshData
                    let targetMesh = meshData.mesh;
                    
                    // If mesh is not provided in meshData, try to find it in the scene
                    if (!targetMesh) {
                        console.log(`No mesh provided in meshData for ID ${meshData.id}, trying to find in scene`);
                        
                        // Fall back to looking for the mesh in the scene
                        const stateModule = await import('../../scene/state.js');
                        const state = stateModule.getState();
                        if (!state.scene) {
                            console.error('Scene not available in state');
                            reject(new Error('Scene not available'));
                            return;
                        }
                        
                        // Find all meshes in the scene
                        const meshes = [];
                        state.scene.traverse(object => {
                            if (object.isMesh) {
                                meshes.push(object);
                            }
                        });
                        
                        // Try different methods to find the mesh
                        if (meshes.length > meshData.id) {
                            targetMesh = meshes[meshData.id];
                            console.log(`Found mesh by index ${meshData.id}: ${targetMesh.name}`);
                        } else {
                            const targetMeshName = `display_monitor_screen`;
                            targetMesh = meshes.find(mesh => mesh.name === targetMeshName);
                            
                            if (!targetMesh && meshes.length === 1) {
                                targetMesh = meshes[0];
                                console.log(`Using the only mesh in scene: ${targetMesh.name}`);
                            }
                        }
                        
                        if (!targetMesh) {
                            console.error(`Could not find target mesh with ID ${meshData.id}`);
                            reject(new Error('Target mesh not found'));
                            return;
                        }
                    }
                    
                    // Call the actual restore function
                    await restoreMeshMaterial(targetMesh, meshData.id);
                    resolve(true);
                } catch (error) {
                    console.error('Error in fallbackDisableTexture:', error);
                    reject(error);
                }
            });
        }
    });
}

/**
 * Restore the original material of a mesh
 * @param {THREE.Mesh} targetMesh - The mesh to restore
 * @param {number} meshId - The ID of the mesh for logging
 * @returns {Promise<boolean>} Promise that resolves when restoration is complete
 */
function restoreMeshMaterial(targetMesh, meshId) {
    return new Promise(async (resolve, reject) => {
        try {
            if (targetMesh.material) {
                if (Array.isArray(targetMesh.material)) {
                    // If the mesh has multiple materials, restore all
                    targetMesh.material.forEach(material => {
                        // Check for original texture backup
                        if (material._originalMap !== undefined) {
                            material.map = material._originalMap;
                            delete material._originalMap;
                        } else {
                            // If no backup, just remove the map
                            material.map = null;
                        }
                        
                        // Restore original material properties if they exist
                        if (material._originalColor) {
                            material.color.copy(material._originalColor);
                            delete material._originalColor;
                        }
                        
                        if (material._originalEmissive) {
                            material.emissive.copy(material._originalEmissive);
                            delete material._originalEmissive;
                        }
                        
                        if (material._originalRoughness !== undefined) {
                            material.roughness = material._originalRoughness;
                            delete material._originalRoughness;
                        }
                        
                        if (material._originalMetalness !== undefined) {
                            material.metalness = material._originalMetalness;
                            delete material._originalMetalness;
                        }
                        
                        material.needsUpdate = true;
                    });
                } else {
                    // Single material
                    if (targetMesh.material._originalMap !== undefined) {
                        targetMesh.material.map = targetMesh.material._originalMap;
                        delete targetMesh.material._originalMap;
                    } else {
                        targetMesh.material.map = null;
                    }
                    
                    // Restore original material properties if they exist
                    if (targetMesh.material._originalColor) {
                        targetMesh.material.color.copy(targetMesh.material._originalColor);
                        delete targetMesh.material._originalColor;
                    }
                    
                    if (targetMesh.material._originalEmissive) {
                        targetMesh.material.emissive.copy(targetMesh.material._originalEmissive);
                        delete targetMesh.material._originalEmissive;
                    }
                    
                    if (targetMesh.material._originalRoughness !== undefined) {
                        targetMesh.material.roughness = targetMesh.material._originalRoughness;
                        delete targetMesh.material._originalRoughness;
                    }
                    
                    if (targetMesh.material._originalMetalness !== undefined) {
                        targetMesh.material.metalness = targetMesh.material._originalMetalness;
                        delete targetMesh.material._originalMetalness;
                    }
                    
                    targetMesh.material.needsUpdate = true;
                }
            }
            
            // Clear any iframe reference stored on the mesh
            if (targetMesh._htmlIframe) {
                delete targetMesh._htmlIframe;
            }
            
            // Trigger a render to ensure changes are visible
            await triggerRender();
            
            console.log(`Custom texture removed from mesh ID ${meshId}`);
            resolve(true);
        } catch (error) {
            console.error('Error disabling custom texture:', error);
            reject(error);
        }
    });
}

/**
 * Clean up HTML texture animation resources
 * @param {number|string} meshId - The ID of the mesh to clean up, or null to clean up all
 */
export function cleanupHtmlTextureAnimation(meshId = null) {
    // If meshId is provided, only remove that mesh from the animation loop
    if (meshId !== null) {
        // Handle both number and string mesh IDs
        const targetId = typeof meshId === 'string' ? meshId : `mesh_${meshId}`;
        
        if (activeTextureData.has(targetId)) {
            const data = activeTextureData.get(targetId);
            
            // Remove iframe if it exists
            if (data.iframe) {
                try {
                    document.body.removeChild(data.iframe);
                } catch (error) {
                    console.debug('Error removing iframe:', error);
                }
            }
            
            // Dispose textures
            if (data.frames) {
                data.frames.forEach(frame => {
                    if (frame.texture) {
                        try {
                            frame.texture.dispose();
                        } catch (error) {
                            console.debug('Error disposing texture:', error);
                        }
                    }
                });
            }
            
            // Remove from active textures
            activeTextureData.delete(targetId);
        }
        
        // Legacy support for old system
        if (window._animatedHtmlMeshes && window._animatedHtmlMeshes.has(meshId)) {
            const data = window._animatedHtmlMeshes.get(meshId);
            if (data && data.iframe) {
                try {
                    document.body.removeChild(data.iframe);
                } catch (error) {
                    console.debug('Error removing iframe (legacy):', error);
                }
            }
            window._animatedHtmlMeshes.delete(meshId);
        }
        
        // If no more active textures, cancel animation loops
        if (activeTextureData.size === 0) {
            // Cancel our animation loop
            if (window._textureAnimationLoop) {
                cancelAnimationFrame(window._textureAnimationLoop);
                window._textureAnimationLoop = null;
            }
            
            // Cancel legacy animation loop
            if (window._htmlTextureAnimationLoop) {
                cancelAnimationFrame(window._htmlTextureAnimationLoop);
                window._htmlTextureAnimationLoop = null;
            }
        }
    } 
    // If no meshId is provided, clean up all resources
    else {
        // Clean up all tracked textures
        activeTextureData.forEach((data, id) => {
            if (data.iframe) {
                try {
                    document.body.removeChild(data.iframe);
                } catch (error) {
                    console.debug('Error removing iframe:', error);
                }
            }
            
            // Dispose textures
            if (data.frames) {
                data.frames.forEach(frame => {
                    if (frame.texture) {
                        try {
                            frame.texture.dispose();
                        } catch (error) {
                            console.debug('Error disposing texture:', error);
                        }
                    }
                });
            }
        });
        
        // Clear the map
        activeTextureData.clear();
        
        // Legacy support for old system
        if (window._animatedHtmlMeshes) {
            // Remove all iframes
            window._animatedHtmlMeshes.forEach((data) => {
                if (data.iframe) {
                    try {
                        document.body.removeChild(data.iframe);
                    } catch (error) {
                        console.debug('Error removing iframe (legacy):', error);
                    }
                }
            });
            
            // Clear the map
            window._animatedHtmlMeshes.clear();
        }
        
        // Cancel animation loops
        if (window._textureAnimationLoop) {
            cancelAnimationFrame(window._textureAnimationLoop);
            window._textureAnimationLoop = null;
        }
        
        if (window._htmlTextureAnimationLoop) {
            cancelAnimationFrame(window._htmlTextureAnimationLoop);
            window._htmlTextureAnimationLoop = null;
        }
    }
}

/**
 * Clean up all texture resources
 * This is useful for cleaning up when navigating away or shutting down
 */
function cleanupAllTextureResources() {
    console.log('Cleaning up all texture resources');
    
    // Clean up all HTML texture animations
    cleanupHtmlTextureAnimation();
    
    // Clean up all active texture data
    activeTextureData.forEach((data, id) => {
        console.log(`Cleaning up texture data for ID ${id}`);
        if (data.iframe) {
            try {
                document.body.removeChild(data.iframe);
            } catch (error) {
                console.debug('Error removing iframe:', error);
            }
        }
        
        if (data.texture) {
            try {
                data.texture.dispose();
            } catch (error) {
                console.debug('Error disposing texture:', error);
            }
        }
    });
    
    // Clear the map
    activeTextureData.clear();
    
    // Cancel any animation frames
    if (window._htmlTextureAnimationLoop) {
        cancelAnimationFrame(window._htmlTextureAnimationLoop);
        window._htmlTextureAnimationLoop = null;
    }
}

/**
 * Create and setup an iframe for rendering HTML content
 * @param {string} html - The HTML content to render
 * @returns {HTMLIFrameElement} The configured iframe
 */
function createAndSetupIframe(html) {
    console.log('[IFRAME_SETUP] Creating and setting up iframe for HTML content');
    
    // Create an iframe to render the HTML content
    const iframe = document.createElement('iframe');
    
    // Set up iframe style for optimal rendering
    iframe.style.width = '1024px';  // Use consistent size for better quality
    iframe.style.height = '576px';  // 16:9 aspect ratio
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';  // Hide it off-screen
    iframe.style.top = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'visible';
    iframe.style.opacity = '1';
    iframe.style.backgroundColor = 'white';  // Ensure white background
    iframe.style.transform = 'scale(1)';     // Ensure no scaling is applied
    iframe.allowTransparency = false;        // Don't allow transparency
    
    // Add important attributes
    iframe.setAttribute('scrolling', 'no');  // Prevent scrolling
    iframe.setAttribute('frameborder', '0'); // No border
    
    // Insert the iframe into the DOM
    document.body.appendChild(iframe);
    
    // Log iframe creation
    console.log('[IFRAME_SETUP] Iframe created and added to DOM');
    
    // Write the HTML content to the iframe
    if (iframe.contentDocument) {
        iframe.contentDocument.open();
        
        // Inject a basic HTML structure with embedded styles
        const enhancedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    html, body {
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 15px;
                        box-sizing: border-box;
                        background-color: white !important;
                        overflow: hidden;
                        font-family: Arial, sans-serif;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    /* Basic layout styling */
                    p, h1, h2, h3, h4, h5, h6, div, span {
                        margin: 0 0 10px 0;
                    }
                    /* Ensure images don't overflow */
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;
        
        iframe.contentDocument.write(enhancedHtml);
        iframe.contentDocument.close();
        
        // Log content writing
        console.log('[IFRAME_SETUP] HTML content written to iframe');
    } else {
        console.error('[IFRAME_SETUP] Could not access iframe contentDocument');
    }
    
    return iframe;
}

/**
 * Create a texture using basic Canvas API as a fallback when html2canvas isn't available
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @returns {THREE.Texture} A basic texture created from the HTML content
 */
function createFallbackTexture(iframe) {
    console.log('[FALLBACK] Creating fallback texture without html2canvas');
    
    // Create a canvas with 16:9 aspect ratio
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const ctx = canvas.getContext('2d');
    
    // Fill with a white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    try {
        // Add visual info about the content
        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
            const doc = iframe.contentDocument;
            const text = doc.body.textContent || 'No text content';
            
            // Draw a frame
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 10;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            
            // Add heading
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 32px Arial';
            ctx.fillText('HTML Content Preview', 30, 50);
            
            // Draw text preview - limit to 300 chars
            const textPreview = text.substring(0, 300) + (text.length > 300 ? '...' : '');
            
            // Wrap text
            const maxWidth = canvas.width - 60;
            const lineHeight = 24;
            let y = 100;
            
            // Add basic formatting if there seems to be structure
            const hasHeadings = doc.querySelector('h1, h2, h3, h4, h5, h6');
            const hasImages = doc.querySelector('img');
            const hasParagraphs = doc.querySelector('p');
            
            // Break the text into words
            let words = textPreview.split(' ');
            let line = '';
            
            ctx.font = '18px Arial';
            
            for (let i = 0; i < words.length; i++) {
                let testLine = line + words[i] + ' ';
                let metrics = ctx.measureText(testLine);
                let testWidth = metrics.width;
                
                if (testWidth > maxWidth && i > 0) {
                    ctx.fillText(line, 30, y);
                    line = words[i] + ' ';
                    y += lineHeight;
                    
                    // Stop if we've reached the bottom of the canvas
                    if (y > canvas.height - 100) break;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, 30, y);
            
            // Add info about content structure
            y = canvas.height - 80;
            ctx.font = '16px Arial';
            
            if (hasHeadings) {
                ctx.fillText('• Contains headings', 30, y);
                y += 20;
            }
            
            if (hasImages) {
                ctx.fillText('• Contains images', 30, y);
                y += 20;
            }
            
            if (hasParagraphs) {
                ctx.fillText('• Contains paragraphs', 30, y);
                y += 20;
            }
            
            // Add a message about fallback rendering
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Using fallback rendering (html2canvas unavailable)', 30, canvas.height - 20);
        } else {
            // If we can't access the iframe content, add an error message
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('Error: Cannot access HTML content', 30, 100);
        }
    } catch (error) {
        console.error('[FALLBACK] Error creating fallback texture:', error);
        
        // If there's an error, add an error message to the canvas
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Error creating texture', 30, 100);
        ctx.font = '18px Arial';
        ctx.fillText(error.message, 30, 140);
    }
    
    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    
    console.log('[FALLBACK] Created fallback texture successfully');
    return texture;
}

// Set up global animation handler
if (typeof window !== 'undefined') {
    // Ensure we clean up on page unload
    window.addEventListener('beforeunload', () => {
        cleanupAllTextureResources();
    });
}