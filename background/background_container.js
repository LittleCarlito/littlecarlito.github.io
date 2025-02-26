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
    asset_manifest = new Set();
    loading_complete = false;
    loading_promise;
    is_spawning_secondary = false;  // Add state tracking for spawn in progress

    constructor(incoming_parent, incoming_camera, incoming_world) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.object_container = new THREE.Object3D();
        this.parent.add(this.object_container);
        const asset_loader = AssetManager.get_instance();

        // Create a promise for the main assets
        const mainAssetsPromise = (async () => {
            let [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.DESKPHOTO, this.object_container, this.world, {},new THREE.Vector3(-5, 5, 5));
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESKPHOTO}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk photo with name: ${mesh.name}`);

            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.TABLET, this.object_container, this.world, {}, new THREE.Vector3(-10, 5, 5));
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.TABLET}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Tablet with name: ${mesh.name}`);

            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.DIPLOMA, this.object_container, this.world, {}, new THREE.Vector3(-10, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DIPLOMA}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma with name: ${mesh.name}`);

            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.DESK, this.object_container, this.world, {}, new THREE.Vector3(-5, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESK}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk with name: ${mesh.name}`);

            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.CHAIR, this.object_container, this.world, {}, new THREE.Vector3(-0, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.CHAIR}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Chair with name: ${mesh.name}`);

            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.ROOM, this.object_container, this.world, {}, new THREE.Vector3(25, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.ROOM}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Room with name: ${mesh.name}`);

            [mesh, body] = await asset_loader.spawn_asset(ASSET_TYPE.BOOK, this.object_container, this.world, {}, new THREE.Vector3(10, 5, 0));
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.BOOK}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Book with name: ${mesh.name}`);
        })();

        // Create all cubes asynchronously
        const cube_promises = Object.values(CATEGORIES)
            .filter(category => typeof category !== 'function' && category !== CATEGORIES.EDUCATION)
            .map(async (category, i) => {
                const position = new THREE.Vector3(((i * 2) - 3), -2, -5);
                const [mesh, body] = await asset_loader.spawn_asset(
                    ASSET_TYPE.CUBE,
                    this.object_container,
                    this.world,
                    { color: category.color },
                    position
                );
                mesh.name = `${TYPES.INTERACTABLE}${category.value}`;
                this.asset_manifest.add(mesh.name);
                if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating cube with name: ${mesh.name}`);
                return mesh;
            });

        // Store the loading promise for external checking
        this.loading_promise = Promise.all([mainAssetsPromise, ...cube_promises]).then(() => {
            if (FLAGS.PHYSICS_LOGS) console.log('All assets initialized');
            this.loading_complete = true;
        }).catch(error => {
            console.error('Error loading assets:', error);
            throw error;
        });
    }

    // Add method to check if all assets are loaded
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
    get_asset_manifest() {
        return this.asset_manifest;
    }

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
        try {
            // Create and await the ControlMenu initialization
            this.primary_instruction_sign = await new ControlMenu(
                this.object_container, 
                this.camera, 
                this.world, 
                this
            );

            const asset_loader = AssetManager.get_instance();
            
            // Now we know the sign is fully initialized
            if (this.primary_instruction_sign.sign_mesh && this.primary_instruction_sign.sign_body) {
                this.primary_instruction_sign.sign_mesh.name = `${TYPES.INTERACTABLE}primary`;
                this.primary_instruction_sign.sign_mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.name = `${TYPES.INTERACTABLE}primary`;
                    }
                });
                asset_loader.add_object(
                    this.primary_instruction_sign.sign_mesh, 
                    this.primary_instruction_sign.sign_body
                );
                if (FLAGS.PHYSICS_LOGS) {
                    console.log("Primary sign added to asset manager:", {
                        meshName: this.primary_instruction_sign.sign_mesh.name,
                        hasBody: !!this.primary_instruction_sign.sign_body,
                        bodyType: this.primary_instruction_sign.sign_body.bodyType()
                    });
                }
            }
        } catch (err) {
            console.error("Error spawning primary instructions:", err);
            this.primary_instruction_sign = null;
        }
    }

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
        } catch (err) {
            console.error("Error spawning secondary instructions:", err);
            this.secondary_instruction_sign = null;
        }
    }

    async break_primary_chains() {
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