import * as THREE from 'three';

export class MaterialFactory {
    static #colorPool = [
        0xFF0080, // Hot Pink
        0x00FF80, // Spring Green
        0x8000FF, // Electric Purple
        0xFF8000, // Orange
        0x0080FF, // Dodger Blue
        0xFF0040, // Deep Pink
        0x40FF00, // Lime Green
        0x0040FF, // Blue
        0xFF4000, // Red Orange
        0x4000FF, // Blue Violet
        0x00FF40, // Green
        0xFF00C0, // Magenta
        0xC0FF00, // Yellow Green
        0x00C0FF, // Sky Blue
        0xFF00FF, // Fuchsia
        0xFFFF00, // Yellow
        0x00FFFF, // Cyan
        0xFF4080, // Rose
        0x80FF40, // Light Green
        0x4080FF  // Cornflower Blue
    ];
    static #usedColors = new Set();

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

    createCollisionWireframeMaterial() {
        const color = this.#getNextDebugColor();
        
        return new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false
        });
    }

    #getNextDebugColor() {
        if (MaterialFactory.#usedColors.size >= MaterialFactory.#colorPool.length) {
            MaterialFactory.#usedColors.clear();
        }
        
        let availableColors = MaterialFactory.#colorPool.filter(color => 
            !MaterialFactory.#usedColors.has(color)
        );
        
        if (availableColors.length === 0) {
            availableColors = [...MaterialFactory.#colorPool];
            MaterialFactory.#usedColors.clear();
        }
        
        const randomIndex = Math.floor(Math.random() * availableColors.length);
        const selectedColor = availableColors[randomIndex];
        
        MaterialFactory.#usedColors.add(selectedColor);
        
        return selectedColor;
    }

    static resetColorPool() {
        MaterialFactory.#usedColors.clear();
    }

    static getUsedColorsCount() {
        return MaterialFactory.#usedColors.size;
    }

    static getTotalColorsCount() {
        return MaterialFactory.#colorPool.length;
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
        const collisionMeshes = [];
        scene.traverse(node => {
            if (node.isMesh) {
                if (node.name.startsWith('col_')) {
                    node.material = this.createCollisionWireframeMaterial();
                    node.visible = false;
                    node.userData.meshId = meshes.length;
                    node.userData.isCollisionMesh = true;
                    collisionMeshes.push(node);
                    meshes.push(node);
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

        if (collisionMeshes.length > 0) {
            this.#addCollisionWireframeMethods(scene, collisionMeshes);
        }

        return {
            asset: scene,
            meshes: meshes,
            textureObjects: textureObjects
        };
    }

    #addCollisionWireframeMethods(asset, collisionMeshes) {
        asset.userData.collisionWireframes = collisionMeshes;
        asset.userData.collisionWireframesEnabled = false;

        asset.userData.enableCollisionWireframes = () => {
            collisionMeshes.forEach(mesh => {
                mesh.visible = true;
            });
            asset.userData.collisionWireframesEnabled = true;
        };

        asset.userData.disableCollisionWireframes = () => {
            collisionMeshes.forEach(mesh => {
                mesh.visible = false;
            });
            asset.userData.collisionWireframesEnabled = false;
        };

        asset.userData.toggleCollisionWireframes = () => {
            if (asset.userData.collisionWireframesEnabled) {
                asset.userData.disableCollisionWireframes();
            } else {
                asset.userData.enableCollisionWireframes();
            }
        };

        asset.userData.areCollisionWireframesEnabled = () => {
            return asset.userData.collisionWireframesEnabled;
        };

        asset.userData.getCollisionWireframeCount = () => {
            return collisionMeshes.length;
        };

        asset.userData.updateCollisionWireframes = () => {
            collisionMeshes.forEach(mesh => {
                if (mesh.material && mesh.material.needsUpdate) {
                    mesh.material.needsUpdate = true;
                }
            });
        };

        asset.userData.setCollisionWireframeColor = (color) => {
            collisionMeshes.forEach(mesh => {
                if (mesh.material) {
                    mesh.material.color.setHex(color);
                }
            });
        };

        asset.userData.setCollisionWireframeOpacity = (opacity) => {
            collisionMeshes.forEach(mesh => {
                if (mesh.material) {
                    mesh.material.opacity = Math.max(0, Math.min(1, opacity));
                }
            });
        };

        asset.userData.disposeCollisionWireframes = () => {
            collisionMeshes.forEach(mesh => {
                if (mesh.material) {
                    mesh.material.dispose();
                }
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
            });
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
            
            if (textureObjects.baseColor) {
                baseConfig.transparent = true;
                baseConfig.alphaTest = 0.01;
            } else {
                baseConfig.transparent = false;
                baseConfig.alphaTest = 0;
            }
            
            return new THREE.MeshStandardMaterial(baseConfig);
        } else if (materialType === 'unlit') {
            baseConfig.transparent = true;
            baseConfig.depthTest = false;
            
            return new THREE.MeshBasicMaterial(baseConfig);
        }

        throw new Error(`Unknown material type: ${materialType}`);
    }
}