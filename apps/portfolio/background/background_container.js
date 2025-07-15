import { THREE, FLAGS, RAPIER } from '../common';
import { AssetHandler, AssetStorage, CustomTypeManager }  from '@littlecarlito/blorkpack';
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";

const FLOOR_HEIGHT = -10;
const DESK_HEIGHT = FLOOR_HEIGHT/2;
const DIPLOMA_X = -7.2;
const DIPLOMA_Z = -.5;

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
	dynamic_bodies = [];
	asset_manifest = new Set();
	categorized_assets = new Map();
	loading_complete = false;
	loading_promise;
	is_spawning_secondary = false;
	is_spawning_primary = false;

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
		
		const asset_loader = AssetHandler.get_instance(this.asset_container, this.world);
		this.loading_promise = (async () => {
			try {
				if (!CustomTypeManager.hasLoadedCustomTypes()) {
					if (FLAGS.ASSET_LOGS) console.warn(`${this.name} Custom types not loaded yet. Waiting for them to load...`);
					await new Promise(resolve => setTimeout(resolve, 500));
					if (!CustomTypeManager.hasLoadedCustomTypes()) {
						throw new Error(`${this.name} Custom types still not loaded after waiting. Make sure CustomTypeManager.loadCustomTypes() is called before creating BackgroundContainer.`);
					}
				}
				const ASSET_TYPE = CustomTypeManager.getTypes();
				const ASSET_CONFIGS = CustomTypeManager.getConfigs();
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
				hideDisplayMeshes: true
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
			console.log(`${this.name} Created ${assetType} with name: ${mesh.name}${category ? `, category: ${category}` : ''}`);
		}
		
		this.createCollisionBoxes(mesh, body, assetConfigs[assetType]);
		
		return result;
	}

	createCollisionBoxes(mesh, body, assetConfig) {
		if (!body || !this.world) return;
		
		const collisionMeshes = [];
		
		mesh.traverse((child) => {
			if (child.isMesh && child.name.startsWith('col_')) {
				collisionMeshes.push(child);
			}
		});
		
		if (collisionMeshes.length > 0) {
			collisionMeshes.forEach(collisionMesh => {
				this.createColliderFromMesh(collisionMesh, body, assetConfig);
			});
			
			if (FLAGS.ASSET_LOGS) {
				console.log(`${this.name} Created ${collisionMeshes.length} collision boxes for ${mesh.name}`);
			}
		}
	}

	createColliderFromMesh(mesh, body, assetConfig) {
		const geometry = mesh.geometry;
		geometry.computeBoundingBox();
		const boundingBox = geometry.boundingBox;
		
		const width = boundingBox.max.x - boundingBox.min.x;
		const height = boundingBox.max.y - boundingBox.min.y;
		const depth = boundingBox.max.z - boundingBox.min.z;
		
		let shapeType = 'box';
		if (mesh.name.includes('sphere') || mesh.name.includes('ball')) {
			shapeType = 'sphere';
		} else if (mesh.name.includes('capsule')) {
			shapeType = 'capsule';
		}

		let colliderDesc;
		switch (shapeType) {
		case 'sphere':
			const radius = Math.max(width, height, depth) / 2;
			colliderDesc = RAPIER.ColliderDesc.ball(radius);
			break;
		case 'capsule':
			const capsuleRadius = Math.max(width, depth) / 2;
			const capsuleHeight = height;
			colliderDesc = RAPIER.ColliderDesc.capsule(capsuleHeight / 2, capsuleRadius);
			break;
		case 'box':
		default:
			colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
			break;
		}

		colliderDesc.setRestitution(assetConfig.restitution || 0.5);
		colliderDesc.setFriction(assetConfig.friction || 0.5);

		const worldPosition = new THREE.Vector3();
		const worldQuaternion = new THREE.Quaternion();
		mesh.getWorldPosition(worldPosition);
		mesh.getWorldQuaternion(worldQuaternion);
		
		colliderDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
		colliderDesc.setRotation(worldQuaternion);

		const collider = this.world.createCollider(colliderDesc, body);
		
		if (FLAGS.PHYSICS_LOGS) {
			console.log(`${this.name} Created ${shapeType} collider for ${mesh.name} at position:`, worldPosition);
		}
		
		return collider;
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
		
		const asset_handler = AssetHandler.get_instance();
		if (asset_handler && deltaTime !== undefined) {
			asset_handler.updateAnimations(deltaTime);
		}
	}

	contains_object(incoming_name) {
		return AssetStorage.get_instance().contains_object(incoming_name);
	}
}