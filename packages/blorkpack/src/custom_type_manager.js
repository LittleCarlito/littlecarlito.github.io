/**
 * Custom Type Manager - Loads custom asset types from JSON files
 */

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
            console.log("Custom types already loaded, skipping");
            return this;
        }
        
        try {
            console.log(`Loading custom types from: ${customTypesPath}`);
            
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
                    console.warn(`Custom type ${typeName} missing key property, using typeName as key`);
                }
                
                // Add the type with its key value
                this.types[typeName] = config.key || typeName;
                
                // If the config has asset properties, add it to configs
                if (config.PATH) {
                    this.configs[this.types[typeName]] = {
                        PATH: config.PATH,
                        scale: config.scale || SCALE_FACTOR,
                        mass: config.mass || 1,
                        restitution: config.restitution || 1,
                        ...(config.ui_scale && { ui_scale: config.ui_scale }),
                        ...(config.display_layer && { display_layer: config.display_layer })
                    };
                } else {
                    console.warn(`Custom type ${typeName} has no PATH property, configs may be incomplete`);
                }
            });
            
            // Clear logging with summary and details
            console.log(`Successfully loaded ${Object.keys(this.types).length} custom types from ${customTypesPath}:`);
            console.log("Mapped config keys:", Object.keys(this.configs));
            
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
        return this.types[typeName];
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
        return this.configs[type];
    }
    
    /**
     * Checks if a particular custom type exists
     */
    hasType(typeName) {
        return typeName in this.types;
    }
    
    /**
     * Checks if custom types have been loaded
     */
    hasLoadedCustomTypes() {
        return this.customTypesLoaded;
    }
}

// Create and export the singleton
export default CustomTypeManager.getInstance(); 