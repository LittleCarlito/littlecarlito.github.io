/**
 * Texture Debugger - Materials Management Module
 * 
 * This module handles texture loading, material creation, and related utilities.
 */
import * as THREE from 'three';
import { getState, updateState } from '../state.js';

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
        side: THREE.DoubleSide // Make material double-sided
    };
    
    // Apply baseColor texture if available
    if (state.textureObjects.baseColor) {
        materialConfig.map = state.textureObjects.baseColor;
        materialConfig.color = 0xffffff; // White color to let the texture show properly
    } else {
        // If no base color texture, use a light gray color
        materialConfig.color = 0xcccccc;
    }
    
    // Apply normal map if available
    if (state.textureObjects.normal) {
        materialConfig.normalMap = state.textureObjects.normal;
        materialConfig.normalScale = new THREE.Vector2(1, 1);
    }
    
    // Apply ORM texture if available
    if (state.textureObjects.orm) {
        // If we have the ORM texture, apply all its channels
        materialConfig.aoMap = state.textureObjects.orm;
        materialConfig.roughnessMap = state.textureObjects.orm;
        materialConfig.metalnessMap = state.textureObjects.orm;
        // When ORM is available, use its full range
        materialConfig.roughness = 1.0;
        materialConfig.metalness = 1.0;
    } else {
        // If we don't have ORM, use reasonable defaults
        materialConfig.roughness = 0.7;
        materialConfig.metalness = 0.2;
    }
    
    // Create material with properly configured textures
    // Explicitly ensure transparency is disabled
    materialConfig.transparent = false;
    materialConfig.alphaTest = 0;
    
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
 * Placeholder function to maintain compatibility with existing code
 * This function no longer does anything transparency-related
 * @param {HTMLImageElement} image - The image to check
 * @returns {boolean} Always returns false
 */
export function hasTransparentPixels(image) {
    // Always return false to disable transparency
    return false;
}

/**
 * Placeholder function to maintain compatibility with existing code
 * This function no longer does anything transparency-related
 * @param {THREE.Material} material - The material
 * @param {THREE.Mesh} mesh - The mesh
 */
export function applyTransparencySettings(material, mesh) {
    // Explicitly disable transparency
    if (material) {
        material.transparent = false;
        material.alphaTest = 0;
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