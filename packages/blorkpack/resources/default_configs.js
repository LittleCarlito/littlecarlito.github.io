/**
 * Default configuration values for blorkpack
 * 
 * This file contains the default values for various configurations
 * that will be used when the manifest doesn't specify them.
 */
/**
 * Default environment settings
 */
export const DEFAULT_ENVIRONMENT = {
	/**
     * Default gravity configuration
     * Standard Earth gravity is (0, -9.8, 0), but we default to zero gravity
     * to avoid unexpected behavior in scenes
     */
	gravity: {
		x: 0.0,
		y: 0.0,
		z: 0.0
	},
	/**
     * Default ambient light settings
     */
	ambient_light: {
		color: "0xffffff",
		intensity: 0.5
	},
	/**
     * Default fog settings
     */
	fog: {
		enabled: false,
		color: "0xaaaaaa",
		near: 10,
		far: 100
	},
	/**
     * Default background settings
     */
	background: {
		type: 'COLOR',
		color_value: '0x000000'
	},
	/**
     * Default greeting data settings
     */
	greeting_data: {
		display: false,
		modal_path: ''
	}
};
/**
 * Default physics settings
 */
export const DEFAULT_PHYSICS = {
	enabled: true,
	update_rate: 60,
	substeps: 1,
	debug_draw: false,
	allow_sleep: true,
	linear_sleep_threshold: 0.2,
	angular_sleep_threshold: 0.1,
	sleep_threshold: 0.1,
	max_velocity_iterations: 2,
	max_velocity_friction: 4,
	integration_parameters: {
		dt: 1/60,
		erp: 0.8,
		warmstart_coeff: 0.8,
		allowed_linear_error: 0.001
	}
};
/**
 * Default rendering settings
 */
export const DEFAULT_RENDERING = {
	shadows: true,
	antialiasing: true,
	tone_mapping_exposure: 1.0,
	output_encoding: "sRGB"
}; 