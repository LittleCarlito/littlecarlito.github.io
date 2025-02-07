import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { update as updateTween } from 'tween';
import { CSS2DRenderer, UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { EffectComposer } from 'three/examples/jsm/Addons.js';
import { RenderPass } from 'three/examples/jsm/Addons.js';
import { OutputPass } from 'three/examples/jsm/Addons.js';
import { PrimaryContainer } from './background/primary_container';
import { BackgroundFloor } from './background/background_floor';
import { ViewableUI } from './viewport/viewable_ui';
import { BackgroundLighting } from './background/background_lighting';
import { WEST, TYPES, TEXTURE_LOADER, extract_type, get_intersect_list } from './viewport/overlay/common';

// ----- Constants
const BACKGROUND_IMAGE = 'gradient.jpg';
// ----- Variables
let resize_move = false;
let zoom_event = false;
let last_pixel_ratio = window.devicePixelRatio;
// ----- Setup
const scene = new THREE.Scene();
scene.background = TEXTURE_LOADER.load(BACKGROUND_IMAGE);
// Physics
await RAPIER.init();
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
const world = new RAPIER.World(gravity);
const clock = new THREE.Clock();
// Rendering
// CSS3D rendering
const css_renderer = new CSS2DRenderer();
css_renderer.setSize(window.innerWidth, window.innerHeight);
css_renderer.domElement.style.position = 'absolute';
css_renderer.domElement.style.top = '0';
css_renderer.domElement.style.zIndex = '1'; // On top of WebGL canvas
document.body.appendChild(css_renderer.domElement);
// WebGL rendering
const webgl_renderer = new THREE.WebGLRenderer({ antialias: true });
webgl_renderer.setSize(window.innerWidth, window.innerHeight);
webgl_renderer.shadowMap.enabled = true;
webgl_renderer.shadowMap.type = THREE.VSMShadowMap;
webgl_renderer.setAnimationLoop(animate);
webgl_renderer.domElement.style.position = 'absolute';
webgl_renderer.domElement.style.top = '0';
webgl_renderer.domElement.style.zIndex = '0';
document.body.appendChild(webgl_renderer.domElement);
// UI creation
const viewable_ui = new ViewableUI(scene, world, RAPIER);
// Background creation
new BackgroundLighting(scene);
const primary_container = new PrimaryContainer(world, scene, viewable_ui.get_camera());
new BackgroundFloor(world, scene, viewable_ui.get_camera());
// const mouse_ball = new MouseBall(scene, world, RAPIER);
// Effects/bloom effects
const render_scene = new RenderPass(scene, viewable_ui.get_camera());
const bloom_pass = new UnrealBloomPass( 
    new THREE.Vector2(window.innerWidth, window.innerHeight), // Resolution
    1.5, // Strength
    0.4, // Radius
    1 // Threshold
);
const output_pass = new OutputPass();
const composer = new EffectComposer(webgl_renderer);
composer.addPass(render_scene);
composer.addPass(bloom_pass);
composer.addPass(output_pass);

// TODO OOOOO
// TODO Change mouse ball from collider to grabber on click
// BUG When shrinking to small column and selected other column colors become visible
// TODO Create html pages for each category
// TODO Ensure html page text boxes are sensitive to zooming
//          Text should enlarge
// TODO Create instruction menus for when hide button is clicked for controlling physics things/camera

// ----- Functions
/*** Swaps the container column sides */
function swap_column_sides() {
    viewable_ui.get_overlay().swap_column_sides();
    if(viewable_ui.get_overlay().is_label_column_left_side()){
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
    viewable_ui.update_mouse_ball();
    // Background object updates
    primary_container.dynamic_bodies.forEach(([mesh, body]) => {
        if(body != null) {
            const position = body.translation();
            mesh.position.set(position.x, position.y, position.z);
            const rotation = body.rotation();
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
    });
    // Scene reload
    composer.render();
    css_renderer.render(scene, viewable_ui.get_camera());
}

/** Handles mouse hovering events and raycasts to collide with scene objects */
function handle_movement(e) {
    viewable_ui.handle_movement(e);
}

/** Handles mouse off screen events */
function handle_off_screen(e) {
    if( viewable_ui.get_overlay().is_label_column_left_side()) {
        viewable_ui.get_overlay().reset_hover();
    }
}

/** Handles mouse wheel actions */
function handle_mouse_wheel(e) {
    // Down up scroll
    if(e.deltaY > 0) {
        viewable_ui.decrease_mouse_ball_z();
    } else if(e.deltaY < 0) {
        viewable_ui.increase_mouse_ball_z();
    }
    // Right left scroll
    if(e.deltaX > 0) {
        log_scroll("Right scroll");
    } else if(e.deltaX < 0) {
        log_scroll("Left scroll");
    }
    // Shared logging method
    function log_scroll(scroll_type) {
        console.log(`${scroll_type} detected`);
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
    webgl_renderer.setSize(window.innerWidth, window.innerHeight);
    css_renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

/** Handles mouse down actions */
window.addEventListener('mousedown', (e) => {
    const found_intersections = get_intersect_list(e, viewable_ui.get_camera(), scene);
    found_intersections.forEach(i => {
        if(i.object.name != "") {
            console.log(`${i.object.name} clicked down`)
        }
    });
});

/** Handles mouse up actions */
window.addEventListener('mouseup', (e) => {
    const found_intersections = get_intersect_list(e, viewable_ui.get_camera(), scene);
    if( viewable_ui.get_overlay().is_label_column_left_side()){
        if(found_intersections.length > 0){
            const intersected_object = found_intersections[0].object;
            if(intersected_object.name != null) {
                (console.log(`${intersected_object.name} clicked up`));
            }
            const split_intersected_name = intersected_object.name.split("_");
            const name_type = extract_type(intersected_object);
            switch(name_type) {
                case TYPES.LABEL:
                    viewable_ui.get_overlay().reset_hover();
                    swap_column_sides();
                    viewable_ui.get_overlay().focus_text_box(intersected_object.name);
                    break;
                case TYPES.HIDE:
                    viewable_ui.trigger_overlay();
                    break;
                case TYPES.LINK:
                    viewable_ui.get_overlay().open_link(split_intersected_name[1].trim());
                    break;
            }
        }
    // Column is right
    } else {
        if(found_intersections.length > 0) {
            const intersected_object = found_intersections[0].object;
            const name_type = extract_type(intersected_object);
            switch(name_type) {
                case TYPES.LABEL:
                    viewable_ui.get_overlay().focus_text_box(intersected_object.name);
                    break;
                case TYPES.LINK:
                    viewable_ui.get_overlay().open_link(split_intersected_name[1].trim());
                    break;
                default:
                    swap_column_sides();
                    viewable_ui.get_overlay().lose_focus_text_box(WEST);
            }
        } else {
            swap_column_sides();
            viewable_ui.get_overlay().lose_focus_text_box(WEST);
        }
    }
});

window.addEventListener('wheel', handle_mouse_wheel);
window.addEventListener('mousemove', handle_movement);
/*
The window object isn't a typical DOM element with a well-defined "bounding box" for mouse events.
In many browsers, these events simply never fire on window because the mouse leaving or entering 
the window isn't interpreted as a mouseleave or mouseenter on that object.
*/
webgl_renderer.domElement.addEventListener('mouseout', handle_off_screen);
css_renderer.domElement.addEventListener('mouseout', handle_off_screen);
