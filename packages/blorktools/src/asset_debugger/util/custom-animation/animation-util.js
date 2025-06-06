import * as THREE from 'three';
import { showStatus } from "../../modals/html-editor-modal/html-editor-modal";
import { createMeshInfoPanel } from '../../modals/html-editor-modal/mesh-info-panel-util';
import { createTextureFromIframe, injectUnifiedAnimationDetectionScript } from './html2canvas-util';

const ANALYSIS_DURATION_MS = 30000; // 30 seconds - matches preRenderMaxDuration

export let finalProgressAnimation = false;
export let finalProgressStartTime = 0;
export let finalProgressDuration = 800; // Duration of final progress animation in ms

let animationChangeThreshold = 0.008; // Lower threshold for detecting change (was 0.01)
let animationIdleThreshold = 30; // Number of similar frames before considering animation ended
let frameChangeRates = []; // Store recent frame change rates
let animationIdleCount = 0;
let previousChangeFrequency = 0; // Track previous change frequency
let preRenderStartTime = 0;
export let preRenderMaxDuration = 30000; // Increased to 30 seconds for longer animations
// Image2texture variables
export let animationDetectionSensitivity = 0.85; // Increased from 0.5 to 0.85 for much stricter detection by default
let animationEndTime = 0;
let animationStartTime = 0;
export let animationStartDetected = false;
export let animationDetected = false;
export let preRenderedFrames = [];
export let animationDuration = 0; // Store detected animation duration
export let preRenderingInProgress = false;
export let isAnimationFinite = false;

// Update references to use internal functions instead of imports
// These variables will be exported and should be used by preview-util.js
export let isPreviewActive = true; // Exported for use in preview-util.js
export let isPreviewAnimationPaused = false; // Exported for use in preview-util.js
export let lastTextureUpdateTime = 0; // Exported for use in preview-util.js and threejs-util.js

// TIMING STATE - This module owns all animation timing
let animationPlaybackStartTime = 0; // When playback actually started
let animationCaptureStartTime = 0;  // When capture started (for offset calculations)
// Active playback values
let playbackStartTime = 0;
let isPlaybackActive = false;

// Debug reporting function for animation analysis
export function logAnimationAnalysisReport(renderType, data) {
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

/**
 * Initialize playback timing - called when preview starts playing
 * This should be called regardless of animation type (finite/infinite)
 */
export function initializePlaybackTiming() {
    const now = Date.now();
    animationPlaybackStartTime = now;
    
    // Calculate the capture start time from the first frame if available
    if (preRenderedFrames.length > 0) {
        animationCaptureStartTime = preRenderedFrames[0].timestamp;
    } else {
        animationCaptureStartTime = now;
    }
    
    console.log('Playback timing initialized:', {
        playbackStart: animationPlaybackStartTime,
        captureStart: animationCaptureStartTime,
        framesAvailable: preRenderedFrames.length
    });
}

/**
 * Get current frame based on elapsed playback time
 */
export function getCurrentFrameForPlayback(playbackSpeed = 1.0, animationType = 'play') {
    if (!isPlaybackActive || preRenderedFrames.length === 0) {
        return preRenderedFrames.length > 0 ? preRenderedFrames[preRenderedFrames.length - 1] : null;
    }
    
    const now = Date.now();
    const playbackElapsed = now - playbackStartTime;
    const adjustedElapsed = playbackElapsed * playbackSpeed;
    
    // Use the analysis duration as our animation duration
    // This represents the full time period we analyzed for animation
    const naturalDuration = isAnimationFinite && animationDuration > 0 ? 
        animationDuration : ANALYSIS_DURATION_MS;
    
    let normalizedTime;
    
    switch (animationType) {
        case 'play':
            if (adjustedElapsed >= naturalDuration) {
                setIsPreviewAnimationPaused(true);
                return preRenderedFrames[preRenderedFrames.length - 1];
            }
            normalizedTime = adjustedElapsed / naturalDuration;
            break;
            
        case 'loop':
            normalizedTime = (adjustedElapsed % naturalDuration) / naturalDuration;
            break;
            
        case 'bounce':
            const cycle = Math.floor(adjustedElapsed / naturalDuration);
            const position = (adjustedElapsed % naturalDuration) / naturalDuration;
            normalizedTime = (cycle % 2 === 0) ? position : (1 - position);
            break;
            
        default:
            normalizedTime = (adjustedElapsed % naturalDuration) / naturalDuration;
            break;
    }
    
    const frameIndex = Math.min(
        Math.floor(normalizedTime * preRenderedFrames.length),
        preRenderedFrames.length - 1
    );
    
    return preRenderedFrames[frameIndex];
}

/**
 * Reset all timing
 */
export function resetPlaybackTiming() {
    playbackStartTime = 0;
    isPlaybackActive = false;
}

/**
 * Start playback timing - called when preview should begin playing
 */
export function startPlayback() {
    playbackStartTime = Date.now();
    isPlaybackActive = true;
    console.log('Playback started at:', playbackStartTime);
}

/**
 * Stop playback timing
 */
export function stopPlayback() {
    isPlaybackActive = false;
    console.log('Playback stopped');
}

export function resetPreRender() {
            preRenderedFrames = [];
            isAnimationFinite = false;
            preRenderingInProgress = false;
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
 * Set preRenderedFrames array
 * @param {Array} incomingValue - The new value to set
 */
export function setPreRenderedFrames(incomingValue) {
    preRenderedFrames = incomingValue;
}

/**
 * Set animationDuration value
 * @param {number} incomingValue - The new value to set
 */
export function setAnimationDuration(incomingValue) {
    animationDuration = incomingValue;
}

/**
 * Set isAnimationFinite state
 * @param {boolean} incomingValue - The new value to set
 */
export function setIsAnimationFinite(incomingValue) {
    isAnimationFinite = incomingValue;
}

export function setPreRenderingInProgress(incomingValue) {
    preRenderingInProgress = incomingValue;
}

export function setFinalProgressAnimation(incomingValue) {
    finalProgressAnimation = incomingValue;
}

export function setFinalProgressStartTime(incomingValue) {
    finalProgressStartTime = incomingValue;
}