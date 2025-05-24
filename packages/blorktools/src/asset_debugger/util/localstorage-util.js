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
            const settings = JSON.parse(savedSettings);
            console.log('Loaded settings:', settings);
            return settings;
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
        pinned: true, // Default pin state is enabled/pinned
        tabPanelHidden: false, // Default tab panel state is visible
        axisIndicator: {
            type: 'embedded',
            intensity: 0.7
        },
        rigOptions: {
            displayRig: true,
            forceZ: true,
            wireframe: false,
            primaryColor: 0x4CAF50,
            secondaryColor: 0xFFFF00,
            jointColor: 0x00FFFF,
            showJointLabels: false,
            normalColor: 0xFF0000,
            hoverColor: 0x00FF00,
            activeColor: 0x0000FF
        }
    };
} 