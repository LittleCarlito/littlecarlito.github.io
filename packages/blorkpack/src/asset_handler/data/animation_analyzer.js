export class AnimationAnalyzer {
	static #instance = null;
	static #disposed = false;

	constructor() {
		if (AnimationAnalyzer.#instance) {
			throw new Error('AnimationAnalyzer is a singleton. Use AnimationAnalyzer.get_instance() instead.');
		}
		AnimationAnalyzer.#instance = this;
		AnimationAnalyzer.#disposed = false;
	}

	static get_instance() {
		if (AnimationAnalyzer.#disposed) {
			AnimationAnalyzer.#instance = null;
			AnimationAnalyzer.#disposed = false;
		}
		if (!AnimationAnalyzer.#instance) {
			AnimationAnalyzer.#instance = new AnimationAnalyzer();
		}
		return AnimationAnalyzer.#instance;
	}

	analyze(gltfData, assetType) {
		try {
			let hasAnimations = false;
			let animationCount = 0;
			let animationDetails = [];

			if (gltfData) {
				if (gltfData.animations && gltfData.animations.length > 0) {
					hasAnimations = true;
					animationCount = gltfData.animations.length;
					
					gltfData.animations.forEach((animation, index) => {
						const detail = {
							name: animation.name || `Animation_${index}`,
							duration: animation.duration || 0,
							tracks: animation.tracks ? animation.tracks.length : 0,
							trackTypes: []
						};
						
						if (animation.tracks) {
							animation.tracks.forEach(track => {
								const trackType = this.getTrackType(track.name);
								if (trackType && !detail.trackTypes.includes(trackType)) {
									detail.trackTypes.push(trackType);
								}
							});
						}
						
						animationDetails.push(detail);
					});
				}

				if (gltfData.scene) {
					gltfData.scene.traverse((child) => {
						if (child.isSkinnedMesh || child.isBone || child.skeleton) {
							if (!hasAnimations) {
								hasAnimations = true;
								animationDetails.push({
									name: 'Skeletal_Structure',
									type: 'skeleton',
									hasSkin: child.isSkinnedMesh,
									hasBones: child.isBone
								});
							}
						}
					});
				}
			}

			return {
				hasAnimations,
				animationCount,
				animationDetails
			};
		} catch (error) {
			console.error(`[AnimationAnalyzer] Error analyzing animation data for ${assetType}:`, error);
			return {
				hasAnimations: false,
				animationCount: 0,
				animationDetails: []
			};
		}
	}

	getTrackType(trackName) {
		if (trackName.includes('.position')) return 'position';
		if (trackName.includes('.rotation') || trackName.includes('.quaternion')) return 'rotation';
		if (trackName.includes('.scale')) return 'scale';
		if (trackName.includes('.morphTargetInfluences')) return 'morph';
		if (trackName.includes('.material')) return 'material';
		return 'unknown';
	}

	dispose() {
		if (!AnimationAnalyzer.#instance) return;
		AnimationAnalyzer.#disposed = true;
		AnimationAnalyzer.#instance = null;
	}

	static dispose_instance() {
		if (AnimationAnalyzer.#instance) {
			AnimationAnalyzer.#instance.dispose();
		}
	}
}