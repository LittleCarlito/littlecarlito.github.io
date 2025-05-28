/**
 * Utilities for working with localStorage in the Asset Debugger
 */

// Storage keys
const SETTINGS_KEY = 'assetDebuggerSettings';
const CURRENT_SESSION_KEY = 'assetDebuggerCurrentState';
const SESSION_HISTORY_KEY = 'assetDebuggerSessionHistory';
const MAX_HISTORY_SESSIONS = 10;

/**
 * Save asset debugger settings to localStorage
 * @param {Object} settings - The settings object to save
 */
export function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Load asset debugger settings from localStorage
 * @returns {Object|null} The parsed settings object or null if no settings found
 */
export function loadSettings() {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    
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

/**
 * Serialize a state object for storage
 * @param {Object} state - The state object to serialize
 * @returns {Object} Serialized state
 */
function serializeState(state) {
    const serialized = { ...state };
    
    // Handle File objects in textureFiles
    if (serialized.textureFiles) {
        Object.keys(serialized.textureFiles).forEach(key => {
            const file = serialized.textureFiles[key];
            if (file instanceof File) {
                serialized.textureFiles[key] = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified
                };
            }
        });
    }
    
    // Handle model file
    if (serialized.modelFile instanceof File) {
        serialized.modelFile = {
            name: serialized.modelFile.name,
            type: serialized.modelFile.type,
            size: serialized.modelFile.size,
            lastModified: serialized.modelFile.lastModified
        };
    }
    
    // Handle lighting file
    if (serialized.lightingFile instanceof File) {
        serialized.lightingFile = {
            name: serialized.lightingFile.name,
            type: serialized.lightingFile.type,
            size: serialized.lightingFile.size,
            lastModified: serialized.lightingFile.lastModified
        };
    }
    
    // Handle background file
    if (serialized.backgroundFile instanceof File) {
        serialized.backgroundFile = {
            name: serialized.backgroundFile.name,
            type: serialized.backgroundFile.type,
            size: serialized.backgroundFile.size,
            lastModified: serialized.backgroundFile.lastModified
        };
    }
    
    return serialized;
}

/**
 * Save current session state
 * @param {Object} state - The current session state
 */
export function saveCurrentSession(state) {
    const serialized = serializeState(state);
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(serialized));
    addToHistory(serialized);
}

/**
 * Load current session state
 * @returns {Object|null} The current session state or null if none exists
 */
export function loadCurrentSession() {
    const savedState = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!savedState) return null;
    
    try {
        const state = JSON.parse(savedState);
        console.debug('Loaded state from localStorage:', state);
        return state;
    } catch (e) {
        console.error('Error parsing saved state:', e);
        return null;
    }
}

/**
 * Add a session to the history
 * @param {Object} sessionState - The session state to add
 */
function addToHistory(sessionState) {
    const history = getSessionHistory();
    
    // Add new session to the beginning of the array
    history.unshift({
        sessionId: sessionState.sessionId,
        timestamp: sessionState.timestamp,
        state: sessionState
    });
    
    // Keep only the most recent MAX_HISTORY_SESSIONS
    if (history.length > MAX_HISTORY_SESSIONS) {
        history.pop();
    }
    
    // Save updated history
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
}

/**
 * Get the session history
 * @returns {Array} Array of session objects
 */
export function getSessionHistory() {
    const history = localStorage.getItem(SESSION_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

/**
 * Clear all session data from localStorage
 */
export function clearSessionData() {
    localStorage.removeItem(CURRENT_SESSION_KEY);
    localStorage.removeItem(SESSION_HISTORY_KEY);
    console.debug('Cleared all session data from localStorage');
} 