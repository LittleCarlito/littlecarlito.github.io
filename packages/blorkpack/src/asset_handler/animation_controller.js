import { THREE } from "../index.js";
import { AssetStorage } from "../asset_storage.js";
import CustomTypeManager from "../custom_type_manager.js";
import { AnimationAnalyzer } from './data/animation_analyzer.js';

const ANIMATION_LOGS_ENABLED = false;

function filterBadAnimationTracks(gltf) {
    if (!gltf.animations || gltf.animations.length === 0) return;
    
    gltf.animations = gltf.animations.filter(animation => {
        if (!animation.tracks) return false;
        
        animation.tracks = animation.tracks.filter(track => {
            const trackName = track.name;
            
            if (trackName.includes('.morphTargetInfluences')) {
                return false;
            }
            
            return true;
        });
        
        if (animation.tracks.length === 0) {
            return false;
        }
        return true;
    });
}

export class AnimationController {
	static #instance = null;
	static #disposed = false;
	animationAnalyzer;
	animationMixers = new Map();

	constructor() {
		if (AnimationController.#instance) {
			throw new Error('AnimationController is a singleton. Use AnimationController.get_instance() instead.');
		}
		this.animationAnalyzer = AnimationAnalyzer.get_instance();
		this.animationMixers = new Map();
		AnimationController.#instance = this;
		AnimationController.#disposed = false;
	}

	static get_instance() {
		if (AnimationController.#disposed) {
			AnimationController.#instance = null;
			AnimationController.#disposed = false;
		}
		if (!AnimationController.#instance) {
			AnimationController.#instance = new AnimationController();
		}
		return AnimationController.#instance;
	}

	analyzeAssetAnimations(spawnResult, assetType) {
		if (!spawnResult || !spawnResult.mesh) {
			return null;
		}

		try {
			const storage = AssetStorage.get_instance();
			const customTypeKey = CustomTypeManager.getType(assetType);
			
			if (storage.cached_models && storage.cached_models.has(customTypeKey)) {
				const gltfData = storage.cached_models.get(customTypeKey);
				
				filterBadAnimationTracks(gltfData);
				
				const animationAnalysis = this.animationAnalyzer.analyze(gltfData, assetType);
				
				if (animationAnalysis.hasAnimations) {
					spawnResult.mesh.userData.hasAnimations = true;
					spawnResult.mesh.userData.animationData = animationAnalysis;
					spawnResult.hasAnimations = true;
					spawnResult.animationData = animationAnalysis;
					
					if (animationAnalysis.animationCount > 0) {
						this.startAnimations(spawnResult, gltfData);
					}
				} else {
					spawnResult.mesh.userData.hasAnimations = false;
				}
				
				return animationAnalysis;
			} else {
				if (ANIMATION_LOGS_ENABLED) {
					console.warn(`[AnimationController] No cached GLTF data found for ${assetType}, cannot analyze animations`);
				}
			}
		} catch (error) {
			console.error(`[AnimationController] Error analyzing animations for ${assetType}:`, error);
			spawnResult.mesh.userData.hasAnimations = false;
		}
		
		return null;
	}

	startAnimations(spawnResult, gltfData) {
		if (!gltfData.animations || gltfData.animations.length === 0) {
			return;
		}

		const mixer = new THREE.AnimationMixer(spawnResult.mesh);
		const actions = [];

		gltfData.animations.forEach((clip, index) => {
			const action = mixer.clipAction(clip);
			action.setLoop(THREE.LoopOnce);
			action.clampWhenFinished = true;
			actions.push(action);
		});

		const animationState = {
			mixer: mixer,
			actions: actions,
			mesh: spawnResult.mesh,
			currentAnimationIndex: 0,
			isPlaying: false,
			onFinishedListener: null
		};

		this.animationMixers.set(spawnResult.instance_id, animationState);

		spawnResult.mesh.userData.animationMixer = mixer;
		spawnResult.mesh.userData.animationActions = actions;
		spawnResult.animationMixer = mixer;
		spawnResult.animationActions = actions;

		spawnResult.playAnimation = (animationIndex = null) => {
			if (animationIndex !== null && actions[animationIndex]) {
				this.playSpecificAnimation(animationState, animationIndex);
			} else {
				this.startNextAnimation(animationState);
			}
		};

		spawnResult.stopAnimation = (animationIndex = null) => {
			if (animationIndex !== null && actions[animationIndex]) {
				actions[animationIndex].stop();
			} else {
				actions.forEach((action, index) => {
					action.stop();
				});
				animationState.isPlaying = false;
			}
		};

		spawnResult.pauseAnimation = (animationIndex = null) => {
			if (animationIndex !== null && actions[animationIndex]) {
				actions[animationIndex].paused = true;
			} else {
				actions.forEach(action => {
					action.paused = true;
				});
			}
		};

		spawnResult.resumeAnimation = (animationIndex = null) => {
			if (animationIndex !== null && actions[animationIndex]) {
				actions[animationIndex].paused = false;
			} else {
				actions.forEach(action => {
					action.paused = false;
				});
			}
		};

		spawnResult.mesh.userData.playAnimation = spawnResult.playAnimation;
		spawnResult.mesh.userData.stopAnimation = spawnResult.stopAnimation;
		spawnResult.mesh.userData.pauseAnimation = spawnResult.pauseAnimation;
		spawnResult.mesh.userData.resumeAnimation = spawnResult.resumeAnimation;
	}

	startNextAnimation(animationState) {
		if (animationState.actions.length === 0) return;

		const currentAction = animationState.actions[animationState.currentAnimationIndex];
		
		if (animationState.onFinishedListener) {
			animationState.mixer.removeEventListener('finished', animationState.onFinishedListener);
		}
		
		const onAnimationFinished = () => {			
			animationState.currentAnimationIndex = (animationState.currentAnimationIndex + 1) % animationState.actions.length;
			
			this.startNextAnimation(animationState);
		};

		animationState.onFinishedListener = onAnimationFinished;
		currentAction.reset();
		currentAction.play();
		animationState.isPlaying = true;
		
		animationState.mixer.addEventListener('finished', onAnimationFinished);
	}

	playSpecificAnimation(animationState, animationIndex) {
		if (animationIndex < 0 || animationIndex >= animationState.actions.length) {
			if (ANIMATION_LOGS_ENABLED) {
				console.warn(`[AnimationController] Invalid animation index: ${animationIndex}`);
			}
			return;
		}

		animationState.actions.forEach(action => action.stop());
		
		animationState.currentAnimationIndex = animationIndex;
		const action = animationState.actions[animationIndex];
		action.reset();
		action.play();
		animationState.isPlaying = true;
	}

	updateAnimations(deltaTime) {
		this.animationMixers.forEach((animationData, instanceId) => {
			if (animationData.mixer) {
				animationData.mixer.update(deltaTime);
			}
		});
	}

	stopAllAnimations() {
		this.animationMixers.forEach((animationData, instanceId) => {
			if (animationData.actions) {
				animationData.actions.forEach(action => {
					action.stop();
				});
			}
			animationData.isPlaying = false;
		});
	}

	removeAnimationMixer(instanceId) {
		if (this.animationMixers.has(instanceId)) {
			const animationData = this.animationMixers.get(instanceId);
			if (animationData.mixer) {
				if (animationData.onFinishedListener) {
					animationData.mixer.removeEventListener('finished', animationData.onFinishedListener);
				}
				animationData.mixer.stopAllAction();
			}
			this.animationMixers.delete(instanceId);
		}
	}

	cleanup() {
		this.animationMixers.forEach((animationData, instanceId) => {
			if (animationData.mixer) {
				if (animationData.onFinishedListener) {
					animationData.mixer.removeEventListener('finished', animationData.onFinishedListener);
				}
				animationData.mixer.stopAllAction();
			}
		});
		this.animationMixers.clear();
	}

	dispose() {
		if (!AnimationController.#instance) return;
		this.cleanup();
		if (this.animationAnalyzer) {
			this.animationAnalyzer.dispose();
		}
		this.animationAnalyzer = null;
		AnimationController.#disposed = true;
		AnimationController.#instance = null;
	}
}