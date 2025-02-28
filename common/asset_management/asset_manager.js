import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Easing, Tween, RAPIER, THREE, NAMES } from "..";
import { CATEGORIES, TYPES } from "../../viewport/overlay/overlay_common";
import { FLAGS } from "../flags";
import { TextureAtlasManager } from '../texture_atlas_manager';
import { AssetStorage } from './asset_storage';

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

// Define all possible asset types that can be loaded and spawned
export const ASSET_TYPE = {
    AXE: 'AXE',
    DIPLOMA: 'education',
    DESK: 'DESK',
    CHAIR: 'CHAIR',
    BOOK: 'BOOK',
    ROOM: 'ROOM',
    TABLET: 'TABLET',
    DESKPHOTO: 'DESK_PHOTO',
    CUBE: 'CUBE'  // Simple geometric primitive for testing
};
Object.freeze(ASSET_TYPE);

// Configuration for each asset type, including model paths, physics properties, and scaling
export const ASSET_CONFIGS = {
    [ASSET_TYPE.AXE]: {
        PATH: "assets/Axe.glb",
        name: "axe",
        scale: 20,
        mass: 5,
        restitution: .1,
    },
    [ASSET_TYPE.DIPLOMA]: {
        PATH: "assets/diploma_bot.glb",
        name: "education",
        scale: 10,
        mass: 1,
        restitution: .2,
    },
    [ASSET_TYPE.DESK]: {
        PATH: "assets/desk.glb",
        name: "desk",
        scale: 2,
        mass: 1,
        restitution: .5,
    },
    // Load in room
    [ASSET_TYPE.ROOM]: {
        PATH: "assets/room.glb",
        name: "room",
        scale: 5,
        mass: 1,
        restitution: .2
    },
    // Load in book
    [ASSET_TYPE.BOOK]: {
        PATH: "assets/book.glb",
        name: "book",
        scale: 5,
        mass: 1,
        restitution: 1
    },
    // Load in chair
    [ASSET_TYPE.CHAIR]: {
        PATH: "assets/chair.glb",
        name: "chair",
        scale: 5,
        mass: 1.2,
        restitution: 1
    },
    [ASSET_TYPE.TABLET]: {
        PATH: "assets/tablet.glb",
        name: "tablet",
        scale: 5,
        mass: 1,
        restitution: 1
    },
    [ASSET_TYPE.DESKPHOTO]: {
        PATH: "assets/deskphoto.glb",
        name: "desk_photo",
        scale: 5,
        mass: 1,
        restitution: 1
    },
    [ASSET_TYPE.CUBE]: {
        // No PATH needed as it's a primitive
        name: "cube",
        scale: 1,
        mass: 1,
        restitution: 1.1,
        geometry: new THREE.BoxGeometry(1, 1, 1),
        // Function to create material - allows for dynamic color assignment
        create_material: (color) => new THREE.MeshStandardMaterial({ color: color })
    }
};

export class AssetManager {
    static instance = null;
    static instance_counter = 0;
    currently_activated_name = "";  // Add this to track the currently activated object
    emission_states = new Map(); // Track emission states of objects
    name = "[AssetManager]";
    textureAtlasManager = TextureAtlasManager.getInstance();
    pendingTextures = new Map(); // Track textures waiting to be atlased
    
    constructor() {
        if (AssetManager.instance) {
            return AssetManager.instance;
        }
        this.loader = new GLTFLoader();
        this.storage = new AssetStorage();
        this.textureAtlasManager = TextureAtlasManager.getInstance();
        this.pendingTextures = new Map(); // Track textures waiting to be atlased
        AssetManager.instance = this;
    }

    static get_instance() {
        if (!AssetManager.instance) {
            AssetManager.instance = new AssetManager();
        }
        return AssetManager.instance;
    }

    async load_asset_type(asset_type) {
        const asset_config = ASSET_CONFIGS[asset_type];
        if (!asset_config) throw new Error(`Unknown asset type: ${asset_type}`);
        
        if (this.storage.has_loaded_asset(asset_type)) {
            return this.storage.get_loaded_asset(asset_type);
        }
        
        if (this.storage.has_loading_promise(asset_type)) {
            return this.storage.get_loading_promise(asset_type);
        }
        
        const loading_promise = new Promise((resolve, reject) => {
            this.loader.load(
                asset_config.PATH,
                (gltf) => {
                    this.storage.store_loaded_asset(asset_type, gltf);
                    resolve(gltf);
                },
                undefined,
                reject
            );
        });
        
        this.storage.set_loading_promise(asset_type, loading_promise);
        return loading_promise;
    }

    get_new_instance_id() {
        return AssetManager.instance_counter++;
    }

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
     * Spawns a physics-enabled asset of the specified type
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum
     * @param {THREE.Object3D} parent - Parent object to add the mesh to
     * @param {RAPIER.World} world - Physics world to create the body in
     * @param {Object} options - Additional options (e.g., color for cubes)
     * @param {THREE.Vector3} position_offset - Position offset from parent
     * @returns {Array} [mesh, body] pair for physics updates
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
                    .setRestitution(asset_config.restitution);
                    
                const created_collider = world.createCollider(collider, body);
                
                if(FLAGS.ASSET_LOGS) console.log(`Created cube collider:`, created_collider);
                
                // Add to parent
                parent.add(mesh);
                
                return [mesh, body];
            } else {
                // Normal GLB asset loading path
                if (!this.storage.has_loaded_asset(asset_type)) await this.load_asset_type(asset_type);
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
                            child.material = this.getMaterial(materialKey, originalMaterial);
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
                            .setRestitution(asset_config.restitution)
                            .setFriction(1.0); // Add friction to help prevent sliding

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
                        
                        world.createCollider(collider, body);
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
                            .setRestitution(asset_config.restitution)
                            .setFriction(1.0); // Add friction to help prevent sliding

                        const created_collider = world.createCollider(collider, body);
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
     * Adds the incoming object to the dynamic bodies map
     * Also assigns a unique identifier to the mesh for retrieval
     * @param {*} incoming_object 
     */
    add_object(incoming_mesh, incoming_body) {
        if (!incoming_mesh) {
            console.error('Cannot add object: incoming_mesh is undefined');
            return;
        }
        if(incoming_mesh.name) {
            const incoming_name = incoming_mesh.name;
            const instance_id = `${incoming_name}_${this.get_new_instance_id()}`;
            const incoming_pair = [incoming_mesh, incoming_body];
            this.storage.store_dynamic_body(instance_id, incoming_pair);
            incoming_mesh.userData.instance_id = instance_id;
        } else {
            console.error(`${incoming_mesh} ${incoming_body} mesh body combo could not be added because the mesh didn't have a name`);
        }
    }

    /**
     * Creates a static (non-physics) mesh of the specified asset type
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum
     * @param {THREE.Object3D} parent - Parent object to add the mesh to
     * @param {THREE.Vector3} position_offset - Position offset from parent
     * @param {THREE.Quaternion} rotation - Rotation of the mesh
     * @returns {THREE.Object3D} The created mesh
     */
    async create_static_mesh(asset_type, parent, position_offset = new THREE.Vector3(0, 0, 0), rotation = null) {
        if (!Object.values(ASSET_TYPE).includes(asset_type)) throw new Error(`Invalid asset type: ${asset_type}`);
        const asset_config = ASSET_CONFIGS[asset_type];
        let mesh;
        if (asset_type === ASSET_TYPE.CUBE) {
            mesh = new THREE.Mesh(asset_config.geometry, asset_config.create_material(0xffffff));
            mesh.castShadow = true;
        } else {
            if (!this.storage.has_loaded_asset(asset_type)) await this.load_asset_type(asset_type);
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

    update() {
        this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
            if (body) {
                const position = body.translation();
                mesh.position.set(position.x, position.y, position.z);
                const rotation = body.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
    }

    get_all_dynamic_bodies() {
        return this.storage.get_all_dynamic_bodies();
    }

    get_all_static_meshes() {
        return this.storage.get_all_static_meshes();
    }

    // Update method to get body pair by mesh
    get_body_pair_by_mesh(mesh) {
        return this.storage.get_body_pair_by_mesh(mesh);
    }

    // Add helper method to check if a mesh is actually emissive
    is_mesh_emissive(mesh) {
        if (!mesh) return false;
        let has_emissive = false;
        const check_material = (material) => {
            return material && 
                   material.emissive && 
                   material.emissiveIntensity > 0 &&
                   material.emissiveIntensity === 9; // Our target intensity
        };
        if (mesh.isGroup || mesh.isObject3D) {
            mesh.traverse((child) => {
                if (child.isMesh && !child.name.startsWith('col_')) {
                    if (check_material(child.material)) {
                        has_emissive = true;
                    }
                }
            });
        } else if (mesh.isMesh) {
            has_emissive = check_material(mesh.material);
        }
        return has_emissive;
    }

    activate_object(object_name) {        
        // First check if we think it's active
        if(object_name === this.storage.get_currently_activated_name()) {
            if (this.storage.get_emission_state(object_name) === 'active') {
                // Verify the actual material state
                let found_and_verified = false;
                for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
                    const mesh_category = mesh.name.split("_")[1];
                    if (mesh_category === object_name.split("_")[1]) {
                        // If we find the mesh but it's not actually emissive, we need to reapply
                        if (this.is_mesh_emissive(mesh)) {
                            found_and_verified = true;
                            return;
                        } else {
                            if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} claims to be active but isn't emissive - reapplying`);
                            this.storage.delete_emission_state(object_name);
                            break;
                        }
                    }
                }
                if (!found_and_verified) {
                    if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} not found for verification - resetting state`);
                    this.storage.delete_emission_state(object_name);
                }
            }
        }
        
        // Deactivate previously activated object if it's different
        const current_activated = this.storage.get_currently_activated_name();
        if (current_activated !== object_name) {
            if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating previous: ${current_activated}`);
            this.deactivate_object(current_activated);
        }
        
        this.storage.set_currently_activated_name(object_name);
        
        // Extract the category name from the incoming object name
        const requested_category = object_name.split("_")[1];
        if (FLAGS.ACTIVATE_LOGS) {
            console.log(`${this.name} Looking for category: ${requested_category}`);
            console.log(`${this.name} Available meshes:`, this.storage.get_all_dynamic_bodies().map(([mesh, _]) => mesh.name));
        }
        
        let found = false;
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            const mesh_category = mesh.name.split("_")[1];
            
            if (mesh_category === requested_category) {
                found = true;
                if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Found matching mesh by category: ${mesh_category}`);
                
                const category = Object.values(CATEGORIES).find(cat => 
                    typeof cat !== 'function' && cat.value === requested_category
                );
                
                if (category) {
                    if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Applying emission material with color: ${category.color}`);
                    
                    // Set the emission state to 'applying'
                    this.storage.set_emission_state(object_name, 'applying');
                    
                    // Function to create emission material
                    const createEmissionMaterial = (originalMaterial) => {
                        // Ensure we have a valid color from the category
                        let categoryColor;
                        if (category.color instanceof THREE.Color) {
                            categoryColor = category.color;
                        } else if (typeof category.color === 'number') {
                            categoryColor = new THREE.Color(category.color);
                        } else if (typeof category.color === 'string') {
                            categoryColor = new THREE.Color(category.color);
                        } else {
                            console.warn('Invalid category color:', category.color);
                            categoryColor = new THREE.Color(0xffffff);
                        }

                        const emissionKey = `emission_${categoryColor.getHex()}_${!!originalMaterial?.map}`;
                        return this.getMaterial(emissionKey, originalMaterial);
                    };

                    let meshesProcessed = 0;
                    let totalMeshes = 0;

                    // Count total meshes first
                    if (mesh.isGroup || mesh.isObject3D) {
                        mesh.traverse((child) => {
                            if (child.isMesh && !child.name.startsWith('col_')) totalMeshes++;
                        });
                    } else if (mesh.isMesh) {
                        totalMeshes = 1;
                    }

                    // For GLB models, we need to traverse all meshes
                    if (mesh.isGroup || mesh.isObject3D) {
                        mesh.traverse((child) => {
                            if (child.isMesh && !child.name.startsWith('col_')) {
                                // Store the original material for deactivation
                                if (!child.userData.originalMaterial) {
                                    child.userData.originalMaterial = child.material.clone();
                                    console.log("Cloned original material for:", object_name);
                                }
                                // Apply new emission material while preserving textures
                                if (child.material) child.material.dispose();
                                child.material = createEmissionMaterial(child.userData.originalMaterial);
                                console.log("Applied emission material to:", object_name, "Material:", child.material);
                                meshesProcessed++;
                                
                                // Check if all meshes are processed and verify emission
                                if (meshesProcessed === totalMeshes) {
                                    if (this.is_mesh_emissive(mesh)) {
                                        this.storage.set_emission_state(object_name, 'active');
                                        if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} is now fully activated and verified`);
                                    } else {
                                        if (FLAGS.ACTIVATE_LOGS) console.warn(`[${this.name} Failed to apply emission to ${object_name}`);
                                        this.storage.delete_emission_state(object_name);
                                    }
                                }
                            }
                        });
                    } else if (mesh.isMesh) {
                        // For primitive objects like cubes
                        if (!mesh.userData.originalMaterial) {
                            mesh.userData.originalMaterial = mesh.material.clone();
                            console.log("Cloned original material for cube:", object_name);
                        }
                        if (mesh.material) mesh.material.dispose();
                        mesh.material = createEmissionMaterial(mesh.userData.originalMaterial);
                        console.log("Applied emission material to cube:", object_name, "Material:", mesh.material);
                        
                        // Verify emission for primitive mesh
                        if (this.is_mesh_emissive(mesh)) {
                            this.storage.set_emission_state(object_name, 'active');
                            if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} is now fully activated and verified`);
                        } else {
                            if (FLAGS.ACTIVATE_LOGS) console.warn(`${this.name} Failed to apply emission to ${object_name}`);
                            this.storage.delete_emission_state(object_name);
                        }
                    }
                }
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`${this.name} No mesh found for category: ${requested_category}`);
            this.storage.delete_emission_state(object_name);
        }
    }

    deactivate_object(object_name) {
        if (!object_name) return;
        
        const requested_category = object_name.split("_")[1];
        let found = false;
        
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            const mesh_category = mesh.name.split("_")[1];
            
            if (mesh_category === requested_category) {
                found = true;
                if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Found mesh to deactivate: ${mesh.name}`);
                
                // Set deactivation state
                this.storage.set_emission_state(object_name, 'deactivating');
                
                let meshesProcessed = 0;
                let totalMeshes = 0;

                // Count total meshes first
                if (mesh.isGroup || mesh.isObject3D) {
                    mesh.traverse((child) => {
                        if (child.isMesh && !child.name.startsWith('col_')) totalMeshes++;
                    });
                } else if (mesh.isMesh) {
                    totalMeshes = 1;
                }

                const deactivate_mesh = (targetMesh) => {
                    // Only proceed if we have an original material to restore to
                    if (targetMesh.userData.originalMaterial) {
                        // Create a new tween for the emission fade out
                        if (targetMesh.material && targetMesh.material.emissiveIntensity > 0) {
                            // Clone the current material to avoid affecting other instances
                            const tweenMaterial = targetMesh.material.clone();
                            targetMesh.material = tweenMaterial;

                            new Tween(tweenMaterial)
                                .to({ emissiveIntensity: 0 }, 500) // 500ms duration for smooth transition
                                .easing(Easing.Quadratic.Out)
                                .onComplete(() => {
                                    // Cleanup the tween material
                                    if (tweenMaterial) tweenMaterial.dispose();
                                    
                                    // Restore the original material
                                    const restoredMaterial = targetMesh.userData.originalMaterial.clone();
                                    targetMesh.material = restoredMaterial;
                                    
                                    meshesProcessed++;
                                    if (meshesProcessed === totalMeshes) {
                                        this.storage.delete_emission_state(object_name);
                                        if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} is now fully deactivated`);
                                    }
                                    
                                    if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Restored original material for: ${targetMesh.name}`);
                                })
                                .start();
                        }
                    } else if (FLAGS.ACTIVATE_LOGS) {
                        console.warn(`${this.name} No original material found for: ${targetMesh.name}`);
                        meshesProcessed++;
                        if (meshesProcessed === totalMeshes) {
                            this.storage.delete_emission_state(object_name);
                        }
                    }
                };

                // Handle both GLB models and primitive objects
                if (mesh.isGroup || mesh.isObject3D) {
                    mesh.traverse((child) => {
                        if (child.isMesh && !child.name.startsWith('col_')) {
                            deactivate_mesh(child);
                        }
                    });
                } else if (mesh.isMesh) {
                    deactivate_mesh(mesh);
                }
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`${this.name} No active mesh found for category: ${requested_category}`);
            this.storage.delete_emission_state(object_name);
        }
    }

    deactivate_all_objects(type_prefix = null) {
        // Only proceed if we have an active object
        if (!this.storage.get_currently_activated_name()) return;
        
        // Check if any objects are actually emissive before proceeding
        let hasEmissiveObjects = false;
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            if (type_prefix && !mesh.name.startsWith(type_prefix)) continue;
            
            const checkEmissive = (targetMesh) => {
                if (targetMesh.material && 
                    targetMesh.material.emissive && 
                    targetMesh.material.emissiveIntensity > 0) {
                    hasEmissiveObjects = true;
                    return true;
                }
                return false;
            };

            if (mesh.isGroup || mesh.isObject3D) {
                mesh.traverse((child) => {
                    if (child.isMesh && !child.name.startsWith('col_')) {
                        if (checkEmissive(child)) return;
                    }
                });
                if (hasEmissiveObjects) break;
            } else if (mesh.isMesh) {
                if (checkEmissive(mesh)) break;
            }
        }

        // If no emissive objects found, just reset the currently_activated_name and return
        if (!hasEmissiveObjects) {
            this.storage.set_currently_activated_name("");
            return;
        }
        
        if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating all objects${type_prefix ? ` with prefix: ${type_prefix}` : ''}`);
        let deactivation_count = 0;
        
        const deactivateMesh = (targetMesh) => {
            if (targetMesh.material && 
                targetMesh.material.emissive && 
                targetMesh.material.emissiveIntensity > 0) {
                if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating emissive mesh: ${targetMesh.name}`);
                
                // Clone the current material to avoid affecting other instances
                const tweenMaterial = targetMesh.material.clone();
                targetMesh.material = tweenMaterial;

                new Tween(tweenMaterial)
                    .to({ emissiveIntensity: 0 }, 500)
                    .easing(Easing.Quadratic.Out)
                    .onComplete(() => {
                        // Cleanup the tween material
                        if (tweenMaterial) tweenMaterial.dispose();
                        
                        // Restore the original material if it exists
                        if (targetMesh.userData.originalMaterial) {
                            const restoredMaterial = targetMesh.userData.originalMaterial.clone();
                            targetMesh.material = restoredMaterial;
                        }
                    })
                    .start();
                deactivation_count++;
            }
        };

        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            if (type_prefix && !mesh.name.startsWith(type_prefix)) {
                continue;
            }
            
            // Handle both GLB models and primitive objects
            if (mesh.isGroup || mesh.isObject3D) {
                mesh.traverse((child) => {
                    if (child.isMesh && !child.name.startsWith('col_')) {
                        deactivateMesh(child);
                    }
                });
            } else if (mesh.isMesh) {
                deactivateMesh(mesh);
            }
        }
        
        if (deactivation_count > 0 && FLAGS.ACTIVATE_LOGS) {
            console.log(`[AssetManager] Deactivated ${deactivation_count} objects`);
        }
        
        // Reset the currently activated name since we've deactivated everything
        this.storage.set_currently_activated_name("");
    }

    /**
     * Checks if an object with the given name exists
     * @param {string} object_name - Name of the object to check
     * @returns {boolean} True if the object exists
     */
    contains_object(object_name) {
        return this.storage.contains_object(object_name);
    }

    // Helper to get cached material or create new one
    getMaterial(key, originalMaterial) {
        if (!this.storage.has_material(key)) {
            const material = new THREE.MeshStandardMaterial({
                map: originalMaterial.map,
                color: originalMaterial.color,
                transparent: originalMaterial.transparent,
                opacity: originalMaterial.opacity,
                side: originalMaterial.side,
                roughness: 1.0,
                metalness: 0.0,
                envMapIntensity: 0.0,
                normalScale: new THREE.Vector2(0, 0),
                emissiveIntensity: 0.0,
                aoMapIntensity: 0.0,
                displacementScale: 0.0,
                flatShading: true
            });
            this.storage.store_material(key, material);
            return material;
        }
        return this.storage.get_material(key).clone();
    }

    cleanup() {
        this.storage.cleanup();
        this.textureAtlasManager.dispose();
    }
}