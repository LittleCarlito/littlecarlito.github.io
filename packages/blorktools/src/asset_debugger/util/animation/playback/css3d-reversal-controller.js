import { animationStack, reverseAnimationFrameId, setReverseAnimationFrameId } from "../../state/css3d-state";
/**
 * Pop and play the next animation from the stack in reverse
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
        setReverseAnimationFrameId(null);
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
                            newElement.textContent = 'â€¢';
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