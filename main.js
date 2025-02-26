import { FLAGS, loadThree, loadRapier, THREE, RAPIER, updateTween } from './common';
import { BackgroundFloor } from './background/background_floor';
import { ViewableContainer } from './viewport/viewable_container';
import { BackgroundLighting } from './background/background_lighting';
import { extract_type, get_intersect_list, TEXTURE_LOADER, TYPES } from './viewport/overlay/overlay_common';
import { AppRenderer } from './common/app_renderer';
import { shove_object, translate_object, update_mouse_position, zoom_object_in, zoom_object_out, grab_object, release_object } from './background/background_common';
import { BackgroundContainer } from './background/background_container';
import { AssetManager } from './common/asset_manager';

// ----- Constants
const BACKGROUND_IMAGE = 'images/gradient.jpg';

// ----- Variables
let resize_move = false;
let zoom_event = false;
let last_pixel_ratio = window.devicePixelRatio;
let scene;
let gravity;
let world;
let clock;
let viewable_container;
let app_renderer;
let background_container;
let resizeTimeout;
let hovered_cube_name = "";
let grabbed_object = null;
let left_mouse_down = false;
let right_mouse_down = false;
let construction_acknowledged = false;
let asset_manager;

/** Updates the loading progress text */
function updateLoadingProgress(text) {
    const loadingProgress = document.getElementById('loading-progress');
    if (loadingProgress) {
        loadingProgress.textContent = text;
    }
}

/** Shows the loading screen */
async function showLoadingScreen() {
    const response = await fetch('pages/loading.html');
    const html = await response.text();
    document.body.insertAdjacentHTML('beforeend', html);
}

/** Hides the loading screen */
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.remove();
    }
}

/** Initializes the main scene */
async function init() {
    try {
        await showLoadingScreen();
        
        updateLoadingProgress('Loading Three.js...');
        await loadThree(); // Still load async but we already have THREE available

        updateLoadingProgress('Loading Rapier Physics...');
        await loadRapier(); // Initialize Rapier
        await RAPIER.init(); // Make sure Rapier is initialized
        
        updateLoadingProgress('Initializing scene...');
        asset_manager = AssetManager.get_instance();
        
        if(FLAGS.CONSTRUCTION_GREETING) {
            const response = await fetch('pages/under_construction.html');
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);
            const modal = document.getElementById('construction-modal');
            const acknowledgeBtn = document.getElementById('acknowledge-btn');
            modal.style.display = 'block';
            acknowledgeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                construction_acknowledged = true;
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
        viewable_container = new ViewableContainer(scene, world);
        
        // Renderer
        app_renderer = new AppRenderer(scene, viewable_container.get_camera());
        
        // Background creation
        new BackgroundLighting(scene);
        background_container = new BackgroundContainer(scene, viewable_container.get_camera(), world);
        new BackgroundFloor(world, scene, viewable_container.get_camera());

        // Hide loading screen and start animation
        hideLoadingScreen();
        app_renderer.set_animation_loop(animate);
    } catch (error) {
        console.error('Error during initialization:', error);
        updateLoadingProgress('Error loading application. Please refresh the page.');
    }
}

/** Primary animation function run every frame by renderer */
function animate() {
    const delta = clock.getDelta();
    // Handle the overlay
    updateTween();
    if(resize_move) {
        if(!zoom_event) {
            viewable_container.resize_reposition();
        } else {
            zoom_event = false;
        }
        resize_move = false;
    }
    // Handle the physics objects
    if(viewable_container.get_overlay().is_intersected() != null) {
        asset_manager.activate_object(viewable_container.get_intersected_name());
    } else if(grabbed_object) {
        translate_object(grabbed_object, viewable_container.get_camera());
    } else if(hovered_cube_name != "") {
        asset_manager.activate_object(hovered_cube_name);
    } else if(viewable_container.is_text_active()) {
        asset_manager.activate_object(viewable_container.get_active_name());
    } else {
        asset_manager.deactivate_all_objects();
    }
    world.timestep = Math.min(delta, 0.1);
    world.step();
    // Background object updates
    background_container.update(grabbed_object, viewable_container);
    asset_manager.update();
    // Update confetti particles
    viewable_container.get_overlay().update_confetti();
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
    viewable_container.reset_camera();
    app_renderer.resize();
}

function handle_mouse_move(e) {
    update_mouse_position(e);
    if(viewable_container.detect_rotation) {
        const sensitivity = 0.02;  // Reduced sensitivity since we're not dividing by 1000 anymore
        viewable_container.get_camera_manager().rotate(
            e.movementX * sensitivity,
            e.movementY * sensitivity
        );
    }
    if(construction_acknowledged) {
        // Handle intersections
        const found_intersections = get_intersect_list(e, viewable_container.get_camera(), scene);
        if(found_intersections.length > 0 && ! viewable_container.get_overlay().is_swapping_sides()) {
            const intersected_object = found_intersections[0].object;
            const object_name = intersected_object.name;
            const name_type = object_name.split("_")[0] + "_";
            // Handle label hover
            switch(name_type) {
                case TYPES.LABEL:
                    viewable_container.get_overlay().handle_hover(intersected_object);
                    break;
                case TYPES.FLOOR:
                    viewable_container.get_overlay().reset_hover();
                    break;
                case TYPES.INTERACTABLE:
                    if(viewable_container.is_overlay_hidden()) {
                        hovered_cube_name = object_name;
                    } else {
                        hovered_cube_name = "";
                    }
                default:
                    break;
            }
        } else {
            viewable_container.get_overlay().reset_hover();
            hovered_cube_name = "";
        }
    }
}

function handle_mouse_up(e) {
    if(construction_acknowledged) {
        if(grabbed_object) {
            release_object(grabbed_object, background_container);
            grabbed_object = null;
        }
        viewable_container.handle_mouse_up(get_intersect_list(e, viewable_container.get_camera(), scene));
        if (e.button === 0) {
            viewable_container.detect_rotation = false;
            left_mouse_down = false;
        }
        if (e.button === 2) {
            viewable_container.detect_rotation = false;
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
                release_object(grabbed_object);
                grabbed_object = null;
            }
        }
        if(left_mouse_down && right_mouse_down && viewable_container.is_overlay_hidden()) {
            viewable_container.detect_rotation = true;
        } else if(viewable_container.is_overlay_hidden()) {
            const found_intersections = get_intersect_list(e, viewable_container.get_camera(), scene);
            found_intersections.forEach(i => {
                switch(extract_type(i.object)) {
                    case TYPES.INTERACTABLE:
                        if(left_mouse_down) {
                            grabbed_object = i.object;
                            grab_object(grabbed_object, viewable_container.get_camera());
                        } else {
                            shove_object(i.object, viewable_container.get_camera());
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
                background_container.break_secondary_chains();
                zoom_object_in(grabbed_object);
            } else {
                background_container.break_secondary_chains();
                zoom_object_out(grabbed_object);
            }
            zoom_event = true;
            resize_move = true;
        }
    }
}

// Start initialization
init();