/**
 * Utility class for generating unique IDs.
 * Implements singleton pattern for global access.
 */
export class IdGenerator {
	static instance = null;
	/**
	 *
	 */
	constructor() {
		if (IdGenerator.instance) {
			return IdGenerator.instance;
		}
		// Initialize counter for numeric IDs
		this.counter = 0;
		// Store the instance
		IdGenerator.instance = this;
	}
	/**
     * Gets or creates the singleton instance of IdGenerator.
     * @returns {IdGenerator} The singleton instance.
     */
	static get_instance() {
		if (!IdGenerator.instance) {
			IdGenerator.instance = new IdGenerator();
		}
		return IdGenerator.instance;
	}
	/**
     * Generates a unique asset ID using timestamp and random numbers.
     * @returns {string} A unique ID string
     */
	generate_asset_id() {
		const timestamp = Date.now();
		const random = Math.floor(Math.random() * 10000);
		return `asset_${timestamp}_${random}`;
	}
	/**
     * Generates a unique numeric ID.
     * @returns {number} A unique numeric ID
     */
	generate_numeric_id() {
		return ++this.counter;
	}
	/**
     * Generates a unique ID with a custom prefix.
     * @param {string} prefix - The prefix to use for the ID
     * @returns {string} A unique ID string with the specified prefix
     */
	generate_prefixed_id(prefix) {
		const timestamp = Date.now();
		const random = Math.floor(Math.random() * 10000);
		return `${prefix}_${timestamp}_${random}`;
	}
} 