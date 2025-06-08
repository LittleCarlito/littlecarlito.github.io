import * as THREE from 'three';
import { animatePreview, previewAnimationId, resetLastAnimationFrameTime, resetPreviewAnimationId } from '../animation/playback/animation-preview-util';
import { 
    isPreviewActive,
    setIsPreviewActive, 
    setIsPreviewAnimationPaused, 
    setLastTextureUpdateTime,
} from '../state/animation-state';
import { getState } from '../../scene/state';
import { showStatus } from '../../modals/html-editor-modal/html-editor-modal';
import { createMeshInfoPanel, infoPanel, resetInfoPanel } from '../../modals/html-editor-modal/mesh-info-panel-util';
import { resetAnimationState, reverseAnimationFrameId } from '../state/css3d-state';
import { createTextureFromIframe } from '../animation/render/iframe2texture-render';
import { cleanupThreeJsScene, setupThreeJsScene } from '../scene/threejs-scene-util';

let pendingTextureUpdate = false;
export let previewPlane;
export let animationPreviewScene, animationPreviewCamera, animationPreviewRenderer;
export let animationCss3dScene, animationCss3dRenderer, animationCss3dObject;
export let frameBuffer = [];
export let previewRenderTarget = null;

/**
 * Initialize Three.js for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
export function initThreeJsPreview(container, iframe, currentMeshId, createInfoPanel = true) {
    try {
        // We already have THREE imported at the top of the file
        console.log('Using imported Three.js module');

        // Only need to load html2canvas
        loadHtml2Canvas(() => {
            setupThreeJsScene(container, iframe, currentMeshId, createInfoPanel);
        });
    } catch (error) {
        console.error('Error initializing Three.js preview:', error);
        logPreviewError(`Three.js initialization error: ${error.message}`);
    }
}

/**
 * Clean up Three.js preview resources using the generic cleanup utility
 */
export function cleanupThreeJsPreview() {
    // Mark preview as inactive to stop animation loop first
    setIsPreviewActive(false);
    
    cleanupCSS3D();
    cleanupInfoPanel();
    
    // Set pending operations to false
    if (pendingTextureUpdate) {
        pendingTextureUpdate = false;
    }

    // Collect DOM elements to clean up
    const domElements = [];
    
    const textureCanvas = document.getElementById('html-texture-canvas');
    if (textureCanvas) domElements.push(textureCanvas);
    
    const hiddenContent = document.getElementById('hidden-html-content');
    if (hiddenContent) domElements.push(hiddenContent);
    
    const renderIframe = document.getElementById('html-render-iframe');
    if (renderIframe) domElements.push(renderIframe);

    // Collect event cleanup callbacks
    const eventCleanupCallbacks = [
        () => window.removeEventListener('resize', onPreviewResize),
        () => {
            if (animationPreviewCamera && animationPreviewCamera.userData && animationPreviewCamera.userData.keyHandler) {
                document.removeEventListener('keydown', animationPreviewCamera.userData.keyHandler);
            }
        }
    ];

    // Collect objects to clean up
    const objects = [];
    if (previewPlane) objects.push(previewPlane);
    if (animationCss3dObject) objects.push(animationCss3dObject);

    // Additional cleanup configuration
    const additionalCleanup = {
        frameBuffer: frameBuffer,
        animationFrames: [previewAnimationId, reverseAnimationFrameId].filter(id => id !== null),
        textures: previewRenderTarget && previewRenderTarget.texture ? [previewRenderTarget.texture] : []
    };

    // Use the generic cleanup utility
    cleanupThreeJsScene({
        scene: animationPreviewScene,
        camera: animationPreviewCamera,
        renderer: animationPreviewRenderer,
        objects,
        domElements,
        eventCleanupCallbacks,
        additionalCleanup
    });

    // Handle CSS3D scene separately since it's not a standard Three.js scene
    cleanupThreeJsScene({
        scene: animationCss3dScene,
        renderer: animationCss3dRenderer,
        objects: [],
        domElements: [],
        eventCleanupCallbacks: [],
        additionalCleanup: {}
    });

    // Reset global variables
    previewPlane = null;
    animationPreviewScene = null;
    animationPreviewCamera = null;
    animationPreviewRenderer = null;
    animationCss3dScene = null;
    animationCss3dRenderer = null;
    animationCss3dObject = null;
    previewRenderTarget = null;
    frameBuffer = [];

    // Reset debug flag and global functions
    window._css3dDebugLogged = false;
    if (window.animateMessages) {
        window.animateMessages = null;
    }

    // Reset animation state
    setIsPreviewAnimationPaused(false);
    setLastTextureUpdateTime(0);
    pendingTextureUpdate = false;
    resetLastAnimationFrameTime();
    resetPreviewAnimationId();

    console.log('Three.js and CSS3D resources cleaned up');
}

/**
 * Clean up info panel resources
 * Removes the info panel from the DOM and resets the infoPanel reference
 * This is called when closing the preview or switching between preview modes
 */
function cleanupInfoPanel() {
    if (infoPanel) {
        try {
            if (infoPanel.parentNode) {
                infoPanel.parentNode.removeChild(infoPanel);
            }
        } catch (e) {
            console.log('Error removing info panel:', e);
        }
        resetInfoPanel();
    }
}

/**
 * Handle window resize for the Three.js preview
 */
export function onPreviewResize() {
    const container = animationPreviewRenderer.domElement.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Update camera aspect ratio
    if (animationPreviewCamera) {
        animationPreviewCamera.aspect = containerWidth / containerHeight;
        animationPreviewCamera.updateProjectionMatrix();
    }
    
    // Update renderer
    animationPreviewRenderer.setSize(containerWidth, containerHeight);
}

/**
 * Set preview render target
 * @param {THREE.WebGLRenderTarget} incomingValue - The new value to set
 */
export function setPreviewRenderTarget(incomingValue) {
    previewRenderTarget = incomingValue;
}

/**
 * Set aniamtion preview camera
 * @param {THREE.Camera} incomingValue - The new value to set
 */
export function setAnimationPreviewCamera(incomingValue) {
    animationPreviewCamera = incomingValue;
}

/**
 * Load html2canvas library
 * @param {Function} callback - Function to call when loading is complete
 */
function loadHtml2Canvas(callback) {
    // Check if html2canvas is already loaded
    if (typeof window.html2canvas !== 'undefined') {
        callback();
        return;
    }
    
    // Check if it's already being loaded
    if (document.querySelector('script[src*="html2canvas"]')) {
        const checkInterval = setInterval(() => {
            if (typeof window.html2canvas !== 'undefined') {
                clearInterval(checkInterval);
                callback();
            }
        }, 100);
        return;
    }
    
    // Load html2canvas
    console.log('Loading html2canvas library');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = callback;
    script.onerror = (error) => {
        console.error('Failed to load html2canvas:', error);
    };
    document.head.appendChild(script);
}

function cleanupCSS3D(targetElement = null) {
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

/**
 * Set aniamtion css 3d scene
 * @param {THREE.Scene} incomingValue - The new value to set
 */
export function setAnimationCss3dScene(incomingValue) {
    animationCss3dScene = incomingValue;
}

/**
 * Set animation css 3d renderer
 * @param {THREE.WebGLRenderer} incomingValue - The new value to set
 */
export function setAnimationCss3dRenderer(incomingValue) {
    animationCss3dRenderer = incomingValue;
}

/**
 * Set animation css 3d object
 * @param {THREE.Object3D} incomingValue - The new value to set
 */
export function setAnimationCss3dObject(incomingValue) {
    animationCss3dObject = incomingValue;
}

export function setAnimationPreviewScene(incomingValue) {
    animationPreviewScene = incomingValue;
}

export function setAnimationPreviewRenderer(incomingValue) {
    animationPreviewRenderer = incomingValue;
}

export function setPreviewPlane(incomingValue) {
    previewPlane = incomingValue;
}