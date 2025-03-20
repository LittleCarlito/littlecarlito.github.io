/**
 * Enum representing the various system asset types that can be spawned.
 * Each type has a string value property that is used when passing the type as a parameter.
 */
export class SystemAssetType {
	static PRIMITIVE_BOX = { value: 'primitive_box' };
	static PRIMITIVE_SPHERE = { value: 'primitive_sphere' };
	static PRIMITIVE_CAPSULE = { value: 'primitive_capsule' };
	static PRIMITIVE_CYLINDER = { value: 'primitive_cylinder' };
	static SPOTLIGHT = { value: 'spotlight' };
	// TODO Create spawner for camera
	static CAMERA = { value: 'camera' };
	/**
     * Checks if the provided asset type string matches a system asset type.
     * @param {string} typeValue - The asset type string to check
     * @returns {boolean} True if the type is a system asset type
     */
	static isSystemAssetType(typeValue) {
		return Object.values(this).some(type => type.value === typeValue);
	}
	/**
     * Gets the system asset type enum object from a string value.
     * @param {string} typeValue - The string value to convert to an enum
     * @returns {Object|null} The enum object or null if not found
     */
	static fromValue(typeValue) {
		return Object.values(this).find(type => type.value === typeValue) || null;
	}
}
