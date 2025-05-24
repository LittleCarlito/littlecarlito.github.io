import * as THREE from 'three';
import { setOriginalAnimationStartTime, showStatus } from "../html-editor-modal/html-editor-modal";
import { calculateTextureHash, createLongExposureTexture, createTextureFromIframe, setCapturingForLongExposure } from "../core/texture-util";
import { createMeshInfoPanel } from '../core/mesh-info-panel-util';

// Debug reporting function for animation analysis
function logAnimationAnalysisReport(renderType, data) {
    const {
        frameCount,
        duration,
        isFinite,
        loopDetected,
        endDetected,
        analysisTime,
        metrics
    } = data;
    
    console.debug(
        `%c Animation Analysis Report: ${renderType} %c`,
        'background: #4285f4; color: white; padding: 2px 6px; border-radius: 2px; font-weight: bold;',
        'background: transparent;'
    );
    
    console.debug({
        renderType,
        framesAnalyzed: frameCount,
        duration: duration ? `${(duration/1000).toFixed(2)}s` : 'unknown',
        isFiniteAnimation: isFinite,
        loopDetected,
        endDetected,
        analysisTime: `${(analysisTime/1000).toFixed(2)}s`,
        metrics
    });
}

let isPreRenderingComplete = false;
let finalProgressAnimation = false;
let finalProgressStartTime = 0;
let finalProgressDuration = 800; // Duration of final progress animation in ms

let animationChangeThreshold = 0.008; // Lower threshold for detecting change (was 0.01)
let animationIdleThreshold = 30; // Number of similar frames before considering animation ended
let frameChangeRates = []; // Store recent frame change rates
let animationIdleCount = 0;
let previousChangeFrequency = 0; // Track previous change frequency
let bufferExhausted = false;
let bufferExhaustWarningShown = false;
let fallbackToRealtime = false;
let preRenderAttempted = false;
let preRenderStartTime = 0;
let preRenderMaxDuration = 30000; // Increased to 30 seconds for longer animations
let animationDetectionSensitivity = 0.85; // Increased from 0.5 to 0.85 for much stricter detection by default
let animationEndTime = 0;
let animationStartTime = 0;
let animationStartDetected = false;
let animationDetected = false;
export let preRenderedFrames = [];
export let animationDuration = 0; // Store detected animation duration
export let preRenderingInProgress = false;
export let isAnimationFinite = false;

// Update references to use internal functions instead of imports
// These variables will be exported and should be used by preview-util.js
export let isPreviewActive = true; // Exported for use in preview-util.js
export let isPreviewAnimationPaused = false; // Exported for use in preview-util.js
export let lastTextureUpdateTime = 0; // Exported for use in preview-util.js and threejs-util.js

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
    preRenderingInProgress = true;
    preRenderedFrames = [];
    
    // Set the start time
    const preRenderStartTime = Date.now();
    
    // Track progress metrics
    let totalFramesEstimate = 120; // Initial estimate
    let lastProgressUpdate = 0;
    let progressUpdateInterval = 100; // Update progress every 100ms
    let maxProgressBeforeFinalAnimation = 92; // Cap progress at this value until final animation
    finalProgressAnimation = false;
    finalProgressStartTime = 0;
    
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
        
        finalProgressAnimation = true;
        finalProgressStartTime = Date.now();
        
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
                        setOriginalAnimationStartTime(Date.now());
                        
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
            preRenderingInProgress = false;
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
            preRenderingInProgress = false;
            isAnimationFinite = true;
            animationDuration = preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp;
            
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
                preRenderingInProgress = false;
                isAnimationFinite = true;
                animationDuration = preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp;
                
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
            preRenderingInProgress = false;
            
            if (loopDetected) {
                isAnimationFinite = true;
                animationDuration = preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp;
                console.log(`Animation loop detected, duration: ${animationDuration}ms, ${preRenderedFrames.length} frames captured`);
                showStatus(`Animation loop detected (${(animationDuration/1000).toFixed(1)}s), ${preRenderedFrames.length} frames captured`, 'success');
            } else if (animationStartDetected && animationEndDetected) {
                isAnimationFinite = true;
                animationDuration = animationEndTime - animationStartTime;
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
            preRenderingInProgress = false;
            
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
 * Start pre-rendering for CSS3D content
 * @param {HTMLIFrameElement} iframe - The iframe containing the content
 * @param {Function} callback - Function to call when pre-rendering is complete
 * @param {HTMLElement} progressBar - Optional progress bar element to update
 * @param {Object} settings - Optional settings object
 * @param {THREE.Mesh} previewPlane - The mesh to apply textures to
 */
export function startCss3dPreRendering(iframe, callback, progressBar = null, settings = null, previewPlane = null) {
    if (!iframe) {
        console.error('No iframe provided for CSS3D pre-rendering');
        if (callback) callback();
        return;
    }
    
    // Reset and initialize state
    preRenderingInProgress = true;
    preRenderedFrames = [];
    
    // Tracking variables
    let domSnapshotFrames = [];
    const preRenderStartTime = Date.now();
    
    // Progress tracking
    let lastProgressUpdate = 0;
    let progressUpdateInterval = 100; // Update progress every 100ms
    let maxProgressBeforeFinalAnimation = 92; // Cap progress at this value until final animation
    finalProgressAnimation = false;
    finalProgressStartTime = 0;
    
    // Analysis metrics tracking
    let loopDetected = false;
    let endDetected = false;
    let analysisMetrics = {};
    let detectedLoopSize = 0;
    
    // Track the last capture time to pace captures similar to image2texture
    let lastCaptureTime = 0;
    let captureInterval = 350; // Start with 350ms between captures
    
    // Track total frames estimate
    let totalFramesEstimate = 120; // Initial estimate
    
    console.log('Starting CSS3D pre-rendering analysis...');
    
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
    const createAndApplyCss3dLongExposure = () => {
        if (domSnapshotFrames.length > 0) {
            // Use playbackSpeed from settings instead of DOM
            const longExposureTexture = createLongExposureTexture(domSnapshotFrames, playbackSpeed);
            
            // Update the iframe with the long exposure texture
            if (previewPlane) {
                updateMeshTexture(longExposureTexture, previewPlane);
            }
            
            // Show a message about the long exposure
            showStatus(`CSS3D Long exposure created from ${domSnapshotFrames.length} frames`, 'success');
            
            // Pause animation since we just want to display the static image
            setIsPreviewAnimationPaused(true);
        }
    };
    
    // Function to start final progress animation
    const startFinalProgressAnimation = () => {
        if (finalProgressAnimation) return; // Already animating
        
        finalProgressAnimation = true;
        finalProgressStartTime = Date.now();
        
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
            logAnimationAnalysisReport('CSS3D', {
                frameCount: domSnapshotFrames.length,
                duration: animationDuration,
                isFinite: isAnimationFinite,
                loopDetected,
                endDetected,
                analysisTime: now - preRenderStartTime,
                metrics: {
                    ...analysisMetrics,
                    loopSize: detectedLoopSize,
                    domSnapshotCount: domSnapshotFrames.length
                }
            });
            
            // Store the DOM snapshot frames in the preRenderedFrames array for compatibility
            preRenderedFrames = domSnapshotFrames;
            
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
                    
                    // IMPORTANT: First execute the callback to initialize the CSS3D preview
                    if (typeof callback === 'function') {
                        console.log('Executing CSS3D pre-rendering callback');
                        callback();
                    }
                    
                    // The info panel is now created in the callback when initializing CSS3D preview
                    
                    // Now we prepare for animation to start
                    const modal = document.getElementById('html-editor-modal');
                    const currentMeshId = parseInt(modal.dataset.meshId);
                    
                    // For long exposure, create the static composite view
                    if (isLongExposureMode && domSnapshotFrames.length > 0) {
                        createAndApplyCss3dLongExposure();
                    } else {
                        // Reset animation start time to now
                        setOriginalAnimationStartTime(Date.now());
                        
                        // Start the animation
                        setIsPreviewAnimationPaused(false);
                        
                        // Show a message that playback is starting
                        showStatus(`CSS3D animation playback starting at ${playbackSpeed}x speed`, 'success');
                    }
                }, 500);
                
                // Don't continue the animation
                return;
            } else {
                // If no loading overlay found, still execute the callback
                if (typeof callback === 'function') {
                    console.log('Executing CSS3D pre-rendering callback (no overlay)');
                    callback();
                }
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
                    progressText.textContent = 'Creating CSS3D long exposure...';
                } else {
                    progressText.textContent = 'Finalizing CSS3D animation...';
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
    
    // Create a DOM snapshot from the iframe
    const createDomSnapshot = (iframe) => {
        try {
            if (!iframe || !iframe.contentDocument || !iframe.contentDocument.documentElement) {
                return null;
            }
            
            // Clone the DOM for snapshot
            const domClone = iframe.contentDocument.documentElement.cloneNode(true);
            
            // Calculate a hash of the DOM to detect changes
            const domHash = calculateDomHash(domClone);
            
            return {
                domSnapshot: domClone,
                hash: domHash
            };
        } catch (error) {
            console.error('Error creating DOM snapshot:', error);
            return null;
        }
    };
    
    // Calculate a hash of the DOM to detect changes
    const calculateDomHash = (domElement) => {
        try {
            // Extract relevant attributes for comparison
            const attributes = [];
            
            // Track animation state separately
            let hasAnimations = false;
            let hasTransitions = false;
            
            // Process element and its children recursively
            const processElement = (element) => {
                // Skip script elements
                if (element.tagName === 'SCRIPT') return;
                
                // Get element attributes
                const tagName = element.tagName || '';
                const className = element.className || '';
                const id = element.id || '';
                const style = element.style ? element.style.cssText : '';
                
                // Check for animations and transitions in style
                if (style.includes('animation') || style.includes('keyframes')) {
                    hasAnimations = true;
                }
                if (style.includes('transition')) {
                    hasTransitions = true;
                }
                
                // Extract more detailed style information
                const transform = style.match(/transform:[^;]+/) || '';
                const opacity = style.match(/opacity:[^;]+/) || '';
                const position = style.match(/((left|top|right|bottom):[^;]+)/) || '';
                const animation = style.match(/animation:[^;]+/) || '';
                const transition = style.match(/transition:[^;]+/) || '';
                const backgroundColor = style.match(/background-color:[^;]+/) || '';
                const color = style.match(/color:[^;]+/) || '';
                
                // Add element info to attributes array with more details
                attributes.push(`${tagName}#${id}.${className}[${transform}][${opacity}][${position}][${animation}][${transition}][${backgroundColor}][${color}]`);
                
                // Process child elements
                if (element.children) {
                    for (let i = 0; i < element.children.length; i++) {
                        processElement(element.children[i]);
                    }
                }
            };
            
            // Start processing from the root element
            processElement(domElement);
            
            // Join all attributes and hash them
            const attributesString = attributes.join('|');
            
            // Add animation state to the hash
            const stateInfo = `animations:${hasAnimations}|transitions:${hasTransitions}`;
            const fullString = attributesString + '|' + stateInfo;
            
            // Create a simple hash
            let hash = 0;
            for (let i = 0; i < fullString.length; i++) {
                const char = fullString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            
            return hash.toString();
        } catch (e) {
            console.error('Error calculating DOM hash:', e);
            return Math.random().toString(); // Fallback to random hash
        }
    };
    
    // Calculate the difference between two DOM hashes
    const calculateDomHashDifference = (hash1, hash2) => {
        if (!hash1 || !hash2) return 1;
        
        try {
            // Convert hashes to numbers
            const num1 = parseInt(hash1);
            const num2 = parseInt(hash2);
            
            // Calculate normalized difference (0-1)
            // Use a more conservative normalization factor
            const diff = Math.abs(num1 - num2) / (Math.pow(2, 30) - 1);
            return Math.min(1, diff);
        } catch (e) {
            console.error('Error calculating hash difference:', e);
            return 1;
        }
    };
    
    // Inject animation detection script into iframe
    const injectAnimationDetectionScript = () => {
        try {
            if (!iframe || !iframe.contentDocument) return;
            
            const script = iframe.contentDocument.createElement('script');
            script.textContent = `
                // Animation detection
                window.__css3dAnimationDetection = {
                    setTimeout: 0,
                    setInterval: 0,
                    rAF: 0,
                    activeTimeouts: 0,
                    activeIntervals: 0,
                    animationFrameIds: new Set(),
                    cssAnimations: new Set(),
                    cssTransitions: new Set(),
                    domChanges: 0,
                    lastDomChange: 0
                };
                
                // Override setTimeout
                const originalSetTimeout = window.setTimeout;
                window.setTimeout = function(callback, delay) {
                    window.__css3dAnimationDetection.setTimeout++;
                    window.__css3dAnimationDetection.activeTimeouts++;
                    const id = originalSetTimeout.call(this, function() {
                        window.__css3dAnimationDetection.activeTimeouts--;
                        if (typeof callback === 'function') callback();
                    }, delay);
                    return id;
                };
                
                // Override setInterval
                const originalSetInterval = window.setInterval;
                window.setInterval = function(callback, delay) {
                    window.__css3dAnimationDetection.setInterval++;
                    window.__css3dAnimationDetection.activeIntervals++;
                    return originalSetInterval.call(this, callback, delay);
                };
                
                // Override requestAnimationFrame
                const originalRAF = window.requestAnimationFrame;
                window.requestAnimationFrame = function(callback) {
                    window.__css3dAnimationDetection.rAF++;
                    const id = originalRAF.call(this, function(timestamp) {
                        window.__css3dAnimationDetection.animationFrameIds.add(id);
                        if (typeof callback === 'function') callback(timestamp);
                    });
                    return id;
                };
                
                // Listen for CSS animation events
                document.addEventListener('animationstart', (event) => {
                    window.__css3dAnimationDetection.cssAnimations.add(event.animationName);
                });
                
                document.addEventListener('animationend', (event) => {
                    window.__css3dAnimationDetection.cssAnimations.delete(event.animationName);
                });
                
                // Listen for CSS transition events
                document.addEventListener('transitionstart', (event) => {
                    window.__css3dAnimationDetection.cssTransitions.add(event.propertyName);
                });
                
                document.addEventListener('transitionend', (event) => {
                    window.__css3dAnimationDetection.cssTransitions.delete(event.propertyName);
                });
                
                // Detect DOM changes that might indicate animation
                try {
                    const observer = new MutationObserver(mutations => {
                        window.__css3dAnimationDetection.domChanges += mutations.length;
                        window.__css3dAnimationDetection.lastDomChange = Date.now();
                        
                        for (const mutation of mutations) {
                            // Check for style or class changes which might indicate animation
                            if (mutation.type === 'attributes' && 
                                (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                                window.__css3dAnimationDetection.styleChanges = true;
                            }
                        }
                    });
                    
                    // Observe the entire document for changes
                    observer.observe(document.documentElement, {
                        attributes: true,
                        childList: true,
                        subtree: true,
                        attributeFilter: ['style', 'class']
                    });
                } catch (e) {
                    // MutationObserver might not be available in all contexts
                    console.debug('MutationObserver not available:', e);
                }
            `;
            
            iframe.contentDocument.head.appendChild(script);
        } catch (e) {
            console.debug('Error injecting CSS3D animation detection script:', e);
        }
    };
    
    // Detect CSS3D animation loops
    const detectCSS3DAnimationLoop = (frames, currentHash) => {
        // Need at least 30 frames to detect a loop (increased from 20)
        if (frames.length < 30) {
            return { loopDetected: false, loopSize: 0 };
        }
        
        // Use a much more conservative threshold for CSS3D
        const minLoopSize = 6;  // Increased minimum loop size (was 4)
        const maxLoopSize = Math.floor(frames.length / 3); // Reduced from frames.length/2
        const loopThreshold = 0.2; // Much more conservative threshold (was 0.1)
        
        // Try different loop sizes
        for (let loopSize = minLoopSize; loopSize <= maxLoopSize; loopSize++) {
            let isLoop = true;
            let matchScore = 0;
            
            // Compare the last loopSize frames with the previous loopSize frames
            for (let i = 0; i < loopSize; i++) {
                const currentIndex = frames.length - 1 - i;
                const previousIndex = currentIndex - loopSize;
                
                if (previousIndex < 0) {
                    isLoop = false;
                    break;
                }
                
                const currentFrameHash = i === 0 ? currentHash : frames[currentIndex].hash;
                const previousFrameHash = frames[previousIndex].hash;
                
                // Calculate difference
                const diff = calculateDomHashDifference(currentFrameHash, previousFrameHash);
                
                // If hashes are different by more than the threshold, it's not a loop
                if (diff > loopThreshold) {
                    isLoop = false;
                    break;
                }
                
                // Track how close the match is
                matchScore += (1 - diff);
            }
            
            // Only consider it a loop if we have a good match score
            const avgMatchScore = matchScore / loopSize;
            if (isLoop && avgMatchScore > 0.7) { // Require at least 70% match confidence
                console.log(`Detected CSS3D animation loop of ${loopSize} frames with match score ${avgMatchScore.toFixed(2)}`);
                return { loopDetected: true, loopSize, matchScore: avgMatchScore };
            }
        }
        
        return { loopDetected: false, loopSize: 0, matchScore: 0 };
    };
    
    // Function to analyze CSS3D animation state
    const analyzeCSS3DAnimation = (iframe, domSnapshotFrames, currentHash) => {
        try {
            if (!iframe || !iframe.contentWindow || !iframe.contentWindow.__css3dAnimationDetection) {
                return {
                    isAnimating: false,
                    metrics: {}
                };
            }
            
            const detection = iframe.contentWindow.__css3dAnimationDetection;
            const now = Date.now();
            
            // Check if there are active animations
            const hasActiveTimeouts = detection.activeTimeouts > 0;
            const hasActiveIntervals = detection.activeIntervals > 0;
            const hasActiveRAF = detection.rAF > 0 && detection.animationFrameIds.size > 0;
            const hasCssAnimations = detection.cssAnimations && detection.cssAnimations.size > 0;
            const hasCssTransitions = detection.cssTransitions && detection.cssTransitions.size > 0;
            
            // Check for recent DOM changes
            const timeSinceLastDomChange = now - (detection.lastDomChange || 0);
            const hasRecentDomChanges = timeSinceLastDomChange < 500; // Consider DOM changes in last 500ms as active
            
            // Determine if animation is active
            const isAnimating = hasActiveTimeouts || hasActiveIntervals || hasActiveRAF || 
                               hasCssAnimations || hasCssTransitions || hasRecentDomChanges;
            
            // Check for loop patterns in DOM snapshots
            let loopDetected = false;
            let loopSize = 0;
            let matchScore = 0;
            
            // Only try to detect loops if we have enough frames and animation seems to be happening
            if (domSnapshotFrames.length >= 30 && (isAnimating || detection.domChanges > 10)) {
                const result = detectCSS3DAnimationLoop(domSnapshotFrames, currentHash);
                loopDetected = result.loopDetected;
                loopSize = result.loopSize;
                matchScore = result.matchScore;
            }
            
            return {
                isAnimating,
                loopDetected,
                loopSize,
                matchScore,
                metrics: {
                    activeTimeouts: detection.activeTimeouts,
                    activeIntervals: detection.activeIntervals,
                    rAF: detection.rAF,
                    cssAnimations: detection.cssAnimations ? detection.cssAnimations.size : 0,
                    cssTransitions: detection.cssTransitions ? detection.cssTransitions.size : 0,
                    domChanges: detection.domChanges,
                    timeSinceLastDomChange,
                    matchScore
                }
            };
        } catch (e) {
            console.error('Error analyzing CSS3D animation:', e);
            return {
                isAnimating: false,
                metrics: {}
            };
        }
    };
    
    // Function to capture DOM snapshots until animation completes or times out
    const captureDomSnapshots = async () => {
        if (!isPreviewActive || !preRenderingInProgress) {
            preRenderingInProgress = false;
            startFinalProgressAnimation();
            return;
        }
        
        const now = Date.now();
        
        // Check if enough time has passed since last capture
        // This ensures we capture at a similar rate to image2texture
        const timeSinceLastCapture = now - lastCaptureTime;
        if (timeSinceLastCapture < captureInterval) {
            // Schedule next check
            requestAnimationFrame(captureDomSnapshots);
            return;
        }
        
        // Update last capture time
        lastCaptureTime = now;
        
        // Update progress based on more accurate metrics
        if (now - lastProgressUpdate > progressUpdateInterval) {
            lastProgressUpdate = now;
            
            // Calculate elapsed time percentage
            const elapsedTime = now - preRenderStartTime;
            const timeProgress = Math.min(90, (elapsedTime / preRenderMaxDuration) * 100);
            
            // Calculate frame-based progress
            let frameProgress = Math.min(90, (domSnapshotFrames.length / totalFramesEstimate) * 100);
            
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
                progressText.textContent = `Analyzing CSS3D animation... ${domSnapshotFrames.length} snapshots captured`;
            }
            
            // Log capture rate for debugging
            console.debug(`CSS3D capture interval: ${captureInterval}ms, frames: ${domSnapshotFrames.length}, elapsed: ${elapsedTime}ms`);
        }
        
        // Inject animation detection script if not already done
        if (domSnapshotFrames.length === 0) {
            injectAnimationDetectionScript();
        }
        
        // Create a DOM snapshot
        const snapshot = createDomSnapshot(iframe);
        
        if (snapshot) {
            // Add snapshot to frames
            domSnapshotFrames.push({
                ...snapshot,
                timestamp: now
            });
            
            // Only start analyzing after we have enough frames
            // Use same threshold as image2texture (20 frames)
            if (domSnapshotFrames.length >= 20) {
                // Analyze the CSS3D animation
                const analysis = analyzeCSS3DAnimation(
                    iframe, 
                    domSnapshotFrames.slice(0, -1), 
                    snapshot.hash
                );
                
                // Store analysis metrics
                analysisMetrics = analysis.metrics;
                
                // Check if we've detected a loop with high confidence
                if (analysis.loopDetected && analysis.matchScore > 0.7) {
                    console.log('CSS3D animation loop detected after ' + domSnapshotFrames.length + ' snapshots with match score ' + analysis.matchScore.toFixed(2));
                    preRenderingInProgress = false;
                    isAnimationFinite = true;
                    animationDuration = domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp;
                    
                    // Update analysis metrics
                    loopDetected = true;
                    detectedLoopSize = analysis.loopSize;
                    
                    // Show success message
                    if (isLongExposureMode) {
                        showStatus(`CSS3D animation loop detected, creating long exposure from ${domSnapshotFrames.length} frames`, 'info');
                    } else {
                        showStatus(`CSS3D animation loop detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                    }
                    
                    // Start final progress animation
                    startFinalProgressAnimation();
                    return;
                }
                
                // Check if animation has ended (no changes for a while)
                if (domSnapshotFrames.length > 20 && !analysis.isAnimating) {
                    // Check if there have been no significant changes in the last few frames
                    let noChanges = true;
                    const recentFrames = domSnapshotFrames.slice(-5);
                    
                    for (let i = 1; i < recentFrames.length; i++) {
                        const diff = calculateDomHashDifference(recentFrames[i].hash, recentFrames[i-1].hash);
                        if (diff > 0.01) { // Small threshold for changes
                            noChanges = false;
                            break;
                        }
                    }
                    
                    if (noChanges) {
                        console.log('CSS3D animation end detected after ' + domSnapshotFrames.length + ' snapshots');
                        preRenderingInProgress = false;
                        isAnimationFinite = true;
                        animationDuration = domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp;
                        
                        // Update analysis metrics
                        endDetected = true;
                        
                        // Show success message
                        showStatus(`CSS3D animation end detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                        
                        // Start final progress animation
                        startFinalProgressAnimation();
                        return;
                    }
                }
            }
        }
        
        // Check if we've exceeded the maximum pre-rendering time
        if (now - preRenderStartTime > preRenderMaxDuration) {
            console.log('CSS3D analysis time limit reached after ' + preRenderMaxDuration + 'ms');
            preRenderingInProgress = false;
            
            const analysis = analyzeCSS3DAnimation(iframe, domSnapshotFrames, null);
            
            // Store final analysis metrics
            analysisMetrics = analysis.metrics;
            
            if (analysis.loopDetected) {
                isAnimationFinite = true;
                animationDuration = domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp;
                console.log(`CSS3D animation loop detected, duration: ${animationDuration}ms, ${domSnapshotFrames.length} snapshots captured`);
                showStatus(`CSS3D animation loop detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                
                // Update analysis metrics
                loopDetected = true;
                detectedLoopSize = analysis.loopSize;
            } else if (!analysis.isAnimating) {
                isAnimationFinite = true;
                animationDuration = domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp;
                console.log(`CSS3D animation appears to have ended, duration: ${animationDuration}ms, ${domSnapshotFrames.length} snapshots captured`);
                showStatus(`CSS3D animation end detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                
                // Update analysis metrics
                endDetected = true;
            } else {
                console.log(`No CSS3D animation end detected, ${domSnapshotFrames.length} snapshots captured`);
                showStatus(`CSS3D animation appears infinite, ${domSnapshotFrames.length} snapshots captured for playback`, 'info');
            }
            
            // Start final progress animation
            startFinalProgressAnimation();
            return;
        }
        
        // Continue capturing snapshots with requestAnimationFrame
        // The timing is controlled by the captureInterval check at the beginning
        requestAnimationFrame(captureDomSnapshots);
    };
    
    // Start capturing DOM snapshots
    captureDomSnapshots();
    
    // Store callback to be called after final animation completes
    window._preRenderCallback = callback;
    
    // Store the DOM snapshot frames in the preRenderedFrames array for compatibility
    preRenderedFrames = domSnapshotFrames;
}

export function resetPreRender() {
            // Reset pre-rendering state
            isPreRenderingComplete = false;
            preRenderedFrames = [];
            isAnimationFinite = false;
            preRenderAttempted = false;
            preRenderingInProgress = false;
            bufferExhausted = false;
            fallbackToRealtime = false;
            bufferExhaustWarningShown = false;
            finalProgressAnimation = false;
            finalProgressStartTime = 0;
}

/**
 * Analyze animation frames to detect the end of an animation
 * @param {Array} frames - Array of captured frames with hash and timestamp
 * @param {string} currentFrameHash - Hash of the current frame
 * @param {number} sensitivity - Detection sensitivity (0.0-1.0, higher = more sensitive)
 * @returns {Object} Detection results including whether end is detected
 */
function analyzeAnimationFrames(frames, currentFrameHash, sensitivity = 0.85) {
    // Normalize sensitivity to ensure it's between 0.0 and 1.0
    sensitivity = Math.max(0.0, Math.min(1.0, sensitivity));
    
    // Calculate adaptive thresholds based on sensitivity
    // Higher sensitivity = lower thresholds = easier to detect changes/end
    const changeThreshold = animationChangeThreshold * (1.0 - sensitivity * 0.7); // More aggressive scaling (was 0.5)
    const idleThreshold = Math.round(animationIdleThreshold * (1.0 - sensitivity * 0.85)); // More aggressive reduction (was 0.7)
    
    // Initialize result object
    const result = {
        endDetected: false,
        loopDetected: false,
        isSignificantChange: false,
        idleCount: 0,
        patternLength: 0,
        metrics: {
            changeThreshold,
            idleThreshold,
            avgChangeRate: 0,
            changeFrequency: 0
        }
    };
    
    // Need at least 2 frames to analyze
    if (frames.length < 2) {
        return result;
    }
    
    // Get the previous frame hash
    const prevHash = frames[frames.length - 1].hash;
    
    // Calculate difference between current and previous frame
    const hashDiff = calculateHashDifference(currentFrameHash, prevHash);
    result.isSignificantChange = hashDiff > changeThreshold;
    
    // Store the change rate
    frameChangeRates.push(hashDiff);
    
    // Keep only the most recent 60 change rates
    if (frameChangeRates.length > 60) {
        frameChangeRates.shift();
    }
    
    // Calculate average change rate and frequency
    result.metrics.avgChangeRate = frameChangeRates.reduce((sum, rate) => sum + rate, 0) / frameChangeRates.length;
    
    // Calculate how many of the recent frames had significant changes
    const recentFrames = Math.min(20, frameChangeRates.length);
    const significantChanges = frameChangeRates.slice(-recentFrames).filter(rate => rate > changeThreshold).length;
    result.metrics.changeFrequency = significantChanges / recentFrames;
    
    // Detect animation end using idle count
    if (result.isSignificantChange) {
        result.idleCount = 0;
    } else {
        // Get current idle count from global variable
        result.idleCount = animationIdleCount + 1;
        
        // Check if we've reached the idle threshold
        if (result.idleCount >= idleThreshold) {
            result.endDetected = true;
        }
    }
    
    // Detect animation end using frequency analysis (more sensitive with higher sensitivity)
    const frequencyThreshold = 0.15 * (1.0 - sensitivity * 0.7); // More aggressive reduction (was 0.5)
    if (previousChangeFrequency > 0.2 && result.metrics.changeFrequency < frequencyThreshold) { // Lower threshold (was 0.3)
        result.endDetected = true;
    }
    
    // Detect animation loops
    if (frames.length >= 20) { // Reduced from 30 to detect loops earlier
        result.loopDetected = detectAnimationLoop(frames, sensitivity);
        if (result.loopDetected) {
            result.endDetected = true;
        }
    }
    
    // Store current change frequency for next comparison
    previousChangeFrequency = result.metrics.changeFrequency;
    
    return result;
}

/**
 * Detect if the animation has completed a loop by comparing frame hashes
 * @param {Array} frames - Array of captured frames with hash and timestamp
 * @param {number} sensitivity - Detection sensitivity (0.0-1.0, higher = more sensitive)
 * @returns {boolean} True if a loop is detected
 */
function detectAnimationLoop(frames, sensitivity = 0.85) {
    // Need at least 20 frames to detect a loop (reduced from 30)
    if (frames.length < 20) return false;
    
    // Adjust threshold based on sensitivity
    const loopThreshold = 0.05 * (1.0 - sensitivity * 0.8); // More aggressive reduction (was 0.6)
    
    const minLoopSize = 4;  // Minimum number of frames that could constitute a loop (reduced from 5)
    const maxLoopSize = Math.floor(frames.length / 2); // Max half the total frames
    
    // Try different loop sizes
    for (let loopSize = minLoopSize; loopSize <= maxLoopSize; loopSize++) {
        let isLoop = true;
        
        // Compare the last loopSize frames with the previous loopSize frames
        for (let i = 0; i < loopSize; i++) {
            const currentIndex = frames.length - 1 - i;
            const previousIndex = currentIndex - loopSize;
            
            if (previousIndex < 0) {
                isLoop = false;
                break;
            }
            
            const currentHash = frames[currentIndex].hash;
            const previousHash = frames[previousIndex].hash;
            
            // If hashes are different by more than the threshold, it's not a loop
            if (calculateHashDifference(currentHash, previousHash) > loopThreshold) {
                isLoop = false;
                break;
            }
        }
        
        if (isLoop) {
            console.log(`Detected animation loop of ${loopSize} frames (sensitivity: ${sensitivity.toFixed(2)})`);
            return true;
        }
    }
    
    return false;
}

/**
 * Calculate the difference between two texture hashes
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @returns {number} Difference value between 0 and 1
 */
function calculateHashDifference(hash1, hash2) {
    if (!hash1 || !hash2) return 1;
    
    try {
        const arr1 = hash1.split(',').map(Number);
        const arr2 = hash2.split(',').map(Number);
        
        // If arrays are different lengths, return max difference
        if (arr1.length !== arr2.length) return 1;
        
        // Calculate mean absolute difference
        let totalDiff = 0;
        for (let i = 0; i < arr1.length; i++) {
            totalDiff += Math.abs(arr1[i] - arr2[i]);
        }
        
        // Normalize by max possible difference (255 per channel)
        return totalDiff / (arr1.length * 255);
    } catch (e) {
        console.error('Error calculating hash difference:', e);
        return 1;
    }
}

/**
 * Set is preRenderingInProgress
 * @param {boolean} incomingValue - The new value to set
 */
export function setPreRenderingInProgress(incomingValue) {
    preRenderingInProgress = incomingValue;
}

/**
 * Update the mesh texture with the given texture
 * @param {THREE.Texture} texture - The texture to apply to the mesh
 * @param {THREE.Mesh} previewPlane - The mesh to update with the texture
 */
export function updateMeshTexture(texture, previewPlane) {
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

/**
 * Set the isPreviewAnimationPaused flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsPreviewAnimationPaused(incomingValue) {
    isPreviewAnimationPaused = incomingValue;
}

/**
 * Set the isPreviewActive flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsPreviewActive(incomingValue) {
    isPreviewActive = incomingValue;
}

/**
 * Set the lastTextureUpdateTime
 * @param {number} incomingValue - The new value to set
 */
export function setLastTextureUpdateTime(incomingValue) {
    lastTextureUpdateTime = incomingValue;
}

/**
 * Get isPreviewActive state
 * @returns {boolean} Current isPreviewActive value
 */
export function getIsPreviewActive() {
    return isPreviewActive;
}

/**
 * Get isPreviewAnimationPaused state
 * @returns {boolean} Current isPreviewAnimationPaused value
 */
export function getIsPreviewAnimationPaused() {
    return isPreviewAnimationPaused;
}

/**
 * Get lastTextureUpdateTime value
 * @returns {number} Current lastTextureUpdateTime value
 */
export function getLastTextureUpdateTime() {
    return lastTextureUpdateTime;
}

/**
 * Get preRenderedFrames array
 * @returns {Array} Current preRenderedFrames array
 */
export function getPreRenderedFrames() {
    return preRenderedFrames;
}

/**
 * Set preRenderedFrames array
 * @param {Array} incomingValue - The new value to set
 */
export function setPreRenderedFrames(incomingValue) {
    preRenderedFrames = incomingValue;
}

/**
 * Get preRenderingInProgress state
 * @returns {boolean} Current preRenderingInProgress value
 */
export function getPreRenderingInProgress() {
    return preRenderingInProgress;
}

/**
 * Get animationDuration value
 * @returns {number} Current animationDuration value
 */
export function getAnimationDuration() {
    return animationDuration;
}

/**
 * Set animationDuration value
 * @param {number} incomingValue - The new value to set
 */
export function setAnimationDuration(incomingValue) {
    animationDuration = incomingValue;
}

/**
 * Get isAnimationFinite state
 * @returns {boolean} Current isAnimationFinite value
 */
export function getIsAnimationFinite() {
    return isAnimationFinite;
}

/**
 * Set isAnimationFinite state
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsAnimationFinite(incomingValue) {
    isAnimationFinite = incomingValue;
}