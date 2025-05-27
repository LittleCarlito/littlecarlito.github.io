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

// The actual state object
let state = null;

/**
 * Initialize the application state
 * @returns {Object} The initialized state object
 */
export function initState() {
    // Check if there's an existing state object in the window and use it
    if (window.assetDebuggerState) {
        state = window.assetDebuggerState;
    } else {
        // Create a new state object
        state = { ...initialState };
        // Store in window for persistence
        window.assetDebuggerState = state;
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
    
    if (typeof key === 'object') {
        // If key is an object, use it directly as updates
        Object.assign(state, key);
    } else {
        state[key] = value;
    }
    
    // Ensure window.assetDebuggerState is always updated
    window.assetDebuggerState = state;
    
    return state;
}

/**
 * Reset the state to initial values
 * @returns {Object} The reset state
 */
export function resetState() {
    state = { ...initialState };
    window.assetDebuggerState = state;
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
 * Update multiple parts of the state at once
 * @param {Object} updates - An object with keys and values to update
 * @returns {Object} The updated state
 */
export function setState(updates) {
    if (!state) {
        initState();
    }
    
    Object.assign(state, updates);
    
    // Ensure window.assetDebuggerState is always updated
    window.assetDebuggerState = state;
    
    return state;
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
