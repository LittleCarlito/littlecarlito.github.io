import { FLAGS, THREE, AssetSpawner, ASSET_TYPE } from "../common";
import { ControlMenu } from "./menus/control_menu";
import { ScrollMenu } from "./menus/scroll_menu";
import { CATEGORIES, TYPES } from "../viewport/overlay/overlay_common";
import { AssetStorage } from '../common/asset_management/asset_storage';

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
        const asset_loader = AssetSpawner.get_instance();

        // Create a promise for the main assets
        const mainAssetsPromise = (async () => {
            // Spawn Book
            let [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.BOOK, 
                this.object_container, 
                this.world, {}, 
                new THREE.Vector3(-15, 5, -5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.BOOK}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Book with name: ${mesh.name}`);
            // Spawn cat
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.CAT,
                this.object_container,
                this.world, {},
                new THREE.Vector3(-10, 5, -5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.CAT}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Cat with name: ${mesh.name}`);
            // Spawn Chair
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.CHAIR,
                this.object_container,
                this.world, {},
                new THREE.Vector3(-5, 5, -5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.CHAIR}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Chair with name: ${mesh.name}`);
            // Spawn computer
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.COMPUTER,
                this.object_container,
                this.world, {},
                new THREE.Vector3(0, 5, -5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.COMPUTER}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Computer with name: ${mesh.name}`);
            // Spawn Desk
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.DESK,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(5, 5, -5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESK}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk with name: ${mesh.name}`);
            // Spawn Desk photo
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.DESKPHOTO,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(10, 5, -5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DESKPHOTO}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Desk photo with name: ${mesh.name}`);
            // Spawn Diploma bot
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.DIPLOMA_BOT,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(15, 5, -5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DIPLOMA_BOT}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma Bot with name: ${mesh.name}`);
            // Spawn Diploma top
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.DIPLOMA_TOP,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(-15, 5, 0)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.DIPLOMA_TOP}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Diploma Top with name: ${mesh.name}`);
            // Spawn Keyboard
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.KEYBOARD,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(-10, 5, 0)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.KEYBOARD}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Keyboard with name: ${mesh.name}`);
            // Spawn Monitor
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.MONITOR,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(-5, 5, 0)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MONITOR}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Monitor with name: ${mesh.name}`);
            // Spawn Mouse
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.MOUSE,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(0, 5, 0)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MOUSE}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Mouse with name: ${mesh.name}`);
            // Spawn Mousepad
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.MOUSEPAD,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(5, 5, 0)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.MOUSEPAD}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Mousepad with name: ${mesh.name}`);
            // Spawn Notebook closed
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.NOTEBOOK_CLOSED,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(10, 5, 0)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.NOTEBOOK_CLOSED}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Notebook closed with name: ${mesh.name}`);
            // Spawn Notebook opened
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.NOTEBOOK_OPENED,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(15, 5, 0)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.NOTEBOOK_OPENED}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Notebook opened with name: ${mesh.name}`);
            // TODO Spawn Plant
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.PLANT,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(-15, 5, 5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.PLANT}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Plant with name: ${mesh.name}`);
            // Spawn Room
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.ROOM,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(-10, 0, 5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.ROOM}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Room with name: ${mesh.name}`);
            // Spawn Tablet
            [mesh, body] = await asset_loader.spawn_asset(
                ASSET_TYPE.TABLET,
                this.object_container,
                this.world,
                {},
                new THREE.Vector3(-15, 5, 5)
            );
            mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.TABLET}`;
            this.asset_manifest.add(mesh.name);
            if (FLAGS.ASSET_LOGS) console.log(`${this.name} Creating Tablet with name: ${mesh.name}`);
        })();

        // Create all cubes asynchronously
        const validCategories = Object.entries(CATEGORIES)
            .filter(([key, value]) => {
                // Only include actual category entries (not helper methods)
                return key === key.toUpperCase() && // All category keys are uppercase
                // TODO Get these to use category constants
                       key !== 'EDUCATION' && // Skip education category
                       key !== 'CONTACT' && // Skip contact category
                       key !== 'ABOUT' && // Skip about category
                       typeof value === 'object' && // Must be an object
                       value !== null && // Must not be null
                       'color' in value && // Must have a color property
                       'value' in value; // Must have a value property
            })
            .map(([_, category]) => category);

        if (FLAGS.ASSET_LOGS) {
            console.log('Valid categories for cube creation:', validCategories);
        }

        // Ensure we have valid categories before proceeding
        if (!validCategories || validCategories.length === 0) {
            console.error('No valid categories found for cube creation');
            this.loading_complete = true;
            this.loading_promise = Promise.resolve();
            return;
        }

        const cube_promises = validCategories.map(async (category, i) => {
            try {
                if (!category || typeof category !== 'object') {
                    console.error('Invalid category object:', category);
                    return null;
                }

                if (FLAGS.ASSET_LOGS) {
                    console.log(`Creating cube for category:`, category);
                }

                // Create position vector
                const position = new THREE.Vector3(((i * 2) - 3), -2, -5);

                // Wait a small amount between spawns to avoid lock conflicts
                await new Promise(resolve => setTimeout(resolve, i * 100));

                // Create cube with proper color
                const result = await asset_loader.spawn_asset(
                    ASSET_TYPE.CUBE,
                    this.object_container,
                    this.world,
                    { 
                        color: category.color,
                        category: category.value,
                        scale: 1,
                        mass: 1,
                        restitution: 1.1
                    },
                    position
                );

                if (!result) {
                    console.error(`Spawn failed for category ${category.value}`);
                    return null;
                }

                const [mesh, body] = result;

                if (!mesh || !body) {
                    console.error(`Failed to create mesh or body for category ${category.value}. Mesh:`, mesh, 'Body:', body);
                    return null;
                }

                // Add to parent
                this.object_container.add(mesh);

                // Add to manifest and register with asset manager
                this.asset_manifest.add(mesh.name);
                AssetStorage.get_instance().add_object(mesh, body);
                
                if (FLAGS.ASSET_LOGS) {
                    console.log(`${this.name} Created cube with name: ${mesh.name}`);
                }
                
                return mesh;
            } catch (error) {
                console.error(`Error creating cube for category ${category?.value}:`, error);
                console.error('Error stack:', error.stack);
                return null;
            }
        });

        // Store the loading promise for external checking
        this.loading_promise = Promise.all([
            mainAssetsPromise.catch(error => {
                console.error('Error in mainAssetsPromise:', error);
                return null;
            }),
            ...cube_promises.map(p => p.catch(error => {
                console.error('Error in cube promise:', error);
                return null;
            }))
        ]).then(results => {
            if (FLAGS.PHYSICS_LOGS) {
                console.log('All assets initialized:', results);
            }
            this.loading_complete = true;
        }).catch(error => {
            console.error('Error in Promise.all:', error);
            this.loading_complete = true;
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

    contains_object(incoming_name) {
        return AssetStorage.get_instance().contains_object(incoming_name);
    }

    async spawn_primary_instructions() {
        // Check if already spawning or spawned
        if (this.is_spawning_primary || this.is_primary_spawned()) {
            if(FLAGS.PHYSICS_LOGS) console.log(`${this.name} Primary instructions already spawning or spawned`);
            return;
        }

        try {
            this.is_spawning_primary = true;  // Set spawn lock
            if(FLAGS.PHYSICS_LOGS) console.log(`${this.name} Starting primary instructions spawn`);

            // Create and await the ControlMenu initialization
            this.primary_instruction_sign = await new ControlMenu(
                this.object_container, 
                this.camera, 
                this.world, 
                this
            );

            const asset_loader = AssetSpawner.get_instance();
            
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

            const asset_loader = AssetSpawner.get_instance();
            
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