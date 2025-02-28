import { RAPIER, THREE } from "..";
import { TYPES } from "../../viewport/overlay/overlay_common";
import { FLAGS } from "../flags";
import { TextureAtlasManager } from '../texture_atlas_manager';
import { AssetStorage } from './asset_storage';
import { ASSET_TYPE, ASSET_CONFIGS } from './asset_type';

/**
 * Generates triangle indices for a geometry that doesn't have them
 * @param {THREE.BufferGeometry} geometry - The geometry to generate indices for
 * @returns {Uint32Array} The generated indices
 */
function generateIndices(geometry) {
    const vertexCount = geometry.attributes.position.count;
    const indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
    }
    return indices;
}

/**
 * Class responsible for spawning and managing 3D assets in the scene.
 * Handles both static and dynamic (physics-enabled) assets, texture atlasing,
 * and material optimization.
 */
export class AssetSpawner {
    static instance = null;
    static instance_counter = 0;
    name = "[AssetSpawner]";
    textureAtlasManager = TextureAtlasManager.getInstance();
    pendingTextures = new Map(); // Track textures waiting to be atlased
    debugMeshes = new Map(); // Store debug wireframe meshes
    debugColorIndex = 0; // Counter for cycling through debug colors
    
    constructor() {
        if (AssetSpawner.instance) {
            return AssetSpawner.instance;
        }
        this.storage = AssetStorage.get_instance();
        this.textureAtlasManager = TextureAtlasManager.getInstance();
        this.pendingTextures = new Map(); // Track textures waiting to be atlased
        this.debugMeshes = new Map(); // Store debug wireframe meshes
        this.debugColorIndex = 0; // Counter for cycling through debug colors
        AssetSpawner.instance = this;
    }

    /**
     * Gets or creates the singleton instance of AssetSpawner.
     * @returns {AssetSpawner} The singleton instance.
     */
    static get_instance() {
        if (!AssetSpawner.instance) {
            AssetSpawner.instance = new AssetSpawner();
        }
        return AssetSpawner.instance;
    }

    /**
     * Processes textures for a mesh and creates a texture atlas.
     * @param {THREE.Mesh|THREE.Object3D} mesh - The mesh whose textures need to be processed.
     * @returns {Promise<THREE.Texture|null>} The created texture atlas or null if no textures found.
     */
    async processTexturesForAtlas(mesh) {
        const textures = new Set();
        mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (material.map) textures.add(material.map);
                });
            }
        });
        if (textures.size === 0) return null;
        // Create atlas if we have enough textures or if we're forced to
        if (textures.size > 0) {
            const atlas = await this.textureAtlasManager.createAtlas(Array.from(textures));
            // Update all materials to use the atlas
            mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        if (material.map) {
                            this.textureAtlasManager.updateMaterialWithAtlas(child, atlas, material.map);
                        }
                    });
                }
            });
            return atlas;
        }
        return null;
    }

    /**
     * Creates a debug wireframe mesh for a collider
     * @param {string} type - Type of collider ('cuboid', 'trimesh', 'sphere')
     * @param {Object} dimensions - Dimensions of the collider
     * @param {THREE.Vector3} position - Position of the collider
     * @param {THREE.Quaternion} rotation - Rotation of the collider
     * @returns {THREE.Mesh} The debug wireframe mesh
     */
    createDebugWireframe(type, dimensions, position, rotation) {
        if (!FLAGS.COLLISION_VISUAL_DEBUG) return null;

        // Array of bright, distinct colors for debug meshes
        const debugColors = [
            0xff0000, // Red
            0x00ff00, // Green
            0x0000ff, // Blue
            0xff00ff, // Magenta
            0xffff00, // Yellow
            0x00ffff, // Cyan
            0xff8000, // Orange
            0x8000ff, // Purple
        ];

        // Cycle through colors
        const color = debugColors[this.debugColorIndex % debugColors.length];
        this.debugColorIndex++;

        let geometry;
        switch (type) {
            case 'cuboid':
                geometry = new THREE.BoxGeometry(
                    dimensions.width * 2,
                    dimensions.height * 2,
                    dimensions.depth * 2
                );
                break;
            case 'trimesh':
                geometry = dimensions.geometry.clone();
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(dimensions.radius);
                break;
            default:
                console.warn('Unknown debug wireframe type:', type);
                return null;
        }

        const material = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            depthTest: true,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        if (rotation) {
            mesh.quaternion.copy(rotation);
        }
        mesh.renderOrder = 999; // Ensure wireframe renders on top

        return mesh;
    }

    /**
     * Spawns a physics-enabled asset of the specified type.
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum.
     * @param {THREE.Object3D} parent - Parent object to add the mesh to.
     * @param {RAPIER.World} world - Physics world to create the body in.
     * @param {Object} options - Additional options (e.g., color for cubes).
     * @param {THREE.Vector3} position_offset - Position offset from parent.
     * @returns {Promise<Array>} Promise resolving to [mesh, body] pair for physics updates.
     */
    async spawn_asset(asset_type, parent, world, options = {}, position_offset = new THREE.Vector3(0, 0, 0)) {
        try {
            if (!Object.values(ASSET_TYPE).includes(asset_type)) {
                throw new Error(`Invalid asset type: ${asset_type}`);
            }
            const asset_config = ASSET_CONFIGS[asset_type];
            let mesh;
            // Create physics body first
            const body = world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(position_offset.x, position_offset.y, position_offset.z)
                    .setLinearDamping(0.5)  // Add damping to reduce bouncing
                    .setAngularDamping(0.5) // Add angular damping to reduce spinning
                    .setCanSleep(true)      // Allow the body to sleep when it comes to rest
            );

            if(FLAGS.ASSET_LOGS) console.log(`Created rigid body for ${asset_type}:`, body);
            if (asset_type === ASSET_TYPE.CUBE) {
                mesh = new THREE.Mesh(
                    asset_config.geometry,
                    asset_config.create_material(options.color || 0xffffff)
                );
                mesh.position.copy(position_offset);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                // Add name for cube using the category value
                mesh.name = `${TYPES.INTERACTABLE}${options.category}`;
                if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating cube with name: ${mesh.name}, category: ${options.category}`);
                const collider = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
                    .setMass(asset_config.mass)
                    .setRestitution(0.3)     // Lower restitution to reduce bouncing
                    .setFriction(0.8)        // Higher friction to help objects settle
                    .setCollisionGroups(0x00010001);  // Set collision groups to reduce checks
                const created_collider = world.createCollider(collider, body);
                if(FLAGS.ASSET_LOGS) console.log(`Created cube collider:`, created_collider);

                // Add debug wireframe if enabled
                if (FLAGS.COLLISION_VISUAL_DEBUG) {
                    const debugMesh = this.createDebugWireframe(
                        'cuboid',
                        { width: 0.5, height: 0.5, depth: 0.5 },
                        mesh.position,
                        mesh.quaternion
                    );
                    if (debugMesh) {
                        parent.add(debugMesh);
                        // Store debug mesh with a unique key
                        const debugKey = `${mesh.uuid}_debug`;
                        this.debugMeshes.set(debugKey, {
                            mesh: debugMesh,
                            body: body,
                            type: 'cube'
                        });
                    }
                }

                // Add to parent
                parent.add(mesh);
                return [mesh, body];
            } else {
                // Normal GLB asset loading path
                if (!this.storage.has_loaded_asset(asset_type)) await this.storage.load_asset_type(asset_type);
                const gltf = this.storage.get_loaded_asset(asset_type);
                mesh = gltf.scene.clone();
                mesh.position.copy(position_offset);
                mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
                // Process textures for atlasing before material optimization
                await this.processTexturesForAtlas(mesh);
                // Look for ALL collision meshes using the 'col_' prefix
                let collision_meshes = [];
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        if (child.name.startsWith('col_')) {
                            collision_meshes.push(child);
                            child.visible = false;  // Hide collision mesh
                            if(FLAGS.ASSET_LOGS) console.log(`Found collision mesh for ${asset_type}:`, {
                                name: child.name,
                                vertices: child.geometry.attributes.position.count,
                                hasIndices: !!child.geometry.index,
                                position: child.position,
                                scale: asset_config.scale
                            });
                        } else {
                            const originalMaterial = child.material;
                            // Create a unique key based on the material's essential properties
                            const materialKey = `${asset_type}_${child.name}_${!!originalMaterial.map}_${originalMaterial.color?.getHex() || 0}`;
                            // Get cached or new material
                            child.material = this.storage.get_material(materialKey, originalMaterial);
                            // Clean up original material if it exists
                            if (originalMaterial) {
                                if (originalMaterial.roughnessMap) originalMaterial.roughnessMap.dispose();
                                if (originalMaterial.metalnessMap) originalMaterial.metalnessMap.dispose();
                                if (originalMaterial.normalMap) originalMaterial.normalMap.dispose();
                                if (originalMaterial.bumpMap) originalMaterial.bumpMap.dispose();
                                if (originalMaterial.envMap) originalMaterial.envMap.dispose();
                                if (originalMaterial.alphaMap) originalMaterial.alphaMap.dispose();
                                if (originalMaterial.aoMap) originalMaterial.aoMap.dispose();
                                if (originalMaterial.displacementMap) originalMaterial.displacementMap.dispose();
                                originalMaterial.dispose();
                            }
                            child.material.needsUpdate = true;
                            child.name = `${TYPES.INTERACTABLE}${asset_config.name}`;
                            child.castShadow = true;
                        }
                    }
                });
                // Create physics body with all collision meshes if found
                if (collision_meshes.length > 0) {
                    if(FLAGS.ASSET_LOGS) console.log(`Creating compound collider for ${asset_type} with ${collision_meshes.length} collision meshes`);
                    // Create colliders for each collision mesh
                    collision_meshes.forEach((collision_mesh) => {
                        const geometry = collision_mesh.geometry;
                        // Scale the vertices by the asset's scale
                        const originalVertices = geometry.attributes.position.array;
                        const scaledVertices = new Float32Array(originalVertices.length);
                        for (let i = 0; i < originalVertices.length; i++) {
                            scaledVertices[i] = originalVertices[i] * asset_config.scale;
                        }
                        const indices = geometry.index ? geometry.index.array : generateIndices(geometry);
                        if(FLAGS.ASSET_LOGS) console.log(`Creating collider component for ${collision_mesh.name}:`, {
                            vertexCount: scaledVertices.length / 3,
                            indexCount: indices ? indices.length : 'none',
                            scale: asset_config.scale,
                            position: collision_mesh.position
                        });
                        // Always use trimesh for static collision meshes
                        const collider = RAPIER.ColliderDesc.trimesh(scaledVertices, indices)
                            .setMass(asset_config.mass)
                            .setRestitution(0.3)     // Lower restitution to reduce bouncing
                            .setFriction(0.8)        // Higher friction to help objects settle
                            .setCollisionGroups(0x00010001);  // Set collision groups to reduce checks
                        // Get the collision mesh's position relative to the model
                        const meshPosition = new THREE.Vector3();
                        collision_mesh.getWorldPosition(meshPosition);
                        const relativePosition = meshPosition.sub(mesh.position);
                        // Apply the relative position to the collider
                        collider.setTranslation(
                            relativePosition.x * asset_config.scale,
                            relativePosition.y * asset_config.scale,
                            relativePosition.z * asset_config.scale
                        );
                        const created_collider = world.createCollider(collider, body);

                        // Add debug wireframe if enabled
                        if (FLAGS.COLLISION_VISUAL_DEBUG) {
                            const debugMesh = this.createDebugWireframe(
                                'trimesh',
                                { geometry: collision_mesh.geometry },
                                meshPosition,
                                collision_mesh.quaternion
                            );
                            if (debugMesh) {
                                // Scale the debug mesh to match the asset scale
                                debugMesh.scale.multiplyScalar(asset_config.scale);
                                parent.add(debugMesh);
                                // Store debug mesh with a unique key
                                const debugKey = `${collision_mesh.uuid}_debug`;
                                this.debugMeshes.set(debugKey, {
                                    mesh: debugMesh,
                                    body: body,
                                    type: 'trimesh'
                                });
                            }
                        }
                    });
                } else {
                    if(FLAGS.ASSET_LOGS) console.warn(`No collision mesh found for ${asset_type}, falling back to bounding box`);
                    let geometry;
                    mesh.traverse((child) => {
                        if (child.isMesh && !child.name.startsWith('col_')) geometry = child.geometry;
                    });
                    if (geometry) {
                        geometry.computeBoundingBox();
                        const bounding_box = geometry.boundingBox;
                        const dimensions = new THREE.Vector3();
                        bounding_box.getSize(dimensions);

                        const half_width = (dimensions.x * asset_config.scale) / 2;
                        const half_height = (dimensions.y * asset_config.scale) / 2;
                        const half_depth = (dimensions.z * asset_config.scale) / 2;

                        const collider = RAPIER.ColliderDesc.cuboid(half_width, half_height, half_depth)
                            .setMass(asset_config.mass)
                            .setRestitution(0.3)     // Lower restitution to reduce bouncing
                            .setFriction(0.8)        // Higher friction to help objects settle
                            .setCollisionGroups(0x00010001);  // Set collision groups to reduce checks

                        const created_collider = world.createCollider(collider, body);

                        // Add debug wireframe if enabled
                        if (FLAGS.COLLISION_VISUAL_DEBUG) {
                            const debugMesh = this.createDebugWireframe(
                                'cuboid',
                                { 
                                    width: half_width,
                                    height: half_height,
                                    depth: half_depth
                                },
                                mesh.position,
                                mesh.quaternion
                            );
                            if (debugMesh) {
                                parent.add(debugMesh);
                                // Store debug mesh with a unique key
                                const debugKey = `${mesh.uuid}_debug`;
                                this.debugMeshes.set(debugKey, {
                                    mesh: debugMesh,
                                    body: body,
                                    type: 'boundingBox'
                                });
                            }
                        }

                        if(FLAGS.ASSET_LOGS) console.log(`Created bounding box collider:`, created_collider);
                        if(FLAGS.ASSET_LOGS) console.log(`Collider dimensions:`, {
                            width: half_width,
                            height: half_height,
                            depth: half_depth,
                            mass: asset_config.mass,
                            restitution: asset_config.restitution
                        });
                    }
                }
            }
            // Add mesh to parent
            parent.add(mesh);
            // Generate a truly unique ID using counter instead of timestamp
            const instance_id = `${asset_type}_${this.get_new_instance_id()}`;
            const body_pair = [mesh, body];
            this.storage.store_dynamic_body(instance_id, body_pair);
            // Add the instance_id to the mesh's userData for reference
            mesh.userData.instance_id = instance_id;
            return body_pair;
        } catch (error) {
            console.error(`Error in spawn_asset for ${asset_type}:`, error);
            return null;
        }
    }

    /**
     * Creates a static (non-physics) mesh of the specified asset type.
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum.
     * @param {THREE.Object3D} parent - Parent object to add the mesh to.
     * @param {THREE.Vector3} position_offset - Position offset from parent.
     * @param {THREE.Euler|null} rotation - Optional rotation to apply to the mesh.
     * @returns {Promise<THREE.Object3D>} Promise resolving to the created mesh.
     */
    async create_static_mesh(asset_type, parent, position_offset = new THREE.Vector3(0, 0, 0), rotation = null) {
        if (!Object.values(ASSET_TYPE).includes(asset_type)) throw new Error(`Invalid asset type: ${asset_type}`);
        const asset_config = ASSET_CONFIGS[asset_type];
        let mesh;
        if (asset_type === ASSET_TYPE.CUBE) {
            mesh = new THREE.Mesh(asset_config.geometry, asset_config.create_material(0xffffff));
            mesh.castShadow = true;
        } else {
            if (!this.storage.has_loaded_asset(asset_type)) await this.storage.load_asset_type(asset_type);
            const gltf = this.storage.get_loaded_asset(asset_type);
            mesh = gltf.scene.clone();
            mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
            
            if(FLAGS.ASSET_LOGS) console.log('Creating static mesh for UI:', {
                assetType: asset_type,
                parentType: parent.type,
                parentName: parent.name,
                isOverlay: parent.parent?.parent?.name?.includes('overlay')
            });
            mesh.traverse((child) => {
                if (child.isMesh) {
                    if(FLAGS.ASSET_LOGS) console.log('Original material properties:', {
                        hasMap: !!child.material.map,
                        color: child.material.color,
                        type: child.material.type
                    });
                    // Force UI rendering properties
                    child.material = new THREE.MeshBasicMaterial({
                        map: child.material.map,
                        color: child.material.color,
                        transparent: true,
                        depthTest: false,
                        side: THREE.DoubleSide,
                        opacity: 1
                    });
                    child.renderOrder = 999; // Ensure it renders on top
                    if(FLAGS.ASSET_LOGS) console.log('New material properties:', {
                        hasMap: !!child.material.map,
                        color: child.material.color,
                        type: child.material.type,
                        transparent: child.material.transparent,
                        depthTest: child.material.depthTest,
                        renderOrder: child.renderOrder
                    });
                }
            });
        }
        mesh.position.copy(position_offset);
        if (rotation) mesh.rotation.copy(rotation);
        mesh.renderOrder = 999;
        parent.add(mesh);
        const instance_id = `${asset_type}_static_${Date.now()}`;
        this.storage.store_static_mesh(instance_id, mesh);
        return mesh;
    }

    /**
     * Updates the positions and rotations of debug wireframes to match their physics bodies
     * Should be called each frame during the physics update
     */
    update_debug_wireframes() {
        if (!FLAGS.COLLISION_VISUAL_DEBUG) return;

        this.debugMeshes.forEach((debugData) => {
            if (debugData.mesh && debugData.body) {
                const position = debugData.body.translation();
                const rotation = debugData.body.rotation();
                
                debugData.mesh.position.set(position.x, position.y, position.z);
                debugData.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
    }

    /**
     * Cleans up resources used by the AssetSpawner.
     * Disposes of textures and clears caches.
     */
    cleanup() {
        this.storage.cleanup();
        this.textureAtlasManager.dispose();
        // Clean up debug meshes
        this.debugMeshes.forEach((debugData) => {
            if (debugData.mesh) {
                debugData.mesh.geometry.dispose();
                debugData.mesh.material.dispose();
                debugData.mesh.parent?.remove(debugData.mesh);
            }
        });
        this.debugMeshes.clear();
    }

    // Getters and Setters

    get_new_instance_id() {
        return AssetSpawner.instance_counter++;
    }

    createAsset(asset_config) {
        const model = asset_config.model.clone();
        model.frustumCulled = true;  // Enable frustum culling
        
        // Add LOD (Level of Detail) for complex models
        if (asset_config.geometry && asset_config.geometry.attributes.position.count > 1000) {
            const lod = new THREE.LOD();
            
            // High detail (original)
            lod.addLevel(model, 0);
            
            // Medium detail (50% less geometry)
            const mediumGeo = asset_config.geometry.clone();
            const mediumDetail = THREE.BufferGeometryUtils.mergeVertices(mediumGeo, 0.1);
            const mediumMesh = new THREE.Mesh(mediumDetail, model.material);
            lod.addLevel(mediumMesh, 10);
            
            // Low detail (75% less geometry)
            const lowGeo = asset_config.geometry.clone();
            const lowDetail = THREE.BufferGeometryUtils.mergeVertices(lowGeo, 0.2);
            const lowMesh = new THREE.Mesh(lowDetail, model.material);
            lod.addLevel(lowMesh, 20);
            
            model = lod;
        }
        
        // Rest of the existing createAsset code...
    }
}