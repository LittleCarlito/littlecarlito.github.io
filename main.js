import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { update as updateTween } from 'three/examples/jsm/libs/tween.module.js';
import { PrimaryContainer } from './background/primary_container';
import { BackgroundFloor } from './background/background_floor';
import { ViewableUI } from './viewport/viewable_ui';
import { BackgroundLighting } from './background/background_lighting';
import { get_intersect_list, TEXTURE_LOADER, TYPES } from './viewport/overlay/common';
import { AppRenderer } from './common/app_renderer';

// ----- Constants
const BACKGROUND_IMAGE = 'gradient.jpg';
await RAPIER.init();
// ----- Variables
let resize_move = false;
let zoom_event = false;
let last_pixel_ratio = window.devicePixelRatio;
let scene;
let gravity;
let world;
let clock;
let viewable_ui;
let app_renderer;
let primary_container;
let resizeTimeout;
let hovered_cube_name = "";

/** Initializes the main scene */
function init() {
    scene = new THREE.Scene();
    scene.background = TEXTURE_LOADER.load(BACKGROUND_IMAGE);
    window.addEventListener('resize', handle_resize);
    window.addEventListener('mousemove', handle_mouse_move);
    // Physics
    gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    world = new RAPIER.World(gravity);
    clock = new THREE.Clock();
    // UI creation
    viewable_ui = new ViewableUI(scene, world, RAPIER);
    // Renderer
    app_renderer = new AppRenderer(scene, viewable_ui.get_camera());
    app_renderer.set_animation_loop(animate);
    app_renderer.add_event_listener('mouseout', () => {
        if(viewable_ui.is_column_left_side()) {
            viewable_ui.reset_hover();
        }
    });
    // Background creation
    new BackgroundLighting(scene);
    primary_container = new PrimaryContainer(world, scene, viewable_ui.get_camera());
    new BackgroundFloor(world, scene, viewable_ui.get_camera());
}


/** Primary animation function run every frame by renderer */
function animate() {
    // Handle the overlay
    updateTween();
    if(resize_move) {
        if(!zoom_event) {
            viewable_ui.resize_reposition();
        } else {
            zoom_event = false;
        }
        resize_move = false;
    }
    // Handle the physics objects
    if(viewable_ui.get_overlay().is_intersected() != null) {
        primary_container.activate_object( viewable_ui.get_intersected_name());
    // TODO Make sure you have logic resetting this when its not hovered
    } else if(hovered_cube_name != "") {
        primary_container.activate_object(hovered_cube_name);
    } else if(viewable_ui.is_text_active()) {
        primary_container.activate_object(viewable_ui.get_active_name());
    } else {
        primary_container.decativate_all_objects();
    }
    const delta = clock.getDelta();
    world.timestep = Math.min(delta, 0.1);
    world.step();
    // viewable_ui.update_mouse_ball();
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
    app_renderer.render();
}

/** Handles resize events */
function handle_resize() {
    // Clear any existing timeout
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }

    // Set variables
    resize_move = true;
    
    // Determine if it was a zoom event
    const current_pixel_ratio = window.devicePixelRatio;
    if (last_pixel_ratio != current_pixel_ratio) {
        last_pixel_ratio = current_pixel_ratio;
        zoom_event = true;
    }

    // Immediate camera update
    viewable_ui.reset_camera();
    app_renderer.resize();

    // Debounce the mouse ball reset
    resizeTimeout = setTimeout(() => {
        viewable_ui.reset_mouseball();
    }, 100); // 100ms delay
}

function handle_mouse_move (e) {
    if(viewable_ui.detect_rotation) {
        const sensitivity = 0.02;  // Reduced sensitivity since we're not dividing by 1000 anymore
        viewable_ui.get_camera_controller().rotate(
            e.movementX * sensitivity,
            e.movementY * sensitivity
        );
    }
    // Handle mouseball
    // viewable_ui.get_mouse_ball().handle_movement(e, viewable_ui.get_camera());
    // Handle intersections
    const found_intersections = get_intersect_list(e, viewable_ui.get_camera(), scene);
    if(found_intersections.length > 0 && ! viewable_ui.get_overlay().is_swapping_sides()) {
        const intersected_object = found_intersections[0].object;
        const object_name = intersected_object.name;
        const name_type = object_name.split("_")[0] + "_";
        // Handle label hover
        switch(name_type) {
            case TYPES.LABEL:
                viewable_ui.get_overlay().handle_hover(intersected_object);
                break;
            case TYPES.FLOOR:
                viewable_ui.get_overlay().reset_hover();
                break;
            // TODO Change this to be just setting a string for hovered object
            //          Make sure to get rid of deactivate all below too
            //          Should all be in animate instead, independent of mouse movement
            case TYPES.CUBE:
                if(viewable_ui.is_overlay_hidden()) {
                    hovered_cube_name = object_name;
                } else {
                    hovered_cube_name = "";
                }
            default:
                break;
        }
    } else {
        viewable_ui.get_overlay().reset_hover();
        hovered_cube_name = "";
    }
}

init();