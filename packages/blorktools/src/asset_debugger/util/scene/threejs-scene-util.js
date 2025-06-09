import * as THREE from 'three';
import { 
    animationPreviewCamera,
    animationPreviewRenderer,
    animationPreviewScene,
    previewPlane, 
    setAnimationPreviewCamera, 
    setAnimationPreviewRenderer, 
    setAnimationPreviewScene, 
    setPreviewPlane, 
    setPreviewRenderTarget
} from "../state/threejs-state";
import { showStatus } from '../../modals/html-editor-modal/html-editor-modal';
import { createMeshInfoPanel } from '../../modals/html-editor-modal/mesh-info-panel-util';
import { createTextureFromIframe } from '../animation/render/iframe2texture-render';
import { getState } from '../../scene/state';
import { animatePreview } from '../preview/animation-preview-util';
import { setIsPreviewActive } from '../state/animation-state';

/**
 * Set up the Three.js scene for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
export function setupThreeJsScene(container, iframe, currentMeshId, createInfoPanel = true) {
    try {
        // Create scene with dark gray background
        setAnimationPreviewScene(new THREE.Scene());
        animationPreviewScene.background = new THREE.Color(0x303030); // Dark gray background like Unreal Editor
        
        // Create camera
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        // Use perspective camera for better 3D viewing
        setAnimationPreviewCamera(new THREE.PerspectiveCamera(
            60, containerAspectRatio, 0.1, 1000
        ));
        animationPreviewCamera.position.z = 3;
        
        // Create renderer with enhanced quality settings
        setAnimationPreviewRenderer(new THREE.WebGLRenderer({ 
            antialias: true,
            preserveDrawingBuffer: true // Preserve the buffer for screenshots
        }));
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
        setPreviewRenderTarget(iframe);
        
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
            setPreviewPlane(new THREE.Mesh(geometry, material));
            
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
    } catch (error) {
        console.error('Error setting up Three.js scene:', error);
        showStatus('Error in Three.js scene setup: ' + error.message, 'error');
    }
}

/**
 * Clean up all Three.js resources for a given scene configuration
 * @param {Object} config - Configuration object containing Three.js resources to clean up
 * @param {THREE.Scene} config.scene - The Three.js scene to clean up
 * @param {THREE.Camera} config.camera - The camera to clean up
 * @param {THREE.WebGLRenderer} config.renderer - The renderer to clean up
 * @param {THREE.Object3D[]} config.objects - Array of additional objects to clean up
 * @param {HTMLElement[]} config.domElements - Array of DOM elements to remove
 * @param {Function[]} config.eventCleanupCallbacks - Array of functions to call for event cleanup
 * @param {Object} config.additionalCleanup - Additional cleanup configuration
 */
export function cleanupThreeJsScene(config = {}) {
    const {
        scene,
        camera,
        renderer,
        objects = [],
        domElements = [],
        eventCleanupCallbacks = [],
        additionalCleanup = {}
    } = config;

    // Clean up additional objects first
    objects.forEach(object => {
        if (object) {
            disposeObject3D(object);
        }
    });

    // Clean up scene and its children
    if (scene) {
        while (scene.children.length > 0) {
            const object = scene.children[0];
            scene.remove(object);
            disposeObject3D(object);
        }
    }

    // Clean up renderer
    if (renderer) {
        try {
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentElement) {
                renderer.domElement.parentElement.removeChild(renderer.domElement);
            }
        } catch (e) {
            console.log('Renderer cleanup error (non-critical):', e);
        }
    }

    // Clean up DOM elements
    domElements.forEach(element => {
        if (element) {
            cleanupDOMElement(element);
        }
    });

    // Execute event cleanup callbacks
    eventCleanupCallbacks.forEach(callback => {
        try {
            if (typeof callback === 'function') {
                callback();
            }
        } catch (e) {
            console.log('Event cleanup callback error (non-critical):', e);
        }
    });

    // Handle additional cleanup tasks
    if (additionalCleanup.textures) {
        additionalCleanup.textures.forEach(texture => {
            if (texture && texture.dispose) {
                texture.dispose();
            }
        });
    }

    if (additionalCleanup.frameBuffer) {
        additionalCleanup.frameBuffer.forEach(frame => {
            if (frame && frame.texture) {
                frame.texture.dispose();
            }
        });
    }

    if (additionalCleanup.animationFrames) {
        additionalCleanup.animationFrames.forEach(frameId => {
            if (frameId !== null && frameId !== undefined) {
                cancelAnimationFrame(frameId);
            }
        });
    }
}

/**
 * Dispose of a Three.js Object3D and all its resources
 * @param {THREE.Object3D} object - The object to dispose
 */
function disposeObject3D(object) {
    if (!object) return;

    try {
        // Dispose geometry
        if (object.geometry) {
            object.geometry.dispose();
        }

        // Dispose materials
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => disposeMaterial(material));
            } else {
                disposeMaterial(object.material);
            }
        }

        // Handle special cleanup for objects with DOM elements (CSS3D objects)
        if (object.element && object.element.parentNode) {
            cleanupDOMElement(object.element);
        }

        // Recursively dispose children
        if (object.children) {
            [...object.children].forEach(child => {
                object.remove(child);
                disposeObject3D(child);
            });
        }
    } catch (e) {
        console.log('Object3D disposal error (non-critical):', e);
    }
}

/**
 * Dispose of a Three.js material and its textures
 * @param {THREE.Material} material - The material to dispose
 */
function disposeMaterial(material) {
    if (!material) return;

    try {
        // Dispose textures
        Object.keys(material).forEach(key => {
            const value = material[key];
            if (value && value.isTexture) {
                value.dispose();
            }
        });

        // Dispose the material itself
        material.dispose();
    } catch (e) {
        console.log('Material disposal error (non-critical):', e);
    }
}

/**
 * Clean up a DOM element, including iframe content if applicable
 * @param {HTMLElement} element - The DOM element to clean up
 */
function cleanupDOMElement(element) {
    if (!element) return;

    try {
        // Special handling for iframes
        if (element.tagName === 'IFRAME' && element.contentDocument) {
            element.contentDocument.open();
            element.contentDocument.write('');
            element.contentDocument.close();
        }

        // Remove from DOM
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
    } catch (e) {
        console.log('DOM element cleanup error (non-critical):', e);
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
