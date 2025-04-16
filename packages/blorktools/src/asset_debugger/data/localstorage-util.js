/**
 * Utilities for working with localStorage in the Asset Debugger
 */

/**
 * Save asset debugger settings to localStorage
 * @param {Object} settings - The settings object to save
 */
export function saveSettings(settings) {
    localStorage.setItem('assetDebuggerSettings', JSON.stringify(settings));
}

/**
 * Load asset debugger settings from localStorage
 * @returns {Object|null} The parsed settings object or null if no settings found
 */
export function loadSettings() {
    const savedSettings = localStorage.getItem('assetDebuggerSettings');
    
    if (savedSettings) {
        try {
            return JSON.parse(savedSettings);
        } catch (e) {
            console.error('Error loading saved settings:', e);
            return null;
        }
    }
    
    return null;
}

/**
 * Get default asset debugger settings
 * @returns {Object} The default settings object
 */
export function getDefaultSettings() {
    return {
        axisIndicator: {
            type: 'disabled',
            intensity: 0.7
        },
        rigOptions: {
            displayRig: false,
            forceZ: false,
            wireframe: true, // Opposite of fillWireframe
            primaryColor: parseInt('FF00FF', 16), // Magenta
            secondaryColor: parseInt('FFFF00', 16), // Yellow
            jointColor: parseInt('00FFFF', 16), // Cyan
            showJointLabels: false,
            normalColor: parseInt('FF0000', 16), // Red
            hoverColor: parseInt('00FF00', 16), // Green
            activeColor: parseInt('0000FF', 16) // Blue
        }
    };
} 