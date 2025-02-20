import { CATEGORIES } from '../viewport/overlay/overlay_common';
import { TYPES, THREE, Easing, Tween, AssetManager, ASSET_TYPE, FLAGS } from '../common';

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
        // Create all cubes asynchronously but wait for all to complete
        const asset_manager = AssetManager.get_instance();
        const cube_promises = Object.values(CATEGORIES).map(async (category, i) => {
            if (typeof category === 'function') return; // Skip helper methods
            const position = new THREE.Vector3(((i * 2) - 3), -2, -5);
            const [mesh, body] = await asset_manager.spawn_asset(
                ASSET_TYPE.CUBE,
                this.object_container,
                this.world,
                { color: category.color },
                position
            );
            mesh.name = `${TYPES.INTERACTABLE}${category.value}`;
            this.dynamic_bodies.push([mesh, body]);
        });
        // Wait for all cubes to be created
        Promise.all(cube_promises).then(() => {
            if (FLAGS.PHYSICS_LOGS) console.log('All cubes initialized');
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