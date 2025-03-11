// Import the global config first to ensure it's available to all modules
import { FLAGS, THREE, RAPIER, load_three, load_rapier, updateTween } from './common';
import { BackgroundFloor } from './background/background_floor';
import { ViewableContainer } from './viewport/viewable_container';
import { BackgroundLighting } from './background/background_lighting';
import { extract_type, get_intersect_list, TEXTURE_LOADER, TYPES } from './viewport/overlay/overlay_common';
import { AppRenderer } from './common';
import { shove_object, translate_object, update_mouse_position, zoom_object_in, zoom_object_out, grab_object, release_object } from './background/background_common';
import { BackgroundContainer } from './background/background_container';
import { AssetStorage, AssetActivator, AssetSpawner, ManifestManager } from 'blorkpack';
import { toggleDebugUI, createDebugUI, setBackgroundContainer, setResolutionScale, updateLabelWireframes } from './common/debug_ui.js';
import { BLORKPACK_FLAGS } from './packages/blorkpack/src/blorkpack_flags.js';

// ----- Variables
let resize_move = false;
let zoom_event = false;
let scene;
let world;
let clock;
let viewable_container;
let app_renderer;
let background_container;
let resize_timeout;
let hovered_interactable_name = "";
let grabbed_object = null;
let left_mouse_down = false;
let right_mouse_down = false;
let construction_acknowledged = false; // Will be set based on manifest
let asset_spawner;
let asset_activator;
let is_cleaned_up = false; // Track if cleanup has been performed
let is_physics_paused = false; // Track if physics simulation is paused

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
    if (app_renderer) {
        app_renderer.dispose();
        app_renderer = null;
    }
    // Cleanup asset systems
    if (asset_spawner) {
        asset_spawner.cleanup();
        asset_spawner = null;
    }
    // Force garbage collection on Three.js objects
    if (scene) {
        scene.traverse(object => {
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
        scene.clear();
        scene = null;
    }
    // Release Rapier physics world
    if (world) {
        world = null;
    }
    // Clear other references
    viewable_container = null;
    background_container = null;
    clock = null;
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
        const manifest_manager = ManifestManager.get_instance();
        await manifest_manager.load_manifest('resources/manifest.json');
        // Get construction_greeting from manifest, default to false if not present
        const scene_data = manifest_manager.get_scene_data();
        construction_acknowledged = !(scene_data && scene_data.construction_greeting === true);
        if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
            console.log("Manifest loaded:", manifest_manager.get_manifest());
        }
        // Apply scene settings from manifest
        // ----- Setup
        scene = new THREE.Scene();
        // Set background based on manifest settings
        const bg = manifest_manager.get_background_config();
        switch (bg.type) {
            case 'IMAGE':
                scene.background = TEXTURE_LOADER.load(bg.image_path);
                break;
            case 'COLOR':
                scene.background = new THREE.Color(bg.color_value);
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
                scene.background = new THREE.Color('0x000000');
        }
        
        window.addEventListener('resize', handle_resize);
        window.addEventListener('mousemove', handle_mouse_move);
        window.addEventListener('mousedown', handle_mouse_down);
        window.addEventListener('mouseup', handle_mouse_up);
        window.addEventListener('contextmenu', handle_context_menu);
        window.addEventListener('wheel', handle_wheel);

        // Physics - Get gravity from manifest manager
        if (!manifest_manager.is_manifest_loaded()) {
            console.warn("Manifest not loaded yet, using default gravity");
        }
        const gravityData = manifest_manager.get_gravity();
        if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
            console.log("Using gravity:", gravityData);
        }
        
        world = new RAPIER.World(gravityData);
        // Physics optimization settings
        world.allowSleep = true;
        world.linearSleepThreshold = 0.2;
        world.angularSleepThreshold = 0.1;
        world.sleepThreshold = 0.1;
        world.maxVelocityIterations = 2;
        world.maxVelocityFriction = 4;
        world.integrationParameters.dt = 1/60;  // Fixed timestep
        world.integrationParameters.erp = 0.8;  // Error reduction parameter
        world.integrationParameters.warmstartCoeff = 0.8;
        world.integrationParameters.allowedLinearError = 0.001;
        clock = new THREE.Clock();

        // Now initialize the asset spawner after world is created
        asset_spawner = AssetSpawner.get_instance(scene, world);
        // Make asset_spawner available globally for debug UI
        window.asset_spawner = asset_spawner;
        
        // UI creation
        update_loading_progress('Creating UI components...');
        viewable_container = new ViewableContainer(scene, world);
        // Make viewable_container available globally for debug UI
        window.viewable_container = viewable_container;
        
        // Renderer
        app_renderer = new AppRenderer(scene, viewable_container.get_camera());
        // Make renderer available globally for debug UI
        window.renderer = app_renderer.get_renderer();
        
        // Now initialize the asset activator after camera and renderer are created
        asset_activator = AssetActivator.get_instance(viewable_container.get_camera(), app_renderer.get_renderer());
        
        // Show construction greeting if enabled in manifest
        if(scene_data && scene_data.construction_greeting === true) {
            // Load the under construction modal from the external file
            fetch('pages/under_construction.html')
                .then(response => response.text())
                .then(html => {
                    document.body.insertAdjacentHTML('beforeend', html);
                    const modal = document.getElementById('construction-modal');
                    modal.style.display = 'block';
                    
                    document.getElementById('acknowledge-btn').addEventListener('click', () => {
                        modal.style.display = 'none';
                        construction_acknowledged = true;
                    });
                })
                .catch(error => {
                    console.error('Error loading construction message:', error);
                });
        }

        // Background creation
        update_loading_progress('Loading background assets...');
        const lighting = BackgroundLighting.getInstance(scene);
        background_container = new BackgroundContainer(scene, viewable_container.get_camera(), world);
        new BackgroundFloor(world, scene, viewable_container.get_camera());

        // Wait for all assets to be loaded
        update_loading_progress('Loading scene assets...');
        await new Promise(async (resolve) => {
            const checkAssetsLoaded = async () => {
                const isComplete = await background_container.is_loading_complete();
                if (isComplete) {
                    if (FLAGS.ASSET_LOGS) {
                        console.log('All assets loaded:', Array.from(background_container.get_asset_manifest()));
                    }
                    resolve();
                } else {
                    if (FLAGS.ASSET_LOGS) {
                        console.log('Waiting for assets to complete loading...');
                    }
                    setTimeout(checkAssetsLoaded, 100);
                }
            };
            await checkAssetsLoaded();
        });

        // Hide loading screen and start animation
        hide_loading_screen();
        app_renderer.set_animation_loop(animate);
        
        // Initialize debug UI (hidden by default)
        createDebugUI();
        // Set background container reference for debug UI
        setBackgroundContainer(background_container);
        // Initialize resolution scale based on device capabilities
        if (FLAGS.AUTO_THROTTLE) {
            // Start with a resolution scale based on device pixel ratio
            // Higher pixel ratio devices (like Retina displays) get a lower initial scale
            // to maintain performance
            const initialScale = window.devicePixelRatio > 1 ? 0.75 : 1.0;
            setResolutionScale(initialScale);
            console.log(`Initial resolution scale set to ${initialScale.toFixed(2)} based on device pixel ratio ${window.devicePixelRatio}`);
        }
        console.log("Debug UI initialized. Press 's' to toggle.");
        
        // Ensure label wireframes are updated if debug visualization is enabled
        if (FLAGS.COLLISION_VISUAL_DEBUG && viewable_container && viewable_container.get_overlay()) {
            const labelContainer = viewable_container.get_overlay().label_container;
            if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
                console.log('Directly updating label wireframes after initialization');
                labelContainer.updateDebugVisualizations();
            }
        }
        
        // Add keyboard event listener for debug UI toggle
        window.addEventListener('keydown', toggle_debug_ui);
        // Add unload event to clean up resources
        window.addEventListener('unload', cleanup);

        // Load and spawn assets defined in the manifest
        update_loading_progress("Loading assets from manifest...");
        const asset_groups = manifest_manager.get_all_asset_groups();
        if (asset_groups) {
            // Find active asset groups
            const active_groups = asset_groups.filter(group => group.active);
            
            for (const group of active_groups) {
                update_loading_progress(`Loading asset group: ${group.name}...`);
                
                for (const asset_id of group.assets) {
                    const asset_data = manifest_manager.get_asset(asset_id);
                    if (asset_data) {
                        // Use the asset type to determine how to load and spawn
                        const asset_type = asset_data.asset_type;
                        const custom_type = manifest_manager.get_custom_type(asset_type);
                        
                        if (custom_type) {
                            // Get asset path from custom type
                            const asset_path = custom_type.paths?.asset;
                            
                            // Load the asset type if needed
                            // ... load asset code
                            
                            // Position and rotation from asset data
                            const position = new THREE.Vector3(
                                asset_data.position.x || 0, 
                                asset_data.position.y || 0, 
                                asset_data.position.z || 0
                            );
                            
                            const rotation = new THREE.Euler(
                                asset_data.rotation.x || 0,
                                asset_data.rotation.y || 0,
                                asset_data.rotation.z || 0
                            );
                            
                            const quaternion = new THREE.Quaternion().setFromEuler(rotation);
                            
                            // Spawn the asset
                            // const { mesh, body } = await asset_spawner.spawn_asset(...);
                            
                            // Additional properties like materials, etc.
                            // ... apply properties code
                        }
                    }
                }
            }
        }
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
    const delta = clock.getDelta();
    
    // Handle tweens and UI animations (always run regardless of physics pause)
    updateTween();
    
    if(resize_move) {
        if(!zoom_event) {
            viewable_container.resize_reposition();
        } else {
            zoom_event = false;
        }
        resize_move = false;
    }
    
    // Check if a text container is active, and pause physics if needed
    const isTextActive = viewable_container.is_text_active();
    
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
    if(viewable_container.get_overlay().is_intersected() != null) {
        asset_activator.activate_object(viewable_container.get_intersected_name());
    } else if(grabbed_object) {
        translate_object(grabbed_object, viewable_container.get_camera());
    } else if(hovered_interactable_name != "" && viewable_container.is_overlay_hidden()) {
        // Only activate hovered objects when the overlay is hidden
        asset_activator.activate_object(hovered_interactable_name);
    } else if(viewable_container.is_text_active()) {
        asset_activator.activate_object(viewable_container.get_active_name());
    } else {
        asset_activator.deactivate_all_objects();
    }
    
    // Process physics simulation (can be paused)
    world.timestep = Math.min(delta, 0.1);
    if (!is_physics_paused) {
        world.step();
    }
    
    // Always update menu animations and user interactions
    // These handle spawning and sign animations, even when physics is paused
    if (background_container) {
        background_container.update(grabbed_object, viewable_container);
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
    viewable_container.get_overlay().update_confetti();
    
    // Ensure regular cleanup of unused resources
    if (asset_spawner) {
        asset_spawner.performCleanup();
    }
    
    // Render the scene
    app_renderer.render();
}

// ----- Handlers

/** Handles resize events */
function handle_resize() {
    if (resize_timeout) clearTimeout(resize_timeout);
    
    resize_timeout = setTimeout(() => {
        if (app_renderer) app_renderer.handle_resize();
        if (viewable_container) viewable_container.handle_resize();
    }, 100);
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
        
        // Check if UI overlay is visible
        const is_overlay_hidden = viewable_container.is_overlay_hidden();
        
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
        
        if(relevant_intersections.length > 0 && !viewable_container.get_overlay().is_swapping_sides()) {
            const intersected_object = relevant_intersections[0].object;
            const object_name = intersected_object.name;
            const name_type = object_name.split("_")[0] + "_";
            
            // Handle label hover - now we know it's either a label or an appropriate object
            switch(name_type) {
                case TYPES.LABEL:
                    viewable_container.get_overlay().handle_hover(intersected_object);
                    break;
                case TYPES.FLOOR:
                    // We know overlay is hidden if we get here, due to the filtering above
                    viewable_container.get_overlay().reset_hover();
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
                    viewable_container.get_overlay().reset_hover();
                    break;
            }
        } else {
            viewable_container.get_overlay().reset_hover();
            
            // Only reset hovered_interactable_name if the overlay is hidden
            // This prevents background objects from losing hover state when UI is open
            if (is_overlay_hidden) {
                hovered_interactable_name = "";
            }
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