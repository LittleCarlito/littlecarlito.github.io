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