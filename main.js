// @ts-nocheck
// Import the global config first to ensure it's available to all modules
import { FLAGS, THREE, RAPIER, load_three, load_rapier, updateTween } from './common';
import { ViewableContainer } from './viewport/viewable_container';
import { BackgroundLighting } from './background/background_lighting';
import { extract_type, get_intersect_list, TEXTURE_LOADER, TYPES } from './viewport/overlay/overlay_common';
import { AppRenderer } from './common';
import { shove_object, translate_object, update_mouse_position, zoom_object_in, zoom_object_out, grab_object, release_object } from './background/background_common';
import { BackgroundContainer } from './background/background_container';
import { AssetStorage, AssetActivator, AssetSpawner, ManifestManager } from 'blorkpack';
import { toggleDebugUI, createDebugUI as create_debug_UI, setBackgroundContainer as set_background_container, setResolutionScale as set_resolution_scale, updateLabelWireframes } from './common/debug_ui.js';
import { BLORKPACK_FLAGS } from './packages/blorkpack/src/blorkpack_flags.js';

// ----- Variables
let resize_move = false;
let zoom_event = false;
let resize_timeout;
let hovered_interactable_name = "";
let grabbed_object = null;
let left_mouse_down = false;
let right_mouse_down = false;
let is_cleaned_up = false; // Track if cleanup has been performed
let is_physics_paused = false; // Track if physics simulation is paused
let greeting_acknowledged = false; // Declare the variable here

/** Cleans up resources to prevent memory leaks */
function cleanup() {
    if (is_cleaned_up) {
        if(BLORKPACK_FLAGS.DEBUG_LOGS) {
            console.debug("Scene already clean; Skipping cleanup");
        }
        return; // Prevent multiple cleanups
    }
    // Remove event listeners
    window.removeEventListener('resize', handle_resize);
    window.removeEventListener('mousemove', handle_mouse_move);
    window.removeEventListener('mousedown', handle_mouse_down);
    window.removeEventListener('mouseup', handle_mouse_up);
    window.removeEventListener('contextmenu', handle_context_menu);
    window.removeEventListener('wheel', handle_wheel);
    window.removeEventListener('keydown', toggle_debug_ui);
    // Dispose of major components
    if (window.app_renderer) {
        window.app_renderer.dispose();
        window.app_renderer = null;
    }
    // Cleanup asset systems
    if (window.asset_spawner) {
        window.asset_spawner.cleanup();
        window.asset_spawner = null;
    }
    // Force garbage collection on Three.js objects
    if (window.scene) {
        window.scene.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        if (material.map) material.map.dispose();
                        material.dispose();
                    });
                } else {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });
        window.scene.clear();
        window.scene = null;
    }
    // Release Rapier physics world
    if (window.world) {
        window.world = null;
    }
    // Clear other references
    window.viewable_container = null;
    window.background_container = null;
    window.clock = null;
    grabbed_object = null;
    is_cleaned_up = true;
    if (BLORKPACK_FLAGS.DEBUG_LOGS) {
        console.log("Application resources cleaned up");
    }
}

/** Updates the loading progress text */
function update_loading_progress(text) {
    const loading_progress = document.getElementById('loading-progress');
    if (loading_progress) {
        loading_progress.textContent = text;
    }
}

/** Shows the loading screen */
async function show_loading_screen() {
    // Load the loading screen HTML from the external file
    const response = await fetch('pages/loading.html');
    const html = await response.text();
    document.body.insertAdjacentHTML('beforeend', html);
}

/** Hides the loading screen */
function hide_loading_screen() {
    const loading_screen = document.getElementById('loading-screen');
    if (loading_screen) {
        loading_screen.remove();
    }
}

/**
 * Displays a modal loaded from a remote HTML file
 * @param {string} modal_path - Path to the HTML file containing the modal content
 * @param {string} modal_id - ID of the modal element in the HTML
 * @param {string} button_id - ID of the button element to acknowledge the modal
 * @param {Function} onAcknowledge - Callback function to be executed when the modal is acknowledged
 * @returns {Promise} Promise that resolves when the modal is loaded and displayed
 */
async function display_modal(modal_path, modal_id, button_id, onAcknowledge) {
    try {
        const response = await fetch(modal_path);
        if (!response.ok) {
            throw new Error(`Failed to load modal: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        document.body.insertAdjacentHTML('beforeend', html);
        const modal = document.getElementById(modal_id);
        if (!modal) {
            throw new Error(`Modal HTML does not contain an element with ID '${modal_id}'`);
        }
        modal.style.display = 'block';
        const acknowledge_btn = document.getElementById(button_id);
        if (!acknowledge_btn) {
            console.warn(`Modal is missing an '${button_id}' element, user won't be able to dismiss it.`);
        } else {
            acknowledge_btn.addEventListener('click', () => {
                modal.style.display = 'none';
                if (onAcknowledge) onAcknowledge();
            });
        }
        return true;
    } catch (error) {
        console.error(`Error loading modal from path "${modal_path}": ${error.message}`);
        if (onAcknowledge) onAcknowledge();
        return false;
    }
}

/** Initializes the main scene */
async function init() {
    try {
        await show_loading_screen();
        // Load three
        update_loading_progress('Loading Three.js...');
        await load_three(); // Still load async but we already have THREE available
        // Load rapier
        update_loading_progress('Loading Rapier Physics...');
        await load_rapier(); // Initialize Rapier
        await RAPIER.init(); // Make sure Rapier is initialized
        // Load scene
        update_loading_progress('Initializing scene...');
        // Initialize asset storage and spawner early since they don't depend on UI
        AssetStorage.get_instance();
        // Initialize the ManifestManager and load the manifest
        update_loading_progress("Loading manifest...");
        window.manifest_manager = ManifestManager.get_instance();
        await window.manifest_manager.load_manifest();
        // Get greeting data from manifest, default to false if not present
        const greeting_data = window.manifest_manager.get_greeting_data();
        greeting_acknowledged = !(greeting_data && greeting_data.display === true);
        if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
            console.log("Manifest loaded:", window.manifest_manager.get_manifest());
        }
        // ----- Setup
        // Add event listeners
        window.addEventListener('resize', handle_resize);
        window.addEventListener('mousemove', handle_mouse_move);
        window.addEventListener('mousedown', handle_mouse_down);
        window.addEventListener('mouseup', handle_mouse_up);
        window.addEventListener('contextmenu', handle_context_menu);
        window.addEventListener('wheel', handle_wheel);
        window.addEventListener('keydown', toggle_debug_ui);
        window.addEventListener('unload', cleanup);
        window.scene = new THREE.Scene();
        // Apply scene settings from manifest
        // Set background based on manifest settings
        const bg = window.manifest_manager.get_background_config();
        if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
            console.log("Using background configuration:", bg);
        }
        switch (bg.type) {
            case 'IMAGE':
                window.scene.background = TEXTURE_LOADER.load(bg.image_path);
                break;
            case 'COLOR':
                window.scene.background = new THREE.Color(bg.color_value);
                break;
            case 'SKYBOX':
                if (bg.skybox && bg.skybox.enabled) {
                    // Load skybox (implementation depends on your skybox format)
                    console.log('Loading skybox from:', bg.skybox.skybox_path);
                }
                break;
            default:
                // This shouldn't happen since the getter validates the type
                console.error(`Background type \"${bg.type}\" is not supported`);
                window.scene.background = new THREE.Color('0x000000');
        }
        // Physics - Get gravity from manifest manager
        const gravityData = window.manifest_manager.get_gravity();
        if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
            console.log("Using gravity:", gravityData);
        }
        // Create world and spawner
        window.world = new RAPIER.World();
        window.world.gravity = new RAPIER.Vector3(gravityData.x, gravityData.y, gravityData.z);
        window.asset_spawner = AssetSpawner.get_instance(window.scene, window.world);
        // Physics optimization settings
        const physicsOptimization = window.manifest_manager.get_physics_optimization_settings();
        if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
            console.log("Using physics optimization settings:", physicsOptimization);
        }
        window.world.allowSleep = physicsOptimization.allow_sleep;
        window.world.linearSleepThreshold = physicsOptimization.linear_sleep_threshold;
        window.world.angularSleepThreshold = physicsOptimization.angular_sleep_threshold;
        window.world.sleepThreshold = physicsOptimization.sleep_threshold;
        window.world.maxVelocityIterations = physicsOptimization.max_velocity_iterations;
        window.world.maxVelocityFriction = physicsOptimization.max_velocity_friction;
        window.world.integrationParameters.dt = physicsOptimization.integration_parameters.dt;
        window.world.integrationParameters.erp = physicsOptimization.integration_parameters.erp;
        window.world.integrationParameters.warmstartCoeff = physicsOptimization.integration_parameters.warmstart_coeff;
        window.world.integrationParameters.allowedLinearError = physicsOptimization.integration_parameters.allowed_linear_error;
        window.clock = new THREE.Clock();
        // UI creation
        update_loading_progress('Creating UI components...');
        // TODO OOOOO
        // TODO Get camera spawned from manifest
        // TODO Get lighting spawned from manifest
        // TODO One day get the UI portion into the Manifest
        // FUTURE: Use default_camera configuration from manifest to create camera
        // FUTURE: const cameraConfig = window.manifest_manager.get_camera_config();
        window.viewable_container = new ViewableContainer(window.scene, window.world);
        // Renderer
        window.app_renderer = new AppRenderer(window.scene, window.viewable_container.get_camera());
        window.renderer = window.app_renderer.get_renderer();
        // Now initialize the asset activator after camera and renderer are created
        window.asset_activator = AssetActivator.get_instance(window.viewable_container.get_camera(), window.app_renderer.get_renderer());
        // Show construction greeting if enabled in manifest
        if(greeting_data.display === true) {
            await display_modal(
                greeting_data.modal_path,
                'greeting-modal',
                'acknowledge-btn',
                () => { greeting_acknowledged = true; }
            );
        }
        // Background creation
        update_loading_progress('Loading background assets...');
        // TODO Refactor BackgroundLighting to use Manifest setup
        const lighting = BackgroundLighting.getInstance(window.scene);
        // TODO Refactor BackgroundContainer to use Manifest setup
        window.background_container = new BackgroundContainer(window.scene, window.viewable_container.get_camera(), window.world);
        // Load application assets from manifest (including background floor)
        update_loading_progress('Loading application assets...');
        const application_assets = await window.asset_spawner.spawn_application_assets(window.manifest_manager, update_loading_progress);
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
            console.log('Loaded application assets:', application_assets);
        }
        // Wait for all assets to be loaded
        update_loading_progress('Loading scene assets...');
        await new Promise(async (resolve) => {
            const checkAssetsLoaded = async () => {
                const isComplete = await window.background_container.is_loading_complete();
                if (isComplete) {
                    if (BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log('All assets loaded:', Array.from(window.background_container.get_asset_manifest()));
                    }
                    resolve();
                } else {
                    if (BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log('Waiting for assets to complete loading...');
                    }
                    setTimeout(checkAssetsLoaded, 100);
                }
            };
            await checkAssetsLoaded();
        });
        // Hide loading screen and start animation
        hide_loading_screen();
        window.app_renderer.set_animation_loop(animate);
        // Initialize debug UI (hidden by default)
        create_debug_UI();
        // Set background container reference for debug UI
        set_background_container(window.background_container);
        // Initialize resolution scale based on device capabilities
        if (window.manifest_manager.get_auto_throttle()) {
            // Start with a resolution scale based on device pixel ratio
            // Higher pixel ratio devices (like Retina displays) get a lower initial scale
            // to maintain performance
            const initialScale = window.devicePixelRatio > 1 ? 0.75 : 1.0;
            set_resolution_scale(initialScale);
            console.log(`Initial resolution scale set to ${initialScale.toFixed(2)} based on device pixel ratio ${window.devicePixelRatio}`);
        }
        // Ensure label wireframes are updated regardless of debug visualization state
        if (window.viewable_container && window.viewable_container.get_overlay()) {
            const labelContainer = window.viewable_container.get_overlay().label_container;
            if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
                console.log('Directly updating label wireframes after initialization');
                labelContainer.updateDebugVisualizations();
            }
        }
        // Load and spawn assets defined in the manifest
        update_loading_progress("Loading assets from manifest...");
        const spawned_assets = await window.asset_spawner.spawn_asset_groups(window.manifest_manager, update_loading_progress);
    } catch (error) {
        console.error('Error during initialization:', error);
        update_loading_progress('Error loading application. Please refresh the page.');
    }
}

/** Toggle physics simulation pause state */
function toggle_physics_pause() {
    is_physics_paused = !is_physics_paused;
    
    if (FLAGS.PHYSICS_LOGS) {
        console.log(`Physics simulation ${is_physics_paused ? 'paused' : 'resumed'}`);
    }
    
    // Update UI if debug UI is active
    if (FLAGS.DEBUG_UI) {
        const pause_button = document.getElementById('pause-physics-btn');
        if (pause_button) {
            pause_button.textContent = is_physics_paused ? 'Resume Physics' : 'Pause Physics';
        }
    }
}

// Make the function available globally for the debug UI
window.toggle_physics_pause = toggle_physics_pause;

/** Primary animation function run every frame by renderer */
function animate() {
    const delta = window.clock.getDelta();
    
    // Handle tweens and UI animations (always run regardless of physics pause)
    updateTween();
    
    if(resize_move) {
        if(!zoom_event) {
            window.viewable_container.resize_reposition();
        } else {
            zoom_event = false;
        }
        resize_move = false;
    }
    
    // Check if a text container is active, and pause physics if needed
    const isTextActive = window.viewable_container.is_text_active();
    
    // Track text container state to detect changes
    if (!window.previousTextContainerState && isTextActive && !is_physics_paused) {
        // Text container just became active, pause physics
        if (FLAGS.SELECT_LOGS) {
            console.log('Pausing physics due to text container activation');
        }
        window.textContainerPausedPhysics = true;
        toggle_physics_pause();
    } else if (window.previousTextContainerState && !isTextActive && is_physics_paused && window.textContainerPausedPhysics) {
        // Text container was active but is no longer active, restore physics
        if (FLAGS.SELECT_LOGS) {
            console.log('Resuming physics due to text container deactivation');
        }
        window.textContainerPausedPhysics = false;
        toggle_physics_pause();
    }
    
    // Store current state for next frame comparison
    window.previousTextContainerState = isTextActive;
    
    // Handle the physics objects
    if(window.viewable_container.get_overlay().is_intersected() != null) {
        window.asset_activator.activate_object(window.viewable_container.get_intersected_name());
    } else if(grabbed_object) {
        translate_object(grabbed_object, window.viewable_container.get_camera());
    } else if(hovered_interactable_name != "" && window.viewable_container.is_overlay_hidden()) {
        // Only activate hovered objects when the overlay is hidden
        window.asset_activator.activate_object(hovered_interactable_name);
    } else if(window.viewable_container.is_text_active()) {
        window.asset_activator.activate_object(window.viewable_container.get_active_name());
    } else {
        window.asset_activator.deactivate_all_objects();
    }
    
    // Process physics simulation (can be paused)
    window.world.timestep = Math.min(delta, 0.1);
    if (!is_physics_paused) {
        window.world.step();
    }
    
    // Always update menu animations and user interactions
    // These handle spawning and sign animations, even when physics is paused
    if (window.background_container) {
        window.background_container.update(grabbed_object, window.viewable_container);
    }
    
    // Update physics-dependent objects
    if (AssetStorage.get_instance()) {
        if (!is_physics_paused) {
            // Full physics update when not paused
            AssetStorage.get_instance().update();
        } else if (grabbed_object) {
            // When paused, only update grabbed objects
            const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(grabbed_object);
            if (body_pair) {
                const [mesh, body] = body_pair;
                const position = body.translation();
                mesh.position.set(position.x, position.y, position.z);
                const rotation = body.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        }
    }
    
    // Always update visual elements even when physics is paused
    // Update confetti particles (immune from physics pause - uses its own physics calculations)
    window.viewable_container.get_overlay().update_confetti();
    
    // Ensure regular cleanup of unused resources
    if (window.asset_spawner) {
        window.asset_spawner.performCleanup();
    }
    
    // Render the scene
    window.app_renderer.render();
}

// ----- Handlers

/** Handles resize events */
function handle_resize() {
    if (resize_timeout) clearTimeout(resize_timeout);
    
    resize_timeout = setTimeout(() => {
        if (window.app_renderer) window.app_renderer.resize();
        if (window.viewable_container) {
            window.viewable_container.reset_camera();
            window.viewable_container.resize_reposition();
        }
    }, 100);
}

function handle_mouse_move(e) {
    update_mouse_position(e);
    if(window.viewable_container.detect_rotation) {
        const sensitivity = 0.02;  // Reduced sensitivity since we're not dividing by 1000 anymore
        window.viewable_container.get_camera_manager().rotate(
            e.movementX * sensitivity,
            e.movementY * sensitivity
        );
    }
    if(greeting_acknowledged) {
        // Handle intersections
        const found_intersections = get_intersect_list(e, window.viewable_container.get_camera(), window.scene);
        
        // Check if UI overlay is visible
        const is_overlay_hidden = window.viewable_container.is_overlay_hidden();
        
        // If overlay is not hidden, filter out background objects from intersection list
        let relevant_intersections = found_intersections;
        if(!is_overlay_hidden) {
            // Only consider LABEL items when overlay is visible
            relevant_intersections = found_intersections.filter(intersection => {
                const object_name = intersection.object.name;
                const name_type = object_name.split("_")[0] + "_";
                return name_type === TYPES.LABEL;
            });
        }
        
        if(relevant_intersections.length > 0 && !window.viewable_container.get_overlay().is_swapping_sides()) {
            const intersected_object = relevant_intersections[0].object;
            const object_name = intersected_object.name;
            const name_type = object_name.split("_")[0] + "_";
            
            // Handle label hover - now we know it's either a label or an appropriate object
            switch(name_type) {
                case TYPES.LABEL:
                    window.viewable_container.get_overlay().handle_hover(intersected_object);
                    break;
                case TYPES.FLOOR:
                    // We know overlay is hidden if we get here, due to the filtering above
                    window.viewable_container.get_overlay().reset_hover();
                    break;
                case TYPES.INTERACTABLE:
                    // We know overlay is hidden if we get here, due to the filtering above
                    hovered_interactable_name = object_name;
                    if (FLAGS.ACTIVATE_LOGS) {
                        console.log("Hover detected on interactable:", object_name);
                    }
                    break;
                default:
                    // We know overlay is hidden if we get here, due to the filtering above
                    window.viewable_container.get_overlay().reset_hover();
                    break;
            }
        } else {
            window.viewable_container.get_overlay().reset_hover();
            
            // Only reset hovered_interactable_name if the overlay is hidden
            // This prevents background objects from losing hover state when UI is open
            if (is_overlay_hidden) {
                hovered_interactable_name = "";
            }
        }
    }
}

function handle_mouse_up(e) {
    if(greeting_acknowledged) {
        if(grabbed_object) {
            release_object(grabbed_object, window.background_container);
            grabbed_object = null;
        }
        window.viewable_container.handle_mouse_up(get_intersect_list(e, window.viewable_container.get_camera(), window.scene));
        if (e.button === 0) {
            window.viewable_container.detect_rotation = false;
            left_mouse_down = false;
        }
        if (e.button === 2) {
            window.viewable_container.detect_rotation = false;
            right_mouse_down = false;
        }
    }
}

function handle_mouse_down(e) {
    if(greeting_acknowledged) {
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
        if(left_mouse_down && right_mouse_down && window.viewable_container.is_overlay_hidden()) {
            window.viewable_container.detect_rotation = true;
        } else if(window.viewable_container.is_overlay_hidden()) {
            const found_intersections = get_intersect_list(e, window.viewable_container.get_camera(), window.scene);
            found_intersections.forEach(i => {
                switch(extract_type(i.object)) {
                    case TYPES.INTERACTABLE:
                        if(left_mouse_down) {
                            grabbed_object = i.object;
                            grab_object(grabbed_object, window.viewable_container.get_camera());
                        } else {
                            shove_object(i.object, window.viewable_container.get_camera());
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
    if(greeting_acknowledged) {
        if(grabbed_object) {
            if(e.deltaY < 0) {
                window.background_container.break_secondary_chains();
                zoom_object_in(grabbed_object);
            } else {
                window.background_container.break_secondary_chains();
                zoom_object_out(grabbed_object);
            }
            zoom_event = true;
            resize_move = true;
        }
    }
}

/** Toggle debug UI when 's' key is pressed */
function toggle_debug_ui(event) {
    // Toggle debug UI when 's' is pressed
    if (event.key === 's') {
        toggleDebugUI();
        console.log("Debug UI toggled:", FLAGS.DEBUG_UI);
        // Update label wireframes when debug UI is toggled
        if (FLAGS.DEBUG_UI && FLAGS.COLLISION_VISUAL_DEBUG) {
            updateLabelWireframes();
        }
    }
}

// Start initialization
init();