import * as THREE from 'three';

const ORM_PATH = "/images/atlas_ORM.jpg";
const NORMAL_PATH = "/images/atlas_Normal.jpg";
const BASE_COLOR_PATH = "/images/atlas_Basecolor.png";

export async function apply_material(incomingAsset) {
    // Handle Three.js Object3D/Group directly (most common case from your caller)
    if (!incomingAsset) {
        throw new Error('Invalid GLB asset - asset is null/undefined');
    }
    
    // Since your caller passes the model directly (Three.js Object3D/Group),
    // we can use it directly as the scene
    const scene = incomingAsset;

    // Load all atlas textures
    const textureLoader = new THREE.TextureLoader();
    
    const [baseColorTexture, normalTexture, ormTexture] = await Promise.all([
        loadTexture(textureLoader, BASE_COLOR_PATH, 'baseColor'),
        loadTexture(textureLoader, NORMAL_PATH, 'normal'),
        loadTexture(textureLoader, ORM_PATH, 'orm')
    ]);

    // Store textures for material creation
    const textureObjects = {
        baseColor: baseColorTexture,
        normal: normalTexture,
        orm: ormTexture
    };

    // Extract meshes and apply atlas materials
    const meshes = [];
    scene.traverse(node => {
        if (node.isMesh) {
            // Store original material for UV transformation preservation
            const originalMaterial = node.material;
            
            // Create new atlas-based material
            const atlasMaterial = createAtlasMaterial(textureObjects);
            
            // Preserve original UV transformations if they exist
            if (originalMaterial && originalMaterial.map && atlasMaterial.map) {
                atlasMaterial.map.offset.copy(originalMaterial.map.offset);
                atlasMaterial.map.repeat.copy(originalMaterial.map.repeat);
                atlasMaterial.map.rotation = originalMaterial.map.rotation;
            }

            // Ensure UV2 exists for ORM textures (Three.js requirement for AO maps)
            if (ormTexture && !node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                node.geometry.attributes.uv2 = node.geometry.attributes.uv;
            }

            // Apply the new material
            node.material = atlasMaterial;
            meshes.push(node);
            node.userData.meshId = meshes.length - 1;
        }
    });

    return {
        asset: scene, // Return the modified scene directly
        meshes: meshes,
        textureObjects: textureObjects
    };
}

/**
 * Load texture with proper configuration based on type
 * @param {THREE.TextureLoader} loader - The texture loader
 * @param {string} path - Path to texture file
 * @param {string} textureType - Type of texture ('baseColor', 'normal', 'orm')
 * @returns {Promise<THREE.Texture>} Configured texture
 */
async function loadTexture(loader, path, textureType) {
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (texture) => {
                // Set encoding based on texture type
                if (textureType === 'baseColor') {
                    texture.encoding = THREE.sRGBEncoding; // Gamma-corrected for color
                } else {
                    texture.encoding = THREE.LinearEncoding; // Linear for normal/ORM
                }
                
                // Configure for GLB compatibility
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.flipY = false; // Critical: Don't flip Y for GLB compatibility
                
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error(`Failed to load texture ${path}:`, error);
                reject(error);
            }
        );
    });
}

/**
 * Create PBR material with atlas textures
 * @param {Object} textureObjects - Object containing loaded textures
 * @returns {THREE.MeshStandardMaterial} Configured PBR material
 */
function createAtlasMaterial(textureObjects) {
    const materialConfig = {
        side: THREE.DoubleSide // Double-sided rendering
    };
    
    // Base Color Channel (UV1)
    if (textureObjects.baseColor) {
        materialConfig.map = textureObjects.baseColor;
        materialConfig.color = 0xffffff; // White multiplier for proper atlas colors
    } else {
        materialConfig.color = 0xcccccc; // Light gray fallback
    }
    
    // Normal Map Channel (UV1)
    if (textureObjects.normal) {
        materialConfig.normalMap = textureObjects.normal;
        materialConfig.normalScale = new THREE.Vector2(1, 1);
    }
    
    // ORM Atlas Channel (UV2)
    if (textureObjects.orm) {
        materialConfig.aoMap = textureObjects.orm;        // Red channel
        materialConfig.roughnessMap = textureObjects.orm; // Green channel
        materialConfig.metalnessMap = textureObjects.orm; // Blue channel
        materialConfig.roughness = 1.0;  // Full range utilization
        materialConfig.metalness = 1.0;  // Full range utilization
    } else {
        // Fallback values when no ORM texture
        materialConfig.roughness = 0.7;
        materialConfig.metalness = 0.2;
    }
    
    // Disable transparency
    materialConfig.transparent = false;
    materialConfig.alphaTest = 0;
    
    return new THREE.MeshStandardMaterial(materialConfig);
}