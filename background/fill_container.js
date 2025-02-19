import { FLAGS, NAMES, RAPIER, THREE, TYPES } from "../common";
import { AssetManager } from "./background_common";
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
        mass: 5,
        restitution: .1,
        position: new THREE.Vector3(5, 10, -5)
    }
    DIPLOMA = {
        scale: 10,
        mass: 1,
        restitution: .2,
        position: new THREE.Vector3(-5, 8, -3)
    }
    DESK = {
        scale: 2,
        mass: 1,
        restitution: .5,
        position: new THREE.Vector3(0, 0, -8)
    }

    constructor(incoming_parent, incoming_camera, incoming_world) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.object_container = new THREE.Object3D();
        this.parent.add(this.object_container);
        const asset_loader = AssetManager.get_instance();
        this.loader = asset_loader.loader;
        // Axe with physics
        this.loader.load("assets/Axe.glb", (loaded_axe) => {
            let axe_asset = loaded_axe.scene;
            axe_asset.position.copy(this.AXE.position);
            axe_asset.name = `${TYPES.INTERACTABLE}${NAMES.AXE}`;
            axe_asset.scale.set(this.AXE.scale, this.AXE.scale, this.AXE.scale);  
            this.object_container.add(axe_asset);
            // Get geometry for convex hull
            let axe_geometry;
            axe_asset.traverse((child) => {
                if (child.isMesh) {
                    child.name = `${TYPES.INTERACTABLE}${NAMES.AXE}`;
                    axe_geometry = child.geometry;
                }
            });
            const axe_points = axe_geometry.attributes.position.array;
            const axe_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(this.AXE.position.x, this.AXE.position.y, this.AXE.position.z)
                .setCanSleep(false)
            );
            // Create convex hull collider
            const axe_collider = RAPIER.ColliderDesc.convexHull(axe_points)
                .setMass(this.AXE.mass)
                .setRestitution(this.AXE.restitution);
            this.world.createCollider(axe_collider, axe_body);
            // Add axe to dynamic bodies
            this.dynamic_bodies.push([axe_asset, axe_body]);
        });
        // Diploma with physics
        this.loader.load("assets/diploma.glb", (loaded_diploma) => {
            let diploma_asset = loaded_diploma.scene;
            diploma_asset.position.copy(this.DIPLOMA.position);
            diploma_asset.name = `${TYPES.INTERACTABLE}${NAMES.DIPLOMA}`;
            diploma_asset.scale.set(this.DIPLOMA.scale, this.DIPLOMA.scale, this.DIPLOMA.scale);
            this.object_container.add(diploma_asset);
            // Get geometry for convex hull
            let diploma_geometry;
            diploma_asset.traverse((child) => {
                if (child.isMesh) {
                    child.name = `${TYPES.INTERACTABLE}${NAMES.DIPLOMA}`;
                    diploma_geometry = child.geometry;
                }
            });
            // Calculate bounding box dimensions
            diploma_geometry.computeBoundingBox();
            const bounding_box = diploma_geometry.boundingBox;
            const dimensions = new THREE.Vector3();
            bounding_box.getSize(dimensions);
            // Scale dimensions according to the model scale and divide by 2 for half-extents
            const half_width = (dimensions.x * this.DIPLOMA.scale) / 2;
            const half_height = (dimensions.y * this.DIPLOMA.scale) / 2;
            const half_depth = (dimensions.z * this.DIPLOMA.scale) / 2;

            const diploma_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(this.DIPLOMA.position.x, this.DIPLOMA.position.y, this.DIPLOMA.position.z)
                .setCanSleep(false)
            );
            // Create cuboid collider with half-extents
            const diploma_collider = RAPIER.ColliderDesc.cuboid(half_width, half_height, half_depth)
                .setMass(this.DIPLOMA.mass)
                .setRestitution(this.DIPLOMA.restitution);
            this.world.createCollider(diploma_collider, diploma_body);
            // Add DIPLOMA to dynamic bodies
            this.dynamic_bodies.push([diploma_asset, diploma_body]);
        });
        // Desk with physics
        this.loader.load("assets/desk.glb", (loaded_desk) => {
            let desk_asset = loaded_desk.scene;
            desk_asset.position.copy(this.DESK.position);
            desk_asset.name = `${TYPES.INTERACTABLE}${NAMES.DESK}`;
            desk_asset.scale.set(this.DESK.scale, this.DESK.scale, this.DESK.scale);
            this.object_container.add(desk_asset);
            // Get geometry for convex hull
            let desk_geometry;
            desk_asset.traverse((child) => {
                if (child.isMesh) {
                    child.name = `${TYPES.INTERACTABLE}${NAMES.DESK}`;
                    desk_geometry = child.geometry;
                }
            });
            
            // Calculate bounding box dimensions
            desk_geometry.computeBoundingBox();
            const boundingBox = desk_geometry.boundingBox;
            const dimensions = new THREE.Vector3();
            boundingBox.getSize(dimensions);
            // Scale dimensions according to the model scale and divide by 2 for half-extents
            const halfWidth = (dimensions.x * this.DESK.scale) / 2;
            const halfHeight = (dimensions.y * this.DESK.scale) / 2;
            const halfDepth = (dimensions.z * this.DESK.scale) / 2;

            const desk_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(this.DESK.position.x, this.DESK.position.y, this.DESK.position.z)
                .setCanSleep(false)
            );
            // Create cuboid collider with half-extents
            const desk_collider = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth)
                .setMass(this.DESK.mass)
                .setRestitution(this.DESK.restitution);
            this.world.createCollider(desk_collider, desk_body);
            // Add DESK to dynamic bodies
            this.dynamic_bodies.push([desk_asset, desk_body]);
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
        if(FLAGS.PHYSICS_LOGS) {
            console.log('Spawning Scroll Menu:');
            console.log(`Camera Position: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
        }
        
        // Calculate spawn position in front of camera
        const forward = new THREE.Vector3(0, 0, -5);  // 5 units in front
        forward.applyQuaternion(this.camera.quaternion);
        const spawnPosition = {
            x: this.camera.position.x + forward.x,
            y: this.camera.position.y + forward.y + 4, // Additional Y offset
            z: this.camera.position.z + forward.z
        };
        
        this.secondary_instruction_sign = new ScrollMenu(
            this.object_container, 
            this.camera, 
            this.world, 
            this,
            spawnPosition
        );
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