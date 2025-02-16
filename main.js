import { update as updateTween } from 'three/examples/jsm/libs/tween.module.js';
import { PrimaryContainer } from './background/primary_container';
import { BackgroundFloor } from './background/background_floor';
import { ViewableUI } from './viewport/viewable_ui';
import { BackgroundLighting } from './background/background_lighting';
import { extract_type, get_intersect_list, TEXTURE_LOADER, TYPES } from './viewport/overlay/overlay_common';
import { AppRenderer } from './common/app_renderer';
import { shove_object, translate_object, update_mouse_position, zoom_object_in, zoom_object_out, grab_object, release_object } from './background/background_common';
import { ControlMenu } from './background/control_menu';
import { FLAGS, RAPIER, THREE } from './common';
import { ScrollMenu } from './background/scroll_menu';
import { SecondaryContainer } from './background/secondary_container';

// ----- Constants
const BACKGROUND_IMAGE = 'images/gradient.jpg';
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
let secondary_container;
let resizeTimeout;
let hovered_cube_name = "";
let grabbed_object = null;
let left_mouse_down = false;
let right_mouse_down = false;
let construction_acknowledged = false;
let primary_instruction_sign = null;
let tigger_secondary = false;
let secondary_instruction_sign = null;
let chain_created = false;

/** Initializes the main scene */
function init() {
    if(FLAGS.CONSTRUCTION_GREETING) {
        fetch('pages/under_construction.html')
            .then(response => response.text())
            .then(html => {
                document.body.insertAdjacentHTML('beforeend', html);
                const modal = document.getElementById('construction-modal');
                const acknowledgeBtn = document.getElementById('acknowledge-btn');
                // Show the modal
                modal.style.display = 'block';
                // Handle the acknowledge button click
                acknowledgeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    construction_acknowledged = true;
                });
            });
        }
    // ----- Setup
    scene = new THREE.Scene();
    scene.background = TEXTURE_LOADER.load(BACKGROUND_IMAGE);
    window.addEventListener('resize', handle_resize);
    window.addEventListener('mousemove', handle_mouse_move);
    window.addEventListener('mousedown', handle_mouse_down);
    window.addEventListener('mouseup', handle_mouse_up);
    window.addEventListener('contextmenu', handle_context_menu);
    window.addEventListener('wheel', handle_wheel);
    // Physics
    gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    world = new RAPIER.World(gravity);
    clock = new THREE.Clock();
    // UI creation
    viewable_ui = new ViewableUI(scene, world, RAPIER);
    // Renderer
    app_renderer = new AppRenderer(scene, viewable_ui.get_camera());
    // Background creation
    new BackgroundLighting(scene);
    primary_container = new PrimaryContainer(scene, viewable_ui.get_camera(), world);
    secondary_container = new SecondaryContainer(scene, viewable_ui.get_camera(), world);
    new BackgroundFloor(world, scene, viewable_ui.get_camera());
    // Start animation loop after everything is initialized
    app_renderer.set_animation_loop(animate);
    app_renderer.add_event_listener('mouseout', () => {
        if(viewable_ui.is_column_left_side()) {
            viewable_ui.reset_hover();
        }
    });
}

/** Primary animation function run every frame by renderer */
function animate() {
    if(primary_instruction_sign) {
        primary_instruction_sign.update();
    }
    if((grabbed_object != null  || viewable_ui.is_secondary_triggered()) && !tigger_secondary) {
        tigger_secondary = true;
    }
    // Test moving objects
    const delta = clock.getDelta();
    // Deal with primary instructions
    if(viewable_ui.is_primary_triggered() && primary_instruction_sign == null) {
        primary_instruction_sign = new ControlMenu(scene, viewable_ui.get_camera(), world, primary_container, RAPIER);
    } else if(!viewable_ui.is_overlay_hidden() && primary_instruction_sign != null && !primary_instruction_sign.chains_broken) {
        primary_instruction_sign.break_chains();
    // Deal with secondary instructions
    } else if(tigger_secondary && secondary_instruction_sign == null && !chain_created) {
        primary_instruction_sign.break_chains();
        chain_created = true;
        secondary_instruction_sign = new ScrollMenu(scene, viewable_ui.get_camera(), world, primary_container, RAPIER);
    } else if(secondary_instruction_sign != null && !viewable_ui.is_overlay_hidden()) {
        secondary_instruction_sign.break_chains();
    }
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
        primary_container.activate_object(viewable_ui.get_intersected_name());
    } else if(grabbed_object) {
        translate_object(grabbed_object, viewable_ui.get_camera(), primary_container);
    } else if(hovered_cube_name != "") {

        primary_container.activate_object(hovered_cube_name);
    } else if(viewable_ui.is_text_active()) {
        primary_container.activate_object(viewable_ui.get_active_name());
    } else {
        primary_container.decativate_all_objects();
    }
    world.timestep = Math.min(delta, 0.1);
    world.step();
    // Background object updates
    primary_container.update();
    secondary_container.update();
    // Update confetti particles
    viewable_ui.get_overlay().update_confetti();
    // Scene reload
    app_renderer.render();
}

// ----- Handlers

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
}

function handle_mouse_move(e) {
    update_mouse_position(e);
    if(viewable_ui.detect_rotation) {
        const sensitivity = 0.02;  // Reduced sensitivity since we're not dividing by 1000 anymore
        viewable_ui.get_camera_controller().rotate(
            e.movementX * sensitivity,
            e.movementY * sensitivity
        );
    }
    if(construction_acknowledged) {
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
                case TYPES.INTERACTABLE:
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
}

function handle_mouse_up(e) {
    if(construction_acknowledged) {
        if(grabbed_object) {
            release_object(grabbed_object, primary_container, RAPIER);
            grabbed_object = null;
        }
        viewable_ui.handle_mouse_up(get_intersect_list(e, viewable_ui.get_camera(), scene));
        if (e.button === 0) {
            viewable_ui.detect_rotation = false;
            left_mouse_down = false;
        }
        if (e.button === 2) {
            viewable_ui.detect_rotation = false;
            right_mouse_down = false;
        }
    }
}

function handle_mouse_down(e) {
    if(construction_acknowledged) {
        if(e.button === 0) {
            left_mouse_down = true;
        }
        if(e.button === 2) {
            right_mouse_down = true;
            // If we're holding an object and right click is pressed, release it
            if(grabbed_object) {
                release_object(grabbed_object, primary_container, RAPIER);
                grabbed_object = null;
            }
        }
        if(left_mouse_down && right_mouse_down && viewable_ui.is_overlay_hidden()) {
            viewable_ui.detect_rotation = true;
        } else if(viewable_ui.is_overlay_hidden()) {
            const found_intersections = get_intersect_list(e, viewable_ui.get_camera(), scene);
            found_intersections.forEach(i => {
                switch(extract_type(i.object)) {
                    case TYPES.INTERACTABLE:
                        if(left_mouse_down) {
                            grabbed_object = i.object;
                            grab_object(grabbed_object, viewable_ui.get_camera(), primary_container, RAPIER);
                        } else {
                            shove_object(i.object, viewable_ui.get_camera(), primary_container);
                        }
                        break;
                    default:
                        break;
                }
            });
        }
    }
}

function handle_context_menu(e) {
    e.preventDefault();
}

function handle_wheel(e) {
    if(construction_acknowledged) {
        if(grabbed_object) {
            if(e.deltaY < 0) {
                secondary_instruction_sign.break_chains();
                zoom_object_in(grabbed_object, primary_container, RAPIER);
            } else {
                secondary_instruction_sign.break_chains();
                zoom_object_out(grabbed_object, primary_container, RAPIER);
            }
            zoom_event = true;
            resize_move = true;
        }
    }
}

init();