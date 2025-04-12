/**
 * Texture Debugger - Materials Management Module
 * 
 * This module handles texture loading, material creation, and related utilities.
 */
import * as THREE from 'three';
import { getState, updateState } from './state.js';

/**
 * Create a PBR material with the loaded textures
 * @returns {THREE.MeshStandardMaterial} The created material
 */
export function createMaterial() {
    const state = getState();
    
    // Set proper texture parameters for all textures
    setupTextureParameters();
    
    // Create a material configuration with available textures
    const materialConfig = {
        roughness: 0.7,
        metalness: 0.2,
        normalScale: new THREE.Vector2(1, 1),
        side: THREE.DoubleSide // Make material double-sided
    };
    
    // Only assign textures that are available
    if (state.textureObjects.baseColor) {
        materialConfig.map = state.textureObjects.baseColor;
        // If base color is available, set a reasonable color for areas that might not have texture
        materialConfig.color = 0xffffff;
    } else {
        // If no base color texture, use a light gray color
        materialConfig.color = 0xcccccc;
    }
    
    if (state.textureObjects.normal) {
        materialConfig.normalMap = state.textureObjects.normal;
    }
    
    if (state.textureObjects.orm) {
        materialConfig.aoMap = state.textureObjects.orm;
        materialConfig.roughnessMap = state.textureObjects.orm;
        materialConfig.metalnessMap = state.textureObjects.orm;
        // When ORM is available, use its full range
        materialConfig.roughness = 1.0;
        materialConfig.metalness = 1.0;
    }
    
    // Create material with properly configured textures
    return new THREE.MeshStandardMaterial(materialConfig);
}

/**
 * Setup texture parameters for all loaded textures
 */
function setupTextureParameters() {
    const state = getState();
    
    if (state.textureObjects.baseColor) {
        state.textureObjects.baseColor.encoding = THREE.sRGBEncoding;
        state.textureObjects.baseColor.wrapS = THREE.RepeatWrapping;
        state.textureObjects.baseColor.wrapT = THREE.RepeatWrapping;
    }
    
    if (state.textureObjects.normal) {
        state.textureObjects.normal.encoding = THREE.LinearEncoding;
        state.textureObjects.normal.wrapS = THREE.RepeatWrapping;
        state.textureObjects.normal.wrapT = THREE.RepeatWrapping;
    }
    
    if (state.textureObjects.orm) {
        state.textureObjects.orm.encoding = THREE.LinearEncoding;
        state.textureObjects.orm.wrapS = THREE.RepeatWrapping;
        state.textureObjects.orm.wrapT = THREE.RepeatWrapping;
    }
}

/**
 * Load texture from file object
 * @param {File} file - The file object containing the texture
 * @param {string} textureType - The type of texture (baseColor, orm, normal)
 * @returns {Promise<THREE.Texture>} Promise resolving to the loaded texture
 */
export function loadTextureFromFile(file, textureType) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const texture = new THREE.TextureLoader().load(e.target.result, (texture) => {
                    // Set texture parameters based on type
                    if (textureType === 'baseColor') {
                        texture.encoding = THREE.sRGBEncoding;
                    } else {
                        texture.encoding = THREE.LinearEncoding;
                    }
                    
                    // Common texture settings for all types
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.flipY = false; // Don't flip Y for GLB compatibility
                    
                    // Store the texture in state
                    const state = getState();
                    state.textureObjects[textureType] = texture;
                    updateState('textureObjects', state.textureObjects);
                    
                    resolve(texture);
                });
            } catch (err) {
                reject(err);
            }
        };
        
        reader.onerror = (err) => {
            reject(err);
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * Check if a texture has transparent pixels
 * @param {HTMLImageElement} image - The image to check for transparency
 * @returns {boolean} True if the image has transparent pixels
 */
export function hasTransparentPixels(image) {
    // Create a canvas to analyze the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    
    // Draw the image on the canvas
    ctx.drawImage(image, 0, 0);
    
    // Get the image data to check for transparency
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // Check if any pixel has alpha < 1.0
    for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] < 255) {
            return true;
        }
    }
    
    return false;
}

/**
 * Apply transparency settings to material based on texture
 * @param {THREE.Material} material - The material to modify
 */
export function applyTransparencySettings(material) {
    const state = getState();
    
    // Only apply transparency if we have a baseColor texture with transparency
    if (state.textureObjects.baseColor && 
        state.textureObjects.baseColor.image && 
        hasTransparentPixels(state.textureObjects.baseColor.image)) {
        material.transparent = true;
        material.alphaTest = 0.1;
        material.alphaMap = state.textureObjects.baseColor;
    }
}

/**
 * Format file size for display
 * @param {number} bytes - The file size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

export default {
    createMaterial,
    loadTextureFromFile,
    hasTransparentPixels,
    applyTransparencySettings,
    formatFileSize
}; 