/**
 * Header Component Loader
 * Loads the common header component into the specified container element
 */

// Import settings utilities for pin button functionality
// Using relative path with "../" to navigate up from components directory
import { loadSettings, saveSettings } from '../util/data/localstorage-manager.js';

// Mac dock behavior settings
const HEADER_SHOW_DISTANCE = 20; // px from top to show header
const HEADER_HIDE_DISTANCE = 60; // px from top to hide header
const HEADER_HIDE_DELAY = 1000; // ms to wait before hiding header
let headerHideTimer = null;

/**
 * Loads the header component into the specified container
 * @param {string} containerId - The ID of the container element
 * @returns {Promise} - A promise that resolves when the header is loaded
 */
export function loadHeader(containerId = 'header-container') {
    return new Promise((resolve, reject) => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Header container with ID '${containerId}' not found`);
            reject(new Error(`Header container with ID '${containerId}' not found`));
            return;
        }

        // Fetch the header HTML
        fetch('./header/header.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load header: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                // Insert the header HTML into the container
                container.innerHTML = html;
                
                // Wait for the DOM to be updated before setting up components
                return new Promise(resolve => {
                    // Use requestAnimationFrame to ensure DOM is painted
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            })
            .then(() => {
                // Add the pin button with the correct state
                setupPinButton();
                
                // Set up all header button event listeners
                setupHeaderButtons();
                
                // Set up Mac-like dock behavior for header
                setupHeaderDockBehavior(true);
                
                resolve();
            })
            .catch(error => {
                console.error('Error loading header:', error);
                reject(error);
            });
    });
}

/**
 * Sets up all header button event listeners
 */
function setupHeaderButtons() {
    // System status button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = 'System Status';
        
        themeToggle.addEventListener('click', function() {
            alert('System Status: Online\nAsset Debugger: Ready\nRig Visualizer: Ready');
        });
    }
    
    // Return to Toolbox functionality
    const returnToToolboxBtn = document.getElementById('return-to-toolbox');
    if (returnToToolboxBtn) {
        returnToToolboxBtn.addEventListener('click', function() {
            window.location.href = '../../../';
        });
    }
    
    // Pin button functionality with localStorage persistence
    const pinButton = document.getElementById('pin-button');
    if (pinButton) {
        pinButton.addEventListener('click', function() {
            this.classList.toggle('pinned');
            
            // Save the new state to settings
            const isPinned = this.classList.contains('pinned');
            const currentSettings = loadSettings() || {};
            currentSettings.pinned = isPinned;
            saveSettings(currentSettings);
            
            // If pinned, ensure header is visible
            const header = document.querySelector('#header-container > header');
            if (isPinned) {
                header.style.transform = 'translateY(0)';
                header.style.opacity = '1';
            } else {
                // If not pinned, just register the dock behavior
                // but don't hide the header immediately - keep it visible
                // and let the mouse movement behavior handle when to hide it
                setupHeaderDockBehavior(false);
            }
        });
    }
}

/**
 * Sets up the pin button with the correct state
 */
function setupPinButton() {
    const pinButtonContainer = document.getElementById('pin-button-container');
    if (!pinButtonContainer) return;
    
    // Get pinned state from localStorage
    let isPinned = true; // Default to pinned
    try {
        const savedSettings = localStorage.getItem('assetDebuggerSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings && settings.hasOwnProperty('pinned')) {
                isPinned = settings.pinned;
            }
        }
    } catch (e) {
        console.error('Error checking pin state:', e);
    }
    
    // Generate the pin button HTML with the correct state
    const pinnedClass = isPinned ? "pinned" : "";
    
    // Create the pin button HTML
    pinButtonContainer.innerHTML = `
        <button id="pin-button" class="theme-toggle pin-button ${pinnedClass}" aria-label="Pin">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 9V4H17C17.55 4 18 3.55 18 3C18 2.45 17.55 2 17 2H7C6.45 2 6 2.45 6 3C6 3.55 6.45 4 7 4H8V9C8 10.66 6.66 12 5 12V14H10.97V21L11.97 22L12.97 21V14H19V12C17.34 12 16 10.66 16 9Z" fill="currentColor"/>
            </svg>
        </button>
    `;
    
    // Store for later use in JS
    window.initialPinState = isPinned;
}

/**
 * Sets up the Mac-like dock behavior for the header
 * @param {boolean} hideInitially - Whether to hide the header initially if unpinned
 */
function setupHeaderDockBehavior(hideInitially = true) {
    // Wait for the header to be loaded
    setTimeout(() => {
        const header = document.querySelector('#header-container > header');
        const pinButton = document.getElementById('pin-button');
        
        if (!header || !pinButton) {
            console.warn('Header or pin button not found for dock behavior setup, retrying...');
            // Retry after a short delay
            setTimeout(() => setupHeaderDockBehavior(hideInitially), 100);
            return;
        }
        
        // Add CSS transitions for smooth show/hide
        header.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        
        // Initial state
        const isPinned = pinButton.classList.contains('pinned');
        if (!isPinned && hideInitially) {
            // Start with header hidden if not pinned and hideInitially is true
            header.style.transform = 'translateY(-100%)';
            header.style.opacity = '0';
        }
        
        // Add mouse movement listener to show/hide header
        document.addEventListener('mousemove', (e) => {
            // Get latest pin state
            const isPinned = pinButton.classList.contains('pinned');
            
            // If pinned, keep header visible at all times
            if (isPinned) {
                header.style.transform = 'translateY(0)';
                header.style.opacity = '1';
                
                // Clear any pending hide timer
                if (headerHideTimer) {
                    clearTimeout(headerHideTimer);
                    headerHideTimer = null;
                }
                return;
            }
            
            // When mouse is near the top, show the header
            if (e.clientY <= HEADER_SHOW_DISTANCE) {
                header.style.transform = 'translateY(0)';
                header.style.opacity = '1';
                
                // Clear any pending hide timer
                if (headerHideTimer) {
                    clearTimeout(headerHideTimer);
                    headerHideTimer = null;
                }
            } 
            // When mouse moves away, start timer to hide header
            else if (e.clientY > HEADER_HIDE_DISTANCE && !headerHideTimer) {
                headerHideTimer = setTimeout(() => {
                    header.style.transform = 'translateY(-100%)';
                    header.style.opacity = '0';
                    headerHideTimer = null;
                }, HEADER_HIDE_DELAY);
            }
        });
    }, 100); // Wait for header to load
}

export default { loadHeader }; 