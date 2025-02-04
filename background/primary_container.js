import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { Easing, Tween } from 'tween';
import { category_colors, category_labels } from '../viewport/overlay/common/primary_categories';

const PLACEHOLDER = "placeholder_"
const AXE_SCALE = 20;
const AXE_MASS = 1;
const AXE_RESTITUTION = 1.1;
const AXE_POSITION = new THREE.Vector3(0, 0, 0);

export class PrimaryContainer {
    gltf_loader;
    dynamic_bodies = [];
    activated_name = "";

    constructor(incoming_world, incoming_parent, incoming_camera) {
        this.gltf_loader = new GLTFLoader();
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.cube_container = new THREE.Object3D();
        this.parent.add(this.cube_container);
        let id = 0;
        // Cubes
        for(let i = 0; i < category_labels.length; i++) {
            let cube_material;
            cube_material = new THREE.MeshStandardMaterial({color: category_colors[i]});
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
            id++;
        }
        // Axe with physics
        this.gltf_loader.load("Axe.glb", (loaded_axe) => {
            let created_asset = loaded_axe.scene;
            created_asset.position.z = AXE_POSITION.z;
            // Scale up the axes
            created_asset.scale.set(AXE_SCALE, AXE_SCALE, AXE_SCALE);  
            this.parent.add(created_asset);
            // Get geometry for convex hull
            let geometry;
            created_asset.traverse((child) => {
                if (child.isMesh) {
                    geometry = child.geometry;
                }
            });
            const points = geometry.attributes.position.array;
            const axe_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(AXE_POSITION.x, AXE_POSITION.y, AXE_POSITION.z)
                .setCanSleep(false)
            );
            // Create convex hull collider
            const collider_desc = RAPIER.ColliderDesc.convexHull(points)
                .setMass(AXE_MASS)
                .setRestitution(AXE_RESTITUTION);
            this.world.createCollider(collider_desc, axe_body);
            // Add axe to dynamic bodies
            this.dynamic_bodies.push([created_asset, axe_body]);
        });
    }

    /** Force activates the object associated with the incoming name without a tween */
    activate_object(incoming_name) {
        if(this.activated_name != incoming_name) {
            this.decativate_object(this.activated_name);
        }
        this.activated_name = incoming_name;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = category_labels.indexOf(label_name);
        if(incoming_index <= this.dynamic_bodies.length - 1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            const emission_material = new THREE.MeshStandardMaterial({ 
                color: category_colors[incoming_index],
                emissive: category_colors[incoming_index],
                emissiveIntensity: 9
            });
            activating_object.material.dispose();
            activating_object.material = emission_material;
        }
    }

    decativate_object(incoming_name) {
        let standard_tween;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = category_labels.indexOf(label_name);
        if(incoming_index <= this.dynamic_bodies.length - 1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            if(activating_object.material?.emissiveIntensity > 1) {
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
        category_labels.forEach(label => {
            this.decativate_object(PLACEHOLDER + label);
        });
    }
}