/**
 * ManifestManager - Singleton class for loading and accessing the manifest.json configuration.
 * 
 * This class follows the same singleton pattern used in AssetStorage and handles:
 * - Loading the manifest.json file
 * - Parsing and caching the data
 * - Providing typed access to different sections of the manifest
 * 
 * @requires manifest_types.js
 */

import { typeDefs } from './manifest_types.js';
import { DEFAULT_ENVIRONMENT, DEFAULT_PHYSICS, DEFAULT_RENDERING } from '../resources/default_configs.js';
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';

/**
 * Singleton class for managing manifest.json data
 */
export class ManifestManager {
    static instance = null;
    
    constructor() {
        if (ManifestManager.instance) {
            return ManifestManager.instance;
        }
        
        /** @type {Manifest|null} */
        this.manifest_data = null;
        this.load_promise = null;
        this.is_loaded = false;
        
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
     * Loads the manifest.json file asynchronously.
     * @param {string} [path='resources/manifest.json'] - Path to the manifest file
     * @returns {Promise<Object>} A promise that resolves with the loaded manifest data.
     */
    async load_manifest(path = 'resources/manifest.json') {
        if (this.is_loaded) {
            return this.manifest_data;
        }
        
        if (this.load_promise) {
            return this.load_promise;
        }
        
        this.load_promise = fetch(path)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load manifest: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                this.manifest_data = data;
                this.is_loaded = true;
                console.log('Manifest loaded successfully');
                return data;
            })
            .catch(error => {
                console.error('Error loading manifest:', error);
                throw error;
            });
            
        return this.load_promise;
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
            asset_groups: [],
            asset_data: {},
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
     * Gets the gravity configuration from the manifest.
     * If gravity is not defined in the manifest, returns the default gravity.
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
     * Gets the joint data.
     * @returns {JointData|null} The joint data or null if not loaded.
     */
    get_joint_data() {
        return this.is_loaded ? this.manifest_data?.joint_data || null : null;
    }
    
    /**
     * Sets the joint data.
     * @param {JointData} joint_data - The joint data to set
     * @returns {boolean} True if successful
     */
    set_joint_data(joint_data) {
        if (!this.is_loaded) {
            return false;
        }
        
        this.manifest_data.joint_data = joint_data;
        return true;
    }
} 