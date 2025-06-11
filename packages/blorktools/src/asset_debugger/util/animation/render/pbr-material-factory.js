import * as THREE from 'three';
import { getState, updateState } from '../../state/scene-state.js';

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


