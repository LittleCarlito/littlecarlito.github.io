import { THREE, RAPIER } from "../../index.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";
import {
	create_primitive_box,
	create_primitive_sphere,
	create_primitive_capsule,
	create_primitive_cylinder,
	create_spotlight
} from '../index.js';
import { SystemAssetType } from "../common/system_asset_types.js";
import { AssetHandler } from "../asset_handler.js";
import { IdGenerator } from "../common/id_generator.js";
/**
 * Factory class responsible for creating and managing system-level assets.
 * Implements singleton pattern for global access.
 */
export class SystemFactory {
	static instance = null;
	/**
	 *
	 */
	constructor(scene, world) {
		if (SystemFactory.instance) {
			return SystemFactory.instance;
		}
		this.scene = scene;
		this.world = world;
		SystemFactory.instance = this;
	}
	/**
     * Gets or creates the singleton instance of SystemFactory.
     * @param {THREE.Scene} scene - The Three.js scene to add objects to.
     * @param {RAPIER.World} world - The Rapier physics world.
     * @returns {SystemFactory} The singleton instance.
     */
	static get_instance(scene, world) {
		if (!SystemFactory.instance) {
			SystemFactory.instance = new SystemFactory(scene, world);
		} else {
			// Update scene and world if provided
			if (scene) SystemFactory.instance.scene = scene;
			if (world) SystemFactory.instance.world = world;
		}
		return SystemFactory.instance;
	}
	/**
     * Spawns assets from the manifest's system_assets array.
     * This method handles system-level assets defined in the manifest.
     * 
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of spawned system assets
     */
	async spawn_system_assets(manifest_manager, progress_callback = null) {
		const spawned_assets = [];
		try {
			// Get all system assets from manifest
			const system_assets = manifest_manager.get_system_assets();
			if (!system_assets || system_assets.length === 0) {
				if (BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log("No system assets found in manifest");
				}
				return spawned_assets;
			}
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Found ${system_assets.length} system assets to spawn`);
			}
			// Process each system asset
			for (const asset_data of system_assets) {
				if (progress_callback) {
					progress_callback(`Loading system asset: ${asset_data.id}...`);
				}
				// Get asset type information
				const asset_type_str = asset_data.asset_type;
				// Convert string type to enum if it's a system asset type
				let asset_type = asset_type_str;
				if (SystemAssetType.isSystemAssetType(asset_type_str)) {
					asset_type = SystemAssetType.fromValue(asset_type_str);
				}
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
				// Prepare options based on the asset's configuration
				const options = {
					// Asset configuration
					collidable: asset_data.config?.collidable !== undefined ? asset_data.config.collidable : true,
					hidden: asset_data.config?.hidden !== undefined ? asset_data.config.hidden : false,
					disabled: asset_data.config?.disabled !== undefined ? asset_data.config.disabled : false,
					sleeping: asset_data.config?.sleeping !== undefined ? asset_data.config.sleeping : true,
					gravity: asset_data.config?.gravity !== undefined ? asset_data.config.gravity : true,
					interactable: asset_data.config?.interactable !== undefined ? asset_data.config.interactable : true,
					selectable: asset_data.config?.selectable !== undefined ? asset_data.config.selectable : true,
					highlightable: asset_data.config?.highlightable !== undefined ? asset_data.config.highlightable : true,
					// Properties from additional_properties
					color: asset_data.additional_properties?.color || "0xffffff",
					cast_shadow: asset_data.additional_properties?.cast_shadows !== undefined ? 
						asset_data.additional_properties.cast_shadows : false,
					receive_shadow: asset_data.additional_properties?.receive_shadows !== undefined ? 
						asset_data.additional_properties.receive_shadows : true,
					// Physics properties
					mass: asset_data.additional_properties?.mass !== undefined ? asset_data.additional_properties.mass : 1.0,
					restitution: asset_data.additional_properties?.restitution !== undefined ? 
						asset_data.additional_properties.restitution : 0.5,
					friction: asset_data.additional_properties?.friction !== undefined ? 
						asset_data.additional_properties.friction : 0.5,
					// Size properties
					dimensions: asset_data.additional_properties?.physical_dimensions || {
						width: 1.0,
						height: 1.0,
						depth: 1.0
					},
					// Collider dimensions if specified
					collider_dimensions: asset_data.additional_properties?.collider_dimensions,
					// Additional properties
					custom_data: asset_data.additional_properties,
					raycast_disabled: asset_data.additional_properties?.raycast_disabled
				};
				// Log the asset being created for debugging
				if (BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log(`Creating system asset: ${asset_data.id} (${asset_type_str})`, {
						position,
						dimensions: options.dimensions,
						color: options.color
					});
				}
				// Handle different system asset types
				let result = null;
				// Create an asset handler instance
				const asset_handler = AssetHandler.get_instance();
				// Use spawn_asset for all asset types
				result = await asset_handler.spawn_asset(
					asset_type,
					position,
					quaternion, // For non-Euler rotation types
					{
						...options,
						id: asset_data.id,
						asset_data: asset_data,
						rotation_euler: rotation // Store original Euler rotation if needed
					}
				);
				// If the result is null, fallback to legacy methods
				if (!result) {
					if (BLORKPACK_FLAGS.ASSET_LOGS) {
						console.warn(`Fallback to legacy system spawners for: ${asset_data.id} (${asset_type_str})`);
					}
					if (asset_type_str === SystemAssetType.PRIMITIVE_BOX.value) {
						// Create a primitive box with the specified dimensions and properties
						result = await create_primitive_box(
							this.scene,
							this.world,
							options.dimensions.width, 
							options.dimensions.height, 
							options.dimensions.depth, 
							position, 
							quaternion, 
							options
						);
					} 
					// Handle spotlight asset type
					else if (asset_type_str === SystemAssetType.SPOTLIGHT.value) {
						result = await create_spotlight(
							this.scene,
							asset_data.id,
							position,
							rotation,
							options,
							asset_data
						);
					}
					// Handle primitive sphere asset type
					else if (asset_type_str === SystemAssetType.PRIMITIVE_SPHERE.value) {
						const radius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
						result = await create_primitive_sphere(
							this.scene,
							this.world,
							asset_data.id,
							radius,
							position, 
							quaternion,
							options
						);
					}
					// Handle primitive capsule asset type
					else if (asset_type_str === SystemAssetType.PRIMITIVE_CAPSULE.value) {
						const radius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
						const height = options.dimensions?.height || 1.0;
						result = await create_primitive_capsule(
							this.scene,
							this.world,
							asset_data.id,
							radius,
							height,
							position,
							quaternion,
							options
						);
					}
					// Handle primitive cylinder asset type
					else if (asset_type_str === SystemAssetType.PRIMITIVE_CYLINDER.value) {
						const radius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
						const height = options.dimensions?.height || 1.0;
						result = await create_primitive_cylinder(
							this.scene,
							this.world,
							asset_data.id,
							radius,
							height,
							position,
							quaternion,
							options
						);
					}
				}
				if (result) {
					// Store the asset ID and type with the spawned asset data
					result.id = asset_data.id;
					result.asset_type = asset_type_str;
					spawned_assets.push(result);
					if (BLORKPACK_FLAGS.ASSET_LOGS) {
						console.log(`Spawned system asset: ${asset_data.id} (${asset_type_str})`);
					}
				}
			}
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Spawned ${spawned_assets.length} system assets from manifest`);
			}
			return spawned_assets;
		} catch (error) {
			console.error("Error spawning system assets:", error);
			return spawned_assets;
		}
	}
	/**
     * Spawns a system asset of the specified type at the given position with the given rotation.
     * @param {string|SystemAssetType} asset_type - The type of asset to spawn.
     * @param {THREE.Vector3} position - The position to spawn the asset at.
     * @param {THREE.Quaternion} rotation - The rotation of the asset.
     * @param {Object} options - Additional options for spawning.
     * @returns {Promise<Object>} A promise that resolves with the spawned asset details.
     * @throws {Error} If the requested system type is not supported
     */
	async spawn_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
		// Handle SystemAssetType enum objects by extracting the value property
		let type_value = typeof asset_type === 'object' && asset_type.value ? asset_type.value : asset_type;
		// Verify this is a system asset type
		if (!SystemAssetType.isSystemAssetType(type_value)) {
			throw new Error(`Requested type "${type_value}" is not a supported system asset type`);
		}
		// Convert string type to enum if it's a system asset type
		const asset_type_enum = SystemAssetType.fromValue(type_value);
		// Handle different system asset types
		switch (asset_type_enum) {
		case SystemAssetType.PRIMITIVE_BOX:
			const { width = 1, height = 1, depth = 1 } = options.dimensions || {};
			return create_primitive_box(
				this.scene,
				this.world,
				width,
				height,
				depth,
				position,
				rotation,
				options
			);
		case SystemAssetType.PRIMITIVE_SPHERE:
			const radius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
			return create_primitive_sphere(
				this.scene,
				this.world,
				options.id || IdGenerator.get_instance().generate_asset_id(),
				radius,
				position,
				rotation,
				options
			);
		case SystemAssetType.PRIMITIVE_CAPSULE:
			const capsuleRadius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
			const capsuleHeight = options.dimensions?.height || 1.0;
			return create_primitive_capsule(
				this.scene,
				this.world,
				options.id || IdGenerator.get_instance().generate_asset_id(),
				capsuleRadius,
				capsuleHeight,
				position,
				rotation,
				options
			);
		case SystemAssetType.PRIMITIVE_CYLINDER:
			const cylinderRadius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
			const cylinderHeight = options.dimensions?.height || 1.0;
			return create_primitive_cylinder(
				this.scene,
				this.world,
				options.id || IdGenerator.get_instance().generate_asset_id(),
				cylinderRadius,
				cylinderHeight,
				position,
				rotation,
				options
			);
		case SystemAssetType.SPOTLIGHT:
			return create_spotlight(
				this.scene,
				options.id || IdGenerator.get_instance().generate_asset_id(),
				position,
				rotation,
				options,
				options.asset_data || {}
			);
		default:
			throw new Error(`System asset type "${type_value}" is not supported`);
		}
	}
}
