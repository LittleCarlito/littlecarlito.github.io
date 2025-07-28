import { THREE, FLAGS, RAPIER } from '../common';
import { AssetHandler, AssetStorage, CustomTypeManager }  from '@littlecarlito/blorkpack';
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";
import { SimpleFloorRectangle } from './simple_floor_rectangle.js';

const FLOOR_HEIGHT = -10;
const DESK_HEIGHT = FLOOR_HEIGHT/2;
const DIPLOMA_X = -7.2;
const DIPLOMA_Z = -.5;
const DESPAWN_Y_THRESHOLD = -50;
const FALLEN_ASSET_CHECK_INTERVAL = 60; // Only check every 60 frames (~1 second at 60fps)

const ASSET_CATEGORY_MAP = {
	DIPLOMA_BOT: CATEGORIES.EDUCATION.value,
	DIPLOMA_TOP: CATEGORIES.EDUCATION.value,
	NOTEBOOK_OPENED: CATEGORIES.PROJECTS.value,
	MONITOR: CATEGORIES.WORK.value,
	DESKPHOTO: CATEGORIES.ABOUT.value,
	TABLET: CATEGORIES.CONTACT.value
};

export class BackgroundContainer {
	name = "[BackgroundContainer]"
	parent;
	camera;
	world;
	object_container;
	asset_container;
	simple_floor;
	dynamic_bodies = [];
	asset_manifest = new Set();
	categorized_assets = new Map();
	loading_complete = false;
	loading_promise;
	is_spawning_secondary = false;
	is_spawning_primary = false;
	dropped_asset_colliders = new Map();
	frameCount = 0; // Track frame count for optimizations

	constructor(incoming_parent, incoming_camera, incoming_world) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.world = incoming_world;
		this.object_container = new THREE.Object3D();
		this.parent.add(this.object_container);
		
		this.asset_container = new THREE.Object3D();
		this.asset_container.name = "asset_container";
		this.asset_container.userData.isAssetContainer = true;
		this.object_container.add(this.asset_container);
		
		this.simple_floor = new SimpleFloorRectangle(this.world, this.object_container);
		
		const asset_loader = AssetHandler.get_instance(this.asset_container, this.world);
		this.loading_promise = (async () => {
			try {
				const customTypeManager = CustomTypeManager.getInstance();
				if (!customTypeManager.hasLoadedCustomTypes()) {
					if (FLAGS.ASSET_LOGS) console.warn(`${this.name} Custom types not loaded yet. Waiting for them to load...`);
					await new Promise(resolve => setTimeout(resolve, 500));
					if (!customTypeManager.hasLoadedCustomTypes()) {
						throw new Error(`${this.name} Custom types still not loaded after waiting. Make sure CustomTypeManager.loadCustomTypes() is called before creating BackgroundContainer.`);
					}
				}
				const ASSET_TYPE = customTypeManager.getTypes();
				const ASSET_CONFIGS = customTypeManager.getConfigs();
				if (Object.keys(ASSET_TYPE).length === 0) {
					throw new Error(`${this.name} No custom asset types found. Assets will not spawn correctly.`);
				}
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Loaded custom types:`, Object.keys(ASSET_TYPE));
				
				await this.spawnAsset(ASSET_TYPE.ROOM, new THREE.Vector3(0, FLOOR_HEIGHT, 0), new THREE.Quaternion(), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.DESK, new THREE.Vector3(-.5, FLOOR_HEIGHT, -.75), new THREE.Quaternion(), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.CHAIR, new THREE.Vector3(-1, FLOOR_HEIGHT, -1.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + Math.PI / 4), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.CAT, new THREE.Vector3(5.5, FLOOR_HEIGHT, -6), new THREE.Quaternion(), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.PLANT, new THREE.Vector3(-6, FLOOR_HEIGHT, 6), new THREE.Quaternion(), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.COMPUTER, new THREE.Vector3(-4, FLOOR_HEIGHT, 2.5), new THREE.Quaternion(), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.MONITOR, new THREE.Vector3(-4.5, DESK_HEIGHT, -5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), ASSET_CONFIGS, ASSET_CATEGORY_MAP.MONITOR);
				await this.spawnAsset(ASSET_TYPE.KEYBOARD, new THREE.Vector3(-4, DESK_HEIGHT, -3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 8), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.MOUSEPAD, new THREE.Vector3(-2, DESK_HEIGHT, -5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 8), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.MOUSE, new THREE.Vector3(-2, DESK_HEIGHT, -5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2 + Math.PI / 4), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.DESKPHOTO, new THREE.Vector3(0, DESK_HEIGHT, -7), new THREE.Quaternion(), ASSET_CONFIGS, ASSET_CATEGORY_MAP.DESKPHOTO);
				await this.spawnAsset(ASSET_TYPE.TABLET, new THREE.Vector3(2, DESK_HEIGHT, -5), new THREE.Quaternion(), ASSET_CONFIGS, ASSET_CATEGORY_MAP.TABLET);
				await this.spawnAsset(ASSET_TYPE.NOTEBOOK_CLOSED, new THREE.Vector3(-6, DESK_HEIGHT, 2.5), new THREE.Quaternion(), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.BOOK, new THREE.Vector3(-6, DESK_HEIGHT + .25, 2.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), ASSET_CONFIGS);
				await this.spawnAsset(ASSET_TYPE.NOTEBOOK_OPENED, new THREE.Vector3(-5, DESK_HEIGHT, 0), new THREE.Quaternion(), ASSET_CONFIGS, ASSET_CATEGORY_MAP.NOTEBOOK_OPENED);
				await this.spawnAsset(ASSET_TYPE.DIPLOMA_BOT, new THREE.Vector3(DIPLOMA_X, 1.5, DIPLOMA_Z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), ASSET_CONFIGS, ASSET_CATEGORY_MAP.DIPLOMA_BOT);
				await this.spawnAsset(ASSET_TYPE.DIPLOMA_TOP, new THREE.Vector3(DIPLOMA_X, -1.5, DIPLOMA_Z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), ASSET_CONFIGS, ASSET_CATEGORY_MAP.DIPLOMA_TOP);
				
				this.setBackgroundRenderOrder();
				
				if (FLAGS.PHYSICS_LOGS) {
					console.log('All assets initialized successfully');
				}
				this.loading_complete = true;
			} catch (error) {
				console.error('Error initializing assets:', error);
				this.loading_complete = true;
				throw error;
			}
		})();
	}

	async spawnAsset(assetType, position, rotation, assetConfigs, category = null) {
		const asset_loader = AssetHandler.get_instance(this.asset_container, this.world);
		const atlasConfig = assetConfigs[assetType].materials.default;
		
		const result = await asset_loader.spawn_asset(
			assetType,
			position,
			rotation,
			{ 
				enablePhysics: true,
				kinematic: true,
				atlasConfig: atlasConfig,
				hideDisplayMeshes: true,
				enableCCD: false
			}
		);
		
		if (!result) {
			throw new Error(`${this.name} Failed to spawn ${assetType}, result is null`);
		}
		
		let mesh = result.mesh;
		let body = result.body;
		
		mesh.name = `${TYPES.INTERACTABLE}${assetType}`;
		
		if (category) {
			mesh.userData.category = category;
			this.addToCategory(category, mesh, body);
		}
		
		this.asset_manifest.add(mesh.name);
		
		if (FLAGS.ASSET_LOGS) {
			console.log(`${this.name} Created ${assetType} with name: ${mesh.name}${category ? `, category: ${category}` : ''} - Body Type: ${body ? 'KINEMATIC' : 'NONE'}`);
		}
		
		return result;
	}

	createCollisionBoxForDroppedAsset(mesh, body, assetConfig) {
		if (!body || !this.world || !mesh) {
			if (FLAGS.PHYSICS_LOGS) {
				console.warn(`${this.name} Cannot create collision box - missing body, world, or mesh`);
			}
			return null;
		}

		const existingCollider = this.dropped_asset_colliders.get(mesh.name);
		if (existingCollider) {
			if (FLAGS.PHYSICS_LOGS) {
				console.log(`${this.name} Removing existing collider for ${mesh.name}`);
			}
			this.world.removeCollider(existingCollider, true);
			this.dropped_asset_colliders.delete(mesh.name);
		}

		mesh.geometry.computeBoundingBox();
		const boundingBox = mesh.geometry.boundingBox;
		
		if (!boundingBox) {
			if (FLAGS.PHYSICS_LOGS) {
				console.warn(`${this.name} No bounding box for ${mesh.name} - cannot create collider`);
			}
			return null;
		}
		
		const width = boundingBox.max.x - boundingBox.min.x;
		const height = boundingBox.max.y - boundingBox.min.y;
		const depth = boundingBox.max.z - boundingBox.min.z;

		const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
		colliderDesc.setRestitution(assetConfig?.restitution || 0.3);
		colliderDesc.setFriction(assetConfig?.friction || 0.7);

		const worldPosition = new THREE.Vector3();
		const worldQuaternion = new THREE.Quaternion();
		mesh.getWorldPosition(worldPosition);
		mesh.getWorldQuaternion(worldQuaternion);
		
		colliderDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
		colliderDesc.setRotation(worldQuaternion);

		const collider = this.world.createCollider(colliderDesc, body);
		
		if (collider) {
			this.dropped_asset_colliders.set(mesh.name, collider);
			if (FLAGS.PHYSICS_LOGS) {
				console.log(`${this.name} Created hack collision box for dropped asset: ${mesh.name}`);
				console.log(`  Dimensions: ${width.toFixed(3)} × ${height.toFixed(3)} × ${depth.toFixed(3)}`);
				console.log(`  Position: (${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)})`);
			}
		}
		
		return collider;
	}

	removeCollisionBoxForAsset(mesh) {
		if (!mesh || !mesh.name) return;

		const collider = this.dropped_asset_colliders.get(mesh.name);
		if (collider && this.world) {
			this.world.removeCollider(collider, true);
			this.dropped_asset_colliders.delete(mesh.name);
			if (FLAGS.PHYSICS_LOGS) {
				console.log(`${this.name} Removed collision box for ${mesh.name}`);
			}
		}
	}

	despawnAsset(mesh, body) {
		if (!mesh) return;

		const assetName = mesh.name;
		
		console.log(`${this.name} Despawning asset: ${assetName} (fell below Y threshold of ${DESPAWN_Y_THRESHOLD}) - Final position: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
		console.log(`${this.name} Physics body position: (${body ? body.translation().x.toFixed(2) : 'N/A'}, ${body ? body.translation().y.toFixed(2) : 'N/A'}, ${body ? body.translation().z.toFixed(2) : 'N/A'})`)

		this.removeCollisionBoxForAsset(mesh);

		if (body && this.world) {
			this.world.removeRigidBody(body);
		}

		this.dynamic_bodies = this.dynamic_bodies.filter(entry => {
			const entryMesh = Array.isArray(entry) ? entry[0] : entry.mesh;
			return entryMesh !== mesh;
		});

		for (const [category, assets] of this.categorized_assets.entries()) {
			const filteredAssets = assets.filter(asset => asset.mesh !== mesh);
			if (filteredAssets.length !== assets.length) {
				this.categorized_assets.set(category, filteredAssets);
			}
		}

		const assetStorage = AssetStorage.get_instance();
		if (assetStorage) {
			const bodyPair = assetStorage.get_body_pair_by_mesh(mesh);
			if (bodyPair) {
				const instanceId = mesh.userData?.instanceId;
				if (instanceId && assetStorage.dynamic_bodies?.has(instanceId)) {
					assetStorage.dynamic_bodies.delete(instanceId);
				}
			}
		}

		if (mesh.parent) {
			mesh.parent.remove(mesh);
		}

		if (mesh.geometry) {
			mesh.geometry.dispose();
		}
		if (mesh.material) {
			if (Array.isArray(mesh.material)) {
				mesh.material.forEach(material => {
					if (material.map) material.map.dispose();
					material.dispose();
				});
			} else {
				if (mesh.material.map) mesh.material.map.dispose();
				mesh.material.dispose();
			}
		}
	}

	checkForFallenAssets() {
		const assetsToRemove = [];
		
		// Only check fallen assets occasionally, not every frame
		if (this.frameCount % FALLEN_ASSET_CHECK_INTERVAL !== 0) {
			return 0;
		}
		
		this.dynamic_bodies.forEach(entry => {
			const mesh = Array.isArray(entry) ? entry[0] : entry.mesh;
			const body = Array.isArray(entry) ? entry[1] : entry.body;
			
			if (mesh && body) {
				const bodyPosition = body.translation();
				const meshY = mesh.position.y;
				const bodyY = bodyPosition.y;
				
				if (bodyY < DESPAWN_Y_THRESHOLD || meshY < DESPAWN_Y_THRESHOLD) {
					console.log(`${this.name} Asset ${mesh.name} marked for despawn - Mesh Y: ${meshY.toFixed(2)}, Body Y: ${bodyY.toFixed(2)}, Threshold: ${DESPAWN_Y_THRESHOLD}`);
					assetsToRemove.push({ mesh, body });
				}
			} else if (mesh && mesh.position.y < DESPAWN_Y_THRESHOLD) {
				console.log(`${this.name} Asset ${mesh.name} marked for despawn (no body) - Mesh Y: ${mesh.position.y.toFixed(2)}, Threshold: ${DESPAWN_Y_THRESHOLD}`);
				assetsToRemove.push({ mesh, body });
			}
		});

		const assetStorage = AssetStorage.get_instance();
		if (assetStorage) {
			assetStorage.get_all_dynamic_bodies().forEach(([mesh, body]) => {
				if (mesh && body && mesh.name && mesh.name.includes('interactable_')) {
					const bodyPosition = body.translation();
					const meshY = mesh.position.y;
					const bodyY = bodyPosition.y;
					
					if (bodyY < DESPAWN_Y_THRESHOLD || meshY < DESPAWN_Y_THRESHOLD) {
						const alreadyMarked = assetsToRemove.some(item => item.mesh === mesh);
						if (!alreadyMarked) {
							console.log(`${this.name} Asset ${mesh.name} (from AssetStorage) marked for despawn - Mesh Y: ${meshY.toFixed(2)}, Body Y: ${bodyY.toFixed(2)}, Threshold: ${DESPAWN_Y_THRESHOLD}`);
							assetsToRemove.push({ mesh, body });
						}
					}
				}
			});
		}

		assetsToRemove.forEach(({ mesh, body }) => {
			this.despawnAsset(mesh, body);
		});

		if (assetsToRemove.length > 0) {
			console.log(`${this.name} Despawned ${assetsToRemove.length} assets this frame`);
		}

		return assetsToRemove.length;
	}

	setBackgroundRenderOrder() {
		this.asset_container.traverse((child) => {
			if (child.isMesh) {
				if (child.userData.bonePart || 
					child.userData.isControlHandle || 
					child.userData.isVisualBone ||
					child.name === "RigControlHandle" ||
					(child.parent && child.parent.name === "RigVisualization")) {
					return;
				}
				
				child.renderOrder = 0;
				if (child.material) {
					const materials = Array.isArray(child.material) ? child.material : [child.material];
					materials.forEach(material => {
						material.depthTest = true;
						material.depthWrite = true;
					});
				}
			}
		});
	}

	addToCategory(category, mesh, body) {
		if (!this.categorized_assets.has(category)) {
			this.categorized_assets.set(category, []);
		}
		this.categorized_assets.get(category).push({ mesh, body });
	}

	getAssetsByCategory(category) {
		return this.categorized_assets.get(category) || [];
	}

	getAllCategorizedAssets() {
		const result = {};
		this.categorized_assets.forEach((assets, category) => {
			result[category] = assets;
		});
		return result;
	}

	getCategoryForAsset(assetName) {
		for (const [category, assets] of this.categorized_assets.entries()) {
			const found = assets.find(asset => asset.mesh.name === assetName);
			if (found) return category;
		}
		return null;
	}

	async is_loading_complete() {
		try {
			await this.loading_promise;
			return true;
		} catch (error) {
			console.error('Error checking loading status:', error);
			return false;
		}
	}

	get_asset_manifest() {
		return this.asset_manifest;
	}

	update(grabbed_object, viewable_container, deltaTime) {
		this.frameCount++;
		
		// Only sync mesh positions from physics bodies
		this.dynamic_bodies.forEach(entry => {
			const mesh = Array.isArray(entry) ? entry[0] : entry.mesh;
			const body = Array.isArray(entry) ? entry[1] : entry.body;
			if(body != null) {
				const position = body.translation();
				mesh.position.set(position.x, position.y, position.z);
				const rotation = body.rotation();
				mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
			}
		});
		
		// Only check for fallen assets occasionally to reduce overhead
		this.checkForFallenAssets();
	}

	contains_object(incoming_name) {
		return AssetStorage.get_instance().contains_object(incoming_name);
	}

	dispose() {
		this.dropped_asset_colliders.forEach((collider, assetName) => {
			if (this.world) {
				this.world.removeCollider(collider, true);
			}
		});
		this.dropped_asset_colliders.clear();
		
		if (this.simple_floor) {
			this.simple_floor.dispose();
		}
	}
}