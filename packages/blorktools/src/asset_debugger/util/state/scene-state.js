/**
 * Texture Debugger - State Management Module
 * 
 * This module manages the global state for the texture debugger tool.
 * It provides methods to initialize, access, and update the application state.
 */

import { saveCurrentSession, loadCurrentSession, clearSessionData } from '../data/localstorage-manager.js';
import { getCaller } from './log-util.js';

// Define the initial state
const initialState = {
    sessionId: null,
    timestamp: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    
    textureFiles: {
        baseColor: null, // File object
        orm: null, // File object
        normal: null // File object
    },
    // Texture objects (THREE.Texture objects)
    textureObjects: {
        baseColor: null,
        orm: null,
        normal: null
    },
    modelFile: null, // File object
    model: null,
    cube: null,
    lightingFile: null, // File object
    backgroundFile: null, // File object
    backgroundTexture: null,

    // Animation ID for cancelAnimationFrame
    animationId: null,
    
    // Mesh management
    meshes: [],
    meshGroups: {},
    
    // Atlas visualization
    currentTextureType: 'baseColor',
    currentUvRegion: { min: [0, 0], max: [1, 1] },
    
    // UV data
    availableUvSets: [],
    uvSetNames: [],
    currentUvSet: 0,
    screenMeshes: [], // New: display/screen meshes
    uvMappingInfo: {}, // New: detailed mapping info for UV channels
    
    // Status flags
    isDebugStarted: false,
    useCustomModel: false,
    useLightingTestCube: false, // Flag to indicate we should use the special lighting test cube
    
    // Helper functions
    cycleAtlasSegments: null, // New: function to cycle atlas segments
    setCurrentUvRegion: null, // New: function to set current UV region
    switchUvChannel: null, // New: function to switch UV channel
    
    // Environment lighting
    environmentLightingEnabled: false,
    ambientLight: null,
    directionalLight: null,
    
    // Material properties
    materialProperties: {
        metalness: 0.5,
        roughness: 0.5,
        normalScale: 1.0
    },
    
    // UV unwrapping options
    unwrapOptions: {
        wireframe: true,
        displayUVs: true,
        textureDisplay: 'baseColor'
    },
    
    // Rig related properties
    rigOptions: {
        autoRotate: false,
        showSkeleton: true,
        enableIK: true,
        currentAnimation: null,
        playAnimation: false,
        animationSpeed: 1.0
    }
};

// The actual state object - singleton
let state = null;

/**
 * Initialize a new draft state for the landing page
 * This state won't be saved as current until startDebugging is called
 * @returns {Object} The initialized state object
 */
export function initDraftState() {
    // Generate a new session ID and timestamp
    const sessionId = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // Create a new state object with session ID and timestamp
    state = { ...initialState, sessionId, timestamp };
    
    return state;
}

/**
 * Start a new debugging session with the current draft state
 * This makes the current draft state the "current" session
 * @returns {Object} The current state object
 */
export function startDebugging() {
    if (!state) {
        state = initDraftState();
    }
    
    // Save to localStorage as current session
    saveCurrentSession(state);
    
    return state;
}

/**
 * Update a specific part of the state
 * @param {string} key - The key to update
 * @param {any} value - The new value
 * @returns {Object} The updated state
 */
export function updateState(key, value) {
    if (!state) {
        initDraftState();
    }
    
    // Helper function to get file name or null
    const getFileName = (file) => file ? file.name : null;
    
    // Log the state update with caller information (throttled to avoid spam)
    const now = Date.now();
    if (!updateState._lastLog || now - updateState._lastLog > 100) { // Only log every 100ms
        updateState._lastLog = now;
        console.debug('State update:', {
            caller: getCaller(1), // Skip 1 level (the updateState function itself)
            key: typeof key === 'object' ? Object.keys(key) : key,
            model: getFileName(state.modelFile),
            lighting: getFileName(state.lightingFile),
            background: getFileName(state.backgroundFile),
            textures: {
                baseColor: getFileName(state.textureFiles?.baseColor),
                orm: getFileName(state.textureFiles?.orm),
                normal: getFileName(state.textureFiles?.normal)
            }
        });
    }
    
    if (typeof key === 'object') {
        Object.assign(state, key);
    } else {
        state[key] = value;
    }
    
    return state;
}

/**
 * Get the current application state
 * @returns {Object} The current state object
 */
export function getState() {
    if (!state) {
        // Try to load from localStorage
        const savedState = loadCurrentSession();
        if (savedState) {
            console.debug('Loading state from localStorage:', {
                hasModelFile: !!savedState.modelFile,
                hasLightingFile: !!savedState.lightingFile,
                hasBackgroundFile: !!savedState.backgroundFile,
                hasTextureFiles: savedState.textureFiles ? Object.values(savedState.textureFiles).some(f => f !== null) : false,
                sessionId: savedState.sessionId,
                timestamp: savedState.timestamp
            });
            state = savedState;
        } else {
            console.debug('No saved state found in localStorage, initializing new state');
            state = initDraftState();
        }
    }
    return state;
}

/**
 * Reset the state to initial values
 * @returns {Object} The reset state
 */
export function resetState() {
    state = initDraftState();
    return state;
}

/**
 * Clear all session data
 */
export function clearState() {
    clearSessionData();
    state = null;
}

export function hasFiles() {
    return hasModelFile() || hasLightingFile() || hasBackgroundFile() 
    || hasBaseColorFile() || hasOrmFile() || hasNormalFile();
}

export function hasModelFile() {
    return state.modelFile !== null;
}

export function getModelFile() {
    return state.modelFile;
}

export function hasLightingFile() {
    return state.lightingFile !== null;
}

export function getLightingFile() {
    return state.lightingFile;
}

export function hasBackgroundFile() {
    return state.backgroundFile !== null;
}

export function getBackgroundFile() {
    return state.backgroundFile;
}

export function hasBaseColorFile() {
    return state.textureFiles.baseColor !== null;
}

export function getBaseColorFile() {
    return state.textureFiles.baseColor;
}

export function hasOrmFile() {
    return state.textureFiles.orm !== null;
}

export function getOrmFile() {
    return state.textureFiles.orm;
}

export function hasNormalFile() {
    return state.textureFiles.normal !== null;
}

export function getNormalFile() {
    return state.textureFiles.normal;
}

/**
 * Update multiple parts of the state at once
 * @param {Object} updates - An object with keys and values to update
 * @returns {Object} The updated state
 */
export function setState(updates) {
    if (!state) {
        initDraftState();
    }
    
    Object.assign(state, updates);
    
    return state;
}

/**
 * Prints a formatted table report of the current state's file status
 * @param {string} [caller='unknown'] - The name of the calling function/module
 * @returns {void}
 */
export function printStateReport(caller = 'unknown') {
    console.log('\nState Report (called by ' + caller + ')\n');
    
    const files = [
        { name: 'Model', file: getModelFile(), hasFile: hasModelFile() },
        { name: 'Lighting', file: getLightingFile(), hasFile: hasLightingFile() },
        { name: 'Background', file: getBackgroundFile(), hasFile: hasBackgroundFile() },
        { name: 'Base Color', file: getBaseColorFile(), hasFile: hasBaseColorFile() },
        { name: 'ORM', file: getOrmFile(), hasFile: hasOrmFile() },
        { name: 'Normal', file: getNormalFile(), hasFile: hasNormalFile() }
    ];

    console.table(
        files.map(({ name, file, hasFile }) => ({
            'Drop Box': name,
            'File Name': file?.name || 'None',
            'Processed': hasFile
        }))
    );
    console.log('\n');
}

/**
 * NEW: Clear all file-related state
 * This should be called when navigating between pages to prevent state pollution
 * @param {boolean} skipLocalStorage - Whether to skip saving to localStorage (optional)
 */
export function clearAllFiles(skipLocalStorage = false) {
    console.log('Clearing all file state for clean navigation...');
    
    if (!state) {
        console.log('No state to clear');
        return;
    }
    
    // Clear all file references
    state.modelFile = null;
    state.lightingFile = null;
    state.backgroundFile = null;
    state.backgroundTexture = null;
    state.environmentTexture = null;
    
    // Clear texture files
    state.textureFiles = {
        baseColor: null,
        orm: null,
        normal: null
    };
    
    // Clear texture objects
    state.textureObjects = {
        baseColor: null,
        orm: null,
        normal: null
    };
    
    // Don't clear scene, camera, renderer, controls as those are handled by ThreeJS cleanup
    // Don't clear meshes as those are part of the scene cleanup
    
    console.log('File state cleared successfully');
    
    // Skip localStorage operations if requested
    if (skipLocalStorage) {
        console.log('Skipping localStorage operations as requested for faster navigation');
        return;
    }
    
    // FIXED: Use safe save function that handles quota exceeded
    import('../data/localstorage-manager.js').then(localStorageModule => {
        if (localStorageModule.safeSaveCurrentSession) {
            const success = localStorageModule.safeSaveCurrentSession(state);
            if (!success) {
                console.warn('Could not save cleared state to localStorage, continuing without persistence');
            }
        } else {
            // Fallback to regular save
            try {
                saveCurrentSession(state);
            } catch (error) {
                console.warn('Could not save session:', error.message);
            }
        }
    }).catch(error => {
        console.warn('Could not import localStorage utility:', error);
    });
}

/**
 * NEW: Clear only lighting-related state
 */
export function clearLightingState() {
    if (!state) return;
    
    console.log('Clearing lighting state...');
    state.lightingFile = null;
    state.environmentTexture = null;
    state.environmentLightingEnabled = false;
    
    // Clear scene environment if it exists
    if (state.scene) {
        state.scene.environment = null;
    }
}

/**
 * NEW: Clear only background-related state
 */
export function clearBackgroundState() {
    if (!state) return;
    
    console.log('Clearing background state...');
    state.backgroundFile = null;
    state.backgroundTexture = null;
    
    // Clear scene background if it exists
    if (state.scene) {
        state.scene.background = null;
    }
}

/**
 * NEW: Clear only texture-related state
 */
export function clearTextureState() {
    if (!state) return;
    
    console.log('Clearing texture state...');
    state.textureFiles = {
        baseColor: null,
        orm: null,
        normal: null
    };
    
    state.textureObjects = {
        baseColor: null,
        orm: null,
        normal: null
    };
}

/**
 * NEW: Reset to clean navigation state
 * This preserves the session but clears all loaded content
 */
export function resetToNavigationState() {
    console.log('Resetting to clean navigation state...');
    
    if (!state) {
        state = initDraftState();
        return state;
    }
    
    // Preserve session info
    const sessionId = state.sessionId;
    const timestamp = state.timestamp;
    
    // Reset to initial state but preserve session
    state = { ...initialState, sessionId, timestamp };
    
    // Save the reset state
    saveCurrentSession(state);
    
    console.log('Reset to navigation state complete');
    return state;
}