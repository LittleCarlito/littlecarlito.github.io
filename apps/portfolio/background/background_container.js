import { THREE, FLAGS, RAPIER } from '../common';
import { AssetHandler, AssetStorage, CustomTypeManager }  from '@littlecarlito/blorkpack';
import { ControlMenu } from "./menus/control_menu";
import { ScrollMenu } from "./menus/scroll_menu";
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
						new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + Math.PI / 4),
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
		// Deal with primary instructions
		if(viewable_container.is_primary_triggered() && !this.is_primary_spawned()) {
			this.spawn_primary_instructions().catch(err => {
				console.error("Error spawning primary instructions:", err);
			});
		} else if(!viewable_container.is_overlay_hidden() && this.is_primary_instructions_intact()) {
			this.break_primary_chains().catch(err => {
				console.error("Error breaking primary chains:", err);
			});
			// Deal with secondary instructions - only if not already spawning
		} else if(!this.is_spawning_secondary && !this.is_secondary_spawned() && 
                 (grabbed_object != null || viewable_container.is_secondary_triggered())) {
			this.is_spawning_secondary = true;  // Set flag before starting spawn
			this.break_primary_chains()
				.then(() => this.spawn_secondary_instructions())
				.catch(err => {
					console.error("Error in secondary menu sequence:", err);
				})
				.finally(() => {
					this.is_spawning_secondary = false;  // Clear flag when done
				});
		} else if(this.is_secondary_spawned() && !viewable_container.is_overlay_hidden()) {
			this.break_secondary_chains().catch(err => {
				console.error("Error breaking secondary chains:", err);
			});
		}
		// Handle logic for what already exists
		if(this.primary_instruction_sign) {
			this.primary_instruction_sign.update();
		}
		if(this.secondary_instruction_sign) {
			this.secondary_instruction_sign.update();
		}
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
	/**
	 *
	 */
	async spawn_primary_instructions() {
		// Set state to prevent overlapping calls
		if (this.is_spawning_primary) {
			console.log("Already spawning primary instructions!");
			return;
		}
		this.is_spawning_primary = true;
		const asset_loader = AssetHandler.get_instance(this.object_container, this.world);
		try {
			if(FLAGS.PHYSICS_LOGS) console.log(`${this.name} Starting primary instructions spawn`);
			// Create and await the ControlMenu initialization
			this.primary_instruction_sign = await new ControlMenu(
				this.object_container, 
				this.camera, 
				this.world, 
				this
			);
			// Now we know the sign is fully initialized
			if (this.primary_instruction_sign.sign_mesh && this.primary_instruction_sign.sign_body) {
				this.primary_instruction_sign.sign_mesh.name = `${TYPES.INTERACTABLE}primary`;
				this.primary_instruction_sign.sign_mesh.traverse((child) => {
					if (child.isMesh) {
						child.name = `${TYPES.INTERACTABLE}primary`;
					}
				});
				AssetStorage.get_instance().add_object(
					this.primary_instruction_sign.sign_mesh, 
					this.primary_instruction_sign.sign_body
				);
				if (FLAGS.PHYSICS_LOGS) {
					console.log(`${this.name} Primary sign added to asset manager:`, {
						meshName: this.primary_instruction_sign.sign_mesh.name,
						hasBody: !!this.primary_instruction_sign.sign_body,
						bodyType: this.primary_instruction_sign.sign_body.bodyType()
					});
				}
			}
		} catch (err) {
			console.error(`${this.name} Error spawning primary instructions:`, err);
			this.primary_instruction_sign = null;
		} finally {
			this.is_spawning_primary = false;  // Always release the spawn lock
			if(FLAGS.PHYSICS_LOGS) console.log(`${this.name} Primary instructions spawn complete`);
		}
	}
	/**
	 *
	 */
	async spawn_secondary_instructions() {
		try {
			if(FLAGS.PHYSICS_LOGS) {
				console.log('Spawning Scroll Menu:');
				console.log(`Camera Position: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
			}
			// Calculate spawn position in front of camera
			const forward = new THREE.Vector3(0, 0, -5);  // 5 units in front
			forward.applyQuaternion(this.camera.quaternion);
			const spawn_position = {
				x: this.camera.position.x + forward.x,
				y: this.camera.position.y + forward.y + 4, // Additional Y offset
				z: this.camera.position.z + forward.z
			};
			// Create and await the ScrollMenu initialization
			this.secondary_instruction_sign = await new ScrollMenu(
				this.object_container, 
				this.camera, 
				this.world, 
				this,
				spawn_position
			);
			const asset_loader = AssetHandler.get_instance();
			// Now we know the sign_mesh and sign_body exist
			this.secondary_instruction_sign.sign_mesh.name = `${TYPES.INTERACTABLE}secondary`;
			this.secondary_instruction_sign.sign_mesh.traverse((child) => {
				if (child.isMesh) {
					child.name = `${TYPES.INTERACTABLE}secondary`;
				}
			});
			AssetStorage.get_instance().add_object(
				this.secondary_instruction_sign.sign_mesh, 
				this.secondary_instruction_sign.sign_body
			);
			if (FLAGS.PHYSICS_LOGS) {
				console.log("Secondary sign added to asset manager:", {
					meshName: this.secondary_instruction_sign.sign_mesh.name,
					hasBody: !!this.secondary_instruction_sign.sign_body,
					bodyType: this.secondary_instruction_sign.sign_body.bodyType()
				});
			}
		} catch (err) {
			console.error("Error spawning secondary instructions:", err);
			this.secondary_instruction_sign = null;
		}
	}
	/**
	 *
	 */
	async break_primary_chains() {
		const asset_loader = AssetHandler.get_instance(this.object_container, this.world);
		if(this.is_primary_spawned()) {
			if(!this.primary_instruction_sign.chains_broken) {
				await this.primary_instruction_sign.break_chains();
			} else {
				console.log("Primary instruction chains are already broken");
			}
		} else {
			console.warn("Primary instruction chains cannot be broken as it has not spawned...");
		}
	}
	/**
	 *
	 */
	async break_secondary_chains() {
		if(this.is_secondary_spawned()) {
			if(!this.secondary_instruction_sign.chains_broken) {
				await this.secondary_instruction_sign.break_chains();
			}
		} else {
			console.warn("Secondary instruction chains cannot be broken as it has not spawned...");
		}
	}
	// ----- Getters
	/**
	 *
	 */
	is_primary_spawned() {
		return this.primary_instruction_sign != null;
	}
	/**
	 *
	 */
	is_primary_chains_broken() {
		if(!this.is_primary_spawned()) {
			console.warn("Primary instruction chains don't exist yet to be broken; Returning false");
			return false;
		} else {
			return this.primary_instruction_sign.chains_broken;
		}
	}
	/**
	 *
	 */
	is_primary_instructions_intact() {
		if(this.is_primary_spawned()) {
			return !this.is_primary_chains_broken();
		}
		return false;
	}
	/**
	 *
	 */
	is_secondary_spawned() {
		return this.secondary_instruction_sign != null;
	}
	/**
	 *
	 */
	is_secondary_chains_broken() {
		if(!this.is_secondary_spawned) {
			console.warn("Secondary instruction chains don't exist yet to be broken; Returning false");
			return false;
		}
		return this.secondary_instruction_sign.chains_broken;
	}
	/**
	 *
	 */
	is_secondary_instructions_intact() {
		if(this.is_secondary_spawned) {
			return !this.is_secondary_chains_broken();
		}
		return false;
	}
	/**
     * Updates the debug visualization for all signs based on the current flag state
     */
	updateSignDebugVisualizations() {
		// Update primary instruction sign if it exists
		if (this.primary_instruction_sign) {
			this.primary_instruction_sign.updateDebugVisualizations();
		}
		// Update secondary instruction sign if it exists
		if (this.secondary_instruction_sign) {
			this.secondary_instruction_sign.updateDebugVisualizations();
		}
	}
}