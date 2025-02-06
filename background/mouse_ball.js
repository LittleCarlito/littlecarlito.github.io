import * as THREE from 'three';

const DEFAULT_Z_DEPTH = 0;

export class MouseBall {
    mouse_pos;
    mouse_pos = new THREE.Vector2();
    ball_z_depth;
    raycaster = new THREE.Raycaster();

    constructor(incoming_parent, incoming_world, RAPIER) {
        this.parent = incoming_parent;
        this.world = incoming_world;
        this.ball_z_depth = DEFAULT_Z_DEPTH;
        const mouse_size = 0.25;
        const geometry = new THREE.IcosahedronGeometry(mouse_size, 8);
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
        });
        const mouse_light = new THREE.PointLight(0xffffff, 1);
        this.mouse_mesh = new THREE.Mesh(geometry, material);
        this.mouse_mesh.add(mouse_light);
        // RIGID BODY
        let body_desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0)
        this.mouse_rigid = this.world.createRigidBody(body_desc);
        let dynamic_collider = RAPIER.ColliderDesc.ball(mouse_size * 3.0);
        this.world.createCollider(dynamic_collider, this.mouse_rigid);
        this.update();
        this.parent.add(this.mouse_mesh);
    }

    handle_movement(e, incoming_camera) {
        // Use positive normal (0,0,1) and positive distance for consistent plane orientation
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.ball_z_depth);
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
        // Set mouse position to intersections
        this.mouse_pos.x = intersection.x;
        this.mouse_pos.y = intersection.y;
    }

    update() {
        this.mouse_rigid.setTranslation({ x: this.mouse_pos.x, y: this.mouse_pos.y, z: this.ball_z_depth});
        let { x, y, z } = this.mouse_rigid.translation();
        this.mouse_mesh.position.set(x, y, z);
    }

    set_z_depth(incoming_z) {
        if(!isNaN(incoming_z)) {
            this.ball_z_depth = incoming_z;
        }
    }
}