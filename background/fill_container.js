import { NAMES, RAPIER, THREE, TYPES } from "../common";
import { GLTF_LOADER } from "./background_common";
import { ControlMenu } from "./menus/control_menu";
import { ScrollMenu } from "./menus/scroll_menu";

export class FillContainer {
    parent;
    camera;
    world;
    object_container;
    primary_instruction_sign = null;
    secondary_instruction_sign = null;
    dynamic_bodies = [];

    AXE = {
        scale: 20,
        mass: 1,
        restitution: 1.1,
        position: new THREE.Vector3(0, 0, 0)
    }

    constructor(incoming_parent, incoming_camera, incoming_world) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.object_container = new THREE.Object3D();
        this.parent.add(this.object_container);
        // Axe with physics
        GLTF_LOADER.load("assets/Axe.glb", (loaded_axe) => {
            let created_asset = loaded_axe.scene;
            created_asset.position.z = this.AXE.position.z;
            // Scale up the axes
            created_asset.name = `${TYPES.INTERACTABLE}${NAMES.AXE}`;
            created_asset.scale.set(this.AXE.scale, this.AXE.scale, this.AXE.scale);  
            this.object_container.add(created_asset);
            // Get geometry for convex hull
            let geometry;
            created_asset.traverse((child) => {
                if (child.isMesh) {
                    child.name = `${TYPES.INTERACTABLE}${NAMES.AXE}`;
                    geometry = child.geometry;
                }
            });
            const points = geometry.attributes.position.array;
            const axe_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(this.AXE.position.x, this.AXE.position.y, this.AXE.position.z)
                .setCanSleep(false)
            );
            // Create convex hull collider
            const collider_desc = RAPIER.ColliderDesc.convexHull(points)
                .setMass(this.AXE.mass)
                .setRestitution(this.AXE.restitution);
            this.world.createCollider(collider_desc, axe_body);
            // Add axe to dynamic bodies
            this.dynamic_bodies.push([created_asset, axe_body]);
        });
    }

    update(grabbed_object, viewable_ui) {
        // Logic triggering spawning
        let trigger_secondary = false;
        if((grabbed_object != null  || viewable_ui.is_secondary_triggered()) && !trigger_secondary) {
            trigger_secondary = true;
        }
        // Deal with primary instructions
        if(viewable_ui.is_primary_triggered() && !this.is_primary_spawned()) {
            this.spawn_primary_instructions();
        } else if(!viewable_ui.is_overlay_hidden() && this.is_primary_instructions_intact()) {
            this.break_primary_chains();
        // Deal with secondary instructions
        } else if(trigger_secondary && !this.is_secondary_spawned()) {
            this.break_primary_chains();
            this.spawn_secondary_instructions();
        } else if(this.is_secondary_spawned() && !viewable_ui.is_overlay_hidden()) {
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

    spawn_primary_instructions() {
        this.primary_instruction_sign = new ControlMenu(this.object_container, this.camera, this.world, this);
    }

    spawn_secondary_instructions() {
        this.secondary_instruction_sign = new ScrollMenu(this.object_container, this.camera, this.world, this);
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