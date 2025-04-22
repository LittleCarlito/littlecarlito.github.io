/**
 * Texture Debugger - File Handler Module
 * 
 * This module manages file uploads and drag & drop operations.
 */
import { getState, updateState } from '../core/state.js';
import { loadTextureFromFile, formatFileSize } from '../core/materials.js';
import { updateAtlasVisualization } from './scripts/atlas-panel.js';
import { setupEnvironmentLighting } from '../core/lighting-util.js';

// Debug flags
const DEBUG_LIGHTING = false;

/**
 * Setup dropzones for file input
 */
export function setupDropzones() {
    // Get dropzone elements
    const baseColorDropzone = document.getElementById('basecolor-dropzone');
    const ormDropzone = document.getElementById('orm-dropzone');
    const normalDropzone = document.getElementById('normal-dropzone');
    const modelDropzone = document.getElementById('model-dropzone');
    const lightingDropzone = document.getElementById('lighting-dropzone');
    
    // Get info elements
    const baseColorInfo = document.getElementById('basecolor-info');
    const ormInfo = document.getElementById('orm-info');
    const normalInfo = document.getElementById('normal-info');
    const modelInfo = document.getElementById('model-info');
    const lightingInfo = document.getElementById('lighting-info');
    
    // Get preview elements
    const baseColorPreview = document.getElementById('basecolor-preview');
    const ormPreview = document.getElementById('orm-preview');
    const normalPreview = document.getElementById('normal-preview');
    const lightingPreview = document.getElementById('lighting-preview');
    
    // Ensure the start button is disabled initially
    checkStartButton();
    
    // Set up each dropzone
    if (baseColorDropzone && baseColorInfo && baseColorPreview) {
        setupDropzone(baseColorDropzone, 'baseColor', baseColorInfo, baseColorPreview);
    }
    
    if (ormDropzone && ormInfo && ormPreview) {
        setupDropzone(ormDropzone, 'orm', ormInfo, ormPreview);
    }
    
    if (normalDropzone && normalInfo && normalPreview) {
        setupDropzone(normalDropzone, 'normal', normalInfo, normalPreview);
    }
    
    if (modelDropzone && modelInfo) {
        setupDropzone(modelDropzone, 'model', modelInfo, null);
    }
    
    if (lightingDropzone && lightingInfo && lightingPreview) {
        setupDropzone(lightingDropzone, 'lighting', lightingInfo, lightingPreview);
    }
}

/**
 * Setup an individual dropzone
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} fileType - The type of file ('baseColor', 'orm', 'normal', 'model', 'lighting')
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview (null for model)
 */
function setupDropzone(dropzone, fileType, infoElement, previewElement) {
    // First remove any existing event listeners to prevent duplicates
    const clone = dropzone.cloneNode(true);
    dropzone.parentNode.replaceChild(clone, dropzone);
    dropzone = clone;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, false);
    });

    // Highlight dropzone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('active');
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', event => {
        event.preventDefault();
        event.stopPropagation();
        
        const file = event.dataTransfer.files[0];
        if (fileType === 'model') {
            if (file && file.name.toLowerCase().endsWith('.glb')) {
                handleModelUpload(file, infoElement, dropzone);
            } else {
                alert('Please upload a GLB file for the model');
                return false;
            }
        } else if (fileType === 'lighting') {
            if (file && (file.name.toLowerCase().endsWith('.hdr') || file.name.toLowerCase().endsWith('.exr'))) {
                handleLightingUpload(file, infoElement, previewElement, dropzone);
            } else {
                alert('Please upload an HDR or EXR file for lighting');
                return false;
            }
        } else {
            // Check for valid texture file extensions
            const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'];
            const isValidTextureFile = file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
            
            if (isValidTextureFile) {
                handleTextureUpload(file, fileType, infoElement, previewElement, dropzone);
            } else if (file) {
                alert('Please upload a valid texture file (PNG, JPG, WEBP, TIF, BMP)');
                return false;
            }
        }
        return false;
    }, false);

    // Handle file upload via click
    dropzone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        
        if (fileType === 'model') {
            input.accept = '.glb';
            
            input.onchange = e => {
                const file = e.target.files[0];
                if (file && file.name.toLowerCase().endsWith('.glb')) {
                    handleModelUpload(file, infoElement, dropzone);
                } else if (file) {
                    alert('Please upload a GLB file for the model');
                }
            };
        } else if (fileType === 'lighting') {
            input.accept = '.hdr,.exr';
            
            input.onchange = e => {
                const file = e.target.files[0];
                if (file && (file.name.toLowerCase().endsWith('.hdr') || file.name.toLowerCase().endsWith('.exr'))) {
                    handleLightingUpload(file, infoElement, previewElement, dropzone);
                } else if (file) {
                    alert('Please upload an HDR or EXR file for lighting');
                }
            };
        } else {
            // Set accept attribute to specify valid image formats
            input.accept = '.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp';
            
            input.onchange = e => {
                const file = e.target.files[0];
                if (file) {
                    // Check for valid texture file extensions
                    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'];
                    const isValidTextureFile = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
                    
                    if (isValidTextureFile) {
                        handleTextureUpload(file, fileType, infoElement, previewElement, dropzone);
                    } else {
                        alert('Please upload a valid texture file (PNG, JPG, WEBP, TIF, BMP)');
                    }
                }
            };
        }
        
        input.click();
    });
}

/**
 * Prevent default drag behaviors
 * @param {Event} e - The event object
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Handle texture file upload
 * @param {File} file - The uploaded file
 * @param {string} textureType - The type of texture ('baseColor', 'orm', 'normal')
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleTextureUpload(file, textureType, infoElement, previewElement, dropzone) {
    // Store the file in the state
    const state = getState();
    state.textureFiles[textureType] = file;
    updateState('textureFiles', state.textureFiles);
    
    // Show file info
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Create an image preview
    const reader = new FileReader();
    reader.onload = e => {
        // Create preview image
        const img = document.createElement('img');
        img.src = e.target.result;
        
        // Clear previous preview
        previewElement.innerHTML = '';
        previewElement.appendChild(img);
        
        // Load texture
        loadTextureFromFile(file, textureType)
            .then(() => {
                // Check if all textures are loaded to enable the start button
                checkStartButton();
                
                // Update atlas visualization if atlas tab is active
                const atlasTab = document.getElementById('atlas-tab');
                if (atlasTab && atlasTab.classList.contains('active')) {
                    updateAtlasVisualization();
                }
            })
            .catch(error => {
                console.error(`Error loading ${textureType} texture:`, error);
                alert(`Error loading ${textureType} texture: ${error.message}`);
            });
    };
    
    reader.readAsDataURL(file);
}

/**
 * Handle model file upload
 * @param {File} file - The uploaded file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleModelUpload(file, infoElement, dropzone) {
    // Store the file in the state
    updateState('modelFile', file);
    updateState('useCustomModel', true);
    
    // Show file info
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Update the texture dropzone hints to show textures are optional with GLB
    const textureHints = document.querySelectorAll('.texture-hint');
    textureHints.forEach(hint => {
        hint.textContent = 'Textures are optional with GLB';
        hint.style.color = '#88cc88'; // Light green color
    });
    
    // Check if we can enable the start button
    checkStartButton();
}

/**
 * Handle lighting file upload
 * @param {File} file - The uploaded file
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview
 * @param {HTMLElement} dropzone - The dropzone element
 */
function handleLightingUpload(file, infoElement, previewElement, dropzone) {
    // Validate file type (already done in caller) and store in state
    updateState('lightingFile', file);
    
    // Set the environment lighting enabled flag
    updateState('environmentLightingEnabled', true);
    
    // Show file info
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Create a simple preview placeholder (don't actually process the file yet)
    previewElement.innerHTML = '';
    
    // Create a canvas to render a sphere placeholder
    const canvas = document.createElement('canvas');
    canvas.className = 'hdr-placeholder-canvas';
    canvas.width = 100;
    canvas.height = 100;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with dark background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create a sphere-like gradient with a more metallic/chrome look
    const centerX = 50;
    const centerY = 50;
    const radius = 40;
    
    // Create a metallic-looking sphere with reflective highlights
    const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3, // Highlight origin X
        centerY - radius * 0.3, // Highlight origin Y 
        radius * 0.1,          // Inner radius for highlight
        centerX,               // Center X
        centerY,               // Center Y
        radius                 // Outer radius
    );
    
    // Metallic silver-blue colors
    gradient.addColorStop(0, '#ffffff');       // Bright highlight
    gradient.addColorStop(0.1, '#c0d0f0');     // Near highlight
    gradient.addColorStop(0.4, '#607090');     // Mid tone
    gradient.addColorStop(0.7, '#405070');     // Darker tone
    gradient.addColorStop(0.9, '#203050');     // Edge
    gradient.addColorStop(1, '#101830');       // Outer edge
    
    // Draw the sphere
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Add a sharper highlight
    const highlightGradient = ctx.createRadialGradient(
        centerX - radius * 0.4,  // X
        centerY - radius * 0.4,  // Y
        1,                       // Inner radius
        centerX - radius * 0.4,  // X
        centerY - radius * 0.4,  // Y
        radius * 0.3             // Outer radius
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.4, centerY - radius * 0.4, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = highlightGradient;
    ctx.fill();
    
    // Add a secondary smaller highlight
    const highlight2Gradient = ctx.createRadialGradient(
        centerX + radius * 0.2,  // X
        centerY - radius * 0.5,  // Y
        1,                       // Inner radius
        centerX + radius * 0.2,  // X 
        centerY - radius * 0.5,  // Y
        radius * 0.15            // Outer radius
    );
    highlight2Gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    highlight2Gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.2, centerY - radius * 0.5, radius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = highlight2Gradient;
    ctx.fill();
    
    // Add subtle environment reflection suggestion
    // This creates slightly colored bands to suggest environment reflection
    const bands = 3;
    const bandHeight = radius * 2 / bands;
    
    for (let i = 0; i < bands; i++) {
        const y = centerY - radius + i * bandHeight;
        const opacity = 0.1 - (i * 0.02);  // Decrease opacity for lower bands
        
        // Add a subtle color band
        ctx.beginPath();
        ctx.ellipse(
            centerX,                     // X
            y + bandHeight/2,            // Y
            radius * 0.9,                // X radius
            bandHeight/2,                // Y radius
            0,                           // Rotation
            0, Math.PI * 2               // Start/end angles
        );
        
        // Different colors for each band
        let bandColor;
        if (i === 0) bandColor = 'rgba(100, 150, 255, ' + opacity + ')';  // Blue-ish for top
        else if (i === 1) bandColor = 'rgba(100, 170, 200, ' + opacity + ')';  // Teal-ish for middle
        else bandColor = 'rgba(100, 200, 150, ' + opacity + ')';  // Green-ish for bottom
        
        ctx.fillStyle = bandColor;
        ctx.fill();
    }
    
    // Create container for the canvas and label
    const placeholderContainer = document.createElement('div');
    placeholderContainer.className = 'hdr-placeholder';
    placeholderContainer.style.width = '100%';
    placeholderContainer.style.height = '100%';
    placeholderContainer.style.display = 'flex';
    placeholderContainer.style.flexDirection = 'column';
    placeholderContainer.style.justifyContent = 'center';
    placeholderContainer.style.alignItems = 'center';
    placeholderContainer.style.backgroundColor = '#111111';
    
    // Add the canvas
    placeholderContainer.appendChild(canvas);
    
    // Add text label below
    const label = document.createElement('div');
    label.textContent = 'HDR/EXR Environment';
    label.style.color = 'white';
    label.style.marginTop = '10px';
    label.style.fontSize = '12px';
    
    placeholderContainer.appendChild(label);
    
    // Add the placeholder to the preview container
    previewElement.appendChild(placeholderContainer);
    
    // Log the update
    console.log(`HDR/EXR file "${file.name}" accepted and stored for later processing`);
    
    // Check if we can enable the start button
    checkStartButton();
}

/**
 * Check if all required textures are loaded and enable start button if they are
 */
function checkStartButton() {
    const startButton = document.getElementById('start-debug');
    
    if (startButton) {
        // Always enable the button regardless of file status
        startButton.disabled = false;
        if (DEBUG_LIGHTING) {
            console.log('Start debugging button is always enabled');
        }
    }
}

export default {
    setupDropzones
}; 