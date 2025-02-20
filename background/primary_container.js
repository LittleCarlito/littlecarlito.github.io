import { CATEGORIES } from '../viewport/overlay/overlay_common';
import { TYPES, THREE, Easing, Tween, AssetManager, ASSET_TYPE, FLAGS } from '../common';

export class PrimaryContainer {
    parent;
    camera;
    world;
    object_container;

    // TODO OOOOO
    // TODO Move all this to FillContainer
    // TODO Rename FillContainer to BackgroundContainer

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
            if (FLAGS.ASSET_LOGS) console.log(`[PrimaryContainer] Creating cube with name: ${TYPES.INTERACTABLE}${category.value}`);
            mesh.name = `${TYPES.INTERACTABLE}${category.value}`;
        });
        // Wait for all cubes to be created
        Promise.all(cube_promises).then(() => {
            if (FLAGS.PHYSICS_LOGS) console.log('All cubes initialized');
        });
    }
}