import * as THREE from 'three';
import { createTextureFromIframe } from './texture-util';
import { showStatus } from '../ui/scripts/html-editor-modal';
import { animationDuration, isAnimationFinite, preRenderedFrames, preRenderingInProgress, resetPreRender, startPreRendering } from './animation-util';
import { sanitizeHtml } from './string-serder';
import { getState } from './state';

// Add variables for CSS3D rendering
let css3dScene, css3dRenderer, css3dObject;
let webglRenderer;
// Three.js variables for preview
let previewScene, previewCamera, previewRenderer;
let previewAnimationId = null;
let isPreviewAnimationPaused = false;
let lastTextureUpdateTime = 0;
let pendingTextureUpdate = false;
// Add at the top of the file, with other variables
let lastFrameTime = 0;
const targetFrameRate = 60; // Target 60 FPS for better performance/animation balance
const frameInterval = 1000 / targetFrameRate;
// Info panel state variables
let infoPanel = null;
let infoPanelCollapsed = false;
let infoPanelPosition = { x: 10, y: 10 }; // Default position in top-left corner

// Add variables for frame buffering at the top of the file with other variables
export let maxCaptureRate = 0.5; // Reduce to 0.5ms between captures for more frames (was 1)
export let originalAnimationStartTime = 0;
export let frameBuffer = [];
export let previewRenderTarget = null;
export let isPreviewActive = false; // Track if preview is currently active
export let previewPlane;

/**
 * Initialize Three.js for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
function initThreeJsPreview(container, iframe, currentMeshId, createInfoPanel = true) {
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
 * Set up the Three.js scene for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
function setupThreeJsScene(container, iframe, currentMeshId, createInfoPanel = true) {
    try {
        // Create scene with dark gray background
        previewScene = new THREE.Scene();
        previewScene.background = new THREE.Color(0x303030); // Dark gray background like Unreal Editor
        
        // Create camera
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        // Use perspective camera for better 3D viewing
        previewCamera = new THREE.PerspectiveCamera(
            60, containerAspectRatio, 0.1, 1000
        );
        previewCamera.position.z = 3;
        
        // Create renderer with enhanced quality settings
        previewRenderer = new THREE.WebGLRenderer({ 
            antialias: true,
            preserveDrawingBuffer: true // Preserve the buffer for screenshots
        });
        previewRenderer.setSize(containerWidth, containerHeight);
        previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
        previewRenderer.setClearColor(0x303030); // Set clear color to dark gray
        previewRenderer.outputEncoding = THREE.sRGBEncoding; // Use sRGB encoding for better color accuracy
        
        // Performance optimizations
        previewRenderer.shadowMap.enabled = false; // Disable shadows for performance
        
        // Ensure the renderer canvas fits perfectly in the container
        const rendererCanvas = previewRenderer.domElement;
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
            previewScene.add(previewPlane);
            
            // Position the camera to look at the dominant face of the mesh
            if (geometry.userData && geometry.userData.normalVector) {
                const normalVector = geometry.userData.normalVector;
                const upVector = geometry.userData.upVector;
                const dominantPlane = geometry.userData.dominantPlane;
                
                // Position camera along the normal vector for optimal viewing
                const cameraPosition = normalVector.clone().multiplyScalar(2); // Closer view (was 3)
                previewCamera.position.copy(cameraPosition);
                
                // Look at the center of the mesh
                previewCamera.lookAt(0, 0, 0);
                
                // Ensure the camera's "up" direction aligns with our computed up vector
                previewCamera.up.copy(upVector);
                
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
                    previewCamera.position.set(0, 0, 3);
                    previewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, 0, 0);
                } else if (dominantPlane === 'xz') {
                    // Position camera to look at the XZ plane
                    previewCamera.position.set(0, 3, 0);
                    previewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(-Math.PI/2, 0, 0);
                } else { // yz
                    // Position camera to look at the YZ plane
                    previewCamera.position.set(3, 0, 0);
                    previewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, Math.PI/2, 0);
                }
                
                console.log(`Camera positioned to view the ${dominantPlane} plane`);
            } else {
                // Default position if no dominant plane was determined
                previewCamera.position.z = 3;
                
                // Set initial rotation but don't animate it
                previewPlane.rotation.x = Math.PI / 10;
                previewPlane.rotation.y = Math.PI / 6;
            }
            
            // Add orbit controls for better user interaction
            setupOrbitControls(previewCamera, previewRenderer.domElement)
                .then(controls => {
                    // Start animation loop after controls are set up
                    animatePreview();
                    
                    // Show helpful message about keyboard shortcuts
                    showStatus('Preview ready. Use +/- keys to zoom in/out', 'success');
                    
                    // Add keyboard shortcuts for zooming
                    const handleKeydown = (event) => {
                        if (!isPreviewActive) return;
                        
                        // Get current controls - they should be attached to the camera by this point
                        const controls = previewCamera.userData.controls;
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
                    previewCamera.userData.keyHandler = handleKeydown;
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
 * Initialize CSS3D renderer for HTML preview
 * @param {HTMLElement} container - The container element for the renderers
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
function initCSS3DPreview(container, iframe, currentMeshId, createInfoPanel = true) {
    try {
        // Directly import Three.js CSS3D renderer
        import('three/examples/jsm/renderers/CSS3DRenderer.js')
            .then(module => {
                const { CSS3DRenderer, CSS3DObject } = module;

                // Now that we have the correct classes, set up the CSS3D scene
                setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject, currentMeshId, createInfoPanel);
            })
            .catch(error => {
                console.error('Error loading CSS3DRenderer:', error);
                // Use console.error instead of logPreviewError
                console.error('CSS3D initialization error:', error.message);

                // Fallback to texture-based preview
                showStatus('CSS3D renderer not available, falling back to texture-based preview', 'warning');
                initThreeJsPreview(container, iframe, currentMeshId, createInfoPanel);
            });
    } catch (error) {
        console.error('Error in initCSS3DPreview:', error);
        // Use console.error instead of logPreviewError
        console.error('CSS3D initialization error:', error.message);

        // Fallback to texture-based preview
        showStatus('Error initializing CSS3D preview, falling back to texture-based preview', 'error');
        initThreeJsPreview(container, iframe, currentMeshId, createInfoPanel);
    }
}

/**
 * Clean up Three.js resources
 */
export function cleanupThreeJsPreview() {
    // Mark preview as inactive to stop animation loop first
    isPreviewActive = false;
    
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
        if (css3dScene) {
            // Remove all objects from the scene
            while (css3dScene.children.length > 0) {
                const object = css3dScene.children[0];
                css3dScene.remove(object);
                
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
            css3dScene = null;
        }
        
        css3dObject = null;
        
        if (css3dRenderer) {
            if (css3dRenderer.domElement && css3dRenderer.domElement.parentElement) {
                css3dRenderer.domElement.parentElement.removeChild(css3dRenderer.domElement);
            }
            css3dRenderer = null;
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
            if (previewScene) previewScene.remove(previewPlane);
            previewPlane = null;
        }
        
        if (previewScene) {
            // Clean up any other objects in the scene
            if (previewScene.children) {
                while (previewScene.children.length > 0) {
                    const object = previewScene.children[0];
                    previewScene.remove(object);
                    
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
            previewScene = null;
        }
    } catch (e) {
        console.log('Three.js scene cleanup error (non-critical):', e);
    }
    
    previewCamera = null;
    
    try {
        if (previewRenderer) {
            previewRenderer.dispose();
            if (previewRenderer.domElement && previewRenderer.domElement.parentElement) {
                previewRenderer.domElement.parentElement.removeChild(previewRenderer.domElement);
            }
            previewRenderer = null;
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
    isPreviewAnimationPaused = false;
    lastTextureUpdateTime = 0;
    pendingTextureUpdate = false;
    lastFrameTime = 0;
    
    // Clean up keyboard event handlers
    if (previewCamera && previewCamera.userData && previewCamera.userData.keyHandler) {
        document.removeEventListener('keydown', previewCamera.userData.keyHandler);
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
        infoPanel = null;
    }
}

function setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject, currentMeshId, createInfoPanel = true) {
    try {
        console.log('Setting up CSS3D scene with container:', container);

        // Clear any existing content
        container.innerHTML = '';

        // Basic variables
        const userHtml = document.getElementById('html-editor-textarea').value || '';

        // Panel size - use a single panel instead of a cube
        const panelWidth = 500;
        const panelHeight = 400;

        // Setup camera with proper distance to see the panel
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
        camera.position.set(0, 0, 700); // Position to see panel straight on

        // Create CSS3D scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x303030); // Dark gray background like Unreal Editor

        // Create CSS3D renderer
        const renderer = new CSS3DRenderer();
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        container.appendChild(renderer.domElement);
        infoPanel
        // Create info panel if requested
        if (createInfoPanel) {
            createMeshInfoPanel(container, currentMeshId);
        }

        // Get settings for this mesh
        const settings = getHtmlSettingsForMesh(currentMeshId);
        const playbackSpeed = settings.playbackSpeed || 1.0;

        // Function to create HTML content - simplified to avoid layout warnings
        const wrapContent = (content) => {
            return `<!DOCTYPE html>
<html>
<head>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            box-sizing: border-box;
        }
        body {
            background-color: white;
            color: #333;
            font-family: Arial, sans-serif;
            padding: 10px;
            display: flex;
            flex-direction: column;
        }
        .panel-title {
            background: #f0f0f0;
            padding: 5px;
            margin-bottom: 10px;
            text-align: center;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            font-size: 14px;
            flex-shrink: 0;
        }
        .content {
            flex: 1;
            overflow: hidden;
            padding: 5px;
            position: relative;
            width: calc(100% - 10px);
        }
        
        /* Add a border if enabled */
        ${window.showPreviewBorders ?
                    `body { border: 5px solid #3498db; }` :
                    ''}
            
        /* Control animation speed - apply to all animations */
        * {
            animation-duration: ${1.0 / playbackSpeed}s !important;
            transition-duration: ${1.0 / playbackSpeed}s !important;
        }
        
        /* Ensure content doesn't overflow */
        .content > * {
            max-width: 100%;
            box-sizing: border-box;
        }
        
        /* Override any styles that might cause horizontal scrollbars */
        .content div, .content p, .content span, .content img {
            max-width: 100%;
        }
    </style>
</head>
<body>
    <div class="panel-title">HTML Preview</div>
    <div class="content">${content}</div>
</body>
</html>`;
        };

        // Create a DOM container to hold the iframe temporarily
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px'; // Off-screen
        tempContainer.style.top = '0';
        tempContainer.style.zIndex = '-1'; // Behind everything
        tempContainer.style.opacity = '0.01'; // Almost invisible, but still rendered
        tempContainer.style.pointerEvents = 'none'; // Don't interact with user input
        document.body.appendChild(tempContainer);

        // Create a single iframe for the panel
        const element = document.createElement('iframe');
        element.id = 'css3d-panel-iframe';
        element.style.width = `${panelWidth}px`;
        element.style.height = `${panelHeight}px`;
        element.style.border = 'none'; // Remove border - we'll add it in the content if needed
        element.style.borderRadius = '5px';
        element.style.backgroundColor = 'white';
        element.style.overflow = 'hidden'; // Prevent scrollbars
        element.style.boxSizing = 'border-box';

        // Add the iframe to DOM first
        tempContainer.appendChild(element);

        // Create a CSS3D object with the iframe
        const object = new CSS3DObject(element);

        // Add to scene
        scene.add(object);

        // Store references for cleanup
        css3dScene = scene;
        css3dRenderer = renderer;
        previewCamera = camera;

        // Store for replay
        previewRenderTarget = element;
        css3dObject = object;

        // Write content to the iframe after a brief delay
        setTimeout(() => {
            try {
                if (element.contentDocument) {
                    element.contentDocument.open();
                    element.contentDocument.write(wrapContent(userHtml));
                    element.contentDocument.close();
                }
            } catch (err) {
                console.error('Error writing content to iframe:', err);
            }
        }, 50);

        // Set up OrbitControls
        import('three/examples/jsm/controls/OrbitControls.js').then(module => {
            const { OrbitControls } = module;

            // Create controls
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.2;
            controls.rotateSpeed = 0.5;
            controls.minDistance = 100;   // CSS3D needs larger distances
            controls.maxDistance = 2000;
            controls.zoomSpeed = 1.2;

            // Initial look at origin
            camera.lookAt(0, 0, 0);

            // Animation loop
            function animate() {
                if (!isPreviewActive) {
                    return;
                }

                requestAnimationFrame(animate);

                // Update controls
                controls.update();

                // Render scene
                renderer.render(scene, camera);
            }

            // Start animation loop
            animate();

            // Show success status
            showStatus('CSS3D preview ready. Use +/- keys to zoom in/out', 'success');

            // Add keyboard shortcuts for zooming
            const handleKeydown = (event) => {
                if (!isPreviewActive) return;

                // Get current controls - they should be attached to the camera by this point
                const controls = previewCamera.userData.controls;
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
            previewCamera.userData.keyHandler = handleKeydown;
        }).catch(error => {
            console.error('Error loading OrbitControls:', error);
            showStatus('Error loading 3D controls: ' + error.message, 'error');
            return false;
        });

        // Success
        return true;
    } catch (error) {
        console.error('Error in setupCSS3DScene:', error);
        showStatus('Error creating 3D view: ' + error.message, 'error');
        return false;
    }
}

/**
 * Initialize the preview based on the selected mode
 * @param {string} previewMode - The preview mode (threejs or css3d)
 * @param {HTMLElement} canvasContainer - The container for the preview
 * @param {HTMLIFrameElement} renderIframe - The iframe containing the HTML content
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} startAnimation - Whether to start the animation immediately
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
function initializePreview(previewMode, canvasContainer, renderIframe, currentMeshId, startAnimation = true, createInfoPanel = true) {
    // Get animation type
    const animationTypeSelect = document.getElementById('html-animation-type');
    const animationType = animationTypeSelect ? animationTypeSelect.value : 'none';

    // Remove the special case for long exposure that immediately pauses animation
    // For long exposure, we want to see the actual animation

    // If not starting animation immediately, pause it
    if (!startAnimation) {
        isPreviewAnimationPaused = true;
    }

    // Initialize preview based on mode
    if (previewMode === 'css3d') {
        showStatus('Initializing CSS3D preview mode...', 'info');
        // Get the iframe that may have been created earlier, or create a new one if needed
        const directPreviewIframe = document.createElement('iframe');
        initCSS3DPreview(canvasContainer, directPreviewIframe.cloneNode(true), currentMeshId, createInfoPanel);
    } else {
        // Default to threejs mode
        showStatus('Initializing 3D cube preview...', 'info');
        initThreeJsPreview(canvasContainer, renderIframe, currentMeshId, createInfoPanel);
    }
}

/**
 * Preview HTML code using Three.js
 * @param {string} html - The HTML code to preview
 */
export function previewHtml(html) {
    const previewContent = document.getElementById('html-preview-content');
    if (!previewContent) return;

    try {
        // Get current mesh ID from the modal
        const modal = document.getElementById('html-editor-modal');
        const currentMeshId = parseInt(modal.dataset.meshId);

        // Get preview mode from render type dropdown
        const renderTypeSelect = document.getElementById('html-render-type');
        let previewMode = renderTypeSelect ? renderTypeSelect.value : 'threejs';

        // Get playback speed from dropdown
        const playbackSpeedSelect = document.getElementById('html-playback-speed');
        const playbackSpeed = playbackSpeedSelect ? parseFloat(playbackSpeedSelect.value) : 1.0;

        // Get animation type from dropdown
        const animationTypeSelect = document.getElementById('html-animation-type');
        const animationType = animationTypeSelect ? animationTypeSelect.value : 'none';

        // For long exposure, set a flag to indicate we should create the long exposure immediately
        // This prevents showing the first frame before the long exposure
        const isLongExposureMode = animationType === 'longExposure';
        window.createLongExposureImmediately = isLongExposureMode;

        resetPreRender();

        // Store the preview mode in the modal dataset for access elsewhere
        modal.dataset.previewMode = previewMode;

        // Always do a full cleanup for a new preview
        console.log('Cleaning up previous preview');
        // Clean up any existing preview
        cleanupThreeJsPreview();

        // Clear the preview container
        previewContent.innerHTML = '';

        // Set preview as active
        isPreviewActive = true;

        // The sanitizeHtml function handles wrapping fragments if needed
        const sanitizedHtml = sanitizeHtml(html);

        // Create a hidden iframe for rendering HTML to texture (if needed)
        const renderIframe = document.createElement('iframe');
        renderIframe.id = 'html-render-iframe';
        renderIframe.style.width = '960px';
        renderIframe.style.height = '540px';
        renderIframe.style.position = 'absolute';
        renderIframe.style.left = '-9999px';
        renderIframe.style.top = '0';
        renderIframe.style.border = 'none';
        renderIframe.style.backgroundColor = 'transparent';
        document.body.appendChild(renderIframe);

        // Store reference to the iframe
        previewRenderTarget = renderIframe;

        // Make sure the preview content container has proper positioning for absolute children
        previewContent.style.position = 'relative';
        previewContent.style.minHeight = '400px';
        previewContent.style.height = '100%';

        // Always pre-render for all speeds
        const needsPreRendering = true;

        // For long exposure, show a different status message
        if (isLongExposureMode) {
            showStatus('Pre-rendering animation for long exposure capture...', 'info');
        } else {
            showStatus('Pre-rendering animation for smooth playback...', 'info');
        }

        // Wait for iframe to be ready
        renderIframe.onload = () => {
            // Only proceed if preview is still active
            if (!isPreviewActive) return;

            // Create container for Three.js canvas
            const canvasContainer = document.createElement('div');
            canvasContainer.style.width = '100%';
            canvasContainer.style.height = '100%';
            canvasContainer.style.position = 'absolute';
            canvasContainer.style.top = '0';
            canvasContainer.style.left = '0';
            canvasContainer.style.right = '0';
            canvasContainer.style.bottom = '0';
            canvasContainer.style.overflow = 'hidden';
            canvasContainer.style.display = 'block'; // Always display since 'direct' mode is removed
            previewContent.appendChild(canvasContainer);

            // Add error log container
            const errorLog = document.createElement('div');
            errorLog.id = 'html-preview-error-log';
            errorLog.className = 'preview-error-log';
            errorLog.style.display = 'none';
            previewContent.appendChild(errorLog);

            // Add a loading overlay that matches the loading-splash.html style
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'pre-rendering-overlay';
            loadingOverlay.className = 'loading-splash';
            loadingOverlay.style.position = 'absolute';
            loadingOverlay.style.top = '0';
            loadingOverlay.style.left = '0';
            loadingOverlay.style.width = '100%';
            loadingOverlay.style.height = '100%';
            loadingOverlay.style.backgroundColor = '#000000'; // Solid black background
            loadingOverlay.style.zIndex = '1000';

            // Remove any border/outline that might be causing green lines
            loadingOverlay.style.border = 'none';
            loadingOverlay.style.outline = 'none';
            loadingOverlay.style.boxShadow = 'none';

            // Create content container similar to loading-splash.html
            const loadingContent = document.createElement('div');
            loadingContent.className = 'loading-content';
            loadingContent.style.display = 'flex';
            loadingContent.style.flexDirection = 'column';
            loadingContent.style.alignItems = 'center';
            loadingContent.style.justifyContent = 'center';
            loadingContent.style.height = '100%';
            loadingContent.style.width = '100%';
            loadingContent.style.backgroundColor = '#000000'; // Ensure content background is also black

            // Create title
            const loadingTitle = document.createElement('h2');
            loadingTitle.className = 'loading-title';
            loadingTitle.textContent = 'PRE-RENDERING';
            loadingTitle.style.color = 'white';
            loadingTitle.style.margin = '0 0 20px 0';

            // Create spinner container
            const spinnerContainer = document.createElement('div');
            spinnerContainer.className = 'loading-spinner-container';

            // Create atomic spinner
            const atomicSpinner = document.createElement('div');
            atomicSpinner.className = 'atomic-spinner';

            // Create nucleus
            const nucleus = document.createElement('div');
            nucleus.className = 'nucleus';
            atomicSpinner.appendChild(nucleus);

            // Create electron orbits (3)
            for (let i = 0; i < 3; i++) {
                const orbit = document.createElement('div');
                orbit.className = 'electron-orbit';

                const electron = document.createElement('div');
                electron.className = 'electron';

                orbit.appendChild(electron);
                atomicSpinner.appendChild(orbit);
            }

            spinnerContainer.appendChild(atomicSpinner);

            // Create progress text
            const progressText = document.createElement('div');
            progressText.id = 'loading-progress-text';
            progressText.className = 'loading-progress-text';
            progressText.textContent = 'Pre-rendering animation...';
            progressText.style.color = 'white';
            progressText.style.marginTop = '20px';

            // Create progress bar
            const progressContainer = document.createElement('div');
            progressContainer.style.width = '80%';
            progressContainer.style.height = '4px';
            progressContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            progressContainer.style.borderRadius = '2px';
            progressContainer.style.overflow = 'hidden';
            progressContainer.style.marginTop = '10px';

            const progressBar = document.createElement('div');
            progressBar.id = 'pre-rendering-progress';
            progressBar.style.width = '0%';
            progressBar.style.height = '100%';
            progressBar.style.backgroundColor = '#3498db';
            progressBar.style.transition = 'width 0.3s ease-out'; // Smoother transition

            progressContainer.appendChild(progressBar);

            // Assemble the loading overlay
            loadingContent.appendChild(loadingTitle);
            loadingContent.appendChild(spinnerContainer);
            loadingContent.appendChild(progressText);
            loadingContent.appendChild(progressContainer);
            loadingOverlay.appendChild(loadingContent);
            canvasContainer.appendChild(loadingOverlay);

            // Initialize the preview first, but don't start animation yet
            // Pass false for createInfoPanel to prevent creating the info panel until pre-rendering is complete
            initializePreview(previewMode, canvasContainer, renderIframe, currentMeshId, false, false);

            // Start pre-rendering with a callback for when it's done
            startPreRendering(renderIframe, () => {
                // The callback is now called from the final animation completion
                console.log('Pre-rendering complete callback executed');
            }, progressBar);
        };

        // Write content to iframe
        try {
            renderIframe.srcdoc = sanitizedHtml;
        } catch (error) {
            console.error('Error setting iframe srcdoc:', error);
            // Fallback method
            renderIframe.contentDocument.open();
            renderIframe.contentDocument.write(sanitizedHtml);
            renderIframe.contentDocument.close();
        }
    } catch (error) {
        logPreviewError(`Preview error: ${error.message}`);
        console.error('HTML Preview error:', error);
        showStatus('Error generating preview: ' + error.message, 'error');
    }
}

/**
 * Handle window resize for the Three.js preview
 */
function onPreviewResize() {
    const container = previewRenderer.domElement.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Update camera aspect ratio
    if (previewCamera) {
        previewCamera.aspect = containerWidth / containerHeight;
        previewCamera.updateProjectionMatrix();
    }
    
    // Update renderer
    previewRenderer.setSize(containerWidth, containerHeight);
}

/**
 * Log errors to the preview error console
 * @param {string} message - Error message to display
 */
function logPreviewError(message) {
    const errorLog = document.getElementById('html-preview-error-log') || 
                     document.createElement('div');
    
    if (!errorLog.id) {
        errorLog.id = 'html-preview-error-log';
        errorLog.className = 'preview-error-log';
        
        const previewContent = document.getElementById('html-preview-content');
        if (previewContent) {
            previewContent.appendChild(errorLog);
        }
    }
    
    // Make error log visible
    errorLog.style.display = 'block';
    
    // Create error entry
    const errorEntry = document.createElement('div');
    errorEntry.className = 'error-entry';
    errorEntry.textContent = message;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'error-time';
    timeSpan.textContent = `[${timestamp}] `;
    errorEntry.prepend(timeSpan);
    
    // Add to log
    errorLog.appendChild(errorEntry);
    
    // Show the error in the editor status as well
    showStatus(message, 'error');
    
    console.error(message);
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
        const elapsed = now - lastFrameTime;
        
        if (elapsed < frameInterval) {
            return; // Skip rendering this frame if we're ahead of schedule
        }
        
        // Calculate actual FPS for monitoring (once per second)
        if (now - lastFrameTime > 1000) {
            console.log(`Current framerate: ${Math.round(1000 / elapsed)} FPS`);
        }
        
        // Remember last frame time for throttling
        lastFrameTime = now - (elapsed % frameInterval);
        
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
            if (previewRenderer && previewScene && previewCamera) {
                previewRenderer.render(previewScene, previewCamera);
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
                                isPreviewAnimationPaused = true;
                                
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
        if (previewRenderer && previewScene && previewCamera) {
            previewRenderer.render(previewScene, previewCamera);
        }
    } catch (error) {
        console.error('Error in animation loop:', error);
        // Don't stop the animation loop for errors, just log them
    }
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
 * Set the isPreviewAnimationPaused flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsPreviewAnimationPaused(incomingValue) {
    isPreviewAnimationPaused = incomingValue;
}

/**
 * Set the lastTextureUpdateTime
 * @param {number} incomingValue - The new value to set
 */
export function setLastTextureUpdateTime(incomingValue) {
    lastTextureUpdateTime = incomingValue;
}


/**
 * Create a collapsible info panel for the preview that shows mesh details
 * This panel is similar to the axis indicator and can be collapsed/expanded
 * and dragged around the preview area. It shows detailed information about
 * the mesh being previewed including geometry, materials, and transform data.
 * 
 * @param {HTMLElement} container - The container to add the info panel to
 * @param {number} meshId - The ID of the mesh being previewed
 * @returns {HTMLElement} The created info panel element
 */
export function createMeshInfoPanel(container, meshId) {
    // Remove any existing info panel
    if (infoPanel) {
        try {
            if (infoPanel.parentNode) {
                infoPanel.parentNode.removeChild(infoPanel);
            }
        } catch (e) {
            console.log('Error removing existing info panel:', e);
        }
        infoPanel = null;
    }
    
    // Get mesh data from state
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        console.warn(`No mesh data found for mesh ID ${meshId}`);
        return;
    }
    
    // Create the info panel container
    const panel = document.createElement('div');
    panel.id = 'preview-info-panel';
    panel.style.position = 'absolute';
    panel.style.zIndex = '900'; // Lower z-index than the loading overlay (1000)
    panel.style.pointerEvents = 'auto';
    panel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    panel.style.border = '1px solid rgba(50, 50, 50, 0.7)';
    panel.style.borderRadius = '5px';
    panel.style.overflow = 'hidden';
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    panel.style.width = '250px';
    panel.style.left = `${infoPanelPosition.x}px`;
    panel.style.top = `${infoPanelPosition.y}px`;
    
    // Create the header
    const header = document.createElement('div');
    header.id = 'preview-info-header';
    header.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
    header.style.color = 'white';
    header.style.padding = '5px 10px';
    header.style.cursor = 'grab';
    header.style.userSelect = 'none';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.width = '100%';
    header.style.boxSizing = 'border-box';
    
    // Add title
    const title = document.createElement('span');
    title.textContent = 'Mesh Info';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '12px';
    
    // Add collapse/expand button
    const collapseBtn = document.createElement('span');
    collapseBtn.textContent = infoPanelCollapsed ? '▼' : '▲';
    collapseBtn.style.fontSize = '12px';
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.style.marginLeft = '10px';
    collapseBtn.style.width = '15px';
    collapseBtn.style.textAlign = 'center';
    
    // Add elements to header
    header.appendChild(title);
    header.appendChild(collapseBtn);
    
    // Create content container
    const content = document.createElement('div');
    content.id = 'preview-info-content';
    content.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
    content.style.color = 'white';
    content.style.padding = '10px';
    content.style.fontSize = '12px';
    content.style.display = infoPanelCollapsed ? 'none' : 'block';
    content.style.maxHeight = '300px';
    content.style.overflowY = 'auto';
    
    // Gather mesh information
    const info = [];
    
    // Basic mesh info
    info.push(`<strong>Name:</strong> ${mesh.name || 'Unnamed'}`);
    info.push(`<strong>ID:</strong> ${meshId}`);
    
    // Geometry details
    if (mesh.geometry) {
        info.push('<strong>Geometry:</strong>');
        
        // Vertices count
        const vertexCount = mesh.geometry.attributes && mesh.geometry.attributes.position ? 
            mesh.geometry.attributes.position.count : 'Unknown';
        info.push(`• Vertices: ${vertexCount}`);
        
        // Faces count (triangles)
        let faceCount = 'Unknown';
        if (mesh.geometry.index) {
            faceCount = Math.floor(mesh.geometry.index.count / 3);
        } else if (mesh.geometry.attributes && mesh.geometry.attributes.position) {
            faceCount = Math.floor(mesh.geometry.attributes.position.count / 3);
        }
        info.push(`• Faces: ${faceCount}`);
        
        // Geometry type
        info.push(`• Type: ${mesh.geometry.type || 'Unknown'}`);
    }
    
    // Material details
    if (mesh.material) {
        info.push('<strong>Material:</strong>');
        
        // Handle multiple materials
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        info.push(`• Count: ${materials.length}`);
        
        // Material properties
        materials.forEach((material, index) => {
            if (materials.length > 1) {
                info.push(`• Material ${index + 1}:`);
            }
            
            info.push(`  • Type: ${material.type || 'Unknown'}`);
            info.push(`  • Double Sided: ${material.side === THREE.DoubleSide ? 'Yes' : 'No'}`);
            info.push(`  • Transparent: ${material.transparent ? 'Yes' : 'No'}`);
            
            // Color if available
            if (material.color) {
                const colorHex = '#' + material.color.getHexString();
                info.push(`  • Color: <span style="color:${colorHex}">■</span> ${colorHex}`);
            }
        });
    }
    
    // Transform information
    info.push('<strong>Transform:</strong>');
    info.push(`• Position: X:${mesh.position.x.toFixed(2)}, Y:${mesh.position.y.toFixed(2)}, Z:${mesh.position.z.toFixed(2)}`);
    info.push(`• Rotation: X:${(mesh.rotation.x * 180 / Math.PI).toFixed(2)}°, Y:${(mesh.rotation.y * 180 / Math.PI).toFixed(2)}°, Z:${(mesh.rotation.z * 180 / Math.PI).toFixed(2)}°`);
    info.push(`• Scale: X:${mesh.scale.x.toFixed(2)}, Y:${mesh.scale.y.toFixed(2)}, Z:${mesh.scale.z.toFixed(2)}`);
    
    // HTML settings
    const htmlSettings = getHtmlSettingsForMesh(meshId);
    if (htmlSettings) {
        info.push('<strong>HTML Settings:</strong>');
        info.push(`• Render Mode: ${htmlSettings.previewMode || 'threejs'}`);
        info.push(`• Playback Speed: ${htmlSettings.playbackSpeed || '1.0'}`);
        info.push(`• Animation: ${htmlSettings.animation?.type || 'none'}`);
    }
    
    // Add any custom user data
    if (mesh.userData && Object.keys(mesh.userData).length > 0) {
        info.push('<strong>Custom Data:</strong>');
        
        // Filter out htmlSettings which we already displayed
        const userDataKeys = Object.keys(mesh.userData).filter(key => key !== 'htmlSettings');
        
        if (userDataKeys.length > 0) {
            userDataKeys.forEach(key => {
                const value = mesh.userData[key];
                info.push(`• ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
            });
        } else {
            info.push('• No custom data');
        }
    }
    
    // Add content to the panel
    content.innerHTML = info.join('<br>');
    
    // Add header and content to panel
    panel.appendChild(header);
    panel.appendChild(content);
    
    // Add to container
    container.appendChild(panel);
    
    // Store reference
    infoPanel = panel;
    
    // Add collapse functionality
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering drag
        infoPanelCollapsed = !infoPanelCollapsed;
        collapseBtn.textContent = infoPanelCollapsed ? '▼' : '▲';
        content.style.display = infoPanelCollapsed ? 'none' : 'block';
        updatePanelHeight();
    });
    
    // Function to update panel height
    function updatePanelHeight() {
        if (infoPanelCollapsed) {
            panel.style.height = `${header.offsetHeight}px`;
        } else {
            panel.style.height = 'auto';
        }
    }
    
    // Call once to set initial height
    updatePanelHeight();
    
    // Make the header draggable
    let isHeaderDragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        isHeaderDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(panel.style.left);
        startTop = parseInt(panel.style.top);
        header.style.cursor = 'grabbing';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isHeaderDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const newLeft = startLeft + dx;
        const newTop = startTop + dy;
        
        // Get current container dimensions
        const containerRect = container.getBoundingClientRect();
        const maxLeft = containerRect.width - panel.offsetWidth;
        const maxTop = containerRect.height - panel.offsetHeight;
        
        const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
        const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
        
        panel.style.left = `${constrainedLeft}px`;
        panel.style.top = `${constrainedTop}px`;
        
        // Update stored position
        infoPanelPosition.x = constrainedLeft;
        infoPanelPosition.y = constrainedTop;
    });
    
    document.addEventListener('mouseup', () => {
        if (isHeaderDragging) {
            isHeaderDragging = false;
            header.style.cursor = 'grab';
        }
    });
    
    return panel;
}

/**
 * Set the original animation start time
 * @param {number} incomingValue - The new value to set
 */
export function setOriginalAnimationStartTime(incomingValue) {
    originalAnimationStartTime = incomingValue;
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