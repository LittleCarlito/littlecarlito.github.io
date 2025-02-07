import * as THREE from 'three';
import { TYPES } from '../viewport/overlay/common';

const DEFAULT_Z_DEPTH = -15;
const Z_SPEED = .2;

export class MouseBall {
    enabled = false;
    mouse_pos;
    mouse_pos = new THREE.Vector2();
    ball_z_depth;
    raycaster = new THREE.Raycaster();
    stuck_objects = new Set();
    eventQueue;
    isMouseDown = false;

    constructor(incoming_parent, incoming_world, RAPIER) {
        this.parent = incoming_parent;
        this.world = incoming_world;
        this.RAPIER = RAPIER; // Store RAPIER reference
        this.ball_z_depth = DEFAULT_Z_DEPTH;
        const mouse_size = 0.25;
        const geometry = new THREE.IcosahedronGeometry(mouse_size, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
        });
        const mouse_light = new THREE.PointLight(0xffffff, 1);
        this.mouse_mesh = new THREE.Mesh(geometry, material);
        this.mouse_mesh.name = `${TYPES.BALL}${TYPES.UNIQUE}`
        this.mouse_mesh.add(mouse_light);
        // Set mouse mesh and light to layer 2
        this.mouse_mesh.layers.set(2);
        mouse_light.layers.set(2);
        // Rigid body
        let body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0)
        this.mouse_rigid = this.world.createRigidBody(body_desc);
        let dynamic_collider = RAPIER.ColliderDesc.ball(mouse_size * 3.0)
            .setCollisionGroups(0x00000000) // Start with collisions disabled
            .setSensor(true);  // Make it a sensor collider to detect but not physically interact
        this.world.createCollider(dynamic_collider, this.mouse_rigid)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
            
        // Set up event queue for collision detection
        this.eventQueue = new RAPIER.EventQueue(true);
        
        this.update();
        this.parent.add(this.mouse_mesh);

        // Add mouse event listeners
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left mouse button
                this.isMouseDown = true;
            }
        });
        
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Left mouse button
                this.isMouseDown = false;
                // Release all stuck objects when mouse is released
                this.releaseStuckObjects();
            }
        });
    }

    handle_movement(e, incoming_camera) {
        // Use positive normal (0,0,1) and positive distance for consistent plane orientation
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        // Calculate normal device coordinates
        const mouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        // Send raycaster from camera
        this.raycaster.setFromCamera(mouse, incoming_camera);
        // Get intersections of raycaster
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, intersection);
        // Convert intersection point to local coordinates relative to camera
        incoming_camera.worldToLocal(intersection);
        // Set mouse position to intersections, scaled by z ratio
        const z_ratio = this.ball_z_depth / DEFAULT_Z_DEPTH;
        this.mouse_pos.x = intersection.x * z_ratio;
        this.mouse_pos.y = intersection.y * z_ratio;
    }

    update() {
        // Convert local position to world position for physics
        const worldPosition = new THREE.Vector3(this.mouse_pos.x, this.mouse_pos.y, this.ball_z_depth);
        this.parent.localToWorld(worldPosition);
        
        // Update physics body with world position
        this.mouse_rigid.setTranslation({ 
            x: worldPosition.x, 
            y: worldPosition.y, 
            z: worldPosition.z
        });
        
        // Convert world position back to local space for visual mesh
        const localPosition = worldPosition.clone();
        this.parent.worldToLocal(localPosition);
        this.mouse_mesh.position.set(localPosition.x, localPosition.y, localPosition.z);

        // Handle collision events
        this.world.step(this.eventQueue);
        
        this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            if (!this.enabled || !started || !this.isMouseDown) return;
            
            const collider1 = this.world.getCollider(handle1);
            const collider2 = this.world.getCollider(handle2);
            
            const mouseBallCollider = this.mouse_rigid.collider(0);
            if (collider1 === mouseBallCollider || collider2 === mouseBallCollider) {
                const otherCollider = collider1 === mouseBallCollider ? collider2 : collider1;
                const otherBody = otherCollider.parent();
                
                if (otherBody && !this.stuck_objects.has(otherBody)) {
                    this.stuck_objects.add(otherBody);
                    otherBody.setBodyType(this.RAPIER.RigidBodyType.KinematicPositionBased);
                }
            }
        });

        // Update positions of stuck objects so that they snap directly to the mouse
        if (this.isMouseDown) {
            for (const stuckBody of this.stuck_objects) {
                stuckBody.setTranslation({ 
                    x: worldPosition.x, 
                    y: worldPosition.y, 
                    z: worldPosition.z
                });
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

    releaseStuckObjects() {
        for (const stuckBody of this.stuck_objects) {
            stuckBody.setBodyType(this.RAPIER.RigidBodyType.Dynamic);
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
                this.releaseStuckObjects();
                this.isMouseDown = false;
                collider.setCollisionGroups(0x00000000); // Disable all collisions
            }
        }
    }
}