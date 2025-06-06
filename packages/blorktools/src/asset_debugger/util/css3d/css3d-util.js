import * as THREE from 'three';
import { 
    initThreeJsPreview
} from '../custom-animation/threejs-util';
import { getHtmlSettingsForMesh } from '../mesh-data-util';
import { showStatus } from '../../modals/html-editor-modal/html-editor-modal';
import { classifyAnimation, classifyTransition } from '../animation-classifier';
import { setupCSS3DScene } from './scene-helper';

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
        
        // Clean up event listeners if they exist
        if (previewIframe._animationStartHandler && previewIframe.contentDocument) {
            try {
                previewIframe.contentDocument.removeEventListener('animationstart', previewIframe._animationStartHandler);
                previewIframe._animationStartHandler = null;
            } catch (err) {
                console.debug('Error removing animation start handler:', err);
            }
        }
        
        if (previewIframe._transitionStartHandler && previewIframe.contentDocument) {
            try {
                previewIframe.contentDocument.removeEventListener('transitionstart', previewIframe._transitionStartHandler);
                previewIframe._transitionStartHandler = null;
            } catch (err) {
                console.debug('Error removing transition start handler:', err);
            }
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
 * Play the next animation in reverse from the stack
 * @param {HTMLIFrameElement} iframe - The iframe containing animations
 */
export function playNextReverseAnimation(iframe) {
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