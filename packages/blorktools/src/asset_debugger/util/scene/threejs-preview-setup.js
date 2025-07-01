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
import { createMeshInfoPanel } from '../../widgets/mesh-info-widget';
import { createTextureFromIframe } from '../animation/render/iframe2texture-render-controller';
import { getState } from '../state/scene-state';
import { animatePreview } from '../animation/playback/animation-preview-controller';
import { setIsPreviewActive } from '../state/animation-state';

export function setupThreeJsScene(container, iframe, currentMeshId, createInfoPanel = true) {
    try {
        setAnimationPreviewScene(new THREE.Scene());
        animationPreviewScene.background = new THREE.Color(0x303030);
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        setAnimationPreviewCamera(new THREE.PerspectiveCamera(
            60, containerAspectRatio, 0.1, 1000
        ));
        animationPreviewCamera.position.z = 3;
        
        setAnimationPreviewRenderer(new THREE.WebGLRenderer({ 
            antialias: true,
            preserveDrawingBuffer: true
        }));
        animationPreviewRenderer.setSize(containerWidth, containerHeight);
        animationPreviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        animationPreviewRenderer.setClearColor(0x303030);
        animationPreviewRenderer.outputEncoding = THREE.sRGBEncoding;
        
        animationPreviewRenderer.shadowMap.enabled = false;
        
        const rendererCanvas = animationPreviewRenderer.domElement;
        rendererCanvas.style.display = 'block';
        rendererCanvas.style.width = '100%';
        rendererCanvas.style.height = '100%';
        container.appendChild(rendererCanvas);
        
        setPreviewRenderTarget(iframe);
        
        if (createInfoPanel) {
            createMeshInfoPanel(container, currentMeshId);
        }
        
        createTextureFromIframe(iframe).then(texture => {
            const state = getState();
            const originalMesh = state.meshes && state.meshes[currentMeshId];
            let geometry;
            
            if (originalMesh && originalMesh.geometry) {
                try {
                    geometry = originalMesh.geometry.clone();
                    console.log("Using original mesh geometry for preview");
                    
                    const isPlaneOrRectangle = geometry.attributes.position.count <= 8;
                    
                    let dominantPlane = 'xy';
                    let normalVector = new THREE.Vector3(0, 0, 1);
                    let upVector = new THREE.Vector3(0, 1, 0);
                    
                    if (geometry.attributes.position) {
                        let minX = Infinity, maxX = -Infinity;
                        let minY = Infinity, maxY = -Infinity;
                        let minZ = Infinity, maxZ = -Infinity;
                        
                        const positions = geometry.attributes.position;
                        const count = positions.count;
                        
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
                        
                        const rangeX = maxX - minX;
                        const rangeY = maxY - minY;
                        const rangeZ = maxZ - minZ;
                        
                        console.log(`Mesh dimensions: X: ${rangeX.toFixed(2)}, Y: ${rangeY.toFixed(2)}, Z: ${rangeZ.toFixed(2)}`);
                        
                        if (rangeZ < rangeX && rangeZ < rangeY) {
                            dominantPlane = 'xy';
                            normalVector = new THREE.Vector3(0, 0, 1);
                            upVector = new THREE.Vector3(0, 1, 0);
                        } else if (rangeY < rangeX && rangeY < rangeZ) {
                            dominantPlane = 'xz';
                            normalVector = new THREE.Vector3(0, 1, 0);
                            upVector = new THREE.Vector3(0, 0, 1);
                        } else {
                            dominantPlane = 'yz';
                            normalVector = new THREE.Vector3(1, 0, 0);
                            upVector = new THREE.Vector3(0, 1, 0);
                        }
                        
                        if (geometry.index) {
                            try {
                                geometry.computeVertexNormals();
                                let normalSum = new THREE.Vector3(0, 0, 0);
                                
                                if (geometry.attributes.normal) {
                                    const normals = geometry.attributes.normal;
                                    for (let i = 0; i < normals.count; i++) {
                                        normalSum.x += normals.getX(i);
                                        normalSum.y += normals.getY(i);
                                        normalSum.z += normals.getZ(i);
                                    }
                                    normalSum.divideScalar(normals.count);
                                    normalSum.normalize();
                                    
                                    if (normalSum.length() > 0.5) {
                                        normalVector = normalSum;
                                        console.log(`Detected normal vector: (${normalVector.x.toFixed(2)}, ${normalVector.y.toFixed(2)}, ${normalVector.z.toFixed(2)})`);
                                        
                                        if (Math.abs(normalVector.y) < 0.7) {
                                            upVector = new THREE.Vector3(0, 1, 0);
                                            upVector.sub(normalVector.clone().multiplyScalar(normalVector.dot(upVector)));
                                            upVector.normalize();
                                        } else {
                                            upVector = new THREE.Vector3(0, 0, 1);
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
                        
                        const uvs = new Float32Array(count * 2);
                        
                        const transformMatrix = new THREE.Matrix4();
                        
                        const quaternion = new THREE.Quaternion().setFromUnitVectors(normalVector, new THREE.Vector3(0, 0, 1));
                        transformMatrix.makeRotationFromQuaternion(quaternion);
                        
                        const tempVector = new THREE.Vector3();
                        
                        for (let i = 0; i < count; i++) {
                            const x = positions.getX(i);
                            const y = positions.getY(i);
                            const z = positions.getZ(i);
                            
                            tempVector.set(x, y, z);
                            tempVector.applyMatrix4(transformMatrix);
                            
                            const transformedX = tempVector.x;
                            const transformedY = tempVector.y;
                            
                            const u = (transformedX - minX) / Math.max(0.0001, rangeX);
                            const v = (transformedY - minY) / Math.max(0.0001, rangeY);
                            
                            uvs[i * 2] = u;
                            uvs[i * 2 + 1] = v;
                        }
                        
                        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                        console.log("Created custom UVs for rectangle/plane geometry");
                        
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
                console.log("No mesh found with ID " + currentMeshId + ", using cube geometry");
                geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
            }
            
            const material = new THREE.MeshBasicMaterial({ 
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: true,
                fog: false
            });
            
            setPreviewPlane(new THREE.Mesh(geometry, material));
            
            previewPlane.frustumCulled = false;
            
            animationPreviewScene.add(previewPlane);
            
            if (geometry.userData && geometry.userData.normalVector) {
                const normalVector = geometry.userData.normalVector;
                const upVector = geometry.userData.upVector;
                const dominantPlane = geometry.userData.dominantPlane;
                
                const cameraPosition = normalVector.clone().multiplyScalar(2);
                animationPreviewCamera.position.copy(cameraPosition);
                
                animationPreviewCamera.lookAt(0, 0, 0);
                
                animationPreviewCamera.up.copy(upVector);
                
                const lookAtMatrix = new THREE.Matrix4();
                lookAtMatrix.lookAt(
                    new THREE.Vector3(0, 0, 0),
                    normalVector.clone().negate(),
                    upVector
                );
                
                const rotation = new THREE.Quaternion();
                rotation.setFromRotationMatrix(lookAtMatrix);
                previewPlane.quaternion.copy(rotation);
                
                console.log(`Camera positioned based on detected normal and up vectors`);
            } else if (dominantPlane) {
                if (dominantPlane === 'xy') {
                    animationPreviewCamera.position.set(0, 0, 3);
                    animationPreviewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, 0, 0);
                } else if (dominantPlane === 'xz') {
                    animationPreviewCamera.position.set(0, 3, 0);
                    animationPreviewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(-Math.PI/2, 0, 0);
                } else {
                    animationPreviewCamera.position.set(3, 0, 0);
                    animationPreviewCamera.lookAt(0, 0, 0);
                    previewPlane.rotation.set(0, Math.PI/2, 0);
                }
                
                console.log(`Camera positioned to view the ${dominantPlane} plane`);
            } else {
                animationPreviewCamera.position.z = 3;
                
                previewPlane.rotation.x = Math.PI / 10;
                previewPlane.rotation.y = Math.PI / 6;
            }
            
            setupOrbitControls(animationPreviewCamera, animationPreviewRenderer.domElement)
                .then(controls => {
                    animatePreview();
                    
                    showStatus('Preview ready. Use +/- keys to zoom in/out', 'success');
                    
                    const handleKeydown = (event) => {
                        if (!isPreviewActive) return;
                        
                        const controls = animationPreviewCamera.userData.controls;
                        if (!controls) return;
                        
                        const zoomSpeed = 0.2;
                        
                        switch (event.key) {
                            case '+':
                            case '=':
                                controls.dollyIn(1 + zoomSpeed);
                                controls.update();
                                break;
                            case '-':
                            case '_':
                                controls.dollyOut(1 + zoomSpeed);
                                controls.update();
                                break;
                        }
                    };
                    
                    document.addEventListener('keydown', handleKeydown);
                    
                    animationPreviewCamera.userData.keyHandler = handleKeydown;
                })
                .catch(error => {
                    console.error('Failed to setup orbit controls:', error);
                    animatePreview();
                });
        }).catch(error => {
            console.error('Error creating texture from iframe:', error);
            showStatus('Error creating texture from HTML: ' + error.message, 'error');
            animatePreview();
        });
    } catch (error) {
        console.error('Error setting up Three.js scene:', error);
        showStatus('Error in Three.js scene setup: ' + error.message, 'error');
    }
}

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

    objects.forEach(object => {
        if (object) {
            disposeObject3D(object);
        }
    });

    if (scene) {
        while (scene.children.length > 0) {
            const object = scene.children[0];
            scene.remove(object);
            disposeObject3D(object);
        }
    }

    if (renderer) {
        try {
            if (typeof renderer.dispose === 'function') {
                renderer.dispose();
            }
            if (renderer.domElement && renderer.domElement.parentElement) {
                renderer.domElement.parentElement.removeChild(renderer.domElement);
            }
        } catch (e) {
            console.log('Renderer cleanup error (non-critical):', e);
        }
    }

    domElements.forEach(element => {
        if (element) {
            cleanupDOMElement(element);
        }
    });

    eventCleanupCallbacks.forEach(callback => {
        try {
            if (typeof callback === 'function') {
                callback();
            }
        } catch (e) {
            console.log('Event cleanup callback error (non-critical):', e);
        }
    });

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

function disposeObject3D(object) {
    if (!object) return;

    try {
        if (object.geometry) {
            object.geometry.dispose();
        }

        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => disposeMaterial(material));
            } else {
                disposeMaterial(object.material);
            }
        }

        if (object.element && object.element.parentNode) {
            cleanupDOMElement(object.element);
        }

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

function disposeMaterial(material) {
    if (!material) return;

    try {
        Object.keys(material).forEach(key => {
            const value = material[key];
            if (value && value.isTexture) {
                value.dispose();
            }
        });

        material.dispose();
    } catch (e) {
        console.log('Material disposal error (non-critical):', e);
    }
}

function cleanupDOMElement(element) {
    if (!element) return;

    try {
        if (element.tagName === 'IFRAME' && element.contentDocument) {
            element.contentDocument.open();
            element.contentDocument.write('');
            element.contentDocument.close();
        }

        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
    } catch (e) {
        console.log('DOM element cleanup error (non-critical):', e);
    }
}

function setupOrbitControls(camera, domElement) {
    return new Promise((resolve, reject) => {
        try {
            import('three/examples/jsm/controls/OrbitControls.js')
                .then(module => {
                    const { OrbitControls } = module;
                    
                    const controls = new OrbitControls(camera, domElement);
                    controls.enableDamping = true;
                    controls.dampingFactor = 0.2;
                    controls.rotateSpeed = 0.5;
                    controls.minDistance = 0.5;
                    controls.maxDistance = 20;
                    controls.zoomSpeed = 1.2;
                    
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