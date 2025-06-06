import * as THREE from 'three';
import { 
    initThreeJsPreview
} from '../custom-animation/threejs-util';
import { getHtmlSettingsForMesh } from '../mesh-data-util';
import { showStatus } from '../../modals/html-editor-modal/html-editor-modal';
import { classifyAnimation, classifyTransition } from '../animation-classifier';
import { setupCSS3DScene } from './css3d-scene-helper';

// Add animation stack tracking variables at the top of the file
export let animationStack = [];
export let isReversingAnimations = false;
// Add flag to disable animation capture during reversal
export let isCapturingAnimations = true;
// Store animation properties to properly reverse them
export let animationProperties = {};
// Store timestamps for calculating delays
let lastAnimationTime = 0;
// Animation frame tracking
export let reverseAnimationFrameId = null;
// Add animation batch tracking for composite effects
export let currentAnimationBatch = [];
let batchTimeWindow = 50; // ms window to consider animations as part of the same batch
export let lastBatchTime = 0;

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

export function cleanupCSS3D(targetElement = null) {
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
    
    const iframe = targetElement || document.getElementById('css3d-panel-iframe');
    if (iframe) {
        // Clear any restart timer
        if (iframe.restartTimer) {
            clearInterval(iframe.restartTimer);
            iframe.restartTimer = null;
        }
        
        // Clean up event listeners if they exist
        if (iframe._animationStartHandler && iframe.contentDocument) {
            try {
                iframe.contentDocument.removeEventListener('animationstart', iframe._animationStartHandler);
                iframe._animationStartHandler = null;
            } catch (err) {
                console.debug('Error removing animation start handler:', err);
            }
        }
        
        if (iframe._transitionStartHandler && iframe.contentDocument) {
            try {
                iframe.contentDocument.removeEventListener('transitionstart', iframe._transitionStartHandler);
                iframe._transitionStartHandler = null;
            } catch (err) {
                console.debug('Error removing transition start handler:', err);
            }
        }
        
        // Clean up the mutation observer if it exists
        if (iframe.mutationObserver) {
            iframe.mutationObserver.disconnect();
            iframe.mutationObserver = null;
        }
    }
    
    console.debug('CSS3D cleanup complete');
}

/**
 * Set up bounce animation tracking for the iframe
 * @param {HTMLIFrameElement} iframe - The iframe to track animations in
 */
export function setupBounceAnimationTracking(iframe) {
    if (!iframe) return;
    
    try {
        // Clear existing animation stack
        animationStack = [];
        isReversingAnimations = false;
        isCapturingAnimations = true;
        animationProperties = {};
        lastAnimationTime = Date.now(); // Initialize time tracking
        currentAnimationBatch = []; // Initialize current batch
        lastBatchTime = 0; // Reset batch time
        
        // Check if iframe and its content document are available
        if (!iframe.contentDocument) {
            console.debug('Iframe content document not available, skipping animation tracking setup');
            return;
        }
        
        console.debug('Setting up animation tracking for bounce mode');
        
        // Clean up any existing event listeners to prevent duplicates
        if (iframe._animationStartHandler) {
            iframe.contentDocument.removeEventListener('animationstart', iframe._animationStartHandler);
        }
        if (iframe._transitionStartHandler) {
            iframe.contentDocument.removeEventListener('transitionstart', iframe._transitionStartHandler);
        }
        
        // Track all animations that start
        const animationStartHandler = (event) => {
            // Skip if we're in reversal mode and not capturing
            if (!isCapturingAnimations) return;
            
            // Verify iframe is still valid
            if (!iframe || !iframe.contentDocument || !iframe.contentDocument.contains(event.target)) {
                return;
            }
            
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
                    // Verify iframe and element are still valid
                    if (animatedElement && iframe && iframe.contentDocument && 
                        iframe.contentDocument.contains(animatedElement)) {
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
        };
        
        // Also track transitions
        const transitionStartHandler = (event) => {
            // Skip if we're in reversal mode and not capturing
            if (!isCapturingAnimations) return;
            
            // Verify iframe is still valid
            if (!iframe || !iframe.contentDocument || !iframe.contentDocument.contains(event.target)) {
                return;
            }
            
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
                    // Verify iframe and element are still valid
                    if (transitionElement && iframe && iframe.contentDocument && 
                        iframe.contentDocument.contains(transitionElement)) {
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
        };
        
        // Store handlers for cleanup
        iframe._animationStartHandler = animationStartHandler;
        iframe._transitionStartHandler = transitionStartHandler;
        
        // Add event listeners
        iframe.contentDocument.addEventListener('animationstart', animationStartHandler);
        iframe.contentDocument.addEventListener('transitionstart', transitionStartHandler);
        
    } catch (err) {
        console.error('Error setting up animation tracking:', err);
    }
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

export function resetAnimationStack() {
    animationStack = [];
}

export function pushAnimationStack(incomingValue) {
    if(!incomingValue) {
        return;
    }
    animationStack.push(incomingValue);
}

export function setReversingAnimation(incomingValue) {
    isReversingAnimations = incomingValue;
}

export function setCapturingAnimations(incomingValue) {
    isCapturingAnimations = incomingValue;
}

export function resetAnimationProperties() {
    animationProperties = {};
}

export function setLastAnimationTime(incomingValue) {
    if(!incomingValue) {
        return;
    }
    lastAnimationTime = incomingValue;
}

export function resetCurrentAniamtionBatch() {
    currentAnimationBatch = [];
}

export function resetLastBatchTime() {
    lastBatchTime = 0;
}

export function resetReverseAnimationFrameId() {
    reverseAnimationFrameId = null;
}