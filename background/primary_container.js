import { CATEGORIES } from '../viewport/overlay/overlay_common';
import { TYPES, THREE, Easing, Tween, RAPIER } from '../common';

export class PrimaryContainer {
    parent;
    camera;
    world;
    object_container;
    dynamic_bodies = [];
    activated_name = "";

    constructor(incoming_parent, incoming_camera, incoming_world) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.object_container = new THREE.Object3D();
        this.parent.add(this.object_container);
        let id = 0;
        // Cubes
        Object.values(CATEGORIES).forEach((category, i) => {
            if (typeof category === 'function') return; // Skip helper methods
            let cube_material = new THREE.MeshStandardMaterial({color: category.color});
            const cube_geometry = new THREE.BoxGeometry(1, 1, 1);
            const cube_mesh = new THREE.Mesh(cube_geometry, cube_material);
            cube_mesh.castShadow = true;
            cube_mesh.name = `${TYPES.INTERACTABLE}${category.value}`;
            this.object_container.add(cube_mesh);
            const cube_body = this.world
            .createRigidBody(RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(((i * 2) - 3), -2, -5).setCanSleep(false));
            const cube_shape = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(1.1);
            this.world.createCollider(cube_shape, cube_body);
            this.dynamic_bodies.push([cube_mesh, cube_body]);
            id++;
        });
    }

    /** Force activates the object associated with the incoming name without a tween */
    activate_object(incoming_name) {
        if(this.activated_name != incoming_name) {
            this.decativate_object(this.activated_name);
        }
        this.activated_name = incoming_name;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = Object.values(CATEGORIES).findIndex(cat => 
            typeof cat !== 'function' && cat.value === label_name
        );
        console.log(`Primary dynamic body length ${this.dynamic_bodies.length}`);
        if(incoming_index <= this.dynamic_bodies.length - 1 && incoming_index != -1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            const category = Object.values(CATEGORIES)[incoming_index];
            const emission_material = new THREE.MeshStandardMaterial({ 
                color: category.color,
                emissive: category.color,
                emissiveIntensity: 9
            });
            activating_object.material.dispose();
            activating_object.material = emission_material;
        }
    }

    decativate_object(incoming_name) {
        let standard_tween;
        const label_name = incoming_name.split("_")[1];
        const incoming_index = Object.values(CATEGORIES).findIndex(cat => 
            typeof cat !== 'function' && cat.value === label_name
        );
        if(incoming_index <= this.dynamic_bodies.length - 1) {
            const [activating_object] = this.dynamic_bodies.at(incoming_index);
            if(activating_object.material?.emissiveIntensity > 1) {
                standard_tween = new Tween(activating_object.material)
                .to({ emissiveIntensity: 0})
                .easing(Easing.Sinusoidal.Out)
                .start();
            }
        } else {
            console.log(`Given cube name \"${incoming_name}\" could not be found in dynamic bodies`);
        }
    }

    decativate_all_objects() {
        CATEGORIES.getValues().forEach(value => 
            this.decativate_object(TYPES.ANY + value));
    }

    contains_object(incoming_name) {
        this.getNodeChildren().forEach(child => {
            if(child.name == incoming_name) return true;
        })
    }

    update() {
        this.dynamic_bodies.forEach(([mesh, body]) => {
            if(body != null) {
                const position = body.translation();
                mesh.position.set(position.x, position.y, position.z);
                const rotation = body.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
    }
}