// @ts-nocheck
import { THREE, BLORKPACK_FLAGS } from '@littlecarlito/blorkpack';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const BACKGROUND_PATH = 'images/water.exr';

/**
 * Scene Setup Helper - Functional class for managing scene background and lighting
 * Handles initialization and configuration of scene visual elements
 */
export const SceneSetupHelper = {

	/**
	 * Sets up the scene background based on manifest configuration
	 * @param {THREE.Scene} scene - The Three.js scene to configure
	 * @param {Object} manifest_manager - The manifest manager instance
	 * @param {Function} progressCallback - Optional callback for loading progress updates
	 * @returns {Promise} Promise that resolves when background setup is complete
	 */
	async setup_background(scene, manifest_manager, progressCallback) {
		const bg = manifest_manager.get_background_config();
		if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
			console.log("Using background configuration:", bg);
		}
		
		switch (bg.type) {
		case 'IMAGE':
			await this._create_hdri_background(scene, progressCallback);
			break;
		case 'COLOR':
			scene.background = new THREE.Color(bg.color_value);
			break;
		case 'SKYBOX':
			if (bg.skybox && bg.skybox.enabled) {
				console.log('Loading skybox from:', bg.skybox.skybox_path);
				await this._create_skybox_background(scene, bg.skybox, progressCallback);
			}
			break;
		default:
			console.error(`Background type \"${bg.type}\" is not supported`);
			scene.background = new THREE.Color('0x000000');
		}
	},

	/**
	 * Sets up scene lighting based on manifest configuration
	 * @param {THREE.Scene} scene - The Three.js scene to configure
	 * @param {Object} manifest_manager - The manifest manager instance
	 * @param {Function} progressCallback - Optional callback for loading progress updates
	 * @returns {Promise} Promise that resolves when lighting setup is complete
	 */
	async setup_lighting(scene, manifest_manager, progressCallback) {
		console.log('Setting up HDRI environment lighting...');
		await this._create_hdri_lighting(scene, progressCallback);
	},

	/**
	 * Creates HDRI background and environment lighting
	 * @private
	 * @param {THREE.Scene} scene - The Three.js scene to configure
	 * @param {Function} progressCallback - Optional callback for loading progress updates
	 * @returns {Promise} Promise that resolves when HDRI is loaded
	 */
	_create_hdri_background(scene, progressCallback) {
		console.log('Loading HDRI environment map from:', BACKGROUND_PATH);
		
		return new Promise((resolve, reject) => {
			const loader = new EXRLoader();
			
			loader.load(BACKGROUND_PATH, 
				(texture) => {
					texture.mapping = THREE.EquirectangularReflectionMapping;
					scene.background = texture;
					scene.environment = texture;
					console.log('HDRI background and environment loaded successfully');
					resolve(texture);
				},
				(progress) => {
					const percentage = Math.round(progress.loaded / progress.total * 100);
					if (progressCallback) {
						progressCallback(`Loading HDRI background... ${percentage}%`);
					}
				},
				(error) => {
					console.error('Error loading HDRI file:', error);
					reject(error);
				}
			);
		});
	},

	/**
	 * Creates HDRI environment lighting
	 * @private
	 * @param {THREE.Scene} scene - The Three.js scene to configure
	 * @param {Function} progressCallback - Optional callback for loading progress updates
	 * @returns {Promise} Promise that resolves when HDRI lighting is loaded
	 */
	_create_hdri_lighting(scene, progressCallback) {
		console.log('Configuring HDRI environment lighting from:', BACKGROUND_PATH);
		
		return new Promise((resolve, reject) => {
			const loader = new EXRLoader();
			
			loader.load(BACKGROUND_PATH,
				(texture) => {
					texture.mapping = THREE.EquirectangularReflectionMapping;
					scene.environment = texture;
					console.log('HDRI environment lighting configured');
					resolve(texture);
				},
				(progress) => {
					const percentage = Math.round(progress.loaded / progress.total * 100);
					if (progressCallback) {
						progressCallback(`Loading HDRI lighting... ${percentage}%`);
					}
				},
				(error) => {
					console.error('Error loading HDRI for lighting:', error);
					reject(error);
				}
			);
		});
	},

	/**
	 * Creates a skybox background
	 * @private
	 * @param {THREE.Scene} scene - The Three.js scene to configure
	 * @param {Object} skybox_config - Skybox configuration from manifest
	 * @param {Function} progressCallback - Optional callback for loading progress updates
	 * @returns {Promise} Promise that resolves when skybox is created
	 */
	async _create_skybox_background(scene, skybox_config, progressCallback) {
		console.log('Creating skybox background...');
		console.warn('Skybox background not yet implemented');
		if (progressCallback) {
			progressCallback('Skybox background not implemented');
		}
	},

	/**
	 * Disposes of background resources to prevent memory leaks
	 * @param {THREE.Scene} scene - The Three.js scene to clean up
	 */
	dispose_background(scene) {
		if (scene && scene.background) {
			if (scene.background.isTexture) {
				scene.background.dispose();
			}
			scene.background = null;
		}
		if (scene && scene.environment) {
			if (scene.environment.isTexture) {
				scene.environment.dispose();
			}
			scene.environment = null;
		}
	},

	/**
	 * Disposes of lighting resources to prevent memory leaks
	 * @param {THREE.Scene} scene - The Three.js scene to clean up
	 */
	dispose_lighting(scene) {
		if (!scene) return;
		
		const lightsToRemove = [];
		scene.traverse((child) => {
			if (child.isLight) {
				lightsToRemove.push(child);
			}
		});
		
		lightsToRemove.forEach(light => {
			scene.remove(light);
			if (light.dispose) {
				light.dispose();
			}
		});
	}
};