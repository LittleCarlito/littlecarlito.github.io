import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Easing, Tween } from 'tween';
import { icon_colors, icon_labels } from '../overlay/label_column';
import { getNodeChildren } from 'three/src/nodes/core/NodeUtils.js';

const EMISSION_COLOR = 0x3851e5;
const PLACEHOLDER = "placeholder_"

export class PrimaryContainer {
    dynamic_bodies = [];
    tween_map = new Map();
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

    // TODO I think the issue is there are 2 equal tweens existing
    //          One making brighter and one darkening
    //          It just chooses one when highlighting quickly like that
    // TODO Create logic to manage the tweens
    //          Ensure deactivating gets rid of the activating tween and keeps the object dark
    activate_object(incoming_name) {
        if(incoming_name != this.activated_name) {
            this.activated_name = incoming_name;
            this.decativate_all_objects();
            const label_name = incoming_name.split("_")[1];
            const incoming_index = icon_labels.indexOf(label_name);
            if(incoming_index <= this.dynamic_bodies.length - 1) {
                const [activating_object] = this.dynamic_bodies.at(incoming_index);
                if(activating_object.material.emissiveIntensity <= 1 && !this.tween_map.has(incoming_name)) {
                    // Set emissive material on activated object
                    const emission_material = new THREE.MeshStandardMaterial({ 
                        color: icon_colors[incoming_index],
                        emissive: icon_colors[incoming_index],
                        emissiveIntensity: 0
                    });
                    activating_object.material.dispose();
                    activating_object.material = emission_material;
                    // Tween emissive intesity
                    const emit_tween = new Tween(activating_object.material)
                    .to({ emissiveIntensity: 9})
                    .easing(Easing.Sinusoidal.Out)
                    .start()
                    .onComplete(() => {
                        this.tween_map.delete(incoming_name)
                    });
                    this.tween_map.set(incoming_name, emit_tween);
                } else {
                    // console.log(`Given cube name \"${incoming_name}\" is already activated`)
                }
            } else {
                console.log(`Given cube name \"${incoming_name}\" could not be found in dynamic bodies`);
            }
        }
    }

    /** Force activates the object associated with the incoming name without a tween */
    force_activate(incoming_name) {
        if(this.activated_name != incoming_name) {
            this.decativate_object(this.activated_name);
        }
        this.activated_name = incoming_name;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = icon_labels.indexOf(label_name);
        if(incoming_index <= this.dynamic_bodies.length - 1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            activating_object.material.emissiveIntensity = 9;
        }
    }

    decativate_object(incoming_name) {
        let standard_tween;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = icon_labels.indexOf(label_name);
        if(incoming_index <= this.dynamic_bodies.length - 1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            if(this.tween_map.has(incoming_name)) {
                this.tween_map.delete(incoming_name);
                // Tween emissive intesity
                standard_tween = new Tween(activating_object.material)
                .to({ emissiveIntensity: 0})
                .easing(Easing.Sinusoidal.Out)
                .start()
                .onComplete(() => {
                    this.tween_map.delete(incoming_name);
                });
                this.tween_map.set(incoming_name, standard_tween);
            }
            if(activating_object.material.emissiveIntensity > 1) {
                // console.log(`Deactivating ${incoming_name}`);
                // Tween emissive intesity
                standard_tween = new Tween(activating_object.material)
                .to({ emissiveIntensity: 0})
                .easing(Easing.Sinusoidal.Out)
                .start()
                .onComplete(() => {
                    this.tween_map.delete(incoming_name);
                });
                this.tween_map.set(incoming_name, standard_tween);
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