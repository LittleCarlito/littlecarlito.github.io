/**
 * Custom Type Manager - Loads custom asset types from JSON files
 */
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';

const SCALE_FACTOR = 5;

class AssetConfig {
	constructor(config) {
		// First assign defaults
		this.scale = SCALE_FACTOR;
		this.mass = 1;
		this.restitution = 1;
		
		// Then explicitly assign all properties from config
		Object.keys(config).forEach(key => {
			this[key] = config[key];
		});
	}

	toString() {
		const allProps = Object.getOwnPropertyNames(this);
		const props = allProps.map(key => {
			const value = this[key];
			let formattedValue;
			if (typeof value === 'string') {
				formattedValue = `"${value}"`;
			} else if (typeof value === 'object' && value !== null) {
				formattedValue = JSON.stringify(value);
			} else {
				formattedValue = value;
			}
			return `${key}: ${formattedValue}`;
		});
		return `AssetConfig { ${props.join(', ')} }`;
	}
}

class CustomTypeManager {
	static instance = null;

	constructor() {
		if (CustomTypeManager.instance) {
			return CustomTypeManager.instance;
		}
		this.types = {};
		this.configs = {};
		this.customTypesLoaded = false;
		CustomTypeManager.instance = this;
	}

	static getInstance() {
		if (!CustomTypeManager.instance) {
			CustomTypeManager.instance = new CustomTypeManager();
		}
		return CustomTypeManager.instance;
	}

	static async loadCustomTypes(customTypesPath) {
		return CustomTypeManager.getInstance().loadCustomTypes(customTypesPath);
	}

	async loadCustomTypes(customTypesPath) {
		if (this.customTypesLoaded) {
			return this;
		}
		try {
			const response = await fetch(customTypesPath);
			if (!response.ok) {
				throw new Error(`Failed to load custom types: ${response.status} ${response.statusText}`);
			}
			const responseText = await response.text();
			console.log(`DEBUG: Raw JSON response:`, responseText);
			const customTypesData = JSON.parse(responseText);
			if (!customTypesData || !customTypesData.custom_configs) {
				throw new Error('Invalid custom types data: missing custom_configs');
			}

			Object.keys(customTypesData.custom_configs).forEach(typeName => {
				const config = customTypesData.custom_configs[typeName];
				const typeKey = config.key || typeName;
				this.types[typeName] = typeKey;
				
				console.log(`DEBUG: Raw config for ${typeName}:`, JSON.stringify(config, null, 2));
				console.log(`DEBUG: Config has materials:`, !!config.materials);
				if (config.materials) {
					console.log(`DEBUG: Materials object keys:`, Object.keys(config.materials));
				}
				
				this.configs[typeKey] = new AssetConfig(config);
				
				console.log(`DEBUG: AssetConfig for ${typeKey}:`, this.configs[typeKey]);
				console.log(`DEBUG: AssetConfig has materials:`, !!this.configs[typeKey].materials);
				if (this.configs[typeKey].materials) {
					console.log(`DEBUG: AssetConfig materials keys:`, Object.keys(this.configs[typeKey].materials));
				}
			});

			this.customTypesLoaded = true;
			Object.freeze(this.types);
			return this;
		} catch (error) {
			console.error("Error loading custom types:", error);
			return this;
		}
	}

	getTypes() {
		return this.types;
	}

	getType(typeName) {
		if (typeName in this.types) {
			return this.types[typeName];
		}
		const typeValues = Object.values(this.types);
		if (typeValues.includes(typeName)) {
			return typeName;
		}
		return typeName;
	}

	getConfigs() {
		return this.configs;
	}

	getConfig(type) {
		if (this.configs[type]) {
			return this.configs[type];
		}
		const typeValue = this.getType(type);
		if (typeValue !== type && this.configs[typeValue]) {
			return this.configs[typeValue];
		}
		return null;
	}

	hasType(typeName) {
		const directCheck = typeName in this.types;
		const isTypeValue = Object.values(this.types).includes(typeName);
		return directCheck || isTypeValue;
	}

	hasLoadedCustomTypes() {
		return this.customTypesLoaded;
	}

	debugTypeMappings() {
		console.log("=== Custom Type Manager Debug ===");
		console.log(`Loaded ${Object.keys(this.types).length} types, ${Object.keys(this.configs).length} configs`);
		console.log("=== End Debug ===");
	}

	static debugTypeMappings() {
		return CustomTypeManager.getInstance().debugTypeMappings();
	}
}

export default CustomTypeManager.getInstance();