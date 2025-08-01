import { TextureOptimizer } from './index';

export class UniversalMemoryManager {
	constructor() {
		this.isMobile = /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
		this.isLowMemoryDevice = this.detectLowMemoryDevice();
		this.loadedAssets = new Map();
		this.assetQueue = [];
		this.maxConcurrentLoads = this.calculateConcurrentLoads();
		this.memoryBudget = this.calculateMemoryBudget();
		this.isLoadingPaused = false;
		this.loadingPhase = 'essential';
		this.monitoringInterval = null;
		this.emergencyPhysicsPause = false;
		this.systems = {
			renderer: null,
			physics: null,
			background: null,
			scene: null,
			assetHandler: null
		};
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
		return Math.min(cores, 6);
	}

	calculateMemoryBudget() {
		if (this.isLowMemoryDevice) return 150 * 1024 * 1024;
		if (this.isMobile) return 400 * 1024 * 1024;
		const ram = navigator.deviceMemory || 8;
		if (ram >= 16) return 1200 * 1024 * 1024;
		if (ram >= 8) return 800 * 1024 * 1024;
		return 600 * 1024 * 1024;
	}

	integrateWithSystems(systems) {
		this.systems = { ...this.systems, ...systems };
	}

	startMemoryMonitoring() {
		if (this.monitoringInterval) return;

		if ('memory' in performance) {
			this.monitoringInterval = setInterval(() => {
				const memInfo = performance.memory;
				const usedRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;

				if (usedRatio > 0.85) {
					console.warn(`🔥 Critical memory usage: ${Math.round(usedRatio * 100)}%`);
					console.warn(`   Used: ${(memInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
					console.warn(`   Limit: ${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`);

					this.pauseLoading();
					this.unloadUnusedAssets();

					if (usedRatio > 0.9) {
						console.error('🚨 Emergency memory cleanup triggered');
						this.performEmergencyCleanup();
					}

					if (window.gc) {
						window.gc();
					}
				} else if (usedRatio < 0.7 && this.isLoadingPaused) {
					this.resumeLoading();
				}
			}, 5000);
		}

		const managementInterval = setInterval(() => {
			const memoryRatio = this.getCurrentMemoryUsage() / this.memoryBudget;

			if (memoryRatio > 0.85) {
				console.warn(`🔥 High memory usage: ${(memoryRatio * 100).toFixed(1)}%`);
				this.pauseLoading();
				this.unloadUnusedAssets();
			} else if (memoryRatio < 0.6 && this.isLoadingPaused) {
				this.resumeLoading();
			}

			this.loadDeferredAssets();

			if (Math.random() < 0.1) {
				this.unloadUnusedAssets();
			}
		}, 3000);

		this.managementInterval = managementInterval;
	}

	stopMemoryMonitoring() {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}
		if (this.managementInterval) {
			clearInterval(this.managementInterval);
			this.managementInterval = null;
		}
	}

	setupEventListeners() {
		window.addEventListener('low-memory', () => {
			console.warn('📱 Low memory event detected - aggressive cleanup');
			this.pauseLoading();
			this.unloadUnusedAssets();
			this.performEmergencyCleanup();
		});

		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.unloadUnusedAssets();
				if (this.systems.renderer) {
					const renderer = this.systems.renderer;
					renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.5, 1));
				}
			} else {
				if (this.systems.renderer) {
					const renderer = this.systems.renderer;
					const targetRatio = this.isMobile ? 
						Math.min(window.devicePixelRatio * 0.75, 2) : 
						window.devicePixelRatio;
					renderer.setPixelRatio(targetRatio);
				}
			}
		});
	}

	performEmergencyCleanup() {
		if (this.systems.assetHandler) {
			if (typeof this.systems.assetHandler.clearCaches === 'function') {
				this.systems.assetHandler.clearCaches();
			}
			if (typeof this.systems.assetHandler.clearNonEssentialAssets === 'function') {
				this.systems.assetHandler.clearNonEssentialAssets();
			}
		}

		if (this.systems.background) {
			if (typeof this.systems.background.reduceLOD === 'function') {
				this.systems.background.reduceLOD();
			}
			if (typeof this.systems.background.clearParticles === 'function') {
				this.systems.background.clearParticles();
			}
		}

		if (this.systems.physics && window.toggle_physics_pause && !window.is_physics_paused) {
			this.emergencyPhysicsPause = true;
			window.toggle_physics_pause();

			setTimeout(() => {
				if (this.emergencyPhysicsPause && window.is_physics_paused) {
					this.emergencyPhysicsPause = false;
					window.toggle_physics_pause();
				}
			}, 5000);
		}

		if (window.viewable_container && window.viewable_container.get_overlay()) {
			const overlay = window.viewable_container.get_overlay();
			if (typeof overlay.clearNonEssentialAnimations === 'function') {
				overlay.clearNonEssentialAnimations();
			}
		}

		this.unloadUnusedAssets();
	}

	async loadAssetsWithBudget(assetList) {		
		const phaseAssets = this.organizeAssetsByPhase(assetList);
		const loadedAssets = [];

		for (const [phase, assets] of Object.entries(phaseAssets)) {
			this.loadingPhase = phase;

			const phaseResults = await this.loadAssetPhase(assets);
			loadedAssets.push(...phaseResults);

			const currentMemory = this.getCurrentMemoryUsage();
			const memoryRatio = currentMemory / this.memoryBudget;

			if (memoryRatio > 0.8) {
				console.warn(`⚠️ Memory budget reached after ${phase} phase, deferring remaining assets`);
				this.deferRemainingAssets(phaseAssets, phase);
				break;
			}

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

		Object.keys(phases).forEach(phase => {
			phases[phase].sort((a, b) => this.getAssetPriority(b) - this.getAssetPriority(a));
		});

		return phases;
	}

	getAssetPhase(asset) {
		const name = asset.name || asset;

		if (typeof name === 'string') {
			const upperName = name.toUpperCase();

			if (upperName.includes('CAMERA') || upperName.includes('LIGHTING') || upperName.includes('SCENE')) {
				return 'essential';
			}

			if (upperName.includes('CAT') || upperName.includes('MONITOR')) {
				return 'interactive';
			}

			if (upperName.includes('COMPUTER') || upperName.includes('KEYBOARD') || 
				upperName.includes('MOUSE') || upperName.includes('PLANT') ||
				upperName.includes('CHAIR') || upperName.includes('DESK')) {
				return 'decorative';
			}

			if (upperName.includes('DIPLOMA') || upperName.includes('BOOK') || 
				upperName.includes('NOTEBOOK') || upperName.includes('TABLET') ||
				upperName.includes('DESKPHOTO') || upperName.includes('MOUSEPAD')) {
				return 'background';
			}
		}

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

			if (upperName.includes('CAT') || upperName.includes('MONITOR')) priority += 100;

			if (upperName.includes('COMPUTER') || upperName.includes('KEYBOARD') || 
				upperName.includes('DESK') || upperName.includes('CHAIR')) priority += 25;

			if (upperName.includes('PLANT') || upperName.includes('BOOK') || 
				upperName.includes('MOUSE')) priority -= 25;

			if (upperName.includes('DIPLOMA') || upperName.includes('DESKPHOTO') || 
				upperName.includes('NOTEBOOK') || upperName.includes('TABLET')) priority -= 50;
		}

		if (asset.hasRig) priority += 50;

		return priority;
	}

	async loadAssetOptimized(asset) {
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

		const assetName = asset.name || asset.toString();

		try {
			let loadedAsset;

			if (window.asset_handler.spawn_asset_optimized) {
				loadedAsset = await window.asset_handler.spawn_asset_optimized(asset, optimizations);
			} else if (window.asset_handler.spawn_asset) {
				loadedAsset = await window.asset_handler.spawn_asset(assetName);
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
		if (this.isLowMemoryDevice) return 0.4;
		if (this.isMobile) return 0.7;
		const cores = navigator.hardwareConcurrency || 4;
		if (cores >= 8) return 1.0;
		return 0.8;
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

	dispose() {
		this.stopMemoryMonitoring();
		this.unloadUnusedAssets();
		this.loadedAssets.clear();
		this.assetQueue.length = 0;
		this.systems = {
			renderer: null,
			physics: null,
			background: null,
			scene: null,
			assetHandler: null
		};
	}
}