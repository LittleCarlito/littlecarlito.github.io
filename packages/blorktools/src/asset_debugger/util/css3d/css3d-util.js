import * as THREE from 'three';
import { 
    initThreeJsPreview
} from '../custom-animation/threejs-util';
import { getHtmlSettingsForMesh } from '../mesh-data-util';
import { showStatus } from '../../modals/html-editor-modal/html-editor-modal';
import { setupCSS3DScene } from './css3d-scene-helper';

// Add animation stack tracking variables at the top of the file
export let animationStack = [];
export let isReversingAnimations = false;
// Add flag to disable animation capture during reversal
export let isCapturingAnimations = true;
// Store animation properties to properly reverse them
export let animationProperties = {};
// Store timestamps for calculating delays
export let lastAnimationTime = 0;
// Animation frame tracking
export let reverseAnimationFrameId = null;
// Add animation batch tracking for composite effects
export let currentAnimationBatch = [];
export let batchTimeWindow = 50; // ms window to consider animations as part of the same batch
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

export function pushAnimationBatch(incomingValue) {
    if(!incomingValue){
        return;
    }
    currentAnimationBatch.push(incomingValue);
}

export function resetLastBatchTime() {
    lastBatchTime = 0;
}

export function setLastBatchTime(incomingValue) {
    lastBatchTime = incomingValue;
}

export function resetReverseAnimationFrameId() {
    reverseAnimationFrameId = null;
}

export function resetAnimationState() {
        // Clear existing animation stack
        resetAnimationStack();
        setReversingAnimation(false);
        setCapturingAnimations(true);
        resetAnimationProperties();
        setLastAnimationTime(Date.now());
        resetCurrentAniamtionBatch();
        resetLastBatchTime();
}