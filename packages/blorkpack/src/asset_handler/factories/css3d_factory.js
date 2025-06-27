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
    }

    async createFrameOnDisplay(incomingMesh, sceneCamera, parentElement, assetType = null, filePath = null) {
        if (!this.isInitialized) {
            this.initializeCSS3D(parentElement || document.body);
        }
        this.mainCamera = sceneCamera;
        
        const frameTracker = await this.createCSS3DFrame(500, 400, filePath, incomingMesh, assetType);
        return frameTracker;
    }

    async createCSS3DFrame(width, height, filePath = null, mesh = null, assetType = null) {
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
            mesh: mesh,
            frame: css3dObject,
            visible: true,
            assetType: assetType,
            filePath: filePath,
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

        if (mesh) {
            this.updateFrameTransform(frameTracker);
        }

        if (!this.animationId) {
            this.startAnimationLoop();
        }

        setTimeout(() => {
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(this.getLoadingHTML());
                iframe.contentDocument.close();
            }
        }, 100);

        return frameTracker;
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
        
        if (frameTracker.pendingContent) {
            iframe.src = 'about:blank';
            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(this.wrapContentWithScrollControl(frameTracker.pendingContent));
                    iframe.contentDocument.close();
                }
            }, 150);
        } else if (frameTracker.filePath) {
            this.loadExternalContentDeferred(iframe, frameTracker.filePath, frameTracker.assetType);
        } else {
            iframe.src = 'about:blank';
            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(this.getDebugHTML());
                    iframe.contentDocument.close();
                }
            }, 150);
        }
    }

    resetFrame(frameTracker) {
        if (!frameTracker.isPlaying) {
            return;
        }
        frameTracker.isPlaying = false;
        frameTracker.pendingContent = null;
        
        const iframe = frameTracker.frame.element;
        iframe.src = 'about:blank';
        setTimeout(() => {
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(this.getLoadingHTML());
                iframe.contentDocument.close();
            }
        }, 150);
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

    async loadExternalContentDeferred(iframe, filePath, assetType) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}: ${response.status}`);
            }
            const htmlContent = await response.text();
            const wrappedContent = this.wrapContentWithScrollControl(htmlContent);
            iframe.src = 'about:blank';
            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(wrappedContent);
                    iframe.contentDocument.close();
                }
            }, 150);
        } catch (error) {
            iframe.src = 'about:blank';
            setTimeout(() => {
                if (iframe.contentDocument) {
                    iframe.contentDocument.open();
                    iframe.contentDocument.write(this.getErrorHTML(filePath, error.message));
                    iframe.contentDocument.close();
                }
            }, 150);
        }
    }

    getLoadingHTML() {
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
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
            scroll-behavior: smooth;
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
        
        .scroll-enable-delay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            z-index: 10000;
            pointer-events: auto;
            opacity: 1;
            transition: opacity 0.3s ease;
        }
        
        .scroll-enable-delay.fade-out {
            opacity: 0;
            pointer-events: none;
        }
        
        .virtual-spacer {
            height: 200vh;
            width: 1px;
            position: absolute;
            top: 0;
            right: 0;
            pointer-events: none;
            visibility: hidden;
            z-index: -1;
        }
    </style>
</head>
<body>
    <div class="scroll-enable-delay" id="scrollDelay"></div>
    <div class="content-wrapper" id="contentWrapper">
        <div class="virtual-spacer"></div>
        ${content}
    </div>
    
    <script>
        (function() {
            let contentStabilized = false;
            let lastContentHeight = 0;
            let autoScrollEnabled = true;
            let userScrolled = false;
            let scrollTimeout = null;
            
            const contentWrapper = document.getElementById('contentWrapper');
            const scrollDelay = document.getElementById('scrollDelay');
            
            function enableScrolling() {
                if (contentStabilized) return;
                contentStabilized = true;
                scrollDelay.classList.add('fade-out');
                setTimeout(() => {
                    if (scrollDelay && scrollDelay.parentNode) {
                        scrollDelay.parentNode.removeChild(scrollDelay);
                    }
                }, 300);
            }
            
            function checkContentHeight() {
                const currentHeight = contentWrapper.scrollHeight;
                if (currentHeight > lastContentHeight) {
                    const scrollPosition = contentWrapper.scrollTop + contentWrapper.clientHeight;
                    const wasNearBottom = scrollPosition >= lastContentHeight - 100;
                    const heightDiff = currentHeight - lastContentHeight;
                    
                    const shouldAutoScroll = heightDiff < 200 || wasNearBottom || lastContentHeight === 0;
                    
                    if (shouldAutoScroll) {
                        setTimeout(() => {
                            contentWrapper.scrollTop = currentHeight - contentWrapper.clientHeight;
                            if (heightDiff < 200) {
                                userScrolled = false;
                                autoScrollEnabled = true;
                            }
                        }, 30);
                    }
                }
                lastContentHeight = currentHeight;
            }
            
            function handleUserScroll() {
                if (!contentStabilized) return;
                
                clearTimeout(scrollTimeout);
                const scrollPosition = contentWrapper.scrollTop + contentWrapper.clientHeight;
                const isAtBottom = scrollPosition >= contentWrapper.scrollHeight - 30;
                
                if (isAtBottom) {
                    userScrolled = false;
                    autoScrollEnabled = true;
                } else {
                    const scrollDistance = Math.abs(contentWrapper.scrollTop - (contentWrapper.scrollHeight - contentWrapper.clientHeight));
                    if (scrollDistance > 100) {
                        userScrolled = true;
                        autoScrollEnabled = false;
                    }
                }
                
                scrollTimeout = setTimeout(() => {
                    const currentScrollPosition = contentWrapper.scrollTop + contentWrapper.clientHeight;
                    const currentIsAtBottom = currentScrollPosition >= contentWrapper.scrollHeight - 30;
                    if (currentIsAtBottom) {
                        userScrolled = false;
                        autoScrollEnabled = true;
                    }
                }, 1500);
            }
            
            contentWrapper.addEventListener('scroll', handleUserScroll);
            
            const observer = new MutationObserver(checkContentHeight);
            observer.observe(contentWrapper, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
            
            setInterval(checkContentHeight, 100);
            
            setTimeout(() => {
                enableScrolling();
                checkContentHeight();
                userScrolled = false;
                autoScrollEnabled = true;
            }, 1000);
        })();
    </script>
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

    calculateMeshDimensions(mesh) {
        if (!mesh || !mesh.geometry) return { realWidth: 1, realHeight: 1 };
        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const worldScale = mesh.getWorldScale(new THREE.Vector3());
        const worldSize = size.clone().multiply(worldScale);
        
        let isTabletDisplay = false;
        let isBusinessCardDisplay = false;
        let current = mesh;
        while (current) {
            if (current.name && current.name.toLowerCase().includes('tablet')) {
                isTabletDisplay = true;
                break;
            }
            if (current.name && (current.name.toLowerCase().includes('business') || current.name.toLowerCase().includes('card'))) {
                isBusinessCardDisplay = true;
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
        
        if (isBusinessCardDisplay) {
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

    // Fixed billboard calculation to face camera
    calculateBillboardQuaternion(position) {
        if (!this.mainCamera) {
            return new THREE.Quaternion();
        }
        
        // CSS3D has different coordinate conventions
        // Apply a 180-degree rotation around Y to face the right direction
        const cameraQuat = this.mainCamera.quaternion.clone();
        const flipQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        cameraQuat.multiply(flipQuat);
        
        return cameraQuat;
    }

    calculateMeshTransform(mesh, assetType = null) {
        if (!mesh) {
            return {
                position: new THREE.Vector3(0, 0, 0),
                quaternion: new THREE.Quaternion()
            };
        }

        if (!mesh.geometry) {
            if (!mesh.userData.referenceGeometry) {
                mesh.userData.referenceGeometry = new THREE.PlaneGeometry(1, 1);
                mesh.userData.referenceGeometry.computeBoundingBox();
            }
            
            const geometry = mesh.userData.referenceGeometry;
            if (!mesh.userData.geometryCache) {
                const center = new THREE.Vector3();
                geometry.boundingBox.getCenter(center);
                mesh.userData.geometryCache = {
                    center: center.clone(),
                    boundingBox: geometry.boundingBox.clone()
                };
            }
            
            const center = mesh.userData.geometryCache.center.clone();
            mesh.localToWorld(center);
            
            const normal = new THREE.Vector3(0, 0, 1);
            const offsetPosition = center.clone();
            offsetPosition.add(normal.clone().multiplyScalar(0.001));
            
            // Use the mesh's world quaternion instead of calculating billboard
            const meshQuaternion = new THREE.Quaternion();
            mesh.getWorldQuaternion(meshQuaternion);
            
            return {
                position: offsetPosition,
                quaternion: meshQuaternion
            };
        }

        if (!mesh.userData.geometryCache) {
            const geometry = mesh.geometry;
            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);
            mesh.userData.geometryCache = {
                center: center.clone(),
                boundingBox: geometry.boundingBox.clone()
            };
        }
        const center = mesh.userData.geometryCache.center.clone();
        mesh.localToWorld(center);
        const meshMatrix = mesh.matrixWorld;
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        meshMatrix.decompose(position, quaternion, scale);
        
        let normal = mesh.userData.cachedNormal;
        if (!normal) {
            normal = new THREE.Vector3(0, 0, 1);
            if (mesh.geometry.attributes.normal) {
                const normalAttribute = mesh.geometry.attributes.normal;
                if (normalAttribute.count > 0) {
                    normal.fromBufferAttribute(normalAttribute, 0);
                    normal.transformDirection(meshMatrix);
                    normal.normalize();
                    mesh.userData.cachedNormal = normal.clone();
                }
            }
        }
        const offsetPosition = center.clone();
        
        let isBusinessCardDisplay = false;
        let current = mesh;
        while (current) {
            if (current.name && (current.name.toLowerCase().includes('business') || current.name.toLowerCase().includes('card'))) {
                isBusinessCardDisplay = true;
                break;
            }
            current = current.parent;
        }
        
        if (isBusinessCardDisplay) {
            offsetPosition.add(normal.clone().multiplyScalar(0.02));
        } else {
            offsetPosition.add(normal.clone().multiplyScalar(0.001));
        }
        
        // Use the mesh's world quaternion instead of calculating billboard
        const meshQuaternion = new THREE.Quaternion();
        mesh.getWorldQuaternion(meshQuaternion);
        
        return {
            position: offsetPosition,
            quaternion: meshQuaternion
        };
    }

    updateFrameTransform(frameTracker) {
        if (!frameTracker.frame || !frameTracker.mesh) return;
        const mesh = frameTracker.mesh;
        const frame = frameTracker.frame;
        
        // Always update transform during camera movement - remove caching
        const transform = this.calculateMeshTransform(mesh, frameTracker.assetType);
        frame.position.copy(transform.position);
        frame.quaternion.copy(transform.quaternion);
        const dimensions = this.calculateMeshDimensions(mesh);
        const scaleX = dimensions.realWidth / 500;
        const scaleY = dimensions.realHeight / 400;
        frame.scale.set(scaleX, scaleY, 1);
    }

    updateFrameTransformImmediate(frameTracker) {       
        if (!frameTracker.frame || !frameTracker.mesh) return;
        const mesh = frameTracker.mesh;
        const frame = frameTracker.frame;
        if (!mesh.userData.previousPosition) {
            mesh.userData.previousPosition = new THREE.Vector3();
            mesh.userData.velocity = new THREE.Vector3();
        }
        const transform = this.calculateMeshTransform(mesh, frameTracker.assetType);
        const currentPos = transform.position;
        const prevPos = mesh.userData.previousPosition;
        mesh.userData.velocity.subVectors(currentPos, prevPos);
        const predictedPosition = currentPos.clone().add(mesh.userData.velocity.clone().multiplyScalar(0.016));
        frame.position.copy(predictedPosition);
        frame.quaternion.copy(transform.quaternion);
        const dimensions = this.calculateMeshDimensions(mesh);
        const scaleX = dimensions.realWidth / 500;
        const scaleY = dimensions.realHeight / 400;
        frame.scale.set(scaleX, scaleY, 1);
        mesh.userData.previousPosition.copy(currentPos);
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            for (const frameTracker of this.frames) {
                if (frameTracker.mesh && frameTracker.frame) {
                    // Remove caching to ensure updates during camera rotation
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