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

// Store the environment texture for preview
let environmentTexture = null;

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
        updateLightingMessage();
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
    
    // Update slider visibility - we have HDR/EXR data
    updateSliderVisibility(true);
    
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
 */
function renderEnvironmentPreview(texture) {
    // Look for the canvas element
    const canvas = document.getElementById('hdr-preview-canvas');
    const noImageMessage = document.getElementById('no-image-message');
    
    // If canvas not found, panel may not be initialized yet
    if (!canvas) {
        console.error('HDR preview canvas not found, cannot render preview');
        return;
    }
    
    // If texture doesn't have image data, show error message
    if (!texture || !texture.image) {
        console.warn('No texture or image data found:', texture);
        showNoImageMessage(canvas, noImageMessage, 'No image data available.');
        return;
    }
    
    console.log('Rendering environment texture preview as 3D sphere');
    
    // Hide the no image message
    if (noImageMessage) noImageMessage.style.display = 'none';
    
    // Make canvas visible
    canvas.style.display = 'block';
    
    // Set canvas size (always square for the sphere preview)
    const previewSize = 260;
    canvas.width = previewSize;
    canvas.height = previewSize;
    
    try {
        // Create a mini Three.js scene for the sphere preview
        // Only check if THREE is available on the window
        if (window.THREE) {
            // If THREE is already available globally, use it directly
            createSpherePreview(window.THREE, texture, canvas, noImageMessage);
        } else {
            // Otherwise, try to import it
            console.log('THREE not found on window, trying dynamic import');
            import('three').then((ThreeModule) => {
                const THREE = ThreeModule.default || ThreeModule;
                createSpherePreview(THREE, texture, canvas, noImageMessage);
            }).catch(error => {
                console.error('Error importing Three.js:', error);
                fallbackTo2DPreview(texture, canvas);
            });
        }
    } catch (error) {
        console.error('Error rendering HDR preview as sphere:', error);
        
        // Fallback to 2D preview for errors
        try {
            fallbackTo2DPreview(texture, canvas);
        } catch (fallbackError) {
            console.error('Error rendering fallback 2D preview:', fallbackError);
            showNoImageMessage(canvas, noImageMessage, `Error: ${error.message}`);
        }
    }
}

/**
 * Create a 3D sphere preview with the environment texture
 * @param {Object} THREE - The Three.js library
 * @param {THREE.Texture} texture - The environment texture
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} noImageMessage - The no image message element
 */
function createSpherePreview(THREE, texture, canvas, noImageMessage) {
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
function fallbackTo2DPreview(texture, canvas) {
    console.log('Falling back to 2D preview');
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If we have an actual HTMLImageElement, we can render it directly
    if (texture.image instanceof HTMLImageElement) {
        console.log('Processing HTMLImageElement');
        
        // Draw the image to the canvas
        ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
    }
    // If texture is a cube texture, draw one of its faces
    else if (Array.isArray(texture.image) && texture.image.length >= 1) {
        const faceImage = texture.image[0];
        
        if (faceImage instanceof HTMLImageElement) {
            // Draw the face image
            ctx.drawImage(faceImage, 0, 0, canvas.width, canvas.height);
            
            // Add "Cubemap Preview" text
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Cubemap Preview', canvas.width / 2, canvas.height - 12);
        }
    }
    // If it's a data texture, create a visualization of the data
    else if (texture.image.data) {
        const data = texture.image.data;
        const width = texture.image.width || 256;
        const height = texture.image.height || 128;
        
        // Create an ImageData object to display the data
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        
        // Sample the data from the texture
        const scaleX = width / canvas.width;
        const scaleY = height / canvas.height;
        
        // For EXR/HDR formats, we need to apply tone mapping to make them visible
        const exposure = 1.0;
        const gamma = 2.2;
        
        // Detect if we have a Float32Array (typical for EXR)
        const isFloatData = data instanceof Float32Array;
        
        // Check if the data layout is standard RGBA (4 components)
        const dataComponents = data.length / (width * height);
        
        // Special case for non-standard data formats
        const isNonStandardFormat = dataComponents !== 4;
        
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                // Calculate source position in original data
                const srcX = Math.floor(x * scaleX);
                const srcY = Math.floor(y * scaleY);
                
                // Calculate destination index in imageData
                const destIndex = (y * canvas.width + x) * 4;
                
                // Default to black
                let r = 0, g = 0, b = 0;
                
                // Handle different data layouts
                if (isNonStandardFormat) {
                    // Handle non-standard formats (like RGB without alpha)
                    const srcIndex = (srcY * width + srcX) * dataComponents;
                    
                    if (srcIndex < data.length - (dataComponents - 1)) {
                        // Just take the first 3 components as RGB
                        r = data[srcIndex];
                        g = dataComponents > 1 ? data[srcIndex + 1] : r;
                        b = dataComponents > 2 ? data[srcIndex + 2] : g;
                    }
                } else {
                    // Standard RGBA format
                    const srcIndex = (srcY * width + srcX) * 4;
                    
                    if (srcIndex < data.length - 3) {
                        r = data[srcIndex];
                        g = data[srcIndex + 1];
                        b = data[srcIndex + 2];
                    }
                }
                
                // For float data (EXR), we need to apply more aggressive tone mapping
                if (isFloatData) {
                    // Ensure values are positive and not NaN or Infinity
                    r = isNaN(r) || !isFinite(r) ? 0 : Math.abs(r);
                    g = isNaN(g) || !isFinite(g) ? 0 : Math.abs(g);
                    b = isNaN(b) || !isFinite(b) ? 0 : Math.abs(b);
                    
                    // Apply simple tone mapping (exposure + gamma correction)
                    // and convert from float HDR values to 8-bit display values
                    r = Math.max(0, Math.min(255, Math.pow(r * exposure, 1/gamma) * 255));
                    g = Math.max(0, Math.min(255, Math.pow(g * exposure, 1/gamma) * 255));
                    b = Math.max(0, Math.min(255, Math.pow(b * exposure, 1/gamma) * 255));
                } else {
                    // For RGBE (HDR) data, simple scaling might be enough
                    r = Math.max(0, Math.min(255, r));
                    g = Math.max(0, Math.min(255, g));
                    b = Math.max(0, Math.min(255, b));
                }
                
                imageData.data[destIndex] = r;
                imageData.data[destIndex + 1] = g;
                imageData.data[destIndex + 2] = b;
                imageData.data[destIndex + 3] = 255; // Alpha
            }
        }
        
        // Put the ImageData to the canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Add an informative text overlay
        const textLabel = isFloatData ? 'EXR Data Preview' : 'HDR Data Preview';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(textLabel, canvas.width / 2, canvas.height - 12);
    }
}

/**
 * Show "No image data" message
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {HTMLElement} messageEl - The message element to show
 * @param {string} message - The error message to display
 */
function showNoImageMessage(canvas, messageEl, message = 'No image data available.') {
    console.warn('Showing no image message:', message);
    
    // Hide canvas
    if (canvas) {
        canvas.style.display = 'none';
        console.log('Canvas hidden');
    }
    
    // Show message
    if (messageEl) {
        messageEl.style.display = 'block';
        messageEl.textContent = message;
        console.log('Message displayed:', message);
    } else {
        // Last resort: try to find the parent container and add a message
        const container = document.querySelector('.lighting-status');
        if (container) {
            console.log('Found parent container, adding error message directly');
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
    
    // Update lighting message visibility
    updateLightingMessage();
    
    // If we have an environment texture, try to render it
    if (state.scene && state.scene.environment && !environmentTexture) {
        environmentTexture = state.scene.environment;
        renderEnvironmentPreview(environmentTexture);
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