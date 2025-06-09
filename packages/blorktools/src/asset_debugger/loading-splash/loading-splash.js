// loading-splash.js - Updated for overlay integration

import { getCaller } from "../util/state/log-util";

/**
 * Shows the loading splash screen overlay
 */
export function showLoadingSplash(text = "") {

    const loadingSplash = document.getElementById('loading-splash');
    if (loadingSplash) {
        loadingSplash.style.display = 'flex';
        loadingSplash.classList.remove('fade-out');
        const functionCaller = getCaller(1);
        let logString = functionCaller + " requested to show load splash screen";
        if(text) {
            updateLoadingProgress(text);
            logString += " with text \"" + text + "\"";
        }
        console.debug(logString);
    } else {
        console.error('Loading splash element not found in DOM');
    }
}

/**
 * Updates the loading progress text on the splash screen
 * @param {string} text - The progress message to display
 */
export function updateLoadingProgress(text) {
    const progressText = document.getElementById('loading-progress-text');
    if (progressText) {
        progressText.textContent = text;
    } else {
        console.error('Loading progress text element not found');
    }
}

/**
 * Hides the loading splash screen with a fade-out animation
 */
export function hideLoadingSplash() {
    const loadingSplash = document.getElementById('loading-splash');
    if (loadingSplash) {
        loadingSplash.classList.add('fade-out');
        
        setTimeout(() => {
            loadingSplash.style.display = 'none';
            loadingSplash.classList.remove('fade-out');
        }, 500); // Match your CSS transition duration
    } else {
        console.warning('Loading splash element not found');
    }
}

// Make functions globally available
window.showLoadingSplash = showLoadingSplash;
window.updateLoadingProgress = updateLoadingProgress;
window.hideLoadingSplash = hideLoadingSplash;