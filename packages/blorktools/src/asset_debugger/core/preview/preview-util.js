import * as THREE from 'three';
import { createTextureFromIframe } from '../texture-util';
import { originalAnimationStartTime, showStatus, PreviewSettings } from '../../ui/scripts/html-editor-modal';
import { animationDuration, isAnimationFinite, preRenderedFrames, preRenderingInProgress, resetPreRender, startImage2TexturePreRendering, startCss3dPreRendering } from '../animation-util';
import { sanitizeHtml } from '../string-serder';
import { getState } from '../state';
import { initCSS3DPreview } from '../css3d-util';
import { animationPreviewCamera, animationPreviewRenderer, animationPreviewScene, cleanupThreeJsPreview, initThreeJsPreview, previewPlane, setPreviewRenderTarget } from './threejs-util';
import { getHtmlSettingsForMesh } from '../mesh-data-util';

export let lastAnimationFrameTime = 0;
export let previewAnimationId = null;
const targetFrameRate = 60; // Target 60 FPS for better performance/animation balance
const frameInterval = 1000 / targetFrameRate;
// Add variables for CSS3D rendering
let webglRenderer;
// Three.js variables for preview
export let isPreviewAnimationPaused = false;
let lastTextureUpdateTime = 0;

// Add variables for frame buffering at the top of the file with other variables
export let maxCaptureRate = 0.5; // Reduce to 0.5ms between captures for more frames (was 1)
export let isPreviewActive = false; // Track if preview is currently active

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
function initializePreview(previewMode, canvasContainer, renderIframe, currentMeshId, startAnimation = true, createInfoPanel = true, animationType = 'none', settings = null) {
    // Remove DOM access for animation type
    // const animationTypeSelect = document.getElementById('html-animation-type');
    // const animationType = animationTypeSelect ? animationTypeSelect.value : 'none';

    // Remove the special case for long exposure that immediately pauses animation
    // For long exposure, we want to see the actual animation

    // If not starting animation immediately, pause it
    if (!startAnimation) {
        isPreviewAnimationPaused = true;
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
 * @param {PreviewSettings} settings - Object containing all settings for the preview
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
        window.createLongExposureImmediately = isLongExposureMode;

        resetPreRender();

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
        isPreviewActive = true;

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
            if (!isPreviewActive) return;

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
                        initCSS3DPreview(canvasContainer, renderIframe, currentMeshId, true);
                    }, progressBar);
                    break;
                    
                case 'threejs':
                default:
                    console.debug('Using Image2Texture pre-rendering method');
                    progressText.textContent = 'Pre-rendering animation...';
                    
                    startImage2TexturePreRendering(renderIframe, () => {
                        // The callback is now called from the final animation completion
                        console.log('Pre-rendering complete callback executed');
                    }, progressBar);
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
 * Set the isPreviewAnimationPaused flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsPreviewAnimationPaused(incomingValue) {
    isPreviewAnimationPaused = incomingValue;
}

/**
 * Set the lastTextureUpdateTime
 * @param {number} incomingValue - The new value to set
 */
export function setLastTextureUpdateTime(incomingValue) {
    lastTextureUpdateTime = incomingValue;
}

/**
 * Set the isPreviewActive flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsPreviewActive(incomingValue) {
    isPreviewActive = incomingValue;
}

/**
 * Animation loop for the Three.js preview
 */
export function animatePreview() {
    // If preview is no longer active, don't continue the animation loop
    if (!isPreviewActive) {
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
        
        // Calculate actual FPS for monitoring (once per second)
        if (now - lastAnimationFrameTime > 1000) {
            console.log(`Current framerate: ${Math.round(1000 / elapsed)} FPS`);
        }
        
        // Remember last frame time for throttling
        lastAnimationFrameTime = now - (elapsed % frameInterval);
        
        // Apply any animation effects to the mesh based on settings
        if (previewPlane) {
            // Use currentPreviewSettings instead of accessing DOM
            const currentMeshId = currentPreviewSettings?.meshId;
            
            // Get animation settings from currentPreviewSettings
            const animationType = currentPreviewSettings?.animationType || 'none';
            const playbackSpeed = currentPreviewSettings?.playbackSpeed || 1.0;
            
            // Apply animation based on type
            if (animationType !== 'none' && !isPreviewAnimationPaused) {
                const rotationSpeed = 0.005 * playbackSpeed;
                const time = performance.now() * 0.001;
                
                // Get the geometry's orientation data
                const geometry = previewPlane.geometry;
                const hasOrientationData = geometry && geometry.userData && geometry.userData.normalVector;
                
                switch (animationType) {
                    case 'loop':
                        if (hasOrientationData) {
                            // For oriented meshes, animate in a way that respects the face orientation
                            const normalVector = geometry.userData.normalVector;
                            const upVector = geometry.userData.upVector;
                            
                            // Create a rotation axis perpendicular to the normal
                            const rightVector = new THREE.Vector3().crossVectors(normalVector, upVector).normalize();
                            
                            // Create a quaternion for small rotations
                            const wobbleAmount = 0.05; // Smaller angle for subtle effect
                            const wobbleQuaternion = new THREE.Quaternion().setFromAxisAngle(
                                rightVector,
                                Math.sin(time * rotationSpeed * 5) * wobbleAmount
                            );
                            
                            // Apply this rotation relative to the mesh's base orientation
                            const baseQuaternion = previewPlane._baseQuaternion || previewPlane.quaternion.clone();
                            previewPlane._baseQuaternion = baseQuaternion;
                            
                            // Combine the base orientation with the animation
                            previewPlane.quaternion.copy(baseQuaternion).multiply(wobbleQuaternion);
                        } else {
                            // Fallback for meshes without orientation data
                            previewPlane.rotation.y = Math.PI / 6 + Math.sin(time * rotationSpeed * 5) * 0.2;
                        }
                        break;
                    case 'bounce':
                        if (hasOrientationData) {
                            // For oriented meshes, bounce along the normal vector
                            const normalVector = geometry.userData.normalVector;
                            const bounceOffset = Math.sin(time * rotationSpeed * 3) * 0.1;
                            const bounceVector = normalVector.clone().multiplyScalar(bounceOffset);
                            
                            // Apply bounce to position
                            previewPlane.position.copy(bounceVector);
                        } else {
                            // Fallback bounce for non-oriented meshes
                            previewPlane.position.y = Math.sin(time * rotationSpeed * 3) * 0.1;
                        }
                        break;
                    case 'longExposure':
                        // For long exposure, we don't need to do anything here
                        // The static image is created once after pre-rendering
                        break;
                    default:
                        break;
                }
            }
        }
        
        // Use currentPreviewSettings instead of accessing DOM
        const currentMeshId = currentPreviewSettings?.meshId;
        const playbackSpeed = currentPreviewSettings?.playbackSpeed || 1.0;
        const animationType = currentPreviewSettings?.animationType || 'none';
        
        // Skip frame updates if animation is paused or we're in long exposure mode
        if (isPreviewAnimationPaused || animationType === 'longExposure') {
            // Still render the scene with the current frame
            if (animationPreviewRenderer && animationPreviewScene && animationPreviewCamera) {
                animationPreviewRenderer.render(animationPreviewScene, animationPreviewCamera);
            }
            return;
        }
        
        // Handle playback based on available frames and speed
        const currentTime = Date.now();
        const elapsedSinceStart = currentTime - originalAnimationStartTime;
        
        // If we're pre-rendering or have pre-rendered frames - now for ALL speeds
        if (preRenderingInProgress || preRenderedFrames.length > 0) {
            // Calculate adjusted time based on playback speed
            const adjustedTime = elapsedSinceStart * playbackSpeed;
            
            // For finite animations, we need to handle looping
            if (isAnimationFinite && animationDuration > 0 && preRenderedFrames.length > 0) {
                // Calculate the position within the animation based on animation type
                let loopPosition;
                
                // First, calculate the normalized time position (shared between loop and bounce)
                // This is how the loop animation has been calculating it
                const normalizedTime = (adjustedTime % animationDuration) / animationDuration;
                
                // Log cycle completion (shared between loop and bounce)
                const cycleCount = Math.floor(adjustedTime / animationDuration);
                if (cycleCount > 0 && normalizedTime < 0.05) {
                    console.log(`Cycle ${cycleCount} complete`);
                }
                
                // Group all animation type handling together
                switch (animationType) {
                    case 'loop':
                        // Loop just uses the normalized time directly
                        loopPosition = normalizedTime;
                        break;
                        
                    case 'bounce':
                        // For bounce, we need to determine if we're in a forward or backward cycle
                        // Even cycles (0, 2, 4...) play forward, odd cycles (1, 3, 5...) play backward
                        const isForwardCycle = (cycleCount % 2 === 0);
                        
                        if (isForwardCycle) {
                            // Forward playback - use normalized time directly
                            loopPosition = normalizedTime;
                        } else {
                            // Backward playback - invert the normalized time
                            loopPosition = 1 - normalizedTime;
                        }
                        break;
                        
                    default: // 'none' or any other type
                        // Check if we've reached the end of the animation
                        if (adjustedTime >= animationDuration) {
                            // If not looping or bouncing, stay on the last frame
                            if (!isPreviewAnimationPaused) {
                                console.log('Animation complete, pausing at last frame');
                                setIsPreviewAnimationPaused(true);
                                
                                // Show the last frame
                                updateMeshTexture(preRenderedFrames[preRenderedFrames.length - 1].texture);
                                
                                // Show a message that playback has ended
                                if (currentPreviewSettings && typeof currentPreviewSettings.updateStatus === 'function') {
                                    currentPreviewSettings.updateStatus('Animation playback complete', 'info');
                                } else {
                                    showStatus('Animation playback complete', 'info');
                                }
                            }
                            return; // Exit early to avoid further processing
                        } else {
                            // If not at the end yet, clamp to the current position
                            loopPosition = adjustedTime / animationDuration;
                        }
                        break;
                }
                
                // Calculate frame index based on loop position
                const frameIndex = Math.min(
                    Math.floor(loopPosition * preRenderedFrames.length),
                    preRenderedFrames.length - 1
                );
                
                // Use the pre-rendered frame at this position
                if (frameIndex >= 0 && frameIndex < preRenderedFrames.length) {
                    updateMeshTexture(preRenderedFrames[frameIndex].texture);
                }
            }
            // For non-finite animations or while still pre-rendering
            else {
                // Calculate what time we should be showing
                const targetTime = originalAnimationStartTime + adjustedTime;
                
                // Find the frame with timestamp closest to our target time
                let closestFrameIndex = -1;
                let smallestDifference = Infinity;
                
                // Use pre-rendered frames first
                const framesArray = preRenderedFrames.length > 0 ? preRenderedFrames : frameBuffer;
                
                for (let i = 0; i < framesArray.length; i++) {
                    const difference = Math.abs(framesArray[i].timestamp - targetTime);
                    if (difference < smallestDifference) {
                        smallestDifference = difference;
                        closestFrameIndex = i;
                    }
                }
                
                // If we have a valid frame, use it
                if (closestFrameIndex >= 0 && closestFrameIndex < framesArray.length) {
                    // Update texture with the appropriate frame
                    updateMeshTexture(framesArray[closestFrameIndex].texture);
                }
            }
        }
        // If no pre-rendered frames and not pre-rendering, log error
        else {
            console.error('No pre-rendered frames available and not pre-rendering');
        }
        
        // Render the scene - this is always done at the target framerate
        if (animationPreviewRenderer && animationPreviewScene && animationPreviewCamera) {
            animationPreviewRenderer.render(animationPreviewScene, animationPreviewCamera);
        }
    } catch (error) {
        console.error('Error in animation loop:', error);
        // Don't stop the animation loop for errors, just log them
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

/**
 * Update the mesh texture with the given texture
 * @param {THREE.Texture} texture - The texture to apply to the mesh
 */
export function updateMeshTexture(texture) {
    if (!texture || !previewPlane || !previewPlane.material) return;
    
    let needsUpdate = false;
    
    if (Array.isArray(previewPlane.material)) {
        previewPlane.material.forEach(material => {
            if (material.map !== texture) {
                material.map = texture;
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            previewPlane.material.forEach(material => {
                material.needsUpdate = true;
            });
        }
    } else {
        if (previewPlane.material.map !== texture) {
            previewPlane.material.map = texture;
            previewPlane.material.needsUpdate = true;
        }
    }
}