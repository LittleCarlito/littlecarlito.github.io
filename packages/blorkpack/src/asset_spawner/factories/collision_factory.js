import { THREE, RAPIER } from "../../index.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";
import { get_collision_spawner } from "../collision_spawners/index.js";

/**
 * Factory class responsible for creating and managing physics colliders.
 * Handles both static and dynamic colliders with various shapes.
 */
export class CollisionFactory {
    static #instance = null;
    static #disposed = false;
    world;

    /**
     * Constructor
     * @param {RAPIER.World} target_world - The physics world
     */
    constructor(target_world = null) {
        if (CollisionFactory.#instance) {
            throw new Error('CollisionFactory is a singleton. Use CollisionFactory.get_instance() instead.');
        }
        this.world = target_world;
        CollisionFactory.#instance = this;
        CollisionFactory.#disposed = false;
    }

    /**
     * Gets or creates the singleton instance of CollisionFactory.
     * @param {RAPIER.World} world - The Rapier physics world.
     * @returns {CollisionFactory} The singleton instance.
     */
    static get_instance(world) {
        if (CollisionFactory.#disposed) {
            CollisionFactory.#instance = null;
            CollisionFactory.#disposed = false;
        }
        if (!CollisionFactory.#instance) {
            CollisionFactory.#instance = new CollisionFactory(world);
        } else if (world) {
            CollisionFactory.#instance.world = world;
        }
        return CollisionFactory.#instance;
    }

    /**
     * Creates a collider from a mesh
     * @param {THREE.Mesh} mesh - The mesh to create a collider from
     * @param {RAPIER.RigidBody} body - The rigid body to attach the collider to
     * @param {Object} asset_config - Asset configuration data
     * @param {Object} [options={}] - Additional options for collider creation
     * @returns {Promise<RAPIER.Collider>} The created collider
     */
    async create_collider_from_mesh(mesh, body, asset_config, options = {}) {
        // Determine the shape type from the mesh name or options
        let shape_type = 'box'; // Default to box
        if (mesh.name.includes('sphere') || mesh.name.includes('ball')) {
            shape_type = 'sphere';
        } else if (mesh.name.includes('capsule')) {
            shape_type = 'capsule';
        } else if (options.shape_type) {
            shape_type = options.shape_type;
        }

        // Get the appropriate spawner
        const spawner = get_collision_spawner(shape_type, this.world);
        return spawner.create_collider_from_mesh(mesh, body, asset_config, options);
    }

    /**
     * Creates a debug wireframe for visualizing physics shapes
     * @param {string} type - The type of wireframe to create
     * @param {Object} dimensions - The dimensions of the wireframe
     * @param {THREE.Vector3} position - The position of the wireframe
     * @param {THREE.Quaternion} rotation - The rotation of the wireframe
     * @param {Object} options - Additional options for the wireframe
     * @returns {Promise<THREE.Mesh>} The created wireframe mesh
     */
    async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
        // Get the appropriate spawner based on the type
        const spawner = get_collision_spawner(type, this.world);
        return spawner.create_debug_wireframe(type, dimensions, position, rotation, options);
    }

    /**
     * Dispose of the factory instance and clean up resources
     */
    dispose() {
        if (!CollisionFactory.#instance) return;
        this.world = null;
        CollisionFactory.#disposed = true;
        CollisionFactory.#instance = null;
    }

    /**
     * Static method to dispose of the singleton instance
     */
    static dispose_instance() {
        if (CollisionFactory.#instance) {
            CollisionFactory.#instance.dispose();
        }
    }
}
