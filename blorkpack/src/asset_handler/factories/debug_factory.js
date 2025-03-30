import { THREE, RAPIER } from "../../index.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";
import { SystemAssetType } from "../common/system_asset_types.js";
import { AssetStorage } from "../../asset_storage.js";
import { 
	create_debug_wireframe,
	update_debug_wireframes,
	set_collision_debug,
	create_debug_wireframes_for_all_bodies,
	cleanup_wireframes,
	get_debug_wireframes
} from "../spawners/debug_spawners/wireframe_spawner.js";
import { 
	create_debug_mesh,
	update_debug_meshes,
	forceSpotlightDebugUpdate,
	despawn_debug_meshes,
	cleanup_spotlight_debug_meshes
} from "../spawners/debug_spawners/debug_mesh_spawner.js";

/**
 * Factory class responsible for creating and managing debug visualizations.
 * Handles debug wireframes for physics colliders and spotlight debug meshes.
 * Implements singleton pattern for global access.
 */
export class DebugFactory {
	static #instance = null;
	static #disposed = false;
	scene;
	world;
	storage;

	/**
     * Constructor
     * @param {THREE.Scene} scene - The Three.js scene to add objects to
     * @param {RAPIER.World} world - The Rapier physics world
     */
	constructor(scene = null, world = null) {
		if (DebugFactory.#instance) {
			throw new Error('DebugFactory is a singleton. Use DebugFactory.get_instance() instead.');
		}
		this.scene = scene;
		this.world = world;
		this.storage = AssetStorage.get_instance();
		DebugFactory.#instance = this;
		DebugFactory.#disposed = false;
	}

	/**
     * Gets or creates the singleton instance of DebugFactory.
     * @param {THREE.Scene} scene - The Three.js scene to add objects to
     * @param {RAPIER.World} world - The Rapier physics world
     * @returns {DebugFactory} The singleton instance
     */
	static get_instance(scene, world) {
		if (DebugFactory.#disposed) {
			DebugFactory.#instance = null;
			DebugFactory.#disposed = false;
		}
		if (!DebugFactory.#instance) {
			DebugFactory.#instance = new DebugFactory(scene, world);
		} else if (scene || world) {
			if (scene) DebugFactory.#instance.scene = scene;
			if (world) DebugFactory.#instance.world = world;
		}
		return DebugFactory.#instance;
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
		return create_debug_wireframe(this.scene, this.world, type, dimensions, position, rotation, options);
	}

	/**
     * Updates the positions of debug wireframes based on physics bodies
     */
	update_debug_wireframes() {
		return update_debug_wireframes(this.storage);
	}

	/**
     * Sets the collision debug state
     * This allows the main application to control debug visualization
     * @param {boolean} enabled - Whether collision debug should be enabled
     */
	async set_collision_debug(enabled) {
		return set_collision_debug(this.scene, this.world, this.storage, enabled);
	}

	/**
     * Creates debug wireframes for all physics bodies
     * This is used when enabling debug visualization after objects are already created
     */
	async create_debug_wireframes_for_all_bodies() {
		return create_debug_wireframes_for_all_bodies(this.scene, this.world, this.storage);
	}

	/**
     * Creates a debug mesh visualization for the specified asset type
     * Used for debugging purposes
     * 
     * @param {string} asset_type - The type of asset to create a debug mesh for
     * @param {THREE.Object3D} asset - The asset to create debug meshes for
     * @returns {Promise<Object>} The created debug mesh objects
     */
	async create_debug_mesh(asset_type, asset) {
		return create_debug_mesh(this.scene, asset_type, asset);
	}

	/**
     * Removes debug mesh visualizations for the specified asset
     * 
     * @param {THREE.Object3D} asset - The asset whose debug meshes should be removed
     * @returns {Promise<void>}
     */
	async despawn_debug_meshes(asset) {
		return despawn_debug_meshes(asset);
	}

	/**
     * Updates all debug mesh visualizations to match their associated assets
     * Called from the main animation loop
     */
	async update_debug_meshes() {
		return update_debug_meshes(this.scene);
	}

	/**
     * Forces a full update of all debug mesh visualizations on next call
     * Call this when you know assets have been added or removed
     */
	async forceDebugMeshUpdate() {
		return forceSpotlightDebugUpdate(this.scene);
	}

	/**
     * Cleanup of debug-specific resources
     */
	cleanup_debug() {
		// Clean up wireframe resources
		cleanup_wireframes();
        
		// Clean up spotlight debug visualizations
		cleanup_spotlight_debug_meshes(this.storage);
	}

	/**
     * Updates all visual elements including debug wireframes and spotlight debug meshes
     */
	update_visualizations() {
		// Update debug wireframes if enabled
		if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
			this.update_debug_wireframes();
		}
		// Update spotlight debug meshes
		this.update_debug_meshes();
	}

	/**
     * Dispose of the factory instance and clean up resources
     */
	dispose() {
		if (!DebugFactory.#instance) return;
		// Clean up resources
		this.cleanup_debug();
		// Clear references
		this.scene = null;
		this.world = null;
		this.storage = null;
		DebugFactory.#disposed = true;
		DebugFactory.#instance = null;
	}

	/**
     * Static method to dispose of the singleton instance
     */
	static dispose_instance() {
		if (DebugFactory.#instance) {
			DebugFactory.#instance.dispose();
		}
	}
}
