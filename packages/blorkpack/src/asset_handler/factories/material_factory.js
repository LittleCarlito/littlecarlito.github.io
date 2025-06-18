import * as THREE from 'three';

const ORM_PATH = "/images/atlas_ORM.jpg";
const NORMAL_PATH = "/images/atlas_Normal.jpg";
const BASE_COLOR_PATH = "/images/atlas_Basecolor.png";

export class MaterialFactory {

    async applyPbrMaterial(incomingAsset) {
        return this.#applyAtlasMaterial(incomingAsset, 'pbr');
    }

    async applyUnlitMaterial(incomingAsset) {
        return this.#applyAtlasMaterial(incomingAsset, 'unlit');
    }

    async #applyAtlasMaterial(incomingAsset, materialType) {
        if (!incomingAsset) {
            throw new Error('Invalid GLB asset - asset is null/undefined');
        }

        const scene = incomingAsset;
        const textureLoader = new THREE.TextureLoader();
        
        const [baseColorTexture, normalTexture, ormTexture] = await Promise.all([
            this.#loadTexture(textureLoader, BASE_COLOR_PATH, 'baseColor'),
            this.#loadTexture(textureLoader, NORMAL_PATH, 'normal'),
            this.#loadTexture(textureLoader, ORM_PATH, 'orm')
        ]);

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
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (texture) => {
                    if (textureType === 'baseColor') {
                        texture.encoding = THREE.sRGBEncoding;
                    } else {
                        texture.encoding = THREE.LinearEncoding;
                    }
                    
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.flipY = false;
                    
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

        if (textureObjects.normal) {
            baseConfig.normalMap = textureObjects.normal;
            baseConfig.normalScale = new THREE.Vector2(1, 1);
        }

        if (materialType === 'pbr') {
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
            baseConfig.renderOrder = 999;
            
            return new THREE.MeshBasicMaterial(baseConfig);
        }

        throw new Error(`Unknown material type: ${materialType}`);
    }
}