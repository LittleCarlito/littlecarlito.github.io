import { THREE, FLAGS, RAPIER } from '../common';
import { AssetHandler, AssetStorage, CustomTypeManager }  from '@littlecarlito/blorkpack';
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";

const FLOOR_HEIGHT = -10;
const DESK_HEIGHT = FLOOR_HEIGHT/2;
const DIPLOMA_X = -7.2;
const DIPLOMA_Z = -.5;

export class BackgroundContainer {
	name = "[BackgroundContainer]"
	parent;
	camera;
	world;
	object_container;
	primary_instruction_sign = null;
	secondary_instruction_sign = null;
	dynamic_bodies = [];
	asset_manifest = new Set();
	loading_complete = false;
	loading_promise;
	is_spawning_secondary = false;  // Add state tracking for spawn in progress
	is_spawning_primary = false;

	constructor(incoming_parent, incoming_camera, incoming_world) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.world = incoming_world;
		this.object_container = new THREE.Object3D();
		this.parent.add(this.object_container);
		const asset_loader = AssetHandler.get_instance(this.object_container, this.world);
		// Ensure custom types are loaded and then initialize assets
		this.loading_promise = (async () => {
			try {
				// Check if custom types are loaded
				if (!CustomTypeManager.hasLoadedCustomTypes()) {
					if (FLAGS.ASSET_LOGS) console.warn(`${this.name} Custom types not loaded yet. Waiting for them to load...`);
					// Wait for a moment to give time for custom types to load
					await new Promise(resolve => setTimeout(resolve, 500));
					// Check again after waiting
					if (!CustomTypeManager.hasLoadedCustomTypes()) {
						console.error(`${this.name} Custom types still not loaded after waiting.`);
						console.error(`${this.name} Make sure CustomTypeManager.loadCustomTypes() is called before creating BackgroundContainer.`);
					}
				}
				const ASSET_TYPE = CustomTypeManager.getTypes();
				// Check if ASSET_TYPE is empty
				if (Object.keys(ASSET_TYPE).length === 0) {
					console.error(`${this.name} No custom asset types found. Assets will not spawn correctly.`);
					this.loading_complete = true;
					return; // Don't proceed with asset loading if no types are available
				}
				if (FLAGS.ASSET_LOGS) console.log(`${this.name} Loaded custom types:`, Object.keys(ASSET_TYPE));
				// Spawn Room
				const roomPosition = new THREE.Vector3(0, FLOOR_HEIGHT, 0);
				try {
					const roomResult = await asset_loader.spawn_asset(
						ASSET_TYPE.ROOM,
						roomPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }  // Makes it static
					);
					if (!roomResult) {
						console.error(`${this.name} Failed to spawn ROOM, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = roomResult.mesh;
					let body = roomResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.ROOM}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Room with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning ROOM:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Desk
				const deskPosition = new THREE.Vector3(-.75, FLOOR_HEIGHT, -.75);
				try {
					const deskResult = await asset_loader.spawn_asset(
						ASSET_TYPE.DESK,
						deskPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!deskResult) {
						console.error(`${this.name} Failed to spawn DESK, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = deskResult.mesh;
					let body = deskResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESK}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning DESK:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Chair
				const chairPosition = new THREE.Vector3(-1, FLOOR_HEIGHT, -1.5);
				try {
					const chairResult = await asset_loader.spawn_asset(
						ASSET_TYPE.CHAIR,
						chairPosition,
						new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + Math.PI / 4),
						{ enablePhysics: false }
					);
					if (!chairResult) {
						console.error(`${this.name} Failed to spawn CHAIR, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = chairResult.mesh;
					let body = chairResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.CHAIR}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Chair with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning CHAIR:`, error);
					this.loading_complete = true;
					throw error;
				}
				// Spawn Cat
				const catPosition = new THREE.Vector3(5.5, FLOOR_HEIGHT, -6);
				try {
					const catResult = await asset_loader.spawn_asset(
						ASSET_TYPE.CAT,
						catPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!catResult) {
						console.error(`${this.name} Failed to spawn CAT, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = catResult.mesh;
					let body = catResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.CAT}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Cat with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning CAT:`, error);
					this.loading_complete = true;
					throw error;
				}
				// Spawn Plant
				const plantPosition = new THREE.Vector3(-6, FLOOR_HEIGHT, 6);
				try {
					const plantResult = await asset_loader.spawn_asset(
						ASSET_TYPE.PLANT,
						plantPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!plantResult) {
						console.error(`${this.name} Failed to spawn PLANT, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = plantResult.mesh;
					let body = plantResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.PLANT}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Plant with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning PLANT:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Computer
				const computerPosition = new THREE.Vector3(-4, FLOOR_HEIGHT, 2.5);
				try {
					const computerResult = await asset_loader.spawn_asset(
						ASSET_TYPE.COMPUTER,
						computerPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!computerResult) {
						console.error(`${this.name} Failed to spawn COMPUTER, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = computerResult.mesh;
					let body = computerResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.COMPUTER}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Computer with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning COMPUTER:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Monitor
				const monitorPosition = new THREE.Vector3(-4.5, DESK_HEIGHT, -5);
				try {
					const monitorResult = await asset_loader.spawn_asset(
						ASSET_TYPE.MONITOR,
						monitorPosition,
						new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
						{ enablePhysics: false }
					);
					if (!monitorResult) {
						console.error(`${this.name} Failed to spawn MONITOR, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = monitorResult.mesh;
					let body = monitorResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MONITOR}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Monitor with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning MONITOR:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Keyboard
				const keyboardPosition = new THREE.Vector3(-4, DESK_HEIGHT, -3);
				try {
					const keyboardResult = await asset_loader.spawn_asset(
						ASSET_TYPE.KEYBOARD,
						keyboardPosition,
						new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 8),
						{ enablePhysics: false }
					);
					if (!keyboardResult) {
						console.error(`${this.name} Failed to spawn KEYBOARD, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = keyboardResult.mesh;
					let body = keyboardResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.KEYBOARD}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Keyboard with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning KEYBOARD:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Mousepad
				const mousepadPosition = new THREE.Vector3(-2, DESK_HEIGHT, -5);
				try {
					const mousepadResult = await asset_loader.spawn_asset(
						ASSET_TYPE.MOUSEPAD,
						mousepadPosition,
						new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 8),
						{ enablePhysics: false }
					);
					if (!mousepadResult) {
						console.error(`${this.name} Failed to spawn MOUSEPAD, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = mousepadResult.mesh;
					let body = mousepadResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MOUSEPAD}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Mousepad with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning MOUSEPAD:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Mouse
				const mousePosition = new THREE.Vector3(-2, DESK_HEIGHT, -5);
				try {
					const mouseResult = await asset_loader.spawn_asset(
						ASSET_TYPE.MOUSE,
						mousePosition,
						new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2 + Math.PI / 4),
						{ enablePhysics: false }
					);
					if (!mouseResult) {
						console.error(`${this.name} Failed to spawn MOUSE, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = mouseResult.mesh;
					let body = mouseResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MOUSE}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Mouse with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning MOUSE:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Desk photo
				const deskPhotoPosition = new THREE.Vector3(0, DESK_HEIGHT, -7);
				try {
					const deskPhotoResult = await asset_loader.spawn_asset(
						ASSET_TYPE.DESKPHOTO,
						deskPhotoPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!deskPhotoResult) {
						console.error(`${this.name} Failed to spawn DESKPHOTO, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = deskPhotoResult.mesh;
					let body = deskPhotoResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESKPHOTO}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk photo with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning DESKPHOTO:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Tablet
				const tabletPosition = new THREE.Vector3(2, DESK_HEIGHT, -5);
				try {
					const tabletResult = await asset_loader.spawn_asset(
						ASSET_TYPE.TABLET,
						tabletPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!tabletResult) {
						console.error(`${this.name} Failed to spawn TABLET, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = tabletResult.mesh;
					let body = tabletResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.TABLET}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Tablet with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning TABLET:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Notebook closed
				const notebookClosedPosition = new THREE.Vector3(-6, DESK_HEIGHT, 2.5);
				try {
					const notebookClosedResult = await asset_loader.spawn_asset(
						ASSET_TYPE.NOTEBOOK_CLOSED,
						notebookClosedPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!notebookClosedResult) {
						console.error(`${this.name} Failed to spawn NOTEBOOK_CLOSED, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = notebookClosedResult.mesh;
					let body = notebookClosedResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.NOTEBOOK_CLOSED}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Notebook closed with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning NOTEBOOK_CLOSED:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Book
				const bookPosition = new THREE.Vector3(-6, DESK_HEIGHT + .25, 2.5);
				try {
					const result = await asset_loader.spawn_asset(
						ASSET_TYPE.BOOK,
						bookPosition,
						new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
						{ enablePhysics: false }
					);
					if (!result) {
						console.error(`${this.name} Failed to spawn BOOK, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = result.mesh;
					let body = result.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.BOOK}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Book with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning BOOK:`, error);
					this.loading_complete = true;
					throw error;
				}
				// Spawn Notebook opened
				const notebookOpenedPosition = new THREE.Vector3(-5, DESK_HEIGHT, 0);
				try {
					const notebookOpenedResult = await asset_loader.spawn_asset(
						ASSET_TYPE.NOTEBOOK_OPENED,
						notebookOpenedPosition,
						new THREE.Quaternion(),
						{ enablePhysics: false }
					);
					if (!notebookOpenedResult) {
						console.error(`${this.name} Failed to spawn NOTEBOOK_OPENED, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = notebookOpenedResult.mesh;
					let body = notebookOpenedResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.NOTEBOOK_OPENED}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Notebook opened with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning NOTEBOOK_OPENED:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Diploma top
				const diplomaTopPosition = new THREE.Vector3(DIPLOMA_X, 1.5, DIPLOMA_Z);
				try {
					const diplomaTopResult = await asset_loader.spawn_asset(
						ASSET_TYPE.DIPLOMA_TOP,
						diplomaTopPosition,
						new THREE.Quaternion()
    						.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    						.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)),
						{ enablePhysics: false }
					);
					if (!diplomaTopResult) {
						console.error(`${this.name} Failed to spawn DIPLOMA_TOP, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = diplomaTopResult.mesh;
					let body = diplomaTopResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DIPLOMA_TOP}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma Top with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning DIPLOMA_TOP:`, error);
					this.loading_complete = true;
					return;
				}
				// Spawn Diploma bot
				const diplomaBotPosition = new THREE.Vector3(DIPLOMA_X, -1.5, DIPLOMA_Z);
				try {
					const diplomaBotResult = await asset_loader.spawn_asset(
						ASSET_TYPE.DIPLOMA_BOT,
						diplomaBotPosition,
						new THREE.Quaternion()
							.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    						.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)),
						{ enablePhysics: false }
					);
					if (!diplomaBotResult) {
						console.error(`${this.name} Failed to spawn DIPLOMA_BOT, result is null`);
						this.loading_complete = true;
						return;
					}
					let mesh = diplomaBotResult.mesh;
					let body = diplomaBotResult.body;
					mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DIPLOMA_BOT}`;
					this.asset_manifest.add(mesh.name);
					if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma Bot with name: ${mesh.name}`);
				} catch (error) {
					console.error(`${this.name} Error spawning DIPLOMA_BOT:`, error);
					this.loading_complete = true;
					return;
				}
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
	// Add method to check if all assets are loaded
	/**
	 *
	 */
	async is_loading_complete() {
		try {
			await this.loading_promise;
			return true;
		} catch (error) {
			console.error('Error checking loading status:', error);
			return false;
		}
	}
	// Add method to get the asset manifest
	/**
	 *
	 */
	get_asset_manifest() {
		return this.asset_manifest;
	}
	/**
	 *
	 */
	update(grabbed_object, viewable_container) {
		this.dynamic_bodies.forEach(entry => {
			// Handle both array format [mesh, body] and object format {mesh, body}
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
	/**
	 *
	 */
	contains_object(incoming_name) {
		return AssetStorage.get_instance().contains_object(incoming_name);
	}
}