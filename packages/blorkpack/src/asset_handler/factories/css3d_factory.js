import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

export class CSS3DFactory {
    constructor() {
        this.css3dRenderer = null;
        this.css3dScene = null;
        this.frames = [];
        this.animationId = null;
        this.isInitialized = false;
        this.mainCamera = null;
    }

    async createFrame(incomingMesh, sceneCamera, parentElement, assetType = null, filePath = null) {
        if (!this.isInitialized) {
            this.initializeCSS3D(parentElement || document.body);
        }

        this.mainCamera = sceneCamera;
        
        const dimensions = this.calculateMeshDimensions(incomingMesh);
        const frame = await this.createCSS3DFrame(300, 200, filePath);
        
        const frameTracker = {
            mesh: incomingMesh,
            frame: frame,
            visible: true,
            assetType: assetType,
            filePath: filePath
        };
        
        this.css3dScene.add(frame);
        this.frames.push(frameTracker);
        this.updateFrameTransform(frameTracker);
        
        if (!this.animationId) {
            this.startAnimationLoop();
        }
        
        return frameTracker;
    }

    initializeCSS3D(parentElement) {
        this.css3dScene = new THREE.Scene();
        this.css3dRenderer = new CSS3DRenderer();
        this.css3dRenderer.setSize(window.innerWidth, window.innerHeight);
        this.css3dRenderer.domElement.style.position = 'absolute';
        this.css3dRenderer.domElement.style.top = '0';
        this.css3dRenderer.domElement.style.left = '0';
        this.css3dRenderer.domElement.style.zIndex = '1000';
        this.css3dRenderer.domElement.style.pointerEvents = 'none';
        parentElement.appendChild(this.css3dRenderer.domElement);
        this.isInitialized = true;
    }

    async createCSS3DFrame(width, height, filePath = null) {
        const iframe = document.createElement('iframe');
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
        iframe.style.border = 'none';

        const css3dObject = new CSS3DObject(iframe);

        if (filePath) {
            await this.loadExternalContent(iframe, filePath);
        } else {
            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(this.getDebugHTML());
                    iframe.contentDocument.close();
                }
            }, 100);
        }

        return css3dObject;
    }

    async loadExternalContent(iframe, filePath) {
        try {
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}: ${response.status}`);
            }
            
            const htmlContent = await response.text();
            
            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(htmlContent);
                    iframe.contentDocument.close();
                }
            }, 100);
        } catch (error) {
            console.error(`Error loading external content from ${filePath}:`, error);
            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(this.getErrorHTML(filePath, error.message));
                    iframe.contentDocument.close();
                }
            }, 100);
        }
    }

    getErrorHTML(filePath, errorMessage) {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #ff0000;
            font-family: 'Courier New', monospace;
            color: #fff;
            overflow: hidden;
            height: calc(100vh - 40px);
            width: calc(100vw - 40px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }
        .error-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
        .error-details {
            font-size: 12px;
            line-height: 1.4;
            margin-bottom: 10px;
        }
        .error-path {
            font-size: 10px;
            color: #ffcccc;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="error-title">LOAD ERROR</div>
    <div class="error-details">Failed to load content</div>
    <div class="error-path">Path: ${filePath}</div>
    <div class="error-path">Error: ${errorMessage}</div>
</body>
</html>`;
    }

    calculateMeshDimensions(mesh) {
        if (!mesh || !mesh.geometry) return { realWidth: 1, realHeight: 1 };
        
        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const worldScale = mesh.getWorldScale(new THREE.Vector3());
        const worldSize = size.clone().multiply(worldScale);
        
        let isTabletDisplay = false;
        let current = mesh;
        while (current) {
            if (current.name && current.name.toLowerCase().includes('tablet')) {
                isTabletDisplay = true;
                break;
            }
            current = current.parent;
        }
        
        if (isTabletDisplay) {
            const dimensions = [worldSize.x, worldSize.y, worldSize.z].sort((a, b) => b - a);
            return {
                realWidth: Math.max(0.1, dimensions[0]),
                realHeight: Math.max(0.1, dimensions[1])
            };
        }
        
        return {
            realWidth: Math.max(0.1, worldSize.x),
            realHeight: Math.max(0.1, worldSize.y)
        };
    }

    calculateMeshTransform(mesh, assetType = null) {
        if (!mesh || !mesh.geometry) {
            return {
                position: new THREE.Vector3(0, 0, 0),
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
        offsetPosition.add(normal.clone().multiplyScalar(0.001));

        const billboardQuaternion = new THREE.Quaternion();

        return {
            position: offsetPosition,
            quaternion: billboardQuaternion
        };
    }

    updateFrameTransform(frameTracker) {
        if (!frameTracker.frame || !frameTracker.mesh) return;

        const transform = this.calculateMeshTransform(frameTracker.mesh, frameTracker.assetType);
        frameTracker.frame.position.copy(transform.position);
        frameTracker.frame.quaternion.copy(transform.quaternion);
        
        const dimensions = this.calculateMeshDimensions(frameTracker.mesh);
        const scaleX = dimensions.realWidth / 300;
        const scaleY = dimensions.realHeight / 200;
        frameTracker.frame.scale.set(scaleX, scaleY, 1);
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            for (const frameTracker of this.frames) {
                if (frameTracker.visible && frameTracker.mesh.visible) {
                    this.updateFrameTransform(frameTracker);
                }
            }

            if (this.css3dRenderer && this.css3dScene && this.mainCamera) {
                this.css3dRenderer.render(this.css3dScene, this.mainCamera);
            }
        };
        animate();
    }

    getDebugHTML() {
        return `<!DOCTYPE html>
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
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.css3dRenderer && this.css3dRenderer.domElement && this.css3dRenderer.domElement.parentNode) {
            this.css3dRenderer.domElement.parentNode.removeChild(this.css3dRenderer.domElement);
        }
        
        this.frames = [];
        this.css3dRenderer = null;
        this.css3dScene = null;
        this.isInitialized = false;
    }
}