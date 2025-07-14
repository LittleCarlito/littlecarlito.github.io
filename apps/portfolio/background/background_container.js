import { THREE, FLAGS, RAPIER } from '../common';
import { AssetHandler, AssetStorage, CustomTypeManager }  from '@littlecarlito/blorkpack';
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";

const FLOOR_HEIGHT = -10;
const DESK_HEIGHT = FLOOR_HEIGHT/2;
const DIPLOMA_X = -7.2;
const DIPLOMA_Z = -.5;

const GLOBAL_ROTATION_X = 7;
const GLOBAL_ROTATION_Y = -25;
const GLOBAL_ROTATION_Z = 0;

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
	is_mouse_rotating = false;
	last_mouse_x = 0;
	last_mouse_y = 0;
	rotation_sensitivity = 0.01;

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
		
		this.asset_container.rotation.set(
			THREE.MathUtils.degToRad(GLOBAL_ROTATION_X),
			THREE.MathUtils.degToRad(GLOBAL_ROTATION_Y),
			THREE.MathUtils.degToRad(GLOBAL_ROTATION_Z)
		);
		
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
				
				// Room
				const roomPosition = new THREE.Vector3(0, FLOOR_HEIGHT, 0);
				const roomAtlas = ASSET_CONFIGS[ASSET_TYPE.ROOM].materials.default;
				const roomResult = await asset_loader.spawn_asset(
					ASSET_TYPE.ROOM,
					roomPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: roomAtlas,
						hideDisplayMeshes: true
					});
				if (!roomResult) {
					throw new Error(`${this.name} Failed to spawn ROOM, result is null`);
				}
				let mesh = roomResult.mesh;
				let body = roomResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.ROOM}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Room with name: ${mesh.name}`);
				
				// Desk
				const deskPosition = new THREE.Vector3(-.5, FLOOR_HEIGHT, -.75);
				const deskAtlas = ASSET_CONFIGS[ASSET_TYPE.DESK].materials.default;
				const deskResult = await asset_loader.spawn_asset(
					ASSET_TYPE.DESK,
					deskPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: deskAtlas,
						hideDisplayMeshes: true
					});
				if (!deskResult) {
					throw new Error(`${this.name} Failed to spawn DESK, result is null`);
				}
				mesh = deskResult.mesh;
				body = deskResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESK}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk with name: ${mesh.name}`);
				
				// Chair
				const chairPosition = new THREE.Vector3(-1, FLOOR_HEIGHT, -1.5);
				const chairAtlas = ASSET_CONFIGS[ASSET_TYPE.CHAIR].materials.default;
				const chairResult = await asset_loader.spawn_asset(
					ASSET_TYPE.CHAIR,
					chairPosition,
					new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + Math.PI / 4),
					{ 
						enablePhysics: false,
						atlasConfig: chairAtlas,
						hideDisplayMeshes: true
					});
				if (!chairResult) {
					throw new Error(`${this.name} Failed to spawn CHAIR, result is null`);
				}
				mesh = chairResult.mesh;
				body = chairResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.CHAIR}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Chair with name: ${mesh.name}`);
				
				// Cat
				const catPosition = new THREE.Vector3(5.5, FLOOR_HEIGHT, -6);
				const catAtlas = ASSET_CONFIGS[ASSET_TYPE.CAT].materials.default;
				const catResult = await asset_loader.spawn_asset(
					ASSET_TYPE.CAT,
					catPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: catAtlas,
						hideDisplayMeshes: true
					});
				if (!catResult) {
					throw new Error(`${this.name} Failed to spawn CAT, result is null`);
				}
				mesh = catResult.mesh;
				body = catResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.CAT}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Cat with name: ${mesh.name}`);
				
				// Plant
				const plantPosition = new THREE.Vector3(-6, FLOOR_HEIGHT, 6);
				const plantAtlas = ASSET_CONFIGS[ASSET_TYPE.PLANT].materials.default;
				const plantResult = await asset_loader.spawn_asset(
					ASSET_TYPE.PLANT,
					plantPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: plantAtlas,
						hideDisplayMeshes: true
					});
				if (!plantResult) {
					throw new Error(`${this.name} Failed to spawn PLANT, result is null`);
				}
				mesh = plantResult.mesh;
				body = plantResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.PLANT}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Plant with name: ${mesh.name}`);
				
				// Computer
				const computerPosition = new THREE.Vector3(-4, FLOOR_HEIGHT, 2.5);
				const computerAtlas = ASSET_CONFIGS[ASSET_TYPE.COMPUTER].materials.default;
				const computerResult = await asset_loader.spawn_asset(
					ASSET_TYPE.COMPUTER,
					computerPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: computerAtlas,
						hideDisplayMeshes: true
					});
				if (!computerResult) {
					throw new Error(`${this.name} Failed to spawn COMPUTER, result is null`);
				}
				mesh = computerResult.mesh;
				body = computerResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.COMPUTER}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Computer with name: ${mesh.name}`);
				
				// Monitor - WORK category
				const monitorPosition = new THREE.Vector3(-4.5, DESK_HEIGHT, -5);
				const monitorAtlas = ASSET_CONFIGS[ASSET_TYPE.MONITOR].materials.default;
				const monitorResult = await asset_loader.spawn_asset(
					ASSET_TYPE.MONITOR,
					monitorPosition,
					new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
					{ 
						enablePhysics: false,
						atlasConfig: monitorAtlas,
						hideDisplayMeshes: true
					});
				if (!monitorResult) {
					throw new Error(`${this.name} Failed to spawn MONITOR, result is null`);
				}
				mesh = monitorResult.mesh;
				body = monitorResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MONITOR}`;
				mesh.userData.category = ASSET_CATEGORY_MAP.MONITOR;
				this.asset_manifest.add(mesh.name);
				this.addToCategory(ASSET_CATEGORY_MAP.MONITOR, mesh, body);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Monitor with name: ${mesh.name}, category: ${mesh.userData.category}`);
				
				// Keyboard
				const keyboardPosition = new THREE.Vector3(-4, DESK_HEIGHT, -3);
				const keyboardAtlas = ASSET_CONFIGS[ASSET_TYPE.KEYBOARD].materials.default;
				const keyboardResult = await asset_loader.spawn_asset(
					ASSET_TYPE.KEYBOARD,
					keyboardPosition,
					new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 8),
					{ 
						enablePhysics: false,
						atlasConfig: keyboardAtlas,
						hideDisplayMeshes: true
					});
				if (!keyboardResult) {
					throw new Error(`${this.name} Failed to spawn KEYBOARD, result is null`);
				}
				mesh = keyboardResult.mesh;
				body = keyboardResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.KEYBOARD}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Keyboard with name: ${mesh.name}`);
				
				// Mousepad
				const mousepadPosition = new THREE.Vector3(-2, DESK_HEIGHT, -5);
				const mousepadAtlas = ASSET_CONFIGS[ASSET_TYPE.MOUSEPAD].materials.default;
				const mousepadResult = await asset_loader.spawn_asset(
					ASSET_TYPE.MOUSEPAD,
					mousepadPosition,
					new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 8),
					{ 
						enablePhysics: false,
						atlasConfig: mousepadAtlas,
						hideDisplayMeshes: true
					});
				if (!mousepadResult) {
					throw new Error(`${this.name} Failed to spawn MOUSEPAD, result is null`);
				}
				mesh = mousepadResult.mesh;
				body = mousepadResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MOUSEPAD}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Mousepad with name: ${mesh.name}`);
				
				// Mouse
				const mousePosition = new THREE.Vector3(-2, DESK_HEIGHT, -5);
				const mouseAtlas = ASSET_CONFIGS[ASSET_TYPE.MOUSE].materials.default;
				const mouseResult = await asset_loader.spawn_asset(
					ASSET_TYPE.MOUSE,
					mousePosition,
					new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2 + Math.PI / 4),
					{ 
						enablePhysics: false,
						atlasConfig: mouseAtlas,
						hideDisplayMeshes: true
					});
				if (!mouseResult) {
					throw new Error(`${this.name} Failed to spawn MOUSE, result is null`);
				}
				mesh = mouseResult.mesh;
				body = mouseResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MOUSE}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Mouse with name: ${mesh.name}`);
				
				// Desk Photo - ABOUT category
				const deskPhotoPosition = new THREE.Vector3(0, DESK_HEIGHT, -7);
				const deskPhotoAtlas = ASSET_CONFIGS[ASSET_TYPE.DESKPHOTO].materials.default;
				const deskPhotoResult = await asset_loader.spawn_asset(
					ASSET_TYPE.DESKPHOTO,
					deskPhotoPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: deskPhotoAtlas,
						hideDisplayMeshes: true
					});
				if (!deskPhotoResult) {
					throw new Error(`${this.name} Failed to spawn DESKPHOTO, result is null`);
				}
				mesh = deskPhotoResult.mesh;
				body = deskPhotoResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESKPHOTO}`;
				mesh.userData.category = ASSET_CATEGORY_MAP.DESKPHOTO;
				this.asset_manifest.add(mesh.name);
				this.addToCategory(ASSET_CATEGORY_MAP.DESKPHOTO, mesh, body);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk photo with name: ${mesh.name}, category: ${mesh.userData.category}`);
				
				// Tablet - CONTACT category
				const tabletPosition = new THREE.Vector3(2, DESK_HEIGHT, -5);
				const tabletAtlas = ASSET_CONFIGS[ASSET_TYPE.TABLET].materials.default;
				const tabletResult = await asset_loader.spawn_asset(
					ASSET_TYPE.TABLET,
					tabletPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: tabletAtlas,
						hideDisplayMeshes: true
					});
				if (!tabletResult) {
					throw new Error(`${this.name} Failed to spawn TABLET, result is null`);
				}
				mesh = tabletResult.mesh;
				body = tabletResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.TABLET}`;
				mesh.userData.category = ASSET_CATEGORY_MAP.TABLET;
				this.asset_manifest.add(mesh.name);
				this.addToCategory(ASSET_CATEGORY_MAP.TABLET, mesh, body);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Tablet with name: ${mesh.name}, category: ${mesh.userData.category}`);
				
				// Notebook Closed
				const notebookClosedPosition = new THREE.Vector3(-6, DESK_HEIGHT, 2.5);
				const notebookClosedAtlas = ASSET_CONFIGS[ASSET_TYPE.NOTEBOOK_CLOSED].materials.default;
				const notebookClosedResult = await asset_loader.spawn_asset(
					ASSET_TYPE.NOTEBOOK_CLOSED,
					notebookClosedPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: notebookClosedAtlas,
						hideDisplayMeshes: true
					});
				if (!notebookClosedResult) {
					throw new Error(`${this.name} Failed to spawn NOTEBOOK_CLOSED, result is null`);
				}
				mesh = notebookClosedResult.mesh;
				body = notebookClosedResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.NOTEBOOK_CLOSED}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Notebook closed with name: ${mesh.name}`);
				
				// Book
				const bookPosition = new THREE.Vector3(-6, DESK_HEIGHT + .25, 2.5);
				const bookAtlas = ASSET_CONFIGS[ASSET_TYPE.BOOK].materials.default;
				const result = await asset_loader.spawn_asset(
					ASSET_TYPE.BOOK,
					bookPosition,
					new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
					{ 
						enablePhysics: false,
						atlasConfig: bookAtlas,
						hideDisplayMeshes: true
					});
				if (!result) {
					throw new Error(`${this.name} Failed to spawn BOOK, result is null`);
				}
				mesh = result.mesh;
				body = result.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.BOOK}`;
				this.asset_manifest.add(mesh.name);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Book with name: ${mesh.name}`);
				
				// Notebook Opened - PROJECTS category
				const notebookOpenedPosition = new THREE.Vector3(-5, DESK_HEIGHT, 0);
				const notebookOpenedAtlas = ASSET_CONFIGS[ASSET_TYPE.NOTEBOOK_OPENED].materials.default;
				const notebookOpenedResult = await asset_loader.spawn_asset(
					ASSET_TYPE.NOTEBOOK_OPENED,
					notebookOpenedPosition,
					new THREE.Quaternion(),
					{ 
						enablePhysics: false,
						atlasConfig: notebookOpenedAtlas,
						hideDisplayMeshes: true
					});
				if (!notebookOpenedResult) {
					throw new Error(`${this.name} Failed to spawn NOTEBOOK_OPENED, result is null`);
				}
				mesh = notebookOpenedResult.mesh;
				body = notebookOpenedResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.NOTEBOOK_OPENED}`;
				mesh.userData.category = ASSET_CATEGORY_MAP.NOTEBOOK_OPENED;
				this.asset_manifest.add(mesh.name);
				this.addToCategory(ASSET_CATEGORY_MAP.NOTEBOOK_OPENED, mesh, body);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Notebook opened with name: ${mesh.name}, category: ${mesh.userData.category}`);
				
				// Diploma Bot - EDUCATION category
				const diplomaBotPosition = new THREE.Vector3(DIPLOMA_X, 1.5, DIPLOMA_Z);
				const diplomaBotAtlas = ASSET_CONFIGS[ASSET_TYPE.DIPLOMA_BOT].materials.default;
				const diplomaBotResult = await asset_loader.spawn_asset(
					ASSET_TYPE.DIPLOMA_BOT,
					diplomaBotPosition,
					new THREE.Quaternion()
						.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
						.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)),
					{ 
						enablePhysics: false,
						atlasConfig: diplomaBotAtlas,
						hideDisplayMeshes: true
					});
				if (!diplomaBotResult) {
					throw new Error(`${this.name} Failed to spawn DIPLOMA_BOT, result is null`);
				}
				mesh = diplomaBotResult.mesh;
				body = diplomaBotResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DIPLOMA_BOT}`;
				mesh.userData.category = ASSET_CATEGORY_MAP.DIPLOMA_BOT;
				this.asset_manifest.add(mesh.name);
				this.addToCategory(ASSET_CATEGORY_MAP.DIPLOMA_BOT, mesh, body);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma Bot with name: ${mesh.name}, category: ${mesh.userData.category}`);
				
				// Diploma Top - EDUCATION category
				const diplomaTopPosition = new THREE.Vector3(DIPLOMA_X, -1.5, DIPLOMA_Z);
				const diplomaTopAtlas = ASSET_CONFIGS[ASSET_TYPE.DIPLOMA_TOP].materials.default;
				const diplomaTopResult = await asset_loader.spawn_asset(
					ASSET_TYPE.DIPLOMA_TOP,
					diplomaTopPosition,
					new THREE.Quaternion()
						.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
						.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)),
					{ 
						enablePhysics: false,
						atlasConfig: diplomaTopAtlas,
						hideDisplayMeshes: true
					});
				if (!diplomaTopResult) {
					throw new Error(`${this.name} Failed to spawn DIPLOMA_TOP, result is null`);
				}
				mesh = diplomaTopResult.mesh;
				body = diplomaTopResult.body;
				mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DIPLOMA_TOP}`;
				mesh.userData.category = ASSET_CATEGORY_MAP.DIPLOMA_TOP;
				this.asset_manifest.add(mesh.name);
				this.addToCategory(ASSET_CATEGORY_MAP.DIPLOMA_TOP, mesh, body);
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma Top with name: ${mesh.name}, category: ${mesh.userData.category}`);
				
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

	setGlobalRotation(x, y, z) {
		this.asset_container.rotation.set(
			THREE.MathUtils.degToRad(x),
			THREE.MathUtils.degToRad(y),
			THREE.MathUtils.degToRad(z)
		);
	}

	getGlobalRotation() {
		return {
			x: THREE.MathUtils.radToDeg(this.asset_container.rotation.x),
			y: THREE.MathUtils.radToDeg(this.asset_container.rotation.y),
			z: THREE.MathUtils.radToDeg(this.asset_container.rotation.z)
		};
	}

	animateGlobalRotation(x, y, z, duration = 1000) {
		return new Promise((resolve) => {
			const startRotation = {
				x: this.asset_container.rotation.x,
				y: this.asset_container.rotation.y,
				z: this.asset_container.rotation.z
			};
			
			const targetRotation = {
				x: THREE.MathUtils.degToRad(x),
				y: THREE.MathUtils.degToRad(y),
				z: THREE.MathUtils.degToRad(z)
			};
			
			const startTime = Date.now();
			
			const animate = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / duration, 1);
				
				const eased = 1 - Math.pow(1 - progress, 3);
				
				this.asset_container.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
				this.asset_container.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
				this.asset_container.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * eased;
				
				if (progress < 1) {
					requestAnimationFrame(animate);
				} else {
					resolve();
				}
			};
			
			animate();
		});
	}

	startMouseRotation(clientX, clientY) {
		this.is_mouse_rotating = true;
		this.last_mouse_x = clientX;
		this.last_mouse_y = clientY;
	}

	updateMouseRotation(clientX, clientY) {
		if (!this.is_mouse_rotating) return;
		
		const deltaX = clientX - this.last_mouse_x;
		const deltaY = clientY - this.last_mouse_y;
		
		this.asset_container.rotation.y += deltaX * this.rotation_sensitivity;
		this.asset_container.rotation.x -= deltaY * this.rotation_sensitivity;
		
		this.last_mouse_x = clientX;
		this.last_mouse_y = clientY;
	}

	stopMouseRotation() {
		this.is_mouse_rotating = false;
	}

	isMouseRotating() {
		return this.is_mouse_rotating;
	}

	setRotationSensitivity(sensitivity) {
		this.rotation_sensitivity = sensitivity;
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

	update(grabbed_object, viewable_container) {
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
	}

	contains_object(incoming_name) {
		return AssetStorage.get_instance().contains_object(incoming_name);
	}

	getDraggedObjectByName(objectName) {
		let foundObject = null;
		this.asset_container.traverse((child) => {
			if (child.name === objectName) {
				foundObject = child;
			}
		});
		return foundObject;
	}

	// Get all grabbable objects in the container
	getGrabbableObjects() {
		const grabbableObjects = [];
		const grabbableTypes = [
			'NOTEBOOK',
			'BOOK', 
			'TABLET',
			'KEYBOARD',
			'PLANT',
			'MOUSEPAD',
			'MOUSE',
			'DESKPHOTO',
			'COMPUTER',
			'CHAIR'
		];
		
		this.asset_container.traverse((child) => {
			if (child.name && child.name.includes('interactable_')) {
				const assetType = child.name.replace('interactable_', '').split('_')[0];
				if (grabbableTypes.includes(assetType)) {
					grabbableObjects.push(child);
				}
			}
		});
		
		return grabbableObjects;
	}

	// Enhanced method to get object bounds for precise manipulation
	getObjectBounds(objectName) {
		const object = this.getDraggedObjectByName(objectName);
		if (!object) return null;
		
		const box = new THREE.Box3().setFromObject(object);
		const size = new THREE.Vector3();
		const center = new THREE.Vector3();
		
		box.getSize(size);
		box.getCenter(center);
		
		return {
			box: box,
			size: size,
			center: center,
			min: box.min.clone(),
			max: box.max.clone()
		};
	}

	// Method to validate object movement bounds (optional constraint system)
	isValidObjectPosition(objectName, newPosition) {
		// Basic bounds checking - you can enhance this with more sophisticated constraints
		const bounds = this.getObjectBounds(objectName);
		if (!bounds) return true;
		
		// Example: Keep objects within reasonable bounds of the desk/room
		const maxDistance = 20; // Adjust based on your scene scale
		const origin = new THREE.Vector3(0, FLOOR_HEIGHT, 0);
		const distance = newPosition.distanceTo(origin);
		
		return distance <= maxDistance;
	}

	// Method to snap objects to surface/desk when released
	snapObjectToSurface(objectName) {
		const object = this.getDraggedObjectByName(objectName);
		if (!object) return false;
		
		// Simple desk snapping - adjust Y position to desk height for appropriate objects
		const assetType = objectName.replace('interactable_', '').split('_')[0];
		const deskObjects = ['NOTEBOOK', 'BOOK', 'TABLET', 'KEYBOARD', 'MOUSEPAD', 'MOUSE', 'DESKPHOTO'];
		
		if (deskObjects.includes(assetType)) {
			object.position.y = DESK_HEIGHT;
			console.log(`Snapped ${objectName} to desk surface`);
			return true;
		}
		
		return false;
	}

	// Enhanced update method to handle dragged objects
	update(grabbed_object, viewable_container, dragged_object = null) {
		// Update dynamic bodies as before
		this.dynamic_bodies.forEach(entry => {
			const mesh = Array.isArray(entry) ? entry[0] : entry.mesh;
			const body = Array.isArray(entry) ? entry[1] : entry.body;
			if(body != null) {
				// Skip physics update for dragged object to prevent conflicts
				if (dragged_object && mesh === dragged_object) {
					return;
				}
				
				const position = body.translation();
				mesh.position.set(position.x, position.y, position.z);
				const rotation = body.rotation();
				mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
			}
		});
	}

	// Method to temporarily disable physics for dragged objects
	disablePhysicsForObject(objectName) {
		const object = this.getDraggedObjectByName(objectName);
		if (object && object.userData.physicsBody) {
			// Store original physics state
			if (!object.userData.originalPhysicsState) {
				object.userData.originalPhysicsState = {
					bodyType: object.userData.physicsBody.bodyType(),
					isEnabled: object.userData.physicsBody.isEnabled()
				};
			}
			
			// Make kinematic during dragging to prevent physics interference
			object.userData.physicsBody.setBodyType(2); // Kinematic
			console.log(`Disabled physics for dragged object: ${objectName}`);
			return true;
		}
		return false;
	}

	// Method to re-enable physics for released objects
	enablePhysicsForObject(objectName) {
		const object = this.getDraggedObjectByName(objectName);
		if (object && object.userData.physicsBody && object.userData.originalPhysicsState) {
			// Restore original physics state
			object.userData.physicsBody.setBodyType(object.userData.originalPhysicsState.bodyType);
			
			// Sync final position/rotation to physics body
			const pos = object.position;
			const rot = object.quaternion;
			object.userData.physicsBody.setTranslation({ x: pos.x, y: pos.y, z: pos.z });
			object.userData.physicsBody.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
			
			// Clear stored state
			delete object.userData.originalPhysicsState;
			
			console.log(`Re-enabled physics for released object: ${objectName}`);
			return true;
		}
		return false;
	}

	// Method to check if an object is currently being manipulated
	isObjectBeingManipulated(objectName) {
		const object = this.getDraggedObjectByName(objectName);
		return object && object.userData.originalPhysicsState !== undefined;
	}
}