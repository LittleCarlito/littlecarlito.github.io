import * as THREE from 'three';
import { CustomTextureSettings, showStatus } from '../../../modals/html-editor-modal/html-editor-modal';
import { 
    resetPreRenderState, 
    setIsPreviewActive,
    setIsPreviewAnimationPaused,
    resetPlaybackTimingState,
    isPreviewAnimationPaused,
    isPreviewActive
} from '../../state/animation-state';
import { sanitizeHtml } from '../../data/string-serder';
import { 
    animationPreviewCamera, 
    animationPreviewRenderer, 
    animationPreviewScene, 
    previewPlane, 
    setPreviewRenderTarget 
} from '../../state/threejs-state';
import { runAnimationFrame } from '../../animation/playback/animation-playback-controller';
import { setupCSS3DScene } from '../../scene/css3d-scene-manager';
import { startImage2TexturePreRendering } from '../../animation/render/image2texture-prerender-controller';
import { startCss3dPreRendering } from '../../animation/render/css3d-prerender-controller';
import { logError, logPreviewError } from '../../state/log-util';
import { cleanupThreeJsPreview, initThreeJsPreview } from '../../scene/threejs-preview-manager';

let currentPreviewSettings = null;
const targetFrameRate = 60;
let lastAnimationFrameTime = 0;
export const frameInterval = 1000 / targetFrameRate;
export let previewAnimationId = null;

// Core HTML rendering logic (reusable)
function createHtmlRenderer(html, onLoad) {
    const sanitizedHtml = sanitizeHtml(html);
    
    const renderIframe = document.createElement('iframe');
    renderIframe.id = 'html-render-iframe';
    renderIframe.style.width = '960px';
    renderIframe.style.height = '540px';
    renderIframe.style.position = 'absolute';
    renderIframe.style.left = '-9999px';
    renderIframe.style.top = '0';
    renderIframe.style.border = 'none';
    renderIframe.style.backgroundColor = 'transparent';
    document.body.appendChild(renderIframe);
    
    renderIframe.onload = onLoad;
    
    try {
        renderIframe.srcdoc = sanitizedHtml;
    } catch (error) {
        renderIframe.contentDocument.open();
        renderIframe.contentDocument.write(sanitizedHtml);
        renderIframe.contentDocument.close();
    }
    
    return renderIframe;
}

// Preview UI creation (preview-specific)
function createPreviewUI(previewContent) {
    previewContent.style.position = 'relative';
    previewContent.style.minHeight = '400px';
    previewContent.style.height = '100%';

    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.height = '100%';
    canvasContainer.style.position = 'absolute';
    canvasContainer.style.top = '0';
    canvasContainer.style.left = '0';
    canvasContainer.style.right = '0';
    canvasContainer.style.bottom = '0';
    canvasContainer.style.overflow = 'hidden';
    canvasContainer.style.display = 'block';
    previewContent.appendChild(canvasContainer);

    const errorLog = document.createElement('div');
    errorLog.id = 'html-preview-error-log';
    errorLog.className = 'preview-error-log';
    errorLog.style.display = 'none';
    previewContent.appendChild(errorLog);

    const loadingOverlay = createLoadingOverlay();
    canvasContainer.appendChild(loadingOverlay);

    return { canvasContainer, errorLog, loadingOverlay };
}

function createLoadingOverlay() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'pre-rendering-overlay';
    loadingOverlay.className = 'loading-splash';
    loadingOverlay.style.position = 'absolute';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = '#000000';
    loadingOverlay.style.zIndex = '1000';
    loadingOverlay.style.border = 'none';
    loadingOverlay.style.outline = 'none';
    loadingOverlay.style.boxShadow = 'none';

    const loadingContent = document.createElement('div');
    loadingContent.className = 'loading-content';
    loadingContent.style.display = 'flex';
    loadingContent.style.flexDirection = 'column';
    loadingContent.style.alignItems = 'center';
    loadingContent.style.justifyContent = 'center';
    loadingContent.style.height = '100%';
    loadingContent.style.width = '100%';
    loadingContent.style.backgroundColor = '#000000';

    const loadingTitle = document.createElement('h2');
    loadingTitle.className = 'loading-title';
    loadingTitle.textContent = 'PRE-RENDERING';
    loadingTitle.style.color = 'white';
    loadingTitle.style.margin = '0 0 20px 0';

    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'loading-spinner-container';

    const atomicSpinner = document.createElement('div');
    atomicSpinner.className = 'atomic-spinner';

    const nucleus = document.createElement('div');
    nucleus.className = 'nucleus';
    atomicSpinner.appendChild(nucleus);

    for (let i = 0; i < 3; i++) {
        const orbit = document.createElement('div');
        orbit.className = 'electron-orbit';
        const electron = document.createElement('div');
        electron.className = 'electron';
        orbit.appendChild(electron);
        atomicSpinner.appendChild(orbit);
    }

    spinnerContainer.appendChild(atomicSpinner);

    const progressText = document.createElement('div');
    progressText.id = 'loading-progress-text';
    progressText.className = 'loading-progress-text';
    progressText.textContent = 'Pre-rendering animation...';
    progressText.style.color = 'white';
    progressText.style.marginTop = '20px';

    const progressContainer = document.createElement('div');
    progressContainer.style.width = '80%';
    progressContainer.style.height = '4px';
    progressContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    progressContainer.style.borderRadius = '2px';
    progressContainer.style.overflow = 'hidden';
    progressContainer.style.marginTop = '10px';

    const progressBar = document.createElement('div');
    progressBar.id = 'pre-rendering-progress';
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = '#3498db';
    progressBar.style.transition = 'width 0.3s ease-out';

    progressContainer.appendChild(progressBar);
    loadingContent.appendChild(loadingTitle);
    loadingContent.appendChild(spinnerContainer);
    loadingContent.appendChild(progressText);
    loadingContent.appendChild(progressContainer);
    loadingOverlay.appendChild(loadingContent);

    return loadingOverlay;
}

// Main preview function (wrapper)
export function initalizePreview(settings, previewContent, setModalData) {
    if (!previewContent) return;

    try {
        const { html, meshId: currentMeshId, previewMode, playbackSpeed, animationType, isLongExposureMode, showPreviewBorders } = settings;
        
        currentPreviewSettings = settings;
        window.showPreviewBorders = showPreviewBorders;

        resetPreRenderState();
        resetPlaybackTimingState();

        if (setModalData) {
            setModalData('previewMode', previewMode);
        }

        cleanupThreeJsPreview();
        previewContent.innerHTML = '';
        setIsPreviewActive(true);

        const statusMessage = isLongExposureMode 
            ? 'Pre-rendering animation for long exposure capture...' 
            : 'Pre-rendering animation for smooth playback...';
        settings.updateStatus(statusMessage, 'info');

        const renderIframe = createHtmlRenderer(html, () => {
            if (!isPreviewActive) return;

            const { canvasContainer, errorLog, loadingOverlay } = createPreviewUI(previewContent);
            const progressBar = loadingOverlay.querySelector('#pre-rendering-progress');
            const progressText = loadingOverlay.querySelector('#loading-progress-text');

            setPreviewRenderTarget(renderIframe);
            setIsPreviewAnimationPaused(true);

            if (previewMode === 'css3d') {
                console.log('CSS3D initialization will happen after pre-rendering');
            } else {
                if (settings && typeof settings.updateStatus === 'function') {
                    settings.updateStatus('Initializing 3D cube preview...', 'info');
                } else {
                    showStatus('Initializing 3D cube preview...', 'info');
                }
                initThreeJsPreview(canvasContainer, renderIframe, currentMeshId, true);
            }

            switch (previewMode) {
                case 'css3d':
                    progressText.textContent = 'Analyzing CSS3D animation...';
                    startCss3dPreRendering(renderIframe, () => {
                        settings.updateStatus('Initializing CSS3D preview...', 'info');
                        import('three/examples/jsm/renderers/CSS3DRenderer.js')
                            .then(module => {
                                const { CSS3DRenderer, CSS3DObject } = module;
                                setupCSS3DScene(canvasContainer, renderIframe, CSS3DRenderer, CSS3DObject, currentMeshId, true);
                            });
                    }, progressBar, settings, previewPlane);
                    break;
                    
                case 'threejs':
                default:
                    progressText.textContent = 'Pre-rendering animation...';
                    startImage2TexturePreRendering(renderIframe, () => {
                        // Pre-rendering complete
                    }, progressBar, settings, previewPlane);
                    break;
            }
        });

    } catch (error) {
        logPreviewError(`Preview error: ${error.message}`, previewContent, settings.errorContainer, settings.statusCallback);
        settings.handleError('Error generating preview: ' + error.message);
    }
}


/**
 * Preview-specific animation loop wrapper
 */
export function animatePreview() {
    // Preview-specific early exit check
    if (!isPreviewActive) {
        console.log('Preview no longer active, stopping animation loop');
        return;
    }
    
    // Schedule next frame immediately for high priority
    previewAnimationId = requestAnimationFrame(animatePreview);
    
    try {
        // Prepare preview-specific settings
        const animationType = currentPreviewSettings?.animationType || 'play';
        const playbackSpeed = currentPreviewSettings?.playbackSpeed || 1.0;
        
        // Create settings object for generic animation function
        const animationSettings = {
            animationType,
            playbackSpeed,
            targetFrameRate,
            isPaused: isPreviewAnimationPaused
        };
        
        // Create frame state object
        const frameState = {
            lastFrameTime: lastAnimationFrameTime,
            frameInterval
        };
        
        // Call generic animation function
        const newFrameTime = runAnimationFrame(
            animationPreviewRenderer,
            animationPreviewScene, 
            animationPreviewCamera,
            previewPlane,
            animationSettings,
            frameState
        );
        
        // Update preview-specific frame time
        if (newFrameTime !== null) {
            lastAnimationFrameTime = newFrameTime;
        }
        
    } catch (error) {
        console.error('Error in preview animation loop:', error);
    }
}

export function resetPreviewAnimationId() {
    previewAnimationId = null;
}

export function resetLastAnimationFrameTime() {
    lastAnimationFrameTime = 0;
}

export function setLastAnimationFrameTime(incomingValue) {
    if(!incomingValue) {
        return;
    }
    lastAnimationFrameTime = incomingValue;
}