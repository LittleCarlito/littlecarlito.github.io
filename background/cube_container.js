import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { icon_colors, icon_labels } from '../overlay/label_column';

export class CubeConatiner {
    dynamic_bodies = [];

    constructor(incoming_world, incoming_scene, incoming_camera) {
        this.scene = incoming_scene;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.cube_container = new THREE.Object3D();
        this.scene.add(this.cube_container);
        // Cubes
        for(let i = 0; i < icon_labels.length; i++) {
            let cube_material;
            cube_material = new THREE.MeshStandardMaterial({color: icon_colors[i]});
            const cube_geometry = new THREE.BoxGeometry(1, 1, 1);
            const cube_mesh = new THREE.Mesh(cube_geometry, cube_material);
            cube_mesh.castShadow = true;
            this.cube_container.add(cube_mesh);
            const cube_body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(((i * 2) - 3), -2, -5).setCanSleep(false));
            const cube_shape = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(1.1);
            this.world.createCollider(cube_shape, cube_body);
            this.dynamic_bodies.push([cube_mesh, cube_body]);
        }
    }
}