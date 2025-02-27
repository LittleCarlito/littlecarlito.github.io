import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Texture Atlas Manager for efficient texture handling
export class TextureAtlasManager {
    constructor(options = {}) {
        this.maxAtlasSize = options.maxAtlasSize || 4096;
        this.padding = options.padding || 2;
        this.textureMap = new Map();
        this.atlases = new Map();
    }

    async createAtlas(textures, type = 'diffuse') {
        // Sort textures by size for better packing
        const sortedTextures = [...textures].sort((a, b) => {
            const aSize = a.image ? (a.image.width * a.image.height) : 0;
            const bSize = b.image ? (b.image.width * b.image.height) : 0;
            return bSize - aSize;
        });

        // Create canvas for the atlas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // First pass: calculate required atlas size
        let currentX = 0;
        let currentY = 0;
        let rowHeight = 0;
        let atlasWidth = 0;
        let atlasHeight = 0;

        for (const texture of sortedTextures) {
            if (!texture.image) continue;

            const width = texture.image.width + this.padding * 2;
            const height = texture.image.height + this.padding * 2;

            if (currentX + width > this.maxAtlasSize) {
                currentX = 0;
                currentY += rowHeight;
                rowHeight = 0;
            }

            rowHeight = Math.max(rowHeight, height);
            atlasWidth = Math.max(atlasWidth, currentX + width);
            atlasHeight = Math.max(atlasHeight, currentY + height);

            currentX += width;
        }

        // Ensure power of two dimensions
        canvas.width = THREE.MathUtils.ceilPowerOfTwo(atlasWidth);
        canvas.height = THREE.MathUtils.ceilPowerOfTwo(atlasHeight);

        // Second pass: draw textures and store UV coordinates
        currentX = 0;
        currentY = 0;
        rowHeight = 0;

        for (const texture of sortedTextures) {
            if (!texture.image) continue;

            const width = texture.image.width;
            const height = texture.image.height;

            if (currentX + width + this.padding * 2 > this.maxAtlasSize) {
                currentX = 0;
                currentY += rowHeight;
                rowHeight = 0;
            }

            // Draw texture to atlas with padding
            ctx.drawImage(
                texture.image,
                currentX + this.padding,
                currentY + this.padding,
                width,
                height
            );

            // Store UV coordinates
            const uvs = {
                x: (currentX + this.padding) / canvas.width,
                y: (currentY + this.padding) / canvas.height,
                width: width / canvas.width,
                height: height / canvas.height
            };
            this.textureMap.set(texture.uuid, uvs);

            rowHeight = Math.max(rowHeight, height + this.padding * 2);
            currentX += width + this.padding * 2;
        }

        // Create Three.js texture from atlas
        const atlasTexture = new THREE.CanvasTexture(canvas);
        atlasTexture.flipY = false;
        this.atlases.set(type, atlasTexture);

        return atlasTexture;
    }

    getTextureUVs(textureUUID) {
        return this.textureMap.get(textureUUID);
    }

    getAtlas(type = 'diffuse') {
        return this.atlases.get(type);
    }

    dispose() {
        this.atlases.forEach(atlas => atlas.dispose());
        this.atlases.clear();
        this.textureMap.clear();
    }
}

// Asset Manager for efficient resource loading and caching
export class AssetManager {
    constructor() {
        this.loadedAssets = new Map();
        this.loadingPromises = new Map();
        this.materialCache = new Map();
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
    }

    async loadTexture(url) {
        if (this.loadedAssets.has(url)) {
            return this.loadedAssets.get(url);
        }

        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url);
        }

        const loadPromise = new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    this.loadedAssets.set(url, texture);
                    this.loadingPromises.delete(url);
                    resolve(texture);
                },
                undefined,
                reject
            );
        });

        this.loadingPromises.set(url, loadPromise);
        return loadPromise;
    }

    async loadModel(url) {
        if (this.loadedAssets.has(url)) {
            return this.loadedAssets.get(url).scene.clone();
        }

        if (this.loadingPromises.has(url)) {
            const gltf = await this.loadingPromises.get(url);
            return gltf.scene.clone();
        }

        const loadPromise = new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    this.loadedAssets.set(url, gltf);
                    this.loadingPromises.delete(url);
                    resolve(gltf);
                },
                undefined,
                reject
            );
        });

        this.loadingPromises.set(url, loadPromise);
        const gltf = await loadPromise;
        return gltf.scene.clone();
    }

    getMaterial(key, template) {
        if (!this.materialCache.has(key)) {
            const material = new THREE.MeshStandardMaterial({
                map: template.map,
                color: template.color,
                transparent: template.transparent,
                opacity: template.opacity,
                side: template.side,
                roughness: template.roughness || 1.0,
                metalness: template.metalness || 0.0
            });
            this.materialCache.set(key, material);
        }
        return this.materialCache.get(key).clone();
    }

    dispose() {
        this.loadedAssets.forEach(asset => {
            if (asset.dispose) asset.dispose();
            if (asset.scene) {
                asset.scene.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        });
        
        this.materialCache.forEach(material => material.dispose());
        
        this.loadedAssets.clear();
        this.loadingPromises.clear();
        this.materialCache.clear();
    }
}

// Memory Manager for tracking and optimizing memory usage
export class MemoryManager {
    constructor() {
        this.tracked = new Set();
        this.stats = {
            geometries: 0,
            textures: 0,
            materials: 0,
            objects: 0
        };
    }

    track(object) {
        if (this.tracked.has(object)) return;

        this.tracked.add(object);
        this.stats.objects++;

        object.traverse(child => {
            if (child.geometry) this.stats.geometries++;
            if (child.material) {
                if (Array.isArray(child.material)) {
                    this.stats.materials += child.material.length;
                    child.material.forEach(m => {
                        if (m.map) this.stats.textures++;
                    });
                } else {
                    this.stats.materials++;
                    if (child.material.map) this.stats.textures++;
                }
            }
        });
    }

    untrack(object) {
        if (!this.tracked.has(object)) return;

        this.tracked.delete(object);
        this.stats.objects--;

        object.traverse(child => {
            if (child.geometry) this.stats.geometries--;
            if (child.material) {
                if (Array.isArray(child.material)) {
                    this.stats.materials -= child.material.length;
                    child.material.forEach(m => {
                        if (m.map) this.stats.textures--;
                    });
                } else {
                    this.stats.materials--;
                    if (child.material.map) this.stats.textures--;
                }
            }
        });
    }

    getStats() {
        return { ...this.stats };
    }

    dispose(object) {
        this.untrack(object);
        object.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        });
    }
} 