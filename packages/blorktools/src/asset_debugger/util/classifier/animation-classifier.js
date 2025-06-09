/**
 * Classify the type of animation based on name and initial style
 * @param {string} animationName - The animation name
 * @param {Object} initialStyle - Initial computed style
 * @returns {Object} Classification information
 */
export function classifyAnimation(animationName, initialStyle) {
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
export function classifyTransition(property, initialValue, currentValue) {
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

// Unified animation detection script for both CSS3D and Image2Texture modes
export function injectUnifiedAnimationDetectionScript(iframe, mode = 'auto') {
    if (!iframe || !iframe.contentDocument) return;
    
    const script = iframe.contentDocument.createElement('script');
    script.textContent = `
        // Unified animation detection system
        window.__animationDetection = {
            // Basic counters
            setTimeout: 0,
            setInterval: 0,
            rAF: 0,
            activeTimeouts: 0,
            activeIntervals: 0,
            animationFrameIds: new Set(),
            
            // CSS animation tracking
            cssAnimations: new Set(),
            cssTransitions: new Set(),
            
            // DOM change tracking
            domChanges: 0,
            lastDomChange: 0,
            styleChanges: false,
            
            // Mode configuration
            mode: '${mode}', // 'css3d', 'image2texture', or 'auto'
            
            // Advanced detection
            isAnimationLoop: false,
            loopDetectionThreshold: 5
        };
        
        const detection = window.__animationDetection;
        
        // Override setTimeout
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay) {
            detection.setTimeout++;
            detection.activeTimeouts++;
            const id = originalSetTimeout.call(this, function() {
                detection.activeTimeouts--;
                if (typeof callback === 'function') callback();
            }, delay);
            return id;
        };
        
        // Override setInterval
        const originalSetInterval = window.setInterval;
        window.setInterval = function(callback, delay) {
            detection.setInterval++;
            detection.activeIntervals++;
            return originalSetInterval.call(this, callback, delay);
        };
        
        // Override requestAnimationFrame
        const originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = function(callback) {
            detection.rAF++;
            const id = originalRAF.call(this, function(timestamp) {
                detection.animationFrameIds.add(id);
                if (typeof callback === 'function') callback(timestamp);
                
                // Animation loop detection for image2texture mode
                if (detection.mode === 'image2texture' || detection.mode === 'auto') {
                    if (detection.animationFrameIds.size > detection.loopDetectionThreshold) {
                        detection.isAnimationLoop = true;
                    }
                }
            });
            return id;
        };
        
        // CSS Animation and Transition Event Listeners (for CSS3D mode or auto)
        if (detection.mode === 'css3d' || detection.mode === 'auto') {
            // CSS animation events
            document.addEventListener('animationstart', (event) => {
                detection.cssAnimations.add(event.animationName);
            });
            
            document.addEventListener('animationend', (event) => {
                detection.cssAnimations.delete(event.animationName);
            });
            
            document.addEventListener('animationiteration', (event) => {
                detection.lastDomChange = Date.now();
            });
            
            // CSS transition events
            document.addEventListener('transitionstart', (event) => {
                detection.cssTransitions.add(event.propertyName);
            });
            
            document.addEventListener('transitionend', (event) => {
                detection.cssTransitions.delete(event.propertyName);
            });
            
            document.addEventListener('transitionrun', (event) => {
                detection.lastDomChange = Date.now();
            });
        }
        
        // DOM Mutation Observer (enhanced for both modes)
        try {
            const observer = new MutationObserver(mutations => {
                detection.domChanges += mutations.length;
                detection.lastDomChange = Date.now();
                
                for (const mutation of mutations) {
                    // Check for style or class changes
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                        detection.styleChanges = true;
                    }
                    
                    // Check for added/removed nodes (image2texture specific)
                    if (detection.mode === 'image2texture' || detection.mode === 'auto') {
                        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                            detection.domChanges++;
                        }
                    }
                }
            });
            
            // Configure observer based on mode
            const observerConfig = {
                attributes: true,
                childList: true,
                subtree: true
            };
            
            // Add attribute filter for CSS3D mode for better performance
            if (detection.mode === 'css3d') {
                observerConfig.attributeFilter = ['style', 'class'];
            }
            
            observer.observe(document.documentElement, observerConfig);
            
        } catch (e) {
            console.debug('MutationObserver not available:', e);
        }
        
        // Utility methods for external access
        window.__animationDetection.getStatus = function() {
            const now = Date.now();
            return {
                hasActiveTimeouts: detection.activeTimeouts > 0,
                hasActiveIntervals: detection.activeIntervals > 0,
                hasActiveRAF: detection.rAF > 0 && detection.animationFrameIds.size > 0,
                hasCssAnimations: detection.cssAnimations.size > 0,
                hasCssTransitions: detection.cssTransitions.size > 0,
                hasRecentDomChanges: (now - detection.lastDomChange) < 500,
                timeSinceLastChange: now - detection.lastDomChange,
                totalChanges: detection.domChanges,
                isAnimationLoop: detection.isAnimationLoop,
                mode: detection.mode
            };
        };
        
        window.__animationDetection.isAnimating = function() {
            const status = this.getStatus();
            return status.hasActiveTimeouts || 
                   status.hasActiveIntervals || 
                   status.hasActiveRAF || 
                   status.hasCssAnimations || 
                   status.hasCssTransitions || 
                   status.hasRecentDomChanges;
        };
        
        window.__animationDetection.reset = function() {
            detection.setTimeout = 0;
            detection.setInterval = 0;
            detection.rAF = 0;
            detection.activeTimeouts = 0;
            detection.activeIntervals = 0;
            detection.animationFrameIds.clear();
            detection.cssAnimations.clear();
            detection.cssTransitions.clear();
            detection.domChanges = 0;
            detection.lastDomChange = 0;
            detection.styleChanges = false;
            detection.isAnimationLoop = false;
        };
    `;
    
    iframe.contentDocument.head.appendChild(script);
}