export class AssetStorage {
    constructor() {
        this.loaded_assets = new Map();  // Stores the raw GLTF data
        this.dynamic_bodies = new Map(); // Stores [mesh, physicsBody] pairs
        this.static_meshes = new Map();  // Stores static meshes without physics
        this.loading_promises = new Map();
        this.material_cache = new Map(); // Initialize material cache
        this.emission_states = new Map(); // Track emission states of objects
        this.currently_activated_name = "";  // Track the currently activated object
        this.instance_counter = 0;
    }

    // Core storage methods
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

    // Dynamic bodies management
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

    // Static meshes management
    store_static_mesh(instance_id, mesh) {
        this.static_meshes.set(instance_id, mesh);
    }

    get_static_mesh(instance_id) {
        return this.static_meshes.get(instance_id);
    }

    get_all_static_meshes() {
        return Array.from(this.static_meshes.values());
    }

    // Material cache management
    store_material(key, material) {
        this.material_cache.set(key, material);
    }

    get_material(key) {
        return this.material_cache.get(key);
    }

    has_material(key) {
        return this.material_cache.has(key);
    }

    // Emission state management
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

    // Object existence check
    contains_object(object_name) {
        for (const [mesh, _body] of this.get_all_dynamic_bodies()) {
            if (mesh.name === object_name) return true;
        }
        return false;
    }

    // Cleanup
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
}