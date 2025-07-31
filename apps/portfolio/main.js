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
		AssetHandler.dispose_instance();
		if (window.scene && window.physicsWorld) {
			AssetHandler.get_instance(window.scene, window.physicsWorld);
		}
	});
}

class UniversalMemoryManager {
	constructor() {
		this.isMobile = /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
		this.isLowMemoryDevice = this.detectLowMemoryDevice();
		this.loadedAssets = new Map();
		this.assetQueue = [];
		this.maxConcurrentLoads = this.calculateConcurrentLoads();
		this.memoryBudget = this.calculateMemoryBudget();
		this.isLoadingPaused = false;
		this.loadingPhase = 'essential'; // essential -> interactive -> decorative -> background
	}
	
	detectLowMemoryDevice() {
		const ram = navigator.deviceMemory || 4;
		const isOldIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
						parseInt(navigator.userAgent.match(/OS (\d+)_/)?.[1] || '15') < 13;
		const isLowEndDesktop = !this.isMobile && (ram < 8 || navigator.hardwareConcurrency < 4);
		return ram < 4 || isOldIOS || isLowEndDesktop;
	}
	
	calculateConcurrentLoads() {
		if (this.isLowMemoryDevice) return 1;
		if (this.isMobile) return 2;
		const cores = navigator.hardwareConcurrency || 4;
		return Math.min(cores, 6); // Cap at 6 for stability
	}
	
	calculateMemoryBudget() {
		if (this.isLowMemoryDevice) return 150 * 1024 * 1024; // 150MB
		if (this.isMobile) return 400 * 1024 * 1024; // 400MB
		const ram = navigator.deviceMemory || 8;
		if (ram >= 16) return 1200 * 1024 * 1024; // 1.2GB for high-end
		if (ram >= 8) return 800 * 1024 * 1024; // 800MB for mid-range
		return 600 * 1024 * 1024; // 600MB for lower-end desktop
	}
	
	async loadAssetsWithBudget(assetList) {		
		const phaseAssets = this.organizeAssetsByPhase(assetList);
		const loadedAssets = [];
		
		// Load in phases: essential -> interactive -> decorative -> background
		for (const [phase, assets] of Object.entries(phaseAssets)) {
			this.loadingPhase = phase;
			
			const phaseResults = await this.loadAssetPhase(assets);
			loadedAssets.push(...phaseResults);
			
			// Check memory after each phase
			const currentMemory = this.getCurrentMemoryUsage();
			const memoryRatio = currentMemory / this.memoryBudget;
						
			if (memoryRatio > 0.8) {
				console.warn(`⚠️ Memory budget reached after ${phase} phase, deferring remaining assets`);
				this.deferRemainingAssets(phaseAssets, phase);
				break;
			}
			
			// Brief pause between phases to allow garbage collection
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		
		return loadedAssets;
	}
	
	organizeAssetsByPhase(assetList) {
		const phases = {
			essential: [],
			interactive: [],
			decorative: [],
			background: []
		};
		
		for (const asset of assetList) {
			const phase = this.getAssetPhase(asset);
			phases[phase].push(asset);
		}
		
		// Sort each phase by priority
		Object.keys(phases).forEach(phase => {
			phases[phase].sort((a, b) => this.getAssetPriority(b) - this.getAssetPriority(a));
		});
		
		return phases;
	}
	
	getAssetPhase(asset) {
		const name = asset.name || asset;
		
		// Essential - critical for basic functionality
		if (typeof name === 'string') {
			const upperName = name.toUpperCase();
			
			// Essential - critical for basic functionality
			if (upperName.includes('CAMERA') || upperName.includes('LIGHTING') || upperName.includes('SCENE')) {
				return 'essential';
			}
			
			// Interactive - user can interact with these (has rigs or activators)
			if (upperName.includes('CAT') || upperName.includes('MONITOR')) {
				return 'interactive';
			}
			
			// Decorative - visible but non-interactive office items
			if (upperName.includes('COMPUTER') || upperName.includes('KEYBOARD') || 
				upperName.includes('MOUSE') || upperName.includes('PLANT') ||
				upperName.includes('CHAIR') || upperName.includes('DESK')) {
				return 'decorative';
			}
			
			// Background - nice to have, lowest priority
			if (upperName.includes('DIPLOMA') || upperName.includes('BOOK') || 
				upperName.includes('NOTEBOOK') || upperName.includes('TABLET') ||
				upperName.includes('DESKPHOTO') || upperName.includes('MOUSEPAD')) {
				return 'background';
			}
		}
		
		// Default to decorative if we can't determine
		return 'decorative';
	}
	
	async loadAssetPhase(assets) {
		const loadedAssets = [];
		const chunks = this.chunkArray(assets, this.maxConcurrentLoads);
		
		for (const chunk of chunks) {
			if (this.isLoadingPaused) {
				this.assetQueue.push(...chunk);
				break;
			}
			
			const chunkPromises = chunk.map(async (asset) => {
				try {
					const currentMemory = this.getCurrentMemoryUsage();
					if (currentMemory > this.memoryBudget * 0.9) {
						console.warn(`Memory limit reached, deferring ${asset.name}`);
						this.deferAsset(asset);
						return null;
					}
					
					const loadedAsset = await this.loadAssetOptimized(asset);
					this.loadedAssets.set(asset.name || asset.toString(), loadedAsset);
					return loadedAsset;
				} catch (error) {
					console.warn(`Failed to load ${asset.name}:`, error);
					return null;
				}
			});
			
			const chunkResults = await Promise.all(chunkPromises);
			loadedAssets.push(...chunkResults.filter(asset => asset !== null));
			
			// Brief pause between chunks
			await new Promise(resolve => setTimeout(resolve, 50));
		}
		
		return loadedAssets;
	}
	
	chunkArray(array, size) {
		const chunks = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}
	
	deferRemainingAssets(phaseAssets, currentPhase) {
		const phaseOrder = ['essential', 'interactive', 'decorative', 'background'];
		const currentIndex = phaseOrder.indexOf(currentPhase);
		
		for (let i = currentIndex + 1; i < phaseOrder.length; i++) {
			const phase = phaseOrder[i];
			this.assetQueue.push(...phaseAssets[phase]);
		}
	}
	
	prioritizeAssets(assetList) {
		return assetList.sort((a, b) => {
			const aPriority = this.getAssetPriority(a);
			const bPriority = this.getAssetPriority(b);
			return bPriority - aPriority;
		});
	}
	
	getAssetPriority(asset) {
		let priority = 0;
		const name = asset.name || asset;
		
		if (typeof name === 'string') {
			const upperName = name.toUpperCase();
			
			// Higher priority for essential assets
			if (upperName.includes('CAT') || upperName.includes('MONITOR')) priority += 100;
			
			// Medium priority for visible office items
			if (upperName.includes('COMPUTER') || upperName.includes('KEYBOARD') || 
				upperName.includes('DESK') || upperName.includes('CHAIR')) priority += 25;
			
			// Lower priority for decorative items
			if (upperName.includes('PLANT') || upperName.includes('BOOK') || 
				upperName.includes('MOUSE')) priority -= 25;
			
			// Lowest priority for background items
			if (upperName.includes('DIPLOMA') || upperName.includes('DESKPHOTO') || 
				upperName.includes('NOTEBOOK') || upperName.includes('TABLET')) priority -= 50;
		}
		
		// Higher priority for assets with rigs (interactive)
		if (asset.hasRig) priority += 50;
		
		return priority;
	}
	
	async loadAssetOptimized(asset) {
		// Apply universal optimizations with device-specific tweaks
		const optimizations = {
			textureCompression: true,
			geometrySimplification: this.getGeometrySimplification(),
			materialSimplification: true,
			disableNonEssentialAnimations: this.isLowMemoryDevice,
			lodEnabled: true,
			maxTextureSize: this.getMaxTextureSize(),
			enableInstancing: !this.isLowMemoryDevice,
			cullDistance: this.getCullDistance(),
			shadowQuality: this.getShadowQuality()
		};
		
		// Check if asset has a name property or is a string
		const assetName = asset.name || asset.toString();
		
		try {
			let loadedAsset;
			
			if (window.asset_handler.spawn_asset_optimized) {
				loadedAsset = await window.asset_handler.spawn_asset_optimized(asset, optimizations);
			} else if (window.asset_handler.spawn_asset) {
				// Use spawn_asset with asset name
				loadedAsset = await window.asset_handler.spawn_asset(assetName);
				// Apply post-optimization
				loadedAsset = this.postOptimizeAsset(loadedAsset, optimizations);
			} else {
				console.warn(`Cannot load asset ${assetName} - no suitable spawn method found`);
				return null;
			}
			
			return loadedAsset;
		} catch (error) {
			console.error(`Error loading asset ${assetName}:`, error);
			return null;
		}
	}
	
	getGeometrySimplification() {
		if (this.isLowMemoryDevice) return 0.4; // 60% reduction
		if (this.isMobile) return 0.7; // 30% reduction
		const cores = navigator.hardwareConcurrency || 4;
		if (cores >= 8) return 1.0; // No reduction for high-end
		return 0.8; // 20% reduction for mid-range
	}
	
	getMaxTextureSize() {
		if (this.isLowMemoryDevice) return 512;
		if (this.isMobile) return 1024;
		const ram = navigator.deviceMemory || 8;
		if (ram >= 16) return 2048;
		if (ram >= 8) return 1024;
		return 1024;
	}
	
	getCullDistance() {
		if (this.isLowMemoryDevice) return 30;
		if (this.isMobile) return 50;
		return 100;
	}
	
	getShadowQuality() {
		if (this.isLowMemoryDevice) return 'none';
		if (this.isMobile) return 'low';
		const ram = navigator.deviceMemory || 8;
		if (ram >= 16) return 'high';
		return 'medium';
	}
	
	postOptimizeAsset(asset, optimizations) {
		if (!asset) return asset;
		
		// Optimize textures
		asset.traverse((child) => {
			if (child.material) {
				const materials = Array.isArray(child.material) ? child.material : [child.material];
				materials.forEach(material => {
					if (material.map) {
						TextureOptimizer.optimizeForMobile(material.map, optimizations.maxTextureSize);
					}
					if (material.normalMap) {
						TextureOptimizer.optimizeForMobile(material.normalMap, optimizations.maxTextureSize / 2);
					}
				});
			}
			
			// Simplify geometry if needed
			if (child.geometry && optimizations.geometrySimplification < 1.0) {
				this.simplifyGeometry(child.geometry, optimizations.geometrySimplification);
			}
		});
		
		return asset;
	}
	
	simplifyGeometry(geometry, factor) {
		if (geometry.attributes.position) {
			const positionCount = geometry.attributes.position.count;
			const targetCount = Math.floor(positionCount * factor);
			
			if (targetCount < positionCount && window.THREE.SimplifyModifier) {
				// Use Three.js simplification if available
				const modifier = new THREE.SimplifyModifier();
				const simplified = modifier.modify(geometry, targetCount);
				geometry.copy(simplified);
			}
		}
	}
	
	getCurrentMemoryUsage() {
		if (performance.memory) {
			return performance.memory.usedJSHeapSize;
		}
		return this.loadedAssets.size * 10 * 1024 * 1024;
	}
	
	deferAsset(asset) {
		this.assetQueue.push(asset);
	}
	
	async loadDeferredAssets() {
		if (this.assetQueue.length === 0 || this.isLoadingPaused) return;
		
		const currentMemory = this.getCurrentMemoryUsage();
		const memoryRatio = currentMemory / this.memoryBudget;
		
		// Only load deferred assets if we have sufficient memory headroom
		if (memoryRatio < 0.6) {
			const assetsToLoad = this.assetQueue.splice(0, this.maxConcurrentLoads);			
			const loadPromises = assetsToLoad.map(async (asset) => {
				try {
					const loadedAsset = await this.loadAssetOptimized(asset);
					this.loadedAssets.set(asset.name || asset.toString(), loadedAsset);
					return loadedAsset;
				} catch (error) {
					console.warn(`Failed to load deferred asset ${asset.name}:`, error);
					return null;
				}
			});
			
			await Promise.all(loadPromises);
		}
	}
	
	pauseLoading() {
		this.isLoadingPaused = true;
	}
	
	resumeLoading() {
		this.isLoadingPaused = false;
	}
	
	unloadUnusedAssets() {
		const unusedAssets = this.findUnusedAssets();
		for (const assetName of unusedAssets) {
			this.unloadAsset(assetName);
		}
	}
	
	findUnusedAssets() {
		const unused = [];
		const camera = window.viewable_container?.get_camera();
		
		if (!camera) return unused;
		
		for (const [name, asset] of this.loadedAssets) {
			if (this.isAssetOutOfView(asset, camera)) {
				unused.push(name);
			}
		}
		
		return unused;
	}
	
	isAssetOutOfView(asset, camera) {
		if (!asset.position) return false;
		
		const distance = camera.position.distanceTo(asset.position);
		const frustum = new THREE.Frustum();
		const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		frustum.setFromProjectionMatrix(matrix);
		
		return distance > 50 || !frustum.containsPoint(asset.position);
	}
	
	unloadAsset(assetName) {
		const asset = this.loadedAssets.get(assetName);
		if (!asset) return;
		
		if (asset.geometry) asset.geometry.dispose();
		if (asset.material) {
			if (Array.isArray(asset.material)) {
				asset.material.forEach(mat => this.disposeMaterial(mat));
			} else {
				this.disposeMaterial(asset.material);
			}
		}
		
		if (asset.parent) asset.parent.remove(asset);
		
		this.loadedAssets.delete(assetName);
	}
	
	disposeMaterial(material) {
		if (material.map) material.map.dispose();
		if (material.normalMap) material.normalMap.dispose();
		if (material.roughnessMap) material.roughnessMap.dispose();
		if (material.metalnessMap) material.metalnessMap.dispose();
		material.dispose();
	}
}

class TextureOptimizer {
	static optimizeForMobile(texture, maxSize = 1024) {
		if (texture.image && (texture.image.width > maxSize || texture.image.height > maxSize)) {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			
			const scale = Math.min(maxSize / texture.image.width, maxSize / texture.image.height);
			canvas.width = texture.image.width * scale;
			canvas.height = texture.image.height * scale;
			
			ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
			texture.image = canvas;
			texture.needsUpdate = true;
		}
		
		texture.generateMipmaps = false;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		
		return texture;
	}
	
	static compressTexture(texture) {
		const renderer = window.app_renderer?.get_renderer();
		if (renderer) {
			const extensions = renderer.extensions;
			if (extensions.get('WEBGL_compressed_texture_s3tc')) {
				texture.format = THREE.CompressedRGBFormat;
			}
		}
		return texture;
	}
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
	}
	update_loading_progress(`${stage}${error ? ` - ${error}` : ''}`);
}

function showDiagnosticError(code) {
	const now = Date.now();
	if (window.lastErrorTime && (now - window.lastErrorTime) < 10000) {
		console.error(`Preventing error loop - last error was ${now - window.lastErrorTime}ms ago`);
		return;
	}
	window.lastErrorTime = now;
	
	const loadingScreen = document.getElementById('loading-screen');
	if (loadingScreen) {
		loadingScreen.innerHTML = `
			<div class="loading-content">
				<h1 class="loading-title">ERROR ${code}</h1>
				<div class="loading-progress-text">
					DEVICE: ${diagnosticInfo.device}<br>
					STAGE: ${diagnosticInfo.stage}<br>
					ERRORS: ${diagnosticInfo.errors.join(', ') || 'NONE'}<br><br>
					<button onclick="handleErrorRetry()" style="
						background: #e74c3c; 
						color: white; 
						border: none; 
						padding: 10px 20px; 
						border-radius: 5px; 
						cursor: pointer; 
						font-family: monospace;
						font-size: 16px;
					">RETRY</button>
					<button onclick="handleErrorContinue()" style="
						background: #f39c12; 
						color: white; 
						border: none; 
						padding: 10px 20px; 
						border-radius: 5px; 
						cursor: pointer; 
						font-family: monospace;
						font-size: 16px;
						margin-left: 10px;
					">CONTINUE ANYWAY</button>
				</div>
			</div>
		`;
	}
}

window.handleErrorRetry = function() {
	window.lastErrorTime = null;
	location.reload();
};

window.handleErrorContinue = function() {
	hide_loading_screen();
	console.warn('Continuing with degraded functionality due to initialization errors');
	
	if (window.scene && window.viewable_container) {
		try {
			window.app_renderer.set_animation_loop(animate);
		} catch (e) {
			console.error('Could not start basic rendering:', e);
		}
	}
};

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
	
	try {
		window.world = new RAPIER.World();
		window.world.gravity = new RAPIER.Vector3(gravityData.x, gravityData.y, gravityData.z);
	} catch (error) {
		console.error("Failed to initialize Rapier world:", error);
		throw new Error("Rapier initialization failed. Make sure to call initRapier() first.");
	}
	
	const physicsOptimization = window.manifest_manager.get_physics_optimization_settings();
	
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
			if (backgroundAnimationFrameId) {
				cancelAnimationFrame(backgroundAnimationFrameId);
				backgroundAnimationFrameId = null;
			}
			window.app_renderer.set_animation_loop(animate);
		} else {
			window.app_renderer.set_animation_loop(null);
			startBackgroundAnimation();
			if (window.memoryManager) {
				window.memoryManager.unloadUnusedAssets();
			}
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
				window.textContainerPausedPhysics = true;
				toggle_physics_pause();
			} else if (window.previousTextContainerState && !isTextActive && is_physics_paused && window.textContainerPausedPhysics) {
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
		window.asset_handler.spawn_manifest_assets(window.manifest_manager, (text) => {})
	];
	
	const [backgroundResult, lightingResult, manifestAssets] = await Promise.all(assetPromises);
	
	return manifestAssets;
}

async function loadAssetsWithMemoryManagement() {
	const memoryManager = new UniversalMemoryManager();
	window.memoryManager = memoryManager;
	
	update_loading_progress('Loading assets with universal memory optimization...');
	
	const assetPromises = [
		setup_scene_background(),
		setup_scene_lighting()
	];
	
	await Promise.all(assetPromises);
	
	// Get asset list from manifest manager
	let assetList = [];
	try {
		if (window.manifest_manager.get_asset_list) {
			assetList = window.manifest_manager.get_asset_list();
		} else if (window.manifest_manager.get_manifest) {
			const manifest = window.manifest_manager.get_manifest();
			if (manifest && manifest.assets) {
				assetList = Object.keys(manifest.assets).map(key => ({
					name: key,
					...manifest.assets[key]
				}));
			}
		}
		
		if (assetList.length === 0) {
			console.warn('No assets found in manifest, falling back to spawn_manifest_assets');
			// Fallback to original loading method
			return await window.asset_handler.spawn_manifest_assets(window.manifest_manager, (text) => {});
		}
	} catch (error) {
		console.error('Error getting asset list:', error);
		// Fallback to original loading method
		return await window.asset_handler.spawn_manifest_assets(window.manifest_manager, (text) => {});
	}
		
	const loadedAssets = await memoryManager.loadAssetsWithBudget(assetList);
	
	// Set up progressive loading and memory management
	const managementInterval = setInterval(() => {
		const memoryRatio = memoryManager.getCurrentMemoryUsage() / memoryManager.memoryBudget;
		
		if (memoryRatio > 0.85) {
			console.warn(`🔥 High memory usage: ${(memoryRatio * 100).toFixed(1)}%`);
			memoryManager.pauseLoading();
			memoryManager.unloadUnusedAssets();
		} else if (memoryRatio < 0.6 && memoryManager.isLoadingPaused) {
			memoryManager.resumeLoading();
		}
		
		// Continue loading deferred assets
		memoryManager.loadDeferredAssets();
		
		// Periodic cleanup
		if (Math.random() < 0.1) {
			memoryManager.unloadUnusedAssets();
		}
	}, 3000); // Check every 3 seconds
	
	// Store interval reference for cleanup
	window.memoryManagementInterval = managementInterval;
	
	return loadedAssets;
}

function setupMemoryPressureHandling() {
	// Universal memory monitoring (not just mobile)
	if ('memory' in performance) {
		const memoryCheckInterval = setInterval(() => {
			const memInfo = performance.memory;
			const usedRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
			
			if (usedRatio > 0.85) {
				console.warn(`🔥 Critical memory usage: ${Math.round(usedRatio * 100)}%`);
				console.warn(`   Used: ${(memInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
				console.warn(`   Limit: ${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`);
				
				if (window.memoryManager) {
					window.memoryManager.pauseLoading();
					window.memoryManager.unloadUnusedAssets();
				}
				
				// Emergency cleanup
				if (usedRatio > 0.9) {
					console.error('🚨 Emergency memory cleanup triggered');
					performEmergencyCleanup();
				}
				
				// Force garbage collection if available
				if (window.gc) {
					window.gc();
				}
			} else if (usedRatio < 0.7 && window.memoryManager && window.memoryManager.isLoadingPaused) {
				window.memoryManager.resumeLoading();
			}
		}, 5000); // Check every 5 seconds
		
		window.memoryCheckInterval = memoryCheckInterval;
	}
	
	// Handle low memory events (available on some devices)
	window.addEventListener('low-memory', () => {
		console.warn('📱 Low memory event detected - aggressive cleanup');
		if (window.memoryManager) {
			window.memoryManager.pauseLoading();
			window.memoryManager.unloadUnusedAssets();
		}
		performEmergencyCleanup();
	});
	
	// Enhanced visibility change handling
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			if (window.memoryManager) {
				window.memoryManager.unloadUnusedAssets();
			}
			// Reduce render quality when hidden
			if (window.app_renderer && window.app_renderer.get_renderer()) {
				const renderer = window.app_renderer.get_renderer();
				renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.5, 1));
			}
		} else {
			// Restore render quality
			if (window.app_renderer && window.app_renderer.get_renderer()) {
				const renderer = window.app_renderer.get_renderer();
				const targetRatio = window.memoryManager?.isMobile ? 
					Math.min(window.devicePixelRatio * 0.75, 2) : 
					window.devicePixelRatio;
				renderer.setPixelRatio(targetRatio);
			}
		}
	});
}

function performEmergencyCleanup() {	
	// Clear any caches
	if (window.asset_handler) {
		if (typeof window.asset_handler.clearCaches === 'function') {
			window.asset_handler.clearCaches();
		}
		if (typeof window.asset_handler.clearNonEssentialAssets === 'function') {
			window.asset_handler.clearNonEssentialAssets();
		}
	}
	
	// Reduce background container LOD
	if (window.background_container) {
		if (typeof window.background_container.reduceLOD === 'function') {
			window.background_container.reduceLOD();
		}
		if (typeof window.background_container.clearParticles === 'function') {
			window.background_container.clearParticles();
		}
	}
	
	// Pause physics temporarily to reduce CPU load
	if (!is_physics_paused) {
		window.emergencyPhysicsPause = true;
		toggle_physics_pause();
		
		// Resume after 5 seconds
		setTimeout(() => {
			if (window.emergencyPhysicsPause && is_physics_paused) {
				window.emergencyPhysicsPause = false;
				toggle_physics_pause();
			}
		}, 5000);
	}
	
	// Clear overlay animations
	if (window.viewable_container && window.viewable_container.get_overlay()) {
		const overlay = window.viewable_container.get_overlay();
		if (typeof overlay.clearNonEssentialAnimations === 'function') {
			overlay.clearNonEssentialAnimations();
		}
	}
}

async function waitForBackgroundAssetsOptimized() {
	update_loading_progress('Finalizing scene assets...');
	
	return new Promise(async (resolve) => {
		const checkAssetsLoaded = async () => {
			const isComplete = await window.background_container.is_loading_complete();
			if (isComplete) {
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
		await loadAssetsWithMemoryManagement();
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
						
						console.error('WebGL context lost - attempting recovery');
						
						setTimeout(() => {
							if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) {
								showDiagnosticError('W1');
							}
						}, 2000);
					});
				}
			} catch (e) {
				console.error('iOS initialization error:', e);
				updateDiagnostic('IOS_FALLBACK_ERROR', e.message.substring(0, 15));				
				setTimeout(() => {
					if (window.app_renderer && !window.app_renderer.get_renderer()) {
						showDiagnosticError('I1');
					}
				}, 5000);
			}
		}
		
		clearTimeout(loadingTimeout);
		updateDiagnostic('SUCCESS');
		hide_loading_screen();
		
		window.addEventListener('keydown', toggle_debug_ui);
		window.addEventListener('unload', cleanup);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		setupMemoryPressureHandling();
		
		memoryAnalyzer.initialize();
		window.memoryAnalyzer = memoryAnalyzer;
		
		if (window.css3dFactory) {
			window.css3dFactory.setExternalAnimationLoop(true);
		}
		
		window.app_renderer.set_animation_loop(animate);
		
		create_debug_UI();
		set_background_container(window.background_container);
		
		if (window.manifest_manager.get_auto_throttle()) {
			const initialScale = window.devicePixelRatio > 1 ? 0.75 : 1.0;
			set_resolution_scale(initialScale);
		}
		
		if (window.viewable_container && window.viewable_container.get_overlay()) {
			const labelContainer = window.viewable_container.get_overlay().label_container;
			if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
				labelContainer.updateDebugVisualizations();
			}
		}
		
		window.checkMemory = () => memoryAnalyzer.forceAnalysis();
		window.getMemoryUsage = () => memoryAnalyzer.getCurrentMemoryUsage();
		
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
	
	if (window.memoryManager) {
		window.memoryManager.unloadUnusedAssets();
		window.memoryManager = null;
	}
	
	// Clear memory management intervals
	if (window.memoryManagementInterval) {
		clearInterval(window.memoryManagementInterval);
		window.memoryManagementInterval = null;
	}
	
	if (window.memoryCheckInterval) {
		clearInterval(window.memoryCheckInterval);
		window.memoryCheckInterval = null;
	}
	
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
}

function toggle_physics_pause() {
	is_physics_paused = !is_physics_paused;
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
		window.textContainerPausedPhysics = true;
		toggle_physics_pause();
	} else if (window.previousTextContainerState && !isTextActive && is_physics_paused && window.textContainerPausedPhysics) {
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
		if (FLAGS.DEBUG_UI && FLAGS.COLLISION_VISUAL_DEBUG) {
			updateLabelWireframes();
		}
	}
}

init();