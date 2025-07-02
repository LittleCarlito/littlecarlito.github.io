import * as THREE from 'three';

export class MaterialFactory {

    async applyPbrMaterial(incomingAsset, atlasConfig) {
        if (!atlasConfig) {
            throw new Error('Atlas configuration is required for PBR material');
        }
        return this.#applyAtlasMaterial(incomingAsset, 'pbr', atlasConfig);
    }

    async applyUnlitMaterial(incomingAsset, atlasConfig) {
        if (!atlasConfig) {
            throw new Error('Atlas configuration is required for unlit material');
        }
        return this.#applyAtlasMaterial(incomingAsset, 'unlit', atlasConfig);
    }

    async createMaterialFromAtlas(atlasConfig) {
        if (!atlasConfig) {
            throw new Error('Atlas configuration is required');
        }

        const textureLoader = new THREE.TextureLoader();
        
        const texturePromises = [];
        
        if (atlasConfig.baseColor) {
            texturePromises.push(this.#loadTexture(textureLoader, atlasConfig.baseColor, 'baseColor'));
        } else {
            texturePromises.push(Promise.resolve(null));
        }
        
        if (atlasConfig.normal) {
            texturePromises.push(this.#loadTexture(textureLoader, atlasConfig.normal, 'normal'));
        } else {
            texturePromises.push(Promise.resolve(null));
        }
        
        if (atlasConfig.orm) {
            texturePromises.push(this.#loadTexture(textureLoader, atlasConfig.orm, 'orm'));
        } else {
            texturePromises.push(Promise.resolve(null));
        }

        const [baseColorTexture, normalTexture, ormTexture] = await Promise.all(texturePromises);

        const textureObjects = {
            baseColor: baseColorTexture,
            normal: normalTexture,
            orm: ormTexture
        };

        return this.#createAtlasMaterial(textureObjects, 'pbr');
    }

    #resolveTexturePath(path) {
        if (!path) return null;
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        if (!path.startsWith('/') && !path.startsWith('./')) {
            path = './' + path;
        }
        return path;
    }

    async #applyAtlasMaterial(incomingAsset, materialType, atlasConfig) {
        if (!incomingAsset) {
            throw new Error('Invalid GLB asset - asset is null/undefined');
        }
        if (!atlasConfig) {
            throw new Error('Atlas configuration is required');
        }

        const scene = incomingAsset;
        const textureLoader = new THREE.TextureLoader();
        
        const texturePromises = [];
        
        if (atlasConfig.baseColor) {
            texturePromises.push(this.#loadTexture(textureLoader, atlasConfig.baseColor, 'baseColor'));
        } else {
            texturePromises.push(Promise.resolve(null));
        }
        
        if (atlasConfig.normal) {
            texturePromises.push(this.#loadTexture(textureLoader, atlasConfig.normal, 'normal'));
        } else {
            texturePromises.push(Promise.resolve(null));
        }
        
        if (atlasConfig.orm) {
            texturePromises.push(this.#loadTexture(textureLoader, atlasConfig.orm, 'orm'));
        } else {
            texturePromises.push(Promise.resolve(null));
        }

        const [baseColorTexture, normalTexture, ormTexture] = await Promise.all(texturePromises);

        const textureObjects = {
            baseColor: baseColorTexture,
            normal: normalTexture,
            orm: ormTexture
        };

        const meshes = [];
        scene.traverse(node => {
            if (node.isMesh) {
                if (node.name.startsWith('col_')) {
                    node.visible = false;
                    return;
                }

                const originalMaterial = node.material;
                const atlasMaterial = this.#createAtlasMaterial(textureObjects, materialType);
                
                if (originalMaterial && originalMaterial.map && atlasMaterial.map) {
                    atlasMaterial.map.offset.copy(originalMaterial.map.offset);
                    atlasMaterial.map.repeat.copy(originalMaterial.map.repeat);
                    atlasMaterial.map.rotation = originalMaterial.map.rotation;
                }

                if (materialType === 'pbr' && ormTexture && !node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                    node.geometry.attributes.uv2 = node.geometry.attributes.uv;
                }

                node.material = atlasMaterial;
                meshes.push(node);
                node.userData.meshId = meshes.length - 1;
            }
        });

        return {
            asset: scene,
            meshes: meshes,
            textureObjects: textureObjects
        };
    }

    async #loadTexture(loader, path, textureType) {
        const resolvedPath = this.#resolveTexturePath(path);
        if (!resolvedPath) return null;

        return new Promise((resolve, reject) => {
            loader.load(
                resolvedPath,
                (texture) => {
                    if (textureType === 'baseColor') {
                        texture.colorSpace = THREE.SRGBColorSpace;
                    } else {
                        texture.colorSpace = THREE.LinearSRGBColorSpace;
                    }
                    
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.flipY = false;
                    
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.warn(`Failed to load texture ${path}:`, error);
                    resolve(null);
                }
            );
        });
    }

    #createAtlasMaterial(textureObjects, materialType) {
        const baseConfig = {
            side: THREE.DoubleSide
        };

        if (textureObjects.baseColor) {
            baseConfig.map = textureObjects.baseColor;
            baseConfig.color = 0xffffff;
        } else {
            baseConfig.color = 0xcccccc;
        }

        if (materialType === 'pbr') {
            if (textureObjects.normal) {
                baseConfig.normalMap = textureObjects.normal;
                baseConfig.normalScale = new THREE.Vector2(1, 1);
            }

            if (textureObjects.orm) {
                baseConfig.aoMap = textureObjects.orm;
                baseConfig.roughnessMap = textureObjects.orm;
                baseConfig.metalnessMap = textureObjects.orm;
                baseConfig.roughness = 1.0;
                baseConfig.metalness = 1.0;
            } else {
                baseConfig.roughness = 0.7;
                baseConfig.metalness = 0.2;
            }
            
            baseConfig.transparent = false;
            baseConfig.alphaTest = 0;
            
            return new THREE.MeshStandardMaterial(baseConfig);
        } else if (materialType === 'unlit') {
            baseConfig.transparent = true;
            baseConfig.depthTest = false;
            
            return new THREE.MeshBasicMaterial(baseConfig);
        }

        throw new Error(`Unknown material type: ${materialType}`);
    }
}