import * as THREE from 'three';
import { TYPES, get_ndc_from_event } from '../viewport/overlay/common';

const DEFAULT_Z_DEPTH = 15;
const Z_SPEED = 0.5;

export class MouseBall {
    parent;
    camera;
    RAPIER;
    world;
    enabled = false;
    ball_z_depth;
    mouse_pos = new THREE.Vector2();
    mouse_rigid;
    mouse_mesh;
    stuck_objects = new Set();
    raycaster = new THREE.Raycaster();
    event_queue;
    is_mouse_down = false;
    is_right_mouse_down = false;

    constructor(incoming_parent, incoming_world, RAPIER, incoming_camera) {
        this.parent = incoming_parent;
        this.world = incoming_world;
        this.RAPIER = RAPIER;
        this.camera = incoming_camera;
        this.ball_z_depth = DEFAULT_Z_DEPTH;
        
        // Create mouse ball mesh
        const mouse_size = 0.25;
        const geometry = new THREE.IcosahedronGeometry(mouse_size, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
        });
        const mouse_light = new THREE.PointLight(0xffffff, 1);
        this.mouse_mesh = new THREE.Mesh(geometry, material);
        this.mouse_mesh.name = `${TYPES.BALL}${TYPES.UNIQUE}`;
        this.mouse_mesh.add(mouse_light);
        // Set layers
        this.mouse_mesh.layers.set(2);
        mouse_light.layers.set(2);
        // Add mesh to scene
        this.parent.add(this.mouse_mesh);
        // Create physics body
        let body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        this.mouse_rigid = this.world.createRigidBody(body_desc);
        let dynamic_collider = RAPIER.ColliderDesc.ball(mouse_size * 3.0)
            .setCollisionGroups(0x00000000)
            .setSensor(true);
        this.world.createCollider(dynamic_collider, this.mouse_rigid)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        this.event_queue = new RAPIER.EventQueue(true);
        // TODO Set these to functions
        // Modify mouse event listeners
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left mouse button
                this.is_mouse_down = true;
                if (this.mouse_rigid) {
                    const collider = this.mouse_rigid.collider(0);
                    collider.setCollisionGroups(0x00020002); // Enable collisions for detection
                    collider.setSensor(true); // Keep sensor mode for grabbing
                }
            } else if (e.button === 2) { // Right mouse button
                this.is_right_mouse_down = true;
                if (this.mouse_rigid) {
                    const collider = this.mouse_rigid.collider(0);
                    collider.setCollisionGroups(0x00020002); // Enable collisions
                    collider.setSensor(false); // Disable sensor mode for physical interactions
                }
            }
        });
        
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Left mouse button
                this.is_mouse_down = false;
                this.release_stuck_objects();
                if (this.mouse_rigid) {
                    const collider = this.mouse_rigid.collider(0);
                    collider.setCollisionGroups(0x00000000);
                    collider.setSensor(true);
                }
            } else if (e.button === 2) { // Right mouse button
                this.is_right_mouse_down = false;
                if (this.mouse_rigid) {
                    const collider = this.mouse_rigid.collider(0);
                    collider.setCollisionGroups(0x00000000); // Return to starting state
                    collider.setSensor(true); // Return to sensor mode
                }
            }
        });
        // Prevent context menu from appearing on right click
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handle_movement(e) {
        const ndc = get_ndc_from_event(e);
        // Convert NDC to world coordinates using camera properties
        const fov = this.camera.fov * Math.PI / 180;
        const aspect = this.camera.aspect;
        const z = -this.ball_z_depth;
        // Calculate the tangent of half the FOV
        const tan_fov = Math.tan(fov / 2);
        // Calculate world space coordinates
        this.mouse_pos.x = ndc.x * Math.abs(z) * tan_fov * aspect;
        this.mouse_pos.y = ndc.y * Math.abs(z) * tan_fov;
        // Position in camera's local space
        this.mouse_mesh.position.set(
            this.mouse_pos.x,
            this.mouse_pos.y,
            z
        );
    }

    update() {
        // Get world position for physics
        const world_position = new THREE.Vector3();
        this.mouse_mesh.getWorldPosition(world_position);
        // Update physics body position
        this.mouse_rigid.setTranslation(world_position);
        // Handle collision events
        this.world.step(this.event_queue);
        this.event_queue.drainCollisionEvents((handle1, handle2, started) => {
            if (!this.enabled || !started || !this.is_mouse_down) return;
            const collider1 = this.world.getCollider(handle1);
            const collider2 = this.world.getCollider(handle2);
            const mouse_ball_collider = this.mouse_rigid.collider(0);
            if (collider1 === mouse_ball_collider || collider2 === mouse_ball_collider) {
                const other_collider = collider1 === mouse_ball_collider ? collider2 : collider1;
                const other_body = other_collider.parent();
                if (other_body && !this.stuck_objects.has(other_body)) {
                    this.stuck_objects.add(other_body);
                    other_body.setBodyType(this.RAPIER.RigidBodyType.KinematicPositionBased);
                }
            }
        });
        // Update positions of stuck objects
        if (this.is_mouse_down) {
            for (const stuck_body of this.stuck_objects) {
                stuck_body.setTranslation(world_position);
            }
        }
    }

    /** Increases Z by the constant Z_SPEED amount */
    increase_z() {
        if(this.enabled) {
            this.set_z_depth(this.ball_z_depth - Z_SPEED);
        }
    }

    /** Decreases Z by the constant Z_SPEED amount */
    decrease_z() {
        if(this.enabled) {
            this.set_z_depth(this.ball_z_depth + Z_SPEED);
        }
    }

    set_z_depth(incoming_z) {
        if(!isNaN(incoming_z)) {
            this.ball_z_depth = incoming_z;
        }
    }

    release_stuck_objects() {
        for (const stuck_body of this.stuck_objects) {
            stuck_body.setBodyType(this.RAPIER.RigidBodyType.Dynamic);
        }
        this.stuck_objects.clear();
    }

    // Modify toggle_physics to handle stuck objects
    toggle_physics(enabled) {
        if (this.mouse_rigid) {
            const collider = this.mouse_rigid.collider(0);
            if (enabled) {
                collider.setCollisionGroups(0x00020002); // Enable collisions
            } else {
                this.release_stuck_objects();
                this.is_mouse_down = false;
                collider.setCollisionGroups(0x00000000); // Disable all collisions
            }
        }
    }
}