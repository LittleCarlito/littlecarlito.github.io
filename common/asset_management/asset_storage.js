import { THREE } from "..";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ASSET_CONFIGS } from "./asset_type";
import { FLAGS } from "../flags";
import { AssetSpawner } from "./asset_spawner";

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
     * Loads an asset of the specified type if not already loaded.
     * @param {string} asset_type - The type of asset to load.
     * @returns {Promise<THREE.GLTF>} Promise resolving to the loaded GLTF data.
     * @throws {Error} If the asset type is unknown.
     */
    async load_asset_type(asset_type) {
        const asset_config = ASSET_CONFIGS[asset_type];
        if (!asset_config) throw new Error(`Unknown asset type: ${asset_type}`);
        
        if (this.has_loaded_asset(asset_type)) {
            return this.get_loaded_asset(asset_type);
        }
        
        if (this.has_loading_promise(asset_type)) {
            return this.get_loading_promise(asset_type);
        }
        
        const loading_promise = new Promise((resolve, reject) => {
            this.loader.load(
                asset_config.PATH,
                (gltf) => {
                    this.store_loaded_asset(asset_type, gltf);
                    resolve(gltf);
                },
                undefined,
                reject
            );
        });
        
        this.set_loading_promise(asset_type, loading_promise);
        return loading_promise;
    }

    /**
     * Adds a new object to the storage system.
     * @param {THREE.Object3D} incoming_mesh - The mesh to add.
     * @param {RAPIER.RigidBody} incoming_body - The physics body associated with the mesh.
     */
    add_object(incoming_mesh, incoming_body) {
        if (!incoming_mesh) {
            console.error('Cannot add object: incoming_mesh is undefined');
            return;
        }
        if(incoming_mesh.name) {
            const instance_id = `${incoming_mesh.name}_${this.get_new_instance_id()}`;
            const body_pair = [incoming_mesh, incoming_body];
            this.store_dynamic_body(instance_id, body_pair);
            incoming_mesh.userData.instance_id = instance_id;
        } else {
            console.error(`${incoming_mesh} ${incoming_body} mesh body combo could not be added because the mesh didn't have a name`);
        }
    }

    /**
     * Updates the positions and rotations of all dynamic bodies based on their physics state.
     */
    update() {
        this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
            if (body) {
                const position = body.translation();
                mesh.position.set(position.x, position.y, position.z);
                const rotation = body.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
        // Update debug wireframes
        AssetSpawner.get_instance().update_debug_wireframes();
    }

    /**
     * Cleans up all stored resources, disposing of materials and clearing caches.
     */
    cleanup() {
        // Dispose of all cached materials
        for (const material of this.material_cache.values()) {
            if (material.map) material.map.dispose();
            material.dispose();
        }
        this.material_cache.clear();
        // Clear all other storage
        this.loaded_assets.clear();
        this.dynamic_bodies.clear();
        this.static_meshes.clear();
        this.loading_promises.clear();
        this.emission_states.clear();
        this.currently_activated_name = "";
    }

    // Getters and Setters

    get_new_instance_id() {
        return this.instance_counter++;
    }

    store_loaded_asset(asset_type, gltf) {
        this.loaded_assets.set(asset_type, gltf);
        this.loading_promises.delete(asset_type);
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
        this.dynamic_bodies.set(instance_id, body_pair);
        const [mesh, _body] = body_pair;
        mesh.userData.instance_id = instance_id;
    }

    get_dynamic_body(instance_id) {
        return this.dynamic_bodies.get(instance_id);
    }

    get_all_dynamic_bodies() {
        return Array.from(this.dynamic_bodies.values());
    }

    get_body_pair_by_mesh(mesh) {
        let instance_id = mesh.userData.instance_id;
        let current = mesh;
        while (!instance_id && current.parent) {
            current = current.parent;
            instance_id = current.userData.instance_id;
        }
        return instance_id ? this.dynamic_bodies.get(instance_id) : null;
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
        if (!this.material_cache.has(key)) {
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
            this.material_cache.set(key, material);
            return material;
        }
        return this.material_cache.get(key);
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
        for (const [mesh, _body] of this.get_all_dynamic_bodies()) {
            if (mesh.name === object_name) return true;
        }
        return false;
    }
}