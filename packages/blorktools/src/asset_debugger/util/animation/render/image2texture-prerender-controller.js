import * as THREE from 'three';
import { 
    animationDetected,
    animationDetectionSensitivity,
    animationDuration,
    animationStartDetected,
    finalProgressAnimation, 
    finalProgressDuration, 
    finalProgressStartTime, 
    isAnimationFinite, 
    isPreviewActive, 
    preRenderedFrames, 
    preRenderingInProgress, 
    preRenderMaxDuration, 
    setAnimationDuration, 
    setFinalProgressAnimation, 
    setFinalProgressStartTime, 
    setIsAnimationFinite, 
    setIsPreviewAnimationPaused, 
    setPreRenderedFrames, 
    setPreRenderingInProgress, 
} from "../../state/animation-state";
import { showStatus } from '../../../modals/html-editor-modal/html-editor-modal';
import { createMeshInfoPanel } from '../../../widgets/mesh-info-widget';
import { logAnimationAnalysisReport } from '../../state/log-util';
import { startPlayback, updateMeshTexture } from '../playback/animation-playback-controller';
import { createTextureFromIframe } from './iframe2texture-render-controller';

/**
 * Start pre-rendering animation frames
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {Function} callback - Function to call when pre-rendering is complete
 * @param {HTMLElement} progressBar - Optional progress bar element to update
 * @param {CustomTextureSettings} settings - Optional settings object for texture configuration
 * @param {THREE.Mesh} previewPlane - The mesh to apply textures to
 */
export function startImage2TexturePreRendering(iframe, callback, progressBar = null, settings = null, previewPlane = null) {
    if (!iframe) {
        console.error('No iframe provided for pre-rendering');
        if (callback) callback();
        return;
    }
    
    // Reset state
    setPreRenderingInProgress(true);
    setPreRenderedFrames([]);
    
    // Set the start time
    const preRenderStartTime = Date.now();
    
    // Track progress metrics
    let totalFramesEstimate = 120; // Initial estimate
    let lastProgressUpdate = 0;
    let progressUpdateInterval = 100; // Update progress every 100ms
    let maxProgressBeforeFinalAnimation = 92; // Cap progress at this value until final animation
    setFinalProgressAnimation(false);
    setFinalProgressStartTime(0);
    
    // Track animation detection variables
    let loopDetected = false;
    let endDetected = false;
    let analysisMetrics = {};
    
    // Get animation settings from passed settings object instead of DOM
    let isLongExposureMode = false;
    let playbackSpeed = 1.0;
    
    if (settings) {
        // Use settings parameters instead of DOM elements
        isLongExposureMode = settings.isLongExposureMode;
        playbackSpeed = settings.playbackSpeed || 1.0;
    } else {
        // Fallback to DOM access if settings not provided (for backward compatibility)
        const animationTypeSelect = document.getElementById('html-animation-type');
        isLongExposureMode = animationTypeSelect && animationTypeSelect.value === 'longExposure';
    }
    
    // Set flag if we're capturing for long exposure
    if (isLongExposureMode) {
        setCapturingForLongExposure(true);
        
        // Temporarily disable borders during capture
        const originalBorderSetting = window.showPreviewBorders;
        window.showPreviewBorders = false;
        console.log('Borders temporarily disabled for long exposure capture');
        
        // Store original setting to restore later
        window._originalBorderSetting = originalBorderSetting;
    }
    
    // Function to update progress bar
    const updateProgress = (percent) => {
        if (progressBar) {
            // Ensure progress never exceeds maxProgressBeforeFinalAnimation unless in final animation
            if (!finalProgressAnimation && percent > maxProgressBeforeFinalAnimation) {
                percent = maxProgressBeforeFinalAnimation;
            }
            progressBar.style.width = `${percent}%`;
        }
    };
    
    // Function to create the long exposure texture and apply it
    const createAndApplyLongExposure = () => {
        if (preRenderedFrames.length > 0) {
            // Use the playbackSpeed from settings instead of DOM
            const longExposureTexture = createLongExposureTexture(preRenderedFrames, playbackSpeed);
            
            // Update the mesh with the long exposure texture
            if (previewPlane) {
                updateMeshTexture(longExposureTexture, previewPlane);
            }
            
            // Show a message about the long exposure
            showStatus(`Long exposure created from ${preRenderedFrames.length} frames`, 'success');
            
            // Pause animation since we just want to display the static image
            setIsPreviewAnimationPaused(true);
        }
    };
    
    // Function to start final progress animation
    const startFinalProgressAnimation = () => {
        if (finalProgressAnimation) return; // Already animating
        
        setFinalProgressAnimation(true);
        setFinalProgressStartTime(Date.now());
        
        // Start the animation loop
        animateFinalProgress();
    };
    
    // Function to animate progress to 100%
    const animateFinalProgress = () => {
        const now = Date.now();
        const elapsed = now - finalProgressStartTime;
        
        if (elapsed >= finalProgressDuration) {
            // Animation complete, set to 100%
            updateProgress(100);
            
            // Log animation analysis report
            logAnimationAnalysisReport('Image2Texture', {
                frameCount: preRenderedFrames.length,
                duration: animationDuration,
                isFinite: isAnimationFinite,
                loopDetected,
                endDetected,
                analysisTime: now - preRenderStartTime,
                metrics: analysisMetrics
            });
            
            // Hide loading overlay with fade out
            const loadingOverlay = document.getElementById('pre-rendering-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.transition = 'opacity 0.5s ease';
                loadingOverlay.style.opacity = '0';
                
                // Remove after fade out
                setTimeout(() => {
                    if (loadingOverlay.parentNode) {
                        loadingOverlay.parentNode.removeChild(loadingOverlay);
                    }
                    
                    // Now create the info panel after pre-rendering is complete
                    const canvasContainer = document.querySelector('#html-preview-content');
                    if (canvasContainer) {
                        const modal = document.getElementById('html-editor-modal');
                        const currentMeshId = parseInt(modal.dataset.meshId);
                        createMeshInfoPanel(canvasContainer, currentMeshId);
                    }
                    
                    // For long exposure, create the static image now that all frames are captured
                    if (isLongExposureMode && preRenderedFrames.length > 0) {
                        // Use playbackSpeed from settings instead of DOM
                        const longExposureTexture = createLongExposureTexture(preRenderedFrames, playbackSpeed);
                        
                        // Update the mesh with the long exposure texture
                        if (previewPlane) {
                            updateMeshTexture(longExposureTexture, previewPlane);
                        }
                        
                        // Show a message about the long exposure
                        showStatus(`Long exposure created from ${preRenderedFrames.length} frames`, 'success');
                        
                        // Pause animation since we just want to display the static image
                        setIsPreviewAnimationPaused(true);
                    } else {
                        // Reset animation start time to now
                        startPlayback();
                        
                        // Start the animation
                        setIsPreviewAnimationPaused(false);
                        
                        // Show a message that playback is starting
                        showStatus(`Animation playback starting at ${playbackSpeed}x speed`, 'success');
                    }
                }, 500);
                
                // Don't continue the animation
                return;
            }
        } else {
            // Calculate progress based on easing function
            const progress = easeOutCubic(elapsed / finalProgressDuration);
            const currentProgress = maxProgressBeforeFinalAnimation + (100 - maxProgressBeforeFinalAnimation) * progress;
            updateProgress(currentProgress);
            
            // Update loading text
            const progressText = document.getElementById('loading-progress-text');
            if (progressText) {
                if (isLongExposureMode) {
                    progressText.textContent = 'Creating long exposure...';
                } else {
                    progressText.textContent = 'Finalizing animation...';
                }
            }
            
            // Continue animation
            requestAnimationFrame(animateFinalProgress);
        }
    };
    
    // Easing function for smooth animation
    const easeOutCubic = (x) => {
        return 1 - Math.pow(1 - x, 3);
    };
    
    // Create high-quality texture from iframe for better visuals
    const createHighQualityTexture = async (iframe) => {
        try {
            const texture = await createTextureFromIframe(iframe);
            
            // Apply higher quality settings
            texture.anisotropy = 16; // Increased from 8 for sharper textures
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            texture.needsUpdate = true;
            
            return texture;
        } catch (error) {
            console.error('Error creating high-quality texture:', error);
            throw error;
        }
    };
    
    // Function to capture frames until animation completes or times out
    const captureFrames = async () => {
        if (!isPreviewActive || !preRenderingInProgress) {
            setPreRenderingInProgress(false);
            startFinalProgressAnimation();
            return;
        }
        
        const now = Date.now();
        
        // Update progress based on more accurate metrics
        if (now - lastProgressUpdate > progressUpdateInterval) {
            lastProgressUpdate = now;
            
            // Calculate elapsed time percentage
            const elapsedTime = now - preRenderStartTime;
            const timeProgress = Math.min(90, (elapsedTime / preRenderMaxDuration) * 100);
            
            // Calculate frame-based progress
            let frameProgress = 0;
            if (animationDetected) {
                // If we've detected animation, adjust the total frames estimate
                if (preRenderedFrames.length > totalFramesEstimate * 0.5) {
                    // If we've captured more than half our estimate, update the estimate
                    totalFramesEstimate = Math.max(totalFramesEstimate, Math.ceil(preRenderedFrames.length * 1.2));
                }
                frameProgress = Math.min(90, (preRenderedFrames.length / totalFramesEstimate) * 100);
            } else {
                // If no animation detected, use time-based progress
                frameProgress = timeProgress;
            }
            
            // Use a weighted combination of time and frame progress
            // Cap at maxProgressBeforeFinalAnimation to leave room for final animation
            const combinedProgress = Math.min(
                maxProgressBeforeFinalAnimation, 
                (timeProgress * 0.3) + (frameProgress * 0.7)
            );
            updateProgress(combinedProgress);
            
            // Update the loading text to show more information
            const progressText = document.getElementById('loading-progress-text');
            if (progressText) {
                progressText.textContent = `Pre-rendering animation... ${preRenderedFrames.length} frames captured`;
            }
        }
        
        // Check if we've detected a loop and have enough frames
        // Use the improved detection logic with higher sensitivity for pre-rendering
        const sensitivity = animationDetectionSensitivity + 0.1; // Slight boost during pre-rendering
        const isLoopDetected = preRenderedFrames.length > 20 && 
                             detectAnimationLoop(preRenderedFrames, sensitivity);
                             
        if (isLoopDetected && preRenderedFrames.length > 20) {
            console.log('Animation loop detected after ' + preRenderedFrames.length + ' frames');
            setPreRenderingInProgress(false);
            setIsAnimationFinite(true);
            setAnimationDuration(preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp);
            
            // Update analysis metrics
            loopDetected = true;
            
            // Show success message
            if (isLongExposureMode) {
                showStatus(`Animation loop detected, creating long exposure from ${preRenderedFrames.length} frames`, 'info');
            } else {
                showStatus(`Animation loop detected (${(animationDuration/1000).toFixed(1)}s), ${preRenderedFrames.length} frames captured`, 'success');
            }
            
            // Start final progress animation instead of immediately calling callback
            startFinalProgressAnimation();
            return;
        }
        
        // Check for animation end using the new analysis function
        if (preRenderedFrames.length > 20) { // Reduced from 30
            // Calculate the latest frame hash
            const latestFrameHash = preRenderedFrames[preRenderedFrames.length - 1].hash;
            
            // Analyze frames to detect animation end with higher sensitivity
            const analysisResult = analyzeAnimationFrames(
                preRenderedFrames.slice(0, -1), // All frames except the latest
                latestFrameHash,
                sensitivity
            );
            
            // Store analysis metrics
            analysisMetrics = analysisResult.metrics;
            
            // If end detected and we have enough frames, stop pre-rendering
            if (analysisResult.endDetected && preRenderedFrames.length > 20) {
                console.log('Animation end detected during pre-rendering after ' + preRenderedFrames.length + ' frames');
                console.log('Detection metrics:', analysisResult.metrics);
                setPreRenderingInProgress(false);
                setIsAnimationFinite(true);
                setAnimationDuration(preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp);
                
                // Update analysis metrics
                endDetected = true;
                
                // Show success message
                showStatus(`Animation end detected (${(animationDuration/1000).toFixed(1)}s), ${preRenderedFrames.length} frames captured`, 'success');
                
                // Start final progress animation instead of immediately calling callback
                startFinalProgressAnimation();
                return;
            }
        }
        
        // Check if we've exceeded the maximum pre-rendering time
        if (now - preRenderStartTime > preRenderMaxDuration) {
            console.log('Pre-rendering time limit reached after ' + preRenderMaxDuration + 'ms');
            setPreRenderingInProgress(false);
            
            if (loopDetected) {
                setIsAnimationFinite(true);
                setAnimationDuration(preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp);
                console.log(`Animation loop detected, duration: ${animationDuration}ms, ${preRenderedFrames.length} frames captured`);
                showStatus(`Animation loop detected (${(animationDuration/1000).toFixed(1)}s), ${preRenderedFrames.length} frames captured`, 'success');
            } else if (animationStartDetected) {
                setIsAnimationFinite(true);
                setAnimationDuration(animationEndTime - animationStartTime);
                console.log(`Animation start/end detected, duration: ${animationDuration}ms, ${preRenderedFrames.length} frames captured`);
                showStatus(`Animation start/end detected (${(animationDuration/1000).toFixed(1)}s), ${preRenderedFrames.length} frames captured`, 'success');
                
                // Update analysis metrics
                endDetected = true;
            } else {
                console.log(`No animation loop detected, ${preRenderedFrames.length} frames captured`);
                showStatus(`Animation appears infinite, ${preRenderedFrames.length} frames captured for playback`, 'info');
            }
            
            // Start final progress animation instead of immediately calling callback
            startFinalProgressAnimation();
            return;
        }
        
        try {
            // Capture a high-quality frame
            const texture = await createHighQualityTexture(iframe);
            
            // Calculate a hash of the texture to detect changes
            const frameHash = calculateTextureHash(texture);
            
            // Add frame to pre-rendered frames
            preRenderedFrames.push({
                texture: texture,
                timestamp: now,
                hash: frameHash
            });
            
            // For long exposure mode, if we have enough frames, create the texture immediately
            // This prevents showing the first frame before the long exposure
            if (isLongExposureMode && preRenderedFrames.length >= 15) {
                // Create the long exposure immediately
                createAndApplyLongExposure();
            }
            
            // Use a shorter delay for more frequent frame capture to increase smoothness
            setTimeout(() => {
                requestAnimationFrame(captureFrames);
            }, 5); // 5ms delay allows for more frames to be captured in the same time
        } catch (error) {
            console.error('Error during pre-rendering:', error);
            setPreRenderingInProgress(false);
            
            // Start final progress animation instead of immediately calling callback
            startFinalProgressAnimation();
        }
    };
    
    // Start capturing frames
    captureFrames();
    
    // Store callback to be called after final animation completes
    window._preRenderCallback = callback;
}

/**
 * Calculate a simple hash of a texture to detect changes between frames
 * @param {THREE.Texture} texture - The texture to hash
 * @returns {string} A simple hash of the texture
 */
function calculateTextureHash(texture) {
    if (!texture || !texture.image) return '';
    
    try {
        // Create a small canvas to sample the texture
        const canvas = document.createElement('canvas');
        const size = 16; // Small sample size for performance
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Draw the texture to the canvas
        ctx.drawImage(texture.image, 0, 0, size, size);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, size, size).data;
        
        // Sample pixels at regular intervals
        const samples = [];
        const step = 4 * 4; // Sample every 4th pixel (RGBA)
        for (let i = 0; i < imageData.length; i += step) {
            // Use just the RGB values (skip alpha)
            samples.push(imageData[i], imageData[i+1], imageData[i+2]);
        }
        
        // Create a simple hash from the samples
        return samples.join(',');
    } catch (e) {
        console.error('Error calculating texture hash:', e);
        return '';
    }
}