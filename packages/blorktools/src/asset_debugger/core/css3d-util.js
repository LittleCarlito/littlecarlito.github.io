import * as THREE from 'three';
import { animationCss3dObject, animationCss3dRenderer, animationCss3dScene, animationPreviewCamera, initThreeJsPreview, setAnimationCss3dObject, setAnimationCss3dRenderer, setAnimationCss3dScene, setAnimationPreviewCamera, setPreviewRenderTarget } from './preview/threejs-util';
import { createMeshInfoPanel } from './mesh-info-panel-util';
import { getHtmlSettingsForMesh } from './mesh-data-util';
import { isPreviewActive } from './preview/preview-util';
import { showStatus } from '../ui/scripts/html-editor-modal';

// Add animation stack tracking variables at the top of the file
let animationStack = [];
let isReversingAnimations = false;
// Add flag to disable animation capture during reversal
let isCapturingAnimations = true;
// Store animation properties to properly reverse them
let animationProperties = {};
// Store timestamps for calculating delays
let lastAnimationTime = 0;
// Animation frame tracking
let reverseAnimationFrameId = null;
// Add animation batch tracking for composite effects
let currentAnimationBatch = [];
let batchTimeWindow = 50; // ms window to consider animations as part of the same batch
let lastBatchTime = 0;

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

        // Clear existing animation stack
        animationStack = [];
        isReversingAnimations = false;
        isCapturingAnimations = true;
        animationProperties = {};
        lastAnimationTime = Date.now(); // Initialize time tracking
        currentAnimationBatch = []; // Initialize current batch
        lastBatchTime = 0; // Reset batch time
        
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
                    import('../core/animation-util').then(module => {
                        const { animationDuration, isAnimationFinite } = module;
                        
                        // Get animation type from dropdown
                        const animationTypeSelect = document.getElementById('html-animation-type');
                        const animationType = animationTypeSelect ? animationTypeSelect.value : 'none';
                        
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
                                        isReversingAnimations = true;
                                        isCapturingAnimations = false; // Disable capturing during reversal
                                        
                                        // If we have animations in the stack, play them in reverse
                                        if (animationStack.length > 0) {
                                            console.debug(`Animation stack contains ${animationStack.length} items to reverse`);
                                            try {
                                                if (element.contentDocument) {
                                                    // First, ensure any pending animation batch is committed to the stack
                                                    if (currentAnimationBatch.length > 0) {
                                                        console.debug(`Committing final batch of ${currentAnimationBatch.length} animations to stack before reversal`);
                                                        animationStack.push({
                                                            type: 'batch',
                                                            animations: [...currentAnimationBatch],
                                                            time: lastBatchTime || Date.now()
                                                        });
                                                        currentAnimationBatch = []; // Clear the batch
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
                                            isReversingAnimations = false;
                                            isCapturingAnimations = true; // Re-enable capturing
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
                                            isReversingAnimations = false;
                                            isCapturingAnimations = true; // Re-enable capturing
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
                            console.log('No finite animation duration detected, not setting up restart timer');
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

// Add a function to clear any restart timers when cleaning up
export function cleanupCSS3DPreview() {
    // Clear animation stack and state
    animationStack = [];
    isReversingAnimations = false;
    isCapturingAnimations = true;
    animationProperties = {};
    
    // Cancel any pending animation frame
    if (reverseAnimationFrameId) {
        cancelAnimationFrame(reverseAnimationFrameId);
        reverseAnimationFrameId = null;
    }
    
    const previewIframe = document.getElementById('css3d-panel-iframe');
    if (previewIframe) {
        // Clear any restart timer
        if (previewIframe.restartTimer) {
            clearInterval(previewIframe.restartTimer);
            previewIframe.restartTimer = null;
        }
        
        // Clean up the mutation observer if it exists
        if (previewIframe.mutationObserver) {
            previewIframe.mutationObserver.disconnect();
            previewIframe.mutationObserver = null;
        }
    }
    
    console.debug('CSS3D preview cleanup complete');
}

/**
 * Set up bounce animation tracking for the iframe
 * @param {HTMLIFrameElement} iframe - The iframe to track animations in
 */
function setupBounceAnimationTracking(iframe) {
    try {
        // Clear existing animation stack
        animationStack = [];
        isReversingAnimations = false;
        isCapturingAnimations = true;
        animationProperties = {};
        lastAnimationTime = Date.now(); // Initialize time tracking
        currentAnimationBatch = []; // Initialize current batch
        lastBatchTime = 0; // Reset batch time
        
        if (iframe.contentDocument) {
            console.debug('Setting up animation tracking for bounce mode');
            
            // Add MutationObserver to detect DOM changes and capture initial states
            setupMutationObserver(iframe);
            
            // Track all animations that start
            iframe.contentDocument.addEventListener('animationstart', (event) => {
                // Skip if we're in reversal mode and not capturing
                if (!isCapturingAnimations) return;
                
                const now = Date.now();
                
                // If there was a delay since the last animation, add a delay entry to the stack
                const timeSinceLastAnimation = now - lastAnimationTime;
                
                // Check if this animation should start a new batch
                if (timeSinceLastAnimation > batchTimeWindow || currentAnimationBatch.length === 0) {
                    // If we have items in the current batch, push it to the stack
                    if (currentAnimationBatch.length > 0) {
                        animationStack.push({
                            type: 'batch',
                            animations: [...currentAnimationBatch],
                            time: lastBatchTime
                        });
                        console.debug(`Added batch of ${currentAnimationBatch.length} animations to stack`);
                        currentAnimationBatch = []; // Reset the batch
                    }
                    
                    // If there's a significant delay, add a delay marker
                    if (timeSinceLastAnimation > batchTimeWindow) {
                        animationStack.push({
                            type: 'delay',
                            duration: timeSinceLastAnimation,
                            time: now
                        });
                        console.debug(`Delay added to stack: ${timeSinceLastAnimation}ms`);
                    }
                    
                    // Update batch time
                    lastBatchTime = now;
                }
                
                // Generate a unique selector for this element
                const uniqueSelector = generateUniqueSelector(event.target);
                
                // Store animation properties
                const animatedElement = event.target;
                const animationName = event.animationName;
                const computedStyle = window.getComputedStyle(animatedElement);
                
                // Capture parent info for potential DOM recreation
                let parentSelector = null;
                if (animatedElement.parentElement) {
                    parentSelector = generateUniqueSelector(animatedElement.parentElement);
                }
                
                // Capture the animation properties from the computed style
                const animDuration = parseFloat(computedStyle.animationDuration) || 0.3;
                const animDelay = parseFloat(computedStyle.animationDelay) || 0;
                const animTiming = computedStyle.animationTimingFunction || 'ease';
                const animFillMode = computedStyle.animationFillMode || 'none';
                
                // Get initial style snapshot before animation fully applies
                const initialStyle = {
                    opacity: computedStyle.opacity,
                    transform: computedStyle.transform,
                    visibility: computedStyle.visibility,
                    display: computedStyle.display,
                    width: computedStyle.width,
                    height: computedStyle.height,
                    top: computedStyle.top,
                    left: computedStyle.left,
                    position: computedStyle.position,
                    parentSelector: parentSelector
                };
                
                // Capture final state after animation is complete
                // We use a timeout to capture the state at the end of the animation
                const durationMs = animDuration * 1000;
                setTimeout(() => {
                    try {
                        if (animatedElement && iframe.contentDocument.contains(animatedElement)) {
                            const finalComputedStyle = window.getComputedStyle(animatedElement);
                            const finalStyle = {
                                opacity: finalComputedStyle.opacity,
                                transform: finalComputedStyle.transform,
                                visibility: finalComputedStyle.visibility,
                                display: finalComputedStyle.display,
                                width: finalComputedStyle.width,
                                height: finalComputedStyle.height,
                                top: finalComputedStyle.top,
                                left: finalComputedStyle.left,
                                position: finalComputedStyle.position
                            };
                            
                            // Store the final state in our properties map
                            const propKey = `${uniqueSelector}:${animationName}`;
                            if (animationProperties[propKey]) {
                                animationProperties[propKey].finalStyle = finalStyle;
                                console.debug(`Captured final state for: ${propKey}`);
                            }
                        }
                    } catch (err) {
                        console.debug('Error capturing final animation state:', err);
                    }
                }, durationMs + 50); // Add a small buffer to ensure animation is complete
                
                // Get the animation properties for reverse playback
                const properties = {
                    name: animationName,
                    selector: uniqueSelector,
                    elementTagName: animatedElement.tagName,
                    elementId: animatedElement.id,
                    elementClasses: animatedElement.className,
                    cssText: animatedElement.style.cssText,
                    parentSelector: parentSelector,
                    type: 'animation',
                    // Animation specifics
                    duration: animDuration,
                    delay: animDelay,
                    timingFunction: animTiming,
                    fillMode: animFillMode,
                    initialStyle: initialStyle,
                    // Record animation type
                    classified: classifyAnimation(animationName, initialStyle),
                    time: now
                };
                
                // Save animation properties
                const key = `${uniqueSelector}:${animationName}`;
                animationProperties[key] = properties;
                
                // Add to current batch instead of directly to stack
                currentAnimationBatch.push(properties);
                console.debug(`Animation added to current batch: ${animationName}, batch size: ${currentAnimationBatch.length}`);
                
                // Update time tracking
                lastAnimationTime = now;
            });
            
            // Also track transitions
            iframe.contentDocument.addEventListener('transitionstart', (event) => {
                // Skip if we're in reversal mode and not capturing
                if (!isCapturingAnimations) return;
                
                const now = Date.now();
                
                // If there was a delay since the last animation, and we have a batch to save
                const timeSinceLastAnimation = now - lastAnimationTime;
                
                // Check if this transition should start a new batch
                if (timeSinceLastAnimation > batchTimeWindow || currentAnimationBatch.length === 0) {
                    // If we have items in the current batch, push it to the stack
                    if (currentAnimationBatch.length > 0) {
                        animationStack.push({
                            type: 'batch',
                            animations: [...currentAnimationBatch],
                            time: lastBatchTime
                        });
                        console.debug(`Added batch of ${currentAnimationBatch.length} animations to stack`);
                        currentAnimationBatch = []; // Reset the batch
                    }
                    
                    // If there's a significant delay, add a delay marker
                    if (timeSinceLastAnimation > batchTimeWindow) {
                        animationStack.push({
                            type: 'delay',
                            duration: timeSinceLastAnimation,
                            time: now
                        });
                        console.debug(`Delay added to stack: ${timeSinceLastAnimation}ms`);
                    }
                    
                    // Update batch time
                    lastBatchTime = now;
                }
                
                // Only track if it's a property we care about for visual animations
                const relevantProperties = ['opacity', 'transform', 'left', 'top', 'right', 'bottom', 'height', 'width'];
                if (!relevantProperties.includes(event.propertyName)) return;
                
                // Generate a unique selector for this element
                const uniqueSelector = generateUniqueSelector(event.target);
                
                // Store transition properties
                const transitionElement = event.target;
                const propertyName = event.propertyName;
                const computedStyle = window.getComputedStyle(transitionElement);
                
                // Capture parent info for potential DOM recreation
                let parentSelector = null;
                if (transitionElement.parentElement) {
                    parentSelector = generateUniqueSelector(transitionElement.parentElement);
                }
                
                // Capture full transition properties
                const transDuration = parseFloat(computedStyle.transitionDuration) || 0.3;
                const transDelay = parseFloat(computedStyle.transitionDelay) || 0;
                const transTiming = computedStyle.transitionTimingFunction || 'ease';
                
                // Get initial snapshot before transition fully applies
                const initialStyle = {};
                relevantProperties.forEach(prop => {
                    initialStyle[prop] = computedStyle[prop];
                });
                
                // Add parent selector to initial style
                initialStyle.parentSelector = parentSelector;
                
                // Remember initial value for this property
                const initialValue = computedStyle[propertyName];
                transitionElement.setAttribute(`data-initial-${propertyName}`, initialValue);
                
                // Capture final state after transition is complete
                const durationMs = transDuration * 1000;
                setTimeout(() => {
                    try {
                        if (transitionElement && iframe.contentDocument.contains(transitionElement)) {
                            const finalComputedStyle = window.getComputedStyle(transitionElement);
                            const finalValue = finalComputedStyle[propertyName];
                            
                            // Store the final value
                            const propKey = `${uniqueSelector}:${propertyName}`;
                            if (animationProperties[propKey]) {
                                animationProperties[propKey].finalValue = finalValue;
                                console.debug(`Captured final value for: ${propKey} = ${finalValue}`);
                            }
                        }
                    } catch (err) {
                        console.debug('Error capturing final transition state:', err);
                    }
                }, durationMs + 50);
                
                // Create transition info object
                const properties = {
                    name: `transition-${propertyName}`,
                    selector: uniqueSelector,
                    elementTagName: transitionElement.tagName,
                    elementId: transitionElement.id,
                    elementClasses: transitionElement.className,
                    property: propertyName,
                    cssText: transitionElement.style.cssText,
                    parentSelector: parentSelector,
                    type: 'transition',
                    // Transition specifics
                    duration: transDuration,
                    delay: transDelay,
                    timingFunction: transTiming,
                    initialStyle: initialStyle,
                    initialValue: initialValue,
                    // Classify what kind of transition this is
                    classified: classifyTransition(propertyName, initialValue, computedStyle[propertyName]),
                    time: now
                };
                
                // Save transition properties
                const key = `${uniqueSelector}:${propertyName}`;
                animationProperties[key] = properties;
                
                // Add to current batch instead of directly to stack
                currentAnimationBatch.push(properties);
                console.debug(`Transition added to current batch: ${propertyName}, batch size: ${currentAnimationBatch.length}`);
                
                // Update time tracking
                lastAnimationTime = now;
            });
        }
    } catch (err) {
        console.error('Error setting up animation tracking:', err);
    }
}

/**
 * Set up a MutationObserver to track DOM changes
 * @param {HTMLIFrameElement} iframe - The iframe to observe
 */
function setupMutationObserver(iframe) {
    if (!iframe.contentDocument) return;
    
    // Create an observer to watch for new elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                // For added nodes, capture their initial state
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        captureElementInitialState(node);
                    }
                });
            }
        });
    });
    
    // Start observing the document
    observer.observe(iframe.contentDocument.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
    
    // Store reference for cleanup
    iframe.mutationObserver = observer;
}

/**
 * Capture initial state of an element for better animation tracking
 * @param {Element} element - Element to capture
 */
function captureElementInitialState(element) {
    try {
        const computedStyle = window.getComputedStyle(element);
        
        // Store initial opacity if not already set
        if (!element.hasAttribute('data-initial-opacity')) {
            element.setAttribute('data-initial-opacity', computedStyle.opacity);
        }
        
        // Store initial transform if not already set
        if (!element.hasAttribute('data-initial-transform')) {
            element.setAttribute('data-initial-transform', computedStyle.transform);
        }
        
        // Store initial display and visibility if not already set
        if (!element.hasAttribute('data-initial-display')) {
            element.setAttribute('data-initial-display', computedStyle.display);
        }
        
        if (!element.hasAttribute('data-initial-visibility')) {
            element.setAttribute('data-initial-visibility', computedStyle.visibility);
        }
        
        // Store position properties
        const positionProps = ['top', 'left', 'right', 'bottom', 'width', 'height'];
        positionProps.forEach(prop => {
            if (!element.hasAttribute(`data-initial-${prop}`)) {
                element.setAttribute(`data-initial-${prop}`, computedStyle[prop]);
            }
        });
        
        // Special handling for elements that might be dynamically added
        // Store the parent in a data attribute if this is a new element
        if (!element.hasAttribute('data-parent-selector') && element.parentElement) {
            const parentSelector = generateUniqueSelector(element.parentElement);
            element.setAttribute('data-parent-selector', parentSelector);
        }
        
        // Store the original display state
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
            element.setAttribute('data-was-hidden', 'true');
        } else {
            element.setAttribute('data-was-hidden', 'false');
        }
        
        // Recursively process child elements
        Array.from(element.children).forEach(captureElementInitialState);
    } catch (err) {
        console.debug('Error capturing element state:', err);
    }
}

/**
 * Classify the type of animation based on name and initial style
 * @param {string} animationName - The animation name
 * @param {Object} initialStyle - Initial computed style
 * @returns {Object} Classification information
 */
function classifyAnimation(animationName, initialStyle) {
    const name = animationName.toLowerCase();
    
    // Build a classification object
    const classification = {
        isFadeIn: name.includes('fadein') || (name.includes('fade') && name.includes('in')),
        isFadeOut: name.includes('fadeout') || (name.includes('fade') && name.includes('out')),
        isSlideIn: name.includes('slidein') || (name.includes('slide') && name.includes('in')),
        isSlideOut: name.includes('slideout') || (name.includes('slide') && name.includes('out')),
        isZoomIn: name.includes('zoomin') || (name.includes('zoom') && name.includes('in')),
        isZoomOut: name.includes('zoomout') || (name.includes('zoom') && name.includes('out')),
        isBounce: name.includes('bounce'),
        isRotate: name.includes('rotate'),
        isPulse: name.includes('pulse'),
        isFlash: name.includes('flash'),
        isShake: name.includes('shake'),
        isWobble: name.includes('wobble'),
        isJello: name.includes('jello'),
        isFlip: name.includes('flip'),
        isHeartBeat: name.includes('heartbeat') || name.includes('heart-beat'),
        isHinge: name.includes('hinge'),
        isBlink: name.includes('blink')
    };
    
    // Determine animation category
    if (classification.isFadeIn || classification.isFadeOut) {
        classification.category = 'fade';
    } else if (classification.isSlideIn || classification.isSlideOut) {
        classification.category = 'slide';
    } else if (classification.isZoomIn || classification.isZoomOut) {
        classification.category = 'zoom';
    } else if (classification.isRotate) {
        classification.category = 'rotate';
    } else if (classification.isBounce || classification.isPulse || classification.isFlash || 
               classification.isShake || classification.isWobble || classification.isJello || 
               classification.isFlip || classification.isHeartBeat || classification.isHinge || 
               classification.isBlink) {
        classification.category = 'attention';
    } else {
        classification.category = 'other';
    }
    
    return classification;
}

/**
 * Classify the type of transition
 * @param {string} property - The CSS property being transitioned
 * @param {string} initialValue - Starting value
 * @param {string} currentValue - Current value during transition
 * @returns {Object} Classification information
 */
function classifyTransition(property, initialValue, currentValue) {
    const classification = {
        property: property
    };
    
    // Determine transition type based on property
    switch (property) {
        case 'opacity':
            const initialOpacity = parseFloat(initialValue) || 0;
            const currentOpacity = parseFloat(currentValue) || 0;
            classification.isFadeIn = initialOpacity < currentOpacity;
            classification.isFadeOut = initialOpacity > currentOpacity;
            classification.category = 'fade';
            break;
            
        case 'transform':
            if (initialValue.includes('scale')) {
                const initialScale = extractScaleValue(initialValue);
                const currentScale = extractScaleValue(currentValue);
                classification.isZoomIn = initialScale < currentScale;
                classification.isZoomOut = initialScale > currentScale;
                classification.category = 'zoom';
            } else if (initialValue.includes('rotate')) {
                classification.isRotate = true;
                classification.category = 'rotate';
            } else if (initialValue.includes('translate')) {
                classification.isMove = true;
                classification.category = 'move';
            } else {
                classification.category = 'transform';
            }
            break;
            
        case 'left':
        case 'right':
        case 'top':
        case 'bottom':
            classification.isMove = true;
            classification.category = 'move';
            break;
            
        case 'width':
        case 'height':
            const initialSize = parseFloat(initialValue) || 0;
            const currentSize = parseFloat(currentValue) || 0;
            classification.isExpand = initialSize < currentSize;
            classification.isShrink = initialSize > currentSize;
            classification.category = 'size';
            break;
            
        default:
            classification.category = 'other';
    }
    
    return classification;
}

/**
 * Extract scale value from a transform string
 * @param {string} transform - CSS transform value
 * @returns {number} Extracted scale or 1 if not found
 */
function extractScaleValue(transform) {
    try {
        const scaleMatch = transform.match(/scale\(([^)]+)\)/);
        if (scaleMatch && scaleMatch[1]) {
            return parseFloat(scaleMatch[1]) || 1;
        }
        
        const scale3dMatch = transform.match(/scale3d\(([^,]+),/);
        if (scale3dMatch && scale3dMatch[1]) {
            return parseFloat(scale3dMatch[1]) || 1;
        }
    } catch (e) {}
    
    return 1;
}

/**
 * Create opposite animation for an animation property
 * @param {string} animationName - Original animation name
 * @param {Object} classification - Animation classification
 * @returns {string} Opposite animation name
 */
function getOppositeAnimation(animationName, classification) {
    if (!animationName) return '';
    
    // If we have a valid classification, use it
    if (classification) {
        if (classification.isFadeIn) return animationName.replace(/fadein|fade-in|fade-in/i, 'fadeout');
        if (classification.isFadeOut) return animationName.replace(/fadeout|fade-out|fade-out/i, 'fadein');
        if (classification.isSlideIn) return animationName.replace(/slidein|slide-in|slide-in/i, 'slideout');
        if (classification.isSlideOut) return animationName.replace(/slideout|slide-out|slide-out/i, 'slidein');
        if (classification.isZoomIn) return animationName.replace(/zoomin|zoom-in|zoom-in/i, 'zoomout');
        if (classification.isZoomOut) return animationName.replace(/zoomout|zoom-out|zoom-out/i, 'zoomin');
    }
    
    const name = animationName.toLowerCase();
    
    // Common animation pairs
    const pairs = {
        'fadein': 'fadeout',
        'fade-in': 'fade-out',
        'fadeout': 'fadein',
        'fade-out': 'fade-in',
        'slidein': 'slideout',
        'slide-in': 'slide-out',
        'slideout': 'slidein',
        'slide-out': 'slide-in',
        'zoomin': 'zoomout',
        'zoom-in': 'zoom-out',
        'zoomout': 'zoomin',
        'zoom-out': 'zoom-in',
        'rotatein': 'rotateout',
        'rotate-in': 'rotate-out',
        'rotateout': 'rotatein',
        'rotate-out': 'rotate-in',
        'scalein': 'scaleout',
        'scale-in': 'scale-out',
        'scaleout': 'scalein',
        'scale-out': 'scale-in',
        'expand': 'collapse',
        'collapse': 'expand',
        'show': 'hide',
        'hide': 'show',
        'open': 'close',
        'close': 'open'
    };
    
    // Check for each pattern in the animation name
    for (const [pattern, opposite] of Object.entries(pairs)) {
        if (name.includes(pattern)) {
            // Replace the pattern with its opposite
            return animationName.replace(new RegExp(pattern, 'i'), opposite);
        }
    }
    
    // If no specific pattern is found, just use reverse
    return animationName;
}

/**
 * Play the next animation in reverse from the stack
 * @param {HTMLIFrameElement} iframe - The iframe containing animations
 */
function playNextReverseAnimation(iframe) {
    if (animationStack.length === 0) {
        console.debug('No more animations to play in reverse');
        return;
    }
    
    // Cancel any pending reverse animation
    if (reverseAnimationFrameId) {
        cancelAnimationFrame(reverseAnimationFrameId);
        reverseAnimationFrameId = null;
    }
    
    // Pop the next animation from the stack
    const nextItem = animationStack.pop();
    
    // Check if this is a delay marker
    if (nextItem.type === 'delay') {
        console.debug(`Processing delay of ${nextItem.duration}ms`);
        // For delays, wait the specified time before processing the next animation
        setTimeout(() => {
            playNextReverseAnimation(iframe);
        }, nextItem.duration);
        return;
    }
    
    // Check if this is a batch of animations
    if (nextItem.type === 'batch') {
        console.debug(`Playing batch of ${nextItem.animations.length} animations in reverse`);
        
        // Process each animation in the batch simultaneously
        const animations = nextItem.animations;
        let maxDuration = 0;
        
        // First pass to find elements and calculate max duration
        animations.forEach(animation => {
            // Find the target element for this animation
            const target = findTargetElement(iframe, animation);
            animation._target = target; // Store the found target for use in the second pass
            
            // Track the maximum duration in this batch
            const duration = (animation.duration || 0.3) * 1000;
            if (duration > maxDuration) {
                maxDuration = duration;
            }
        });
        
        // Second pass to apply all animations simultaneously
        animations.forEach(animation => {
            const target = animation._target;
            if (!target) {
                console.debug(`No element found for animation: ${animation.name || 'unnamed'}`);
                return;
            }
            
            try {
                // Apply the reverse animation based on type
                if (animation.type === 'transition') {
                    applyReverseTransition(target, animation);
                } else {
                    applyReverseAnimation(target, animation);
                }
            } catch (err) {
                console.error('Error applying reverse animation in batch:', err);
            }
        });
        
        // Wait for the longest animation in the batch to complete before proceeding
        setTimeout(() => {
            playNextReverseAnimation(iframe);
        }, maxDuration + 50); // Add small buffer
        
        return;
    }
    
    // For backward compatibility - handle individual animation item
    console.debug(`Playing individual animation in reverse: ${nextItem.name || 'unnamed'}`);
    
    // Try multiple strategies to find the element
    const target = findTargetElement(iframe, nextItem);
    
    if (!target) {
        console.debug(`No element found for animation: ${nextItem.name}`);
        // Continue with the next animation after a short delay
        setTimeout(() => {
            playNextReverseAnimation(iframe);
        }, 50);
        return;
    }
    
    // Apply appropriate reversal based on animation type
    try {
        if (nextItem.type === 'transition') {
            // Handle transitions using stored initial/target values
            applyReverseTransition(target, nextItem);
        } else {
            // Handle CSS animations using more intelligent logic
            applyReverseAnimation(target, nextItem);
        }
        
        // Calculate when to play the next animation
        const totalDuration = (nextItem.duration || 0.3) * 1000;
        
        // After this animation completes, play the next one
        setTimeout(() => {
            playNextReverseAnimation(iframe);
        }, totalDuration + 50); // Add a small buffer
    } catch (err) {
        console.error('Error applying reverse animation:', err);
        // Continue with the next animation
        setTimeout(() => {
            playNextReverseAnimation(iframe);
        }, 50);
    }
}

/**
 * Helper function to find the target element for an animation
 * @param {HTMLIFrameElement} iframe - The iframe containing the document
 * @param {Object} animation - The animation data
 * @returns {Element|null} The found element or null
 */
function findTargetElement(iframe, animation) {
    if (!iframe || !animation) return null;
    
    let target = null;
    try {
        if (iframe.contentDocument) {
            // Strategy 1: Try the stored selector
            if (animation.selector) {
                console.debug(`Finding element with selector: ${animation.selector}`);
                try {
                    target = iframe.contentDocument.querySelector(animation.selector);
                } catch (selectorErr) {
                    console.debug(`Invalid selector: ${animation.selector}`);
                }
            }
            
            // Strategy 2: Try by ID
            if (!target && animation.elementId) {
                console.debug(`Finding element by ID: ${animation.elementId}`);
                target = iframe.contentDocument.getElementById(animation.elementId);
            }
            
            // Strategy 3: Try by tag and class
            if (!target && animation.elementTagName) {
                console.debug(`Finding element by tag+class`);
                const className = animation.elementClasses || '';
                const tagName = animation.elementTagName.toLowerCase();
                
                // If we have classes, try using them in the selector
                if (className) {
                    try {
                        // Handle space-separated class names
                        const classes = className.split(' ').join('.');
                        const complexSelector = classes ? `${tagName}.${classes}` : tagName;
                        target = iframe.contentDocument.querySelector(complexSelector);
                    } catch (complexErr) {
                        console.debug(`Complex selector failed, trying tag name only`);
                    }
                }
                
                // If still no target, try just by tag name
                if (!target) {
                    const elements = iframe.contentDocument.getElementsByTagName(tagName);
                    if (elements.length > 0) {
                        target = elements[0];
                        console.debug(`Finding element by tag name: ${tagName}, found ${elements.length}`);
                    }
                }
            }
            
            // Strategy 4: For fadeIn/fadeOut elements - try a looser match by animation name
            if (!target && animation.type === 'animation' && 
                animation.name.toLowerCase().includes('fade')) {
                console.debug(`Trying looser match for fade animation`);
                
                // Try to find elements that might be visible
                const possibleTargets = iframe.contentDocument.querySelectorAll('div, span, p');
                for (const el of possibleTargets) {
                    // If it's visible, it could be our fade target
                    const style = window.getComputedStyle(el);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && 
                        parseFloat(style.opacity) > 0) {
                        target = el;
                        console.debug(`Found possible fade target: ${el.tagName}`);
                        break;
                    }
                }
            }
            
            // Strategy 5: Check if this is an element that was removed and needs to be re-added
            // Look for removed elements (especially for animations like fadeout, slideout, etc.)
            if (!target) {
                console.debug('This element may have been removed from the DOM, attempting to recreate it');
                
                // For elements with a clear parent selector, try to recreate them
                let parentElement = null;
                
                // First try to find the parent from stored selectors
                if (animation.parentSelector) {
                    parentElement = iframe.contentDocument.querySelector(animation.parentSelector);
                } else if (animation.initialStyle && animation.initialStyle.parentSelector) {
                    parentElement = iframe.contentDocument.querySelector(animation.initialStyle.parentSelector);
                } else if (animation.selector) {
                    // Try to extract a parent selector from the element's selector
                    const selectorParts = animation.selector.split('>');
                    if (selectorParts.length > 1) {
                        // Remove the last part (the element itself) and join the parent parts
                        const parentSelector = selectorParts.slice(0, -1).join('>').trim();
                        if (parentSelector) {
                            try {
                                parentElement = iframe.contentDocument.querySelector(parentSelector);
                                console.debug(`Found parent using selector part: ${parentSelector}`);
                            } catch (err) {
                                console.debug(`Error finding parent with selector: ${parentSelector}`);
                            }
                        }
                    }
                }
                
                // If no specific parent found, try fallback to common containers
                if (!parentElement) {
                    // For typing indicators, try to find the chat or typing container
                    if (animation.name.toLowerCase().includes('blink') || 
                        (animation.elementClasses && animation.elementClasses.includes('typing'))) {
                        // Look for typing container first
                        parentElement = iframe.contentDocument.querySelector('.typing');
                        
                        // If no typing container, look for chat container
                        if (!parentElement) {
                            parentElement = iframe.contentDocument.querySelector('#chat, .chat, .messages, .conversation');
                            
                            // If chat container found but no typing container, create typing container
                            if (parentElement && !iframe.contentDocument.querySelector('.typing')) {
                                const typingDiv = iframe.contentDocument.createElement('div');
                                typingDiv.className = 'typing';
                                parentElement.appendChild(typingDiv);
                                parentElement = typingDiv;
                                console.debug('Created new typing container in chat');
                            }
                        }
                    }
                }
                
                // If we found a parent element, try to recreate the missing element
                if (parentElement) {
                    console.debug(`Found parent element ${parentElement.tagName}, recreating removed element`);
                    
                    // Create a new element of the right type
                    const newElement = iframe.contentDocument.createElement(
                        animation.elementTagName || 'div'
                    );
                    
                    // Add any classes it had
                    if (animation.elementClasses) {
                        newElement.className = animation.elementClasses;
                    }
                    
                    // Add ID if it had one
                    if (animation.elementId) {
                        newElement.id = animation.elementId;
                    }
                    
                    // Handle special case for blink animations (like typing indicators)
                    if (animation.name.toLowerCase().includes('blink')) {
                        // For blink animations, set initial styles and content
                        newElement.style.opacity = '0';
                        
                        // If it's a typing indicator dot, add the dot content
                        if (animation.selector && animation.selector.includes('span')) {
                            newElement.textContent = '•';
                            console.debug('Added typing indicator dot content');
                        }
                    } else {
                        // For other animations, start with initial display state
                        newElement.style.display = 'none';
                        newElement.style.opacity = '0';
                    }
                    
                    // Try to position the element correctly in the parent
                    // Check the selector to determine position
                    let position = 0;
                    if (animation.selector) {
                        // Extract nth-child information if available
                        const nthChildMatch = animation.selector.match(/:nth-child\((\d+)\)/);
                        if (nthChildMatch && nthChildMatch[1]) {
                            position = parseInt(nthChildMatch[1]) - 1;
                            console.debug(`Found position from selector: ${position}`);
                        }
                    }
                    
                    // Insert at the right position if possible
                    if (position > 0 && position < parentElement.children.length) {
                        parentElement.insertBefore(newElement, parentElement.children[position]);
                        console.debug(`Inserted element at position ${position}`);
                    } else {
                        // Otherwise append to the end
                        parentElement.appendChild(newElement);
                        console.debug(`Appended element to parent`);
                    }
                    
                    // Use this as our target
                    target = newElement;
                    
                    console.debug(`Created new element to replace removed one: ${animation.elementTagName || 'div'}`);
                } else {
                    console.debug('Could not find parent element, cannot recreate removed element');
                }
            }
        }
    } catch (err) {
        console.error('Error finding element:', err);
    }
    
    return target;
}

/**
 * Apply a reverse CSS animation intelligently
 * @param {Element} target - The target element
 * @param {Object} animation - The animation data
 */
function applyReverseAnimation(target, animation) {
    if (!target || !animation) return;
    
    console.debug(`Found element for animation: ${animation.name}`);
    
    const classified = animation.classified || {};
    const initialStyle = animation.initialStyle || {};
    const finalStyle = animation.finalStyle || {};
    
    // Use the animation's own duration or default to 0.3s
    const duration = animation.duration || 0.3;
    const timing = animation.timingFunction || 'ease';
    
    // Special handling for blink animations (typing indicators)
    if (animation.name.toLowerCase().includes('blink')) {
        console.debug(`Applying reverse for blink animation`);
        
        // Show the element immediately since these are usually dots that blink
        target.style.animation = 'none';
        target.style.transition = 'none';
        target.style.opacity = '1';
        target.style.visibility = 'visible';
        target.style.display = 'inline-block';
        
        // If this element is part of a typing indicator, ensure other elements are visible too
        const parent = target.parentElement;
        if (parent && parent.classList.contains('typing')) {
            parent.style.display = 'block';
            parent.style.visibility = 'visible';
            parent.style.opacity = '1';
        }
        
        // Apply the blink animation in reverse
        void target.offsetWidth; // Force reflow
        target.style.animation = `${animation.name} ${duration}s ${timing} infinite`;
        
        // Set a timeout to fade out the typing indicator when we're done with this animation
        setTimeout(() => {
            // Find all the spans in the typing container
            const parent = target.parentElement;
            if (parent) {
                parent.style.transition = `opacity ${duration}s ${timing}`;
                parent.style.opacity = '0';
                
                setTimeout(() => {
                    parent.style.display = 'none';
                }, duration * 1000);
            }
        }, duration * 1000 * 3); // Show for longer (3x duration) to make it visible
        
        return;
    }
    
    // Special handling for fades - they need opposite animations
    else if (classified.category === 'fade') {
        if (classified.isFadeIn) {
            // Fade in -> Fade out
            console.debug(`Applying fadeOut for fadeIn animation`);
            
            // Stop any existing animations
            target.style.animation = 'none';
            target.style.transition = 'none';
            
            // Force reflow
            void target.offsetWidth;
            
            // Apply immediate styles without animation first to ensure visibility
            target.style.opacity = '1';
            target.style.visibility = 'visible';
            target.style.display = finalStyle.display || 'block';
            
            // Force reflow again
            void target.offsetWidth;
            
            // Now set up the fade out transition
            target.style.transition = `opacity ${duration}s ${timing}`;
            
            // Use requestAnimationFrame to ensure the browser has time to apply the initial state
            requestAnimationFrame(() => {
                // Set opacity to 0 for fade out
                target.style.opacity = '0';
                
                // Set a callback to handle cleanup after the animation
                setTimeout(() => {
                    // If the element was originally hidden, restore that state
                    if (initialStyle.opacity === '0' || parseFloat(initialStyle.opacity) < 0.1 ||
                        initialStyle.visibility === 'hidden' || initialStyle.display === 'none') {
                        target.style.visibility = 'hidden';
                        target.style.display = 'none';
                    }
                }, duration * 1000);
            });
        } else {
            // Fade out -> Fade in
            console.debug(`Applying fadeIn for fadeOut animation`);
            
            // Stop any existing animations
            target.style.animation = 'none';
            target.style.transition = 'none';
            
            // First check if the element should actually be visible
            if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
                console.debug('Element was originally hidden, keeping it hidden');
                
                // Simply ensure the element is hidden
                target.style.opacity = '0';
                target.style.visibility = 'hidden';
                target.style.display = 'none';
                return;
            }
            
            // Apply immediate styles without animation first
            target.style.opacity = '0';
            target.style.visibility = 'visible';
            target.style.display = initialStyle.display || 'block';
            
            // Force reflow
            void target.offsetWidth;
            
            // Now set up the fade in transition
            target.style.transition = `opacity ${duration}s ${timing}`;
            
            // Use requestAnimationFrame to ensure the browser has time to apply the initial state
            requestAnimationFrame(() => {
                // Set opacity to 1 for fade in
                target.style.opacity = '1';
            });
        }
    } 
    // Special handling for slides
    else if (classified.category === 'slide') {
        if (classified.isSlideIn) {
            // Slide in -> Slide out
            console.debug(`Applying slideOut for slideIn animation`);
            
            // Clear existing animations
            target.style.animation = 'none';
            target.style.transition = 'none';
            
            // Force reflow
            void target.offsetWidth;
            
            // Make sure element is visible first
            if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
                target.style.visibility = 'visible';
                target.style.display = 'block';
            }
            
            // Use an opposite animation
            const oppositeAnim = getOppositeAnimation(animation.name, classified);
            target.style.animation = `${oppositeAnim} ${duration}s ${timing} forwards`;
            
            // Hide the element after animation is complete if it was originally hidden
            if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
                setTimeout(() => {
                    target.style.visibility = 'hidden';
                    target.style.display = 'none';
                }, duration * 1000);
            }
        } else {
            // Slide out -> Slide in
            console.debug(`Applying slideIn for slideOut animation`);
            
            // Check if element should be visible in its original state
            if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
                console.debug('Element was originally hidden, keeping it hidden');
                target.style.visibility = 'hidden';
                target.style.display = 'none';
                return;
            }
            
            // Clear existing animations
            target.style.animation = 'none';
            target.style.transition = 'none';
            
            // Force reflow
            void target.offsetWidth;
            
            // Ensure the element is visible
            target.style.visibility = 'visible';
            target.style.display = initialStyle.display || 'block';
            
            // Use an opposite animation
            const oppositeAnim = getOppositeAnimation(animation.name, classified);
            target.style.animation = `${oppositeAnim} ${duration}s ${timing} forwards`;
        }
    }
    // Special handling for zoom
    else if (classified.category === 'zoom') {
        if (classified.isZoomIn) {
            // Zoom in -> Zoom out
            console.debug(`Applying zoomOut for zoomIn animation`);
            
            // Clear existing animations
            target.style.animation = 'none';
            target.style.transition = 'none';
            
            // Force reflow
            void target.offsetWidth;
            
            // Make sure element is visible first
            if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
                target.style.visibility = 'visible';
                target.style.display = 'block';
            }
            
            // Use an opposite animation
            const oppositeAnim = getOppositeAnimation(animation.name, classified);
            target.style.animation = `${oppositeAnim} ${duration}s ${timing} forwards`;
            
            // Hide the element after animation is complete if it was originally hidden
            if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
                setTimeout(() => {
                    target.style.visibility = 'hidden';
                    target.style.display = 'none';
                }, duration * 1000);
            }
        } else {
            // Zoom out -> Zoom in
            console.debug(`Applying zoomIn for zoomOut animation`);
            
            // Check if element should be visible in its original state
            if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
                console.debug('Element was originally hidden, keeping it hidden');
                target.style.visibility = 'hidden';
                target.style.display = 'none';
                return;
            }
            
            // Clear existing animations
            target.style.animation = 'none';
            target.style.transition = 'none';
            
            // Force reflow
            void target.offsetWidth;
            
            // Ensure element is visible
            target.style.visibility = 'visible';
            target.style.display = initialStyle.display || 'block';
            
            // Use an opposite animation
            const oppositeAnim = getOppositeAnimation(animation.name, classified);
            target.style.animation = `${oppositeAnim} ${duration}s ${timing} forwards`;
        }
    }
    // For other animations, apply a standard reverse
    else {
        // Standard reverse animation
        console.debug(`Applying reverse animation: ${animation.name}`);
        
        // Clear existing animations
        target.style.animation = 'none';
        target.style.transition = 'none';
        
        // Handle visibility based on initial state
        if (initialStyle.display === 'none' || initialStyle.visibility === 'hidden') {
            // If the element was originally hidden, restore that state
            target.style.visibility = 'hidden';
            target.style.display = 'none';
        } else {
            // Ensure element is visible for the animation
            target.style.visibility = 'visible';
            target.style.display = initialStyle.display || 'block';
            
            // Force reflow
            void target.offsetWidth;
            
            // Apply the reverse animation
            target.style.animation = `${animation.name} ${duration}s ${timing} reverse forwards`;
        }
    }
    
    // Force a reflow to ensure the animation runs
    void target.offsetWidth;
}

/**
 * Apply a reverse transition intelligently
 * @param {Element} target - The target element
 * @param {Object} transition - The transition data
 */
function applyReverseTransition(target, transition) {
    if (!target || !transition) return;
    
    console.debug(`Applying reverse transition for: ${transition.property}`);
    
    const classified = transition.classified || {};
    const property = transition.property;
    const duration = transition.duration || 0.3;
    const timing = transition.timingFunction || 'ease';
    const initialValue = transition.initialValue || null;
    const finalValue = transition.finalValue || null;
    const initialStyle = transition.initialStyle || {};
    
    if (!property) {
        console.debug('No property defined for transition');
        return;
    }
    
    // First, remove any existing transitions
    target.style.transition = 'none';
    
    // Force a reflow to ensure previous transitions are cleared
    void target.offsetWidth;
    
    // Set up the new transition
    if (property === 'opacity') {
        // For opacity transitions, handle them specially to ensure visibility
        const currentOpacity = window.getComputedStyle(target).opacity;
        const targetOpacity = initialValue !== null ? initialValue : 
                             (classified.isFadeIn ? '0' : '1');
        
        // Check if the element should be visible in its original state
        const wasOriginallyHidden = initialStyle.display === 'none' || 
                                   initialStyle.visibility === 'hidden' ||
                                   parseFloat(initialStyle.opacity) < 0.1;
        
        if (parseFloat(currentOpacity) > 0 && parseFloat(targetOpacity) === 0) {
            // Currently visible, going to fade out
            target.style.transition = 'none';
            target.style.visibility = 'visible';
            target.style.opacity = '1';
            
            // Force reflow
            void target.offsetWidth;
            
            // Now set up the transition
            target.style.transition = `opacity ${duration}s ${timing}`;
            
            // Apply the new opacity value using requestAnimationFrame
            requestAnimationFrame(() => {
                target.style.opacity = targetOpacity;
                
                // Once fade out is complete, update visibility based on original state
                setTimeout(() => {
                    if (wasOriginallyHidden) {
                        target.style.visibility = 'hidden';
                        target.style.display = 'none';
                    }
                }, duration * 1000);
            });
        } else if (parseFloat(currentOpacity) < 0.1) {
            // Currently invisible, but should it fade in?
            if (wasOriginallyHidden) {
                // It was originally hidden, so keep it hidden
                console.debug('Element was originally hidden, keeping it hidden');
                target.style.opacity = '0';
                target.style.visibility = 'hidden';
                target.style.display = 'none';
            } else {
                // It was originally visible, so fade it in
                target.style.transition = 'none';
                target.style.visibility = 'visible';
                target.style.display = 'block';
                target.style.opacity = '0';
                
                // Force reflow
                void target.offsetWidth;
                
                // Set up transition
                target.style.transition = `opacity ${duration}s ${timing}`;
                
                // Apply the new opacity value using requestAnimationFrame
                requestAnimationFrame(() => {
                    target.style.opacity = targetOpacity;
                });
            }
        } else {
            // Regular opacity transition
            target.style.transition = `opacity ${duration}s ${timing}`;
            // Force reflow
            void target.offsetWidth;
            // Apply the opacity value
            target.style.opacity = targetOpacity;
        }
    } else {
        // For non-opacity transitions, use a simpler approach
        target.style.transition = `${property} ${duration}s ${timing}`;
        
        // Force a reflow
        void target.offsetWidth;
        
        // For transitions, we want to go back to the initial value
        if (initialValue) {
            // If we have a valid initial value, use it
            console.debug(`Reversing ${property} to initial value: ${initialValue}`);
            requestAnimationFrame(() => {
                target.style[property] = initialValue;
            });
        } else {
            // Handle based on the property type
            switch (classified.category) {
                case 'move':
                    // Move transitions typically use position properties
                    requestAnimationFrame(() => {
                        target.style[property] = '0';
                    });
                    break;
                    
                case 'size':
                    if (classified.isExpand) {
                        // Was expanding, now shrink
                        requestAnimationFrame(() => {
                            target.style[property] = '0';
                        });
                    } else {
                        // Was shrinking, now expand
                        requestAnimationFrame(() => {
                            target.style[property] = 'auto';
                        });
                    }
                    break;
                    
                case 'transform':
                    requestAnimationFrame(() => {
                        target.style.transform = 'none';
                    });
                    break;
                    
                default:
                    // Reset to a sensible default
                    console.debug(`Using default reversal for ${property}`);
                    if (target.getAttribute(`data-initial-${property}`)) {
                        requestAnimationFrame(() => {
                            target.style[property] = target.getAttribute(`data-initial-${property}`);
                        });
                    }
            }
        }
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
                reverseAnimationFrameId = null;
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
                // Reset animation tracking state
                animationStack = [];
                isReversingAnimations = false;
                isCapturingAnimations = true;
                animationProperties = {};
                lastAnimationTime = Date.now();
                currentAnimationBatch = []; // Reset current batch
                lastBatchTime = 0; // Reset batch time
                
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

/**
 * Generate a unique CSS selector for an element that can be used to find it later
 * @param {Element} element - The element to create a selector for
 * @returns {string} A unique CSS selector
 */
function generateUniqueSelector(element) {
    if (!element) return '';
    
    try {
        // Start with the tag name
        let selector = element.tagName.toLowerCase();
        
        // Add ID if it exists (most specific)
        if (element.id) {
            return `${selector}#${element.id}`;
        }
        
        // Add classes
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\s+/);
            if (classes.length > 0 && classes[0] !== '') {
                selector += '.' + classes.join('.');
            }
        }
        
        // Add position among siblings for more specificity
        const parent = element.parentNode;
        if (parent && parent.children.length > 1) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element);
            
            // Use nth-child for position
            selector += `:nth-child(${index + 1})`;
        }
        
        // Add nearest parent with ID or distinctive class for context
        let context = '';
        let parentElement = element.parentNode;
        let depth = 0;
        const maxDepth = 3; // Limit how far up we go
        
        while (parentElement && parentElement.tagName && depth < maxDepth) {
            if (parentElement.id) {
                context = `${parentElement.tagName.toLowerCase()}#${parentElement.id} > ${context}`;
                break;
            } else if (parentElement.className && typeof parentElement.className === 'string' && parentElement.className.trim()) {
                const parentClass = parentElement.className.trim().split(/\s+/)[0];
                context = `${parentElement.tagName.toLowerCase()}.${parentClass} > ${context}`;
                break;
            }
            
            // If we couldn't find a good identifier, just add the tag
            context = `${parentElement.tagName.toLowerCase()} > ${context}`;
            parentElement = parentElement.parentNode;
            depth++;
        }
        
        // Combine context with our selector if we have context
        if (context) {
            selector = context + selector;
        }
        
        return selector;
    } catch (err) {
        console.error('Error generating selector:', err);
        // Fallback to simple tag selector
        return element.tagName ? element.tagName.toLowerCase() : '*';
    }
}