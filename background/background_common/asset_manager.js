import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { RAPIER, THREE } from "../../common";

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
        scale: 20,
        mass: 5,
        restitution: .1,
    },
    [ASSET_TYPE.DIPLOMA]: {
        PATH: "assets/diploma.glb",
        scale: 10,
        mass: 1,
        restitution: .2,
    },
    [ASSET_TYPE.DESK]: {
        PATH: "assets/desk.glb",
        scale: 2,
        mass: 1,
        restitution: .5,
    },
    [ASSET_TYPE.CUBE]: {
        // No PATH needed as it's a primitive
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

    /**
     * Spawns a physics-enabled asset of the specified type
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum
     * @param {THREE.Object3D} parent - Parent object to add the mesh to
     * @param {RAPIER.World} world - Physics world to create the body in
     * @param {THREE.Vector3} position_offset - Position offset from parent
     * @param {Object} options - Additional options (e.g., color for cubes)
     * @returns {Array} [mesh, body] pair for physics updates
     */
    async spawn_asset(asset_type, parent, world, position_offset, options = {}) {
        if (!Object.values(ASSET_TYPE).includes(asset_type)) {
            throw new Error(`Invalid asset type: ${asset_type}`);
        }
        const asset_config = ASSET_CONFIGS[asset_type];
        let mesh;
        // Special handling for CUBE type since it's a primitive
        if (asset_type === ASSET_TYPE.CUBE) {
            mesh = new THREE.Mesh(
                asset_config.geometry,
                asset_config.create_material(options.color || 0xffffff)
            );
            mesh.position.copy(position_offset);
            mesh.castShadow = true;
        } else {
            // Normal GLB asset loading path
            if (!this.loaded_assets.has(asset_type)) {
                await this.load_asset_type(asset_type);
            }
            const gltf = this.loaded_assets.get(asset_type);
            mesh = gltf.scene.clone();
            mesh.position.copy(position_offset);
            mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
        }
        // Add mesh to parent
        parent.add(mesh);
        // Create physics body
        const body = world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(position_offset.x, position_offset.y, position_offset.z)
                .setCanSleep(false)
        );
        // Create collider based on asset type
        if (asset_type === ASSET_TYPE.CUBE) {
            // Cube uses simple box collider with unit dimensions
            const collider = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
                .setMass(asset_config.mass)
                .setRestitution(asset_config.restitution);
            world.createCollider(collider, body);
        } else {
            // Other assets use computed bounding box
            let geometry;
            mesh.traverse((child) => {
                if (child.isMesh) geometry = child.geometry;
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

                world.createCollider(collider, body);
            }
        }
        const instance_id = `${asset_type}_${Date.now()}`;
        const body_pair = [mesh, body];
        this.dynamic_bodies.set(instance_id, body_pair);

        return body_pair;
    }

    /**
     * Creates a static (non-physics) mesh of the specified asset type
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum
     * @param {THREE.Object3D} parent - Parent object to add the mesh to
     * @param {THREE.Vector3} position_offset - Position offset from parent
     * @returns {THREE.Object3D} The created mesh
     */
    async create_static_mesh(asset_type, parent, position_offset) {
        if (!Object.values(ASSET_TYPE).includes(asset_type)) {
            throw new Error(`Invalid asset type: ${asset_type}`);
        }
        const asset_config = ASSET_CONFIGS[asset_type];
        let mesh;
        // Handle primitive cube differently
        if (asset_type === ASSET_TYPE.CUBE) {
            mesh = new THREE.Mesh(
                asset_config.geometry,
                asset_config.create_material(0xffffff)
            );
            mesh.castShadow = true;
        } else {
            // Load and setup GLB model
            if (!this.loaded_assets.has(asset_type)) {
                await this.load_asset_type(asset_type);
            }
            const gltf = this.loaded_assets.get(asset_type);
            mesh = gltf.scene.clone();
            mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
        }
        mesh.position.copy(position_offset);
        // Add to parent and tracking
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
}