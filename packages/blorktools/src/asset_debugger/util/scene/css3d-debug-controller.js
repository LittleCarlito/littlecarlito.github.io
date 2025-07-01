import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getState } from '../state/scene-state.js';
import { calculateMeshTransform, createCSS3DFrame } from './css3d-frame-factory.js';
import { addFrameToScene } from './css3d-scene-manager.js';

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

export class CSS3DDebugController {
    constructor() {
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.frame = null;
        this.animationId = null;
        this.isInitialized = false;
        this.displayMesh = null;
        this.frameWidth = 300;
        this.frameHeight = 200;
        this.visibilityCheckInterval = null;
        this.lastVisibleState = true;
        this.offsetDistance = 0.001;
        this.dragStateCheckInterval = null;
    }

    findDisplayMesh() {
        const state = getState();
        if (!state.scene) {
            return null;
        }
        
        let foundMesh = null;
        
        state.scene.traverse((object) => {
            if (!foundMesh && object.isMesh && object.name && object.name.toLowerCase().includes('display_')) {
                foundMesh = object;
            }
        });
        
        return foundMesh;
    }

    calculateDisplayMeshDimensions(mesh) {
        if (!mesh || !mesh.geometry) {
            throw new Error('Display mesh or geometry not found');
        }
        
        const geometry = mesh.geometry;
        const position = geometry.attributes.position;
        
        if (!position) {
            throw new Error('Display mesh has no position attribute');
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
            throw new Error('Could not determine rectangular face dimensions from display mesh');
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

    shouldInitialize() {
        const state = getState();
        if (!state.scene) {
            return false;
        }
        
        const hasGlbLoaded = state.glbFile || state.modelFile;
        if (!hasGlbLoaded) {
            return false;
        }
        
        const displayMesh = this.findDisplayMesh();
        return !!displayMesh;
    }

    init(parentElement) {
        if (this.isInitialized) {
            return;
        }

        if (!parentElement) {
            console.error('CSS3DDebugController: Parent element required');
            return;
        }

        if (!this.shouldInitialize()) {
            return;
        }

        try {
            this.displayMesh = this.findDisplayMesh();
            if (!this.displayMesh) {
                return;
            }

            const dimensions = this.calculateDisplayMeshDimensions(this.displayMesh);
            this.frameWidth = dimensions.width;
            this.frameHeight = dimensions.height;

            const state = getState();
            this.scene = new THREE.Scene();
            
            this.camera = state.camera.clone();

            this.renderer = new CSS3DRenderer();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.top = '0px';
            this.renderer.domElement.style.left = '0px';
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.renderer.domElement.style.zIndex = '1000';
            this.renderer.domElement.style.pointerEvents = 'none';

            this.frame = createCSS3DFrame({
                width: this.frameWidth,
                height: this.frameHeight,
                htmlContent: DEBUG_CSS3D_HTML,
                borderColor: '#00ff88',
                boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)'
            });

            addFrameToScene(this.frame, this.scene, this.displayMesh, {
                realWidth: dimensions.realWidth,
                realHeight: dimensions.realHeight,
                frameWidth: this.frameWidth,
                frameHeight: this.frameHeight,
                offsetDistance: this.offsetDistance
            });

            parentElement.appendChild(this.renderer.domElement);

            this.startAnimation();
            this.startVisibilityMonitoring();
            this.startDragStateMonitoring();
            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing CSS3DDebugController:', error);
        }
    }

    updateMeshTransform() {
        if (!this.frame || !this.displayMesh) {
            return;
        }

        const transform = calculateMeshTransform(this.displayMesh, this.offsetDistance);
        this.frame.position.copy(transform.position);
        this.frame.rotation.copy(transform.rotation);
        this.frame.quaternion.copy(transform.quaternion);
    }

    startVisibilityMonitoring() {
        if (this.visibilityCheckInterval) {
            clearInterval(this.visibilityCheckInterval);
        }

        this.visibilityCheckInterval = setInterval(() => {
            if (!this.displayMesh || !this.renderer) {
                return;
            }

            const isVisible = this.displayMesh.visible;
            
            if (isVisible !== this.lastVisibleState) {
                this.lastVisibleState = isVisible;
                
                if (this.renderer.domElement) {
                    this.renderer.domElement.style.display = isVisible ? 'block' : 'none';
                }
            }

            if (isVisible) {
                this.updateMeshTransform();
            }
        }, 16);
    }

    startDragStateMonitoring() {
        if (this.dragStateCheckInterval) {
            clearInterval(this.dragStateCheckInterval);
        }

        this.dragStateCheckInterval = setInterval(() => {
            if (!this.frame || !this.frame.element) {
                return;
            }

            try {
                const mouseHandlerModule = import('../rig/rig-mouse-handler.js');
                mouseHandlerModule.then(module => {
                    const isDragging = module.getIsDragging();
                    
                    if (isDragging) {
                        this.frame.element.style.pointerEvents = 'none';
                    } else {
                        this.frame.element.style.pointerEvents = 'auto';
                    }
                }).catch(() => {
                });
            } catch (error) {
            }
        }, 16);
    }

    startAnimation() {
        if (!this.renderer || !this.scene) {
            return;
        }

        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            if (this.displayMesh && this.displayMesh.visible) {
                this.updateMeshTransform();
            }

            const state = getState();
            if (state.camera) {
                this.camera.position.copy(state.camera.position);
                this.camera.rotation.copy(state.camera.rotation);
                this.camera.quaternion.copy(state.camera.quaternion);
                this.camera.updateMatrixWorld();
            }
            
            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    cleanup() {
        if (this.visibilityCheckInterval) {
            clearInterval(this.visibilityCheckInterval);
            this.visibilityCheckInterval = null;
        }

        if (this.dragStateCheckInterval) {
            clearInterval(this.dragStateCheckInterval);
            this.dragStateCheckInterval = null;
        }

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.renderer && this.renderer.domElement) {
            const parent = this.renderer.domElement.parentNode;
            if (parent) {
                parent.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }

        this.scene = null;
        this.camera = null;
        this.frame = null;
        this.displayMesh = null;
        this.lastVisibleState = true;
        this.isInitialized = false;
    }

    isActive() {
        return this.isInitialized;
    }

    updatePosition() {
        if (!this.isInitialized || !this.displayMesh || !this.renderer) {
            return;
        }

        this.updateMeshTransform();
    }
}