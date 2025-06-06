import * as THREE from 'three';
import { animatePreview, previewAnimationId, resetLastAnimationFrameTime, resetPreviewAnimationId } from './preview-util';
import { 
    getIsPreviewActive, 
    setIsPreviewActive, 
    setIsPreviewAnimationPaused, 
    setLastTextureUpdateTime,
    getIsPreviewAnimationPaused
} from './animation-util';
import { getState } from '../../scene/state';
import { showStatus } from '../../modals/html-editor-modal/html-editor-modal';
import { createMeshInfoPanel, infoPanel, resetInfoPanel } from '../../modals/html-editor-modal/mesh-info-panel-util';
import { createTextureFromIframe } from './html2canvas-util';

let pendingTextureUpdate = false;
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
                        if (!getIsPreviewActive()) return;
                        
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
    
    // Clean up CSS3D preview timers
    // Import and call cleanupCSS3D to stop any animation restart timers
    import('../css3d/css3d-animation-util.js').then(module => {
        if (typeof module.cleanupCSS3D === 'function') {
            module.cleanupCSS3D();
        }
    }).catch(err => {
        console.log('Failed to clean up CSS3D restart timers:', err);
    });
    
    // Clean up info panel
    cleanupInfoPanel();
    
    // Clear pending update operations and animation frames first
    if (pendingTextureUpdate) {
        pendingTextureUpdate = false;
    }
    
    if (previewAnimationId !== null) {
        cancelAnimationFrame(previewAnimationId);
        resetPreviewAnimationId();
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
    resetLastAnimationFrameTime();
    
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
 * Set aniamtion css 3d scene
 * @param {THREE.Scene} incomingValue - The new value to set
 */
export function setAnimationCss3dScene(incomingValue) {
    animationCss3dScene = incomingValue;
}

/**
 * Set animation css 3d renderer
 * @param {THREE.WebGLRenderer} incomingValue - The new value to set
 */
export function setAnimationCss3dRenderer(incomingValue) {
    animationCss3dRenderer = incomingValue;
}

/**
 * Set animation css 3d object
 * @param {THREE.Object3D} incomingValue - The new value to set
 */
export function setAnimationCss3dObject(incomingValue) {
    animationCss3dObject = incomingValue;
}

