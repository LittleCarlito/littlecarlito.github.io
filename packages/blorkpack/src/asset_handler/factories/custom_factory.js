import { THREE, RAPIER } from "../../index.js";
import { AssetUtils } from "../../index.js";
import CustomTypeManager from "../../custom_type_manager.js";
import { AssetStorage } from "../../asset_storage.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";
import { CollisionFactory } from "./collision_factory.js";
import { MaterialFactory } from "./material_factory.js";
import { AssetRotator } from "../common/asset_rotator.js";

/**
 * Factory class responsible for spawning custom assets in the scene.
 * Handles loading and spawning of custom 3D models with physics and rotation capabilities.
 */
export class CustomFactory {
	static #instance = null;
	static #disposed = false;
	storage;
	scene;
	world;
	#assetTypes = null;
	#assetConfigs = null;
	#randomColors = [
		0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff,
		0xff8000, 0x8000ff, 0xff0080, 0x80ff00, 0x0080ff, 0xff8080,
		0x80ff80, 0x8080ff, 0xffff80, 0xff80ff, 0x80ffff, 0xffc080,
		0xc080ff, 0x80ffc0
	];
	#colorIndex = 0;
	#shuffledColors = [];
	debugMeshes = new Map();
	rotator;

	constructor(scene = null, world = null) {
		if (CustomFactory.#instance) {
			throw new Error('CustomFactory is a singleton. Use CustomFactory.get_instance() instead.');
		}
		this.storage = AssetStorage.get_instance();
		this.scene = scene;
		this.world = world;
		this.#assetTypes = CustomTypeManager.getTypes();
		this.#assetConfigs = CustomTypeManager.getConfigs();
		this.shuffleColors();
		this.material_factory = new MaterialFactory();
		this.rotator = AssetRotator.get_instance();
		CustomFactory.#instance = this;
		CustomFactory.#disposed = false;
	}

	static get_instance(scene, world) {
		if (CustomFactory.#disposed) {
			CustomFactory.#instance = null;
			CustomFactory.#disposed = false;
		}
		if (!CustomFactory.#instance) {
			CustomFactory.#instance = new CustomFactory(scene, world);
		} else if (scene || world) {
			if (scene) CustomFactory.#instance.scene = scene;
			if (world) CustomFactory.#instance.world = world;
		}
		return CustomFactory.#instance;
	}

	dispose() {
		if (!CustomFactory.#instance) return;
		if (this.rotator) {
			this.rotator.dispose();
		}
		this.scene = null;
		this.world = null;
		this.storage = null;
		this.#assetTypes = null;
		this.#assetConfigs = null;
		CustomFactory.#disposed = true;
		CustomFactory.#instance = null;
	}

	static dispose_instance() {
		if (CustomFactory.#instance) {
			CustomFactory.#instance.dispose();
		}
	}

	shuffleColors() {
		this.#shuffledColors = [...this.#randomColors];
		for (let i = this.#shuffledColors.length - 1; i > 0; i--) {
			const j = Math.floor((Math.random() * 1000 + Date.now()) % (i + 1));
			[this.#shuffledColors[i], this.#shuffledColors[j]] = [this.#shuffledColors[j], this.#shuffledColors[i]];
		}
		this.#colorIndex = 0;
	}

	getRandomColor() {
		if (this.#colorIndex >= this.#shuffledColors.length) {
			this.shuffleColors();
		}
		const color = this.#shuffledColors[this.#colorIndex];
		this.#colorIndex++;
		return color;
	}

	applyRandomColorToAsset(model) {
		const randomColor = this.getRandomColor();
		
		model.traverse((child) => {
			if (child.isMesh && child.material) {
				if (!child.name.startsWith('col_') && !child.name.startsWith('display_')) {
					if (Array.isArray(child.material)) {
						child.material.forEach(mat => {
							if (mat.isMeshStandardMaterial || mat.isMeshBasicMaterial) {
								mat.color.setHex(randomColor);
							}
						});
					} else {
						if (child.material.isMeshStandardMaterial || child.material.isMeshBasicMaterial) {
							child.material.color.setHex(randomColor);
						}
					}
				}
			}
		});
	}

	/**
	 * Rotates a spawned asset around a specified axis
	 * @param {THREE.Object3D|string} assetOrInstanceId - Asset mesh or instance ID
	 * @param {THREE.Vector3} axis - Rotation axis (will be normalized)
	 * @param {number} radians - Rotation amount in radians
	 * @param {number} duration - Duration in milliseconds
	 * @param {Object} options - Additional options (easing, onUpdate, onComplete)
	 * @returns {Promise} Promise that resolves when rotation completes
	 */
	async rotateAsset(assetOrInstanceId, axis, radians, duration, options = {}) {
		let asset;
		
		if (typeof assetOrInstanceId === 'string') {
			const assetData = this.storage.get_object(assetOrInstanceId);
			if (!assetData || !assetData.mesh) {
				throw new Error(`Asset with instance ID ${assetOrInstanceId} not found`);
			}
			asset = assetData.mesh;
		} else if (assetOrInstanceId && assetOrInstanceId.isObject3D) {
			asset = assetOrInstanceId;
		} else {
			throw new Error('Invalid asset provided - must be Object3D or valid instance ID');
		}

		return this.rotator.rotateAsset(asset, axis, radians, duration, options);
	}

	/**
	 * Flips a spawned asset 180 degrees around an axis
	 * @param {THREE.Object3D|string} assetOrInstanceId - Asset mesh or instance ID
	 * @param {THREE.Vector3} axis - Flip axis
	 * @param {number} duration - Duration in milliseconds
	 * @param {Object} options - Additional options
	 * @returns {Promise} Promise that resolves when flip completes
	 */
	async flipAsset(assetOrInstanceId, axis, duration, options = {}) {
		return this.rotateAsset(assetOrInstanceId, axis, Math.PI, duration, options);
	}

	/**
	 * Stops rotation for a spawned asset
	 * @param {THREE.Object3D|string} assetOrInstanceId - Asset mesh or instance ID
	 */
	stopAssetRotation(assetOrInstanceId) {
		let asset;
		
		if (typeof assetOrInstanceId === 'string') {
			const assetData = this.storage.get_object(assetOrInstanceId);
			if (!assetData || !assetData.mesh) {
				console.warn(`Asset with instance ID ${assetOrInstanceId} not found`);
				return;
			}
			asset = assetData.mesh;
		} else if (assetOrInstanceId && assetOrInstanceId.isObject3D) {
			asset = assetOrInstanceId;
		} else {
			console.warn('Invalid asset provided to stopAssetRotation');
			return;
		}

		this.rotator.stopRotation(asset);
	}

	/**
	 * Checks if an asset is currently rotating
	 * @param {THREE.Object3D|string} assetOrInstanceId - Asset mesh or instance ID
	 * @returns {boolean} True if asset is rotating
	 */
	isAssetRotating(assetOrInstanceId) {
		let asset;
		
		if (typeof assetOrInstanceId === 'string') {
			const assetData = this.storage.get_object(assetOrInstanceId);
			if (!assetData || !assetData.mesh) {
				return false;
			}
			asset = assetData.mesh;
		} else if (assetOrInstanceId && assetOrInstanceId.isObject3D) {
			asset = assetOrInstanceId;
		} else {
			return false;
		}

		return this.rotator.isRotating(asset);
	}

	async spawn_custom_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
		try {
			if (!CustomTypeManager.hasLoadedCustomTypes()) {
				throw new Error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
			}
			if (!CustomTypeManager.hasType(asset_type)) {
				throw new Error(`Unsupported asset type: "${asset_type}". Available types: ${Object.keys(CustomTypeManager.getTypes()).join(', ')}`);
			}

			const customTypeKey = CustomTypeManager.getType(asset_type);

			const gltfData = await this.storage.load_asset_type(customTypeKey);
			if (!gltfData) {
				throw new Error(`Failed to load custom asset type: ${customTypeKey}`);
			}

			let asset_config = this.#assetConfigs[customTypeKey];
			if (!asset_config) {
				asset_config = CustomTypeManager.getConfig(customTypeKey);
				if (asset_config) {
					this.#assetConfigs[customTypeKey] = asset_config;
				} else {
					throw new Error(`No configuration found for custom asset type: ${customTypeKey}`);
				}
			}

			const originalModel = gltfData.scene;
			const model = AssetUtils.cloneSkinnedMesh(originalModel);
			const scale = asset_config.scale || 1.0;
			model.scale.set(scale, scale, scale);
			model.position.copy(position);
			model.quaternion.copy(rotation);

			const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
			model.name = `interactable_${customTypeKey}_${uniqueId}`;

			const collisionMeshes = [];
			const displayMeshes = [];
			model.traverse((child) => {
				if (child.isMesh) {
					if (child.name.startsWith('col_')) {
						child.visible = false;
						collisionMeshes.push(child);
					} else if (child.name.startsWith('display_')) {
						child.visible = true;
						const displayMaterial = this.createDisplayMeshMaterial(0);
						child.material = displayMaterial;
						if (model.userData) {
							model.userData.currentDisplayImage = 0;
						}
						displayMeshes.push(child);
					} else {
						const childId = child.id || Math.floor(Math.random() * 10000);
						child.name = `interactable_${customTypeKey}_${child.name || 'part'}_${childId}`;
					}
				}
			});

			if (options.atlasConfig) {
				this.material_factory.applyPbrMaterial(model, options.atlasConfig);
			}

			if (displayMeshes.length > 0) {
				model.userData.displayMeshes = displayMeshes;
				model.userData.switchDisplayImage = (imageIndex) => {
					if (imageIndex < 0 || imageIndex > 2) {
						throw new Error(`Invalid image index: ${imageIndex}. Must be between 0 and 2.`);
					}
					displayMeshes.forEach(mesh => {
						if (mesh.material && mesh.material.map) {
							const texture = mesh.material.map;
							texture.offset.x = imageIndex / 3;
							texture.needsUpdate = true;
						}
					});
				};
			}

			// Add rotation methods to the model's userData for easy access
			model.userData.rotate = (axis, radians, duration, rotationOptions = {}) => {
				return this.rotateAsset(model, axis, radians, duration, rotationOptions);
			};

			model.userData.flip = (axis, duration, rotationOptions = {}) => {
				return this.flipAsset(model, axis, duration, rotationOptions);
			};

			model.userData.stopRotation = () => {
				this.stopAssetRotation(model);
			};

			model.userData.isRotating = () => {
				return this.isAssetRotating(model);
			};

			await new Promise(resolve => setTimeout(resolve, 0));
			this.scene.add(model);
			model.userData.assetType = customTypeKey;
			let physicsBody = null;

			if (options.enablePhysics !== false && this.world) {
				const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
					.setTranslation(position.x, position.y, position.z)
					.setLinearDamping(0.5)
					.setAngularDamping(0.6);
				rigidBodyDesc.setGravityScale(1.0);
				if (rotation) {
					rigidBodyDesc.setRotation(rotation);
				}
				physicsBody = this.world.createRigidBody(rigidBodyDesc);

				if (collisionMeshes.length > 0) {
					for (const collisionMesh of collisionMeshes) {
						await CollisionFactory.get_instance(this.world).create_collider_from_mesh(collisionMesh, physicsBody, asset_config, options);
					}
				} else {
					const halfScale = asset_config.scale / 2;
					let collider_desc;
					if (options.colliderType === 'sphere') {
						collider_desc = RAPIER.ColliderDesc.ball(halfScale);
					} else if (options.colliderType === 'capsule') {
						collider_desc = RAPIER.ColliderDesc.capsule(halfScale, halfScale * 0.5);
					} else {
						collider_desc = RAPIER.ColliderDesc.cuboid(halfScale, halfScale, halfScale);
					}
					collider_desc.setRestitution(asset_config.restitution || 0.5);
					collider_desc.setFriction(asset_config.friction || 0.5);
					this.world.createCollider(collider_desc, physicsBody);

					if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
						try {
							await this.create_debug_wireframe(
								'box',
								{ width: halfScale * 2, height: halfScale * 2, depth: halfScale * 2 },
								position,
								rotation,
								{ color: 0x00ff00, opacity: 0.3, body: physicsBody }
							);
						} catch (error) {
							console.warn('Failed to create debug wireframe:', error);
						}
					}
				}
			}

			const instance_id = this.storage.add_object(model, physicsBody);
			return {
				mesh: model,
				body: physicsBody,
				instance_id,
				rotate: model.userData.rotate,
				flip: model.userData.flip,
				stopRotation: model.userData.stopRotation,
				isRotating: model.userData.isRotating
			};
		} catch (error) {
			console.error(`Error spawning custom asset ${asset_type}:`, error);
			throw error;
		}
	}

	createDisplayMeshMaterial(displayMode = 0) {
		let material;
		switch(displayMode) {
		case 0:
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.0,
				side: THREE.DoubleSide
			});
			break;
		case 1:
			material = new THREE.MeshStandardMaterial({
				color: 0x000000,
				emissive: 0x000000,
				emissiveIntensity: 0,
				side: THREE.DoubleSide
			});
			break;
		case 2:
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				emissive: 0xffffff,
				emissiveIntensity: 0.3,
				side: THREE.DoubleSide
			});
			break;
		default:
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

	async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
		let geometry;
		if (type === 'mesh' && options.geometry) {
			geometry = options.geometry;
		} else {
			const size = dimensions || { x: 1, y: 1, z: 1 };
			switch (type) {
			case 'cuboid':
				geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
				break;
			case 'sphere':
				geometry = new THREE.SphereGeometry(size.radius || 1, 16, 16);
				break;
			case 'capsule':
				geometry = new THREE.CylinderGeometry(size.radius, size.radius, size.height, 16);
				break;
			default:
				geometry = new THREE.BoxGeometry(1, 1, 1);
			}
		}

		const staticColor = 0x00FF00;
		const blueColors = [
			0x0000FF, 0x4444FF, 0x0088FF, 0x00AAFF, 0x00FFFF,
			0x0066CC, 0x0033AA, 0x3366FF, 0x6666FF, 0x0099CC
		];

		let color;
		if (options.isStatic === true) {
			color = staticColor;
		} else {
			let hash = 0;
			const posX = Math.round(position.x * 10);
			const posY = Math.round(position.y * 10);
			const posZ = Math.round(position.z * 10);
			hash = Math.abs(posX + posY * 31 + posZ * 47) % blueColors.length;
			color = blueColors[hash];
		}

		const material = new THREE.MeshBasicMaterial({ 
			color: color,
			wireframe: true,
			transparent: true,
			opacity: 0.7
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.copy(position);
		mesh.quaternion.copy(rotation);

		if (options.scale && type === 'mesh') {
			mesh.scale.copy(options.scale);
		}

		mesh.renderOrder = 999;
		mesh.userData.physicsBodyId = options.bodyId;
		mesh.userData.debugType = type;
		mesh.userData.originalObject = options.originalObject;
		mesh.userData.isStatic = options.isStatic;

		await new Promise(resolve => setTimeout(resolve, 0));

		if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
			this.scene.add(mesh);
			this.debugMeshes.set(mesh.uuid, mesh);
		}

		return mesh;
	}

	async spawn_custom_assets(manifest_manager, progress_callback = null) {
		const spawned_assets = [];
		try {
			const custom_assets = manifest_manager.get_custom_assets();
			if (!custom_assets || custom_assets.length === 0) {
				return spawned_assets;
			}

			for (const asset_data of custom_assets) {
				const position = new THREE.Vector3(
					asset_data.position?.x || 0, 
					asset_data.position?.y || 0, 
					asset_data.position?.z || 0
				);
				const rotation = new THREE.Euler(
					asset_data.rotation?.x || 0,
					asset_data.rotation?.y || 0,
					asset_data.rotation?.z || 0
				);
				const quaternion = new THREE.Quaternion().setFromEuler(rotation);
				const options = {
					scale: asset_data.scale,
					material: asset_data.material,
					collider: asset_data.collider,
					mass: asset_data.mass,
					...asset_data.options
				};

				const result = await this.spawn_custom_asset(
					asset_data.asset_type,
					position,
					quaternion,
					options
				);

				if (result) {
					result.id = asset_data.id;
					spawned_assets.push(result);
				}
			}

			return spawned_assets;
		} catch (error) {
			console.error("Error spawning custom assets:", error);
			throw error;
		}
	}
}