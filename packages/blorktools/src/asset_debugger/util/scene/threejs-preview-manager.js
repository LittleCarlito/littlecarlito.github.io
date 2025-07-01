import { infoPanel, resetInfoPanel } from "../../widgets/mesh-info-widget";
import { logPreviewError } from "../state/log-util";
import { cleanupCSS3D } from "./css3d-scene-manager";
import { cleanupThreeJsScene, setupThreeJsScene } from "./threejs-preview-setup";
import { setIsPreviewActive, setIsPreviewAnimationPaused, setLastTextureUpdateTime } from "../state/animation-state";
import { reverseAnimationFrameId } from "../state/css3d-state";
import { 
    animationCss3dObject,
    animationCss3dRenderer,
    animationCss3dScene,
    animationPreviewCamera,
    animationPreviewRenderer,
    animationPreviewScene,
    frameBuffer,
    pendingTextureUpdate, 
    previewPlane, 
    previewRenderTarget, 
    resetThreeJsState, 
    setPendingTextureUpdate 
} from "../state/threejs-state";
import { previewAnimationId, resetLastAnimationFrameTime, resetPreviewAnimationId } from "../animation/playback/animation-preview-controller"

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
        setPendingTextureUpdate(false);
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
    resetThreeJsState();

    // Reset debug flag and global functions
    window._css3dDebugLogged = false;
    if (window.animateMessages) {
        window.animateMessages = null;
    }

    // Reset animation state
    setIsPreviewAnimationPaused(false);
    setLastTextureUpdateTime(0);
    // TODO Move this variable to animation state object
    setPendingTextureUpdate(false);
    resetLastAnimationFrameTime();
    resetPreviewAnimationId();

    console.log('Three.js and CSS3D resources cleaned up');
}

// TODO Rename to seomthing better and make it not coupled to specific panel
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
function onPreviewResize() {
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
 * Initialize Three.js for HTML preview
 * @param {HTMLElement} container - The container element for the Three.js canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML to render as texture
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} createInfoPanel - Whether to create the info panel
 */
export function initThreeJsPreview(container, iframe, currentMeshId, createInfoPanel = true) {
    // Handle window resize
    window.addEventListener('resize', onPreviewResize);
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