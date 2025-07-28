import { DEFAULT_ENVIRONMENT, DEFAULT_PHYSICS, DEFAULT_RENDERING } from '../resources/default_configs.js';
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';
/**
 * Singleton class for managing manifest.json data
 */
export class ManifestManager {
	/**
     * IMPORTANT: Always use the getter methods to access manifest data instead of direct access.
     * The getter methods handle null checks and provide default values when properties are missing.
     * This prevents having to do redundant null checks throughout the codebase.
     * 
     * Example:
     * - GOOD: manifest_manager.get_greeting_data().display
     * - BAD:  manifest_manager.get_scene_data()?.greeting_data?.display
     */
	static instance = null;
	/**
	 *
	 */
	constructor() {
		if (ManifestManager.instance) {
			return ManifestManager.instance;
		}
		/** @type {Manifest|null} */
		this.manifest_data = null;
		this.load_promise = null;
		this.is_loaded = false;
		/** @type {string|null} The path that successfully loaded the manifest */
		this.successful_manifest_path = null;
		ManifestManager.instance = this;
	}
	/**
     * Gets or creates the singleton instance of ManifestManager.
     * @returns {ManifestManager} The singleton instance.
     */
	static get_instance() {
		if (!ManifestManager.instance) {
			ManifestManager.instance = new ManifestManager();
		}
		return ManifestManager.instance;
	}
	/**
     * Gets the path that successfully loaded the manifest
     * @returns {string|null} The successful path or null if manifest hasn't been loaded
     */
	get_successful_manifest_path() {
		return this.successful_manifest_path;
	}
	/**
     * Loads the manifest file from specified path.
     * @param {string} [relativePath='resources/manifest.json'] - Path to the manifest file
     * @returns {Promise<Object>} Promise resolving to the manifest data
     */
	async load_manifest(relativePath = 'resources/manifest.json') {
		if (this.is_loaded) {
			return this.manifest_data;
		}
		if (this.load_promise) {
			return this.load_promise;
		}
		// Since we're now at root domain, no base path needed
		const basePath = '';
		const fullPath = `/${relativePath}`.replace(/\/+/g, '/');
		console.log(`Loading manifest from: ${fullPath}`);
		try {
			const response = await fetch(fullPath);
			if (!response.ok) {
				throw new Error(`Failed to load manifest: ${response.status}`);
			}
			const data = await response.json();
			this.manifest_data = data;
			this.is_loaded = true;
			this.successful_manifest_path = fullPath;
			// Log success with clear formatting
			console.log(`
%cManifest Successfully Loaded
%cPath: ${fullPath}
%cThis is the path that worked - you can remove other manifest copies
`, 
			'color: green; font-weight: bold; font-size: 1.1em;',
			'color: blue; font-weight: bold;',
			'color: gray; font-style: italic;'
			);
			return data;
		} catch (error) {
			console.error("Failed to load manifest:", error);
			throw error;
		}
	}
	/**
     * Saves the manifest data to a JSON file (for the application creating manifests).
     * @param {string} [path='resources/manifest.json'] - Path where to save the manifest
     * @param {Object} [data=null] - Data to save, or use the current manifest_data if null
     * @returns {Promise<boolean>} Promise resolving to true if save was successful
     */
	async save_manifest(path = 'resources/manifest.json', data = null) {
		const data_to_save = data || this.manifest_data;
		if (!data_to_save) {
			throw new Error('No manifest data to save');
		}
		const serialized_data = JSON.stringify(data_to_save, null, 2);
		try {
			// Browser environment
			if (typeof window !== 'undefined' && typeof document !== 'undefined') {
				const blob = new Blob([serialized_data], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = path.split('/').pop();
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				return true;
			} 
			// Node.js environment
			if (typeof process !== 'undefined' && process.versions && process.versions.node) {
				// Since dynamic imports don't work well with our bundling, we'll check if fs is available
				// through the global require function first
				if (typeof require === 'function') {
					try {
						const fs = require('fs');
						fs.writeFileSync(path, serialized_data);
						return true;
					} catch (require_error) {
						console.warn('Could not require fs module:', require_error.message);
					}
				}
				// Otherwise we'll use a more creative approach - write to the console and
				// suggest how to save the file
				console.warn('Cannot directly save files in this Node.js environment.');
				console.warn('To save the manifest, write the following data to a file:');
				console.warn(`Path: ${path}`);
				console.warn('Data:', serialized_data);
				// For testing purposes, we'll create a temporary _save_data field
				// that can be checked by tests
				this._save_data = {
					path,
					data: data_to_save
				};
				return false;
			}
			// Fallback for unknown environments
			console.warn('Unable to save manifest: Unknown environment');
			console.warn('Manifest data:', serialized_data);
			return false;
		} catch (error) {
			console.error('Error in save_manifest:', error);
			throw error;
		}
	}
	/**
     * Validates the manifest data against expected schema.
     * @param {Object} [data=null] - Data to validate, or use the current manifest_data if null
     * @returns {Object} Validation result with is_valid flag and any errors
     */
	validate_manifest(data = null) {
		const data_to_validate = data || this.manifest_data;
		if (!data_to_validate) {
			return { is_valid: false, errors: ['No manifest data to validate'] };
		}
		const errors = [];
		// Basic validation checks
		if (!data_to_validate.manifest_version) {
			errors.push('Missing manifest_version');
		}
		if (!data_to_validate.name) {
			errors.push('Missing name');
		}
		// Custom types validation
		if (data_to_validate.custom_types && Array.isArray(data_to_validate.custom_types)) {
			data_to_validate.custom_types.forEach((type, index) => {
				if (!type.name) {
					errors.push(`custom_types[${index}]: Missing name`);
				}
			});
		}
		// Scene data validation
		if (!data_to_validate.scene_data) {
			errors.push('Missing scene_data');
		}
		// Add more validation as needed...
		return {
			is_valid: errors.length === 0,
			errors
		};
	}
	/**
     * Creates a new empty manifest with default values.
     * @param {string} name - Name of the new manifest
     * @param {string} description - Description of the manifest
     * @returns {Object} The newly created manifest data
     */
	create_new_manifest(name, description) {
		const timestamp = new Date().toLocaleDateString();
		/** @type {Manifest} */
		const new_manifest = {
			manifest_version: "1.0",
			name: name || "New Manifest",
			description: description || "Created with ManifestManager",
			author: "",
			created_date: timestamp,
			updated_date: timestamp,
			custom_types: [],
			joint_data: {},
			asset_groups: [],
			asset_data: {},
			custom_assets: [],
			system_assets: [],
			scene_data: {
				version: "1.0",
				name: "Main Scene",
				description: "Default scene",
				environment: {
					gravity: {
						x: 0.0,
						y: 9.8,
						z: 0.0
					},
					ambient_light: {
						color: "0xffffff",
						intensity: 0.5
					}
				},
				physics: {
					enabled: true,
					update_rate: 60
				},
				rendering: {
					shadows: true,
					antialiasing: true
				}
			}
		};
		this.manifest_data = new_manifest;
		this.is_loaded = true;
		return new_manifest;
	}
	/**
     * Gets the entire manifest data.
     * @returns {Object|null} The manifest data or null if not loaded.
     */
	get_manifest() {
		return this.manifest_data;
	}
	/**
     * Updates the entire manifest data.
     * @param {Object} data - The new manifest data
     */
	set_manifest(data) {
		this.manifest_data = data;
		this.is_loaded = true;
	}
	/**
     * Checks if the manifest is loaded.
     * @returns {boolean} True if the manifest is loaded.
     */
	is_manifest_loaded() {
		return this.is_loaded;
	}
	/**
     * Gets a custom type definition by name.
     * @param {string} type_name - The name of the custom type.
     * @returns {CustomType|null} The custom type definition or null if not found.
     */
	get_custom_type(type_name) {
		if (!this.is_loaded || !this.manifest_data?.custom_types) {
			return null;
		}
		return this.manifest_data.custom_types.find(type => type.name === type_name) || null;
	}
	/**
     * Gets all custom types.
     * @returns {Array<CustomType>|null} Array of custom types or null if manifest not loaded.
     */
	get_all_custom_types() {
		return this.is_loaded ? this.manifest_data?.custom_types || [] : null;
	}
	/**
     * Adds or updates a custom type.
     * @param {CustomType} type_data - The custom type data
     * @returns {boolean} True if successful
     */
	set_custom_type(type_data) {
		if (!this.is_loaded || !type_data.name) {
			return false;
		}
		if (!this.manifest_data.custom_types) {
			this.manifest_data.custom_types = [];
		}
		const existing_index = this.manifest_data.custom_types.findIndex(t => t.name === type_data.name);
		if (existing_index >= 0) {
			this.manifest_data.custom_types[existing_index] = type_data;
		} else {
			this.manifest_data.custom_types.push(type_data);
		}
		return true;
	}
	/**
     * Gets an asset group by ID.
     * @param {string} group_id - The ID of the asset group.
     * @returns {AssetGroup|null} The asset group or null if not found.
     */
	get_asset_group(group_id) {
		if (!this.is_loaded || !this.manifest_data?.asset_groups) {
			return null;
		}
		return this.manifest_data.asset_groups.find(group => group.id === group_id) || null;
	}
	/**
     * Gets all asset groups.
     * @returns {Array<AssetGroup>|null} Array of asset groups or null if manifest not loaded.
     */
	get_all_asset_groups() {
		return this.is_loaded ? this.manifest_data?.asset_groups || [] : null;
	}
	/**
     * Adds or updates an asset group.
     * @param {AssetGroup} group_data - The asset group data
     * @returns {boolean} True if successful
     */
	set_asset_group(group_data) {
		if (!this.is_loaded || !group_data.id) {
			return false;
		}
		if (!this.manifest_data.asset_groups) {
			this.manifest_data.asset_groups = [];
		}
		const existing_index = this.manifest_data.asset_groups.findIndex(g => g.id === group_data.id);
		if (existing_index >= 0) {
			this.manifest_data.asset_groups[existing_index] = group_data;
		} else {
			this.manifest_data.asset_groups.push(group_data);
		}
		return true;
	}
	/**
     * Gets an asset by ID.
     * @param {string} asset_id - The ID of the asset.
     * @returns {AssetData|null} The asset data or null if not found.
     */
	get_asset(asset_id) {
		if (!this.is_loaded || !this.manifest_data?.asset_data) {
			return null;
		}
		// If asset_data is an object with keys
		if (typeof this.manifest_data.asset_data === 'object' && !Array.isArray(this.manifest_data.asset_data)) {
			return this.manifest_data.asset_data[asset_id] || null;
		}
		// If asset_data is an array
		if (Array.isArray(this.manifest_data.asset_data)) {
			return this.manifest_data.asset_data.find(asset => asset.id === asset_id) || null;
		}
		return null;
	}
	/**
     * Gets all assets.
     * @returns {Object<string,AssetData>|Array<AssetData>|null} Assets or null if manifest not loaded.
     */
	get_all_assets() {
		return this.is_loaded ? this.manifest_data?.asset_data || null : null;
	}
	/**
     * Adds or updates an asset.
     * @param {string} asset_id - The ID of the asset
     * @param {AssetData} asset_data - The asset data
     * @returns {boolean} True if successful
     */
	set_asset(asset_id, asset_data) {
		if (!this.is_loaded || !asset_id) {
			return false;
		}
		// Initialize asset_data if it doesn't exist
		if (!this.manifest_data.asset_data) {
			// Default to object notation
			this.manifest_data.asset_data = {};
		}
		// If asset_data is an object with keys
		if (typeof this.manifest_data.asset_data === 'object' && !Array.isArray(this.manifest_data.asset_data)) {
			this.manifest_data.asset_data[asset_id] = asset_data;
			return true;
		}
		// If asset_data is an array
		if (Array.isArray(this.manifest_data.asset_data)) {
			const existing_index = this.manifest_data.asset_data.findIndex(asset => asset.id === asset_id);
			if (existing_index >= 0) {
				this.manifest_data.asset_data[existing_index] = asset_data;
			} else {
				this.manifest_data.asset_data.push(asset_data);
			}
			return true;
		}
		return false;
	}
	/**
     * Gets the scene data.
     * @returns {SceneData|null} The scene data or null if not loaded.
     */
	get_scene_data() {
		return this.is_loaded ? this.manifest_data?.scene_data || null : null;
	}
	/**
     * Sets the scene data.
     * @param {SceneData} scene_data - The scene data to set
     * @returns {boolean} True if successful
     */
	set_scene_data(scene_data) {
		if (!this.is_loaded) {
			return false;
		}
		this.manifest_data.scene_data = scene_data;
		return true;
	}
	/**
     * Gets the greeting data configuration from the manifest.
     * If not defined in the manifest, returns a default with display set to false.
     * @returns {Object} The greeting data configuration
     */
	get_greeting_data() {
		const scene_data = this.get_scene_data();
		if (scene_data?.greeting_data) {
			return {
				display: scene_data.greeting_data.display === true,
				modal_path: scene_data.greeting_data.modal_path || ''
			};
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("No greeting data found in manifest, using default (display: false)");
		}
		return DEFAULT_ENVIRONMENT.greeting_data;
	}
	/**
     * Gets the auto_throttle setting from the manifest.
     * If not defined in the manifest, returns the default (true).
     * @returns {boolean} Whether automatic resolution throttling is enabled
     */
	get_auto_throttle() {
		const scene_data = this.get_scene_data();
		if (scene_data && 'auto_throttle' in scene_data) {
			return scene_data.auto_throttle === true;
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("No auto_throttle setting found in manifest, using default (true)");
		}
		return true; // Default to true for backward compatibility
	}
	/**
     * Gets the gravity configuration from the manifest.
     * If not defined in the manifest, returns the default.
     * @returns {Object} The gravity configuration with x, y, z properties
     */
	get_gravity() {
		const scene_data = this.get_scene_data();
		if (scene_data?.environment?.gravity) {
			return scene_data.environment.gravity;
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("Using default gravity configuration from blorkpack defaults");
		}
		return DEFAULT_ENVIRONMENT.gravity;
	}
	/**
     * Gets the physics optimization settings from the manifest.
     * If not defined in the manifest, returns the default.
     * @returns {Object} The physics optimization settings
     */
	get_physics_optimization_settings() {
		const scene_data = this.get_scene_data();
		if (scene_data?.physics?.optimization) {
			return scene_data.physics.optimization;
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("Using default physics optimization settings from blorkpack defaults");
		}
		return DEFAULT_PHYSICS;
	}
	/**
     * Gets the ambient light configuration from the manifest.
     * If not defined in the manifest, returns the default.
     * @returns {Object} The ambient light configuration
     */
	get_ambient_light() {
		const scene_data = this.get_scene_data();
		if (scene_data?.environment?.ambient_light) {
			return scene_data.environment.ambient_light;
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("Using default ambient light configuration from blorkpack defaults");
		}
		return DEFAULT_ENVIRONMENT.ambient_light;
	}
	/**
     * Gets the fog configuration from the manifest.
     * If not defined in the manifest, returns the default.
     * @returns {Object} The fog configuration
     */
	get_fog() {
		const scene_data = this.get_scene_data();
		if (scene_data?.environment?.fog) {
			return scene_data.environment.fog;
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("Using default fog configuration from blorkpack defaults");
		}
		return DEFAULT_ENVIRONMENT.fog;
	}
	/**
     * Gets the physics configuration from the manifest.
     * If not defined in the manifest, returns the default.
     * @returns {Object} The physics configuration
     */
	get_physics_config() {
		const scene_data = this.get_scene_data();
		if (scene_data?.physics) {
			return scene_data.physics;
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("Using default physics configuration from blorkpack defaults");
		}
		return DEFAULT_PHYSICS;
	}
	/**
     * Gets the rendering configuration from the manifest.
     * If not defined in the manifest, returns the default.
     * @returns {Object} The rendering configuration
     */
	get_rendering_config() {
		const scene_data = this.get_scene_data();
		if (scene_data?.rendering) {
			return scene_data.rendering;
		}
		// Log that we're using the default value
		if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
			console.debug("Using default rendering configuration from blorkpack defaults");
		}
		return DEFAULT_RENDERING;
	}
	/**
     * Gets the background configuration from the manifest.
     * If not defined in the manifest, returns the default.
     * Validates all fields to ensure they have appropriate values.
     * @returns {Object} The background configuration
     */
	get_background_config() {
		const scene_data = this.get_scene_data();
		let background = DEFAULT_ENVIRONMENT.background;
		if (scene_data?.background) {
			background = scene_data.background;
			// Ensure type is valid
			if (!['COLOR', 'IMAGE', 'SKYBOX'].includes(background.type)) {
				if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
					console.debug(`Invalid background type "${background.type}", using default type "${DEFAULT_ENVIRONMENT.background.type}"`);
				}
				background.type = DEFAULT_ENVIRONMENT.background.type;
			}
			// Ensure color_value is present for COLOR type
			if (background.type === 'COLOR' && !background.color_value) {
				if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
					console.debug(`Background type is COLOR but color_value is missing, using default value "${DEFAULT_ENVIRONMENT.background.color_value}"`);
				}
				background.color_value = DEFAULT_ENVIRONMENT.background.color_value;
			}
			// Ensure image_path is present for IMAGE type
			if (background.type === 'IMAGE' && !background.image_path) {
				if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
					console.debug(`Background type is IMAGE but image_path is missing, caller will use fallback image`);
				}
				// We'll let the caller handle the fallback with BACKGROUND_IMAGE
			}
			// Ensure skybox properties are valid for SKYBOX type
			if (background.type === 'SKYBOX') {
				if (!background.skybox) {
					if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
						console.debug(`Background type is SKYBOX but skybox object is missing, using default values enabled: false, skybox_path: ""`);
					}
					background.skybox = { enabled: false, skybox_path: '' };
				} else {
					if (!background.skybox.enabled) {
						if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
							console.debug(`Background type is SKYBOX but skybox.enabled is false, skybox will not be used`);
						}
					} else if (!background.skybox.skybox_path) {
						if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
							console.debug(`Background type is SKYBOX but skybox_path is missing, using default value ""`);
						}
						background.skybox.skybox_path = '';
						background.skybox.enabled = false;
					}
				}
			}
		} else {
			// Log that we're using the default value
			if (typeof BLORKPACK_FLAGS !== 'undefined' && BLORKPACK_FLAGS.DEFAULT_CONFIG_LOGS) {
				console.debug(`Using default background configuration: type "${DEFAULT_ENVIRONMENT.background.type}", color_value "${DEFAULT_ENVIRONMENT.background.color_value}"`);
			}
		}
		return background;
	}
	/**
     * Gets the joint data from the manifest.
     * @returns {Object} The joint data or an empty object if not defined
     */
	get_joint_data() {
		return this.manifest_data?.joint_data || {};
	}
	/**
     * Sets the joint data in the manifest.
     * @param {Object} joint_data - The joint data to set
     */
	set_joint_data(joint_data) {
		if (!this.manifest_data) {
			this.manifest_data = this.create_new_manifest();
		}
		this.manifest_data.joint_data = joint_data;
	}
	/**
     * Gets the custom_assets array from the manifest.
     * @returns {Array} Array of custom assets or an empty array if not defined
     */
	get_custom_assets() {
		if (BLORKPACK_FLAGS.ASSET_LOGS) {
			console.log('Getting custom assets from manifest...');
		}
		return this.manifest_data?.custom_assets || [];
	}
	/**
     * Sets the custom_assets array in the manifest.
     * @param {Array} custom_assets - The custom assets array to set
     */
	set_custom_assets(custom_assets) {
		if (!this.manifest_data) {
			this.manifest_data = this.create_new_manifest();
		}
		this.manifest_data.custom_assets = custom_assets;
	}
	/**
     * Gets the system_assets array from the manifest.
     * @returns {Array} The system assets array (empty array if not found)
     */
	get_system_assets() {
		if (BLORKPACK_FLAGS.ASSET_LOGS) {
			console.log('Getting system assets from manifest...');
		}
		return this.manifest_data?.system_assets || [];
	}
	/**
     * Sets the system_assets array in the manifest.
     * @param {Array} system_assets - The system assets array to set
     */
	set_system_assets(system_assets) {
		if (!this.manifest_data) {
			this.manifest_data = this.create_new_manifest();
		}
		this.manifest_data.system_assets = system_assets;
	}
	/**
     * Gets the camera configuration from the scene_data.
     * @returns {Object} The camera configuration with defaults applied
     */
	get_camera_config() {
		const scene_data = this.get_scene_data();
		const default_camera = {
			position: { x: 0, y: 5, z: 10 },
			target: { x: 0, y: 0, z: 0 },
			fov: 75,
			near: 0.1,
			far: 1000,
			ui_distance: 25,
			controls: {
				type: "ORBIT",
				enable_damping: true,
				damping_factor: 0.05,
				min_distance: 5,
				max_distance: 30,
				min_polar_angle: -60,
				max_polar_angle: 60,
				enable_zoom: true,
				enable_rotate: true,
				enable_pan: true
			},
			shoulder_lights: {
				enabled: true,
				left: {
					position: { x: -3, y: 2.5, z: 40 },
					rotation: { pitch: 190, yaw: 0 },
					angle: 80,
					max_distance: 0,
					intensity: 2
				},
				right: {
					position: { x: 3, y: 2.5, z: 40 },
					rotation: { pitch: 190, yaw: 0 },
					angle: 80,
					max_distance: 0,
					intensity: 2
				}
			}
		};
		if (!scene_data || !scene_data.default_camera) {
			if (BLORKPACK_FLAGS.MANIFEST_LOGS) {
				console.warn('No camera configuration found in scene_data, using defaults');
			}
			return default_camera;
		}
		// Deep merge the provided camera config with defaults
		const camera_config = { ...default_camera };
		// Merge position and target
		if (scene_data.default_camera.position) {
			camera_config.position = {
				x: scene_data.default_camera.position.x ?? default_camera.position.x,
				y: scene_data.default_camera.position.y ?? default_camera.position.y,
				z: scene_data.default_camera.position.z ?? default_camera.position.z
			};
		}
		if (scene_data.default_camera.target) {
			camera_config.target = {
				x: scene_data.default_camera.target.x ?? default_camera.target.x,
				y: scene_data.default_camera.target.y ?? default_camera.target.y,
				z: scene_data.default_camera.target.z ?? default_camera.target.z
			};
		}
		// Merge simple properties
		camera_config.fov = scene_data.default_camera.fov ?? default_camera.fov;
		camera_config.near = scene_data.default_camera.near ?? default_camera.near;
		camera_config.far = scene_data.default_camera.far ?? default_camera.far;
		camera_config.ui_distance = scene_data.default_camera.ui_distance ?? default_camera.ui_distance;
		// Merge controls
		if (scene_data.default_camera.controls) {
			camera_config.controls = {
				type: scene_data.default_camera.controls.type ?? default_camera.controls.type,
				enable_damping: scene_data.default_camera.controls.enable_damping ?? default_camera.controls.enable_damping,
				damping_factor: scene_data.default_camera.controls.damping_factor ?? default_camera.controls.damping_factor,
				min_distance: scene_data.default_camera.controls.min_distance ?? default_camera.controls.min_distance,
				max_distance: scene_data.default_camera.controls.max_distance ?? default_camera.controls.max_distance,
				min_polar_angle: scene_data.default_camera.controls.min_polar_angle ?? default_camera.controls.min_polar_angle,
				max_polar_angle: scene_data.default_camera.controls.max_polar_angle ?? default_camera.controls.max_polar_angle,
				enable_zoom: scene_data.default_camera.controls.enable_zoom ?? default_camera.controls.enable_zoom,
				enable_rotate: scene_data.default_camera.controls.enable_rotate ?? default_camera.controls.enable_rotate,
				enable_pan: scene_data.default_camera.controls.enable_pan ?? default_camera.controls.enable_pan
			};
		}
		// Merge shoulder lights
		if (scene_data.default_camera.shoulder_lights) {
			camera_config.shoulder_lights = {
				enabled: scene_data.default_camera.shoulder_lights.enabled ?? default_camera.shoulder_lights.enabled
			};
			// Merge left light
			if (scene_data.default_camera.shoulder_lights.left) {
				camera_config.shoulder_lights.left = { ...default_camera.shoulder_lights.left };
				if (scene_data.default_camera.shoulder_lights.left.position) {
					camera_config.shoulder_lights.left.position = {
						x: scene_data.default_camera.shoulder_lights.left.position.x ?? default_camera.shoulder_lights.left.position.x,
						y: scene_data.default_camera.shoulder_lights.left.position.y ?? default_camera.shoulder_lights.left.position.y,
						z: scene_data.default_camera.shoulder_lights.left.position.z ?? default_camera.shoulder_lights.left.position.z
					};
				}
				if (scene_data.default_camera.shoulder_lights.left.rotation) {
					camera_config.shoulder_lights.left.rotation = {
						pitch: scene_data.default_camera.shoulder_lights.left.rotation.pitch ?? default_camera.shoulder_lights.left.rotation.pitch,
						yaw: scene_data.default_camera.shoulder_lights.left.rotation.yaw ?? default_camera.shoulder_lights.left.rotation.yaw
					};
				}
				camera_config.shoulder_lights.left.angle = scene_data.default_camera.shoulder_lights.left.angle ?? default_camera.shoulder_lights.left.angle;
				camera_config.shoulder_lights.left.max_distance = scene_data.default_camera.shoulder_lights.left.max_distance ?? default_camera.shoulder_lights.left.max_distance;
				camera_config.shoulder_lights.left.intensity = scene_data.default_camera.shoulder_lights.left.intensity ?? default_camera.shoulder_lights.left.intensity;
			}
			// Merge right light
			if (scene_data.default_camera.shoulder_lights.right) {
				camera_config.shoulder_lights.right = { ...default_camera.shoulder_lights.right };
				if (scene_data.default_camera.shoulder_lights.right.position) {
					camera_config.shoulder_lights.right.position = {
						x: scene_data.default_camera.shoulder_lights.right.position.x ?? default_camera.shoulder_lights.right.position.x,
						y: scene_data.default_camera.shoulder_lights.right.position.y ?? default_camera.shoulder_lights.right.position.y,
						z: scene_data.default_camera.shoulder_lights.right.position.z ?? default_camera.shoulder_lights.right.position.z
					};
				}
				if (scene_data.default_camera.shoulder_lights.right.rotation) {
					camera_config.shoulder_lights.right.rotation = {
						pitch: scene_data.default_camera.shoulder_lights.right.rotation.pitch ?? default_camera.shoulder_lights.right.rotation.pitch,
						yaw: scene_data.default_camera.shoulder_lights.right.rotation.yaw ?? default_camera.shoulder_lights.right.rotation.yaw
					};
				}
				camera_config.shoulder_lights.right.angle = scene_data.default_camera.shoulder_lights.right.angle ?? default_camera.shoulder_lights.right.angle;
				camera_config.shoulder_lights.right.max_distance = scene_data.default_camera.shoulder_lights.right.max_distance ?? default_camera.shoulder_lights.right.max_distance;
				camera_config.shoulder_lights.right.intensity = scene_data.default_camera.shoulder_lights.right.intensity ?? default_camera.shoulder_lights.right.intensity;
			}
		}
		return camera_config;
	}
}