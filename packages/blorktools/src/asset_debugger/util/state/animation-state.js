export const ANALYSIS_DURATION_MS = 30000; // 30 seconds - matches preRenderMaxDuration

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
export let playbackStartTime = 0;
export let isPlaybackActive = false;

/**
 * Reset all timing
 */
export function resetPlaybackTimingState() {
    playbackStartTime = 0;
    isPlaybackActive = false;
}

export function resetPreRenderState() {
            preRenderedFrames = [];
            isAnimationFinite = false;
            preRenderingInProgress = false;
            finalProgressAnimation = false;
            finalProgressStartTime = 0;
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
    animationPlaybackStartTime = incomingValue;
}

export function setAnimationCaptureStartTime(incomingValue) {
    animationCaptureStartTime = incomingValue;
}

export function setPlaybackStartTime(incomingValue) {
    playbackStartTime = incomingValue;
}

export function setIsPlaybackActive(incomingValue) {
    isPlaybackActive = incomingValue;
}