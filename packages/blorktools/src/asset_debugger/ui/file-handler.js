/**
 * Texture Debugger - File Handler Module
 * 
 * This module manages file uploads and drag & drop operations.
 */
import { getState, updateState } from '../core/state.js';
import { loadTextureFromFile, formatFileSize } from '../core/materials.js';
import { updateAtlasVisualization } from './scripts/atlas-panel.js';

/**
 * Setup dropzones for file input
 */
export function setupDropzones() {
    // Get dropzone elements
    const baseColorDropzone = document.getElementById('basecolor-dropzone');
    const ormDropzone = document.getElementById('orm-dropzone');
    const normalDropzone = document.getElementById('normal-dropzone');
    const modelDropzone = document.getElementById('model-dropzone');
    
    // Get info elements
    const baseColorInfo = document.getElementById('basecolor-info');
    const ormInfo = document.getElementById('orm-info');
    const normalInfo = document.getElementById('normal-info');
    const modelInfo = document.getElementById('model-info');
    
    // Get preview elements
    const baseColorPreview = document.getElementById('basecolor-preview');
    const ormPreview = document.getElementById('orm-preview');
    const normalPreview = document.getElementById('normal-preview');
    
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
}

/**
 * Setup an individual dropzone
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} fileType - The type of file ('baseColor', 'orm', 'normal', 'model')
 * @param {HTMLElement} infoElement - Element to display file info
 * @param {HTMLElement} previewElement - Element to display file preview (null for model)
 */
function setupDropzone(dropzone, fileType, infoElement, previewElement) {
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
            }
        } else {
            if (file && file.type.startsWith('image/')) {
                handleTextureUpload(file, fileType, infoElement, previewElement, dropzone);
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
                } else {
                    alert('Please upload a GLB file for the model');
                }
            };
        } else {
            input.accept = 'image/*';
            
            input.onchange = e => {
                const file = e.target.files[0];
                if (file) {
                    handleTextureUpload(file, fileType, infoElement, previewElement, dropzone);
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
 * Check if all required textures are loaded and enable start button if they are
 */
function checkStartButton() {
    const startButton = document.getElementById('start-debug');
    
    if (startButton) {
        // Always enable the button regardless of file status
        startButton.disabled = false;
        console.log('Start debugging button is always enabled');
    }
}

export default {
    setupDropzones
}; 