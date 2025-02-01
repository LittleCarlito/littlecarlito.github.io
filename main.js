import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { update as updateTween } from 'tween';
import { UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { EffectComposer } from 'three/examples/jsm/Addons.js';
import { RenderPass } from 'three/examples/jsm/Addons.js';
import { OutputPass } from 'three/examples/jsm/Addons.js';
import { WEST } from "./overlay/screen"
import { TitleBlock } from './overlay/title_block';
import { HIDE, HideButton } from './overlay/hide_button';
import { LINK, LinkContainer } from './overlay/link_container';
import { LABEL, LabelColumn } from './overlay/label_column';
import { TextContainer } from './overlay/text_container';
import { PrimaryContainer } from './background/primary_container';
import { BackgroundFloor } from './background/background_floor';
// import { OrbitControls } from 'three/examples/jsm/Addons.js';

// ----- Variables
let resize_move = false;
let zoom_event = false;
let last_pixel_ratio = window.devicePixelRatio;

// ----- Setup
// Physics
await RAPIER.init();
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
const world = new RAPIER.World(gravity);
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

// camera.rotation.x = -0.261799;
camera.position.z = 15;
// Rendering
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
// TODO Need to get overlay attached to camera positioning before controls can be allowed
// Controls
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;
// controls.target.y = 1;
// Lighting
const light_focus = new THREE.Object3D();
light_focus.position.set(0, -9, 0);
scene.add(light_focus);
const spotlight_one = new THREE.SpotLight(undefined, 150);
spotlight_one.position.set(2.5, 5, -5);
spotlight_one.angle = -Math.PI / 2;
spotlight_one.penumbra = 0.5;
spotlight_one.castShadow = true;
spotlight_one.shadow.blurSamples = 10;
spotlight_one.shadow.radius = 5;
scene.add(spotlight_one);
const spotlight_two = spotlight_one.clone();
spotlight_two.position.set(-2.5, 5, -1);
scene.add(spotlight_two);
const direction_light = new THREE.DirectionalLight(0xffffff, 2);
direction_light.position.set(0, -3, -15);
direction_light.target = light_focus;
scene.add(direction_light);
// Effects/bloom effects
const render_scene = new RenderPass(scene, camera);
// const bloom_pass = new BloomPass( 1 );
const bloom_pass = new UnrealBloomPass( 
    new THREE.Vector2(window.innerWidth, window.innerHeight), // Resolution
    1.5, // Strength
    0.4, // Radius
    1 // Threshold
);
const output_pass = new OutputPass();
const composer = new EffectComposer(renderer);
composer.addPass(render_scene);
composer.addPass(bloom_pass);
composer.addPass(output_pass);
// Overlay creation
const title_block = new TitleBlock(scene, camera);
const text_box_container = new TextContainer(scene, camera);
const label_column = new LabelColumn(scene, camera);
const link_container = new LinkContainer(scene, camera);
const hide_button = new HideButton(scene, camera);
// Background creation
const primary_container = new PrimaryContainer(world, scene, camera);
const floor = new BackgroundFloor(world, scene, camera);

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
    if(label_column.is_column_left){
        primary_container.decativate_all_objects();
    }
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
    if(label_column.current_intersected != null) {
        primary_container.activate_object(label_column.current_intersected.name);
    } else {
        primary_container.decativate_all_objects();
    }
    const delta = clock.getDelta();
    world.timestep = Math.min(delta, 0.1);
    world.step();
    primary_container.dynamic_bodies.forEach(([mesh, body]) => {
        const position = body.translation();
        mesh.position.set(position.x, position.y, position.z);
        const rotation = body.rotation();
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
    // Scene reload
    // controls.update();
    composer.render();
}

/** Retrieves objects mouse is intersecting with from the given event */
function get_intersect_list(e) {
    mouse_location.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse_location.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse_location, camera);
    return raycaster.intersectObject(scene, true);
}


// TODO OOOOO
// TODO Get the overlay to be based off camera positioning so tilt and controls can be added and overlay follows
// TODO Make things go to non camera layer when tween off camera completes
//          Layer back in then tween back on screen for opposite transition
// TODO Add HemisphereLight to way background for sunset/mood lighting
// TODO NEW BRANCH Get custom 3d object loaded in

/** Handles mouse hovering events and raycasts to collide with scene objects */
function handle_hover(e) {
    const found_intersections = get_intersect_list(e);
    if(found_intersections.length > 0 && !label_column.swapping_column_sides) {
        const intersected_object = found_intersections[0].object;
        const object_name = intersected_object.name;
        const name_type = object_name.split("_")[0] + "_";
        // Handle label hover
        if(name_type == LABEL){
            label_column.handle_hover(intersected_object);
        }
    } else {
        label_column.reset_previous_intersected();
    }
}

/** Handles mouse off screen events */
function handle_off_screen(e) {
    console.log(`Mouse is left`)
    if(label_column.is_column_left) {
        console.log(`Resetting column`)
        label_column.reset_previous_intersected();
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
    composer.setSize(window.innerWidth, window.innerHeight);
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
                    label_column.reset_previous_intersected();
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

window.addEventListener('mousemove', handle_hover);
/*
The window object isn’t a typical DOM element with a well-defined “bounding box” for mouse events.
In many browsers, these events simply never fire on window because the mouse leaving or entering 
the window isn’t interpreted as a mouseleave or mouseenter on that object.
*/
renderer.domElement.addEventListener('mouseout', handle_off_screen);
