import * as THREE from 'three';
import { 
    isReversingAnimations,
    pushAnimationStack,
    setCapturingAnimations,
    setReversingAnimation,
    resetCurrentAniamtionBatch, 
    currentAnimationBatch, 
    lastBatchTime, 
    resetReverseAnimationFrameId,
    reverseAnimationFrameId,
    animationStack,
    resetAnimationState
} from '../state/css3d-state';
import { createMeshInfoPanel } from '../../widgets/mesh-info-widget';
import {     
    setAnimationCss3dRenderer,
    setAnimationCss3dScene,
    setAnimationCss3dObject,
    setAnimationPreviewCamera,
    setPreviewRenderTarget,
    animationPreviewCamera
} from '../state/threejs-state';
import { showStatus } from '../../modals/html-editor-modal/html-editor-modal';
import { playNextReverseAnimation } from '../animation/playback/css3d-reversal-controller';
import { setupBounceAnimationTracking } from '../animation/playback/css3d-bounce-controller';
import { isPreviewActive } from '../state/animation-state';
import { calculateMeshTransform } from './css3d-frame-factory';

/**
 * Setup the CSS3D scene
 * @param {HTMLElement} container - The container element for the renderers
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
export function setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject, currentMeshId, createInfoPanel = true) {
    try {
        console.log('Setting up CSS3D scene with container:', container);

        resetAnimationState();
        
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
            // Generate a unique ID for this iframe instance
            const uniqueFrameId = 'frame_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
            
            // Process content to handle typical variable declarations
            // Find script tags and wrap their contents in a function to avoid global variable redeclarations
            let processedContent = content;
            
            // Find all script tags and wrap their contents in a closure to avoid redeclaration issues
            processedContent = processedContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, scriptContent) => {
                // Wrap script content in an IIFE to create a new scope each time
                return `<script>
                (function() { 
                    // Create a new scope for variables
                    ${scriptContent}
                })();
                </script>`;
            });
            
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
                        <div class="content">${processedContent}</div>
                    </body>
                    </html>`;
        };

        // Store the wrapContent function at the global file scope to make it available to other functions
        setupCSS3DScene.wrapContent = wrapContent;
        
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
        let element = document.createElement('iframe');
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
                    
                    // Get detected animation duration from pre-render (animationDuration is in milliseconds)
                    import('../state/animation-state').then(module => {
                        const { animationDuration, isAnimationFinite } = module;
                        
                        // Get animation type from dropdown
                        const animationTypeSelect = document.getElementById('html-animation-type');
                        const animationType = animationTypeSelect ? animationTypeSelect.value : 'play';
                        
                        // Only set up restart timer if:
                        // 1. Animation is finite and has a duration
                        // 2. Animation type is set to "loop" or "bounce"
                        if (isAnimationFinite && animationDuration > 0 && (animationType === 'loop' || animationType === 'bounce')) {
                            console.log(`Setting up CSS3D iframe restart timer for ${animationDuration}ms animation with animation type: ${animationType}`);
                            
                            // Calculate actual duration based on playback speed
                            const actualDuration = animationDuration / playbackSpeed;
                            
                            // For bounce, we need to track animations
                            const isBounceMode = animationType === 'bounce';
                            
                            // Create repeating timer to reload the iframe content
                            const restartTimer = setInterval(() => {
                                if (!isPreviewActive) {
                                    // Clean up timer if preview is no longer active
                                    clearInterval(restartTimer);
                                    return;
                                }
                                
                                // Handle bounce animation differently
                                if (isBounceMode) {
                                    if (!isReversingAnimations) {
                                        // We've reached the end of the forward animation
                                        console.debug('Bounce end reached popping animation stack');
                                        setReversingAnimation(true);
                                        setCapturingAnimations(false);
                                        
                                        // If we have animations in the stack, play them in reverse
                                        if (animationStack.length > 0) {
                                            console.debug(`Animation stack contains ${animationStack.length} items to reverse`);
                                            try {
                                                if (element.contentDocument) {
                                                    // First, ensure any pending animation batch is committed to the stack
                                                    if (currentAnimationBatch.length > 0) {
                                                        console.debug(`Committing final batch of ${currentAnimationBatch.length} animations to stack before reversal`);
                                                        pushAnimationStack({
                                                            type: 'batch',
                                                            animations: [...currentAnimationBatch],
                                                            time: lastBatchTime || Date.now()
                                                        });
                                                        resetCurrentAniamtionBatch();
                                                    }
                                                    
                                                    // Set all animations to pause at end point
                                                    const animElements = element.contentDocument.querySelectorAll('[style*="animation"]');
                                                    animElements.forEach(el => {
                                                        el.style.animationPlayState = 'paused';
                                                    });
                                                    
                                                    // Set all transitions to pause too
                                                    const transElements = element.contentDocument.querySelectorAll('[style*="transition"]');
                                                    transElements.forEach(el => {
                                                        el.style.transitionProperty = 'none';
                                                    });
                                                    
                                                    // Start the first reverse animation
                                                    playNextReverseAnimation(element);
                                                }
                                            } catch (err) {
                                                console.error('Error preparing for reverse animations:', err);
                                            }
                                        } else {
                                            // Stack is empty, odd case
                                            console.debug('Animation stack is empty, restarting cycle');
                                            setReversingAnimation(false);
                                            setCapturingAnimations(true);
                                            resetAndRestartAnimationCycle(element, userHtml);
                                        }
                                    } else {
                                        // We've completed one animation in reverse, continue with the next
                                        if (animationStack.length > 0) {
                                            // Play the next animation in reverse
                                            playNextReverseAnimation(element);
                                        } else {
                                            // No more animations to reverse, cycle complete
                                            console.debug('Animation rewind successful');
                                            setReversingAnimation(false);
                                            setCapturingAnimations(true);
                                            resetAndRestartAnimationCycle(element, userHtml);
                                        }
                                    }
                                } else {
                                    // Normal loop behavior - just restart the content
                                    console.log('Restarting CSS3D preview iframe content');
                                    
                                    // Reload the iframe content to restart all animations from the beginning
                                    try {
                                        if (element.contentDocument) {
                                            // Simply rewrite the content in the existing iframe
                                            element.contentDocument.open();
                                            element.contentDocument.write(wrapContent(userHtml));
                                            element.contentDocument.close();
                                        }
                                    } catch (err) {
                                        console.error('Error reloading iframe content:', err);
                                    }
                                }
                            }, actualDuration);
                            
                            // Store timer reference for cleanup
                            element.restartTimer = restartTimer;
                            
                            // For bounce mode, set up initial animation tracking
                            if (isBounceMode) {
                                setTimeout(() => {
                                    setupBounceAnimationTracking(element);
                                }, 50);
                            }
                        } else {
                            console.log('No finite animation duration detected or using Play animation mode, not setting up restart timer');
                        }
                    });
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

/**
 * Reset and restart the animation cycle with fresh content
 * @param {HTMLIFrameElement} iframe - The iframe to reset
 * @param {string} html - The HTML content to reload
 */
function resetAndRestartAnimationCycle(iframe, html) {
    console.debug('Restarting CSS3D bounce animation cycle');
    try {
        // Access the wrapContent function from the global scope
        const wrapContentFunc = setupCSS3DScene.wrapContent;
        
        if (!wrapContentFunc) {
            console.error('wrapContent function not available, cannot restart animation cycle');
            return;
        }
        
        if (iframe.contentDocument) {
            // Cancel any pending animation operations
            if (reverseAnimationFrameId) {
                cancelAnimationFrame(reverseAnimationFrameId);
                resetReverseAnimationFrameId();
            }
            
            // Clean up the mutation observer if it exists
            if (iframe.mutationObserver) {
                iframe.mutationObserver.disconnect();
                iframe.mutationObserver = null;
            }
            
            // First, clear all content to a blank slate
            iframe.contentDocument.open();
            iframe.contentDocument.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        html, body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            height: 100%;
                            overflow: hidden;
                            background-color: white;
                        }
                    </style>
                </head>
                <body></body>
                </html>
            `);
            iframe.contentDocument.close();
            
            // Give a brief moment to ensure cleanup
            setTimeout(() => {
                resetAnimationState();
                
                // Now reload the real content
                iframe.contentDocument.open();
                iframe.contentDocument.write(wrapContentFunc(html));
                iframe.contentDocument.close();
                
                // Set up animation tracking for the new cycle
                setTimeout(() => {
                    setupBounceAnimationTracking(iframe);
                }, 50);
            }, 100); // Longer timeout for better cleanup
        }
    } catch (err) {
        console.error('Error restarting animation cycle:', err);
    }
}

export function cleanupCSS3D(targetElement = null) {
   resetAnimationState();
   
   if (reverseAnimationFrameId) {
       cancelAnimationFrame(reverseAnimationFrameId);
       resetReverseAnimationFrameId();
   }
   
   const iframe = targetElement || document.getElementById('css3d-panel-iframe');
   if (iframe) {
       if (iframe.restartTimer) {
           clearInterval(iframe.restartTimer);
           iframe.restartTimer = null;
       }
       
       if (iframe._animationStartHandler && iframe.contentDocument) {
           iframe.contentDocument.removeEventListener('animationstart', iframe._animationStartHandler);
           iframe._animationStartHandler = null;
       }
       
       if (iframe._transitionStartHandler && iframe.contentDocument) {
           iframe.contentDocument.removeEventListener('transitionstart', iframe._transitionStartHandler);
           iframe._transitionStartHandler = null;
       }
       
       if (iframe.mutationObserver) {
           iframe.mutationObserver.disconnect();
           iframe.mutationObserver = null;
       }
   }
}

export function addFrameToScene(frame, scene, mesh, frameConfig) {
    const { realWidth, realHeight, frameWidth, frameHeight, offsetDistance = 0.001 } = frameConfig;
    
    const transform = calculateMeshTransform(mesh, offsetDistance);
    frame.position.copy(transform.position);
    frame.rotation.copy(transform.rotation);
    frame.quaternion.copy(transform.quaternion);
    
    const scaleX = realWidth / frameWidth;
    const scaleY = realHeight / frameHeight;
    frame.scale.set(scaleX, scaleY, 1);
    
    scene.add(frame);
}
