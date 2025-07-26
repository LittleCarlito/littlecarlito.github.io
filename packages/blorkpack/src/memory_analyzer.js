export class MemoryAnalyzer {
	constructor() {
		this.baselineMemory = 0;
		this.memoryGrowthThreshold = 5;
		this.isInitialized = false;
		this.growthDetected = false;
		this.lastThreeJSCounts = null;
		this.lastRapierCounts = null;
		this.lastTweenCount = 0;
		this.lastCollectionSizes = new Map();
		this.consecutiveGrowthCount = 0;
		this.maxConsecutiveGrowth = 3;
		this.watchers = new Map();
		this.debounceTimers = new Map();
		this.debounceDelay = 100;
	}

	initialize() {
		this.isInitialized = true;
		console.log(`🔍 Memory Analyzer: Initialized - event-driven object tracking`);
		this.setupWatchers();
		this.analyzeThreeJSMemory();
		this.analyzeApplicationCollections();
	}

	setupWatchers() {
		this.setupThreeJSWatcher();
		this.setupPhysicsWatcher();
		this.setupTweenWatcher();
		this.setupSceneWatcher();
		this.setupApplicationWatchers();
	}

	setupThreeJSWatcher() {
		if (!window.renderer || !window.renderer.info) return;
		
		const originalRender = window.renderer.render;
		window.renderer.render = (...args) => {
			const result = originalRender.apply(window.renderer, args);
			this.debouncedCheck('threejs', () => this.checkThreeJSChanges());
			return result;
		};
	}

	setupPhysicsWatcher() {
		if (!window.world) return;
		
		const originalCreateRigidBody = window.world.createRigidBody;
		const originalRemoveRigidBody = window.world.removeRigidBody;
		const originalCreateCollider = window.world.createCollider;
		const originalRemoveCollider = window.world.removeCollider;
		
		if (originalCreateRigidBody) {
			window.world.createRigidBody = (...args) => {
				const result = originalCreateRigidBody.apply(window.world, args);
				this.debouncedCheck('physics', () => this.checkPhysicsChanges());
				return result;
			};
		}
		
		if (originalRemoveRigidBody) {
			window.world.removeRigidBody = (...args) => {
				const result = originalRemoveRigidBody.apply(window.world, args);
				this.debouncedCheck('physics', () => this.checkPhysicsChanges());
				return result;
			};
		}
		
		if (originalCreateCollider) {
			window.world.createCollider = (...args) => {
				const result = originalCreateCollider.apply(window.world, args);
				this.debouncedCheck('physics', () => this.checkPhysicsChanges());
				return result;
			};
		}
		
		if (originalRemoveCollider) {
			window.world.removeCollider = (...args) => {
				const result = originalRemoveCollider.apply(window.world, args);
				this.debouncedCheck('physics', () => this.checkPhysicsChanges());
				return result;
			};
		}
	}

	setupTweenWatcher() {
		if (typeof TWEEN === 'undefined') return;
		
		const originalAdd = TWEEN.add;
		const originalRemove = TWEEN.remove;
		
		if (originalAdd) {
			TWEEN.add = (...args) => {
				const result = originalAdd.apply(TWEEN, args);
				this.debouncedCheck('tween', () => this.checkTweenChanges());
				return result;
			};
		}
		
		if (originalRemove) {
			TWEEN.remove = (...args) => {
				const result = originalRemove.apply(TWEEN, args);
				this.debouncedCheck('tween', () => this.checkTweenChanges());
				return result;
			};
		}
	}

	setupSceneWatcher() {
		if (!window.scene) return;
		
		const originalAdd = window.scene.add;
		const originalRemove = window.scene.remove;
		
		window.scene.add = (...args) => {
			const result = originalAdd.apply(window.scene, args);
			this.debouncedCheck('scene', () => this.checkSceneChanges());
			return result;
		};
		
		window.scene.remove = (...args) => {
			const result = originalRemove.apply(window.scene, args);
			this.debouncedCheck('scene', () => this.checkSceneChanges());
			return result;
		};
	}

	setupApplicationWatchers() {
		this.setupAssetStorageWatcher();
		this.setupBackgroundContainerWatcher();
		this.setupOverlayWatcher();
	}

	setupAssetStorageWatcher() {
		if (!window.AssetStorage) return;
		
		try {
			const storage = AssetStorage.get_instance();
			if (!storage) return;
			
			if (storage.dynamic_bodies && storage.dynamic_bodies.set) {
				const originalSet = storage.dynamic_bodies.set;
				const originalDelete = storage.dynamic_bodies.delete;
				
				storage.dynamic_bodies.set = (...args) => {
					const result = originalSet.apply(storage.dynamic_bodies, args);
					this.debouncedCheck('asset_storage', () => this.checkApplicationCollectionChanges());
					return result;
				};
				
				if (originalDelete) {
					storage.dynamic_bodies.delete = (...args) => {
						const result = originalDelete.apply(storage.dynamic_bodies, args);
						this.debouncedCheck('asset_storage', () => this.checkApplicationCollectionChanges());
						return result;
					};
				}
			}
			
			if (storage.mesh_body_pairs && storage.mesh_body_pairs.set) {
				const originalSet = storage.mesh_body_pairs.set;
				const originalDelete = storage.mesh_body_pairs.delete;
				
				storage.mesh_body_pairs.set = (...args) => {
					const result = originalSet.apply(storage.mesh_body_pairs, args);
					this.debouncedCheck('asset_storage', () => this.checkApplicationCollectionChanges());
					return result;
				};
				
				if (originalDelete) {
					storage.mesh_body_pairs.delete = (...args) => {
						const result = originalDelete.apply(storage.mesh_body_pairs, args);
						this.debouncedCheck('asset_storage', () => this.checkApplicationCollectionChanges());
						return result;
					};
				}
			}
		} catch (e) {
			console.log('AssetStorage watcher setup failed:', e.message);
		}
	}

	setupBackgroundContainerWatcher() {
		if (!window.background_container) return;
		
		const bg = window.background_container;
		
		if (bg.dynamic_bodies && Array.isArray(bg.dynamic_bodies)) {
			const originalPush = bg.dynamic_bodies.push;
			const originalSplice = bg.dynamic_bodies.splice;
			
			bg.dynamic_bodies.push = (...args) => {
				const result = originalPush.apply(bg.dynamic_bodies, args);
				this.debouncedCheck('background', () => this.checkApplicationCollectionChanges());
				return result;
			};
			
			bg.dynamic_bodies.splice = (...args) => {
				const result = originalSplice.apply(bg.dynamic_bodies, args);
				this.debouncedCheck('background', () => this.checkApplicationCollectionChanges());
				return result;
			};
		}
		
		if (bg.dropped_asset_colliders && bg.dropped_asset_colliders.set) {
			const originalSet = bg.dropped_asset_colliders.set;
			const originalDelete = bg.dropped_asset_colliders.delete;
			
			bg.dropped_asset_colliders.set = (...args) => {
				const result = originalSet.apply(bg.dropped_asset_colliders, args);
				this.debouncedCheck('background', () => this.checkApplicationCollectionChanges());
				return result;
			};
			
			if (originalDelete) {
				bg.dropped_asset_colliders.delete = (...args) => {
					const result = originalDelete.apply(bg.dropped_asset_colliders, args);
					this.debouncedCheck('background', () => this.checkApplicationCollectionChanges());
					return result;
				};
			}
		}
	}

	setupOverlayWatcher() {
		if (!window.viewable_container) return;
		
		try {
			const overlay = window.viewable_container.get_overlay();
			if (!overlay) return;
			
			if (overlay.particles && Array.isArray(overlay.particles)) {
				const originalPush = overlay.particles.push;
				const originalSplice = overlay.particles.splice;
				
				overlay.particles.push = (...args) => {
					const result = originalPush.apply(overlay.particles, args);
					this.debouncedCheck('overlay', () => this.checkApplicationCollectionChanges());
					return result;
				};
				
				overlay.particles.splice = (...args) => {
					const result = originalSplice.apply(overlay.particles, args);
					this.debouncedCheck('overlay', () => this.checkApplicationCollectionChanges());
					return result;
				};
			}
			
			if (overlay.hide_transition_map && overlay.hide_transition_map.set) {
				const originalSet = overlay.hide_transition_map.set;
				const originalDelete = overlay.hide_transition_map.delete;
				
				overlay.hide_transition_map.set = (...args) => {
					const result = originalSet.apply(overlay.hide_transition_map, args);
					this.debouncedCheck('overlay', () => this.checkApplicationCollectionChanges());
					return result;
				};
				
				if (originalDelete) {
					overlay.hide_transition_map.delete = (...args) => {
						const result = originalDelete.apply(overlay.hide_transition_map, args);
						this.debouncedCheck('overlay', () => this.checkApplicationCollectionChanges());
						return result;
					};
				}
			}
		} catch (e) {
			console.log('Overlay watcher setup failed:', e.message);
		}
	}

	debouncedCheck(key, checkFunction) {
		if (this.debounceTimers.has(key)) {
			clearTimeout(this.debounceTimers.get(key));
		}
		
		const timer = setTimeout(() => {
			checkFunction();
			this.debounceTimers.delete(key);
		}, this.debounceDelay);
		
		this.debounceTimers.set(key, timer);
	}

	checkThreeJSChanges() {
		const hasGrowth = this.analyzeThreeJSMemory();
		if (hasGrowth) {
			this.handleGrowthDetection();
		}
	}

	checkPhysicsChanges() {
		const hasGrowth = this.analyzePhysicsMemory();
		if (hasGrowth) {
			this.handleGrowthDetection();
		}
	}

	checkTweenChanges() {
		const hasGrowth = this.analyzeAnimationSystems();
		if (hasGrowth) {
			this.handleGrowthDetection();
		}
	}

	checkSceneChanges() {
		if (window.scene) {
			let objectCount = 0;
			window.scene.traverse(() => objectCount++);
			
			const lastSceneCount = this.lastCollectionSizes.get('scene.total_objects') || 0;
			const growth = objectCount - lastSceneCount;
			
			if (growth > 0) {
				console.warn(`🌳 Scene GROWTH: +${growth} (now ${objectCount})`);
				this.lastCollectionSizes.set('scene.total_objects', objectCount);
				this.handleGrowthDetection();
			} else if (growth < 0) {
				console.log(`🌳 Scene objects decreased: ${growth} (now ${objectCount})`);
				this.lastCollectionSizes.set('scene.total_objects', objectCount);
			}
		}
	}

	checkApplicationCollectionChanges() {
		const hasGrowth = this.analyzeApplicationCollections();
		if (hasGrowth) {
			this.handleGrowthDetection();
		}
	}

	handleGrowthDetection() {
		this.consecutiveGrowthCount++;
		
		if (this.consecutiveGrowthCount >= this.maxConsecutiveGrowth || !this.growthDetected) {
			console.log(`🚨 OBJECT GROWTH DETECTED (${this.consecutiveGrowthCount} events)`);
			this.growthDetected = true;
			this.consecutiveGrowthCount = 0;
		}
	}

	analyzeThreeJSMemory() {
		if (!window.renderer || !window.renderer.info) return false;
		
		const info = window.renderer.info;
		const currentCounts = {
			geometries: info.memory.geometries,
			textures: info.memory.textures,
			programs: info.programs ? info.programs.length : 0,
			calls: info.render.calls,
			triangles: info.render.triangles
		};
		
		let hasGrowth = false;
		
		if (this.lastThreeJSCounts) {
			const changes = {};
			
			Object.keys(currentCounts).forEach(key => {
				const change = currentCounts[key] - this.lastThreeJSCounts[key];
				if (change !== 0) {
					changes[key] = change;
					if (change > 0 && key !== 'calls' && key !== 'triangles') {
						hasGrowth = true;
					}
				}
			});
			
			if (hasGrowth) {
				console.warn(`📈 Three.js GROWTH:`, changes);
			}
		}
		
		console.log('Three.js Memory:', currentCounts);
		this.lastThreeJSCounts = currentCounts;
		return hasGrowth;
	}

	analyzePhysicsMemory() {
		if (!window.world) return false;
		
		let hasGrowth = false;
		try {
			const currentCounts = {
				bodies: window.world.bodies ? window.world.bodies.len() : 0,
				colliders: window.world.colliders ? window.world.colliders.len() : 0
			};
			
			if (this.lastRapierCounts) {
				const bodyGrowth = currentCounts.bodies - this.lastRapierCounts.bodies;
				const colliderGrowth = currentCounts.colliders - this.lastRapierCounts.colliders;
				
				if (bodyGrowth > 0 || colliderGrowth > 0) {
					console.warn(`⚡ Physics GROWTH: Bodies +${bodyGrowth}, Colliders +${colliderGrowth}`);
					hasGrowth = true;
				}
			}
			
			console.log('Physics Objects:', currentCounts);
			this.lastRapierCounts = currentCounts;
		} catch (error) {
			console.log('Physics analysis failed:', error.message);
		}
		return hasGrowth;
	}

	analyzeApplicationCollections() {
		const collections = this.gatherCollectionSizes();
		let hasGrowth = false;
		
		collections.forEach(({ name, size }) => {
			const lastSize = this.lastCollectionSizes.get(name) || 0;
			const growth = size - lastSize;
			
			if (growth > 0) {
				console.warn(`📦 ${name} GROWTH: +${growth} (now ${size})`);
				hasGrowth = true;
			} else if (size > 0) {
				console.log(`📦 ${name}: ${size}`);
			}
			
			this.lastCollectionSizes.set(name, size);
		});
		
		return hasGrowth;
	}

	gatherCollectionSizes() {
		const collections = [];
		
		if (window.AssetStorage) {
			try {
				const storage = AssetStorage.get_instance();
				if (storage) {
					if (storage.dynamic_bodies) {
						collections.push({ name: 'AssetStorage.dynamic_bodies', size: storage.dynamic_bodies.size });
					}
					if (storage.mesh_body_pairs) {
						collections.push({ name: 'AssetStorage.mesh_body_pairs', size: storage.mesh_body_pairs.size });
					}
				}
			} catch (e) {
				console.log('AssetStorage analysis failed:', e.message);
			}
		}
		
		if (window.background_container) {
			const bg = window.background_container;
			collections.push(
				{ name: 'background.dynamic_bodies', size: bg.dynamic_bodies ? bg.dynamic_bodies.length : 0 },
				{ name: 'background.dropped_asset_colliders', size: bg.dropped_asset_colliders ? bg.dropped_asset_colliders.size : 0 },
				{ name: 'background.asset_manifest', size: bg.asset_manifest ? bg.asset_manifest.size : 0 }
			);
		}
		
		if (window.viewable_container) {
			try {
				const overlay = window.viewable_container.get_overlay();
				if (overlay) {
					collections.push({ name: 'overlay.particles', size: overlay.particles ? overlay.particles.length : 0 });
					if (overlay.hide_transition_map) {
						collections.push({ name: 'overlay.hide_transition_map', size: overlay.hide_transition_map.size });
					}
				}
			} catch (e) {
				console.log('Overlay analysis failed:', e.message);
			}
		}
		
		if (window.scene) {
			let objectCount = 0;
			window.scene.traverse(() => objectCount++);
			collections.push({ name: 'scene.total_objects', size: objectCount });
		}
		
		return collections;
	}

	analyzeAnimationSystems() {
		let hasGrowth = false;
		
		if (typeof TWEEN !== 'undefined' && TWEEN.getAll) {
			const tweenCount = TWEEN.getAll().length;
			const growth = tweenCount - this.lastTweenCount;
			
			if (growth > 0) {
				console.warn(`🎬 Tween GROWTH: +${growth} (total: ${tweenCount})`);
				hasGrowth = true;
			} else if (tweenCount > 0) {
				console.log(`🎬 Active Tweens: ${tweenCount}`);
			}
			
			this.lastTweenCount = tweenCount;
		}
		
		if (window.asset_handler) {
			try {
				console.log('🎭 Asset Handler Active');
			} catch (e) {
				console.log('Animation analysis failed:', e.message);
			}
		}
		
		return hasGrowth;
	}

	analyzeEventSystems() {
		if (window.viewable_container) {
			try {
				const camManager = window.viewable_container.get_camera_manager();
				if (camManager && camManager.on_update_callbacks) {
					const callbackCount = camManager.on_update_callbacks.size;
					if (callbackCount > 0) {
						console.log(`📹 Camera Callbacks: ${callbackCount}`);
					}
				}
			} catch (e) {
				console.log('Camera analysis failed:', e.message);
			}
		}
		
		if (window.interactionManager) {
			const im = window.interactionManager;
			const activeStates = [];
			if (im.grabbed_object) activeStates.push('grabbed_object');
			if (im.resize_move) activeStates.push('resize_move');
			if (im.zoom_event) activeStates.push('zoom_event');
			
			if (activeStates.length > 0) {
				console.log(`🎯 Interaction States: ${activeStates.join(', ')}`);
			}
		}
	}

	forceAnalysis() {
		console.log(`🔍 FORCED ANALYSIS`);
		console.group('📊 Current Object State');
		this.analyzeThreeJSMemory();
		this.analyzePhysicsMemory();
		this.analyzeApplicationCollections();
		this.analyzeAnimationSystems();
		this.analyzeEventSystems();
		console.groupEnd();
	}

	getCurrentMemoryUsage() {
		if (performance.memory) {
			return {
				used: Math.round(performance.memory.usedJSHeapSize / 1048576),
				total: Math.round(performance.memory.totalJSHeapSize / 1048576),
				limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
			};
		}
		return null;
	}
}