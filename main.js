import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Easing, Tween, update as updateTween } from 'tween';
import { WEST } from "./overlay/screen"
import { TitleBlock } from './overlay/title_block';
import { HIDE, HideButton } from './overlay/hide_button';
import { LINK, LinkContainer } from './overlay/link_container';
import { LABEL, LabelColumn } from './overlay/label_column';
import { TextContainer } from './overlay/text_container';
// import { OrbitControls } from 'three/examples/jsm/Addons.js';



// TODO OOOOO
// TODO Add rapier physics

// ----- Variables
const FOCUS_ROTATION = .7;
let resize_move = false;
let zoom_event = false;
let current_intersected = null;
let in_tween_map = new Map();
let last_pixel_ratio = window.devicePixelRatio;

// ----- Setup
// Physics
await RAPIER.init();
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
const world = new RAPIER.World(gravity);
const dynamic_bodies = [];
const clock = new THREE.Clock();
// Mouse detection
const raycaster = new THREE.Raycaster();
const mouse_location = new THREE.Vector2();
// Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    // FOV
    75,
    // Aspect ratio
    window.innerWidth/window.innerHeight,
    // Near clipping
    0.1,
    // Far clipping
    1000
);
camera.position.z = 15;
// Rendering
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
// Controls
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;
// controls.target.y = 1;
// Lighting
const spotlight_one = new THREE.SpotLight(undefined, Math.PI * 10);
spotlight_one.position.set(2.5, 5, 5);
spotlight_one.angle = Math.PI / 3;
spotlight_one.penumbra = 0.5;
spotlight_one.castShadow = true;
spotlight_one.shadow.blurSamples = 10;
spotlight_one.shadow.radius = 5;
scene.add(spotlight_one);
const spotlight_two = spotlight_one.clone();
spotlight_two.position.set(-2.5, 5, 5);
scene.add(spotlight_two);
// Overlay creation
const title_block = new TitleBlock(scene, camera);
const text_box_container = new TextContainer(scene, camera);
const label_column = new LabelColumn(scene, camera);
const link_container = new LinkContainer(scene, camera);
const hide_button = new HideButton(scene, camera);

// -----Physics objects
// Cube
const cube_material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const cube_geometry = new THREE.BoxGeometry(1, 1, 1);
const cube_mesh = new THREE.Mesh(cube_geometry, cube_material);
cube_mesh.castShadow = true;
scene.add(cube_mesh);
const cube_body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0).setCanSleep(false));
const cube_shape = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(1.1);
world.createCollider(cube_shape, cube_body);
dynamic_bodies.push([cube_mesh, cube_body]);
// Floor
const floor_geometry = new THREE.BoxGeometry(100, 1, 100);
const floor_material = new THREE.MeshStandardMaterial({ color: 0x808080 });
const floor_mesh = new THREE.Mesh(floor_geometry, floor_material);
floor_mesh.receiveShadow = true;
floor_mesh.position.y = -10.2;
scene.add(floor_mesh);
const floor_body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, floor_mesh.position.y, 0));
const floor_shape = RAPIER.ColliderDesc.cuboid(50, 0.5, 50);
world.createCollider(floor_shape, floor_body);

// ----- Functions
/** Hides/reveals overlay elements and swaps hide buttons display sprite */
function trigger_overlay() {
    hide_button.swap_hide_status();
    console.log(`is overlay hidden \"${hide_button.is_overlay_hidden}\"`);
    // Hide the overlay
    title_block.trigger_overlay(hide_button.is_overlay_hidden);
    label_column.trigger_overlay(hide_button.is_overlay_hidden);
    link_container.trigger_overlay(hide_button.is_overlay_hidden);
}

/*** Swaps the container column sides */
function swap_column_sides() {
    label_column.swap_sides();
    hide_button.swap_sides(label_column.is_column_left);
}

/** Primary animation function run every frame by renderer */
function animate() {
    // Handle the overlay
    updateTween();
    if(resize_move) {
        if(!zoom_event) {
            // Move/resize overlay
            text_box_container.resize();
            text_box_container.reposition(label_column.is_column_left);
            label_column.reposition();
            link_container.reposition();
            title_block.resize();
            title_block.reposition();
            hide_button.reposition(label_column.is_column_left);
            // Overlay is always redisplayed
            if(hide_button.is_overlay_hidden) {
                hide_button.swap_hide_status();
            }
        } else {
            zoom_event = false;
        }
        resize_move = false;
    }
    // Handle the physics objects
    const delta = clock.getDelta();
    world.timestep = Math.min(delta, 0.1);
    world.step();
    dynamic_bodies.forEach(([mesh, body]) => {
        const position = body.translation();
        mesh.position.set(position.x, position.y, position.z);
        const rotation = body.rotation();
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
    // Scene reload
    // controls.update();
    renderer.render(scene, camera);
}

/** Retrieves objects mouse is intersecting with from the given event */
function get_intersect_list(e) {
    mouse_location.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse_location.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse_location, camera);
    return raycaster.intersectObject(scene, true);
}

/** Handles mouse hovering events and raycasts to collide with scene objects */
function handle_hover(e) {
    const found_intersections = get_intersect_list(e);
    if(found_intersections.length > 0 && !label_column.swapping_column_sides) {
        const intersected_object = found_intersections[0].object;
        const object_name = intersected_object.name;
        const name_type = object_name.split("_")[0] + "_";
        if(name_type == LABEL){
            if(current_intersected !== intersected_object) {
                // Reset previously inersected object if one existed
                if(current_intersected){
                    let deselected_rotation = 0;
                    new Tween(current_intersected.rotation)
                    .to({ y: deselected_rotation})
                    .easing(Easing.Elastic.Out)
                    .start();
                }
                // Set intersected object to current
                current_intersected = intersected_object;
            }
            // Apply rotation to current
            let final_rotation = label_column.is_column_left ? -(FOCUS_ROTATION) : (FOCUS_ROTATION);
            // Determine if there is an existing in tween for this object
            let in_tween = in_tween_map.get(object_name);
            if(in_tween == null) {
                in_tween = new Tween(current_intersected.rotation)
                .to({ y: final_rotation}, 400)
                .easing(Easing.Sinusoidal.In)
                .start()
                .onComplete(() => in_tween_map.delete(object_name));
                in_tween_map.set(object_name, in_tween);
            }
        }
    } else {
        reset_previous_intersected();
    }
}

/** Resets the previous intersetcted objects orientation */
function reset_previous_intersected() {
    if(current_intersected) {
        let deselected_rotation = 0;
        new Tween(current_intersected.rotation)
        .to({ y: deselected_rotation})
        .easing(Easing.Elastic.Out)
        .start();
        current_intersected = null;
    }
}

// ----- Window handlers
/** Handles resize events */
window.addEventListener('resize', () => {
    // Determine if it was a zoom event
    const current_pixel_ratio = window.devicePixelRatio;
    if(last_pixel_ratio != current_pixel_ratio) {
        last_pixel_ratio = current_pixel_ratio;
        zoom_event = true;
    }
    // Set variables
    resize_move = true;
    // Resize application
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/** Handles mouse down actions */
window.addEventListener('mousedown', (e) => {
    const found_intersections = get_intersect_list(e, "clicked down");
    found_intersections.forEach(i => (console.log(`${i.object.name} clicked down`)));
    // TODO Do something with the intersections
});

/** Handles mouse up actions */
window.addEventListener('mouseup', (e) => {
    const found_intersections = get_intersect_list(e, "clicked up");
    if(label_column.is_column_left){
        if(found_intersections.length > 0){
            const intersected_object = found_intersections[0].object;
            (console.log(`${intersected_object.name} clicked up`));
            const split_intersected_name = intersected_object.name.split("_");
            const name_type = split_intersected_name[0] + "_";
            switch(name_type) {
                case LABEL:
                    reset_previous_intersected();
                    swap_column_sides();
                    text_box_container.focus_text_box(intersected_object.name, label_column.is_column_left);
                    break;
                case HIDE:
                    trigger_overlay();
                    break;
                case LINK:
                    link_container.open_link(split_intersected_name[1].trim());
                    break;
            }
        }
    // Column is right
    } else {
        if(found_intersections.length > 0) {
            const intersected_object = found_intersections[0].object;
            const split_intersected_name = intersected_object.name.split("_");
            const name_type = split_intersected_name[0] + "_";
            switch(name_type) {
                case LABEL:
                    text_box_container.focus_text_box(intersected_object.name, label_column.is_column_left);
                    break;
                case LINK:
                    link_container.open_link(split_intersected_name[1].trim());
                    break;
            }
        } else {
            swap_column_sides();
            text_box_container.lose_focus_text_box(WEST);
        }
    }

});

/** Handles mose movements and location */
window.addEventListener('mousemove', handle_hover);
