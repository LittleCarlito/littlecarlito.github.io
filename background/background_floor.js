import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class BackgroundFloor {

    constructor(incoming_world, incoming_parent, incoming_camera) {
        this.world = incoming_world;
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        const floor_geometry = new THREE.BoxGeometry(100, 1, 100);
        const floor_material = new THREE.MeshStandardMaterial({ color: 0x808080 });
        this.floor_mesh = new THREE.Mesh(floor_geometry, floor_material);
        this.floor_mesh.receiveShadow = true;
        this.floor_mesh.position.y = -10.2;
        this.parent.add(this.floor_mesh);
        const floor_body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, this.floor_mesh.position.y, 0));
        const floor_shape = RAPIER.ColliderDesc.cuboid(50, 0.5, 50);
        this.world.createCollider(floor_shape, floor_body);
    }
}