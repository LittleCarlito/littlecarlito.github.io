/**
 * HTML Renderer Module
 * 
 * This module provides functionality for rendering HTML content in 3D scenes
 * using different methods: direct overlay, texture-based, and CSS3D.
 */

import * as THREE from 'three';
import { getBinaryBufferForMesh } from './glb-utils.js';
import { deserializeStringFromBinary, sanitizeHtml } from './string-serder.js';

// Track loaded dependencies
let css3DRendererLoaded = false;
let orbitControlsLoaded = false;

// Store renderers and scenes
const renderers = new Map();
const scenes = new Map();
const htmlElements = new Map();

/**
 * Initialize the HTML renderer for a specific mesh
 * @param {THREE.Mesh} mesh - The mesh to render HTML on
 * @param {string} htmlContent - The HTML content to render
 * @param {Object} settings - Rendering settings
 * @returns {Promise<boolean>} A promise that resolves to true if initialization was successful
 */
export async function initHtmlRenderer(mesh, htmlContent, settings = {}) {
    if (!mesh || !htmlContent) return false;
    
    // Get mesh ID or generate one
    const meshId = mesh.userData?.meshId || mesh.id || Math.floor(Math.random() * 100000);
    
    // Clean up any existing renderer for this mesh
    cleanupHtmlRenderer(meshId);
    
    // Get the rendering mode
    const renderMode = settings.previewMode || 'direct';
    
    try {
        switch (renderMode) {
            case 'css3d':
                return await initCSS3DRenderer(mesh, htmlContent, settings, meshId);
            case 'threejs':
                return await initTextureRenderer(mesh, htmlContent, settings, meshId);
            case 'direct':
            default:
                return await initDirectRenderer(mesh, htmlContent, settings, meshId);
        }
    } catch (error) {
        console.error(`Error initializing HTML renderer for mesh ${meshId}:`, error);
        return false;
    }
}

/**
 * Initialize CSS3D renderer for a mesh
 * @param {THREE.Mesh} mesh - The mesh to render HTML on
 * @param {string} htmlContent - The HTML content to render
 * @param {Object} settings - Rendering settings
 * @param {number} meshId - The ID of the mesh
 * @returns {Promise<boolean>} A promise that resolves to true if initialization was successful
 */
async function initCSS3DRenderer(mesh, htmlContent, settings, meshId) {
    // Load CSS3DRenderer if not already loaded
    if (!css3DRendererLoaded) {
        try {
            await loadCSS3DRenderer();
            css3DRendererLoaded = true;
        } catch (error) {
            console.error('Failed to load CSS3DRenderer:', error);
            // Fall back to texture-based rendering
            return initTextureRenderer(mesh, htmlContent, settings, meshId);
        }
    }
    
    // Get the parent scene
    const parentScene = mesh.parent;
    if (!parentScene) {
        console.error('Mesh must be added to a scene before initializing HTML renderer');
        return false;
    }
    
    // Get the renderer and camera from the parent scene
    const renderer = parentScene.userData?.renderer;
    const camera = parentScene.userData?.camera;
    
    if (!renderer || !camera) {
        console.error('Scene must have renderer and camera in userData');
        return false;
    }
    
    // Create a CSS3D scene
    const css3dScene = new THREE.Scene();
    
    // Create a CSS3D renderer
    const css3dRenderer = new THREE.CSS3DRenderer();
    css3dRenderer.setSize(renderer.domElement.width, renderer.domElement.height);
    css3dRenderer.domElement.style.position = 'absolute';
    css3dRenderer.domElement.style.top = '0';
    css3dRenderer.domElement.style.left = '0';
    css3dRenderer.domElement.style.pointerEvents = 'none';
    
    // Add CSS3D renderer to the DOM
    renderer.domElement.parentElement.appendChild(css3dRenderer.domElement);
    
    // Create an iframe for the HTML content
    const iframe = document.createElement('iframe');
    iframe.style.width = '960px';
    iframe.style.height = '540px';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = 'transparent';
    
    // Set the HTML content
    const sanitizedHtml = sanitizeHtml(htmlContent);
    iframe.srcdoc = sanitizedHtml;
    
    // Create a CSS3D object
    const css3dObject = new THREE.CSS3DObject(iframe);
    
    // Position the CSS3D object to match the mesh
    css3dObject.position.copy(mesh.position);
    css3dObject.quaternion.copy(mesh.quaternion);
    css3dObject.scale.copy(mesh.scale).multiplyScalar(settings.scale || 1);
    
    // Add the CSS3D object to the scene
    css3dScene.add(css3dObject);
    
    // Store the CSS3D objects for this mesh
    scenes.set(meshId, {
        css3dScene,
        css3dRenderer,
        css3dObject,
        parentScene,
        camera
    });
    
    // Store the iframe for cleanup
    htmlElements.set(meshId, iframe);
    
    // Add render callback to the parent scene
    const originalRenderFunction = parentScene.userData?.render || (() => {});
    parentScene.userData.render = () => {
        // Call the original render function
        originalRenderFunction();
        
        // Render the CSS3D scene
        css3dRenderer.render(css3dScene, camera);
    };
    
    return true;
}

/**
 * Initialize texture-based renderer for a mesh
 * @param {THREE.Mesh} mesh - The mesh to render HTML on
 * @param {string} htmlContent - The HTML content to render
 * @param {Object} settings - Rendering settings
 * @param {number} meshId - The ID of the mesh
 * @returns {Promise<boolean>} A promise that resolves to true if initialization was successful
 */
async function initTextureRenderer(mesh, htmlContent, settings, meshId) {
    try {
        // Create an iframe to render the HTML
        const iframe = document.createElement('iframe');
        iframe.style.width = '960px';
        iframe.style.height = '540px';
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.border = 'none';
        iframe.style.backgroundColor = 'transparent';
        document.body.appendChild(iframe);
        
        // Set the HTML content
        const sanitizedHtml = sanitizeHtml(htmlContent);
        iframe.srcdoc = sanitizedHtml;
        
        // Wait for the iframe to load
        await new Promise(resolve => {
            iframe.onload = resolve;
        });
        
        // Create a texture from the iframe
        const texture = await createTextureFromIframe(iframe);
        
        // Create a material with the texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: settings.opacity || 1.0
        });
        
        // Store the original material
        const originalMaterial = mesh.material;
        
        // Apply the new material to the mesh
        mesh.material = material;
        
        // Store the renderer info for this mesh
        renderers.set(meshId, {
            iframe,
            texture,
            material,
            originalMaterial,
            mesh,
            updateInterval: settings.updateInterval || 100
        });
        
        // Start the update loop
        startTextureUpdateLoop(meshId);
        
        return true;
    } catch (error) {
        console.error('Error initializing texture renderer:', error);
        return false;
    }
}

/**
 * Initialize direct overlay renderer for a mesh
 * @param {THREE.Mesh} mesh - The mesh to render HTML on
 * @param {string} htmlContent - The HTML content to render
 * @param {Object} settings - Rendering settings
 * @param {number} meshId - The ID of the mesh
 * @returns {Promise<boolean>} A promise that resolves to true if initialization was successful
 */
async function initDirectRenderer(mesh, htmlContent, settings, meshId) {
    try {
        // Get the parent scene
        const parentScene = mesh.parent;
        if (!parentScene) {
            console.error('Mesh must be added to a scene before initializing HTML renderer');
            return false;
        }
        
        // Get the renderer from the parent scene
        const renderer = parentScene.userData?.renderer;
        const camera = parentScene.userData?.camera;
        
        if (!renderer || !camera) {
            console.error('Scene must have renderer and camera in userData');
            return false;
        }
        
        // Create a container for the HTML content
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.pointerEvents = settings.interactable ? 'auto' : 'none';
        container.style.opacity = settings.opacity || 1.0;
        container.style.transition = 'opacity 0.3s ease';
        
        // Create an iframe for the HTML content
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.backgroundColor = 'transparent';
        
        // Set the HTML content
        const sanitizedHtml = sanitizeHtml(htmlContent);
        iframe.srcdoc = sanitizedHtml;
        
        // Add the iframe to the container
        container.appendChild(iframe);
        
        // Add the container to the DOM
        renderer.domElement.parentElement.appendChild(container);
        
        // Store the HTML elements for this mesh
        htmlElements.set(meshId, {
            container,
            iframe,
            mesh,
            camera,
            renderer,
            settings
        });
        
        // Add update callback to the render loop
        const originalRenderFunction = parentScene.userData?.render || (() => {});
        parentScene.userData.render = () => {
            // Call the original render function
            originalRenderFunction();
            
            // Update the position of the HTML container
            updateDirectOverlayPosition(meshId);
        };
        
        return true;
    } catch (error) {
        console.error('Error initializing direct renderer:', error);
        return false;
    }
}

/**
 * Update the position of a direct overlay HTML container
 * @param {number} meshId - The ID of the mesh
 */
function updateDirectOverlayPosition(meshId) {
    const htmlData = htmlElements.get(meshId);
    if (!htmlData) return;
    
    const { container, mesh, camera, renderer, settings } = htmlData;
    
    // Check if mesh is visible
    if (!mesh.visible) {
        container.style.display = 'none';
        return;
    }
    
    // Get the position of the mesh in screen space
    const meshPosition = mesh.position.clone();
    const screenPosition = meshPosition.project(camera);
    
    // Convert to CSS coordinates
    const x = (screenPosition.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (-(screenPosition.y * 0.5) + 0.5) * renderer.domElement.clientHeight;
    
    // Set the position of the container
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.transform = `translate(-50%, -50%) scale(${settings.scale || 1.0})`;
    
    // Show the container
    container.style.display = 'block';
    
    // Check if the mesh is facing the camera (billboard mode)
    if (settings.billboard) {
        // No need to do anything for direct overlay
    }
    
    // Check if the mesh is within the distance threshold
    if (settings.autoShow) {
        const distanceToCamera = camera.position.distanceTo(mesh.position);
        const isWithinThreshold = distanceToCamera <= (settings.distanceThreshold || 5.0);
        container.style.opacity = isWithinThreshold ? (settings.opacity || 1.0) : 0;
    }
}

/**
 * Start the texture update loop for a mesh
 * @param {number} meshId - The ID of the mesh
 */
function startTextureUpdateLoop(meshId) {
    const rendererData = renderers.get(meshId);
    if (!rendererData) return;
    
    const { iframe, texture, updateInterval } = rendererData;
    
    // Create an update function
    const updateTexture = async () => {
        try {
            // Check if renderer still exists
            if (!renderers.has(meshId)) return;
            
            // Update the texture from the iframe
            const newTexture = await createTextureFromIframe(iframe);
            
            // Update the material's texture
            const material = rendererData.material;
            if (material && material.map) {
                material.map.dispose();
                material.map = newTexture;
                material.needsUpdate = true;
            }
            
            // Schedule the next update
            setTimeout(updateTexture, updateInterval);
        } catch (error) {
            console.error('Error updating texture:', error);
        }
    };
    
    // Start the update loop
    setTimeout(updateTexture, updateInterval);
}

/**
 * Create a texture from an iframe
 * @param {HTMLIFrameElement} iframe - The iframe to create a texture from
 * @returns {Promise<THREE.Texture>} A promise that resolves to a Three.js texture
 */
async function createTextureFromIframe(iframe) {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if html2canvas is available
            if (typeof html2canvas === 'undefined') {
                // Load html2canvas
                await loadHtml2Canvas();
            }
            
            // Get iframe dimensions
            const width = parseInt(iframe.style.width) || 960;
            const height = parseInt(iframe.style.height) || 540;
            
            // Use html2canvas to capture the iframe content
            const canvas = await html2canvas(iframe.contentDocument.body, {
                backgroundColor: null, // Transparent background
                scale: 1,
                width: width,
                height: height,
                logging: false,
                allowTaint: true,
                useCORS: true
            });
            
            // Create a texture from the canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            
            resolve(texture);
        } catch (error) {
            console.error('Error creating texture from iframe:', error);
            
            // Create a fallback texture
            const texture = createFallbackTexture();
            resolve(texture);
        }
    });
}

/**
 * Create a fallback texture
 * @returns {THREE.Texture} A fallback texture
 */
function createFallbackTexture() {
    // Create a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a semi-transparent background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(10, 10, 400, 150);
    
    // Draw text
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HTML Content', 20, 40);
    
    ctx.font = '16px sans-serif';
    ctx.fillText('Content could not be rendered.', 20, 80);
    ctx.fillText('This may be due to security restrictions', 20, 110);
    ctx.fillText('or content that requires special rendering.', 20, 140);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
}

/**
 * Load html2canvas library
 * @returns {Promise<void>} A promise that resolves when html2canvas is loaded
 */
async function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        // Check if html2canvas is already loaded
        if (typeof html2canvas !== 'undefined') {
            resolve();
            return;
        }
        
        // Load html2canvas
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => resolve();
        script.onerror = (error) => reject(error);
        document.head.appendChild(script);
    });
}

/**
 * Load CSS3DRenderer library
 * @returns {Promise<void>} A promise that resolves when CSS3DRenderer is loaded
 */
async function loadCSS3DRenderer() {
    return new Promise((resolve, reject) => {
        // Check if CSS3DRenderer is already loaded
        if (THREE.CSS3DRenderer) {
            console.log('CSS3DRenderer already available');
            resolve();
            return;
        }
        
        // Try multiple CDN sources in case one fails
        const cdnUrls = [
            // Unpkg is generally more reliable for Three.js examples
            'https://unpkg.com/three@0.149.0/examples/js/renderers/CSS3DRenderer.js',
            // Fallback to jsDelivr with explicit content type
            'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/js/renderers/CSS3DRenderer.js',
            // Another fallback to older version
            'https://unpkg.com/three@0.147.0/examples/js/renderers/CSS3DRenderer.js'
        ];
        
        // Try to load from the first URL
        loadFromUrl(cdnUrls, 0);
        
        function loadFromUrl(urls, index) {
            if (index >= urls.length) {
                console.warn('All CDN attempts failed, trying local fallback');
                
                // Try local fallback
                import('./css3d-renderer.js')
                    .then(() => {
                        if (typeof THREE.CSS3DRenderer === 'function') {
                            console.log('Successfully loaded CSS3DRenderer from local fallback');
                            resolve();
                        } else {
                            const error = new Error('Local fallback loaded but CSS3DRenderer not found');
                            console.error(error);
                            reject(error);
                        }
                    })
                    .catch(error => {
                        console.error('Failed to load local CSS3DRenderer fallback:', error);
                        reject(new Error('Failed to load CSS3DRenderer from any source'));
                    });
                return;
            }
            
            const url = urls[index];
            console.log(`Attempting to load CSS3DRenderer from: ${url}`);
            
            const script = document.createElement('script');
            script.src = url;
            
            // Set explicit content type to help with MIME type issues
            script.type = 'text/javascript';
            
            script.onload = () => {
                console.log(`CSS3DRenderer loaded successfully from ${url}`);
                
                // Verify that it actually loaded the correct object
                if (typeof THREE.CSS3DRenderer === 'function') {
                    resolve();
                } else {
                    console.warn('CSS3DRenderer loaded but object not found, trying next source');
                    loadFromUrl(urls, index + 1);
                }
            };
            
            script.onerror = () => {
                console.warn(`Failed to load CSS3DRenderer from ${url}, trying next source`);
                loadFromUrl(urls, index + 1);
            };
            
            document.head.appendChild(script);
        }
    });
}

/**
 * Clean up HTML renderer for a mesh
 * @param {number} meshId - The ID of the mesh
 */
export function cleanupHtmlRenderer(meshId) {
    // Clean up CSS3D renderer
    const sceneData = scenes.get(meshId);
    if (sceneData) {
        const { css3dScene, css3dRenderer, css3dObject, parentScene } = sceneData;
        
        // Remove CSS3D object from scene
        if (css3dScene && css3dObject) {
            css3dScene.remove(css3dObject);
        }
        
        // Remove CSS3D renderer from DOM
        if (css3dRenderer && css3dRenderer.domElement && css3dRenderer.domElement.parentElement) {
            css3dRenderer.domElement.parentElement.removeChild(css3dRenderer.domElement);
        }
        
        // Restore original render function
        if (parentScene && parentScene.userData && parentScene.userData.originalRender) {
            parentScene.userData.render = parentScene.userData.originalRender;
            delete parentScene.userData.originalRender;
        }
        
        // Remove from scenes map
        scenes.delete(meshId);
    }
    
    // Clean up texture renderer
    const rendererData = renderers.get(meshId);
    if (rendererData) {
        const { iframe, texture, material, originalMaterial, mesh } = rendererData;
        
        // Remove iframe from DOM
        if (iframe && iframe.parentElement) {
            iframe.parentElement.removeChild(iframe);
        }
        
        // Dispose of texture
        if (texture) {
            texture.dispose();
        }
        
        // Dispose of material
        if (material) {
            material.dispose();
        }
        
        // Restore original material
        if (mesh && originalMaterial) {
            mesh.material = originalMaterial;
        }
        
        // Remove from renderers map
        renderers.delete(meshId);
    }
    
    // Clean up direct renderer
    const htmlData = htmlElements.get(meshId);
    if (htmlData) {
        const { container } = htmlData;
        
        // Remove container from DOM
        if (container && container.parentElement) {
            container.parentElement.removeChild(container);
        }
        
        // Remove from htmlElements map
        htmlElements.delete(meshId);
    }
}

/**
 * Load HTML content for a mesh from GLB binary buffer
 * @param {THREE.Mesh} mesh - The mesh to load HTML for
 * @param {ArrayBuffer} glbBuffer - The GLB buffer to load from
 * @param {Object} settings - Rendering settings
 * @returns {Promise<boolean>} A promise that resolves to true if loading was successful
 */
export async function loadHtmlForMeshFromGlb(mesh, glbBuffer, settings = {}) {
    if (!mesh || !glbBuffer) return false;
    
    try {
        // Get mesh ID
        const meshId = mesh.userData?.meshId || mesh.id;
        
        // Get binary buffer for this mesh
        const binaryBuffer = await getBinaryBufferForMesh(glbBuffer, meshId);
        
        // If no buffer found, return false
        if (!binaryBuffer || binaryBuffer.byteLength === 0) {
            return false;
        }
        
        // Deserialize buffer to HTML content
        const htmlContent = deserializeStringFromBinary(binaryBuffer);
        
        // Initialize HTML renderer
        return await initHtmlRenderer(mesh, htmlContent, settings);
    } catch (error) {
        console.error('Error loading HTML for mesh:', error);
        return false;
    }
}

// Export the module
export default {
    initHtmlRenderer,
    cleanupHtmlRenderer,
    loadHtmlForMeshFromGlb
}; 