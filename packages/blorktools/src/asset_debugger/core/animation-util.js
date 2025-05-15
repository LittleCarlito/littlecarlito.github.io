import * as THREE from 'three';
import { setOriginalAnimationStartTime, showStatus } from "../ui/scripts/html-editor-modal";
import { calculateTextureHash, createLongExposureTexture, createTextureFromIframe, setCapturingForLongExposure } from "./texture-util";
import { setIsPreviewAnimationPaused, isPreviewActive, updateMeshTexture } from './preview-util';
import { createMeshInfoPanel } from './mesh-info-util';

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

/**
 * Start pre-rendering animation frames
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {Function} callback - Function to call when pre-rendering is complete
 * @param {HTMLElement} progressBar - Optional progress bar element to update
 */
export function startPreRendering(iframe, callback, progressBar = null) {
    // Always pre-render for all speeds
    // Start pre-rendering immediately
    preRenderAttempted = true;
    preRenderingInProgress = true;
    preRenderStartTime = Date.now();


    console.log('Starting pre-rendering of animation frames...');
    
    // Reset pre-rendered frames
    preRenderedFrames = [];
    
    // Track progress metrics
    let totalFramesEstimate = 120; // Initial estimate
    let lastProgressUpdate = 0;
    let progressUpdateInterval = 100; // Update progress every 100ms
    let maxProgressBeforeFinalAnimation = 92; // Cap progress at this value until final animation
    finalProgressAnimation = false;
    finalProgressStartTime = 0;
    
    // Check if we're in long exposure mode
    const modal = document.getElementById('html-editor-modal');
    const animationTypeSelect = document.getElementById('html-animation-type');
    const isLongExposureMode = animationTypeSelect && animationTypeSelect.value === 'longExposure';
    
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
            const playbackSpeedSelect = document.getElementById('html-playback-speed');
            const playbackSpeed = playbackSpeedSelect ? parseFloat(playbackSpeedSelect.value) : 1.0;
            
            // Create the long exposure texture
            const longExposureTexture = createLongExposureTexture(preRenderedFrames, playbackSpeed);
            
            // Update the mesh with the long exposure texture
            updateMeshTexture(longExposureTexture);
            
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
                        const playbackSpeedSelect = document.getElementById('html-playback-speed');
                        const playbackSpeed = playbackSpeedSelect ? parseFloat(playbackSpeedSelect.value) : 1.0;
                        
                        // Create the long exposure texture
                        const longExposureTexture = createLongExposureTexture(preRenderedFrames, playbackSpeed);
                        
                        // Update the mesh with the long exposure texture
                        updateMeshTexture(longExposureTexture);
                        
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
                        const playbackSpeedSelect = document.getElementById('html-playback-speed');
                        const playbackSpeed = playbackSpeedSelect ? parseFloat(playbackSpeedSelect.value) : 1.0;
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
        const loopDetected = preRenderedFrames.length > 20 && 
                             detectAnimationLoop(preRenderedFrames, sensitivity);
                             
        if (loopDetected && preRenderedFrames.length > 20) {
            console.log('Animation loop detected after ' + preRenderedFrames.length + ' frames');
            preRenderingInProgress = false;
            isAnimationFinite = true;
            animationDuration = preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp;
            
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
            
            // If end detected and we have enough frames, stop pre-rendering
            if (analysisResult.endDetected && preRenderedFrames.length > 20) {
                console.log('Animation end detected during pre-rendering after ' + preRenderedFrames.length + ' frames');
                console.log('Detection metrics:', analysisResult.metrics);
                preRenderingInProgress = false;
                isAnimationFinite = true;
                animationDuration = preRenderedFrames[preRenderedFrames.length - 1].timestamp - preRenderedFrames[0].timestamp;
                
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
            if (isLongExposureMode && window.createLongExposureImmediately && preRenderedFrames.length >= 15) {
                window.createLongExposureImmediately = false; // Only do this once
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
