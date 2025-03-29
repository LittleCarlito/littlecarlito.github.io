import { THREE } from "../../index.js";

/**
 * Factory class for creating various types of materials.
 */
export class MaterialFactory {
	static #instance = null;

	/**
     * Gets or creates the singleton instance of MaterialFactory.
     * @returns {MaterialFactory} The singleton instance.
     */
	static get_instance() {
		if (!MaterialFactory.#instance) {
			MaterialFactory.#instance = new MaterialFactory();
		}
		return MaterialFactory.#instance;
	}

	/**
     * Creates a material based on the specified display mode.
     * @param {number} displayMode - The display mode to create material for
     * @returns {THREE.MeshStandardMaterial} The created material
     */
	createDisplayMeshMaterial(displayMode = 0) {
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
     * Dispose of the factory instance
     */
	dispose() {
		MaterialFactory.#instance = null;
	}

	/**
     * Static method to dispose of the factory instance
     */
	static dispose_instance() {
		if (MaterialFactory.#instance) {
			MaterialFactory.#instance.dispose();
		}
	}
}
