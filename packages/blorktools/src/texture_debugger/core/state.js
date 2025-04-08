/**
 * Texture Debugger - State Management Module
 * 
 * This module manages the global state for the texture debugger tool.
 * It provides methods to initialize, access, and update the application state.
 */

// Define the initial state
const initialState = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    cube: null,
    model: null,
    
    // Texture files (File objects)
    textureFiles: {
        baseColor: null,
        orm: null,
        normal: null
    },
    
    // Texture objects (THREE.Texture objects)
    textureObjects: {
        baseColor: null,
        orm: null,
        normal: null
    },
    
    // Model file (File object)
    modelFile: null,
    
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
    
    // Rig data
    bones: [],
    skeleton: null,
    boneVisualization: null,
    isBoneVisualizationVisible: false,
    
    // Status flags
    isDebugStarted: false,
    useCustomModel: false
};

// The actual state object
let state = null;

/**
 * Initialize the application state
 * @returns {Object} The initialized state object
 */
export function initState() {
    // Check if state already exists in window (for persistence between hot reloads)
    if (window.textureDebuggerState) {
        state = window.textureDebuggerState;
    } else {
        // Create a new state object
        state = { ...initialState };
        // Store in window for persistence
        window.textureDebuggerState = state;
    }
    return state;
}

/**
 * Get the current application state
 * @returns {Object} The current state object
 */
export function getState() {
    if (!state) {
        return initState();
    }
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
        initState();
    }
    
    state[key] = value;
    return state;
}

/**
 * Reset the state to initial values
 * @returns {Object} The reset state
 */
export function resetState() {
    state = { ...initialState };
    window.textureDebuggerState = state;
    return state;
}

export default {
    initState,
    getState,
    updateState,
    resetState
}; 