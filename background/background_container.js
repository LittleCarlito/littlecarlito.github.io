import { FLAGS, THREE, AssetManager, ASSET_TYPE, NAMES } from "../common";
import { ControlMenu } from "./menus/control_menu";
import { ScrollMenu } from "./menus/scroll_menu";
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";

export class BackgroundContainer {
    name = "[BackgroundContainer]"
    parent;
    camera;
    world;
    object_container;
    primary_instruction_sign = null;
    secondary_instruction_sign = null;
    dynamic_bodies = [];

    constructor(incoming_parent, incoming_camera, incoming_world) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.object_container = new THREE.Object3D();
        this.parent.add(this.object_container);
        const asset_loader = AssetManager.get_instance();
        // Spawn assets
        (async () => {
            let [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.AXE, this.object_container, this.world);
            mesh.name = `${TYPES.INTERACTABLE}${NAMES.AXE}`;
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Axe with name: ${mesh.name}`);
            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.DIPLOMA, this.object_container, this.world, {}, new THREE.Vector3(-10, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${CATEGORIES.EDUCATION}`;
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma with name: ${mesh.name}`);
            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.DESK, this.object_container, this.world, {}, new THREE.Vector3(-5, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${NAMES.DESK}`;
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk with name: ${mesh.name}`);
            // Spawn a chair
            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.CHAIR, this.object_container, this.world, {}, new THREE.Vector3(-0, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${NAMES.CHAIR}`;
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Chair with name: ${mesh.name}`);
            // Spawn a room
            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.ROOM, this.object_container, this.world, {}, new THREE.Vector3(5, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${NAMES.ROOM}`;
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Room with name: ${mesh.name}`);
            // Spawn a book
            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.BOOK, this.object_container, this.world, {}, new THREE.Vector3(10, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${NAMES.BOOK}`;
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Book with name: ${mesh.name}`);
        })();
        // Create all cubes asynchronously but wait for all to complete
        const asset_manager = AssetManager.get_instance();
        const cube_promises = Object.values(CATEGORIES).map(async (category, i) => {
            if (typeof category === 'function' || category == CATEGORIES.EDUCATION) return; // Skip helper methods
            const position = new THREE.Vector3(((i * 2) - 3), -2, -5);
            const [mesh, body] = await asset_manager.spawn_asset(
                ASSET_TYPE.CUBE,
                this.object_container,
                this.world,
                { color: category.color },
                position
            );
            mesh.name = `${TYPES.INTERACTABLE}${category.value}`;
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating cube with name: ${mesh.name}`);
        });
        // Wait for all cubes to be created
        Promise.all(cube_promises).then(() => {
            if (FLAGS.PHYSICS_LOGS) console.log('All cubes initialized');
        });
    }

    update(grabbed_object, viewable_container) {
        // Logic triggering spawning
        let trigger_secondary = false;
        if((grabbed_object != null  || viewable_container.is_secondary_triggered()) && !trigger_secondary) {
            trigger_secondary = true;
        }
        // Deal with primary instructions
        if(viewable_container.is_primary_triggered() && !this.is_primary_spawned()) {
            this.spawn_primary_instructions().catch(err => {
                console.error("Error spawning primary instructions:", err);
            });
        } else if(!viewable_container.is_overlay_hidden() && this.is_primary_instructions_intact()) {
            this.break_primary_chains();
        // Deal with secondary instructions
        } else if(trigger_secondary && !this.is_secondary_spawned()) {
            this.break_primary_chains();
            this.spawn_secondary_instructions();
        } else if(this.is_secondary_spawned() && !viewable_container.is_overlay_hidden()) {
            this.break_secondary_chains();
        }
        // Handle logic for what already exists
        if(this.primary_instruction_sign) {
            this.primary_instruction_sign.update();
        }
        if(this.secondary_instruction_sign) {
            this.secondary_instruction_sign.update();
        }
        this.dynamic_bodies.forEach(([mesh, body]) => {
            if(body != null) {
                const position = body.translation();
                mesh.position.set(position.x, position.y, position.z);
                const rotation = body.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
    }

    contains_object(incoming_name) {
        this.getNodeChildren().forEach(child => {
            if(child.name == incoming_name) return true;
        })
    }

    async spawn_primary_instructions() {
        // Wrap the menu creation in an async IIFE to prevent blocking
        (async () => {
            this.primary_instruction_sign = new ControlMenu(this.object_container, this.camera, this.world, this);
            
            // Wait for the sign to be fully initialized
            await new Promise(resolve => {
                const checkSignReady = () => {
                    if (this.primary_instruction_sign.sign_mesh && this.primary_instruction_sign.sign_body) {
                        resolve();
                    } else {
                        setTimeout(checkSignReady, 100);
                    }
                };
                checkSignReady();
            });
            const asset_loader = AssetManager.get_instance();
            // Now we know the sign_mesh and sign_body exist
            this.primary_instruction_sign.sign_mesh.name = `${TYPES.INTERACTABLE}primary`;
            this.primary_instruction_sign.sign_mesh.traverse((child) => {
                if (child.isMesh) {
                    child.name = `${TYPES.INTERACTABLE}primary`;
                }
            });
            asset_loader.add_object(this.primary_instruction_sign.sign_mesh, this.primary_instruction_sign.sign_body);
            if (FLAGS.PHYSICS_LOGS) {
                console.log("Primary sign added to asset manager:", {
                    meshName: this.primary_instruction_sign.sign_mesh.name,
                    hasBody: !!this.primary_instruction_sign.sign_body,
                    bodyType: this.primary_instruction_sign.sign_body.bodyType()
                });
            }
        })().catch(err => {
            console.error("Error spawning primary instructions:", err);
        });
    }

    async spawn_secondary_instructions() {
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
        
        // Wrap the menu creation in an async IIFE to prevent blocking
        (async () => {
            this.secondary_instruction_sign = new ScrollMenu(
                this.object_container, 
                this.camera, 
                this.world, 
                this,
                spawn_position
            );

            // Wait for the sign to be fully initialized
            await new Promise(resolve => {
                const checkSignReady = () => {
                    if (this.secondary_instruction_sign.sign_mesh && this.secondary_instruction_sign.sign_body) {
                        resolve();
                    } else {
                        setTimeout(checkSignReady, 100);
                    }
                };
                checkSignReady();
            });

            const asset_loader = AssetManager.get_instance();
            
            // Now we know the sign_mesh and sign_body exist
            this.secondary_instruction_sign.sign_mesh.name = `${TYPES.INTERACTABLE}secondary`;
            this.secondary_instruction_sign.sign_mesh.traverse((child) => {
                if (child.isMesh) {
                    child.name = `${TYPES.INTERACTABLE}secondary`;
                }
            });
            
            asset_loader.add_object(this.secondary_instruction_sign.sign_mesh, this.secondary_instruction_sign.sign_body);
            
            if (FLAGS.PHYSICS_LOGS) {
                console.log("Secondary sign added to asset manager:", {
                    meshName: this.secondary_instruction_sign.sign_mesh.name,
                    hasBody: !!this.secondary_instruction_sign.sign_body,
                    bodyType: this.secondary_instruction_sign.sign_body.bodyType()
                });
            }
        })().catch(err => {
            console.error("Error spawning secondary instructions:", err);
        });
    }

    break_primary_chains() {
        if(this.is_primary_spawned) {
            if(!this.primary_instruction_sign.chains_broken) {
                this.primary_instruction_sign.break_chains();
            } else {
                console.log("Primary instruction chains are already broken");
            }
        } else {
            console.warn("Primary instruction chains cannot be broken as it has not spawned...");
        }
    }

    break_secondary_chains() {
        if(this.is_secondary_spawned) {
            if(!this.secondary_instruction_sign.chains_broken) {
                this.secondary_instruction_sign.break_chains();
            }
        } else {
            console.warn("Secondary instruction chains cannot be broken as it has not spawned...");
        }
    }

    // ----- Getters

    is_primary_spawned() {
        return this.primary_instruction_sign != null;
    }

    is_primary_chains_broken() {
        if(!this.is_primary_spawned()) {
            console.warn("Primary instruction chains don't exist yet to be broken; Returning false");
            return false;
        } else {
            return this.primary_instruction_sign.chains_broken;
        }
    }

    is_primary_instructions_intact() {
        if(this.is_primary_spawned()) {
            return !this.is_primary_chains_broken();
        }
        return false;

    }
    
    is_secondary_spawned() {
        return this.secondary_instruction_sign != null;
    }

    is_secondary_chains_broken() {
        if(!this.is_secondary_spawned) {
            console.warn("Secondary instruction chains don't exist yet to be broken; Returning false");
            return false;
        }
        return this.secondary_instruction_sign.chains_broken;
    }

    is_secondary_instructions_intact() {
        if(this.is_secondary_spawned) {
            return !this.is_secondary_chains_broken();
        }
        return false;
    }
}