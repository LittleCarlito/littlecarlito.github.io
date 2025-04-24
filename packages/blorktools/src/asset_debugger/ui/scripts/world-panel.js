/**
 * Asset Debugger - World Panel Module
 * 
 * This module handles world properties, environment, and lighting visualization and controls.
 */
import { getState } from '../../core/state.js';
import { updateLighting, resetLighting, updateExposure } from '../../core/lighting-util.js';

// Track initialization state
let controlsInitialized = false;

// Store HDR/EXR metadata for display
let currentLightingMetadata = null;

// Store background image metadata for display
let currentBackgroundMetadata = null;

// Store the environment texture for preview
let environmentTexture = null;

// Store the background texture for preview
let backgroundTexture = null;

// Store the currently selected background option
let currentBackgroundOption = 'none';

/**
 * Initialize the World panel and cache DOM elements
 */
export function initWorldPanel() {
    console.log('Initializing World Panel...');
    
    // Look for world-tab (from world-panel.html) or world-tab-container (from asset_debugger.html)
    const worldPanel = document.getElementById('world-tab') || document.getElementById('world-tab-container');
    
    if (!worldPanel) {
        console.error('World panel elements not found. Panel may not be loaded in DOM yet.');
        return;
    }
    
    console.log('World panel found, initializing...');
    
    // Set up event listeners for lighting controls
    setupLightingControls();
    
    // Set up HDR toggle event listener
    setupHdrToggleListener();
    
    // Set up Background toggle event listener
    setupBgToggleListener();
    
    // Set initial background option based on scene state
    setInitialBackgroundSelection();
    
    // Mark as initialized
    controlsInitialized = true;
    
    // Update lighting info if we have it already
    if (currentLightingMetadata) {
        console.log('We have existing metadata, updating lighting info');
        updateLightingInfo(currentLightingMetadata);
        
        // If we have an environment texture, render the preview
        if (environmentTexture) {
            console.log('We have existing environment texture, rendering preview');
            renderEnvironmentPreview(environmentTexture);
        }
    } else {
        console.log('No lighting metadata available yet during initialization');
        updateBackgroundMessage();
    }
    
    // Update background image info if we have it already
    if (currentBackgroundMetadata) {
        console.log('We have existing background metadata, updating background info');
        updateBackgroundInfo(currentBackgroundMetadata);
        
        // If we have a background texture, render the preview
        if (backgroundTexture) {
            console.log('We have existing background texture, rendering preview');
            renderBackgroundPreview(backgroundTexture);
        }
    }
}

/**
 * Set up event listeners for lighting controls
 */
function setupLightingControls() {
    // Look for lighting control elements
    const ambientIntensityControl = document.getElementById('ambient-light-intensity');
    const directionalIntensityControl = document.getElementById('directional-light-intensity');
    const exposureControl = document.getElementById('exposure-value');
    const resetLightingButton = document.getElementById('reset-lighting');
    
    // Log if elements are not found
    if (!ambientIntensityControl) {
        console.warn('Ambient light intensity control not found');
    }
    if (!directionalIntensityControl) {
        console.warn('Directional light intensity control not found');
    }
    if (!exposureControl) {
        console.warn('Exposure control not found');
    }
    if (!resetLightingButton) {
        console.warn('Reset lighting button not found');
    }
    
    // Set up ambient light intensity control
    if (ambientIntensityControl) {
        ambientIntensityControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateLighting({
                ambient: { intensity: value }
            });
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        });
    }
    
    // Set up directional light intensity control
    if (directionalIntensityControl) {
        directionalIntensityControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateLighting({
                directional: { intensity: value }
            });
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        });
    }
    
    // Set up exposure control
    if (exposureControl) {
        exposureControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateExposure(value);
            // Update value display
            const valueDisplay = e.target.previousElementSibling.querySelector('.value-display');
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }
        });
    }
    
    // Set up reset lighting button
    if (resetLightingButton) {
        resetLightingButton.addEventListener('click', () => {
            resetLighting();
            
            // Reset control values if they exist
            if (ambientIntensityControl) {
                ambientIntensityControl.value = 0.5;
                const valueDisplay = ambientIntensityControl.previousElementSibling.querySelector('.value-display');
                if (valueDisplay) {
                    valueDisplay.textContent = '0.5';
                }
            }
            
            if (directionalIntensityControl) {
                directionalIntensityControl.value = 1.0;
                const valueDisplay = directionalIntensityControl.previousElementSibling.querySelector('.value-display');
                if (valueDisplay) {
                    valueDisplay.textContent = '1.0';
                }
            }
            
            if (exposureControl) {
                exposureControl.value = 1.0;
                const valueDisplay = exposureControl.previousElementSibling.querySelector('.value-display');
                if (valueDisplay) {
                    valueDisplay.textContent = '1.0';
                }
            }
            
            // Don't clear lighting info if we have an environment texture
            const state = getState();
            const hasEnvironmentTexture = state.scene && state.scene.environment !== null;
            
            if (!hasEnvironmentTexture) {
                // Only clear lighting info if no environment texture is loaded
                clearLightingInfo();
            }
            
            // Update slider visibility based on whether environment is loaded
            updateSliderVisibility(hasEnvironmentTexture);
        });
    }
    
    // Initialize message visibility
    updateLightingMessage();
    updateBackgroundMessage();
}

/**
 * Set up listener for HDR toggle checkbox events
 */
function setupHdrToggleListener() {
    // Get the checkbox element
    const hdrToggle = document.getElementById('hdr-toggle');
    
    if (hdrToggle) {
        // Prevent any click on the checkbox from propagating to the header
        hdrToggle.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        // Handle the change event separately (when checkbox state changes)
        hdrToggle.addEventListener('change', function(e) {
            // Prevent propagation to be extra safe
            e.stopPropagation();
            
            // Get the state
            const state = getState();
            
            // Toggle background visibility based on checkbox
            if (state.scene && state.scene.environment) {
                const enabled = this.checked;
                console.log('HDR toggle changed:', enabled);
                
                if (enabled) {
                    // Show background - restore previous background if any
                    if (state.scene.userData && state.scene.userData.savedBackground) {
                        state.scene.background = state.scene.userData.savedBackground;
                        delete state.scene.userData.savedBackground;
                    } else {
                        // If no saved background, use the environment
                        state.scene.background = state.scene.environment;
                    }
                } else {
                    // Hide background - save current background first
                    if (!state.scene.userData) state.scene.userData = {};
                    state.scene.userData.savedBackground = state.scene.background;
                    state.scene.background = null;
                }
                
                // Toggle canvas opacity if it exists
                const canvas = document.getElementById('hdr-preview-canvas');
                if (canvas) {
                    canvas.style.opacity = enabled ? '1' : '0.3';
                }
            }
        });
    }
    
    // Also listen for the custom event (for backward compatibility)
    document.addEventListener('hdr-toggle-change', function(e) {
        const enabled = e.detail.enabled;
        console.log('HDR toggle event received:', enabled);
        
        // Get the state
        const state = getState();
        
        if (state.scene && state.scene.environment) {
            // Toggle background visibility based on checkbox
            if (enabled) {
                // Show background - restore previous background if any
                if (state.scene.userData && state.scene.userData.savedBackground) {
                    state.scene.background = state.scene.userData.savedBackground;
                    delete state.scene.userData.savedBackground;
                } else {
                    // If no saved background, use the environment
                    state.scene.background = state.scene.environment;
                }
            } else {
                // Hide background - save current background first
                if (!state.scene.userData) state.scene.userData = {};
                state.scene.userData.savedBackground = state.scene.background;
                state.scene.background = null;
            }
        }
    });
}

/**
 * Set up listener for Background radio button selection
 */
function setupBgToggleListener() {
    // Get all radio buttons with name="bg-option"
    const bgRadioButtons = document.querySelectorAll('input[name="bg-option"]');
    
    if (bgRadioButtons && bgRadioButtons.length > 0) {
        // Listen for changes on any radio button
        bgRadioButtons.forEach(radio => {
            radio.addEventListener('change', function(e) {
                // Prevent event propagation
                e.stopPropagation();
                
                // Only process if it's a radio input
                if (e.target.type === 'radio') {
                    // Get the selected option value
                    const selectedValue = e.target.value;
                    currentBackgroundOption = selectedValue;
                    
                    console.log('Background option changed to:', selectedValue);
                    
                    // Get the state
                    const state = getState();
                    
                    // Handle based on selection
                    if (state.scene) {
                        if (selectedValue === 'none') {
                            // Disable all backgrounds
                            if (state.scene.background) {
                                if (!state.scene.userData) state.scene.userData = {};
                                state.scene.userData.savedBackground = state.scene.background;
                                state.scene.background = null;
                            }
                            
                            // Tell background-util.js to disable any background images
                            import('../../core/background-util.js').then(backgroundModule => {
                                if (backgroundModule.toggleBackgroundVisibility) {
                                    backgroundModule.toggleBackgroundVisibility(false);
                                }
                            });
                        } 
                        else if (selectedValue === 'background') {
                            // Enable background image, disable HDR
                            import('../../core/background-util.js').then(backgroundModule => {
                                if (backgroundModule.toggleBackgroundVisibility) {
                                    backgroundModule.toggleBackgroundVisibility(true);
                                }
                            });
                            
                            // Disable HDR/EXR as background if it was previously set
                            if (state.scene.background === state.scene.environment) {
                                state.scene.background = null;
                            }
                        }
                        else if (selectedValue === 'hdr') {
                            // Enable HDR/EXR as background
                            if (state.scene.environment) {
                                state.scene.background = state.scene.environment;
                            }
                            
                            // Disable regular background image
                            import('../../core/background-util.js').then(backgroundModule => {
                                if (backgroundModule.toggleBackgroundVisibility) {
                                    backgroundModule.toggleBackgroundVisibility(false);
                                }
                            });
                        }
                    }
                }
            });
            
            // Also ensure clicks don't propagate
            radio.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        });
    } else {
        console.warn('Background radio buttons not found');
    }
}

/**
 * Set the initial background radio selection based on scene state
 */
function setInitialBackgroundSelection() {
    const state = getState();
    
    // Get all radio buttons
    const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
    const backgroundRadio = document.querySelector('input[name="bg-option"][value="background"]');
    const hdrRadio = document.querySelector('input[name="bg-option"][value="hdr"]');
    
    if (!noneRadio || !backgroundRadio || !hdrRadio) {
        console.warn('Could not find all radio buttons for initial selection');
        return;
    }
    
    // Determine which option should be active
    let selectedOption = 'none'; // Default
    
    if (state.scene) {
        // Check if HDR/EXR is being used as background
        if (state.scene.environment && state.scene.background === state.scene.environment) {
            selectedOption = 'hdr';
            console.log('Detected HDR/EXR as active background');
        } 
        // Check if a regular background image is active
        else if (state.backgroundFile && state.scene.background && state.scene.background !== state.scene.environment) {
            selectedOption = 'background';
            console.log('Detected regular background image as active');
        }
        // Check just for the presence of environment texture (common when loading a scene)
        else if (state.scene.environment) {
            selectedOption = 'hdr';
            console.log('Detected environment texture, defaulting to HDR option');
        }
    }
    
    // Set the appropriate radio button as checked
    if (selectedOption === 'hdr' && hdrRadio) {
        hdrRadio.checked = true;
        currentBackgroundOption = 'hdr';
    } else if (selectedOption === 'background' && backgroundRadio) {
        backgroundRadio.checked = true;
        currentBackgroundOption = 'background';
    } else if (noneRadio) {
        noneRadio.checked = true;
        currentBackgroundOption = 'none';
    }
    
    console.log('Initial background selection set to:', currentBackgroundOption);
    
    // Update canvas opacity based on selection
    const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
    const hdrPreviewCanvas = document.getElementById('hdr-preview-canvas');
    
    if (bgPreviewCanvas) {
        bgPreviewCanvas.style.opacity = (selectedOption === 'background') ? '1' : '0.3';
    }
    
    if (hdrPreviewCanvas) {
        hdrPreviewCanvas.style.opacity = (selectedOption === 'hdr') ? '1' : '0.3';
    }
}

/**
 * Update background message visibility based on whether environment texture is loaded
 */
function updateBackgroundMessage() {
    const state = getState();
    const noBackgroundMessage = document.querySelector('.no-background-message');
    const backgroundDataInfo = document.querySelector('.background-data-info');
    
    if (!noBackgroundMessage || !backgroundDataInfo) {
        console.warn('Background message elements not found');
        return;
    }
    
    const hasEnvironment = state.scene && state.scene.environment;
    const hasBackgroundFile = state.backgroundFile;
    
    if (hasEnvironment || hasBackgroundFile) {
        noBackgroundMessage.style.display = 'none';
        backgroundDataInfo.style.display = 'block';
    } else {
        noBackgroundMessage.style.display = 'block';
        backgroundDataInfo.style.display = 'none';
    }
}

/**
 * Update lighting message visibility based on whether environment lighting is loaded
 */
function updateLightingMessage() {
    const state = getState();
    const noDataMessage = document.querySelector('.no-data-message');
    const lightingDataInfo = document.querySelector('.lighting-data-info');
    
    if (!noDataMessage || !lightingDataInfo) {
        console.warn('Lighting message elements not found');
        return;
    }
    
    const hasEnvironment = state.scene && state.scene.environment;
    
    if (hasEnvironment) {
        noDataMessage.style.display = 'none';
        lightingDataInfo.style.display = 'block';
    } else {
        noDataMessage.style.display = 'block';
        lightingDataInfo.style.display = 'none';
    }
    
    // Update slider visibility based on environment presence
    updateSliderVisibility(hasEnvironment);
}

/**
 * Update slider visibility based on whether HDR/EXR is loaded
 * @param {boolean} hasEnvironment - Whether environment lighting is loaded
 */
function updateSliderVisibility(hasEnvironment) {
    const ambientControl = document.querySelector('.ambient-control');
    const directionalControl = document.querySelector('.directional-control');
    const exposureControl = document.querySelector('.exposure-control');
    
    if (!ambientControl || !directionalControl || !exposureControl) {
        console.warn('Could not find slider controls for visibility update');
        return;
    }
    
    if (hasEnvironment) {
        // When HDR/EXR is loaded: hide ambient/directional, show exposure
        ambientControl.style.display = 'none';
        directionalControl.style.display = 'none';
        exposureControl.style.display = 'flex';
    } else {
        // When no HDR/EXR is loaded: show ambient/directional, hide exposure
        ambientControl.style.display = 'flex';
        directionalControl.style.display = 'flex';
        exposureControl.style.display = 'none';
    }
}

/**
 * Attempt to initialize the panel if not already initialized
 * This can be called when new data becomes available
 */
export function tryInitializePanel() {
    if (!controlsInitialized) {
        console.log('Attempting to initialize World panel due to new data');
        initWorldPanel();
    }
}

/**
 * Update the lighting info display with metadata
 * @param {Object} metadata - The HDR/EXR metadata
 */
export function updateLightingInfo(metadata) {
    console.log('Updating lighting info with metadata:', metadata.fileName, metadata.type);
    
    // Store the metadata for later use if the panel isn't ready yet
    currentLightingMetadata = metadata;
    
    // Try to initialize the panel if not already done
    if (!controlsInitialized) {
        tryInitializePanel();
        // If initialization fails, we'll still keep the metadata for later
        if (!controlsInitialized) {
            console.warn('Panel not initialized yet, storing metadata for later');
            return;
        }
    }
    
    // Find the UI elements
    const filenameEl = document.getElementById('lighting-filename');
    const typeEl = document.getElementById('lighting-type');
    const resolutionEl = document.getElementById('lighting-resolution');
    const sizeEl = document.getElementById('lighting-size');
    const rangeEl = document.getElementById('lighting-range');
    const luminanceEl = document.getElementById('lighting-luminance');
    const softwareEl = document.getElementById('lighting-software');
    
    // Make sure all elements exist
    if (!filenameEl || !typeEl || !resolutionEl || !sizeEl || !rangeEl || !luminanceEl || !softwareEl) {
        console.error('Cannot update lighting info: UI elements not found');
        return;
    }
    
    // Update the UI with metadata
    filenameEl.textContent = metadata.fileName || '-';
    typeEl.textContent = metadata.type || '-';
    
    const width = metadata.dimensions?.width || 0;
    const height = metadata.dimensions?.height || 0;
    resolutionEl.textContent = (width && height) ? `${width} × ${height}` : '-';
    
    const fileSizeMB = metadata.fileSizeBytes ? (metadata.fileSizeBytes / 1024 / 1024).toFixed(2) + ' MB' : '-';
    sizeEl.textContent = fileSizeMB;
    
    rangeEl.textContent = metadata.dynamicRange ? metadata.dynamicRange.toFixed(2) + ' stops' : '-';
    luminanceEl.textContent = metadata.maxLuminance ? metadata.maxLuminance.toFixed(2) : '-';
    softwareEl.textContent = metadata.creationSoftware || '-';
    
    // Show the lighting info section and hide the no data message
    const noDataMessage = document.querySelector('.no-data-message');
    const lightingDataInfo = document.querySelector('.lighting-data-info');
    
    if (!noDataMessage || !lightingDataInfo) {
        console.error('Cannot update lighting info display: message elements not found');
        return;
    }
    
    console.log('Showing lighting data info and hiding no data message');
    noDataMessage.style.display = 'none';
    lightingDataInfo.style.display = 'block';
    
    // Update background message visibility
    updateBackgroundMessage();
    
    // Update slider visibility - we have HDR/EXR data
    updateSliderVisibility(true);
    
    // Select the HDR/EXR radio button unless user has explicitly chosen a different option
    if (currentBackgroundOption !== 'none' && currentBackgroundOption !== 'background') {
        const hdrRadio = document.querySelector('input[name="bg-option"][value="hdr"]');
        if (hdrRadio) {
            hdrRadio.checked = true;
            currentBackgroundOption = 'hdr';
        }
    }
    
    // Make sure any collapsible content is still properly collapsed
    const metadataContents = document.querySelectorAll('.metadata-content');
    if (metadataContents && metadataContents.length > 0) {
        console.log('Ensuring collapsible content is collapsed initially');
        metadataContents.forEach(content => {
            content.style.display = 'none';
        });
        
        // Make sure all indicators show the right symbol
        const indicators = document.querySelectorAll('.collapse-indicator');
        if (indicators && indicators.length > 0) {
            indicators.forEach(indicator => {
                // Always set to '+' to indicate collapsed state
                indicator.textContent = '+';
            });
        }
    }
    
    // Try to get environment texture and render it
    const state = getState();
    if (state.scene && state.scene.environment) {
        console.log('Found environment texture in scene, rendering preview');
        
        // Store the environment texture for later use
        environmentTexture = state.scene.environment;
        
        // Render the preview
        renderEnvironmentPreview(environmentTexture);
    }
}

/**
 * Render the HDR/EXR environment texture preview on canvas
 * @param {THREE.Texture} texture - The environment texture to render
 * @param {HTMLCanvasElement} [externalCanvas] - Optional external canvas to render on
 * @param {HTMLElement} [externalNoImageMessage] - Optional external message element
 * @returns {boolean} - Whether preview was rendered successfully
 */
export function renderEnvironmentPreview(texture, externalCanvas, externalNoImageMessage) {
    // Look for the canvas element - either use provided external one or find in DOM
    const canvas = externalCanvas || document.getElementById('hdr-preview-canvas');
    const noImageMessage = externalNoImageMessage || document.getElementById('no-image-message');
    
    // If canvas not found, panel may not be initialized yet
    if (!canvas) {
        console.error('HDR preview canvas not found, cannot render preview');
        return false;
    }
    
    // If texture doesn't have image data, show error message
    if (!texture || !texture.image) {
        console.warn('No texture or image data found:', texture);
        showNoImageMessage(canvas, noImageMessage, 'No image data available.');
        return false;
    }
    
    console.log('Rendering environment texture preview as 3D sphere');
    
    // Hide the no image message
    if (noImageMessage) noImageMessage.style.display = 'none';
    
    // Make canvas visible
    canvas.style.display = 'block';
    
    // Show background data info and hide no background message
    const noBackgroundMessage = document.querySelector('.no-background-message');
    const backgroundDataInfo = document.querySelector('.background-data-info');
    
    if (noBackgroundMessage && backgroundDataInfo) {
        noBackgroundMessage.style.display = 'none';
        backgroundDataInfo.style.display = 'block';
    }
    
    // Set canvas size (always square for the sphere preview)
    const previewSize = externalCanvas ? Math.max(canvas.width, canvas.height) : 260;
    
    // Always enforce a square aspect ratio regardless of container dimensions
    canvas.width = previewSize;
    canvas.height = previewSize;
    
    // Apply class to ensure proper scaling with CSS
    canvas.classList.add('square-preview');
    
    try {
        // Create a mini Three.js scene for the sphere preview
        // Only check if THREE is available on the window
        if (window.THREE) {
            // If THREE is already available globally, use it directly
            createSpherePreview(window.THREE, texture, canvas, noImageMessage);
            return true;
        } else {
            // Otherwise, try to import it
            console.log('THREE not found on window, trying dynamic import');
            import('three').then((ThreeModule) => {
                const THREE = ThreeModule.default || ThreeModule;
                createSpherePreview(THREE, texture, canvas, noImageMessage);
                return true;
            }).catch(error => {
                console.error('Error importing Three.js:', error);
                fallbackTo2DPreview(texture, canvas);
                return false;
            });
        }
    } catch (error) {
        console.error('Error rendering HDR preview as sphere:', error);
        
        // Fallback to 2D preview for errors
        try {
            fallbackTo2DPreview(texture, canvas);
            return true;
        } catch (fallbackError) {
            console.error('Error rendering fallback 2D preview:', fallbackError);
            showNoImageMessage(canvas, noImageMessage, `Error: ${error.message}`);
            return false;
        }
    }
    
    return true;
}

/**
 * Create a 3D sphere preview with the environment texture
 * @param {Object} THREE - The Three.js library
 * @param {THREE.Texture} texture - The environment texture
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} noImageMessage - The no image message element
 */
export function createSpherePreview(THREE, texture, canvas, noImageMessage) {
    try {
        // Create a mini renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        // Critical for HDR/EXR: set proper encoding and tone mapping
        // Update to use modern THREE.js properties
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        
        // Create a mini scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111); // Dark background
        
        // Set the environment texture for the scene - this affects reflective materials
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        
        // Create a mini camera - move it back a bit more to make the sphere appear smaller
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.z = 3.2; // Increased camera distance to make sphere smaller
        
        // Create a 3D sphere with high polygon count for smooth reflections
        // Make the sphere slightly smaller
        const sphereGeometry = new THREE.SphereGeometry(0.8, 64, 64);
        
        // Create a metallic material
        const metallicMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.05,
            envMapIntensity: 1.0
        });
        
        // Create and add the metallic sphere
        const sphere = new THREE.Mesh(sphereGeometry, metallicMaterial);
        scene.add(sphere);
        
        // Add some lighting - even with environment lighting, we need some direct light
        // for better highlights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);
        
        // Add a directional light for highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);
        
        // Add a point light for additional dimension
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-1, 1, 0.5);
        scene.add(pointLight);
        
        let animationFrameId;
        const clock = new THREE.Clock();
        
        // Add a simple message to indicate the sphere is interactive
        const interactiveHint = document.createElement('div');
        interactiveHint.style.position = 'absolute';
        interactiveHint.style.bottom = '5px';
        interactiveHint.style.left = '50%';
        interactiveHint.style.transform = 'translateX(-50%)';
        interactiveHint.style.fontSize = '10px';
        interactiveHint.style.color = 'rgba(255,255,255,0.7)';
        interactiveHint.style.pointerEvents = 'none';
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(interactiveHint);
        
        // Initial slight rotation to show it's 3D
        sphere.rotation.y = Math.PI / 6;
        sphere.rotation.x = Math.PI / 12;
        
        // Create dedicated OrbitControls for the preview sphere
        // We need to dynamically import it for this specific use case
        let previewControls = null;
        let previewControlsReady = false;
        
        // Function to dynamically import and create OrbitControls
        const initPreviewControls = async () => {
            try {
                // Use dynamic import to get OrbitControls
                const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
                
                // Create dedicated controls for this preview only
                previewControls = new OrbitControls(camera, canvas);
                
                // Configure the preview controls
                previewControls.enableDamping = true;
                previewControls.dampingFactor = 0.05;
                previewControls.rotateSpeed = 1.0;
                previewControls.enableZoom = false;
                previewControls.enablePan = false;
                
                // Mark as ready
                previewControlsReady = true;
                
                console.log('Preview controls initialized successfully');
            } catch (error) {
                console.error('Failed to initialize preview controls:', error);
            }
        };
        
        // Initialize the controls
        initPreviewControls();
        
        function renderSphere() {
            animationFrameId = requestAnimationFrame(renderSphere);
            
            const delta = clock.getDelta();
            
            // Update preview controls if available
            if (previewControlsReady && previewControls) {
                previewControls.update();
            } else {
                // If no controls yet, add a very slow rotation to show it's 3D
                sphere.rotation.y += delta * 0.1;
            }
            
            renderer.render(scene, camera);
        }
        
        // Start the animation
        renderSphere();
        
        // Store the animation frame ID for cleanup
        canvas.setAttribute('data-animation-id', animationFrameId);
        
        // Add cleanup function when tab changes or element is removed
        const cleanup = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            
            // Remove the interactive hint
            if (interactiveHint && interactiveHint.parentElement) {
                interactiveHint.parentElement.removeChild(interactiveHint);
            }
            
            // Dispose of the preview controls if they exist
            if (previewControls) {
                previewControls.dispose();
                previewControls = null;
            }
            
            // Proper disposal of Three.js resources
            renderer.dispose();
            sphereGeometry.dispose();
            metallicMaterial.dispose();
            
            // Remove references
            sphere.geometry = null;
            sphere.material = null;
            scene.remove(sphere);
        };
        
        // Store cleanup function for later use
        canvas.cleanup = cleanup;
        
        console.log('Successfully rendered environment map as interactive 3D sphere');
    } catch (error) {
        console.error('Error in createSpherePreview:', error);
        fallbackTo2DPreview(texture, canvas);
    }
}

/**
 * Fallback to 2D preview if 3D sphere fails
 * @param {THREE.Texture} texture - The environment texture to render
 * @param {HTMLCanvasElement} canvas - The canvas element
 */
export function fallbackTo2DPreview(texture, canvas) {
    if (!canvas || !texture || !texture.image) {
        console.error('Cannot render fallback preview, missing canvas or texture');
        return false;
    }
    
    console.log('Falling back to 2D texture preview');
    
    // Get the 2D context and clear it
    const ctx = canvas.getContext('2d');
    
    try {
        // Ensure the canvas is visible
        canvas.style.display = 'block';
        
        // Set canvas dimensions to match aspect ratio or be square if no texture
        if (texture.image) {
            if (texture.image.width && texture.image.height) {
                const aspectRatio = texture.image.width / texture.image.height;
                canvas.width = 260;
                canvas.height = Math.round(canvas.width / aspectRatio);
            } else {
                canvas.width = 260;
                canvas.height = 260;
            }
        } else {
            canvas.width = 260;
            canvas.height = 260;
        }
        
        // Clear any previous content
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the texture
        if (texture.image) {
            // If we have a direct image reference, just draw it
            if (texture.image instanceof HTMLImageElement ||
                texture.image instanceof HTMLCanvasElement ||
                texture.image instanceof ImageBitmap) {
                
                try {
                    ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
                } catch (e) {
                    console.error('Error drawing texture image:', e);
                    
                    // If drawing failed, try to extract raw pixel data
                    try {
                        // Create a temporary canvas to read pixel data
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = texture.image.width || 260;
                        tempCanvas.height = texture.image.height || 260;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        // Draw to temp canvas first
                        tempCtx.drawImage(texture.image, 0, 0);
                        
                        // Get the pixel data
                        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        // Put the image data into our display canvas
                        ctx.putImageData(imageData, 0, 0);
                    } catch (extractError) {
                        console.error('Failed to extract pixel data:', extractError);
                        
                        // If all else fails, draw a placeholder gradient
                        drawPlaceholderGradient(ctx, canvas.width, canvas.height);
                    }
                }
            } 
            // For HDRi data, try to treat it as a normal image for preview
            else if (texture.image.data && texture.image.width && texture.image.height) {
                try {
                    // For raw data, try to create an ImageData object and draw that
                    const imageData = new ImageData(
                        new Uint8ClampedArray(texture.image.data),
                        texture.image.width,
                        texture.image.height
                    );
                    ctx.putImageData(imageData, 0, 0);
                } catch (dataError) {
                    console.error('Error creating ImageData from texture:', dataError);
                    drawPlaceholderGradient(ctx, canvas.width, canvas.height);
                }
            } else {
                console.warn('Unknown texture image format, falling back to placeholder');
                drawPlaceholderGradient(ctx, canvas.width, canvas.height);
            }
        } else {
            // If no image data at all, draw a placeholder gradient
            drawPlaceholderGradient(ctx, canvas.width, canvas.height);
        }
        
        return true;
    } catch (error) {
        console.error('Error in fallback 2D preview:', error);
        return false;
    }
    
    /**
     * Draw a colorful placeholder gradient when we can't render the real texture
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Width 
     * @param {number} height - Height
     */
    function drawPlaceholderGradient(ctx, width, height) {
        // Create a gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#3498db');
        gradient.addColorStop(0.5, '#9b59b6');
        gradient.addColorStop(1, '#f39c12');
        
        // Fill with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add some text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HDR/EXR Preview', width/2, height/2 - 15);
        ctx.font = '14px monospace';
        ctx.fillText('(Unable to render image data)', width/2, height/2 + 15);
    }
}

/**
 * Show "No image data" message
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} messageEl - The message element to show
 * @param {string} message - The error message to display
 */
export function showNoImageMessage(canvas, messageEl, message = 'No image data available.') {
    // Hide canvas
    if (canvas) {
        canvas.style.display = 'none';
    }
    
    // Show message
    if (messageEl) {
        messageEl.style.display = 'block';
        messageEl.textContent = message;
    } else {
        // Last resort: try to find the parent container and add a message
        const container = canvas && canvas.parentElement;
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            errorDiv.style.color = 'red';
            errorDiv.style.padding = '10px';
            container.appendChild(errorDiv);
        }
    }
}

/**
 * Clear the lighting info display
 */
function clearLightingInfo() {
    // Clear the stored metadata
    currentLightingMetadata = null;
    environmentTexture = null;
    
    // Find the UI elements
    const filenameEl = document.getElementById('lighting-filename');
    const typeEl = document.getElementById('lighting-type');
    const resolutionEl = document.getElementById('lighting-resolution');
    const sizeEl = document.getElementById('lighting-size');
    const rangeEl = document.getElementById('lighting-range');
    const luminanceEl = document.getElementById('lighting-luminance');
    const softwareEl = document.getElementById('lighting-software');
    
    // Reset all values
    if (filenameEl) filenameEl.textContent = '-';
    if (typeEl) typeEl.textContent = '-';
    if (resolutionEl) resolutionEl.textContent = '-';
    if (sizeEl) sizeEl.textContent = '-';
    if (rangeEl) rangeEl.textContent = '-';
    if (luminanceEl) luminanceEl.textContent = '-';
    if (softwareEl) softwareEl.textContent = '-';
    
    // Hide lighting info and show no data message
    const noDataMessage = document.querySelector('.no-data-message');
    const lightingDataInfo = document.querySelector('.lighting-data-info');
    
    if (noDataMessage && lightingDataInfo) {
        noDataMessage.style.display = 'block';
        lightingDataInfo.style.display = 'none';
    }
    
    // Hide background info and show no background message
    const noBackgroundMessage = document.querySelector('.no-background-message');
    const backgroundDataInfo = document.querySelector('.background-data-info');
    
    if (noBackgroundMessage && backgroundDataInfo) {
        noBackgroundMessage.style.display = 'block';
        backgroundDataInfo.style.display = 'none';
    }
    
    // Reset collapse state
    const metadataContents = document.querySelectorAll('.metadata-content');
    if (metadataContents) {
        metadataContents.forEach(content => {
            content.style.display = 'none';
        });
    }
    
    const indicators = document.querySelectorAll('.collapse-indicator');
    if (indicators) {
        indicators.forEach(indicator => {
            indicator.textContent = '+';
        });
    }
    
    // Update slider visibility - we have no HDR/EXR data
    updateSliderVisibility(false);
    
    // Clean up any ThreeJS resources
    const canvas = document.getElementById('hdr-preview-canvas');
    if (canvas) {
        // Execute cleanup function if it exists
        if (typeof canvas.cleanup === 'function') {
            canvas.cleanup();
            canvas.cleanup = null;
        }
        
        // Cancel any animation frame
        const animationId = canvas.getAttribute('data-animation-id');
        if (animationId) {
            cancelAnimationFrame(parseInt(animationId, 10));
            canvas.removeAttribute('data-animation-id');
        }
        
        // Clear the canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
    }
}

/**
 * Update the background info display with metadata
 * @param {Object} metadata - The background image metadata
 */
export function updateBackgroundInfo(metadata) {
    console.log('Updating background info with metadata:', metadata.fileName, metadata.type);
    
    // Store the metadata for later use if the panel isn't ready yet
    currentBackgroundMetadata = metadata;
    
    // Try to initialize the panel if not already done
    if (!controlsInitialized) {
        tryInitializePanel();
        // If initialization fails, we'll still keep the metadata for later
        if (!controlsInitialized) {
            console.warn('Panel not initialized yet, storing metadata for later');
            return;
        }
    }
    
    // Find the UI elements
    const filenameEl = document.getElementById('bg-filename');
    const typeEl = document.getElementById('bg-type');
    const resolutionEl = document.getElementById('bg-resolution');
    const sizeEl = document.getElementById('bg-size');
    
    // Make sure all elements exist
    if (!filenameEl || !typeEl || !resolutionEl || !sizeEl) {
        console.error('Cannot update background info: UI elements not found');
        return;
    }
    
    // Update the UI with metadata
    filenameEl.textContent = metadata.fileName || '-';
    typeEl.textContent = metadata.type || '-';
    
    const width = metadata.dimensions?.width || 0;
    const height = metadata.dimensions?.height || 0;
    resolutionEl.textContent = (width && height) ? `${width} × ${height}` : '-';
    
    const fileSizeMB = metadata.fileSizeBytes ? (metadata.fileSizeBytes / 1024 / 1024).toFixed(2) + ' MB' : '-';
    sizeEl.textContent = fileSizeMB;
    
    // Show the background info section and hide the no background message
    const noBackgroundMessage = document.querySelector('.no-background-message');
    const backgroundDataInfo = document.querySelector('.background-data-info');
    
    if (!noBackgroundMessage || !backgroundDataInfo) {
        console.error('Cannot update background info display: message elements not found');
        return;
    }
    
    console.log('Showing background data info and hiding no background message');
    noBackgroundMessage.style.display = 'none';
    backgroundDataInfo.style.display = 'block';
    
    // If we have a background file, select the background option in radio buttons
    // unless user has explicitly selected a different option
    if (currentBackgroundOption === 'none') {
        // User has explicitly chosen "None", don't change it
        const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
        if (noneRadio) {
            noneRadio.checked = true;
        }
    } else {
        // Select the appropriate option based on file type or default to background image
        const backgroundRadio = document.querySelector('input[name="bg-option"][value="background"]');
        if (backgroundRadio) {
            backgroundRadio.checked = true;
            currentBackgroundOption = 'background';
        }
    }
    
    // Make sure any collapsible content is still properly collapsed
    const metadataContents = document.querySelectorAll('.metadata-content');
    if (metadataContents && metadataContents.length > 0) {
        console.log('Ensuring collapsible content is collapsed initially');
        metadataContents.forEach(content => {
            if (!content.classList.contains('active')) {
                content.style.display = 'none';
            }
        });
        
        // Make sure all indicators show the right symbol
        const indicators = document.querySelectorAll('.collapse-indicator');
        if (indicators && indicators.length > 0) {
            indicators.forEach(indicator => {
                // Always set to '+' to indicate collapsed state
                indicator.textContent = '+';
            });
        }
    }
    
    // Try to get background texture and render it
    const state = getState();
    if (state.backgroundFile) {
        console.log('Found background file in state, rendering preview');
        
        // Create a preview of the background image
        renderBackgroundPreview(state.backgroundFile);
    }
}

/**
 * Render the background image preview on canvas
 * @param {File|Blob|THREE.Texture} fileOrTexture - The background file or texture to render
 * @returns {boolean} - Whether preview was rendered successfully
 */
export function renderBackgroundPreview(fileOrTexture) {
    // Look for the canvas element
    const canvas = document.getElementById('bg-preview-canvas');
    const noImageMessage = document.getElementById('no-bg-image-message');
    
    // If canvas not found, panel may not be initialized yet
    if (!canvas) {
        console.error('Background preview canvas not found, cannot render preview');
        return false;
    }
    
    // Store the texture for later use
    backgroundTexture = fileOrTexture;
    
    // If there's no file or texture, show error message
    if (!fileOrTexture) {
        console.warn('No background file or texture provided');
        showNoBackgroundImageMessage(canvas, noImageMessage, 'No image data available.');
        return false;
    }
    
    console.log('Rendering background image preview');
    
    // Hide the no image message
    if (noImageMessage) noImageMessage.style.display = 'none';
    
    // Make canvas visible
    canvas.style.display = 'block';
    
    try {
        // Different handling based on what type of data we have
        if (fileOrTexture instanceof File || fileOrTexture instanceof Blob) {
            // For File or Blob objects, create an image element and draw to canvas
            const url = URL.createObjectURL(fileOrTexture);
            const img = new Image();
            
            img.onload = function() {
                // Get file dimensions
                const width = img.width;
                const height = img.height;
                
                // Update metadata if needed
                if (!currentBackgroundMetadata) {
                    currentBackgroundMetadata = {
                        fileName: fileOrTexture.name,
                        type: fileOrTexture.type,
                        dimensions: { width, height },
                        fileSizeBytes: fileOrTexture.size
                    };
                    updateBackgroundInfo(currentBackgroundMetadata);
                }
                
                // Draw to canvas
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Clean up URL object
                URL.revokeObjectURL(url);
            };
            
            img.onerror = function() {
                console.error('Error loading background image');
                showNoBackgroundImageMessage(canvas, noImageMessage, 'Error loading image');
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
            return true;
        } else if (typeof fileOrTexture === 'object' && fileOrTexture.isTexture) {
            // For THREE.Texture objects, try to access the image data
            if (fileOrTexture.image) {
                const ctx = canvas.getContext('2d');
                canvas.width = fileOrTexture.image.width || 260;
                canvas.height = fileOrTexture.image.height || 260;
                
                try {
                    ctx.drawImage(fileOrTexture.image, 0, 0, canvas.width, canvas.height);
                    return true;
                } catch (e) {
                    console.error('Error drawing texture to canvas:', e);
                    showNoBackgroundImageMessage(canvas, noImageMessage, 'Error rendering texture');
                    return false;
                }
            } else {
                console.warn('Texture has no image data');
                showNoBackgroundImageMessage(canvas, noImageMessage, 'No image data in texture');
                return false;
            }
        } else {
            console.warn('Unknown background data type:', typeof fileOrTexture);
            showNoBackgroundImageMessage(canvas, noImageMessage, 'Unsupported data format');
            return false;
        }
    } catch (error) {
        console.error('Error rendering background preview:', error);
        showNoBackgroundImageMessage(canvas, noImageMessage, `Error: ${error.message}`);
        return false;
    }
    
    return true;
}

/**
 * Show "No background image data" message
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} messageEl - The message element to show
 * @param {string} message - The error message to display
 */
export function showNoBackgroundImageMessage(canvas, messageEl, message = 'No image data available.') {
    // Hide canvas
    if (canvas) {
        canvas.style.display = 'none';
    }
    
    // Show message
    if (messageEl) {
        messageEl.style.display = 'block';
        messageEl.textContent = message;
    } else {
        // Last resort: try to find the parent container and add a message
        const container = canvas && canvas.parentElement;
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            errorDiv.style.color = 'red';
            errorDiv.style.padding = '10px';
            container.appendChild(errorDiv);
        }
    }
}

/**
 * Clear the background info display
 */
function clearBackgroundInfo() {
    // Clear the stored metadata
    currentBackgroundMetadata = null;
    backgroundTexture = null;
    
    // Find the UI elements
    const filenameEl = document.getElementById('bg-filename');
    const typeEl = document.getElementById('bg-type');
    const resolutionEl = document.getElementById('bg-resolution');
    const sizeEl = document.getElementById('bg-size');
    
    // Reset all values
    if (filenameEl) filenameEl.textContent = '-';
    if (typeEl) typeEl.textContent = '-';
    if (resolutionEl) resolutionEl.textContent = '-';
    if (sizeEl) sizeEl.textContent = '-';
    
    // Select the "None" radio button
    const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
    const backgroundRadio = document.querySelector('input[name="bg-option"][value="background"]');
    const hdrRadio = document.querySelector('input[name="bg-option"][value="hdr"]');
    
    // Make sure all radio buttons are unchecked first
    if (backgroundRadio) backgroundRadio.checked = false;
    if (hdrRadio) hdrRadio.checked = false;
    
    // Set "None" as checked
    if (noneRadio) {
        noneRadio.checked = true;
        currentBackgroundOption = 'none';
    }
    
    // Clean up any canvas resources
    const canvas = document.getElementById('bg-preview-canvas');
    if (canvas) {
        // Clear the canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
    }
    
    // Show no background message if there's also no HDR/EXR environment
    const state = getState();
    const hasEnvironment = state.scene && state.scene.environment;
    
    if (!hasEnvironment) {
        const noBackgroundMessage = document.querySelector('.no-background-message');
        const backgroundDataInfo = document.querySelector('.background-data-info');
        
        if (noBackgroundMessage && backgroundDataInfo) {
            noBackgroundMessage.style.display = 'block';
            backgroundDataInfo.style.display = 'none';
        }
    }
}

/**
 * Update the World panel with current state
 */
export function updateWorldPanel() {
    // Try to initialize if not done yet
    if (!controlsInitialized) {
        tryInitializePanel();
    }
    
    // If still not initialized, log error and return
    if (!controlsInitialized) {
        console.error('Cannot update World panel: not initialized');
        return;
    }
    
    const state = getState();
    
    // Update lighting controls with current values
    const ambientIntensityControl = document.getElementById('ambient-light-intensity');
    const directionalIntensityControl = document.getElementById('directional-light-intensity');
    const exposureControl = document.getElementById('exposure-value');
    
    if (state.ambientLight && ambientIntensityControl) {
        ambientIntensityControl.value = state.ambientLight.intensity;
        const valueDisplay = ambientIntensityControl.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = state.ambientLight.intensity.toFixed(1);
        }
    }
    
    if (state.directionalLight && directionalIntensityControl) {
        directionalIntensityControl.value = state.directionalLight.intensity;
        const valueDisplay = directionalIntensityControl.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = state.directionalLight.intensity.toFixed(1);
        }
    }
    
    if (state.renderer && exposureControl) {
        exposureControl.value = state.renderer.toneMappingExposure || 1.0;
        const valueDisplay = exposureControl.previousElementSibling.querySelector('.value-display');
        if (valueDisplay) {
            valueDisplay.textContent = (state.renderer.toneMappingExposure || 1.0).toFixed(1);
        }
    }
    
    // Update lighting and background message visibility
    updateLightingMessage();
    updateBackgroundMessage();
    
    // If we have an environment texture, try to render it
    if (state.scene && state.scene.environment && !environmentTexture) {
        environmentTexture = state.scene.environment;
        renderEnvironmentPreview(environmentTexture);
    }
    
    // If we have a background file, try to render it
    if (state.backgroundFile && !backgroundTexture) {
        backgroundTexture = state.backgroundFile;
        renderBackgroundPreview(backgroundTexture);
    }
    
    // Update radio button selection to match current scene state
    updateBackgroundSelection();
}

/**
 * Update the background radio selection based on current scene state
 * This is like setInitialBackgroundSelection but doesn't log as much
 */
function updateBackgroundSelection() {
    const state = getState();
    
    // Get all radio buttons
    const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
    const backgroundRadio = document.querySelector('input[name="bg-option"][value="background"]');
    const hdrRadio = document.querySelector('input[name="bg-option"][value="hdr"]');
    
    if (!noneRadio || !backgroundRadio || !hdrRadio) {
        return; // Silently exit if buttons aren't found
    }
    
    // Determine which option should be active based on scene state
    let newSelection = 'none'; // Default
    
    if (state.scene) {
        // Check if HDR/EXR is being used as background
        if (state.scene.environment && state.scene.background === state.scene.environment) {
            newSelection = 'hdr';
        } 
        // Check if a regular background image is active
        else if (state.backgroundFile && state.scene.background && state.scene.background !== state.scene.environment) {
            newSelection = 'background';
        }
        // Check just for the presence of environment texture
        else if (state.scene.environment) {
            newSelection = 'hdr';
        }
    }
    
    // Only update if the selection has changed and isn't being manually controlled
    if (newSelection !== currentBackgroundOption) {
        // Set the appropriate radio button as checked
        if (newSelection === 'hdr' && hdrRadio) {
            hdrRadio.checked = true;
            currentBackgroundOption = 'hdr';
        } else if (newSelection === 'background' && backgroundRadio) {
            backgroundRadio.checked = true;
            currentBackgroundOption = 'background';
        } else if (noneRadio) {
            noneRadio.checked = true;
            currentBackgroundOption = 'none';
        }
        
        // Update canvas opacity based on selection
        const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
        const hdrPreviewCanvas = document.getElementById('hdr-preview-canvas');
        
        if (bgPreviewCanvas) {
            bgPreviewCanvas.style.opacity = (newSelection === 'background') ? '1' : '0.3';
        }
        
        if (hdrPreviewCanvas) {
            hdrPreviewCanvas.style.opacity = (newSelection === 'hdr') ? '1' : '0.3';
        }
    }
}

/**
 * Export a debug function to test EXR rendering directly
 * This can be called from the console for testing
 */
export function testRenderExr(file) {
    console.log('Manual EXR rendering test with file:', file);
    
    if (!file) {
        console.error('No file provided');
        return;
    }
    
    // First make sure to import Three.js if needed
    import('three').then((THREE) => {
        console.log('Three.js imported for manual testing');
        
        // Import the EXRLoader
        import('three/addons/loaders/EXRLoader.js').then(({ EXRLoader }) => {
            console.log('EXRLoader imported successfully');
            
            const loader = new EXRLoader();
            loader.setDataType(THREE.FloatType);
            
            // Create URL
            const url = URL.createObjectURL(file);
            console.log('Created URL for manual test:', url);
            
            // Load the texture
            loader.load(url, (texture) => {
                console.log('EXR loaded for manual test:', texture);
                console.log('EXR image data:', texture.image);
                
                // Render it
                renderEnvironmentPreview(texture);
                
                // Clean up
                URL.revokeObjectURL(url);
            }, 
            // Progress
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percentComplete = xhr.loaded / xhr.total * 100;
                    console.log(`Manual test loading: ${Math.round(percentComplete)}%`);
                }
            },
            // Error
            (error) => {
                console.error('Error in manual test:', error);
            });
        }).catch(err => {
            console.error('Error importing EXRLoader for manual test:', err);
        });
    }).catch(err => {
        console.error('Error importing Three.js for manual test:', err);
    });
}

// Make the test function available globally for debugging
window.testRenderExr = testRenderExr; 