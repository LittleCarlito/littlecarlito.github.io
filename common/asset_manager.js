import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Easing, Tween, RAPIER, THREE, NAMES } from ".";
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";
import { FLAGS } from "./flags";

// Define all possible asset types that can be loaded and spawned
export const ASSET_TYPE = {
    AXE: 'AXE',
    DIPLOMA: 'DIPLOMA',
    DESK: 'DESK',
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
        name: "diploma",
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

        console.log(`Created rigid body for ${asset_type}:`, body);

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
            console.log(`Created cube collider:`, created_collider);
        } else {
            // Normal GLB asset loading path
            if (!this.loaded_assets.has(asset_type)) {
                await this.load_asset_type(asset_type);
            }
            const gltf = this.loaded_assets.get(asset_type);
            mesh = gltf.scene.clone();
            mesh.position.copy(position_offset);
            mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
            
            // Set name on parent mesh
            mesh.name = `${TYPES.INTERACTABLE}${asset_config.name}`;
            
            // Look for collision mesh
            let collision_geometry;
            mesh.traverse((child) => {
                if (child.isMesh) {
                    // Skip collision meshes for material handling
                    if (child.name.startsWith('col_')) {
                        child.visible = false;
                        return;
                    }

                    // Clone the material but preserve all original properties
                    const originalMaterial = child.material;
                    child.material = originalMaterial.clone();
                    
                    // Preserve all material properties
                    child.material.color = originalMaterial.color;
                    child.material.map = originalMaterial.map;
                    child.material.normalMap = originalMaterial.normalMap;
                    child.material.roughnessMap = originalMaterial.roughnessMap;
                    child.material.metalnessMap = originalMaterial.metalnessMap;
                    child.material.aoMap = originalMaterial.aoMap;
                    child.material.emissiveMap = originalMaterial.emissiveMap;
                    child.material.emissive = originalMaterial.emissive;
                    child.material.emissiveIntensity = originalMaterial.emissiveIntensity;
                    
                    // Preserve material parameters
                    child.material.metalness = originalMaterial.metalness;
                    child.material.roughness = originalMaterial.roughness;
                    child.material.envMapIntensity = originalMaterial.envMapIntensity || 1;
                    
                    // Enable necessary material features
                    child.material.transparent = originalMaterial.transparent;
                    child.material.opacity = originalMaterial.opacity;
                    child.material.side = originalMaterial.side;
                    child.material.depthTest = true;
                    child.material.needsUpdate = true;

                    // Enable shadows
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Debug log
                    console.log(`Material settings for ${child.name}:`, {
                        color: child.material.color,
                        metalness: child.material.metalness,
                        roughness: child.material.roughness,
                        maps: {
                            diffuse: !!child.material.map,
                            normal: !!child.material.normalMap,
                            roughness: !!child.material.roughnessMap,
                            metalness: !!child.material.metalnessMap,
                            ao: !!child.material.aoMap,
                            emissive: !!child.material.emissiveMap
                        }
                    });

                    // Check if this is a collision mesh
                    if (child.name.startsWith('col_')) {
                        collision_geometry = child.geometry;
                        child.visible = false; // Hide collision mesh
                    }
                }
            });

            // Create collider based on found collision mesh or fallback to bounding box
            if (collision_geometry) {
                const vertices = collision_geometry.attributes.position.array;
                const indices = collision_geometry.index ? collision_geometry.index.array : undefined;
                
                // Apply scale to vertices directly instead of using setScale
                const scaledVertices = new Float32Array(vertices.length);
                for (let i = 0; i < vertices.length; i++) {
                    scaledVertices[i] = vertices[i] * asset_config.scale;
                }
                
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
                
                const created_collider = world.createCollider(collider, body);
                console.log(`Created collision mesh collider:`, created_collider);
            } else {
                // Fallback to bounding box if no collision mesh found
                console.warn(`No collision mesh found for ${asset_type}, falling back to bounding box`);
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
                    console.log(`Created bounding box collider:`, created_collider);
                    console.log(`Collider dimensions:`, {
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
            mesh.traverse((child) => {
                if (child.isMesh) {
                    child.material.depthTest = true;
                    child.material.transparent = true;
                }
            });
        }
        mesh.position.copy(position_offset);
        if (rotation) mesh.rotation.copy(rotation);
        mesh.renderOrder = 0;
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

    /**
     * Activates an object by setting its material to emit light
     * @param {string} object_name - Name of the object to activate
     */
    activate_object(object_name) {
        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Attempting to activate: ${object_name}`);
        
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
                    const emission_material = new THREE.MeshStandardMaterial({ 
                        color: category.color,
                        emissive: category.color,
                        emissiveIntensity: 9
                    });
                    if (mesh.material) mesh.material.dispose();
                    mesh.material = emission_material;
                }
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`[AssetManager] No mesh found for category: ${requested_category}`);
        }
    }

    /**
     * Deactivates an object by tweening its emission to zero
     * @param {string} object_name - Name of the object to deactivate
     */
    deactivate_object(object_name) {
        if (!object_name) return;
        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Attempting to deactivate: ${object_name}`);
        
        const requested_category = object_name.split("_")[1];
        let found = false;
        
        for (const [instance_id, [mesh, _body]] of this.dynamic_bodies) {
            const mesh_category = mesh.name.split("_")[1];
            
            if (mesh_category === requested_category && mesh.material?.emissiveIntensity > 1) {
                found = true;
                if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Found mesh to deactivate: ${mesh.name}`);
                new Tween(mesh.material)
                    .to({ emissiveIntensity: 0 })
                    .easing(Easing.Sinusoidal.Out)
                    .start();
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`[AssetManager] No active mesh found for category: ${requested_category}`);
        }
    }

    /**
     * Deactivates all objects that match the given type prefix, or all objects if no prefix provided
     * @param {string} [type_prefix] - Optional prefix to match object names against
     */
    deactivate_all_objects(type_prefix = null) {
        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Deactivating all objects${type_prefix ? ` with prefix: ${type_prefix}` : ''}`);
        let deactivation_count = 0;
        
        for (const [instance_id, [mesh, _body]] of this.dynamic_bodies) {
            if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Checking mesh: ${mesh.name}`);
            
            if (type_prefix && !mesh.name.startsWith(type_prefix)) {
                continue;
            }
            
            if (mesh.material && 
                mesh.material.emissive && 
                mesh.material.emissiveIntensity > 0) {
                if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Deactivating emissive mesh: ${mesh.name}`);
                new Tween(mesh.material)
                    .to({ emissiveIntensity: 0 })
                    .easing(Easing.Sinusoidal.Out)
                    .start();
                deactivation_count++;
            }
        }
        
        if (FLAGS.ACTIVATE_LOGS) console.log(`[AssetManager] Deactivated ${deactivation_count} objects`);
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