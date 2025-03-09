import { THREE } from "./index.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ASSET_CONFIGS } from "./asset_type.js";
import { FLAGS } from "./flags.js";
import { AssetSpawner } from "./asset_spawner.js";

/**
 * Class responsible for managing asset loading, storage, and caching.
 * Handles GLB models, materials, and maintains references to both static and dynamic objects.
 */
export class AssetStorage {
    static instance = null;

    constructor() {
        if (AssetStorage.instance) {
            return AssetStorage.instance;
        }
        this.loader = new GLTFLoader();
        this.loaded_assets = new Map();  // Stores the raw GLTF data
        this.dynamic_bodies = new Map(); // Stores [mesh, physicsBody] pairs
        this.static_meshes = new Map();  // Stores static meshes without physics
        this.loading_promises = new Map();
        this.material_cache = new Map(); // Initialize material cache
        this.emission_states = new Map(); // Track emission states of objects
        this.currently_activated_name = "";  // Track the currently activated object
        this.instance_counter = 0;
        AssetStorage.instance = this;
    }

    /**
     * Gets or creates the singleton instance of AssetStorage.
     * @returns {AssetStorage} The singleton instance.
     */
    static get_instance() {
        if (!AssetStorage.instance) {
            AssetStorage.instance = new AssetStorage();
        }
        return AssetStorage.instance;
    }

    /**
     * Loads an asset of the specified type asynchronously.
     * @param {string} asset_type The type of asset to load.
     * @returns {Promise<Object>} A promise that resolves with the loaded asset.
     */
    async load_asset_type(asset_type) {
        // Check if already loaded
        if (this.has_loaded_asset(asset_type)) {
            return this.get_loaded_asset(asset_type);
        }

        // Check if already loading
        if (this.has_loading_promise(asset_type)) {
            return this.get_loading_promise(asset_type);
        }

        // Set up loading promise
        const asset_config = ASSET_CONFIGS[asset_type];
        if (!asset_config) {
            throw new Error(`Unknown asset type: ${asset_type}`);
        }

        const loading_promise = new Promise((resolve, reject) => {
            this.loader.load(
                asset_config.PATH,
                (gltf) => {
                    this.store_loaded_asset(asset_type, gltf);
                    if (FLAGS.ASSET_LOGS) console.log(`Loaded asset: ${asset_type}`);
                    resolve(gltf);
                },
                undefined,
                (error) => {
                    console.error(`Error loading asset ${asset_type}:`, error);
                    reject(error);
                }
            );
        });

        this.set_loading_promise(asset_type, loading_promise);
        const result = await loading_promise;
        this.delete_loading_promise(asset_type);
        return result;
    }

    /**
     * Adds an object to the storage system.
     * @param {THREE.Object3D} incoming_mesh - The mesh to add
     * @param {RAPIER.RigidBody} incoming_body - The physics body (optional)
     * @returns {string} The instance ID of the added object
     */
    add_object(incoming_mesh, incoming_body) {
        const instance_id = this.get_new_instance_id();
        
        if (incoming_body) {
            // Store as dynamic physics object
            this.store_dynamic_body(instance_id, [incoming_mesh, incoming_body]);
            
            // Ensure the object has a userData reference to its physics body for easy access
            incoming_mesh.userData.physicsBody = incoming_body;
            incoming_mesh.userData.instanceId = instance_id;
            
            // Make sure the physics body position matches the mesh
            const position = incoming_body.translation();
            incoming_mesh.position.set(position.x, position.y, position.z);
            
            const rotation = incoming_body.rotation();
            incoming_mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            
            if (FLAGS.PHYSICS_LOGS) console.log(`Added dynamic body with ID: ${instance_id}`);
        } else {
            // Store as static mesh (no physics)
            this.store_static_mesh(instance_id, incoming_mesh);
            incoming_mesh.userData.instanceId = instance_id;
            if (FLAGS.ASSET_LOGS) console.log(`Added static mesh with ID: ${instance_id}`);
        }
        
        return instance_id;
    }

    /**
     * Updates physics bodies and their corresponding meshes.
     * Called every frame to synchronize visual representation with physics.
     */
    update() {
        // Update physics for dynamic bodies
        this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
            if (body && mesh) {
                // Skip if the body is sleeping and hasn't moved
                if (body.isSleeping() && !body.isKinematic()) {
                    return;
                }
                
                // Get the position and rotation from the physics body
                const position = body.translation();
                mesh.position.set(position.x, position.y, position.z);
                
                const rotation = body.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                
                // Ensure the body is awake if it's being moved
                if (mesh.userData.isMoving && body.isSleeping()) {
                    body.wakeUp();
                }
            }
        });
    }

    cleanup() {
        // Clean up dynamic bodies and meshes
        this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
            if (mesh) {
                if (mesh.parent) {
                    mesh.parent.remove(mesh);
                }
                
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (mesh.material.map) mesh.material.map.dispose();
                        mesh.material.dispose();
                    }
                }
            }
        });
        
        // Clean up static meshes
        this.get_all_static_meshes().forEach(mesh => {
            if (mesh) {
                if (mesh.parent) {
                    mesh.parent.remove(mesh);
                }
                
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (mesh.material.map) mesh.material.map.dispose();
                        mesh.material.dispose();
                    }
                }
            }
        });
        
        // Clear maps
        this.dynamic_bodies.clear();
        this.static_meshes.clear();
        this.emission_states.clear();
        this.material_cache.clear();
        
        // Reset instance counter and currently activated
        this.instance_counter = 0;
        this.currently_activated_name = "";
        
        if (FLAGS.ASSET_LOGS) console.log("Asset storage cleaned up");
    }

    get_new_instance_id() {
        return `instance_${this.instance_counter++}`;
    }

    store_loaded_asset(asset_type, gltf) {
        this.loaded_assets.set(asset_type, gltf);
    }

    get_loaded_asset(asset_type) {
        return this.loaded_assets.get(asset_type);
    }

    has_loaded_asset(asset_type) {
        return this.loaded_assets.has(asset_type);
    }

    set_loading_promise(asset_type, promise) {
        this.loading_promises.set(asset_type, promise);
    }

    get_loading_promise(asset_type) {
        return this.loading_promises.get(asset_type);
    }

    has_loading_promise(asset_type) {
        return this.loading_promises.has(asset_type);
    }

    delete_loading_promise(asset_type) {
        this.loading_promises.delete(asset_type);
    }

    store_dynamic_body(instance_id, body_pair) {
        if (FLAGS.PHYSICS_LOGS) console.log(`Storing dynamic body: ${instance_id}`);
        this.dynamic_bodies.set(instance_id, body_pair);
    }

    get_dynamic_body(instance_id) {
        return this.dynamic_bodies.get(instance_id);
    }

    get_all_dynamic_bodies() {
        return Array.from(this.dynamic_bodies.values());
    }

    get_body_pair_by_mesh(mesh) {
        // First try direct match
        for (const [id, [object_mesh, body]] of this.dynamic_bodies.entries()) {
            if (object_mesh === mesh) {
                // Return array format for backwards compatibility with existing code
                return [object_mesh, body];
            }
            
            // If the object is a child of a mesh in our storage
            if (object_mesh.children && object_mesh.children.includes(mesh)) {
                return [object_mesh, body];
            }
            
            // Check if the mesh is a child somewhere in the hierarchy
            let foundInHierarchy = false;
            object_mesh.traverse((child) => {
                if (child === mesh) {
                    foundInHierarchy = true;
                }
            });
            
            if (foundInHierarchy) {
                return [object_mesh, body];
            }
        }
        
        // If direct match fails, try matching by name for legacy support
        const meshName = mesh.name;
        for (const [id, [object_mesh, body]] of this.dynamic_bodies.entries()) {
            if (object_mesh.name === meshName) {
                return [object_mesh, body];
            }
        }
        
        return null;
    }

    store_static_mesh(instance_id, mesh) {
        this.static_meshes.set(instance_id, mesh);
    }

    get_static_mesh(instance_id) {
        return this.static_meshes.get(instance_id);
    }

    get_all_static_meshes() {
        return Array.from(this.static_meshes.values());
    }

    store_material(key, material) {
        this.material_cache.set(key, material);
    }

    get_material(key, originalMaterial) {
        if (this.has_material(key)) {
            return this.material_cache.get(key);
        }
        
        if (originalMaterial) {
            // Clone the original material if provided
            const material = originalMaterial.clone();
            this.store_material(key, material);
            return material;
        }
        
        // Create a basic material if nothing else is available
        const material = new THREE.MeshStandardMaterial();
        this.store_material(key, material);
        return material;
    }

    has_material(key) {
        return this.material_cache.has(key);
    }

    set_emission_state(object_name, state) {
        this.emission_states.set(object_name, state);
    }

    get_emission_state(object_name) {
        return this.emission_states.get(object_name);
    }

    delete_emission_state(object_name) {
        this.emission_states.delete(object_name);
    }

    set_currently_activated_name(name) {
        this.currently_activated_name = name;
    }

    get_currently_activated_name() {
        return this.currently_activated_name;
    }

    contains_object(object_name) {
        return this.emission_states.has(object_name);
    }
} 