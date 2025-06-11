import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

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
    }

    init(parentElement) {
        if (this.isInitialized) {
            return;
        }

        if (!parentElement) {
            console.error('CSS3DDebugController: Parent element required');
            return;
        }

        try {
            this.scene = new THREE.Scene();
            
            this.camera = new THREE.PerspectiveCamera(50, 300/200, 1, 5000);
            this.camera.position.set(0, 0, 200);

            this.renderer = new CSS3DRenderer();
            this.renderer.setSize(300, 200);
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.top = '80px';
            this.renderer.domElement.style.left = '20px';
            this.renderer.domElement.style.width = '300px';
            this.renderer.domElement.style.height = '200px';
            this.renderer.domElement.style.zIndex = '3000';
            this.renderer.domElement.style.border = '2px solid #00ff88';
            this.renderer.domElement.style.borderRadius = '8px';
            this.renderer.domElement.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.3)';
            this.renderer.domElement.style.pointerEvents = 'none';

            const iframe = document.createElement('iframe');
            iframe.style.width = '300px';
            iframe.style.height = '200px';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '6px';
            iframe.style.overflow = 'hidden';

            this.frame = new CSS3DObject(iframe);
            this.frame.position.set(0, 0, 0);
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
            this.isInitialized = true;
            console.log('CSS3DDebugController initialized');
        } catch (error) {
            console.error('Error initializing CSS3DDebugController:', error);
        }
    }

    startAnimation() {
        if (!this.renderer || !this.scene || !this.camera) {
            return;
        }

        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    cleanup() {
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
        this.isInitialized = false;
        console.log('CSS3DDebugController cleaned up');
    }

    isActive() {
        return this.isInitialized;
    }
}