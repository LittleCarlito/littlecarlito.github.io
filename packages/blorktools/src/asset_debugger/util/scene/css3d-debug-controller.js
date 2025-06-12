import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getState } from '../state/scene-state.js';

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
        this.meshCenter = new THREE.Vector3();
        this.meshNormal = new THREE.Vector3(0, 0, 1);
        this.offsetDistance = 0.1;
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
            return { width: 300, height: 200 };
        }
        
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        const size = boundingBox.getSize(new THREE.Vector3());
        
        const worldScale = mesh.getWorldScale(new THREE.Vector3());
        const actualWidth = size.x * worldScale.x;
        const actualHeight = size.y * worldScale.y;
        
        const scaleFactor = 100;
        const frameWidth = Math.max(200, Math.min(600, actualWidth * scaleFactor));
        const frameHeight = Math.max(150, Math.min(400, actualHeight * scaleFactor));
        
        return { width: frameWidth, height: frameHeight };
    }

    calculateMeshCenterAndNormal(mesh) {
        if (!mesh || !mesh.geometry) {
            return {
                center: new THREE.Vector3(0, 0, 0),
                normal: new THREE.Vector3(0, 0, 1)
            };
        }

        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.localToWorld(center);

        let normal = new THREE.Vector3(0, 0, 1);
        if (geometry.attributes.normal) {
            const normalAttribute = geometry.attributes.normal;
            if (normalAttribute.count > 0) {
                normal.fromBufferAttribute(normalAttribute, 0);
                normal.transformDirection(mesh.matrixWorld);
                normal.normalize();
            }
        }

        return { center, normal };
    }

    calculateDisplayMeshPosition(mesh) {
        if (!mesh) {
            return { x: 20, y: 80 };
        }
        
        const meshData = this.calculateMeshCenterAndNormal(mesh);
        const center = meshData.center;
        
        const state = getState();
        if (!state.camera) {
            return { x: 20, y: 80 };
        }
        
        const vector = center.clone();
        vector.project(state.camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
        
        const clampedX = Math.max(20, Math.min(window.innerWidth - this.frameWidth - 20, x - this.frameWidth / 2));
        const clampedY = Math.max(80, Math.min(window.innerHeight - this.frameHeight - 20, y - this.frameHeight / 2));
        
        return { x: clampedX, y: clampedY };
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
            console.log('CSS3DDebugController: No GLB with display mesh found, skipping initialization');
            return;
        }

        try {
            this.displayMesh = this.findDisplayMesh();
            if (!this.displayMesh) {
                console.log('CSS3DDebugController: No display mesh found');
                return;
            }

            const dimensions = this.calculateDisplayMeshDimensions(this.displayMesh);
            this.frameWidth = dimensions.width;
            this.frameHeight = dimensions.height;

            const meshData = this.calculateMeshCenterAndNormal(this.displayMesh);
            this.meshCenter.copy(meshData.center);
            this.meshNormal.copy(meshData.normal);

            const position = this.calculateDisplayMeshPosition(this.displayMesh);

            this.scene = new THREE.Scene();
            
            this.camera = new THREE.PerspectiveCamera(50, this.frameWidth/this.frameHeight, 1, 5000);
            this.camera.position.set(0, 0, 200);

            this.renderer = new CSS3DRenderer();
            this.renderer.setSize(this.frameWidth, this.frameHeight);
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.top = `${position.y}px`;
            this.renderer.domElement.style.left = `${position.x}px`;
            this.renderer.domElement.style.width = `${this.frameWidth}px`;
            this.renderer.domElement.style.height = `${this.frameHeight}px`;
            this.renderer.domElement.style.zIndex = '3000';
            this.renderer.domElement.style.border = '2px solid #00ff88';
            this.renderer.domElement.style.borderRadius = '8px';
            this.renderer.domElement.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.3)';
            this.renderer.domElement.style.pointerEvents = 'none';

            const iframe = document.createElement('iframe');
            iframe.style.width = `${this.frameWidth}px`;
            iframe.style.height = `${this.frameHeight}px`;
            iframe.style.border = 'none';
            iframe.style.borderRadius = '6px';
            iframe.style.overflow = 'hidden';

            this.frame = new CSS3DObject(iframe);
            
            const offsetPosition = this.meshCenter.clone();
            offsetPosition.add(this.meshNormal.clone().multiplyScalar(this.offsetDistance));
            this.frame.position.copy(offsetPosition);
            
            this.frame.rotation.copy(this.displayMesh.rotation);
            this.frame.quaternion.copy(this.displayMesh.quaternion);
            
            this.frame.scale.set(1, 1, 1);
            this.scene.add(this.frame);

            parentElement.appendChild(this.renderer.domElement);

            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(DEBUG_CSS3D_HTML);
                    iframe.contentDocument.close();
                }
            }, 100);

            this.startAnimation();
            this.startVisibilityMonitoring();
            this.isInitialized = true;
            console.log(`CSS3DDebugController initialized with dimensions ${this.frameWidth}x${this.frameHeight} for display mesh: ${this.displayMesh.name}`);
        } catch (error) {
            console.error('Error initializing CSS3DDebugController:', error);
        }
    }

    updateMeshPosition() {
        if (!this.frame || !this.displayMesh) {
            return;
        }

        const meshData = this.calculateMeshCenterAndNormal(this.displayMesh);
        this.meshCenter.copy(meshData.center);
        this.meshNormal.copy(meshData.normal);

        const offsetPosition = this.meshCenter.clone();
        offsetPosition.add(this.meshNormal.clone().multiplyScalar(this.offsetDistance));

        this.frame.position.copy(offsetPosition);
        
        this.frame.rotation.copy(this.displayMesh.rotation);
        this.frame.quaternion.copy(this.displayMesh.quaternion);

        const position = this.calculateDisplayMeshPosition(this.displayMesh);
        this.renderer.domElement.style.top = `${position.y}px`;
        this.renderer.domElement.style.left = `${position.x}px`;
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
                
                console.log(`CSS3D debug frame ${isVisible ? 'shown' : 'hidden'} - display mesh visibility changed`);
            }

            if (isVisible) {
                this.updateMeshPosition();
            }
        }, 16);
    }

    startAnimation() {
        if (!this.renderer || !this.scene || !this.camera) {
            return;
        }

        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            if (this.displayMesh && this.displayMesh.visible) {
                this.updateMeshPosition();
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
        console.log('CSS3DDebugController cleaned up');
    }

    isActive() {
        return this.isInitialized;
    }

    updatePosition() {
        if (!this.isInitialized || !this.displayMesh || !this.renderer) {
            return;
        }

        this.updateMeshPosition();
    }
}