import { FLAGS, THREE, RAPIER, initThree, updateTween, initRapier } from './common/index.js';
import { ViewableContainer } from './viewport/viewable_container.js';
import { BackgroundContainer } from './background/background_container.js';
import { SceneSetupHelper } from './background/scene_setup_helper.js';
import { extract_type, get_intersect_list, TYPES } from './viewport/overlay/overlay_common/index.js';
import { AppRenderer } from './common/index.js';
import { 
	AssetStorage, 
	AssetHandler, 
	ManifestManager, 
	BLORKPACK_FLAGS, 
	CustomTypeManager, 
	shove_object, 
	translate_object, 
	update_mouse_position, 
	zoom_object_in, 
	zoom_object_out, 
	grab_object, 
	release_object, 
	initPhysicsUtil,
	InteractionManager,
	MemoryAnalyzer
	} from '@littlecarlito/blorkpack';
import { 
	toggleDebugUI, 
	createDebugUI as create_debug_UI, 
	setBackgroundContainer as set_background_container,
	setResolutionScale as set_resolution_scale, 
	updateLabelWireframes, setSceneReference 
} from './common/debug_ui.js';

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

let tempVector3;
let tempQuaternion;
let tempEuler;
let tempMatrix4;
let tempVector3_2;
let tempVector3_3;
let is_cleaned_up = false;
let is_physics_paused = false;
let interactionManager = null;
let memoryAnalyzer = null;
let isPageVisible = !document.hidden;
let backgroundAnimationFrameId = null;
let lastFrameTime = 0;
let frameCount = 0;
let performanceTracking = {
	enabled: false,
	times: {}
};
let diagnosticInfo = {
	stage: 'INIT',
	device: 'UNKNOWN',
	errors: []
};

function updateDiagnostic(stage, error = null) {
	diagnosticInfo.stage = stage;
	if (error) {
		diagnosticInfo.errors.push(error);
		console.error(`DIAGNOSTIC: ${stage} - ${error}`);
	} else {
		console.log(`DIAGNOSTIC: ${stage}`);
	}
	update_loading_progress(`${stage}${error ? ` - ${error}` : ''}`);
}

function showDiagnosticError(code) {
	const loadingScreen = document.getElementById('loading-screen');
	if (loadingScreen) {
		loadingScreen.innerHTML = `
			<div class="loading-content">
				<h1 class="loading-title">ERROR ${code}</h1>
				<div class="loading-progress-text">
					DEVICE: ${diagnosticInfo.device}<br>
					STAGE: ${diagnosticInfo.stage}<br>
					ERRORS: ${diagnosticInfo.errors.join(', ') || 'NONE'}<br><br>
					<button onclick="location.reload()" style="
						background: #e74c3c; 
						color: white; 
						border: none; 
						padding: 10px 20px; 
						border-radius: 5px; 
						cursor: pointer; 
						font-family: monospace;
						font-size: 16px;
					">RETRY</button>
				</div>
			</div>
		`;
	}
}

function initializeTempObjects() {
	tempVector3 = new THREE.Vector3();
	tempQuaternion = new THREE.Quaternion();
	tempEuler = new THREE.Euler();
	tempMatrix4 = new THREE.Matrix4();
	tempVector3_2 = new THREE.Vector3();
	tempVector3_3 = new THREE.Vector3();
}

async function setup_scene_background() {
	await SceneSetupHelper.setup_background(window.scene, window.manifest_manager, update_loading_progress);
}

async function setup_scene_lighting() {
	await SceneSetupHelper.setup_lighting(window.scene, window.manifest_manager, update_loading_progress);
}

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

function update_loading_progress(text) {
	const loading_progress = document.getElementById('loading-progress');
	if (loading_progress) {
		loading_progress.textContent = text;
	}
}

async function show_loading_screen() {
	const loadingPagePath = 'pages/loading.html'
	const response = await fetch(loadingPagePath);
	const html = await response.text();
	document.body.insertAdjacentHTML('beforeend', html);
}

function hide_loading_screen() {
	const loading_screen = document.getElementById('loading-screen');
	if (loading_screen) {
		loading_screen.remove();
	}
}

function handleVisibilityChange() {
	const wasVisible = isPageVisible;
	isPageVisible = !document.hidden;
	
	if (wasVisible !== isPageVisible) {
		if (isPageVisible) {
			console.log('🔄 Page visible - resuming full animation');
			if (backgroundAnimationFrameId) {
				cancelAnimationFrame(backgroundAnimationFrameId);
				backgroundAnimationFrameId = null;
			}
			window.app_renderer.set_animation_loop(animate);
		} else {
			console.log('🛑 Page hidden - switching to background mode');
			window.app_renderer.set_animation_loop(null);
			startBackgroundAnimation();
		}
	}
}

function startBackgroundAnimation() {
	function animateBackground() {
		if (!isPageVisible) {
			const delta = window.clock.getDelta();
			updateTween();
			
			if(interactionManager.resize_move) {
				if(!interactionManager.zoom_event) {
					window.viewable_container.resize_reposition();
				} else {
					interactionManager.zoom_event = false;
				}
				interactionManager.resize_move = false;
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
			
			if(interactionManager.grabbed_object) {
				translate_object(interactionManager.grabbed_object, window.viewable_container.get_camera());
			}
			
			window.world.timestep = Math.min(delta, 0.1);
			if (!is_physics_paused) {
				window.world.step();
			}
			
			if (window.background_container) {
				window.background_container.update(interactionManager.grabbed_object, window.viewable_container, delta);
			}
			
			if (window.asset_handler) {
				window.asset_handler.updateAnimations(delta);
			}
			
			if (AssetStorage.get_instance()) {
				if (!is_physics_paused) {
					AssetStorage.get_instance().update();
				} else if (interactionManager.grabbed_object) {
					const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(interactionManager.grabbed_object);
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
				window.asset_handler.updateRigVisualizations();
				window.asset_handler.update_visualizations();
				if (window.asset_handler.update_debug_meshes) {
					window.asset_handler.update_debug_meshes();
				}
			}
			
			if (window.css3dFactory) {
				window.css3dFactory.update();
			}
			
			if (Math.random() < 0.1) {
				window.app_renderer.render();
			}
			
			backgroundAnimationFrameId = requestAnimationFrame(animateBackground);
		}
	}
	
	backgroundAnimationFrameId = requestAnimationFrame(animateBackground);
}

async function loadCoreSystemsParallel() {
	const corePromises = [
		initThree().then(() => {
			initializeTempObjects();
			return 'Three.js initialized';
		}),
		initRapier().then(() => 'Rapier initialized'),
		initPhysicsUtil().then(() => 'Physics utilities initialized'),
		CustomTypeManager.loadCustomTypes('custom_types.json').then(() => 'Custom types loaded')
	];
	
	const results = await Promise.all(corePromises);
	results.forEach(result => update_loading_progress(result));
}

async function loadManifestAndSetupScene() {
	window.manifest_manager = ManifestManager.get_instance();
	await window.manifest_manager.load_manifest();
	
	if(BLORKPACK_FLAGS.MANIFEST_LOGS) {
		console.log("Manifest loaded:", window.manifest_manager.get_manifest());
	}
	
	window.scene = new THREE.Scene();
	setSceneReference(window.scene);
	setup_physics_world();
	window.asset_handler = AssetHandler.get_instance(window.scene, window.world);
	window.clock = new THREE.Clock();
}

async function loadAssetsParallel() {
	update_loading_progress('Loading assets in parallel...');
	
	const assetPromises = [
		setup_scene_background(),
		setup_scene_lighting(),
		window.asset_handler.spawn_manifest_assets(window.manifest_manager, (text) => {
			console.log('Manifest assets:', text);
		})
	];
	
	const [backgroundResult, lightingResult, manifestAssets] = await Promise.all(assetPromises);
	
	if (BLORKPACK_FLAGS.ASSET_LOGS) {
		console.log('Loaded assets:', manifestAssets);
	}
	
	return manifestAssets;
}

async function waitForBackgroundAssetsOptimized() {
	update_loading_progress('Finalizing scene assets...');
	
	return new Promise(async (resolve) => {
		const checkAssetsLoaded = async () => {
			const isComplete = await window.background_container.is_loading_complete();
			if (isComplete) {
				if (BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log('All assets loaded:', Array.from(window.background_container.get_asset_manifest()));
				}
				resolve();
			} else {
				setTimeout(checkAssetsLoaded, 50);
			}
		};
		await checkAssetsLoaded();
	});
}

async function init() {
	interactionManager = InteractionManager.getInstance();
	memoryAnalyzer = new MemoryAnalyzer();
	
	try {
		await show_loading_screen();
		
		const ua = navigator.userAgent;
		if (/iPad|iPhone|iPod/.test(ua)) {
			diagnosticInfo.device = 'IOS';
			if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
				diagnosticInfo.device = 'IOS_SAFARI';
			}
		} else if (/Android/.test(ua)) {
			diagnosticInfo.device = 'ANDROID';
		} else {
			diagnosticInfo.device = 'DESKTOP';
		}
		
		updateDiagnostic('DEVICE_DETECTED');
		
		const loadingTimeout = setTimeout(() => {
			updateDiagnostic('TIMEOUT', 'LOADING_STUCK');
			showDiagnosticError('T1');
		}, 25000);
		
		window.addEventListener('error', (event) => {
			updateDiagnostic('JS_ERROR', event.message.substring(0, 20));
			showDiagnosticError('E1');
		});
		
		updateDiagnostic('CORE_LOADING');
		await loadCoreSystemsParallel();
		updateDiagnostic('CORE_LOADED');
		
		updateDiagnostic('MANIFEST_LOADING');
		await loadManifestAndSetupScene();
		updateDiagnostic('MANIFEST_LOADED');
		
		AssetStorage.get_instance();
		
		const customTypeManager = CustomTypeManager.getInstance();
		if (!customTypeManager.hasLoadedCustomTypes()) {
			console.warn('Custom types not yet available, waiting...');
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		
		update_loading_progress('Creating UI components...');
		window.viewable_container = new ViewableContainer(window);
		window.app_renderer = new AppRenderer(window.scene, window.viewable_container.get_camera());
		window.renderer = window.app_renderer.get_renderer();
		
		const setupPromises = [
			interactionManager.startListening(window),
			(async () => {
				window.background_container = new BackgroundContainer(window.scene, window.viewable_container.get_camera(), window.world);
				return 'Background container created';
			})()
		];
		
		await Promise.all(setupPromises);
		
		updateDiagnostic('ASSETS_LOADING');
		await loadAssetsParallel();
		updateDiagnostic('ASSETS_LOADED');
		
		updateDiagnostic('BG_ASSETS_LOADING');
		await waitForBackgroundAssetsOptimized();
		updateDiagnostic('BG_ASSETS_LOADED');
		
		if (diagnosticInfo.device.startsWith('IOS')) {
			try {
				if (window.devicePixelRatio > 2) {
					set_resolution_scale(0.5);
					updateDiagnostic('IOS_LOW_RES');
				}
				
				const canvas = window.app_renderer?.get_renderer()?.domElement;
				if (canvas) {
					canvas.addEventListener('webglcontextlost', (event) => {
						event.preventDefault();
						updateDiagnostic('WEBGL_LOST');
						showDiagnosticError('W1');
					});
				}
			} catch (e) {
				updateDiagnostic('IOS_FALLBACK_ERROR', e.message.substring(0, 15));
				showDiagnosticError('I1');
			}
		}
		
		clearTimeout(loadingTimeout);
		updateDiagnostic('SUCCESS');
		hide_loading_screen();
		
		window.addEventListener('keydown', toggle_debug_ui);
		window.addEventListener('unload', cleanup);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		memoryAnalyzer.initialize();
		window.memoryAnalyzer = memoryAnalyzer;
		
		if (window.css3dFactory) {
			window.css3dFactory.setExternalAnimationLoop(true);
			console.log('✅ CSS3D Factory configured for external animation loop');
		}
		
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
		
		window.checkMemory = () => memoryAnalyzer.forceAnalysis();
		window.getMemoryUsage = () => memoryAnalyzer.getCurrentMemoryUsage();
		
		console.log('🔧 Memory analysis tools available:');
		console.log('  - window.checkMemory() - Force memory analysis');
		console.log('  - window.getMemoryUsage() - Get current memory stats');
		
	} catch (error) {
		console.error('Error during initialization:', error);
		updateDiagnostic('INIT_ERROR', error.message.substring(0, 20));
		showDiagnosticError('E2');
	}
}

function cleanup() {
	if (is_cleaned_up) {
		if(BLORKPACK_FLAGS.DEBUG_LOGS) {
			console.debug("Scene already clean; Skipping cleanup");
		}
		return;
	}
	
	if (backgroundAnimationFrameId) {
		cancelAnimationFrame(backgroundAnimationFrameId);
		backgroundAnimationFrameId = null;
	}
	
	interactionManager.stopListening();
	window.removeEventListener('keydown', toggle_debug_ui);
	window.removeEventListener('unload', cleanup);
	document.removeEventListener('visibilitychange', handleVisibilityChange);
	
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
	if (window.css3dFactory) {
		window.css3dFactory.dispose();
		window.css3dFactory = null;
	}
	window.viewable_container = null;
	window.background_container = null;
	window.clock = null;
	memoryAnalyzer = null;
	is_cleaned_up = true;
	if (BLORKPACK_FLAGS.DEBUG_LOGS) {
		console.log("Application resources cleaned up");
	}
}

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

function animate() {
	frameCount++;
	const currentTime = performance.now();
	
	const shouldTrackPerformance = FLAGS.PERFORMANCE_LOGS || (currentTime - lastFrameTime > 20);
	
	if (shouldTrackPerformance) {
		performanceTracking.enabled = true;
		performanceTracking.times.animateStart = currentTime;
	}
	
	const delta = window.clock.getDelta();
	updateTween();
	
	if(interactionManager.resize_move) {
		if(!interactionManager.zoom_event) {
			window.viewable_container.resize_reposition();
		} else {
			interactionManager.zoom_event = false;
		}
		interactionManager.resize_move = false;
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
	
	if(interactionManager.grabbed_object) {
		translate_object(interactionManager.grabbed_object, window.viewable_container.get_camera());
	}
	
	if (shouldTrackPerformance) {
		performanceTracking.times.physicsStart = performance.now();
	}
	
	window.world.timestep = Math.min(delta, 0.1);
	if (!is_physics_paused) {
		window.world.step();
	}
	
	if (shouldTrackPerformance) {
		performanceTracking.times.physicsEnd = performance.now();
		performanceTracking.times.backgroundStart = performance.now();
	}
	
	if (window.background_container) {
		window.background_container.update(interactionManager.grabbed_object, window.viewable_container, delta);
	}
	
	if (shouldTrackPerformance) {
		performanceTracking.times.backgroundEnd = performance.now();
		performanceTracking.times.assetStart = performance.now();
	}
	
	if (window.asset_handler) {
		window.asset_handler.updateAnimations(delta);
	}
	
	if (shouldTrackPerformance) {
		performanceTracking.times.assetEnd = performance.now();
		performanceTracking.times.storageStart = performance.now();
	}
	
	if (AssetStorage.get_instance()) {
		if (!is_physics_paused) {
			AssetStorage.get_instance().update();
		} else if (interactionManager.grabbed_object) {
			const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(interactionManager.grabbed_object);
			if (body_pair) {
				const [mesh, body] = body_pair;
				const position = body.translation();
				mesh.position.set(position.x, position.y, position.z);
				const rotation = body.rotation();
				mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
			}
		}
	}
	
	if (shouldTrackPerformance) {
		performanceTracking.times.storageEnd = performance.now();
		performanceTracking.times.overlayStart = performance.now();
	}
	
	window.viewable_container.get_overlay().update_confetti();
	
	if (shouldTrackPerformance) {
		performanceTracking.times.overlayEnd = performance.now();
		performanceTracking.times.rigStart = performance.now();
	}
	
	if (window.asset_handler) {
		window.asset_handler.updateRigVisualizations();
		window.asset_handler.update_visualizations();
		if (window.asset_handler.update_debug_meshes) {
			window.asset_handler.update_debug_meshes();
		}
	}
	
	if (shouldTrackPerformance) {
		performanceTracking.times.rigEnd = performance.now();
		performanceTracking.times.css3dStart = performance.now();
	}
	
	if (window.css3dFactory) {
		window.css3dFactory.update();
	}
	
	if (shouldTrackPerformance) {
		performanceTracking.times.css3dEnd = performance.now();
		performanceTracking.times.renderStart = performance.now();
	}
	
	window.app_renderer.render();
	
	if (shouldTrackPerformance) {
		performanceTracking.times.renderEnd = performance.now();
		
		const totalTime = performanceTracking.times.renderEnd - performanceTracking.times.animateStart;
		
		if (totalTime > 20) {
			const physicsTime = performanceTracking.times.physicsEnd - performanceTracking.times.physicsStart;
			const backgroundTime = performanceTracking.times.backgroundEnd - performanceTracking.times.backgroundStart;
			const assetTime = performanceTracking.times.assetEnd - performanceTracking.times.assetStart;
			const storageTime = performanceTracking.times.storageEnd - performanceTracking.times.storageStart;
			const overlayTime = performanceTracking.times.overlayEnd - performanceTracking.times.overlayStart;
			const rigTime = performanceTracking.times.rigEnd - performanceTracking.times.rigStart;
			const css3dTime = performanceTracking.times.css3dEnd - performanceTracking.times.css3dStart;
			const renderTime = performanceTracking.times.renderEnd - performanceTracking.times.renderStart;
			
			console.warn(`🐌 SLOW FRAME BREAKDOWN (${totalTime.toFixed(2)}ms total):`);
			console.warn(`  Physics: ${physicsTime.toFixed(2)}ms`);
			console.warn(`  Background: ${backgroundTime.toFixed(2)}ms`);
			console.warn(`  Assets: ${assetTime.toFixed(2)}ms`);
			console.warn(`  Storage: ${storageTime.toFixed(2)}ms`);
			console.warn(`  Overlay: ${overlayTime.toFixed(2)}ms`);
			console.warn(`  Rigs: ${rigTime.toFixed(2)}ms`);
			console.warn(`  CSS3D: ${css3dTime.toFixed(2)}ms`);
			console.warn(`  Render: ${renderTime.toFixed(2)}ms`);
		}
		
		performanceTracking.enabled = false;
	}
	
	lastFrameTime = currentTime;
}

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