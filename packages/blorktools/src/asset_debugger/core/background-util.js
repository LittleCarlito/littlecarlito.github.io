/**
 * Background Image Utilities
 * 
 * Handles loading and setting up background images for the Asset Debugger
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { getState, updateState } from './state.js';

// Track loaded textures to avoid duplicates
const textureCache = new Map();

/**
 * Sets up a background image in the scene
 * @param {File} backgroundFile - The background image file (HDR, EXR, JPEG, PNG, WebP, or TIFF)
 * @returns {Promise<THREE.Texture|null>} - Resolves with the texture when the background is set up
 */
export function setupBackgroundImage(backgroundFile) {
    return new Promise((resolve, reject) => {
        if (!backgroundFile) {
            console.warn('No background file provided');
            resolve(null);
            return;
        }

        const state = getState();
        const scene = state.scene;

        if (!scene) {
            console.error('Scene not available for background setup');
            reject(new Error('Scene not available'));
            return;
        }

        // Check if we've already loaded this texture
        const cachedTexture = textureCache.get(backgroundFile.name);
        if (cachedTexture) {
            applyBackgroundTexture(cachedTexture, backgroundFile);
            resolve(cachedTexture);
            return;
        }

        // Choose the appropriate loader based on file extension
        const fileExtension = backgroundFile.name.split('.').pop().toLowerCase();
        
        try {
            if (fileExtension === 'hdr') {
                loadHDRBackground(backgroundFile, resolve, reject);
            } else if (fileExtension === 'exr') {
                loadEXRBackground(backgroundFile, resolve, reject);
            } else if (['jpg', 'jpeg', 'png', 'webp', 'tiff'].includes(fileExtension)) {
                loadStandardBackground(backgroundFile, resolve, reject);
            } else {
                console.error('Unsupported background image format:', fileExtension);
                reject(new Error(`Unsupported background image format: ${fileExtension}`));
            }
        } catch (error) {
            console.error('Error setting up background:', error);
            reject(error);
        }
    });
}

/**
 * Loads an HDR file as background
 * @param {File} file - The HDR file
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 */
function loadHDRBackground(file, resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const loader = new RGBELoader();
        loader.load(
            event.target.result,
            (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                applyBackgroundTexture(texture, file);
                textureCache.set(file.name, texture);
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error('Error loading HDR background:', error);
                reject(error);
            }
        );
    };
    reader.onerror = function(event) {
        console.error('Error reading file:', event);
        reject(new Error('Error reading file'));
    };
    reader.readAsDataURL(file);
}

/**
 * Loads an EXR file as background
 * @param {File} file - The EXR file
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 */
function loadEXRBackground(file, resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const loader = new EXRLoader();
        loader.load(
            event.target.result,
            (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                applyBackgroundTexture(texture, file);
                textureCache.set(file.name, texture);
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error('Error loading EXR background:', error);
                reject(error);
            }
        );
    };
    reader.onerror = function(event) {
        console.error('Error reading file:', event);
        reject(new Error('Error reading file'));
    };
    reader.readAsDataURL(file);
}

/**
 * Loads a standard image format (JPEG, PNG, WebP, TIFF) as background
 * @param {File} file - The image file
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 */
function loadStandardBackground(file, resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const loader = new THREE.TextureLoader();
        loader.load(
            event.target.result,
            (texture) => {
                // For standard images, we'll now use equirectangular mapping
                // to create a 360° background, just like HDR/EXR files
                texture.mapping = THREE.EquirectangularReflectionMapping;
                
                // Apply the texture to the background
                applyBackgroundTexture(texture, file);
                textureCache.set(file.name, texture);
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error('Error loading standard background:', error);
                reject(error);
            }
        );
    };
    reader.onerror = function(event) {
        console.error('Error reading file:', event);
        reject(new Error('Error reading file'));
    };
    reader.readAsDataURL(file);
}

/**
 * Applies the loaded texture as scene background
 * @param {THREE.Texture} texture - The loaded texture
 * @param {File} originalFile - The original file that was loaded
 */
function applyBackgroundTexture(texture, originalFile) {
    console.log('[DEBUG] Applying background texture with original file:', 
        originalFile ? originalFile.name : 'no original file provided');
    
    const state = getState();
    if (!state.scene) {
        console.error('Scene not available for background application');
        return;
    }

    // Remove any existing background mesh if present
    if (state.scene.userData.backgroundMesh) {
        state.scene.remove(state.scene.userData.backgroundMesh);
        state.scene.userData.backgroundMesh = null;
    }

    // Store original file name in texture for reference
    if (originalFile && originalFile.name) {
        if (!texture.userData) texture.userData = {};
        texture.userData.fileName = originalFile.name;
        console.log('[DEBUG] Added original filename to texture userData:', originalFile.name);
    }

    // Check if this is an HDR/EXR or a standard image
    const isHDR = texture.isHDRTexture || 
        (originalFile && (
            originalFile.name.toLowerCase().endsWith('.hdr') || 
            originalFile.name.toLowerCase().endsWith('.exr')
        ));

    // Apply all textures directly to scene.background with equirectangular mapping
    texture.mapping = THREE.EquirectangularReflectionMapping;
    state.scene.background = texture;
    console.log('[DEBUG] Applied texture directly to scene.background');

    // Update the state with the current background texture AND preserve the original file
    updateState({
        backgroundTexture: texture,
        backgroundFile: originalFile || state.backgroundFile // Preserve the original file
    });
    
    console.log('[DEBUG] Updated state with texture and preserved backgroundFile:', 
        originalFile ? originalFile.name : (state.backgroundFile ? state.backgroundFile.name : 'none'));
    
    // Check if the backgroundFile was actually preserved
    const updatedState = getState();
    console.log('[DEBUG] State verification after update:', {
        hasBackgroundFile: updatedState.backgroundFile ? true : false,
        backgroundFileName: updatedState.backgroundFile ? updatedState.backgroundFile.name : 'none',
        hasBackgroundTexture: updatedState.backgroundTexture ? true : false
    });

    // Notify any UI components that need to update
    const event = new CustomEvent('background-updated', { detail: { texture } });
    document.dispatchEvent(event);
} 

/**
 * Toggles the visibility of the background image 
 * @param {boolean} visible - Whether the background should be visible
 */
export function toggleBackgroundVisibility(visible) {
    const state = getState();
    
    if (!state.scene) {
        console.error('Scene not available for background visibility toggle');
        return;
    }
    
    // Get the current background texture from state
    const backgroundTexture = state.backgroundTexture;
    const scene = state.scene;
    
    if (visible) {
        // Show the background - apply the texture if available
        if (backgroundTexture) {
            console.log('[DEBUG] Showing background texture');
            
            // For all textures, set the scene background directly
            scene.background = backgroundTexture;
            console.log('[DEBUG] Restored background texture');
            
            // Dispatch event to notify UI components
            const event = new CustomEvent('background-visibility-changed', { 
                detail: { visible: true, texture: backgroundTexture } 
            });
            document.dispatchEvent(event);
        } else if (state.backgroundFile) {
            // If we have a background file but no texture, try to load it
            console.log('[DEBUG] No texture but have file, reloading background:', 
                state.backgroundFile.name);
            setupBackgroundImage(state.backgroundFile);
        }
    } else {
        // Hide the background
        
        // Save and hide any background
        if (scene.background) {
            if (!scene.userData) scene.userData = {};
            scene.userData.savedBackground = scene.background;
            scene.background = null;
            console.log('[DEBUG] Background hidden');
        }
        
        // Dispatch event to notify UI components
        const event = new CustomEvent('background-visibility-changed', { 
            detail: { visible: false } 
        });
        document.dispatchEvent(event);
    }
} 