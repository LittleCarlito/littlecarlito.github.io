import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Easing, Tween } from 'tween';
import { icon_colors, icon_labels } from '../overlay/label_column';

const PLACEHOLDER = "placeholder_"

export class PrimaryContainer {
    dynamic_bodies = [];
    activated_name = "";

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
            const cube_body = this.world
            .createRigidBody(RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(((i * 2) - 3), -2, -5).setCanSleep(false));
            const cube_shape = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(1.1);
            this.world.createCollider(cube_shape, cube_body);
            this.dynamic_bodies.push([cube_mesh, cube_body]);
        }
    }

    /** Force activates the object associated with the incoming name without a tween */
    activate_object(incoming_name) {
        if(this.activated_name != incoming_name) {
            this.decativate_object(this.activated_name);
        }
        this.activated_name = incoming_name;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = icon_labels.indexOf(label_name);
        if(incoming_index <= this.dynamic_bodies.length - 1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            const emission_material = new THREE.MeshStandardMaterial({ 
                color: icon_colors[incoming_index],
                emissive: icon_colors[incoming_index],
                emissiveIntensity: 9
            });
            activating_object.material.dispose();
            activating_object.material = emission_material;
        }
    }

    decativate_object(incoming_name) {
        let standard_tween;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = icon_labels.indexOf(label_name);
        if(incoming_index <= this.dynamic_bodies.length - 1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            if(activating_object.material.emissiveIntensity > 1) {
                // console.log(`Deactivating ${incoming_name}`);
                // Tween emissive intesity
                standard_tween = new Tween(activating_object.material)
                .to({ emissiveIntensity: 0})
                .easing(Easing.Sinusoidal.Out)
                .start();
            } else {
                // console.log(`Given cube name \"${incoming_name}\" is already deactivated`);
            }
        } else {
            console.log(`Given cube name \"${incoming_name}\" could not be found in dynamic bodies`);
        }
    }

    decativate_all_objects() {
        icon_labels.forEach(label => {
            this.decativate_object(PLACEHOLDER + label);
        });
    }
}