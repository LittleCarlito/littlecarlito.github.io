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
export let animationPlaybackStartTime = 0; // When playback actually started
export let animationCaptureStartTime = 0;  // When capture started (for offset calculations)
// Active playback values
let playbackStartTime = 0;
let isPlaybackActive = false;

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



export function resetPreRender() {
            preRenderedFrames = [];
            isAnimationFinite = false;
            preRenderingInProgress = false;
            finalProgressAnimation = false;
            finalProgressStartTime = 0;
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

export function setAnimationPlaybackStartTime(incomingValue) {
    setAnimationPlaybackStartTime = incomingValue;
}

export function setAnimationCaptureStartTime(incomingValue) {
    animationCaptureStartTime = incomingValue;
}