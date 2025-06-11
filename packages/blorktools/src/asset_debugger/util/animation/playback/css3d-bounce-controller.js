import { classifyAnimation, classifyTransition } from "../../data/animation-classifier";
import { 
    animationProperties,
    animationStack,
    batchTimeWindow,
    currentAnimationBatch,
    isCapturingAnimations,
    lastAnimationTime,
    lastBatchTime,
    pushAnimationBatch,
    resetAnimationState,
    resetCurrentAniamtionBatch,
    setLastAnimationTime,
    setLastBatchTime
} from "../../state/css3d-state";

/**
 * Set up bounce animation tracking for the iframe
 * @param {HTMLIFrameElement} iframe - The iframe to track animations in
 */
export function setupBounceAnimationTracking(iframe) {
    if (!iframe) return;
    
    try {
        resetAnimationState();
        
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
                    resetCurrentAniamtionBatch();
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
                setLastBatchTime(now);
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
            pushAnimationBatch(properties);
            console.debug(`Animation added to current batch: ${animationName}, batch size: ${currentAnimationBatch.length}`);
            
            // Update time tracking
            setLastAnimationTime(now);
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
                    resetCurrentAniamtionBatch();
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
                setLastBatchTime(now);
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
            pushAnimationBatch(properties);
            console.debug(`Transition added to current batch: ${propertyName}, batch size: ${currentAnimationBatch.length}`);
            
            // Update time tracking
            setLastAnimationTime(now);
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
