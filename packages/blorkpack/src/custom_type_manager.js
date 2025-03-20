/**
 * Custom Type Manager - Loads custom asset types from JSON files
 */

// Import flags - use proper ES module import
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';

// Default scale factor
const SCALE_FACTOR = 5;

// No hardcoded custom types - everything comes from JSON
class CustomTypeManager {
	static instance = null;
    
	constructor() {
		if (CustomTypeManager.instance) {
			return CustomTypeManager.instance;
		}
        
		// Start with empty collections - all custom types will come from JSON
		this.types = {};
		this.configs = {};
        
		// Flag to track if custom types are loaded
		this.customTypesLoaded = false;
        
		CustomTypeManager.instance = this;
	}
    
	/**
     * Gets the singleton instance
     */
	static getInstance() {
		if (!CustomTypeManager.instance) {
			CustomTypeManager.instance = new CustomTypeManager();
		}
		return CustomTypeManager.instance;
	}
    
	/**
     * Static method to load custom types from a JSON file
     * @param {string} customTypesPath - Path to the custom types JSON file
     */
	static async loadCustomTypes(customTypesPath) {
		return CustomTypeManager.getInstance().loadCustomTypes(customTypesPath);
	}
    
	/**
     * Loads custom types from a JSON file
     * @param {string} customTypesPath - Path to the custom types JSON file
     */
	async loadCustomTypes(customTypesPath) {
		// Skip if already loaded
		if (this.customTypesLoaded) {
			if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log("Custom types already loaded, skipping");
			}
			return this;
		}
        
		try {
			if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Loading custom types from: ${customTypesPath}`);
			}
            
			// Fetch the custom types JSON
			const response = await fetch(customTypesPath);
            
			if (!response.ok) {
				throw new Error(`Failed to load custom types: ${response.status} ${response.statusText}`);
			}
            
			const customTypesData = await response.json();
            
			if (!customTypesData || !customTypesData.custom_configs) {
				throw new Error('Invalid custom types data: missing custom_configs');
			}
            
			// Add each custom type to the types object
			Object.keys(customTypesData.custom_configs).forEach(typeName => {
				const config = customTypesData.custom_configs[typeName];
                
				if (!config.key) {
					if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
						console.warn(`Custom type ${typeName} missing key property, using typeName as key`);
					}
				}
                
				// Add the type with its key value
				// For proper type checking, the key should match the typeName to avoid confusion
				const typeKey = config.key || typeName;
				this.types[typeName] = typeKey;
                
				// If the config has asset properties, add it to configs
				if (config.PATH) {
					this.configs[typeKey] = {
						PATH: config.PATH,
						scale: config.scale || SCALE_FACTOR,
						mass: config.mass || 1,
						restitution: config.restitution || 1,
						...(config.ui_scale && { ui_scale: config.ui_scale }),
						...(config.display_layer && { display_layer: config.display_layer })
					};
				} else if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
					console.warn(`Custom type ${typeName} has no PATH property, configs may be incomplete`);
				}
			});
            
			// Clear logging with summary and details
			if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Successfully loaded ${Object.keys(this.types).length} custom types from ${customTypesPath}:`);
				console.log("Mapped config keys:", Object.keys(this.configs));
			}
            
			// Validate type mappings and configs
			let mismatchCount = 0;
			if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
				Object.keys(this.types).forEach(typeName => {
					const typeValue = this.types[typeName];
					if (typeName !== typeValue && !this.configs[typeValue]) {
						console.warn(`Type name '${typeName}' maps to '${typeValue}', but no config exists for '${typeValue}'`);
						mismatchCount++;
					}
				});
                
				if (mismatchCount > 0) {
					console.warn(`Found ${mismatchCount} type mapping mismatches. Running debugTypeMappings() for details.`);
					this.debugTypeMappings();
				}
			}
            
			// Mark as loaded
			this.customTypesLoaded = true;
            
			// Make the types object immutable
			Object.freeze(this.types);
            
			return this;
		} catch (error) {
			console.error("Error loading custom types:", error);
			return this;
		}
	}
    
	/**
     * Gets all custom types
     */
	getTypes() {
		return this.types;
	}
    
	/**
     * Gets a specific custom type
     */
	getType(typeName) {
		// Check if this is a direct key in the types object
		if (typeName in this.types) {
			return this.types[typeName];
		}
        
		// Check if this might be a value rather than a key
		const typeValues = Object.values(this.types);
		if (typeValues.includes(typeName)) {
			if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
				console.warn(`Note: '${typeName}' is a type value, not a type name. Returning as-is.`);
			}
			return typeName;
		}
        
		// Not found at all
		if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
			console.warn(`Type '${typeName}' not found in custom types.`);
		}
		return typeName;
	}
    
	/**
     * Gets all custom configurations
     */
	getConfigs() {
		return this.configs;
	}
    
	/**
     * Gets configuration for a specific custom type
     */
	getConfig(type) {
		// Try to get config directly
		if (this.configs[type]) {
			return this.configs[type];
		}
        
		// If not found, check if this is a type name
		const typeValue = this.getType(type);
		if (typeValue !== type && this.configs[typeValue]) {
			if (BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
				console.warn(`Note: Using config for '${typeValue}' instead of '${type}'`);
			}
			return this.configs[typeValue];
		}
        
		return null;
	}
    
	/**
     * Checks if a particular custom type exists
     */
	hasType(typeName) {
		// First check if it's a direct key in the types object
		const directCheck = typeName in this.types;
        
		// Also check if it's a value in the types object
		const isTypeValue = Object.values(this.types).includes(typeName);
        
		// Return true if it's either a key or a value
		return directCheck || isTypeValue;
	}
    
	/**
     * Checks if custom types have been loaded
     */
	hasLoadedCustomTypes() {
		const result = this.customTypesLoaded;
		if (!result && BLORKPACK_FLAGS && BLORKPACK_FLAGS.ASSET_LOGS) {
			console.warn("Custom types have not been loaded yet. Call loadCustomTypes() first.");
			console.warn("Current types:", Object.keys(this.types).length);
		}
		return result;
	}
    
	/**
     * Debug method to print all type mappings and check for configuration discrepancies
     */
	debugTypeMappings() {
		if (!BLORKPACK_FLAGS || !BLORKPACK_FLAGS.ASSET_LOGS) return;
        
		console.log("=== Custom Type Manager Debug ===");
		console.log(`Loaded ${Object.keys(this.types).length} types, ${Object.keys(this.configs).length} configs`);
		console.log("=== End Debug ===");
	}
    
	/**
     * Static method to debug type mappings
     */
	static debugTypeMappings() {
		return CustomTypeManager.getInstance().debugTypeMappings();
	}
}

// Create and export the singleton
export default CustomTypeManager.getInstance(); 