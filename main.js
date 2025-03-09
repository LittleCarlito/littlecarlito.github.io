// Import the global config first to ensure it's available to all modules
import { FLAGS, loadThree, loadRapier, THREE, RAPIER, updateTween } from './common';
import { BackgroundFloor } from './background/background_floor';
import { ViewableContainer } from './viewport/viewable_container';
import { BackgroundLighting } from './background/background_lighting';
import { extract_type, get_intersect_list, TEXTURE_LOADER, TYPES } from './viewport/overlay/overlay_common';
import { AppRenderer } from './common/app_renderer';
import { shove_object, translate_object, update_mouse_position, zoom_object_in, zoom_object_out, grab_object, release_object } from './background/background_common';
import { BackgroundContainer } from './background/background_container';
import { AssetStorage, AssetActivator, AssetSpawner } from 'asset-management';
import { toggleDebugUI, createDebugUI, setBackgroundContainer, setResolutionScale, updateLabelWireframes } from './common/debug_ui.js';

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
let hovered_interactable_name = "";
let grabbed_object = null;
let left_mouse_down = false;
let right_mouse_down = false;
let construction_acknowledged = !FLAGS.CONSTRUCTION_GREETING;
let asset_spawner;
let asset_activator;
let isCleanedUp = false; // Track if cleanup has been performed
let isPhysicsPaused = false; // Track if physics simulation is paused

/** Cleans up resources to prevent memory leaks */
function cleanup() {
    if (isCleanedUp) return; // Prevent multiple cleanups
    
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
    gravity = null;
    grabbed_object = null;
    
    isCleanedUp = true;
    
    if (FLAGS.PHYSICS_LOGS) {
        console.log("Application resources cleaned up");
    }
}

/** Updates the loading progress text */
function updateLoadingProgress(text) {
    const loadingProgress = document.getElementById('loading-progress');
    if (loadingProgress) {
        loadingProgress.textContent = text;
    }
}

/** Shows the loading screen */
async function showLoadingScreen() {
    const html = `
        <div id="loading-screen">
            <div class="loading-spinner"></div>
            <div id="loading-progress">Loading assets...</div>
        </div>
        <style>
            #loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #000000;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                color: white;
                font-family: Arial, sans-serif;
            }
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
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
        
        // Initialize asset storage and spawner early since they don't depend on UI
        const storage = AssetStorage.get_instance();
        
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
        // Physics optimization settings
        world.allowSleep = true;
        world.linearSleepThreshold = 0.2;
        world.angularSleepThreshold = 0.1;
        world.sleepThreshold = 0.1;
        world.maxVelocityIterations = 2;  // Reduced from 4
        world.maxVelocityFriction = 4;    // Reduced from 8
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
        updateLoadingProgress('Creating UI components...');
        viewable_container = new ViewableContainer(scene, world);
        // Make viewable_container available globally for debug UI
        window.viewable_container = viewable_container;
        
        // Renderer
        app_renderer = new AppRenderer(scene, viewable_container.get_camera());
        // Make renderer available globally for debug UI
        window.renderer = app_renderer.get_renderer();
        
        // Now initialize the asset activator after camera and renderer are created
        asset_activator = AssetActivator.get_instance(viewable_container.get_camera(), app_renderer.get_renderer());
        
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

        // Background creation
        updateLoadingProgress('Loading background assets...');
        const lighting = BackgroundLighting.getInstance(scene);
        background_container = new BackgroundContainer(scene, viewable_container.get_camera(), world);
        new BackgroundFloor(world, scene, viewable_container.get_camera());

        // Wait for all assets to be loaded
        updateLoadingProgress('Loading scene assets...');
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
        hideLoadingScreen();
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
    } catch (error) {
        console.error('Error during initialization:', error);
        updateLoadingProgress('Error loading application. Please refresh the page.');
    }
}

/** Toggle physics simulation pause state */
function togglePhysicsPause() {
    const wasPaused = isPhysicsPaused;
    isPhysicsPaused = !isPhysicsPaused;
    
    // Update the button style if it exists
    const pauseButton = document.getElementById('physics-pause-button');
    if (pauseButton) {
        // Update button color
        pauseButton.style.backgroundColor = isPhysicsPaused ? '#F9A825' : '#4CAF50'; // Yellow when paused, green when playing
        
        // Clear the button content
        pauseButton.innerHTML = '';
        
        // Recreate the icon container
        const iconSpan = document.createElement('span');
        iconSpan.style.display = 'inline-block';
        iconSpan.style.width = '18px';
        iconSpan.style.height = '12px';
        iconSpan.style.position = 'relative';
        iconSpan.style.marginRight = '5px';
        iconSpan.style.top = '1px';
        
        // Create the appropriate icon based on state
        if (isPhysicsPaused) {
            // Create play icon (triangle)
            const playIcon = document.createElement('span');
            playIcon.style.display = 'block';
            playIcon.style.width = '0';
            playIcon.style.height = '0';
            playIcon.style.borderTop = '6px solid transparent';
            playIcon.style.borderBottom = '6px solid transparent';
            playIcon.style.borderLeft = '12px solid white';
            playIcon.style.position = 'absolute';
            playIcon.style.left = '3px';
            playIcon.style.top = '0';
            iconSpan.appendChild(playIcon);
        } else {
            // Create pause icon (two bars)
            // First bar
            const bar1 = document.createElement('span');
            bar1.style.display = 'inline-block';
            bar1.style.width = '4px';
            bar1.style.height = '12px';
            bar1.style.backgroundColor = 'white';
            bar1.style.position = 'absolute';
            bar1.style.left = '3px';
            
            // Second bar
            const bar2 = document.createElement('span');
            bar2.style.display = 'inline-block';
            bar2.style.width = '4px';
            bar2.style.height = '12px';
            bar2.style.backgroundColor = 'white';
            bar2.style.position = 'absolute';
            bar2.style.right = '3px';
            
            iconSpan.appendChild(bar1);
            iconSpan.appendChild(bar2);
        }
        
        // Create text span
        const textSpan = document.createElement('span');
        textSpan.textContent = isPhysicsPaused ? 'Play Physics' : 'Pause Physics';
        
        // Append everything to the button
        pauseButton.appendChild(iconSpan);
        pauseButton.appendChild(textSpan);
    }
    
    // If newly paused, freeze all objects in place
    if (!wasPaused && isPhysicsPaused && AssetStorage.get_instance()) {
        // Get all dynamic bodies
        const dynamicBodies = AssetStorage.get_instance().get_all_dynamic_bodies();
        
        // Store current state and freeze bodies
        dynamicBodies.forEach(([mesh, body]) => {
            // Don't modify grabbed objects
            if (grabbed_object && mesh.uuid === grabbed_object.uuid) {
                return;
            }
            
            // Store current velocities
            const linvel = body.linvel();
            const angvel = body.angvel();
            
            // Also store whether the body was asleep
            mesh.userData.pausedState = {
                linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
                angvel: { x: angvel.x, y: angvel.y, z: angvel.z },
                wasAsleep: body.isSleeping(),
                originalPosition: { ...body.translation() }
            };
            
            // Effectively "freeze" the body by removing velocity and adding extreme damping
            if (body.bodyType() === RAPIER.RigidBodyType.Dynamic) {
                body.setGravityScale(0, true);
                body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                body.setAngvel({ x: 0, y: 0, z: 0 }, true);
                body.setLinearDamping(999, true);  // Very high damping
                body.setAngularDamping(999, true);
                body.sleep();  // Force sleep to save CPU
            }
        });
    }
    
    // If resuming physics, restore state of paused objects
    if (wasPaused && !isPhysicsPaused && AssetStorage.get_instance()) {
        // Get all dynamic bodies
        const dynamicBodies = AssetStorage.get_instance().get_all_dynamic_bodies();
        
        // Restore physics state for bodies that have stored paused state
        dynamicBodies.forEach(([mesh, body]) => {
            if (mesh.userData.pausedState) {
                // Restore gravity scale (typical value is 1.0)
                body.setGravityScale(1.0, true);
                
                // Reset damping to normal values
                body.setLinearDamping(0.2, true); // Normal damping
                body.setAngularDamping(0.7, true);
                
                // Check if position has changed during pause
                const currentPos = body.translation();
                const originalPos = mesh.userData.pausedState.originalPosition;
                const wasMovedDuringPause = 
                    mesh.userData.pausedState.wasMoved || // Check explicit flag
                    (originalPos && 
                    (Math.abs(currentPos.x - originalPos.x) > 0.001 || 
                     Math.abs(currentPos.y - originalPos.y) > 0.001 || 
                     Math.abs(currentPos.z - originalPos.z) > 0.001));
                
                // Apply stored velocity or impulse if available
                if (mesh.userData.pausedState.plannedImpulse) {
                    body.applyImpulse(mesh.userData.pausedState.plannedImpulse, true);
                    body.wakeUp(); // Always wake up objects with applied impulse
                } else if (mesh.userData.pausedState.linvel && !wasMovedDuringPause) {
                    // Only restore velocity if the object wasn't moved during pause
                    body.setLinvel(mesh.userData.pausedState.linvel, true);
                    
                    // Set angular velocity if available
                    if (mesh.userData.pausedState.angvel) {
                        body.setAngvel(mesh.userData.pausedState.angvel, true);
                    }
                    
                    // Wake up only if it wasn't asleep before OR if there's velocity
                    const hasVelocity = 
                        Math.abs(mesh.userData.pausedState.linvel.x) > 0.001 || 
                        Math.abs(mesh.userData.pausedState.linvel.y) > 0.001 || 
                        Math.abs(mesh.userData.pausedState.linvel.z) > 0.001;
                        
                    if (!mesh.userData.pausedState.wasAsleep || hasVelocity) {
                        body.wakeUp();
                    }
                } else {
                    // Always wake up objects that were moved during pause
                    // This ensures gravity will act on them
                    if (wasMovedDuringPause) {
                        // For objects moved during pause, ensure they're awake to be affected by gravity
                        body.wakeUp();
                        
                        // Apply a tiny impulse to ensure the physics engine recognizes it's not at rest
                        // This helps prevent the "floating objects" issue
                        body.applyImpulse({ x: 0, y: 0.001, z: 0 }, true);
                    }
                }
                
                // Clear the paused state
                delete mesh.userData.pausedState;
            }
        });
    }
    
    if (FLAGS.PHYSICS_LOGS) {
        console.log(`Physics simulation ${isPhysicsPaused ? 'paused' : 'resumed'}`);
    }
    
    // Make the state available to other modules
    window.isPhysicsPaused = isPhysicsPaused;
    
    return isPhysicsPaused;
}

// Make the function available globally for the debug UI
window.togglePhysicsPause = togglePhysicsPause;

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
    if (!window.previousTextContainerState && isTextActive && !isPhysicsPaused) {
        // Text container just became active, pause physics
        if (FLAGS.SELECT_LOGS) {
            console.log('Pausing physics due to text container activation');
        }
        window.textContainerPausedPhysics = true;
        togglePhysicsPause();
    } else if (window.previousTextContainerState && !isTextActive && isPhysicsPaused && window.textContainerPausedPhysics) {
        // Text container was active but is no longer active, restore physics
        if (FLAGS.SELECT_LOGS) {
            console.log('Resuming physics due to text container deactivation');
        }
        window.textContainerPausedPhysics = false;
        togglePhysicsPause();
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
    if (!isPhysicsPaused) {
        world.step();
    }
    
    // Always update menu animations and user interactions
    // These handle spawning and sign animations, even when physics is paused
    if (background_container) {
        background_container.update(grabbed_object, viewable_container);
    }
    
    // Update physics-dependent objects
    if (AssetStorage.get_instance()) {
        if (!isPhysicsPaused) {
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