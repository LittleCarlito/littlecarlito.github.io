// @ts-nocheck
// Import the global config first to ensure it's available to all modules
import { FLAGS, THREE, RAPIER, initThree, updateTween, initRapier } from './common/index.js';
import { ViewableContainer } from './viewport/viewable_container.js';
import { BackgroundContainer } from './background/background_container.js';
import { SceneSetupHelper } from './background/scene_setup_helper.js';
import { extract_type, get_intersect_list, TEXTURE_LOADER, TYPES } from './viewport/overlay/overlay_common/index.js';
import { AppRenderer } from './common/index.js';
import { AssetStorage, AssetActivator, AssetHandler, ManifestManager, BLORKPACK_FLAGS, CustomTypeManager, 
	shove_object, translate_object, update_mouse_position, zoom_object_in, zoom_object_out, 
	grab_object, release_object, initPhysicsUtil, 
	resolvePath} from '@littlecarlito/blorkpack';
import { toggleDebugUI, createDebugUI as create_debug_UI, setBackgroundContainer as set_background_container, setResolutionScale as set_resolution_scale, updateLabelWireframes, setSceneReference } from './common/debug_ui.js';

// Enable HMR for development
if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.accept(['@littlecarlito/blorkpack'], (updatedModules) => {
		console.log('HMR update detected for blorkpack dependencies:', updatedModules);
		AssetHandler.dispose_instance();
		if (window.scene && window.physicsWorld) {
			AssetHandler.get_instance(window.scene, window.physicsWorld);
		}
	});
}

// ----- Variables
let resize_move = false;
let zoom_event = false;
let resize_timeout;
let hovered_interactable_name = "";
let grabbed_object = null;
let left_mouse_down = false;
let right_mouse_down = false;
let is_cleaned_up = false;
let is_physics_paused = false;
let greeting_acknowledged = false;

/** Cleans up resources to prevent memory leaks */
function cleanup() {
	if (is_cleaned_up) {
		if(BLORKPACK_FLAGS.DEBUG_LOGS) {
			console.debug("Scene already clean; Skipping cleanup");
		}
		return;
	}
	window.removeEventListener('resize', handle_resize);
	window.removeEventListener('mousemove', handle_mouse_move);
	window.removeEventListener('mousedown', handle_mouse_down);
	window.removeEventListener('mouseup', handle_mouse_up);
	window.removeEventListener('contextmenu', handle_context_menu);
	window.removeEventListener('wheel', handle_wheel);
	window.removeEventListener('keydown', toggle_debug_ui);
	if (window.app_renderer) {
		window.app_renderer.dispose();
		window.app_renderer = null;
	}
	if (window.asset_handler) {
		window.asset_handler.cleanup();
		window.asset_handler.cleanup_debug();
		window.asset_handler = null;
	}
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
		SceneSetupHelper.dispose_background(window.scene);
		SceneSetupHelper.dispose_lighting(window.scene);
		window.scene.clear();
		window.scene = null;
	}
	if (window.world) {
		window.world = null;
	}
	window.viewable_container = null;
	window.background_container = null;
	window.clock = null;
	grabbed_object = null;
	is_cleaned_up = true;
	if (BLORKPACK_FLAGS.DEBUG_LOGS) {
		console.log("Application resources cleaned up");
	}
}

/** Creates and configures scene background based on manifest settings */
async function setup_scene_background() {
	await SceneSetupHelper.setup_background(window.scene, window.manifest_manager, update_loading_progress);
}

/** Initializes scene lighting based on manifest configuration */
async function setup_scene_lighting() {
	await SceneSetupHelper.setup_lighting(window.scene, window.manifest_manager, update_loading_progress);
}

/** Initializes physics world with manifest settings */
function setup_physics_world() {
	const gravityData = window.manifest_manager.get_gravity();
	if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
		console.log("Using gravity:", gravityData);
	}
	
	try {
		window.world = new RAPIER.World();
		window.world.gravity = new RAPIER.Vector3(gravityData.x, gravityData.y, gravityData.z);
	} catch (error) {
		console.error("Failed to initialize Rapier world:", error);
		throw new Error("Rapier initialization failed. Make sure to call initRapier() first.");
	}
	
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
	const loadingPagePath = resolvePath('pages/loading.html');
	const response = await fetch(loadingPagePath);
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
		const resolvedPath = resolvePath(modal_path);
		const response = await fetch(resolvedPath);
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
		
		update_loading_progress('Loading Three.js...');
		await initThree();
		
		update_loading_progress('Loading Rapier Physics...');
		await initRapier();
		
		update_loading_progress('Initializing physics utilities...');
		await initPhysicsUtil();
		
		update_loading_progress('Loading custom asset types...');
		const customTypesPath = resolvePath('custom_types.json');
		await CustomTypeManager.loadCustomTypes(customTypesPath);
		
		update_loading_progress('Initializing scene...');
		AssetStorage.get_instance();
		
		update_loading_progress("Loading manifest...");
		window.manifest_manager = ManifestManager.get_instance();
		await window.manifest_manager.load_manifest();
		
		const greeting_data = window.manifest_manager.get_greeting_data();
		greeting_acknowledged = !(greeting_data && greeting_data.display === true);
		if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
			console.log("Manifest loaded:", window.manifest_manager.get_manifest());
		}
		
		window.addEventListener('resize', handle_resize);
		window.addEventListener('mousemove', handle_mouse_move);
		window.addEventListener('mousedown', handle_mouse_down);
		window.addEventListener('mouseup', handle_mouse_up);
		window.addEventListener('contextmenu', handle_context_menu);
		window.addEventListener('wheel', handle_wheel);
		window.addEventListener('keydown', toggle_debug_ui);
		window.addEventListener('unload', cleanup);
		
		window.scene = new THREE.Scene();
		setSceneReference(window.scene);
		
		update_loading_progress('Setting up scene background...');
		await setup_scene_background();
		
		update_loading_progress('Initializing physics world...');
		setup_physics_world();
		
		window.asset_handler = AssetHandler.get_instance(window.scene, window.world);
		window.clock = new THREE.Clock();
		
		update_loading_progress('Creating UI components...');
		await setup_scene_lighting();
		
		window.viewable_container = new ViewableContainer(window);
		window.app_renderer = new AppRenderer(window.scene, window.viewable_container.get_camera());
		window.renderer = window.app_renderer.get_renderer();
		window.asset_activator = AssetActivator.get_instance(window.viewable_container.get_camera(), window.app_renderer.get_renderer());
		
		if(greeting_data.display === true) {
			await display_modal(
				greeting_data.modal_path,
				'greeting-modal',
				'acknowledge-btn',
				() => { greeting_acknowledged = true; }
			);
		}
		
		update_loading_progress('Loading background assets...');
		window.background_container = new BackgroundContainer(window.scene, window.viewable_container.get_camera(), window.world);
		
		update_loading_progress('Loading assets...');
		const spawned_assets = await window.asset_handler.spawn_manifest_assets(window.manifest_manager, update_loading_progress);
		if (BLORKPACK_FLAGS.ASSET_LOGS) {
			console.log('Loaded assets:', spawned_assets);
		}
		
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
		
		hide_loading_screen();
		window.app_renderer.set_animation_loop(animate);
		
		create_debug_UI();
		set_background_container(window.background_container);
		
		if (window.manifest_manager.get_auto_throttle()) {
			const initialScale = window.devicePixelRatio > 1 ? 0.75 : 1.0;
			set_resolution_scale(initialScale);
			console.log(`Initial resolution scale set to ${initialScale.toFixed(2)} based on device pixel ratio ${window.devicePixelRatio}`);
		}
		
		if (window.viewable_container && window.viewable_container.get_overlay()) {
			const labelContainer = window.viewable_container.get_overlay().label_container;
			if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
				console.log('Directly updating label wireframes after initialization');
				labelContainer.updateDebugVisualizations();
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
	if (FLAGS.DEBUG_UI) {
		const pause_button = document.getElementById('pause-physics-btn');
		if (pause_button) {
			pause_button.textContent = is_physics_paused ? 'Resume Physics' : 'Pause Physics';
		}
	}
}

window.toggle_physics_pause = toggle_physics_pause;

/** Primary animation function run every frame by renderer */
function animate() {
	const delta = window.clock.getDelta();
	updateTween();
	if(resize_move) {
		if(!zoom_event) {
			window.viewable_container.resize_reposition();
		} else {
			zoom_event = false;
		}
		resize_move = false;
	}
	const isTextActive = window.viewable_container.is_text_active();
	if (!window.previousTextContainerState && isTextActive && !is_physics_paused) {
		if (FLAGS.SELECT_LOGS) {
			console.log('Pausing physics due to text container activation');
		}
		window.textContainerPausedPhysics = true;
		toggle_physics_pause();
	} else if (window.previousTextContainerState && !isTextActive && is_physics_paused && window.textContainerPausedPhysics) {
		if (FLAGS.SELECT_LOGS) {
			console.log('Resuming physics due to text container deactivation');
		}
		window.textContainerPausedPhysics = false;
		toggle_physics_pause();
	}
	window.previousTextContainerState = isTextActive;
	if(window.viewable_container.get_overlay().is_intersected() != null) {
		window.asset_activator.activate_object(window.viewable_container.get_intersected_name());
	} else if(grabbed_object) {
		translate_object(grabbed_object, window.viewable_container.get_camera());
	} else if(hovered_interactable_name != "" && window.viewable_container.is_overlay_hidden()) {
		window.asset_activator.activate_object(hovered_interactable_name);
	} else if(window.viewable_container.is_text_active()) {
		window.asset_activator.activate_object(window.viewable_container.get_active_name());
	} else {
		window.asset_activator.deactivate_all_objects();
	}
	window.world.timestep = Math.min(delta, 0.1);
	if (!is_physics_paused) {
		window.world.step();
	}
	if (window.background_container) {
		window.background_container.update(grabbed_object, window.viewable_container);
	}
	if (AssetStorage.get_instance()) {
		if (!is_physics_paused) {
			AssetStorage.get_instance().update();
		} else if (grabbed_object) {
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
	window.viewable_container.get_overlay().update_confetti();
	if (window.asset_handler) {
		window.asset_handler.update_visualizations();
		if (window.asset_handler.update_debug_meshes) {
			window.asset_handler.update_debug_meshes();
		}
	}
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

/**
 *
 */
function handle_mouse_move(e) {
	if (!window.viewable_container) return;
	update_mouse_position(e);
	if(window.viewable_container.detect_rotation) {
		const sensitivity = 0.02;
		window.viewable_container.get_camera_manager().rotate(
			e.movementX * sensitivity,
			e.movementY * sensitivity
		);
	}
	if(greeting_acknowledged) {
		if(window.viewable_container.is_animating()) {
			return;
		}
		const found_intersections = get_intersect_list(e, window.viewable_container.get_camera(), window.scene);
		const is_overlay_hidden = window.viewable_container.is_overlay_hidden();
		let relevant_intersections = found_intersections;
		if(!is_overlay_hidden) {
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
			switch(name_type) {
			case TYPES.LABEL:
				window.viewable_container.get_overlay().handle_hover(intersected_object);
				break;
			case TYPES.FLOOR:
				window.viewable_container.get_overlay().reset_hover();
				break;
			case TYPES.INTERACTABLE:
				hovered_interactable_name = object_name;
				if (FLAGS.ACTIVATE_LOGS) {
					console.log("Hover detected on interactable:", object_name);
				}
				break;
			default:
				window.viewable_container.get_overlay().reset_hover();
				break;
			}
		} else {
			window.viewable_container.get_overlay().reset_hover();
			if (is_overlay_hidden) {
				hovered_interactable_name = "";
			}
		}
	}
}

/**
 *
 */
function handle_mouse_up(e) {
	if (!window.viewable_container) return;
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

/**
 *
 */
function handle_mouse_down(e) {
	if (!window.viewable_container) return;
	if(greeting_acknowledged) {
		if(e.button === 0) {
			left_mouse_down = true;
		}
		if(e.button === 2) {
			right_mouse_down = true;
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

/**
 *
 */
function handle_context_menu(e) {
	e.preventDefault();
}

/**
 *
 */
function handle_wheel(e) {
	if (!window.viewable_container || !window.background_container) return;
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
	if (event.key === 's') {
		toggleDebugUI();
		console.log("Debug UI toggled:", FLAGS.DEBUG_UI);
		if (FLAGS.DEBUG_UI && FLAGS.COLLISION_VISUAL_DEBUG) {
			updateLabelWireframes();
		}
	}
}

init();