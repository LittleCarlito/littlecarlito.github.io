import { THREE, RAPIER } from "../index.js";
import CustomTypeManager from "../custom_type_manager.js";
import { AssetStorage } from "../asset_storage.js";
import { BLORKPACK_FLAGS } from "../blorkpack_flags.js";
import { 
	SystemAssetType, 
	SystemFactory, 
	CustomFactory, 
	IdGenerator
} from "./index.js";
import { DebugFactory } from "./factories/debug_factory.js";
import { AssetRotator } from "./common/asset_rotator.js";
import { RigAnalyzer } from './data/rig_analyzer.js';
import { AnimationController } from './animation_controller.js';
import { createRigVisualization, updateRigVisualization, clearRigVisualization } from './factories/rig_factory.js';

export class AssetHandler {
	static #instance = null;
	static #disposed = false;
	storage;
	container;
	world;
	scene;
	debugFactory = null;
	rotator;
	rigAnalyzer;
	animationController;
	activeRigVisualizations = new Map();

	constructor(target_container = null, target_world = null) {
		if (AssetHandler.#instance) {
			throw new Error('AssetHandler is a singleton. Use AssetHandler.get_instance() instead.');
		}
		this.storage = AssetStorage.get_instance();
		this.container = target_container;
		this.world = target_world;
		this.rotator = AssetRotator.get_instance();
		this.rigAnalyzer = RigAnalyzer.get_instance();
		this.animationController = AnimationController.get_instance();
		this.activeRigVisualizations = new Map();
		AssetHandler.#instance = this;
		AssetHandler.#disposed = false;
	}

	static get_instance(scene, world) {
		if (AssetHandler.#disposed) {
			AssetHandler.#instance = null;
			AssetHandler.#disposed = false;
		}
		if (!AssetHandler.#instance) {
			AssetHandler.#instance = new AssetHandler(scene, world);
		} else if (scene || world) {
			if (scene) AssetHandler.#instance.scene = scene;
			if (world) AssetHandler.#instance.world = world;
		}
		
		if (scene && world && !AssetHandler.#instance.debugFactory) {
			AssetHandler.#instance.debugFactory = DebugFactory.get_instance(scene, world);
		}
		
		return AssetHandler.#instance;
	}

	updateAnimations(deltaTime) {
		this.animationController.updateAnimations(deltaTime);
	}

	stopAllAnimations() {
		this.animationController.stopAllAnimations();
	}

	removeAnimationMixer(instanceId) {
		this.animationController.removeAnimationMixer(instanceId);
	}

	analyzeAssetRig(spawnResult, assetType) {
		if (!spawnResult || !spawnResult.mesh) {
			return null;
		}

		try {
			const storage = AssetStorage.get_instance();
			const customTypeKey = CustomTypeManager.getType(assetType);
			
			if (storage.cached_models && storage.cached_models.has(customTypeKey)) {
				const gltfData = storage.cached_models.get(customTypeKey);
				const rigDetails = this.rigAnalyzer.analyze(gltfData, customTypeKey);
				
				if (rigDetails && rigDetails.hasRig && rigDetails.bones.length > 0) {
					if (!rigDetails.joints) {
						rigDetails.joints = [];
					}
					
					spawnResult.mesh.userData.rigDetails = rigDetails;
					spawnResult.mesh.userData.hasRig = true;
					spawnResult.rigDetails = rigDetails;
					
					this.createRigForAsset(spawnResult, rigDetails, assetType);
					
					return rigDetails;
				} else {
					spawnResult.mesh.userData.hasRig = false;
				}
			} else {
				console.warn(`[AssetHandler] No cached GLTF data found for ${assetType}, cannot analyze rig`);
			}
		} catch (error) {
			console.error(`[AssetHandler] Error analyzing rig for ${assetType}:`, error);
			spawnResult.mesh.userData.hasRig = false;
		}
		
		return null;
	}

	createRigForAsset(spawnResult, rigDetails, assetType) {
		if (!this.scene) {
			console.warn('[AssetHandler] No scene available for rig visualization');
			return;
		}

		try {
			const rigVisualization = createRigVisualization(rigDetails, this.scene, spawnResult.mesh);
			
			if (rigVisualization) {
				this.activeRigVisualizations.set(spawnResult.instance_id, {
					visualization: rigVisualization,
					assetType: assetType,
					mesh: spawnResult.mesh
				});
			}
		} catch (error) {
			console.error(`[AssetHandler] Error creating rig visualization for ${assetType}:`, error);
		}
	}

	updateRigVisualizations() {
		this.activeRigVisualizations.forEach((rigData, instanceId) => {
			try {
				updateRigVisualization();
			} catch (error) {
				console.error(`[AssetHandler] Error updating rig visualization for ${rigData.assetType}:`, error);
			}
		});
	}

	async spawn_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
		let type_value = typeof asset_type === 'object' && asset_type.value ? asset_type.value : asset_type;
		try {
			if (SystemAssetType.isSystemAssetType(type_value)) {
				if (type_value === SystemAssetType.CAMERA.value) {
					return this.spawn_scene_camera(options);
				}
				if (type_value === SystemAssetType.SPOTLIGHT.value) {
					const system_factory = SystemFactory.get_instance(this.scene, this.world);
					return await system_factory.spawn_asset(asset_type, position, rotation, options);
				}
				const system_factory = SystemFactory.get_instance(this.scene, this.world);
				return await system_factory.spawn_asset(asset_type, position, rotation, options);
			}
			if (CustomTypeManager.hasLoadedCustomTypes()) {
				if (CustomTypeManager.hasType(type_value)) {
					const custom_factory = CustomFactory.get_instance(this.scene, this.world);
					const spawnResult = await custom_factory.spawn_custom_asset(type_value, position, rotation, options);
					
					if (spawnResult) {
						this.animationController.analyzeAssetAnimations(spawnResult, type_value);
						this.analyzeAssetRig(spawnResult, type_value);
					}
					
					return spawnResult;
				} else {
					if (!CustomTypeManager.hasLoadedCustomTypes()) {
						console.error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
						console.error(`Failed to spawn asset type: "${type_value}"`);
					} else {
						console.error(`Unsupported asset type: "${type_value}". Cannot spawn asset.`);
						console.error(`Available types:`, Object.keys(CustomTypeManager.getTypes()));
					}
					return null;
				}
			}
		} catch (error) {
			if (typeof type_value !== 'undefined') {
				console.error(`Error spawning asset ${type_value}:`, error);
			} else {
				console.error(`Error spawning asset (type unknown):`, error);
				console.error(`Original asset_type:`, asset_type);
			}
			return null;
		}
	}

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

		const result = await this.rotator.rotateAsset(asset, axis, radians, duration, options);
		
		return result;
	}

	async flipAsset(assetOrInstanceId, axis, duration, options = {}) {
		const result = await this.rotateAsset(assetOrInstanceId, axis, Math.PI, duration, options);
		
		let asset;
		if (typeof assetOrInstanceId === 'string') {
			const assetData = this.storage.get_object(assetOrInstanceId);
			asset = assetData ? assetData.mesh : null;
		} else if (assetOrInstanceId && assetOrInstanceId.isObject3D) {
			asset = assetOrInstanceId;
		}
		
		return result;
	}

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

	getRotatingAssets() {
		return this.rotator.getRotatingAssets();
	}

	stopAllRotations() {
		this.rotator.stopAllRotations();
	}

	async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.create_debug_wireframe(type, dimensions, position, rotation, options);
	}

	update_debug_wireframes() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.update_debug_wireframes();
	}

	cleanup() {
		this.activeRigVisualizations.forEach((rigData, instanceId) => {
			try {
				if (this.scene) {
					clearRigVisualization(this.scene);
				}
			} catch (error) {
				console.error(`[AssetHandler] Error clearing rig visualization:`, error);
			}
		});
		this.activeRigVisualizations.clear();
		
		this.animationController.cleanup();
		
		AssetHandler.#instance = null;
		if (this.storage) {
			const allAssets = this.storage.get_all_assets();
			allAssets.forEach(asset => {
				if (asset && asset.mesh && asset.mesh.parent) {
					asset.mesh.parent.remove(asset.mesh);
				}
			});
		}
		if (this.world) {
			const dynamicBodies = this.storage.get_all_dynamic_bodies();
			dynamicBodies.forEach(([mesh, body]) => {
				if (body) {
					this.world.removeRigidBody(body);
				}
			});
		}
		this.storage = null;
		this.container = null;
		this.world = null;
	}

	cleanup_debug() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.cleanup_debug();
	}

	update_visualizations() {
		this.updateRigVisualizations();
		
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.update_visualizations();
	}

	async create_debug_wireframes_for_all_bodies() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.create_debug_wireframes_for_all_bodies();
	}

	async spawn_asset_groups(manifest_manager, progress_callback = null) {
		const spawned_assets = [];
		try {
			const asset_groups = manifest_manager.get_all_asset_groups();
			if (!asset_groups || asset_groups.length === 0) {
				return spawned_assets;
			}
			const active_groups = asset_groups.filter(group => group.active);
			for (const group of active_groups) {
				if (progress_callback) {
					progress_callback(`Loading asset group: ${group.name}...`);
				}
				for (const asset_id of group.assets) {
					const asset_data = manifest_manager.get_asset(asset_id);
					if (asset_data) {
						const asset_type = asset_data.asset_type;
						const custom_type = manifest_manager.get_custom_type(asset_type);
						if (custom_type) {
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
							const result = await this.spawn_asset(
								asset_type,
								position,
								quaternion,
								options
							);
							if (result) {
								result.id = asset_id;
								spawned_assets.push(result);
							}
						} else if (BLORKPACK_FLAGS.ASSET_LOGS) {
							console.warn(`Custom type "${asset_type}" not found for asset ${asset_id}`);
						}
					} else if (BLORKPACK_FLAGS.ASSET_LOGS) {
						console.warn(`Asset with ID "${asset_id}" not found in manifest`);
					}
				}
			}
		} catch (error) {
			console.error('Error spawning asset groups:', error);
		}
		return spawned_assets;
	}

	async spawn_manifest_assets(manifest_manager, progress_callback = null) {
		const spawned_assets = [];
		try {
			const system_assets = manifest_manager.get_system_assets();
			const custom_assets = manifest_manager.get_custom_assets();
			if (system_assets && system_assets.length > 0) {
				if (progress_callback) {
					progress_callback('Loading system assets...');
				}
				const system_factory = SystemFactory.get_instance(this.scene, this.world);
				const system_results = await system_factory.spawn_system_assets(manifest_manager, progress_callback);
				spawned_assets.push(...system_results);
			}
			if (custom_assets && custom_assets.length > 0) {
				if (progress_callback) {
					progress_callback('Loading custom assets...');
				}
				const custom_factory = CustomFactory.get_instance(this.scene, this.world);
				const custom_results = await custom_factory.spawn_custom_assets(manifest_manager, progress_callback);
				spawned_assets.push(...custom_results);
			}
			return spawned_assets;
		} catch (error) {
			console.error("Error spawning manifest assets:", error);
			return spawned_assets;
		}
	}

	spawn_scene_camera(camera_config) {
		if (!camera_config) {
			console.error("No camera configuration provided to spawn_scene_camera");
			return null;
		}
		const camera = new THREE.PerspectiveCamera(
			camera_config.fov || 75,
			window.innerWidth / window.innerHeight,
			camera_config.near || 0.1,
			camera_config.far || 1000
		);
		camera.position.set(
			camera_config.position?.x || 0,
			camera_config.position?.y || 5,
			camera_config.position?.z || 10
		);
		const camera_id = IdGenerator.get_instance().generate_asset_id();
		this.storage.store_static_mesh(camera_id, camera);
		return camera;
	}

	async create_debug_mesh(asset_type, asset) {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.create_debug_mesh(asset_type, asset);
	}

	async despawn_debug_meshes(asset) {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.despawn_debug_meshes(asset);
	}

	async update_debug_meshes() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.update_debug_meshes();
	}

	async forceDebugMeshUpdate() {
		if (!this.debugFactory) {
			this.debugFactory = DebugFactory.get_instance(this.scene, this.world);
		}
		return this.debugFactory.forceDebugMeshUpdate();
	}

	dispose() {
		if (!AssetHandler.#instance) return;
		CustomFactory.dispose_instance();
		DebugFactory.dispose_instance();
		AssetRotator.dispose_instance();
		if (this.rigAnalyzer) {
			this.rigAnalyzer.dispose();
		}
		if (this.animationController) {
			this.animationController.dispose();
		}
		this.scene = null;
		this.world = null;
		this.storage = null;
		this.container = null;
		this.debugFactory = null;
		this.rotator = null;
		this.rigAnalyzer = null;
		this.animationController = null;
		AssetHandler.#disposed = true;
		AssetHandler.#instance = null;
	}

	updateRigConfig(newConfig) {
		try {
			import('./factories/rig_factory.js').then(({ updateRigConfig }) => {
				updateRigConfig(newConfig);
			}).catch(error => {
				console.error('[AssetHandler] Error importing rig factory:', error);
			});
		} catch (error) {
			console.error('[AssetHandler] Error updating rig config:', error);
		}
	}

	setRigVisualizationEnabled(enabled) {
		try {
			import('./factories/rig_factory.js').then(({ setRigVisualizationEnabled }) => {
				setRigVisualizationEnabled(enabled);
			}).catch(error => {
				console.error('[AssetHandler] Error importing rig factory:', error);
			});
		} catch (error) {
			console.error('[AssetHandler] Error setting rig visualization state:', error);
		}
	}
}