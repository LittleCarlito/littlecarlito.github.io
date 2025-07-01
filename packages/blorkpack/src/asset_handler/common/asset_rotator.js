import { THREE, Easing, Tween  } from "../../index.js";

/**
 * Singleton class that handles rotation animations for assets
 * Manages active rotations and provides smooth quaternion-based rotation
 */
export class AssetRotator {
	static #instance = null;
	#activeRotations = new Map();

	constructor() {
		if (AssetRotator.#instance) {
			throw new Error('AssetRotator is a singleton. Use AssetRotator.get_instance() instead.');
		}
		AssetRotator.#instance = this;
	}

	static get_instance() {
		if (!AssetRotator.#instance) {
			AssetRotator.#instance = new AssetRotator();
		}
		return AssetRotator.#instance;
	}

	/**
	 * Rotates an asset around a specified axis
	 * @param {THREE.Object3D} asset - The asset to rotate
	 * @param {THREE.Vector3} axis - The axis to rotate around (will be normalized)
	 * @param {number} radians - Amount of rotation in radians
	 * @param {number} duration - Duration of rotation in milliseconds
	 * @param {Object} options - Additional options
	 * @param {Function} options.easing - Easing function (default: Easing.Sinusoidal.InOut)
	 * @param {Function} options.onUpdate - Callback during rotation (progress, asset)
	 * @param {Function} options.onComplete - Callback when rotation completes (asset)
	 * @param {Function} options.onHalfway - Callback when rotation reaches exactly 50% (asset)
	 * @returns {Promise} Promise that resolves when rotation completes
	 */
	rotateAsset(asset, axis, radians, duration, options = {}) {
		return new Promise((resolve, reject) => {
			if (!asset || !asset.isObject3D) {
				reject(new Error('Invalid asset provided to rotateAsset'));
				return;
			}

			if (!axis || !axis.isVector3) {
				reject(new Error('Invalid axis provided to rotateAsset - must be Vector3'));
				return;
			}

			if (typeof radians !== 'number' || isNaN(radians)) {
				reject(new Error('Invalid radians provided to rotateAsset - must be a number'));
				return;
			}

			if (typeof duration !== 'number' || duration <= 0) {
				reject(new Error('Invalid duration provided to rotateAsset - must be positive number'));
				return;
			}

			const config = {
				easing: options.easing || Easing.Sinusoidal.InOut,
				onUpdate: options.onUpdate || null,
				onComplete: options.onComplete || null,
				onHalfway: options.onHalfway || null,
				...options
			};

			this.stopRotationSilent(asset);

			const normalizedAxis = axis.clone().normalize();
			const quaternion = new THREE.Quaternion().setFromAxisAngle(normalizedAxis, radians);
			const startQuaternion = asset.quaternion.clone();
			const targetQuaternion = startQuaternion.clone().multiply(quaternion);

			const rotationData = {
				progress: 0,
				halfwayTriggered: false
			};

			const tween = new Tween(rotationData)
				.to({ progress: 1 }, duration)
				.easing(config.easing)
				.onUpdate(() => {
					const currentQuaternion = new THREE.Quaternion().slerpQuaternions(
						startQuaternion,
						targetQuaternion,
						rotationData.progress
					);
					asset.quaternion.copy(currentQuaternion);

					// Check for halfway point (exactly 50% rotation)
					if (!rotationData.halfwayTriggered && rotationData.progress >= 0.5) {
						rotationData.halfwayTriggered = true;
						if (config.onHalfway) {
							config.onHalfway(asset);
						}
					}

					if (config.onUpdate) {
						config.onUpdate(rotationData.progress, asset);
					}
				})
				.onComplete(() => {
					asset.quaternion.copy(targetQuaternion);
					this.#activeRotations.delete(asset.uuid);
					
					if (config.onComplete) {
						config.onComplete(asset);
					}
					
					resolve(asset);
				})
				.onStop(() => {
					this.#activeRotations.delete(asset.uuid);
					reject(new Error('Rotation was stopped'));
				})
				.start();

			this.#activeRotations.set(asset.uuid, {
				tween,
				asset,
				startQuaternion,
				targetQuaternion
			});
		});
	}

	/**
	 * Stops any active rotation for an asset without throwing errors
	 * @param {THREE.Object3D} asset - The asset to stop rotation for
	 */
	stopRotationSilent(asset) {
		if (!asset || !asset.uuid) return;

		const rotationData = this.#activeRotations.get(asset.uuid);
		if (rotationData) {
			rotationData.tween.stop();
			this.#activeRotations.delete(asset.uuid);
		}
	}

	/**
	 * Stops any active rotation for an asset
	 * @param {THREE.Object3D} asset - The asset to stop rotation for
	 */
	stopRotation(asset) {
		this.stopRotationSilent(asset);
	}

	/**
	 * Checks if an asset is currently rotating
	 * @param {THREE.Object3D} asset - The asset to check
	 * @returns {boolean} True if asset is rotating
	 */
	isRotating(asset) {
		return asset && this.#activeRotations.has(asset.uuid);
	}

	/**
	 * Gets all currently rotating assets
	 * @returns {Array<THREE.Object3D>} Array of rotating assets
	 */
	getRotatingAssets() {
		return Array.from(this.#activeRotations.values()).map(data => data.asset);
	}

	/**
	 * Stops all active rotations
	 */
	stopAllRotations() {
		for (const rotationData of this.#activeRotations.values()) {
			rotationData.tween.stop();
		}
		this.#activeRotations.clear();
	}

	/**
	 * Flips an asset 180 degrees around an axis
	 * @param {THREE.Object3D} asset - The asset to flip
	 * @param {THREE.Vector3} axis - The axis to flip around
	 * @param {number} duration - Duration of flip in milliseconds
	 * @param {Object} options - Additional options
	 * @param {Function} options.onHalfway - Callback when flip reaches exactly 90 degrees (halfway point)
	 * @returns {Promise} Promise that resolves when flip completes
	 */
	flipAsset(asset, axis, duration, options = {}) {
		return this.rotateAsset(asset, axis, Math.PI, duration, options);
	}

	/**
	 * Rotates an asset to a specific orientation
	 * @param {THREE.Object3D} asset - The asset to rotate
	 * @param {THREE.Quaternion} targetQuaternion - Target orientation
	 * @param {number} duration - Duration of rotation in milliseconds
	 * @param {Object} options - Additional options
	 * @param {Function} options.onHalfway - Callback when rotation reaches halfway point
	 * @returns {Promise} Promise that resolves when rotation completes
	 */
	rotateToOrientation(asset, targetQuaternion, duration, options = {}) {
		return new Promise((resolve, reject) => {
			if (!asset || !asset.isObject3D) {
				reject(new Error('Invalid asset provided to rotateToOrientation'));
				return;
			}

			if (!targetQuaternion || !targetQuaternion.isQuaternion) {
				reject(new Error('Invalid targetQuaternion provided - must be Quaternion'));
				return;
			}

			if (typeof duration !== 'number' || duration <= 0) {
				reject(new Error('Invalid duration provided - must be positive number'));
				return;
			}

			const config = {
				easing: options.easing || Easing.Sinusoidal.InOut,
				onUpdate: options.onUpdate || null,
				onComplete: options.onComplete || null,
				onHalfway: options.onHalfway || null,
				...options
			};

			this.stopRotationSilent(asset);

			const startQuaternion = asset.quaternion.clone();
			const rotationData = {
				progress: 0,
				halfwayTriggered: false
			};

			const tween = new Tween(rotationData)
				.to({ progress: 1 }, duration)
				.easing(config.easing)
				.onUpdate(() => {
					const currentQuaternion = new THREE.Quaternion().slerpQuaternions(
						startQuaternion,
						targetQuaternion,
						rotationData.progress
					);
					asset.quaternion.copy(currentQuaternion);

					// Check for halfway point (exactly 50% rotation)
					if (!rotationData.halfwayTriggered && rotationData.progress >= 0.5) {
						rotationData.halfwayTriggered = true;
						if (config.onHalfway) {
							config.onHalfway(asset);
						}
					}

					if (config.onUpdate) {
						config.onUpdate(rotationData.progress, asset);
					}
				})
				.onComplete(() => {
					asset.quaternion.copy(targetQuaternion);
					this.#activeRotations.delete(asset.uuid);
					
					if (config.onComplete) {
						config.onComplete(asset);
					}
					
					resolve(asset);
				})
				.onStop(() => {
					this.#activeRotations.delete(asset.uuid);
					reject(new Error('Rotation was stopped'));
				})
				.start();

			this.#activeRotations.set(asset.uuid, {
				tween,
				asset,
				startQuaternion,
				targetQuaternion
			});
		});
	}

	/**
	 * Disposes of the rotator and cleans up resources
	 */
	dispose() {
		this.stopAllRotations();
		AssetRotator.#instance = null;
	}

	static dispose_instance() {
		if (AssetRotator.#instance) {
			AssetRotator.#instance.dispose();
		}
	}
}