import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { MaterialFactory } from './material_factory';

export class CSS3DFactory {
    constructor() {
        this.css3dRenderer = null;
        this.css3dScene = null;
        this.frames = [];
        this.animationId = null;
        this.isInitialized = false;
        this.mainCamera = null;
        this.materialFactory = new MaterialFactory();
        this.debugMode = false;
        // NEW: Track if we should use external animation loop
        this.useExternalAnimationLoop = false;
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.frames.forEach(frameTracker => {
            if (frameTracker.isPlaying) {
                this.playFrame(frameTracker);
            }
        });
    }

    getDebugMode() {
        return this.debugMode;
    }

    // NEW: Allow external animation loop to control updates
    setExternalAnimationLoop(enabled) {
        this.useExternalAnimationLoop = enabled;
        if (enabled && this.animationId) {
            // Stop internal animation loop
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        } else if (!enabled && !this.animationId && this.frames.length > 0) {
            // Start internal animation loop
            this.startAnimationLoop();
        }
    }

    // NEW: Update method to be called by external animation loop
    update() {
        if (!this.useExternalAnimationLoop) return;
        
        for (const frameTracker of this.frames) {
            if (frameTracker.mesh && frameTracker.frame) {
                this.updateFrameTransform(frameTracker);
            }
        }
        if (this.css3dRenderer && this.css3dScene && this.mainCamera) {
            this.css3dRenderer.render(this.css3dScene, this.mainCamera);
        }
    }

    async createFrameOnDisplay(displayMesh, sceneCamera, parentElement, assetType = null, filePath = null, backgroundColor = null) {
        if (!this.isInitialized) {
            this.initializeCSS3D(parentElement || document.body);
        }
        this.mainCamera = sceneCamera;
        
        this.validateDisplayMesh(displayMesh);
        
        const frameTracker = await this.createCSS3DFrame(500, 400, filePath, displayMesh, assetType, backgroundColor);
        return frameTracker;
    }

    validateDisplayMesh(mesh) {
        if (!mesh) {
            throw new Error('Display mesh is null or undefined');
        }

        if (!mesh.isMesh) {
            throw new Error('Display object is not a mesh');
        }

        if (!mesh.geometry) {
            throw new Error(`Display mesh "${mesh.name}" has no geometry`);
        }

        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        if (!positions || positions.count < 4) {
            throw new Error(`Display mesh "${mesh.name}" is not a valid rectangle - insufficient vertices`);
        }
    }

    isProjectsFrame(mesh) {
        let current = mesh;
        while (current) {
            if (current.name && (current.name.toLowerCase().includes('notebook') || current.name.toLowerCase().includes('projects'))) {
                return true;
            }
            current = current.parent;
        }
        return false;
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
        
        let faceWidth, faceHeight;
        
        if (this.isProjectsFrame(mesh)) {
            faceWidth = dimensions[1].size;
            faceHeight = dimensions[0].size;
        } else {
            faceWidth = dimensions[0].size;
            faceHeight = dimensions[1].size;
        }
        
        return { 
            width: Math.max(50, faceWidth * 1000),
            height: Math.max(50, faceHeight * 1000),
            realWidth: faceWidth,
            realHeight: faceHeight
        };
    }

    calculateMeshTransform(mesh, offsetDistance = 0.001) {
        if (!mesh || !mesh.geometry) {
            return {
                position: new THREE.Vector3(0, 0, 0),
                rotation: new THREE.Euler(0, 0, 0),
                quaternion: new THREE.Quaternion()
            };
        }

        const geometry = mesh.geometry;
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.localToWorld(center);

        const meshMatrix = mesh.matrixWorld.clone();
        
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        
        meshMatrix.decompose(position, quaternion, scale);
        
        const box = geometry.boundingBox;
        const width = box.max.x - box.min.x;
        const height = box.max.y - box.min.y;
        const depth = box.max.z - box.min.z;
        
        const dimensions = [
            { size: width, axis: 'x' },
            { size: height, axis: 'y' },
            { size: depth, axis: 'z' }
        ];
        
        dimensions.sort((a, b) => a.size - b.size);
        
        const tolerance = 0.01;
        if (dimensions[0].size > tolerance) {
            throw new Error(`Display mesh is not rectangular - smallest dimension (${dimensions[0].axis}: ${dimensions[0].size.toFixed(4)}) is too large`);
        }
        
        const thinAxis = dimensions[0].axis;
        
        const isAboutSection = this.isAboutSectionFrame(mesh);
        
        let correctionRotation = new THREE.Quaternion();
        
        if (thinAxis === 'z') {
            if (isAboutSection) {
                correctionRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
            } else {
                correctionRotation.identity();
            }
        } else if (thinAxis === 'y') {
            correctionRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
            
            if (isAboutSection) {
                const faceAwayRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
                correctionRotation.multiply(faceAwayRotation);
            } else {
                if (mesh.name && mesh.name.toLowerCase().includes('display_')) {
                    let current = mesh.parent;
                    let isTablet = false;
                    while (current) {
                        if (current.name && (current.name.toLowerCase().includes('tablet') || current.name.toLowerCase().includes('contact'))) {
                            isTablet = true;
                            break;
                        }
                        current = current.parent;
                    }
                    
                    if (isTablet) {
                        const flipRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
                        correctionRotation.multiply(flipRotation);
                    }
                }
            }
        } else if (thinAxis === 'x') {
            if (isAboutSection) {
                correctionRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
            } else {
                correctionRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
            }
        }
        
        const finalQuaternion = quaternion.clone().multiply(correctionRotation);

        return {
            position: center,
            rotation: new THREE.Euler().setFromQuaternion(finalQuaternion),
            quaternion: finalQuaternion
        };
    }

    isAboutSectionFrame(mesh) {
        let current = mesh;
        while (current) {
            if (current.name && (current.name.toLowerCase().includes('business') || current.name.toLowerCase().includes('card'))) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    async createCSS3DFrame(width, height, filePath = null, displayMesh = null, assetType = null, backgroundColor = null) {
        if (!this.isInitialized) {
            this.initializeCSS3D(document.body);
        }

        const iframe = document.createElement('iframe');
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
        iframe.style.border = 'none';
        iframe.style.borderRadius = '5px';
        iframe.style.backgroundColor = 'white';
        iframe.style.boxSizing = 'border-box';
        const css3dObject = new CSS3DObject(iframe);

        const frameTracker = {
            mesh: displayMesh,
            frame: css3dObject,
            frameWidth: width,
            frameHeight: height,
            visible: true,
            assetType: assetType,
            filePath: filePath,
            backgroundColor: backgroundColor,
            isPlaying: false,
            pendingContent: null,
            play: () => this.playFrame(frameTracker),
            reset: () => this.resetFrame(frameTracker),
            show: () => this.showFrame(frameTracker),
            hide: () => this.hideFrame(frameTracker),
            toggleVisibility: () => this.toggleFrameVisibility(frameTracker)
        };

        this.css3dScene.add(css3dObject);
        this.frames.push(frameTracker);

        if (displayMesh) {
            this.updateFrameTransform(frameTracker);
        }

        // MODIFIED: Only start internal loop if not using external loop
        if (!this.animationId && !this.useExternalAnimationLoop) {
            this.startAnimationLoop();
        }

        setTimeout(() => {
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(this.getLoadingHTML(backgroundColor));
                iframe.contentDocument.close();
            }
        }, 100);

        return frameTracker;
    }

    updateFrameTransform(frameTracker) {
        if (!frameTracker.frame || !frameTracker.mesh) return;
        
        const displayMesh = frameTracker.mesh;
        const frame = frameTracker.frame;
        
        const transform = this.calculateMeshTransform(displayMesh, 0.001);
        frame.position.copy(transform.position);
        frame.rotation.copy(transform.rotation);
        frame.quaternion.copy(transform.quaternion);
        
        const dimensions = this.calculateDisplayMeshDimensions(displayMesh);
        const scaleX = dimensions.realWidth / frameTracker.frameWidth;
        const scaleY = dimensions.realHeight / frameTracker.frameHeight;
        frame.scale.set(scaleX, scaleY, 1);
    }

    showFrame(frameTracker) {
        if (frameTracker.visible) {
            return;
        }
        frameTracker.visible = true;
        frameTracker.frame.visible = true;
    }

    hideFrame(frameTracker) {
        if (!frameTracker.visible) {
            return;
        }
        frameTracker.visible = false;
        frameTracker.frame.visible = false;
    }

    toggleFrameVisibility(frameTracker) {
        if (frameTracker.visible) {
            this.hideFrame(frameTracker);
        } else {
            this.showFrame(frameTracker);
        }
    }

    playFrame(frameTracker) {
        if (frameTracker.isPlaying) {
            return;
        }
        frameTracker.isPlaying = true;
        
        const iframe = frameTracker.frame.element;
        
        if (this.debugMode) {
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(this.getDebugHTML());
                iframe.contentDocument.close();
            }
        } else {
            if (frameTracker.pendingContent) {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(this.wrapContentWithScrollControl(frameTracker.pendingContent));
                    iframe.contentDocument.close();
                }
            } else if (frameTracker.filePath) {
                this.loadExternalContentDeferred(iframe, frameTracker.filePath, frameTracker.assetType, frameTracker.backgroundColor);
            } else {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(this.getDebugHTML());
                    iframe.contentDocument.close();
                }
            }
        }
    }

    resetFrame(frameTracker) {
        if (!frameTracker.isPlaying) {
            return;
        }
        frameTracker.isPlaying = false;
        frameTracker.pendingContent = null;
        
        const iframe = frameTracker.frame.element;
        if (iframe.contentDocument) {
            iframe.contentDocument.open();
            iframe.contentDocument.write(this.getLoadingHTML(frameTracker.backgroundColor));
            iframe.contentDocument.close();
        }
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

    async loadExternalContentDeferred(iframe, filePath, assetType, backgroundColor = null) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}: ${response.status}`);
            }
            const htmlContent = await response.text();
            const wrappedContent = this.wrapContentWithScrollControl(htmlContent);
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(wrappedContent);
                iframe.contentDocument.close();
            }
        } catch (error) {
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(this.getErrorHTML(filePath, error.message));
                iframe.contentDocument.close();
            }
        }
    }

    startAnimationLoop() {
        // MODIFIED: Only start if not using external loop
        if (this.useExternalAnimationLoop) {
            return;
        }
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            for (const frameTracker of this.frames) {
                if (frameTracker.mesh && frameTracker.frame) {
                    this.updateFrameTransform(frameTracker);
                }
            }
            if (this.css3dRenderer && this.css3dScene && this.mainCamera) {
                this.css3dRenderer.render(this.css3dScene, this.mainCamera);
            }
        };
        animate();
    }

    getLoadingHTML(backgroundColor = null) {
        if (backgroundColor) {
            return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: ${backgroundColor};
            width: 100vw;
            height: 100vh;
            overflow: hidden;
        }
    </style>
</head>
<body>
</body>
</html>`;
        }

        return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #222;
            font-family: 'Courier New', monospace;
            color: #fff;
            height: 100vh;
            width: 100vw;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }
        .loading-container {
            text-align: center;
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #444;
            border-top: 4px solid #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        .loading-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
        .loading-info {
            font-size: 10px;
            color: #ccc;
            line-height: 1.4;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-title">CSS3D FRAME</div>
        <div class="loading-info">Waiting for play signal...</div>
    </div>
</body>
</html>`;
    }

    wrapContentWithScrollControl(content) {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            overflow: hidden;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        body {
            background-color: white;
            color: #333;
            font-family: Arial, sans-serif;
        }
        
        .content-wrapper {
            width: 100%;
            height: 100%;
            overflow: hidden;
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .content-wrapper > * {
            max-width: 100%;
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .content-wrapper * {
            max-width: 100%;
            box-sizing: border-box;
        }
        
        .content-wrapper pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .content-wrapper img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    <div class="content-wrapper" id="contentWrapper">
        ${content}
    </div>
</body>
</html>`;
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
            height: calc(100vh - 40px);
            width: calc(100vw - 40px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            overflow: hidden;
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
            height: 100vh;
            width: 100vw;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: auto;
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