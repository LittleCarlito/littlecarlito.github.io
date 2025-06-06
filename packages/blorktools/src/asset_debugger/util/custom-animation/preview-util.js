import * as THREE from 'three';
import { showStatus, CustomTextureSettings } from '../../modals/html-editor-modal/html-editor-modal';
import { 
    resetPreRender, 
    startImage2TexturePreRendering, 
    startCss3dPreRendering,
    updateMeshTexture,
    getIsPreviewActive,
    getIsPreviewAnimationPaused,
    setIsPreviewActive,
    setIsPreviewAnimationPaused,
    getCurrentFrameForPlayback,
    resetPlaybackTiming
} from '../../util/custom-animation/animation-util';
import { sanitizeHtml } from '../../util/string-serder';
import { initCSS3DAnimation } from '../css3d/css3d-animation-util';
import { 
    animationPreviewCamera, 
    animationPreviewRenderer, 
    animationPreviewScene, 
    cleanupThreeJsPreview, 
    initThreeJsPreview, 
    previewPlane, 
    setPreviewRenderTarget 
} from '../../util/custom-animation/threejs-util';

export let lastAnimationFrameTime = 0;
export let previewAnimationId = null;
const targetFrameRate = 60; // Target 60 FPS for better performance/animation balance
const frameInterval = 1000 / targetFrameRate;
// Add variables for CSS3D rendering
let webglRenderer;
// Store current preview settings
export let currentPreviewSettings = null;

/**
 * Initialize the preview based on the selected mode
 * @param {string} previewMode - The preview mode (threejs or css3d)
 * @param {HTMLElement} canvasContainer - The container for the preview
 * @param {HTMLIFrameElement} renderIframe - The iframe containing the HTML content
 * @param {number} currentMeshId - The ID of the current mesh
 * @param {boolean} startAnimation - Whether to start the animation immediately
 * @param {boolean} createInfoPanel - Whether to create the info panel
 * @param {string} animationType - The type of animation
 * @param {PreviewSettings} settings - Complete settings object
 */
function initializePreview(previewMode, canvasContainer, renderIframe, currentMeshId, startAnimation = true, createInfoPanel = true, animationType = 'play', settings = null) {
    // Remove DOM access for animation type
    // const animationTypeSelect = document.getElementById('html-animation-type');
    // const animationType = animationTypeSelect ? animationTypeSelect.value : 'play';

    // If not starting animation immediately, pause it
    if (!startAnimation) {
        setIsPreviewAnimationPaused(true);
    }

    // Initialize preview based on mode
    if (previewMode === 'css3d') {
        // The CSS3D preview should not be initialized until pre-rendering is complete
        // This will be called from the callback after pre-rendering
        console.log('CSS3D initialization will happen after pre-rendering');
    } else {
        // Default to threejs mode
        if (settings && typeof settings.updateStatus === 'function') {
            settings.updateStatus('Initializing 3D cube preview...', 'info');
        } else {
            showStatus('Initializing 3D cube preview...', 'info');
        }
        initThreeJsPreview(canvasContainer, renderIframe, currentMeshId, createInfoPanel);
    }
}

/**
 * Preview HTML code using Three.js
 * @param {CustomTextureSettings} settings - Object containing all settings for the preview
 * @param {HTMLElement} previewContent - Container element for the preview
 * @param {Function} setModalData - Function to set modal data attributes
 */
export function previewHtml(settings, previewContent, setModalData) {
    if (!previewContent) return;

    try {
        // Extract values from settings
        const html = settings.html;
        const currentMeshId = settings.meshId;
        const previewMode = settings.previewMode;
        const playbackSpeed = settings.playbackSpeed;
        const animationType = settings.animationType;
        
        // Store settings for use in animatePreview
        currentPreviewSettings = settings;
        
        // For long exposure, set a flag to indicate we should create the long exposure immediately
        // This prevents showing the first frame before the long exposure
        const isLongExposureMode = settings.isLongExposureMode;
        window.showPreviewBorders = settings.showPreviewBorders;

        resetPreRender();
        resetPlaybackTiming(); // Reset timing state for new preview

        // Store the preview mode in the modal dataset if setModalData function is provided
        if (setModalData) {
            setModalData('previewMode', previewMode);
        }

        // Always do a full cleanup for a new preview
        console.log('Cleaning up previous preview');
        // Clean up any existing preview
        cleanupThreeJsPreview();

        // Clear the preview container
        previewContent.innerHTML = '';

        // Set preview as active
        setIsPreviewActive(true);

        // The sanitizeHtml function handles wrapping fragments if needed
        const sanitizedHtml = sanitizeHtml(html);

        // Create a hidden iframe for rendering HTML to texture (if needed)
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

        // Store reference to the iframe
        setPreviewRenderTarget(renderIframe);

        // Make sure the preview content container has proper positioning for absolute children
        previewContent.style.position = 'relative';
        previewContent.style.minHeight = '400px';
        previewContent.style.height = '100%';

        // Always pre-render for all speeds
        const needsPreRendering = true;

        // For long exposure, show a different status message
        if (isLongExposureMode) {
            settings.updateStatus('Pre-rendering animation for long exposure capture...', 'info');
        } else {
            settings.updateStatus('Pre-rendering animation for smooth playback...', 'info');
        }

        // Wait for iframe to be ready
        renderIframe.onload = () => {
            // Only proceed if preview is still active
            if (!getIsPreviewActive()) return;

            // Create container for Three.js canvas
            const canvasContainer = document.createElement('div');
            canvasContainer.style.width = '100%';
            canvasContainer.style.height = '100%';
            canvasContainer.style.position = 'absolute';
            canvasContainer.style.top = '0';
            canvasContainer.style.left = '0';
            canvasContainer.style.right = '0';
            canvasContainer.style.bottom = '0';
            canvasContainer.style.overflow = 'hidden';
            canvasContainer.style.display = 'block'; // Always display since 'direct' mode is removed
            previewContent.appendChild(canvasContainer);

            // Add error log container
            const errorLog = document.createElement('div');
            errorLog.id = 'html-preview-error-log';
            errorLog.className = 'preview-error-log';
            errorLog.style.display = 'none';
            previewContent.appendChild(errorLog);

            // Add a loading overlay that matches the loading-splash.html style
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'pre-rendering-overlay';
            loadingOverlay.className = 'loading-splash';
            loadingOverlay.style.position = 'absolute';
            loadingOverlay.style.top = '0';
            loadingOverlay.style.left = '0';
            loadingOverlay.style.width = '100%';
            loadingOverlay.style.height = '100%';
            loadingOverlay.style.backgroundColor = '#000000'; // Solid black background
            loadingOverlay.style.zIndex = '1000';

            // Remove any border/outline that might be causing green lines
            loadingOverlay.style.border = 'none';
            loadingOverlay.style.outline = 'none';
            loadingOverlay.style.boxShadow = 'none';

            // Create content container similar to loading-splash.html
            const loadingContent = document.createElement('div');
            loadingContent.className = 'loading-content';
            loadingContent.style.display = 'flex';
            loadingContent.style.flexDirection = 'column';
            loadingContent.style.alignItems = 'center';
            loadingContent.style.justifyContent = 'center';
            loadingContent.style.height = '100%';
            loadingContent.style.width = '100%';
            loadingContent.style.backgroundColor = '#000000'; // Ensure content background is also black

            // Create title
            const loadingTitle = document.createElement('h2');
            loadingTitle.className = 'loading-title';
            loadingTitle.textContent = 'PRE-RENDERING';
            loadingTitle.style.color = 'white';
            loadingTitle.style.margin = '0 0 20px 0';

            // Create spinner container
            const spinnerContainer = document.createElement('div');
            spinnerContainer.className = 'loading-spinner-container';

            // Create atomic spinner
            const atomicSpinner = document.createElement('div');
            atomicSpinner.className = 'atomic-spinner';

            // Create nucleus
            const nucleus = document.createElement('div');
            nucleus.className = 'nucleus';
            atomicSpinner.appendChild(nucleus);

            // Create electron orbits (3)
            for (let i = 0; i < 3; i++) {
                const orbit = document.createElement('div');
                orbit.className = 'electron-orbit';

                const electron = document.createElement('div');
                electron.className = 'electron';

                orbit.appendChild(electron);
                atomicSpinner.appendChild(orbit);
            }

            spinnerContainer.appendChild(atomicSpinner);

            // Create progress text
            const progressText = document.createElement('div');
            progressText.id = 'loading-progress-text';
            progressText.className = 'loading-progress-text';
            progressText.textContent = 'Pre-rendering animation...';
            progressText.style.color = 'white';
            progressText.style.marginTop = '20px';

            // Create progress bar
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
            progressBar.style.transition = 'width 0.3s ease-out'; // Smoother transition

            progressContainer.appendChild(progressBar);

            // Assemble the loading overlay
            loadingContent.appendChild(loadingTitle);
            loadingContent.appendChild(spinnerContainer);
            loadingContent.appendChild(progressText);
            loadingContent.appendChild(progressContainer);
            loadingOverlay.appendChild(loadingContent);
            canvasContainer.appendChild(loadingOverlay);

            // Initialize the preview first, but don't start animation yet
            // Pass false for createInfoPanel to prevent creating the info panel until pre-rendering is complete
            initializePreview(previewMode, canvasContainer, renderIframe, currentMeshId, false, false, animationType, settings);

            // Start pre-rendering with a callback for when it's done
            switch (previewMode) {
                case 'css3d':
                    console.debug('Using CSS3D pre-rendering method');
                    // Update loading text to match CSS3D analysis
                    progressText.textContent = 'Analyzing CSS3D animation...';
                    
                    // Use the imported CSS3D pre-rendering function
                    // IMPORTANT: Initialize CSS3D preview only AFTER pre-rendering is complete
                    startCss3dPreRendering(renderIframe, () => {
                        // The callback is executed when pre-rendering is complete
                        console.log('CSS3D pre-rendering complete, initializing preview');
                        
                        // Now create and show the CSS3D preview
                        settings.updateStatus('Initializing CSS3D preview...', 'info');
                        
                        // Pass true for createInfoPanel to ensure the info panel is created
                        initCSS3DAnimation(canvasContainer, renderIframe, currentMeshId, true);
                    }, progressBar, settings, previewPlane);
                    break;
                    
                case 'threejs':
                default:
                    console.debug('Using Image2Texture pre-rendering method');
                    progressText.textContent = 'Pre-rendering animation...';
                    
                    startImage2TexturePreRendering(renderIframe, () => {
                        // The callback is now called from the final animation completion
                        console.log('Pre-rendering complete callback executed');
                    }, progressBar, settings, previewPlane);
                    break;
            }
        };

        // Write content to iframe
        try {
            renderIframe.srcdoc = sanitizedHtml;
        } catch (error) {
            console.error('Error setting iframe srcdoc:', error);
            // Fallback method
            renderIframe.contentDocument.open();
            renderIframe.contentDocument.write(sanitizedHtml);
            renderIframe.contentDocument.close();
        }
    } catch (error) {
        logPreviewError(`Preview error: ${error.message}`, previewContent, settings.errorContainer, settings.statusCallback);
        console.error('HTML Preview error:', error);
        settings.handleError('Error generating preview: ' + error.message);
    }
}

/**
 * Log errors to the preview error console
 * @param {string} message - Error message to display
 * @param {HTMLElement} previewContent - The preview content container
 * @param {HTMLElement} existingErrorLog - Existing error log element (optional)
 * @param {Function} statusCallback - Function to call to show status messages
 */
function logPreviewError(message, previewContent, existingErrorLog, statusCallback) {
    // Get or create error log element
    let errorLog = existingErrorLog;
    
    // Create error log if it doesn't exist
    if (!errorLog) {
        errorLog = document.createElement('div');
        errorLog.id = 'html-preview-error-log';
        errorLog.className = 'preview-error-log';
        
        if (previewContent) {
            previewContent.appendChild(errorLog);
        }
    }
    
    // Make error log visible
    errorLog.style.display = 'block';
    
    // Create error entry
    const errorEntry = document.createElement('div');
    errorEntry.className = 'error-entry';
    errorEntry.textContent = message;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'error-time';
    timeSpan.textContent = `[${timestamp}] `;
    errorEntry.prepend(timeSpan);
    
    // Add to log
    errorLog.appendChild(errorEntry);
    
    // Show the error in the editor status as well
    if (statusCallback) {
        statusCallback(message, 'error');
    } else {
        // Fallback to imported showStatus if available
        showStatus(message, 'error');
    }
    
    console.error(message);
}

/**
 * Animation loop for the Three.js preview
 */
export function animatePreview() {
    // If preview is no longer active, don't continue the animation loop
    if (!getIsPreviewActive()) {
        console.log('Preview no longer active, stopping animation loop');
        return;
    }
    
    // Schedule next frame immediately for high priority
    previewAnimationId = requestAnimationFrame(animatePreview);
    
    try {
        // Throttle to target framerate
        const now = performance.now();
        const elapsed = now - lastAnimationFrameTime;
        
        if (elapsed < frameInterval) {
            return; // Skip rendering this frame if we're ahead of schedule
        }
        
        lastAnimationFrameTime = now - (elapsed % frameInterval);
        
        // Get current preview settings
        const animationType = currentPreviewSettings?.animationType || 'play';
        const playbackSpeed = currentPreviewSettings?.playbackSpeed || 1.0;
        
        // Skip frame updates if animation is paused
        if (getIsPreviewAnimationPaused()) {
            // Still render the scene with the current frame
            if (animationPreviewRenderer && animationPreviewScene && animationPreviewCamera) {
                animationPreviewRenderer.render(animationPreviewScene, animationPreviewCamera);
            }
            return;
        }
        
        // Get the current frame using the centralized timing system
        const currentFrame = getCurrentFrameForPlayback(playbackSpeed, animationType);
        
        if (currentFrame && currentFrame.texture) {
            updateMeshTexture(currentFrame.texture, previewPlane);
        }
        
        // Apply mesh animation (rotation, bounce, etc.) if not 'play' type
        if (animationType !== 'play' && !getIsPreviewAnimationPaused()) {
            applyMeshAnimation(animationType, playbackSpeed);
        }
        
        // Render the scene
        if (animationPreviewRenderer && animationPreviewScene && animationPreviewCamera) {
            animationPreviewRenderer.render(animationPreviewScene, animationPreviewCamera);
        }
        
    } catch (error) {
        console.error('Error in animation loop:', error);
        // Don't stop the animation loop for errors, just log them
    }
}

/**
 * Apply mesh-level animation (separate from texture animation)
 */
function applyMeshAnimation(animationType, playbackSpeed) {
    if (!previewPlane) return;
    
    const rotationSpeed = 0.005 * playbackSpeed;
    const time = performance.now() * 0.001;
    
    // Get the geometry's orientation data
    const geometry = previewPlane.geometry;
    const hasOrientationData = geometry && geometry.userData && geometry.userData.normalVector;
    
    switch (animationType) {
        case 'loop':
            if (hasOrientationData) {
                const normalVector = geometry.userData.normalVector;
                const upVector = geometry.userData.upVector;
                const rightVector = new THREE.Vector3().crossVectors(normalVector, upVector).normalize();
                
                const wobbleAmount = 0.05;
                const wobbleQuaternion = new THREE.Quaternion().setFromAxisAngle(
                    rightVector,
                    Math.sin(time * rotationSpeed * 5) * wobbleAmount
                );
                
                const baseQuaternion = previewPlane._baseQuaternion || previewPlane.quaternion.clone();
                previewPlane._baseQuaternion = baseQuaternion;
                previewPlane.quaternion.copy(baseQuaternion).multiply(wobbleQuaternion);
            } else {
                previewPlane.rotation.y = Math.PI / 6 + Math.sin(time * rotationSpeed * 5) * 0.2;
            }
            break;
            
        case 'bounce':
            if (hasOrientationData) {
                const normalVector = geometry.userData.normalVector;
                const bounceOffset = Math.sin(time * rotationSpeed * 3) * 0.1;
                const bounceVector = normalVector.clone().multiplyScalar(bounceOffset);
                previewPlane.position.copy(bounceVector);
            } else {
                previewPlane.position.y = Math.sin(time * rotationSpeed * 3) * 0.1;
            }
            break;
    }
}

/**
 * Reset preview animation id
 */
export function resetPreviewAnimationId() {
    previewAnimationId = null;
}

/**
 * Reset last animation frame time
 */
export function resetLastAnimationFrameTime() {
    lastAnimationFrameTime = 0;
}