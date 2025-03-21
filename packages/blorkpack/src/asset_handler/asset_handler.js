import { THREE, RAPIER } from "../index.js";
import CustomTypeManager from "../custom_type_manager.js";
import { AssetStorage } from "../asset_storage.js";
import { BLORKPACK_FLAGS } from "../blorkpack_flags.js";
import { 
	SystemAssetType, 
	SystemFactory, 
	CustomFactory, 
	IdGenerator,
	create_spotlight_debug_mesh,
	update_debug_meshes,
	forceSpotlightDebugUpdate
} from "./index.js";
import { CollisionFactory } from "./factories/collision_factory.js";
import { DebugFactory } from "./factories/debug_factory.js";
/**
 * Class responsible for spawning and managing 3D assets in the scene.
 * Handles both static and dynamic (physics-enabled) assets.
 */
export class AssetHandler {
	static #instance = null;
	static #disposed = false;
	storage;
	container;
	world;
	scene;
	// Cache the types and configs from CustomTypeManager
	#assetTypes = null;
	#assetConfigs = null;
	// Debug factory instance
	debugFactory = null;
	/**
     * Constructor
     * @param {Object} target_container - The container to spawn assets into
     * @param {Object} target_world - The physics world
     */
	constructor(target_container = null, target_world = null) {
		if (AssetHandler.#instance) {
			throw new Error('AssetHandler is a singleton. Use AssetHandler.get_instance() instead.');
		}
		this.storage = AssetStorage.get_instance();
		this.container = target_container;
		this.world = target_world;
		// Cache asset types and configs
		this.#assetTypes = CustomTypeManager.getTypes();
		this.#assetConfigs = CustomTypeManager.getConfigs();
		AssetHandler.#instance = this;
		AssetHandler.#disposed = false;
	}
	/**
     * Gets or creates the singleton instance of AssetHandler.
     * @param {THREE.Scene} scene - The Three.js scene to add objects to.
     * @param {RAPIER.World} world - The Rapier physics world.
     * @returns {AssetHandler} The singleton instance.
     */
	static get_instance(scene, world) {
		if (AssetHandler.#disposed) {
			AssetHandler.#instance = null;
			AssetHandler.#disposed = false;
		}
		if (!AssetHandler.#instance) {
			AssetHandler.#instance = new AssetHandler(scene, world);
		} else if (scene || world) {
			if (scene) AssetHandler.#instance.scene = scene;
			if (world) AssetHandler.#instance.world = world;
		}
		
		// Initialize DebugFactory if needed
		if (scene && world && !AssetHandler.#instance.debugFactory) {
			AssetHandler.#instance.debugFactory = DebugFactory.get_instance(scene, world);
		}
		
		return AssetHandler.#instance;
	}
	/**
     * Spawns an asset of the specified type at the given position with the given rotation.
     * @param {string} asset_type - The type of asset to spawn.
     * @param {THREE.Vector3} position - The position to spawn the asset at.
     * @param {THREE.Quaternion} rotation - The rotation of the asset.
     * @param {Object} options - Additional options for spawning.
     * @returns {Promise<Object>} A promise that resolves with the spawned asset details.
     */
	async spawn_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
		// Handle SystemAssetType enum objects by extracting the value property
		let type_value = typeof asset_type === 'object' && asset_type.value ? asset_type.value : asset_type;
		try {
			// Check if this is a system asset type
			if (SystemAssetType.isSystemAssetType(type_value)) {
				// Handle camera and spotlight in AssetHandler for now
				if (type_value === SystemAssetType.CAMERA.value) {
					return this.spawn_scene_camera(options);
				}
				if (type_value === SystemAssetType.SPOTLIGHT.value) {
					// Delegate spotlight creation to SystemFactory
					const system_factory = SystemFactory.get_instance(this.scene, this.world);
					return await system_factory.spawn_asset(asset_type, position, rotation, options);
				}
				// Delegate other system asset types to SystemFactory
				const system_factory = SystemFactory.get_instance(this.scene, this.world);
				return await system_factory.spawn_asset(asset_type, position, rotation, options);
			}
			// Check if the asset type exists in custom types
			if (CustomTypeManager.hasLoadedCustomTypes()) {
				// Check if the type exists directly
				if (CustomTypeManager.hasType(type_value)) {
					// Get CustomFactory instance
					const custom_factory = CustomFactory.get_instance(this.scene, this.world);
					// Spawn the custom asset using CustomFactory
					return await custom_factory.spawn_custom_asset(type_value, position, rotation, options);
				} else {
					// Not a system asset type or custom asset type - log error and return
					// Check if custom types have been loaded at all
					if (!CustomTypeManager.hasLoadedCustomTypes()) {
						console.error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
						console.error(`Failed to spawn asset type: "${type_value}"`);
					} else {
						console.error(`Unsupported asset type: "${type_value}". Cannot spawn asset.`);
						console.error(`Available types:`, Object.keys(CustomTypeManager.getTypes()));
					}
					return null;
				}
			}
		} catch (error) {
			// Handle the case where type_value might not be defined yet
			if (typeof type_value !== 'undefined') {
				console.error(`Error spawning asset ${type_value}:`, error);
			} else {
				console.error(`Error spawning asset (type unknown):`, error);
				console.error(`Original asset_type:`, asset_type);
			}
			return null;
		}
	}
	/**
     * Creates a debug wireframe for visualizing physics shapes.
     * Delegates to DebugFactory.
     * @param {string} type - The type of wireframe to create.
     * @param {Object} dimensions - The dimensions of the wireframe.
     * @param {THREE.Vector3} position - The position of the wireframe.
     * @param {THREE.Quaternion} rotation - The rotation of the wireframe.
     * @param {Object} options - Additional options for the wireframe.
     * @returns {Promise<THREE.Mesh>} The created wireframe mesh.
     */
	async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.create_debug_wireframe(type, dimensions, position, rotation, options);
	}
	/**
     * Updates the positions of debug wireframes based on physics bodies.
     * Delegates to DebugFactory.
     */
	update_debug_wireframes() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.update_debug_wireframes();
	}
	/**
     * Core cleanup of essential resources.
     */
	cleanup() {
		// Reset singleton instance
		AssetHandler.#instance = null;
		// Clean up any core asset management resources
		if (this.storage) {
			// Clean up any remaining assets in storage
			const allAssets = this.storage.get_all_assets();
			allAssets.forEach(asset => {
				if (asset && asset.mesh && asset.mesh.parent) {
					asset.mesh.parent.remove(asset.mesh);
				}
			});
		}
		// Clean up any core physics resources
		if (this.world) {
			// Clean up any remaining physics bodies
			const dynamicBodies = this.storage.get_all_dynamic_bodies();
			dynamicBodies.forEach(([mesh, body]) => {
				if (body) {
					this.world.removeRigidBody(body);
				}
			});
		}
		// Clear references
		this.storage = null;
		this.container = null;
		this.world = null;
		this.#assetTypes = null;
		this.#assetConfigs = null;
	}
	/**
     * Cleanup of debug-specific resources.
     * Delegates to DebugFactory.
     */
	cleanup_debug() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.cleanup_debug();
	}
	/**
     * Updates all visual elements including debug wireframes and spotlight debug meshes.
     * Delegates to DebugFactory.
     */
	update_visualizations() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.update_visualizations();
	}
	/**
     * Sets the collision debug state for this spawner.
     * Delegates to DebugFactory.
     * @param {boolean} enabled - Whether collision debug should be enabled
     */
	async set_collision_debug(enabled) {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.set_collision_debug(enabled);
	}
	/**
     * Creates debug wireframes for all physics bodies.
     * Delegates to DebugFactory.
     */
	async create_debug_wireframes_for_all_bodies() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.create_debug_wireframes_for_all_bodies();
	}
	/**
     * @deprecated
     * Sets the collision debug state for this spawner.
     * This allows the main application to control debug visualization.
     * @param {boolean} enabled - Whether collision debug should be enabled
     */
	static createDisplayMeshMaterial(displayMode = 0) {
		let material;
		switch(displayMode) {
		case 0: // Transparent
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,            // White base color
				transparent: true,           // Enable transparency
				opacity: 0.0,                // Fully transparent
				side: THREE.DoubleSide
			});
			break;
		case 1: // Black Screen
			material = new THREE.MeshStandardMaterial({
				color: 0x000000,            // Black base color
				emissive: 0x000000,         // No emission (black)
				emissiveIntensity: 0,       // No emission intensity
				side: THREE.DoubleSide
			});
			break;
		case 2: // White Screen
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,            // White base color
				emissive: 0xffffff,         // White emission
				emissiveIntensity: 0.3,     // Moderate emission intensity to avoid too bright
				side: THREE.DoubleSide
			});
			break;
		default: // Default to transparent if invalid mode
			console.warn(`Invalid display mode: ${displayMode}, defaulting to transparent`);
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.0,
				side: THREE.DoubleSide
			});
		}
		return material;
	}
	/**
     * Spawns assets from asset groups defined in the manifest
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of spawned assets
     */
	async spawn_asset_groups(manifest_manager, progress_callback = null) {
		const spawned_assets = [];
		try {
			// Get all asset groups from manifest
			const asset_groups = manifest_manager.get_all_asset_groups();
			if (!asset_groups || asset_groups.length === 0) {
				if (BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log("No asset groups found in manifest");
				}
				return spawned_assets;
			}
			// Find active asset groups
			const active_groups = asset_groups.filter(group => group.active);
			// Process each active group
			for (const group of active_groups) {
				if (progress_callback) {
					progress_callback(`Loading asset group: ${group.name}...`);
				}
				// Process each asset in the group
				for (const asset_id of group.assets) {
					const asset_data = manifest_manager.get_asset(asset_id);
					if (asset_data) {
						// Get asset type information
						const asset_type = asset_data.asset_type;
						const custom_type = manifest_manager.get_custom_type(asset_type);
						if (custom_type) {
							// Extract position and rotation from asset data
							const position = new THREE.Vector3(
								asset_data.position?.x || 0, 
								asset_data.position?.y || 0, 
								asset_data.position?.z || 0
							);
							// Create rotation from Euler angles
							const rotation = new THREE.Euler(
								asset_data.rotation?.x || 0,
								asset_data.rotation?.y || 0,
								asset_data.rotation?.z || 0
							);
							const quaternion = new THREE.Quaternion().setFromEuler(rotation);
							// Prepare options from asset data
							const options = {
								scale: asset_data.scale,
								material: asset_data.material,
								collider: asset_data.collider,
								mass: asset_data.mass,
								...asset_data.options
							};
							// Spawn the asset using the existing spawn_asset method
							const result = await this.spawn_asset(
								asset_type,
								position,
								quaternion,
								options
							);
							if (result) {
								// Store the asset ID with the spawned asset data
								result.id = asset_id;
								spawned_assets.push(result);
							}
						} else if (BLORKPACK_FLAGS.ASSET_LOGS) {
							console.warn(`Custom type "${asset_type}" not found for asset ${asset_id}`);
						}
					} else if (BLORKPACK_FLAGS.ASSET_LOGS) {
						console.warn(`Asset with ID "${asset_id}" not found in manifest`);
					}
				}
			}
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Spawned ${spawned_assets.length} assets from manifest`);
			}
		} catch (error) {
			console.error('Error spawning asset groups:', error);
		}
		return spawned_assets;
	}
	/**
     * Spawns all assets from the manifest, routing system assets to SystemFactory
     * and handling custom assets directly.
     * 
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of all spawned assets
     */
	async spawn_manifest_assets(manifest_manager, progress_callback = null) {
		const spawned_assets = [];
		try {
			// Get all assets from manifest
			const system_assets = manifest_manager.get_system_assets();
			const custom_assets = manifest_manager.get_custom_assets();
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Found ${system_assets.length} system assets and ${custom_assets.length} custom assets to spawn`);
			}
			// Initialize SystemFactory if we have system assets
			if (system_assets && system_assets.length > 0) {
				if (progress_callback) {
					progress_callback('Loading system assets...');
				}
				// Get SystemFactory instance
				const system_factory = SystemFactory.get_instance(this.scene, this.world);
				// Spawn system assets
				const system_results = await system_factory.spawn_system_assets(manifest_manager, progress_callback);
				spawned_assets.push(...system_results);
			}
			// Spawn custom assets
			if (custom_assets && custom_assets.length > 0) {
				if (progress_callback) {
					progress_callback('Loading custom assets...');
				}
				// Get CustomFactory instance and spawn custom assets
				const custom_factory = CustomFactory.get_instance(this.scene, this.world);
				const custom_results = await custom_factory.spawn_custom_assets(manifest_manager, progress_callback);
				spawned_assets.push(...custom_results);
			}
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Spawned ${spawned_assets.length} total assets from manifest`);
			}
			return spawned_assets;
		} catch (error) {
			console.error("Error spawning manifest assets:", error);
			return spawned_assets;
		}
	}
	/**
     * @deprecated
     * Spawns a scene camera based on the camera configuration from the manifest.
     * This method creates a simple camera without any additional functionality.
     * 
     * @param {Object} camera_config - The camera configuration object from manifest
     * @returns {THREE.PerspectiveCamera} The created camera
     */
	spawn_scene_camera(camera_config) {
		if (!camera_config) {
			console.error("No camera configuration provided to spawn_scene_camera");
			return null;
		}
		// Create the camera using the configuration
		const camera = new THREE.PerspectiveCamera(
			// Field of view
			camera_config.fov || 75,
			// Default aspect ratio (will be updated when added to scene)
			window.innerWidth / window.innerHeight,
			// Near and far clipping planes
			camera_config.near || 0.1,
			camera_config.far || 1000
		);
		// Set camera position from config
		camera.position.set(
			camera_config.position?.x || 0,
			camera_config.position?.y || 5,
			camera_config.position?.z || 10
		);
		// Store camera reference in asset storage
		const camera_id = IdGenerator.get_instance().generate_asset_id();
		this.storage.store_static_mesh(camera_id, camera);
		return camera;
	}
	/**
     * Creates a debug mesh visualization for the specified asset type.
     * Delegates to DebugFactory.
     * 
     * @param {string} asset_type - The type of asset to create a debug mesh for
     * @param {THREE.Object3D} asset - The asset to create debug meshes for
     * @returns {Promise<Object>} The created debug mesh objects
     */
	async create_debug_mesh(asset_type, asset) {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.create_debug_mesh(asset_type, asset);
	}
	/**
     * Removes debug mesh visualizations for the specified asset.
     * Delegates to DebugFactory.
     * 
     * @param {THREE.Object3D} asset - The asset whose debug meshes should be removed
     * @returns {Promise<void>}
     */
	async despawn_debug_meshes(asset) {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.despawn_debug_meshes(asset);
	}
	/**
     * Updates all debug mesh visualizations to match their associated assets.
     * Delegates to DebugFactory.
     */
	async update_debug_meshes() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.update_debug_meshes();
	}
	/**
     * Forces a full update of all debug mesh visualizations on next call.
     * Delegates to DebugFactory.
     */
	async forceDebugMeshUpdate() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.forceDebugMeshUpdate();
	}
	/**
     * Dispose of the spawner instance and clean up resources
     */
	dispose() {
		if (!AssetHandler.#instance) return;
		// Dispose of factories
		CustomFactory.dispose_instance();
		CollisionFactory.dispose_instance();
		DebugFactory.dispose_instance();
		// Clear references
		this.scene = null;
		this.world = null;
		this.storage = null;
		this.container = null;
		this.debugFactory = null;
		AssetHandler.#disposed = true;
		AssetHandler.#instance = null;
	}
	/**
	 *
	 */
	static dispose_instance() {
		if (AssetHandler.#instance) {
			AssetHandler.#instance.dispose();
		}
	}
} 