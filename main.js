import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { update as updateTween } from 'tween';
import { UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { EffectComposer } from 'three/examples/jsm/Addons.js';
import { RenderPass } from 'three/examples/jsm/Addons.js';
import { OutputPass } from 'three/examples/jsm/Addons.js';
import { WEST } from "./viewport/overlay/screen"
import { HIDE } from './viewport/overlay/hide_button';
import { LINK } from './viewport/overlay/link_container';
import { LABEL } from './viewport/overlay/label_column';
import { PrimaryContainer } from './background/primary_container';
import { BackgroundFloor } from './background/background_floor';
import { ViewableUI } from './viewport/viewable_ui';
import { BackgroundLighting } from './background/background_lighting';

// TODO Add HemisphereLight to way background for sunset/mood lighting
// TODO NEW BRANCH Get custom 3d object loaded in
// TODO Get text box with programmable font loaded over text boxes
//          Should resize with the text box
//          Should be sensitive to zoom events and enlarge text size on them

// ----- Variables
let resize_move = false;
let zoom_event = false;
let last_pixel_ratio = window.devicePixelRatio;

// ----- Setup
const scene = new THREE.Scene();
// Physics
await RAPIER.init();
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
const world = new RAPIER.World(gravity);
const clock = new THREE.Clock();
// Mouse detection
const raycaster = new THREE.Raycaster();
const mouse_location = new THREE.Vector2();
// Rendering
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
// UI creation
const viewable_ui = new ViewableUI(scene);
// Background creation
new BackgroundLighting(scene);
const primary_container = new PrimaryContainer(world, scene, viewable_ui.get_camera());
new BackgroundFloor(world, scene, viewable_ui.get_camera());
// Effects/bloom effects
const render_scene = new RenderPass(scene, viewable_ui.get_camera());
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

// ----- Functions
/** Hides/reveals overlay elements and swaps hide buttons display sprite */
function trigger_overlay() {
    viewable_ui.get_overlay().trigger_overlay();
}

/*** Swaps the container column sides */
function swap_column_sides() {
    viewable_ui.get_overlay().swap_column_sides();
    if( viewable_ui.get_overlay().is_label_column_left_side()){
        primary_container.decativate_all_objects();
    }
}

/** Primary animation function run every frame by renderer */
function animate() {
    // Handle the overlay
    updateTween();
    if(resize_move) {
        if(!zoom_event) {
            viewable_ui.get_overlay().resize_reposition();
        } else {
            zoom_event = false;
        }
        resize_move = false;
    }
    // Handle the physics objects
    if( viewable_ui.get_overlay().is_intersected() != null) {
        primary_container.activate_object( viewable_ui.get_overlay().intersected_name());
    } else if(viewable_ui.is_text_active()) {
        primary_container.activate_object(viewable_ui.get_active_name());
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
    composer.render();
}

/** Retrieves objects mouse is intersecting with from the given event */
function get_intersect_list(e) {
    mouse_location.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse_location.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse_location, viewable_ui.get_camera());
    return raycaster.intersectObject(scene, true);
}

/** Handles mouse hovering events and raycasts to collide with scene objects */
function handle_hover(e) {
    const found_intersections = get_intersect_list(e);
    if(found_intersections.length > 0 && ! viewable_ui.get_overlay().is_swapping_sides()) {
        const intersected_object = found_intersections[0].object;
        const object_name = intersected_object.name;
        const name_type = object_name.split("_")[0] + "_";
        // Handle label hover
        if(name_type == LABEL){
            viewable_ui.get_overlay().handle_hover(intersected_object);
        }
    } else {
        viewable_ui.get_overlay().reset_hover();
    }
}

/** Handles mouse off screen events */
function handle_off_screen(e) {
    console.log(`Mouse is left`)
    if( viewable_ui.get_overlay().is_label_column_left_side()) {
        viewable_ui.get_overlay().reset_hover();
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
    // TODO If refactor works make these internal to viewable ui
    viewable_ui.get_camera().aspect = window.innerWidth / window.innerHeight;
    viewable_ui.get_camera().updateProjectionMatrix();
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
    if( viewable_ui.get_overlay().is_label_column_left_side()){
        if(found_intersections.length > 0){
            const intersected_object = found_intersections[0].object;
            (console.log(`${intersected_object.name} clicked up`));
            const split_intersected_name = intersected_object.name.split("_");
            const name_type = split_intersected_name[0] + "_";
            switch(name_type) {
                case LABEL:
                    viewable_ui.get_overlay().reset_hover();
                    swap_column_sides();
                    viewable_ui.get_overlay().focus_text_box(intersected_object.name);
                    break;
                case HIDE:
                    trigger_overlay();
                    break;
                case LINK:
                    viewable_ui.get_overlay().open_link(split_intersected_name[1].trim());
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
                    viewable_ui.get_overlay().focus_text_box(intersected_object.name);
                    break;
                case LINK:
                    viewable_ui.get_overlay().open_link(split_intersected_name[1].trim());
                    break;
            }
        } else {
            swap_column_sides();
            viewable_ui.get_overlay().lose_focus_text_box(WEST);
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
