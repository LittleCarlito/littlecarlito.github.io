import { THREE, RAPIER } from "../../index.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";
import { SystemAssetType } from "../common/system_asset_types.js";
import { AssetStorage } from "../../asset_storage.js";
import { 
	create_debug_mesh,
	update_debug_meshes,
	forceSpotlightDebugUpdate,
	despawn_debug_meshes,
	cleanup_spotlight_debug_meshes
} from "../spawners/debug_spawners/debug_mesh_spawner.js";

/**
 * Factory class responsible for creating and managing debug visualizations.
 * Handles spotlight debug meshes and other debug visualization tasks.
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
		cleanup_spotlight_debug_meshes(this.storage);
	}

	/**
     * Updates all visual elements including spotlight debug meshes
     */
	update_visualizations() {
		this.update_debug_meshes();
	}

	/**
     * Dispose of the factory instance and clean up resources
     */
	dispose() {
		if (!DebugFactory.#instance) return;
		this.cleanup_debug();
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