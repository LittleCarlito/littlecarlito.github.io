// @ts-nocheck
import { THREE, BLORKPACK_FLAGS } from '@littlecarlito/blorkpack';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const BACKGROUND_PATH = 'images/orbit_sunset.exr';
const LIGHTING_PATH = 'images/brown_studio.exr';

// HDRI Background Rotation Controls (in degrees)
const HDRI_ROTATION_X_DEG = 0;      // Pitch rotation
const HDRI_ROTATION_Y_DEG = 40;     // Yaw rotation
const HDRI_ROTATION_Z_DEG = 0;      // Roll rotation

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
		
		switch (bg.type) {
		case 'IMAGE':
			await this._create_hdri_background(scene, progressCallback);
			break;
		case 'COLOR':
			scene.background = new THREE.Color(bg.color_value);
			break;
		case 'SKYBOX':
			if (bg.skybox && bg.skybox.enabled) {
				await this._create_skybox_background(scene, bg.skybox, progressCallback);
			}
			break;
		default:
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
		await this._create_hdri_lighting(scene, progressCallback);
	},

	/**
	 * Creates HDRI background using orbit_sunset.exr
	 * @private
	 * @param {THREE.Scene} scene - The Three.js scene to configure
	 * @param {Function} progressCallback - Optional callback for loading progress updates
	 * @returns {Promise} Promise that resolves when HDRI is loaded
	 */
	_create_hdri_background(scene, progressCallback) {		
		return new Promise((resolve, reject) => {
			const loader = new EXRLoader();
			
			loader.load(BACKGROUND_PATH, 
				(texture) => {
					texture.mapping = THREE.EquirectangularReflectionMapping;
					
					// Convert degrees to radians
					const rotX = THREE.MathUtils.degToRad(HDRI_ROTATION_X_DEG);
					const rotY = THREE.MathUtils.degToRad(HDRI_ROTATION_Y_DEG);
					const rotZ = THREE.MathUtils.degToRad(HDRI_ROTATION_Z_DEG);
					
					// Always use sphere approach for proper rotation control
					const sphere = new THREE.SphereGeometry(500, 64, 32);
					const material = new THREE.MeshBasicMaterial({
						map: texture,
						side: THREE.BackSide,
						fog: false
					});
					const backgroundSphere = new THREE.Mesh(sphere, material);
					backgroundSphere.rotation.set(rotX, rotY, rotZ);
					backgroundSphere.renderOrder = -1;
					backgroundSphere.matrixAutoUpdate = false;
					backgroundSphere.updateMatrix();
					scene.add(backgroundSphere);
					
					// Store reference for cleanup
					scene.userData.backgroundSphere = backgroundSphere;
					resolve(texture);
				},
				(progress) => {
					const percentage = Math.round(progress.loaded / progress.total * 100);
					if (progressCallback) {
						progressCallback(`Loading HDRI background... ${percentage}%`);
					}
				},
				(error) => {
					reject(error);
				}
			);
		});
	},

	/**
	 * Creates HDRI environment lighting using brown_studio.exr
	 * @private
	 * @param {THREE.Scene} scene - The Three.js scene to configure
	 * @param {Function} progressCallback - Optional callback for loading progress updates
	 * @returns {Promise} Promise that resolves when HDRI lighting is loaded
	 */
	_create_hdri_lighting(scene, progressCallback) {		
		return new Promise((resolve, reject) => {
			const loader = new EXRLoader();
			
			loader.load(LIGHTING_PATH,
				(texture) => {
					texture.mapping = THREE.EquirectangularReflectionMapping;
					scene.environment = texture;
					resolve(texture);
				},
				(progress) => {
					const percentage = Math.round(progress.loaded / progress.total * 100);
					if (progressCallback) {
						progressCallback(`Loading HDRI lighting... ${percentage}%`);
					}
				},
				(error) => {
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
		if (scene && scene.userData.backgroundSphere) {
			const sphere = scene.userData.backgroundSphere;
			scene.remove(sphere);
			if (sphere.geometry) sphere.geometry.dispose();
			if (sphere.material) {
				if (sphere.material.map) sphere.material.map.dispose();
				sphere.material.dispose();
			}
			delete scene.userData.backgroundSphere;
		}
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