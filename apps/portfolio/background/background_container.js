import { THREE, FLAGS, RAPIER } from '../common';
import { AssetHandler, AssetStorage, CustomTypeManager }  from '@littlecarlito/blorkpack';
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";

const FLOOR_HEIGHT = -10;
const DESK_HEIGHT = FLOOR_HEIGHT/2;
const DIPLOMA_X = -7.2;
const DIPLOMA_Z = -.5;

const SIMPLE_FLOOR_WIDTH = 15;
const SIMPLE_FLOOR_HEIGHT = 0.5;
const SIMPLE_FLOOR_DEPTH = 15;
const SIMPLE_FLOOR_X = 0;
const SIMPLE_FLOOR_Y = -10.25;
const SIMPLE_FLOOR_Z = 0;

const ASSET_CATEGORY_MAP = {
	DIPLOMA_BOT: CATEGORIES.EDUCATION.value,
	DIPLOMA_TOP: CATEGORIES.EDUCATION.value,
	NOTEBOOK_OPENED: CATEGORIES.PROJECTS.value,
	MONITOR: CATEGORIES.WORK.value,
	DESKPHOTO: CATEGORIES.ABOUT.value,
	TABLET: CATEGORIES.CONTACT.value
};

class SimpleFloorRectangle {
	constructor(world, parent) {
		this.world = world;
		this.parent = parent;
		this.width = SIMPLE_FLOOR_WIDTH;
		this.height = SIMPLE_FLOOR_HEIGHT;
		this.depth = SIMPLE_FLOOR_DEPTH;
		this.x = SIMPLE_FLOOR_X;
		this.y = SIMPLE_FLOOR_Y;
		this.z = SIMPLE_FLOOR_Z;
		
		this.mesh = null;
		this.body = null;
		this.collider = null;
		this.transparentMaterial = null;
		this.debugMaterial = null;
		
		console.log(`SimpleFloorRectangle: Creating floor at position (${this.x}, ${this.y}, ${this.z})`);
		this.createFloor();
	}
	
	createFloor() {
		const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
		
		// Create transparent material (default)
		this.transparentMaterial = new THREE.MeshStandardMaterial({ 
			color: 0xffffff,
			transparent: true,
			opacity: 0.0,
			roughness: 0.8,
			metalness: 0.2
		});
		
		// Create debug material (red for collision visualization)
		this.debugMaterial = new THREE.MeshStandardMaterial({ 
			color: 0xff0000,
			transparent: false,
			opacity: 1.0,
			roughness: 0.8,
			metalness: 0.2
		});
		
		this.mesh = new THREE.Mesh(geometry, this.transparentMaterial);
		this.mesh.position.set(this.x, this.y, this.z);
		this.mesh.name = "SimpleFloor";
		this.mesh.receiveShadow = true;
		
		// Add collision wireframe methods to userData
		this.mesh.userData.enableCollisionWireframes = () => {
			this.mesh.material = this.debugMaterial;
			this.mesh.material.needsUpdate = true;
		};
		
		this.mesh.userData.disableCollisionWireframes = () => {
			this.mesh.material = this.transparentMaterial;
			this.mesh.material.needsUpdate = true;
		};
		
		// Mark this mesh as having collision wireframes
		this.mesh.userData.collisionWireframes = true;
		
		console.log(`SimpleFloorRectangle: Mesh positioned at (${this.mesh.position.x}, ${this.mesh.position.y}, ${this.mesh.position.z})`);
		
		this.parent.add(this.mesh);
		
		if (this.world) {
			this.createPhysicsBody();
		}
	}
	
	createPhysicsBody() {
		const worldPosition = new THREE.Vector3();
		this.mesh.getWorldPosition(worldPosition);
		
		const bodyDesc = RAPIER.RigidBodyDesc.fixed();
		bodyDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
		this.body = this.world.createRigidBody(bodyDesc);
		
		const colliderDesc = RAPIER.ColliderDesc.cuboid(
			this.width / 2, 
			this.height / 2, 
			this.depth / 2
		);
		colliderDesc.setRestitution(0.3);
		colliderDesc.setFriction(0.8);
		colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
		
		this.collider = this.world.createCollider(colliderDesc, this.body);
		
		const bodyPos = this.body.translation();
		console.log(`SimpleFloorRectangle: Physics body positioned at (${bodyPos.x}, ${bodyPos.y}, ${bodyPos.z})`);
		console.log(`Created simple floor: ${SIMPLE_FLOOR_WIDTH}x${SIMPLE_FLOOR_HEIGHT}x${SIMPLE_FLOOR_DEPTH} at (${SIMPLE_FLOOR_X}, ${SIMPLE_FLOOR_Y}, ${SIMPLE_FLOOR_Z})`);
	}
	
	dispose() {
		if (this.collider) {
			this.world.removeCollider(this.collider, true);
		}
		if (this.body) {
			this.world.removeRigidBody(this.body);
		}
		if (this.mesh) {
			this.parent.remove(this.mesh);
			this.mesh.geometry.dispose();
			if (this.transparentMaterial) {
				this.transparentMaterial.dispose();
			}
			if (this.debugMaterial) {
				this.debugMaterial.dispose();
			}
		}
	}
}

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
	active_collisions = new Set();
	collision_debounce_timeout = 1000;

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
		
		this.setupCollisionEventListeners();
		
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

	setupCollisionEventListeners() {
		if (!this.world) {
			console.warn(`${this.name} No world available for collision event listeners`);
			return;
		}

		this.world.eventQueue = new RAPIER.EventQueue(true);
		console.log(`${this.name} 🎧 Collision event listeners initialized`);
		
		this.collision_check_interval = setInterval(() => {
			this.checkCollisionEvents();
		}, 16);
	}

	checkCollisionEvents() {
		if (!this.world || !this.world.eventQueue) return;

		this.world.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
			if (started) {
				this.handleCollisionStart(handle1, handle2);
			}
		});
	}

	handleCollisionStart(handle1, handle2) {
		const collider1 = this.world.getCollider(handle1);
		const collider2 = this.world.getCollider(handle2);
		
		if (!collider1 || !collider2) return;

		const body1 = collider1.parent();
		const body2 = collider2.parent();
		
		if (!body1 || !body2) return;

		const pairId = `${Math.min(handle1, handle2)}-${Math.max(handle1, handle2)}`;
		
		if (this.active_collisions.has(pairId)) return;
		
		this.active_collisions.add(pairId);
		setTimeout(() => {
			this.active_collisions.delete(pairId);
		}, this.collision_debounce_timeout);

		const mesh1Name = this.findMeshForBody(body1);
		const mesh2Name = this.findMeshForBody(body2);

		console.log(`🔥 COLLISION: ${mesh1Name} <-> ${mesh2Name}`);
	}

	findMeshForBody(body) {
		if (this.simple_floor && body === this.simple_floor.body) {
			return 'SimpleFloor';
		}
		
		const storage = AssetStorage.get_instance();
		const allAssets = storage.get_all_assets();
		
		for (const asset of allAssets) {
			if (asset.body === body) {
				return asset.mesh ? asset.mesh.name : 'Unnamed mesh';
			}
		}
		return 'Unknown mesh';
	}

	getBodyTypeName(bodyType) {
		switch(bodyType) {
			case RAPIER.RigidBodyType.Dynamic: return 'Dynamic';
			case RAPIER.RigidBodyType.Fixed: return 'Fixed';
			case RAPIER.RigidBodyType.KinematicPositionBased: return 'Kinematic';
			case RAPIER.RigidBodyType.KinematicVelocityBased: return 'KinematicVel';
			default: return 'Unknown';
		}
	}

	async spawnAsset(assetType, position, rotation, assetConfigs, category = null) {
		const asset_loader = AssetHandler.get_instance(this.asset_container, this.world);
		const atlasConfig = assetConfigs[assetType].materials.default;
		
		const config = assetConfigs[assetType];
		const needsCCD = this.shouldEnableCCD(assetType, config);
		
		const result = await asset_loader.spawn_asset(
			assetType,
			position,
			rotation,
			{ 
				enablePhysics: true,
				kinematic: true,
				atlasConfig: atlasConfig,
				hideDisplayMeshes: true,
				enableCCD: needsCCD
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
			console.log(`${this.name} Created ${assetType} with name: ${mesh.name}${category ? `, category: ${category}` : ''}${needsCCD ? ' [CCD ENABLED]' : ''}`);
		}
		
		this.createCollisionBoxes(mesh, body, assetConfigs[assetType]);
		
		return result;
	}

	shouldEnableCCD(assetType, config) {
		const thinAssetTypes = ['DIPLOMA_BOT', 'DIPLOMA_TOP', 'TABLET', 'NOTEBOOK_OPENED', 'DESKPHOTO'];
		
		if (thinAssetTypes.includes(assetType)) {
			if (FLAGS.PHYSICS_LOGS) {
				console.log(`${this.name} Enabling CCD for potentially thin asset: ${assetType}`);
			}
			return true;
		}
		
		if (config.scale && config.scale < 0.5) {
			if (FLAGS.PHYSICS_LOGS) {
				console.log(`${this.name} Enabling CCD for small scaled asset: ${assetType} (scale: ${config.scale})`);
			}
			return true;
		}
		
		return false;
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
		} else {
			if (FLAGS.ASSET_LOGS) {
				console.log(`${this.name} No collision meshes found for ${mesh.name} - no colliders created`);
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

		if (FLAGS.PHYSICS_LOGS) {
			console.log(`${this.name} Creating ${shapeType} collider for ${mesh.name}:`);
			console.log(`  Dimensions: ${width.toFixed(3)} × ${height.toFixed(3)} × ${depth.toFixed(3)}`);
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
		colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

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
		
		if (this.world && this.world.eventQueue && deltaTime) {
			this.world.step(this.world.eventQueue);
		}
		
		const asset_handler = AssetHandler.get_instance();
		if (asset_handler && deltaTime !== undefined) {
			asset_handler.updateAnimations(deltaTime);
		}
	}

	contains_object(incoming_name) {
		return AssetStorage.get_instance().contains_object(incoming_name);
	}

	dispose() {
		if (this.collision_check_interval) {
			clearInterval(this.collision_check_interval);
		}
		this.active_collisions.clear();
		if (this.simple_floor) {
			this.simple_floor.dispose();
		}
	}
}