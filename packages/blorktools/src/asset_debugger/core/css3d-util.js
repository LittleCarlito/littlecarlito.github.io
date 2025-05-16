import * as THREE from 'three';
import { animationCss3dObject, animationCss3dRenderer, animationCss3dScene, animationPreviewCamera, initThreeJsPreview, setAnimationCss3dObject, setAnimationCss3dRenderer, setAnimationCss3dScene, setAnimationPreviewCamera, setPreviewRenderTarget } from './preview/threejs-util';
import { createMeshInfoPanel } from './mesh-info-panel-util';
import { getHtmlSettingsForMesh } from './mesh-data-util';
import { isPreviewActive } from './preview/preview-util';
import { showStatus } from '../ui/scripts/html-editor-modal';

/**
 * Initialize CSS3D renderer for HTML preview
 * @param {HTMLElement} container - The container element for the renderers
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
export function initCSS3DPreview(container, iframe, currentMeshId, createInfoPanel = true) {
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
 * Setup the CSS3D scene
 * @param {HTMLElement} container - The container element for the renderers
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
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
        setAnimationCss3dScene(scene);
        setAnimationCss3dRenderer(renderer);
        setAnimationPreviewCamera(camera);

        // Store for replay
        setPreviewRenderTarget(element);
        setAnimationCss3dObject(object);

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