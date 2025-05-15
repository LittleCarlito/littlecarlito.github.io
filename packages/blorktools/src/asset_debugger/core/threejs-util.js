import * as THREE from 'three';
import { infoPanel, isPreviewActive, isPreviewAnimationPaused, resetInfoPanel, setIsPreviewActive, setIsPreviewAnimationPaused, setLastTextureUpdateTime } from "./preview-util";
import { createTextureFromIframe } from './texture-util';
import { getState } from './state';
import { originalAnimationStartTime, showStatus } from '../ui/scripts/html-editor-modal';
import { animationDuration, isAnimationFinite, preRenderedFrames, preRenderingInProgress } from './animation-util';

let pendingTextureUpdate = false;
let previewAnimationId = null;
let lastAnimationFrameTime = 0;
const targetFrameRate = 60; // Target 60 FPS for better performance/animation balance
const frameInterval = 1000 / targetFrameRate;
export let previewPlane;
export let animationPreviewScene, animationPreviewCamera, animationPreviewRenderer;
export let animationCss3dScene, animationCss3dRenderer, animationCss3dObject;
export let frameBuffer = [];
export let previewRenderTarget = null;

/**
 * Initialize Three.js for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
export function initThreeJsPreview(container, iframe, currentMeshId, createInfoPanel = true) {
    try {
        // We already have THREE imported at the top of the file
        console.log('Using imported Three.js module');

        // Only need to load html2canvas
        loadHtml2Canvas(() => {
            setupThreeJsScene(container, iframe, currentMeshId, createInfoPanel);
        });
    } catch (error) {
        console.error('Error initializing Three.js preview:', error);
        logPreviewError(`Three.js initialization error: ${error.message}`);
    }
}

/**
 * Set up the Three.js scene for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
function setupThreeJsScene(container, iframe, currentMeshId, createInfoPanel = true) {
    try {
        // Create scene with dark gray background
        animationPreviewScene = new THREE.Scene();
        animationPreviewScene.background = new THREE.Color(0x303030); // Dark gray background like Unreal Editor
        
        // Create camera
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        // Use perspective camera for better 3D viewing
        animationPreviewCamera = new THREE.PerspectiveCamera(
            60, containerAspectRatio, 0.1, 1000
        );
        animationPreviewCamera.position.z = 3;
        
        // Create renderer with enhanced quality settings
        animationPreviewRenderer = new THREE.WebGLRenderer({ 
            antialias: true,
            preserveDrawingBuffer: true // Preserve the buffer for screenshots
        });
        animationPreviewRenderer.setSize(containerWidth, containerHeight);
        animationPreviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
        animationPreviewRenderer.setClearColor(0x303030); // Set clear color to dark gray
        animationPreviewRenderer.outputEncoding = THREE.sRGBEncoding; // Use sRGB encoding for better color accuracy
        
        // Performance optimizations
        animationPreviewRenderer.shadowMap.enabled = false; // Disable shadows for performance
        
        // Ensure the renderer canvas fits perfectly in the container
        const rendererCanvas = animationPreviewRenderer.domElement;
        rendererCanvas.style.display = 'block';
        rendererCanvas.style.width = '100%';
        rendererCanvas.style.height = '100%';
        container.appendChild(rendererCanvas);
        
        // Create a render target for the iframe
        previewRenderTarget = iframe;
        
        // Create info panel if requested
        if (createInfoPanel) {
            createMeshInfoPanel(container, currentMeshId);
        }
        
        // Create initial texture from iframe content with improved quality
        createTextureFromIframe(iframe).then(texture => {
            // Get the mesh from the state if available
            const state = getState();
            const originalMesh = state.meshes && state.meshes[currentMeshId];
            let geometry;
            
            if (originalMesh && originalMesh.geometry) {
                try {
                    // Try to use the original mesh geometry
                    geometry = originalMesh.geometry.clone();
                    console.log("Using original mesh geometry for preview");
                    
                    // Detect if this is a rectangle/plane-like mesh
                    const isPlaneOrRectangle = geometry.attributes.position.count <= 8; // 4 vertices (8 corners) usually indicates a plane/rectangle
                    
                    // Variables to store mesh analysis results - defined in this scope to be accessible later
                    let dominantPlane = 'xy';
                    let normalVector = new THREE.Vector3(0, 0, 1);
                    let upVector = new THREE.Vector3(0, 1, 0);
                    
                    // Find the dominant axis and create appropriate UVs
                    if (geometry.attributes.position) {
                        // Analyze the geometry to find the dominant plane
                        let minX = Infinity, maxX = -Infinity;
                        let minY = Infinity, maxY = -Infinity;
                        let minZ = Infinity, maxZ = -Infinity;
                        
                        const positions = geometry.attributes.position;
                        const count = positions.count;
                        
                        // Find bounds
                        for (let i = 0; i < count; i++) {
                            const x = positions.getX(i);
                            const y = positions.getY(i);
                            const z = positions.getZ(i);
                            
                            minX = Math.min(minX, x);
                            maxX = Math.max(maxX, x);
                            minY = Math.min(minY, y);
                            maxY = Math.max(maxY, y);
                            minZ = Math.min(minZ, z);
                            maxZ = Math.max(maxZ, z);
                        }
                        
                        // Calculate ranges
                        const rangeX = maxX - minX;
                        const rangeY = maxY - minY;
                        const rangeZ = maxZ - minZ;
                        
                        console.log(`Mesh dimensions: X: ${rangeX.toFixed(2)}, Y: ${rangeY.toFixed(2)}, Z: ${rangeZ.toFixed(2)}`);
                        
                        // Determine dominant plane based on which dimension is smallest (indicating flatness)
                        if (rangeZ < rangeX && rangeZ < rangeY) {
                            dominantPlane = 'xy'; // Flat in Z direction
                            normalVector = new THREE.Vector3(0, 0, 1);
                            upVector = new THREE.Vector3(0, 1, 0);
                        } else if (rangeY < rangeX && rangeY < rangeZ) {
                            dominantPlane = 'xz'; // Flat in Y direction
                            normalVector = new THREE.Vector3(0, 1, 0);
                            upVector = new THREE.Vector3(0, 0, 1);
                        } else {
                            dominantPlane = 'yz'; // Flat in X direction
                            normalVector = new THREE.Vector3(1, 0, 0);
                            upVector = new THREE.Vector3(0, 1, 0);
                        }
                        
                        // Try to detect "forward" and "up" by analyzing the mesh
                        if (geometry.index) {
                            // For indexed geometries, we can compute face normals
                            try {
                                geometry.computeVertexNormals();
                                // Find the most common normal direction
                                let normalSum = new THREE.Vector3(0, 0, 0);
                                
                                // If normal attribute exists, average the normals
                                if (geometry.attributes.normal) {
                                    const normals = geometry.attributes.normal;
                                    for (let i = 0; i < normals.count; i++) {
                                        normalSum.x += normals.getX(i);
                                        normalSum.y += normals.getY(i);
                                        normalSum.z += normals.getZ(i);
                                    }
                                    normalSum.divideScalar(normals.count);
                                    normalSum.normalize();
                                    
                                    // If we found a clear normal, use it
                                    if (normalSum.length() > 0.5) {
                                        normalVector = normalSum;
                                        console.log(`Detected normal vector: (${normalVector.x.toFixed(2)}, ${normalVector.y.toFixed(2)}, ${normalVector.z.toFixed(2)})`);
                                        
                                        // Find up vector (perpendicular to normal)
                                        if (Math.abs(normalVector.y) < 0.7) {
                                            // If normal is not pointing up/down, use world up as reference
                                            upVector = new THREE.Vector3(0, 1, 0);
                                            // Make sure up is perpendicular to normal
                                            upVector.sub(normalVector.clone().multiplyScalar(normalVector.dot(upVector)));
                                            upVector.normalize();
                                        } else {
                                            // If normal is pointing up/down, use world forward as reference for up
                                            upVector = new THREE.Vector3(0, 0, 1);
                                            // Make sure up is perpendicular to normal
                                            upVector.sub(normalVector.clone().multiplyScalar(normalVector.dot(upVector)));
                                            upVector.normalize();
                                        }
                                        console.log(`Calculated up vector: (${upVector.x.toFixed(2)}, ${upVector.y.toFixed(2)}, ${upVector.z.toFixed(2)})`);
                                    }
                                }
                            } catch (e) {
                                console.warn("Error computing normals:", e);
                            }
                        }
                        
                        console.log(`Using plane: ${dominantPlane}, normal: (${normalVector.x.toFixed(2)}, ${normalVector.y.toFixed(2)}, ${normalVector.z.toFixed(2)})`);
                        
                        // Create UVs based on the dominant plane
                        const uvs = new Float32Array(count * 2);
                        
                        // Define transform matrices to help with UV mapping based on orientation
                        const transformMatrix = new THREE.Matrix4();
                        
                        // Create a quaternion that aligns the normal with the +Z axis
                        const quaternion = new THREE.Quaternion().setFromUnitVectors(normalVector, new THREE.Vector3(0, 0, 1));
                        transformMatrix.makeRotationFromQuaternion(quaternion);
                        
                        // Temporary vectors for transformed coordinates
                        const tempVector = new THREE.Vector3();
                        
                        for (let i = 0; i < count; i++) {
                            const x = positions.getX(i);
                            const y = positions.getY(i);
                            const z = positions.getZ(i);
                            
                            // Transform point to orient according to detected normal
                            tempVector.set(x, y, z);
                            tempVector.applyMatrix4(transformMatrix);
                            
                            // Now we can map the transformed X,Y to U,V
                            const transformedX = tempVector.x;
                            const transformedY = tempVector.y;
                            
                            // Map to 0-1 range based on the bounds of the geometry
                            const u = (transformedX - minX) / Math.max(0.0001, rangeX);
                            const v = (transformedY - minY) / Math.max(0.0001, rangeY); // Remove the 1.0 - to fix upside down orientation
                            
                            uvs[i * 2] = u;
                            uvs[i * 2 + 1] = v;
                        }
                        
                        // Apply the UVs, replacing any existing ones
                        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                        console.log("Created custom UVs for rectangle/plane geometry");
                        
                        // Store these values for camera positioning
                        geometry.userData = geometry.userData || {};
                        geometry.userData.dominantPlane = dominantPlane;
                        geometry.userData.normalVector = normalVector;
                        geometry.userData.upVector = upVector;
                    }
                } catch (e) {
                    console.warn("Could not clone original mesh geometry, falling back to cube", e);
                    geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
                }
            } else {
                // Fallback to cube if mesh not found
                console.log("No mesh found with ID " + currentMeshId + ", using cube geometry");
                geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
            }
            
            // Create material with the HTML texture
            const material = new THREE.MeshBasicMaterial({ 
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: true,
                fog: false
            });
            
            // Create mesh
            previewPlane = new THREE.Mesh(geometry, material);
            
            // Optimize with frustum culling off (we know it's always visible)
            previewPlane.frustumCulled = false;
            
            // Add to scene
            animationPreviewScene.add(previewPlane);
            
            // Position the camera to look at the dominant face of the mesh
            if (geometry.userData && geometry.userData.normalVector) {
                const normalVector = geometry.userData.normalVector;
                const upVector = geometry.userData.upVector;
                const dominantPlane = geometry.userData.dominantPlane;
                
                // Position camera along the normal vector for optimal viewing
                const cameraPosition = normalVector.clone().multiplyScalar(2); // Closer view (was 3)
                animationPreviewCamera.position.copy(cameraPosition);
                
                // Look at the center of the mesh
                animationPreviewCamera.lookAt(0, 0, 0);
                
                // Ensure the camera's "up" direction aligns with our computed up vector
                animationPreviewCamera.up.copy(upVector);
                
                // Configure mesh orientation to present the front face to the camera
                // Create a rotation that aligns the normal with the camera view
                const lookAtMatrix = new THREE.Matrix4();
                lookAtMatrix.lookAt(
                    new THREE.Vector3(0, 0, 0),  // Object position
                    normalVector.clone().negate(), // Look at the reverse of the normal vector
                    upVector                       // Up vector
                );
                
                // Extract the rotation from the matrix
                const rotation = new THREE.Quaternion();
                rotation.setFromRotationMatrix(lookAtMatrix);
                previewPlane.quaternion.copy(rotation);
                
                console.log(`Camera positioned based on detected normal and up vectors`);
            } else if (dominantPlane) {
                // Fallback to using just the dominant plane if no normal vector
                // Position the camera based on the dominant plane
                if (dominantPlane === 'xy') {
                    // Position camera to look at the XY plane
                    animationPreviewCamera.position.set(0, 0, 3);
                    animationPreviewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, 0, 0);
                } else if (dominantPlane === 'xz') {
                    // Position camera to look at the XZ plane
                    animationPreviewCamera.position.set(0, 3, 0);
                    animationPreviewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(-Math.PI/2, 0, 0);
                } else { // yz
                    // Position camera to look at the YZ plane
                    animationPreviewCamera.position.set(3, 0, 0);
                    animationPreviewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, Math.PI/2, 0);
                }
                
                console.log(`Camera positioned to view the ${dominantPlane} plane`);
            } else {
                // Default position if no dominant plane was determined
                animationPreviewCamera.position.z = 3;
                
                // Set initial rotation but don't animate it
                previewPlane.rotation.x = Math.PI / 10;
                previewPlane.rotation.y = Math.PI / 6;
            }
            
            // Add orbit controls for better user interaction
            setupOrbitControls(animationPreviewCamera, animationPreviewRenderer.domElement)
                .then(controls => {
                    // Start animation loop after controls are set up
                    animatePreview();
                    
                    // Show helpful message about keyboard shortcuts
                    showStatus('Preview ready. Use +/- keys to zoom in/out', 'success');
                    
                    // Add keyboard shortcuts for zooming
                    const handleKeydown = (event) => {
                        if (!isPreviewActive) return;
                        
                        // Get current controls - they should be attached to the camera by this point
                        const controls = animationPreviewCamera.userData.controls;
                        if (!controls) return;
                        
                        const zoomSpeed = 0.2; // How fast to zoom with keyboard
                        
                        switch (event.key) {
                            case '+':
                            case '=': // Common + key without shift
                                // Zoom in - decrease distance to target
                                controls.dollyIn(1 + zoomSpeed);
                                controls.update();
                                break;
                            case '-':
                            case '_': // Common - key with shift
                                // Zoom out - increase distance to target
                                controls.dollyOut(1 + zoomSpeed);
                                controls.update();
                                break;
                        }
                    };
                    
                    // Register keyboard handler
                    document.addEventListener('keydown', handleKeydown);
                    
                    // Store for cleanup
                    animationPreviewCamera.userData.keyHandler = handleKeydown;
                })
                .catch(error => {
                    console.error('Failed to setup orbit controls:', error);
                    // Still start animation even if controls fail
                    animatePreview();
                });
        }).catch(error => {
            console.error('Error creating texture from iframe:', error);
            showStatus('Error creating texture from HTML: ' + error.message, 'error');
            // Still try to start animation with fallback texture
            animatePreview();
        });
        
        // Handle window resize
        window.addEventListener('resize', onPreviewResize);
    } catch (error) {
        console.error('Error setting up Three.js scene:', error);
        showStatus('Error in Three.js scene setup: ' + error.message, 'error');
    }
}

/**
 * Clean up Three.js resources
 */
export function cleanupThreeJsPreview() {
    // Mark preview as inactive to stop animation loop first
    setIsPreviewActive(false);
    
    // Clean up info panel
    cleanupInfoPanel();
    
    // Clear pending update operations and animation frames first
    if (pendingTextureUpdate) {
        pendingTextureUpdate = false;
    }
    
    if (previewAnimationId !== null) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
    }
    
    // Clean up frame buffer
    if (frameBuffer.length > 0) {
        frameBuffer.forEach(frame => {
            if (frame && frame.texture) {
                frame.texture.dispose();
            }
        });
        frameBuffer = [];
    }
    
    // Reset debug flag
    window._css3dDebugLogged = false;
    
    // Remove event listener
    window.removeEventListener('resize', onPreviewResize);
    
    // Clean up HTML texture preview elements
    try {
        const textureCanvas = document.getElementById('html-texture-canvas');
        if (textureCanvas && textureCanvas.parentNode) {
            textureCanvas.parentNode.removeChild(textureCanvas);
        }
        
        const hiddenContent = document.getElementById('hidden-html-content');
        if (hiddenContent && hiddenContent.parentNode) {
            hiddenContent.parentNode.removeChild(hiddenContent);
        }
    } catch (e) {
        console.log('HTML element cleanup error (non-critical):', e);
    }
    
    // Clean up and nullify previewRenderTarget - save a local copy for safety
    const localRenderTarget = previewRenderTarget;
    previewRenderTarget = null; // Set to null first to prevent new render attempts
    
    // Clean up the render target if it exists
    if (localRenderTarget) {
        try {
            if (localRenderTarget.texture) {
                localRenderTarget.texture.dispose();
            }
        } catch (e) {
            console.log('Render target cleanup error (non-critical):', e);
        }
    }
    
    // Clean up CSS3D resources
    try {
        if (animationCss3dScene) {
            // Remove all objects from the scene
            while (animationCss3dScene.children.length > 0) {
                const object = animationCss3dScene.children[0];
                animationCss3dScene.remove(object);
                
                // If it's a CSS3D object with an iframe element, remove it from DOM
                if (object.element && object.element.parentNode) {
                    try {
                        if (object.element.contentDocument) {
                            object.element.contentDocument.open();
                            object.element.contentDocument.write('');
                            object.element.contentDocument.close();
                        }
                        object.element.parentNode.removeChild(object.element);
                    } catch (err) {
                        console.log('Iframe cleanup error (non-critical):', err);
                    }
                }
            }
            animationCss3dScene = null;
        }
        
        animationCss3dObject = null;
        
        if (animationCss3dRenderer) {
            if (animationCss3dRenderer.domElement && animationCss3dRenderer.domElement.parentElement) {
                animationCss3dRenderer.domElement.parentElement.removeChild(animationCss3dRenderer.domElement);
            }
            animationCss3dRenderer = null;
        }
    } catch (e) {
        console.log('CSS3D cleanup error (non-critical):', e);
    }
    
    // Original cleanup code for texture-based preview
    try {
        if (previewPlane) {
            if (previewPlane.geometry) previewPlane.geometry.dispose();
            if (previewPlane.material) {
                if (Array.isArray(previewPlane.material)) {
                    previewPlane.material.forEach(material => {
                        if (material.map) material.map.dispose();
                        material.dispose();
                    });
                } else {
                    if (previewPlane.material.map) previewPlane.material.map.dispose();
                    previewPlane.material.dispose();
                }
            }
            if (animationPreviewScene) animationPreviewScene.remove(previewPlane);
            previewPlane = null;
        }
        
        if (animationPreviewScene) {
            // Clean up any other objects in the scene
            if (animationPreviewScene.children) {
                while (animationPreviewScene.children.length > 0) {
                    const object = animationPreviewScene.children[0];
                    animationPreviewScene.remove(object);
                    
                    // Dispose of geometry and materials
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => {
                                if (material.map) material.map.dispose();
                                material.dispose();
                            });
                        } else {
                            if (object.material.map) object.material.map.dispose();
                            object.material.dispose();
                        }
                    }
                }
            }
            animationPreviewScene = null;
        }
    } catch (e) {
        console.log('Three.js scene cleanup error (non-critical):', e);
    }
    
    animationPreviewCamera = null;
    
    try {
        if (animationPreviewRenderer) {
            animationPreviewRenderer.dispose();
            if (animationPreviewRenderer.domElement && animationPreviewRenderer.domElement.parentElement) {
                animationPreviewRenderer.domElement.parentElement.removeChild(animationPreviewRenderer.domElement);
            }
            animationPreviewRenderer = null;
        }
    } catch (e) {
        console.log('Renderer cleanup error (non-critical):', e);
    }
    
    // Remove the render iframe
    try {
        const renderIframe = document.getElementById('html-render-iframe');
        if (renderIframe) {
            // Clear iframe content first
            if (renderIframe.contentDocument) {
                renderIframe.contentDocument.open();
                renderIframe.contentDocument.write('');
                renderIframe.contentDocument.close();
            }
            
            // Then remove from DOM
            if (renderIframe.parentElement) {
                renderIframe.parentElement.removeChild(renderIframe);
            }
        }
    } catch (error) {
        // Suppress iframe access errors during cleanup
        console.log('Iframe cleanup error (non-critical)');
    }
    
    // Reset animation state
    setIsPreviewAnimationPaused(false);
    setLastTextureUpdateTime(0);
    pendingTextureUpdate = false;
    lastAnimationFrameTime = 0;
    
    // Clean up keyboard event handlers
    if (animationPreviewCamera && animationPreviewCamera.userData && animationPreviewCamera.userData.keyHandler) {
        document.removeEventListener('keydown', animationPreviewCamera.userData.keyHandler);
        console.log('Keyboard event handlers cleaned up');
    }
    
    // Clean up the global animateMessages function
    if (window.animateMessages) {
        window.animateMessages = null;
    }
    
    console.log('Three.js and CSS3D resources cleaned up');
}

/**
 * Clean up info panel resources
 * Removes the info panel from the DOM and resets the infoPanel reference
 * This is called when closing the preview or switching between preview modes
 */
function cleanupInfoPanel() {
    if (infoPanel) {
        try {
            if (infoPanel.parentNode) {
                infoPanel.parentNode.removeChild(infoPanel);
            }
        } catch (e) {
            console.log('Error removing info panel:', e);
        }
        resetInfoPanel();
    }
}

/**
 * Handle window resize for the Three.js preview
 */
function onPreviewResize() {
    const container = animationPreviewRenderer.domElement.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Update camera aspect ratio
    if (animationPreviewCamera) {
        animationPreviewCamera.aspect = containerWidth / containerHeight;
        animationPreviewCamera.updateProjectionMatrix();
    }
    
    // Update renderer
    animationPreviewRenderer.setSize(containerWidth, containerHeight);
}

/**
 * Set preview render target
 * @param {THREE.WebGLRenderTarget} incomingValue - The new value to set
 */
export function setPreviewRenderTarget(incomingValue) {
    previewRenderTarget = incomingValue;
}

/**
 * Set aniamtion preview camera
 * @param {THREE.Camera} incomingValue - The new value to set
 */
export function setAnimationPreviewCamera(incomingValue) {
    animationPreviewCamera = incomingValue;
}

/**
 * Load html2canvas library
 * @param {Function} callback - Function to call when loading is complete
 */
function loadHtml2Canvas(callback) {
    // Check if html2canvas is already loaded
    if (typeof window.html2canvas !== 'undefined') {
        callback();
        return;
    }
    
    // Check if it's already being loaded
    if (document.querySelector('script[src*="html2canvas"]')) {
        const checkInterval = setInterval(() => {
            if (typeof window.html2canvas !== 'undefined') {
                clearInterval(checkInterval);
                callback();
            }
        }, 100);
        return;
    }
    
    // Load html2canvas
    console.log('Loading html2canvas library');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = callback;
    script.onerror = (error) => {
        console.error('Failed to load html2canvas:', error);
    };
    document.head.appendChild(script);
}

/**
 * Setup OrbitControls for camera interaction
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element to attach controls to
 * @returns {Promise<THREE.OrbitControls>} A promise that resolves to orbit controls
 */
function setupOrbitControls(camera, domElement) {
    return new Promise((resolve, reject) => {
        try {
            // Import OrbitControls dynamically
            import('three/examples/jsm/controls/OrbitControls.js')
                .then(module => {
                    const { OrbitControls } = module;
                    
                    // Create controls
                    const controls = new OrbitControls(camera, domElement);
                    controls.enableDamping = true;
                    controls.dampingFactor = 0.2;
                    controls.rotateSpeed = 0.5;
                    controls.minDistance = 0.5; // Allow much closer zooming for WebGL
                    controls.maxDistance = 20;  // Allow zooming out for WebGL
                    controls.zoomSpeed = 1.2;   // Faster zoom
                    
                    // Store controls with camera for access elsewhere
                    camera.userData = camera.userData || {};
                    camera.userData.controls = controls;
                    
                    resolve(controls);
                })
                .catch(error => {
                    console.error('Error loading OrbitControls:', error);
                    reject(error);
                });
        } catch (error) {
            console.error('Error setting up OrbitControls:', error);
            reject(error);
        }
    });
}

/**
 * Animation loop for the Three.js preview
 */
function animatePreview() {
    // If preview is no longer active, don't continue the animation loop
    if (!isPreviewActive) {
        console.log('Preview no longer active, stopping animation loop');
        return;
    }
    
    // Schedule next frame immediately for high priority
    previewAnimationId = requestAnimationFrame(animatePreview);
    
    try {
        // Throttle to target framerate
        const now = performance.now();
        const elapsed = now - lastAnimationFrameTime;
        
        if (elapsed < frameInterval) {
            return; // Skip rendering this frame if we're ahead of schedule
        }
        
        // Calculate actual FPS for monitoring (once per second)
        if (now - lastAnimationFrameTime > 1000) {
            console.log(`Current framerate: ${Math.round(1000 / elapsed)} FPS`);
        }
        
        // Remember last frame time for throttling
        lastAnimationFrameTime = now - (elapsed % frameInterval);
        
        // Apply any animation effects to the mesh based on settings
        if (previewPlane) {
            // Get current mesh ID from the modal
            const modal = document.getElementById('html-editor-modal');
            const currentMeshId = parseInt(modal.dataset.meshId);
            
            // Get animation settings for this mesh
            const settings = getHtmlSettingsForMesh(currentMeshId);
            const animationType = settings.animation?.type || 'none';
            const playbackSpeed = settings.playbackSpeed || 1.0;
            
            // Apply animation based on type
            if (animationType !== 'none' && !isPreviewAnimationPaused) {
                const rotationSpeed = 0.005 * playbackSpeed;
                const time = performance.now() * 0.001;
                
                // Get the geometry's orientation data
                const geometry = previewPlane.geometry;
                const hasOrientationData = geometry && geometry.userData && geometry.userData.normalVector;
                
                switch (animationType) {
                    case 'loop':
                        if (hasOrientationData) {
                            // For oriented meshes, animate in a way that respects the face orientation
                            const normalVector = geometry.userData.normalVector;
                            const upVector = geometry.userData.upVector;
                            
                            // Create a rotation axis perpendicular to the normal
                            const rightVector = new THREE.Vector3().crossVectors(normalVector, upVector).normalize();
                            
                            // Create a quaternion for small rotations
                            const wobbleAmount = 0.05; // Smaller angle for subtle effect
                            const wobbleQuaternion = new THREE.Quaternion().setFromAxisAngle(
                                rightVector,
                                Math.sin(time * rotationSpeed * 5) * wobbleAmount
                            );
                            
                            // Apply this rotation relative to the mesh's base orientation
                            const baseQuaternion = previewPlane._baseQuaternion || previewPlane.quaternion.clone();
                            previewPlane._baseQuaternion = baseQuaternion;
                            
                            // Combine the base orientation with the animation
                            previewPlane.quaternion.copy(baseQuaternion).multiply(wobbleQuaternion);
                        } else {
                            // Fallback for meshes without orientation data
                            previewPlane.rotation.y = Math.PI / 6 + Math.sin(time * rotationSpeed * 5) * 0.2;
                        }
                        break;
                    case 'bounce':
                        if (hasOrientationData) {
                            // For oriented meshes, bounce along the normal vector
                            const normalVector = geometry.userData.normalVector;
                            const bounceOffset = Math.sin(time * rotationSpeed * 3) * 0.1;
                            const bounceVector = normalVector.clone().multiplyScalar(bounceOffset);
                            
                            // Apply bounce to position
                            previewPlane.position.copy(bounceVector);
                        } else {
                            // Fallback bounce for non-oriented meshes
                            previewPlane.position.y = Math.sin(time * rotationSpeed * 3) * 0.1;
                        }
                        break;
                    case 'longExposure':
                        // For long exposure, we don't need to do anything here
                        // The static image is created once after pre-rendering
                        break;
                    default:
                        break;
                }
            }
        }
        
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);
        const settings = getHtmlSettingsForMesh(currentMeshId);
        const playbackSpeed = settings.playbackSpeed || 1.0;
        const animationType = settings.animation?.type || 'none';
        
        // Skip frame updates if animation is paused or we're in long exposure mode
        if (isPreviewAnimationPaused || animationType === 'longExposure') {
            // Still render the scene with the current frame
            if (animationPreviewRenderer && animationPreviewScene && animationPreviewCamera) {
                animationPreviewRenderer.render(animationPreviewScene, animationPreviewCamera);
            }
            return;
        }
        
        // Handle playback based on available frames and speed
        const currentTime = Date.now();
        const elapsedSinceStart = currentTime - originalAnimationStartTime;
        
        // If we're pre-rendering or have pre-rendered frames - now for ALL speeds
        if (preRenderingInProgress || preRenderedFrames.length > 0) {
            // Calculate adjusted time based on playback speed
            const adjustedTime = elapsedSinceStart * playbackSpeed;
            
            // For finite animations, we need to handle looping
            if (isAnimationFinite && animationDuration > 0 && preRenderedFrames.length > 0) {
                // Calculate the position within the animation based on animation type
                let loopPosition;
                
                // First, calculate the normalized time position (shared between loop and bounce)
                // This is how the loop animation has been calculating it
                const normalizedTime = (adjustedTime % animationDuration) / animationDuration;
                
                // Log cycle completion (shared between loop and bounce)
                const cycleCount = Math.floor(adjustedTime / animationDuration);
                if (cycleCount > 0 && normalizedTime < 0.05) {
                    console.log(`Cycle ${cycleCount} complete`);
                }
                
                // Group all animation type handling together
                switch (animationType) {
                    case 'loop':
                        // Loop just uses the normalized time directly
                        loopPosition = normalizedTime;
                        break;
                        
                    case 'bounce':
                        // For bounce, we need to determine if we're in a forward or backward cycle
                        // Even cycles (0, 2, 4...) play forward, odd cycles (1, 3, 5...) play backward
                        const isForwardCycle = (cycleCount % 2 === 0);
                        
                        if (isForwardCycle) {
                            // Forward playback - use normalized time directly
                            loopPosition = normalizedTime;
                        } else {
                            // Backward playback - invert the normalized time
                            loopPosition = 1 - normalizedTime;
                        }
                        break;
                        
                    default: // 'none' or any other type
                        // Check if we've reached the end of the animation
                        if (adjustedTime >= animationDuration) {
                            // If not looping or bouncing, stay on the last frame
                            if (!isPreviewAnimationPaused) {
                                console.log('Animation complete, pausing at last frame');
                                setIsPreviewAnimationPaused(true);
                                
                                // Show the last frame
                                updateMeshTexture(preRenderedFrames[preRenderedFrames.length - 1].texture);
                                
                                // Show a message that playback has ended
                                showStatus('Animation playback complete', 'info');
                            }
                            return; // Exit early to avoid further processing
                        } else {
                            // If not at the end yet, clamp to the current position
                            loopPosition = adjustedTime / animationDuration;
                        }
                        break;
                }
                
                // Calculate frame index based on loop position
                const frameIndex = Math.min(
                    Math.floor(loopPosition * preRenderedFrames.length),
                    preRenderedFrames.length - 1
                );
                
                // Use the pre-rendered frame at this position
                if (frameIndex >= 0 && frameIndex < preRenderedFrames.length) {
                    updateMeshTexture(preRenderedFrames[frameIndex].texture);
                }
            }
            // For non-finite animations or while still pre-rendering
            else {
                // Calculate what time we should be showing
                const targetTime = originalAnimationStartTime + adjustedTime;
                
                // Find the frame with timestamp closest to our target time
                let closestFrameIndex = -1;
                let smallestDifference = Infinity;
                
                // Use pre-rendered frames first
                const framesArray = preRenderedFrames.length > 0 ? preRenderedFrames : frameBuffer;
                
                for (let i = 0; i < framesArray.length; i++) {
                    const difference = Math.abs(framesArray[i].timestamp - targetTime);
                    if (difference < smallestDifference) {
                        smallestDifference = difference;
                        closestFrameIndex = i;
                    }
                }
                
                // If we have a valid frame, use it
                if (closestFrameIndex >= 0 && closestFrameIndex < framesArray.length) {
                    // Update texture with the appropriate frame
                    updateMeshTexture(framesArray[closestFrameIndex].texture);
                }
            }
        }
        // If no pre-rendered frames and not pre-rendering, log error
        else {
            console.error('No pre-rendered frames available and not pre-rendering');
        }
        
        // Render the scene - this is always done at the target framerate
        if (animationPreviewRenderer && animationPreviewScene && animationPreviewCamera) {
            animationPreviewRenderer.render(animationPreviewScene, animationPreviewCamera);
        }
    } catch (error) {
        console.error('Error in animation loop:', error);
        // Don't stop the animation loop for errors, just log them
    }
}

/**
 * Update the mesh texture with the given texture
 * @param {THREE.Texture} texture - The texture to apply to the mesh
 */
export function updateMeshTexture(texture) {
    if (!texture || !previewPlane || !previewPlane.material) return;
    
    let needsUpdate = false;
    
    if (Array.isArray(previewPlane.material)) {
        previewPlane.material.forEach(material => {
            if (material.map !== texture) {
                material.map = texture;
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            previewPlane.material.forEach(material => {
                material.needsUpdate = true;
            });
        }
    } else {
        if (previewPlane.material.map !== texture) {
            previewPlane.material.map = texture;
            previewPlane.material.needsUpdate = true;
        }
    }
}
