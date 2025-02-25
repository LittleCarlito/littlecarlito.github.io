import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Easing, Tween, RAPIER, THREE, NAMES } from ".";
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";
import { FLAGS } from "./flags";

// Define all possible asset types that can be loaded and spawned
export const ASSET_TYPE = {
    AXE: 'AXE',
    DIPLOMA: 'education',
    DESK: 'DESK',
    CHAIR: 'CHAIR',
    BOOK: 'BOOK',
    ROOM: 'ROOM',
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
    // TODO Load in room
    [ASSET_TYPE.ROOM]: {
        PATH: "assets/room.glb",
        name: "room",
        scale: 5,
        mass: 1,
        restituation: .2
    },
    // TODO Load in book
    [ASSET_TYPE.BOOK]: {
        PATH: "assets/book.glb",
        name: "book",
        scale: 5,
        mass: 1,
        restituation: 1
    },
    // TOOD Load in chair
    [ASSET_TYPE.CHAIR]: {
        PATH: "assets/chair.glb",
        name: "chair",
        scale: 5,
        mass: 1.2,
        restituation: 1
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
    
    constructor() {
        if (AssetManager.instance) {
            return AssetManager.instance;
        }
        this.loader = new GLTFLoader();
        this.loaded_assets = new Map();  // Stores the raw GLTF data
        this.dynamic_bodies = new Map(); // Stores [mesh, physicsBody] pairs
        this.static_meshes = new Map();  // Stores static meshes without physics
        this.loading_promises = new Map();
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
        if (this.loaded_assets.has(asset_type)) {
            return this.loaded_assets.get(asset_type);
        }
        if (this.loading_promises.has(asset_type)) {
            return this.loading_promises.get(asset_type);
        }
        const loading_promise = new Promise((resolve, reject) => {
            this.loader.load(
                asset_config.PATH,
                (gltf) => {
                    this.loaded_assets.set(asset_type, gltf);
                    this.loading_promises.delete(asset_type);
                    resolve(gltf);
                },
                undefined,
                reject
            );
        });
        this.loading_promises.set(asset_type, loading_promise);
        return loading_promise;
    }

    get_new_instance_id() {
        return AssetManager.instance_counter++;
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
        if (!Object.values(ASSET_TYPE).includes(asset_type)) {
            throw new Error(`Invalid asset type: ${asset_type}`);
        }
        const asset_config = ASSET_CONFIGS[asset_type];
        let mesh;
        // Create physics body first
        const body = world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(position_offset.x, position_offset.y, position_offset.z)
                .setCanSleep(false)
        );

        if(FLAGS.ASSET_LOGS) console.log(`Created rigid body for ${asset_type}:`, body);

        if (asset_type === ASSET_TYPE.CUBE) {
            mesh = new THREE.Mesh(
                asset_config.geometry,
                asset_config.create_material(options.color || 0xffffff)
            );
            mesh.position.copy(position_offset);
            mesh.castShadow = true;
            // Add name for cube
            mesh.name = `${TYPES.INTERACTABLE}${asset_config.name}`;
            const collider = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
                .setMass(asset_config.mass)
                .setRestitution(asset_config.restitution);
            const created_collider = world.createCollider(collider, body);
            if(FLAGS.ASSET_LOGS) console.log(`Created cube collider:`, created_collider);
        } else {
            // Normal GLB asset loading path
            if (!this.loaded_assets.has(asset_type)) await this.load_asset_type(asset_type);
            const gltf = this.loaded_assets.get(asset_type);
            mesh = gltf.scene.clone();
            mesh.position.copy(position_offset);
            mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
            
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
                        // Regular mesh handling
                        child.material = child.material.clone();
                        child.material.depthTest = true;
                        child.material.transparent = false;
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
                    
                    const indices = geometry.index ? geometry.index.array : undefined;
                    
                    if(FLAGS.ASSET_LOGS) console.log(`Creating collider component for ${collision_mesh.name}:`, {
                        vertexCount: scaledVertices.length / 3,
                        indexCount: indices ? indices.length : 'none',
                        scale: asset_config.scale,
                        position: collision_mesh.position
                    });

                    let collider;
                    if (indices) {
                        collider = RAPIER.ColliderDesc.trimesh(scaledVertices, indices)
                            .setMass(asset_config.mass)
                            .setRestitution(asset_config.restitution);
                    } else {
                        collider = RAPIER.ColliderDesc.convexHull(scaledVertices)
                            .setMass(asset_config.mass)
                            .setRestitution(asset_config.restitution);
                    }

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
                        .setRestitution(asset_config.restitution);

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
        this.dynamic_bodies.set(instance_id, body_pair);
        
        // Add the instance_id to the mesh's userData for reference
        mesh.userData.instance_id = instance_id;
        
        return body_pair;
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
            this.dynamic_bodies.set(instance_id, incoming_pair);
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
            if (!this.loaded_assets.has(asset_type)) await this.load_asset_type(asset_type);
            const gltf = this.loaded_assets.get(asset_type);
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
        this.static_meshes.set(instance_id, mesh);
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
        return Array.from(this.dynamic_bodies.values());
    }

    get_all_static_meshes() {
        return Array.from(this.static_meshes.values());
    }

    // Update method to get body pair by mesh
    get_body_pair_by_mesh(mesh) {
        // First check if the current mesh has the instance_id
        let instance_id = mesh.userData.instance_id;
        // If not found, traverse up the parent hierarchy
        let current = mesh;
        while (!instance_id && current.parent) {
            current = current.parent;
            instance_id = current.userData.instance_id;
        }
        return instance_id ? this.dynamic_bodies.get(instance_id) : null;
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
        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Attempting to activate: ${object_name}`);
        
        // First check if we think it's active
        if(object_name === this.currently_activated_name) {
            if (this.emission_states.get(object_name) === 'active') {
                // Verify the actual material state
                let found_and_verified = false;
                for (const [instance_id, [mesh, _body]] of this.dynamic_bodies) {
                    const mesh_category = mesh.name.split("_")[1];
                    if (mesh_category === object_name.split("_")[1]) {
                        // If we find the mesh but it's not actually emissive, we need to reapply
                        if (this.is_mesh_emissive(mesh)) {
                            found_and_verified = true;
                            return;
                        } else {
                            if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Object ${object_name} claims to be active but isn't emissive - reapplying`);
                            this.emission_states.delete(object_name);
                            break;
                        }
                    }
                }
                if (!found_and_verified) {
                    if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Object ${object_name} not found for verification - resetting state`);
                    this.emission_states.delete(object_name);
                }
            }
        }
        
        // Rest of the activation logic remains the same...
        // Deactivate previously activated object if it's different
        if (this.currently_activated_name !== object_name) {
            if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Deactivating previous: ${this.currently_activated_name}`);
            this.deactivate_object(this.currently_activated_name);
        }
        
        this.currently_activated_name = object_name;
        
        // Extract the category name from the incoming object name
        const requested_category = object_name.split("_")[1];
        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Looking for category: ${requested_category}`);
        
        let found = false;
        for (const [instance_id, [mesh, _body]] of this.dynamic_bodies) {
            const mesh_category = mesh.name.split("_")[1];
            
            if (mesh_category === requested_category) {
                found = true;
                if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Found matching mesh by category: ${mesh_category}`);
                
                const category = Object.values(CATEGORIES).find(cat => 
                    typeof cat !== 'function' && cat.value === requested_category
                );
                
                if (category) {
                    if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Applying emission material with color: ${category.color}`);
                    
                    // Set the emission state to 'applying'
                    this.emission_states.set(object_name, 'applying');
                    
                    // Function to create emission material
                    const createEmissionMaterial = (originalMaterial) => {
                        return new THREE.MeshStandardMaterial({ 
                            color: category.color,
                            emissive: category.color,
                            emissiveIntensity: 9,
                            map: originalMaterial?.map || null,
                            transparent: originalMaterial?.transparent || false,
                            opacity: originalMaterial?.opacity || 1,
                        });
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
                                }
                                // Apply new emission material while preserving textures
                                if (child.material) child.material.dispose();
                                child.material = createEmissionMaterial(child.userData.originalMaterial);
                                meshesProcessed++;
                                
                                // Check if all meshes are processed and verify emission
                                if (meshesProcessed === totalMeshes) {
                                    if (this.is_mesh_emissive(mesh)) {
                                        this.emission_states.set(object_name, 'active');
                                        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Object ${object_name} is now fully activated and verified`);
                                    } else {
                                        if (FLAGS.ACTIVATE_LOGS) console.warn(`[AssetManager] Failed to apply emission to ${object_name}`);
                                        this.emission_states.delete(object_name);
                                    }
                                }
                            }
                        });
                    } else if (mesh.isMesh) {
                        // For primitive objects like cubes
                        if (!mesh.userData.originalMaterial) {
                            mesh.userData.originalMaterial = mesh.material.clone();
                        }
                        if (mesh.material) mesh.material.dispose();
                        mesh.material = createEmissionMaterial(mesh.userData.originalMaterial);
                        
                        // Verify emission for primitive mesh
                        if (this.is_mesh_emissive(mesh)) {
                            this.emission_states.set(object_name, 'active');
                            if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Object ${object_name} is now fully activated and verified`);
                        } else {
                            if (FLAGS.ACTIVATE_LOGS) console.warn(`[AssetManager] Failed to apply emission to ${object_name}`);
                            this.emission_states.delete(object_name);
                        }
                    }
                }
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`[AssetManager] No mesh found for category: ${requested_category}`);
            this.emission_states.delete(object_name);
        }
    }

    /**
     * Deactivates an object by tweening its emission to zero
     * @param {string} object_name - Name of the object to deactivate
     */
    deactivate_object(object_name) {
        if (!object_name) return;
        
        const requested_category = object_name.split("_")[1];
        let found = false;
        
        for (const [instance_id, [mesh, _body]] of this.dynamic_bodies) {
            const mesh_category = mesh.name.split("_")[1];
            
            if (mesh_category === requested_category) {
                found = true;
                if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Found mesh to deactivate: ${mesh.name}`);
                
                // Set deactivation state
                this.emission_states.set(object_name, 'deactivating');
                
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

                const deactivateMesh = (targetMesh) => {
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
                                        this.emission_states.delete(object_name);
                                        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Object ${object_name} is now fully deactivated`);
                                    }
                                    
                                    if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Restored original material for: ${targetMesh.name}`);
                                })
                                .start();
                        }
                    } else if (FLAGS.ACTIVATE_LOGS) {
                        console.warn(`[AssetManager] No original material found for: ${targetMesh.name}`);
                        meshesProcessed++;
                        if (meshesProcessed === totalMeshes) {
                            this.emission_states.delete(object_name);
                        }
                    }
                };

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
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`[AssetManager] No active mesh found for category: ${requested_category}`);
            this.emission_states.delete(object_name);
        }
    }

    /**
     * Deactivates all objects that match the given type prefix, or all objects if no prefix provided
     * @param {string} [type_prefix] - Optional prefix to match object names against
     */
    deactivate_all_objects(type_prefix = null) {
        // Only proceed if we have an active object
        if (!this.currently_activated_name) return;
        
        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Deactivating all objects${type_prefix ? ` with prefix: ${type_prefix}` : ''}`);
        let deactivation_count = 0;
        
        const deactivateMesh = (targetMesh) => {
            if (targetMesh.material && 
                targetMesh.material.emissive && 
                targetMesh.material.emissiveIntensity > 0) {
                if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Deactivating emissive mesh: ${targetMesh.name}`);
                
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

        for (const [instance_id, [mesh, _body]] of this.dynamic_bodies) {
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
        this.currently_activated_name = "";
    }

    /**
     * Checks if an object with the given name exists
     * @param {string} object_name - Name of the object to check
     * @returns {boolean} True if the object exists
     */
    contains_object(object_name) {
        for (const [_, [mesh, _body]] of this.dynamic_bodies) {
            if (mesh.name === object_name) return true;
        }
        return false;
    }
}