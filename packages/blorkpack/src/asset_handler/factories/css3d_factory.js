import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getState } from '../util/state/scene-state.js';

const DEBUG_CSS3D_HTML = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            font-family: 'Courier New', monospace;
            color: #fff;
            overflow: hidden;
            height: 100vh;
            width: 100vw;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .debug-container {
            text-align: center;
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .rainbow-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(45deg, 
                #ff0000, #ff7f00, #ffff00, #00ff00, 
                #0000ff, #4b0082, #9400d3, #ff0000);
            background-size: 400% 400%;
            animation: rainbowShift 3s ease-in-out infinite;
            opacity: 0.8;
        }
        .debug-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 10;
            position: relative;
            color: #fff;
        }
        .debug-info {
            font-size: 10px;
            z-index: 10;
            position: relative;
            color: #fff;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            line-height: 1.4;
        }
        .debug-counter {
            display: inline-block;
            min-width: 20px;
            background: rgba(255, 255, 255, 0.2);
            padding: 1px 4px;
            border-radius: 3px;
            margin: 0 2px;
        }
        .rainbow-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, 
                transparent 30%, 
                rgba(255,255,255,0.1) 70%);
            z-index: 5;
        }
        @keyframes rainbowShift {
            0% { background-position: 0% 50%; }
            25% { background-position: 50% 100%; }
            50% { background-position: 100% 50%; }
            75% { background-position: 50% 0%; }
            100% { background-position: 0% 50%; }
        }
    </style>
</head>
<body>
    <div class="debug-container">
        <div class="rainbow-background"></div>
        <div class="rainbow-overlay"></div>
        <div class="debug-title">CSS3D DEBUG</div>
        <div class="debug-info">
            FRAME: <span class="debug-counter" id="frameCounter">0</span><br>
            TIME: <span class="debug-counter" id="timeCounter">00:00</span>
        </div>
    </div>
    <script>
        let frameCount = 0;
        let startTime = Date.now();
        function updateCounters() {
            frameCount++;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('frameCounter').textContent = frameCount;
            document.getElementById('timeCounter').textContent = \`\${minutes}:\${seconds}\`;
        }
        setInterval(updateCounters, 100);
    </script>
</body>
</html>`;

export class CSS3DFactory {
    constructor() {
        this.activeFrames = new Map();
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.animationId = null;
        this.isInitialized = false;
    }

    /**
     * Create a CSS3D frame attached to the given mesh
     * @param {THREE.Mesh} incomingMesh - The mesh to attach the frame to
     * @returns {Object} Frame controller with cleanup and update methods
     */
    async createFrame(incomingMesh) {
        if (!incomingMesh || !incomingMesh.geometry) {
            throw new Error('Invalid mesh provided - mesh must have geometry');
        }

        const state = getState();
        if (!state.scene) {
            throw new Error('No scene available in state');
        }

        const dimensions = this.calculateMeshDimensions(incomingMesh);
        const frameWidth = dimensions.width;
        const frameHeight = dimensions.height;
        const offsetDistance = 0.001;

        if (!this.isInitialized) {
            this.initializeRenderer();
        }

        const iframe = document.createElement('iframe');
        iframe.style.width = `${frameWidth}px`;
        iframe.style.height = `${frameHeight}px`;
        iframe.style.border = '2px solid #00ff88';
        iframe.style.borderRadius = '8px';
        iframe.style.overflow = 'hidden';
        iframe.style.pointerEvents = 'auto';
        iframe.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.3)';

        const css3dObject = new CSS3DObject(iframe);

        setTimeout(() => {
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(DEBUG_CSS3D_HTML);
                iframe.contentDocument.close();
            }
        }, 100);

        const transform = this.calculateMeshTransform(incomingMesh, offsetDistance);
        css3dObject.position.copy(transform.position);
        css3dObject.rotation.copy(transform.rotation);
        css3dObject.quaternion.copy(transform.quaternion);

        const scaleX = dimensions.realWidth / frameWidth;
        const scaleY = dimensions.realHeight / frameHeight;
        css3dObject.scale.set(scaleX, scaleY, 1);

        this.scene.add(css3dObject);

        const frameId = this.generateFrameId();
        const frameController = {
            id: frameId,
            frame: css3dObject,
            mesh: incomingMesh,
            iframe: iframe,
            offsetDistance: offsetDistance,
            lastVisibleState: true,
            isActive: true,

            updateTransform: () => {
                if (!frameController.isActive) return;
                
                const transform = this.calculateMeshTransform(incomingMesh, offsetDistance);
                css3dObject.position.copy(transform.position);
                css3dObject.rotation.copy(transform.rotation);
                css3dObject.quaternion.copy(transform.quaternion);
            },

            updateVisibility: () => {
                if (!frameController.isActive) return;
                
                const isVisible = incomingMesh.visible;
                if (isVisible !== frameController.lastVisibleState) {
                    frameController.lastVisibleState = isVisible;
                    
                    if (this.renderer && this.renderer.domElement) {
                        this.renderer.domElement.style.display = isVisible ? 'block' : 'none';
                    }
                }
            },

            cleanup: () => {
                frameController.isActive = false;
                
                if (this.scene && css3dObject) {
                    this.scene.remove(css3dObject);
                }
                
                if (iframe && iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
                
                this.activeFrames.delete(frameId);
                
                if (this.activeFrames.size === 0) {
                    this.cleanup();
                }
            }
        };

        this.activeFrames.set(frameId, frameController);

        if (!this.animationId) {
            this.startAnimation();
        }

        return frameController;
    }

    /**
     * Calculate mesh dimensions from geometry
     * @param {THREE.Mesh} mesh - The mesh to measure
     * @returns {Object} Dimensions object with width, height, realWidth, realHeight
     */
    calculateMeshDimensions(mesh) {
        if (!mesh || !mesh.geometry) {
            throw new Error('Mesh or geometry not found');
        }
        
        const geometry = mesh.geometry;
        const position = geometry.attributes.position;
        
        if (!position) {
            throw new Error('Mesh has no position attribute');
        }
        
        geometry.computeBoundingBox();
        const localSize = geometry.boundingBox.getSize(new THREE.Vector3());
        
        const worldScale = mesh.getWorldScale(new THREE.Vector3());
        const worldSize = localSize.clone().multiply(worldScale);
        
        const dimensions = [
            { size: worldSize.x, axis: 'x' },
            { size: worldSize.y, axis: 'y' },
            { size: worldSize.z, axis: 'z' }
        ].sort((a, b) => b.size - a.size);
        
        if (dimensions[0].size <= 0 || dimensions[1].size <= 0) {
            throw new Error('Could not determine rectangular face dimensions from mesh');
        }
        
        const faceWidth = dimensions[0].size;
        const faceHeight = dimensions[1].size;
        
        return { 
            width: Math.max(50, faceWidth * 1000),
            height: Math.max(50, faceHeight * 1000),
            realWidth: faceWidth,
            realHeight: faceHeight
        };
    }

    /**
     * Calculate transform for mesh positioning
     * @param {THREE.Mesh} mesh - The mesh to calculate transform for
     * @param {number} offsetDistance - Distance to offset from mesh surface
     * @returns {Object} Transform object with position, rotation, quaternion
     */
    calculateMeshTransform(mesh, offsetDistance) {
        if (!mesh || !mesh.geometry) {
            return {
                position: new THREE.Vector3(0, 0, 0),
                rotation: new THREE.Euler(0, 0, 0),
                quaternion: new THREE.Quaternion()
            };
        }

        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.localToWorld(center);

        const meshMatrix = mesh.matrixWorld.clone();
        
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        
        meshMatrix.decompose(position, quaternion, scale);
        
        let normal = new THREE.Vector3(0, 0, 1);
        if (geometry.attributes.normal) {
            const normalAttribute = geometry.attributes.normal;
            if (normalAttribute.count > 0) {
                normal.fromBufferAttribute(normalAttribute, 0);
                normal.transformDirection(meshMatrix);
                normal.normalize();
            }
        }

        const offsetPosition = center.clone();
        offsetPosition.add(normal.clone().multiplyScalar(offsetDistance));

        return {
            position: offsetPosition,
            rotation: new THREE.Euler().setFromQuaternion(quaternion),
            quaternion: quaternion
        };
    }

    /**
     * Initialize the CSS3D renderer and scene
     */
    initializeRenderer() {
        if (this.isInitialized) return;

        const state = getState();
        
        this.scene = new THREE.Scene();
        this.camera = state.camera ? state.camera.clone() : new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new CSS3DRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0px';
        this.renderer.domElement.style.left = '0px';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.zIndex = '1000';
        this.renderer.domElement.style.pointerEvents = 'none';

        const viewport = document.getElementById('viewport');
        if (viewport) {
            viewport.appendChild(this.renderer.domElement);
        } else {
            document.body.appendChild(this.renderer.domElement);
        }

        this.isInitialized = true;
    }

    /**
     * Start the animation loop for updating frames
     */
    startAnimation() {
        if (this.animationId) return;

        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            if (this.activeFrames.size === 0) {
                this.stopAnimation();
                return;
            }

            const state = getState();
            if (state.camera) {
                this.camera.position.copy(state.camera.position);
                this.camera.rotation.copy(state.camera.rotation);
                this.camera.quaternion.copy(state.camera.quaternion);
                this.camera.updateMatrixWorld();
            }

            this.activeFrames.forEach(frameController => {
                if (frameController.isActive) {
                    frameController.updateTransform();
                    frameController.updateVisibility();
                }
            });
            
            if (this.renderer && this.scene) {
                this.renderer.render(this.scene, this.camera);
            }
        };

        animate();
    }

    /**
     * Stop the animation loop
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Generate unique frame ID
     * @returns {string} Unique frame identifier
     */
    generateFrameId() {
        return `css3d_frame_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        this.stopAnimation();

        this.activeFrames.forEach(frameController => {
            frameController.cleanup();
        });
        this.activeFrames.clear();

        if (this.renderer && this.renderer.domElement) {
            const parent = this.renderer.domElement.parentNode;
            if (parent) {
                parent.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }

        this.scene = null;
        this.camera = null;
        this.isInitialized = false;
    }

    /**
     * Get active frame count
     * @returns {number} Number of active frames
     */
    getActiveFrameCount() {
        return this.activeFrames.size;
    }

    /**
     * Check if factory is active
     * @returns {boolean} True if factory has active frames
     */
    isActive() {
        return this.activeFrames.size > 0;
    }
}