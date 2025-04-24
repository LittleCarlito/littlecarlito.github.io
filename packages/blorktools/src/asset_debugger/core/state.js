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
    
    // Lighting file (File object for HDR/EXR environment map)
    lightingFile: null,
    
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
    },
    
    // Background file
    backgroundFile: null,
    backgroundTexture: null,
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
 * Setup a file drop handler for the background image dropzone
 */
export function setupBackgroundDropzone() {
    const dropzone = document.getElementById('background-dropzone');
    const info = document.getElementById('background-info');
    const preview = document.getElementById('background-preview');
    
    if (!dropzone) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    dropzone.addEventListener('drop', handleBackgroundDrop, false);
    
    // Handle file input changes (if there's a file input)
    const fileInput = dropzone.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleBackgroundFiles(e.target.files);
        });
    }
    
    function handleBackgroundDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleBackgroundFiles(files);
    }
    
    function handleBackgroundFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0]; // Use only the first file
        const validExtensions = ['hdr', 'exr', 'jpg', 'jpeg', 'png', 'webp', 'tiff'];
        const extension = file.name.split('.').pop().toLowerCase();
        
        console.log('[DEBUG] Background file processing:', file.name, 'type:', file.type, 'size:', file.size);
        
        if (!validExtensions.includes(extension)) {
            alert(`Unsupported file format. Please upload an HDR, EXR, JPEG, PNG, WebP, or TIFF file.`);
            return;
        }
        
        // Update the information display
        info.textContent = `${file.name} (${formatFileSize(file.size)})`;
        
        // Generate a preview if possible
        if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.style.backgroundImage = `url(${e.target.result})`;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            // For HDR/EXR, show a placeholder or icon
            preview.style.backgroundImage = '';
            preview.textContent = 'HDR/EXR Preview Not Available';
            preview.style.display = 'flex';
            preview.style.alignItems = 'center';
            preview.style.justifyContent = 'center';
        }
        
        // Update state with the background file
        updateState({
            backgroundFile: file
        });
        
        console.log('[DEBUG] Updated state with background file:', file.name);
        
        // Verify the state was actually updated
        const currentState = getState();
        console.log('[DEBUG] State after background update:', {
            hasBackgroundFile: currentState.backgroundFile ? true : false,
            backgroundFileName: currentState.backgroundFile ? currentState.backgroundFile.name : 'none'
        });
    }
}

// Make sure to call setupBackgroundDropzone in the initDropzones function or wherever appropriate
export function initDropzones() {
    // ... existing dropzone setup code ...
    
    // Set up the background dropzone
    setupBackgroundDropzone();
    
    // ... more existing code ...
}

export default {
    initState,
    getState,
    updateState,
    setState,
    resetState
}; 