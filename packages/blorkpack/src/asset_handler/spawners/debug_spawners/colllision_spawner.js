import { THREE } from "../../../index.js";

/**
 * Handles spawning wireframes and debug visualizations for collision meshes
 */
export class CollisionSpawner {
	static #instance = null;
	static #disposed = false;
	scene;
	world;
	collisionWireframes = new Map();
	#debugColors = [
		0xff0000, // Red
		0x00ff00, // Green
		0x0000ff, // Blue
		0xffff00, // Yellow
		0xff00ff, // Magenta
		0x00ffff, // Cyan
		0xff8000, // Orange
		0x8000ff, // Purple
		0xff0080, // Pink
		0x80ff00, // Lime
		0x0080ff, // Light Blue
		0xff8080, // Light Red
		0x80ff80, // Light Green
		0x8080ff, // Light Blue
		0xffff80, // Light Yellow
		0xff80ff, // Light Magenta
		0x80ffff, // Light Cyan
		0xffc080, // Peach
		0xc080ff, // Lavender
		0x80ffc0, // Mint
		0xff4040, // Bright Red
		0x40ff40, // Bright Green
		0x4040ff, // Bright Blue
		0xffaa00, // Bright Orange
		0xaa00ff, // Bright Purple
		0x00aaff, // Bright Sky Blue
		0xffaa80, // Coral
		0xaa80ff, // Bright Lavender
		0x80aaff, // Periwinkle
		0xffff40  // Bright Yellow
	];
	#colorIndex = 0;
	#shuffledColors = [];

	constructor(scene = null, world = null) {
		if (CollisionSpawner.#instance) {
			throw new Error('CollisionSpawner is a singleton. Use CollisionSpawner.get_instance() instead.');
		}
		this.scene = scene;
		this.world = world;
		this.shuffleColors();
		CollisionSpawner.#instance = this;
		CollisionSpawner.#disposed = false;
	}

	static get_instance(scene, world) {
		if (CollisionSpawner.#disposed) {
			CollisionSpawner.#instance = null;
			CollisionSpawner.#disposed = false;
		}
		if (!CollisionSpawner.#instance) {
			CollisionSpawner.#instance = new CollisionSpawner(scene, world);
		} else if (scene || world) {
			if (scene) CollisionSpawner.#instance.scene = scene;
			if (world) CollisionSpawner.#instance.world = world;
		}
		return CollisionSpawner.#instance;
	}

	shuffleColors() {
		this.#shuffledColors = [...this.#debugColors];
		for (let i = this.#shuffledColors.length - 1; i > 0; i--) {
			const j = Math.floor((Math.random() * 1000 + Date.now()) % (i + 1));
			[this.#shuffledColors[i], this.#shuffledColors[j]] = [this.#shuffledColors[j], this.#shuffledColors[i]];
		}
		this.#colorIndex = 0;
	}

	getRandomDebugColor() {
		if (this.#colorIndex >= this.#shuffledColors.length) {
			this.shuffleColors();
		}
		const color = this.#shuffledColors[this.#colorIndex];
		this.#colorIndex++;
		return color;
	}

	async createWireframeForCollisionMeshes(collisionDetails, parentMesh, assetType) {
		if (!collisionDetails || !collisionDetails.hasCollisionMeshes) {
			return [];
		}

		if (!this.scene) {
			console.warn('[CollisionSpawner] No scene available for wireframe creation');
			return [];
		}

		const wireframes = [];
		
		try {
			console.log(`[CollisionSpawner] Creating wireframes for ${collisionDetails.collisionMeshes.length} collision meshes in ${assetType}`);
			
			for (const collisionMeshInfo of collisionDetails.collisionMeshes) {
				const wireframe = await this.createWireframeForMesh(collisionMeshInfo, parentMesh, assetType);
				if (wireframe) {
					wireframes.push(wireframe);
				}
			}
			
			if (wireframes.length > 0) {
				if (!parentMesh.userData.collisionWireframes) {
					parentMesh.userData.collisionWireframes = [];
				}
				parentMesh.userData.collisionWireframes.push(...wireframes);
				
				this.addWireframeMethodsToAsset(parentMesh);
				this.collisionWireframes.set(parentMesh.uuid, wireframes);
				
				console.log(`[CollisionSpawner] ✅ Created ${wireframes.length} wireframes for ${assetType} and stored in asset`);
			}
		} catch (error) {
			console.error(`[CollisionSpawner] Error creating wireframes for ${assetType}:`, error);
		}

		return wireframes;
	}

	addWireframeMethodsToAsset(asset) {
		asset.userData.enableCollisionWireframes = () => {
			if (asset.userData.collisionWireframes) {
				asset.userData.collisionWireframes.forEach(wireframe => {
					wireframe.visible = true;
					if (!wireframe.parent) {
						this.scene.add(wireframe);
					}
				});
				asset.userData.collisionWireframesEnabled = true;
				console.log(`[Asset] Enabled collision wireframes for ${asset.name}`);
			}
		};

		asset.userData.disableCollisionWireframes = () => {
			if (asset.userData.collisionWireframes) {
				asset.userData.collisionWireframes.forEach(wireframe => {
					wireframe.visible = false;
				});
				asset.userData.collisionWireframesEnabled = false;
				console.log(`[Asset] Disabled collision wireframes for ${asset.name}`);
			}
		};

		asset.userData.toggleCollisionWireframes = () => {
			if (asset.userData.collisionWireframesEnabled) {
				asset.userData.disableCollisionWireframes();
			} else {
				asset.userData.enableCollisionWireframes();
			}
			return asset.userData.collisionWireframesEnabled;
		};

		asset.userData.areCollisionWireframesEnabled = () => {
			return asset.userData.collisionWireframesEnabled || false;
		};

		asset.userData.getCollisionWireframeCount = () => {
			return asset.userData.collisionWireframes ? asset.userData.collisionWireframes.length : 0;
		};

		// FIXED UPDATE METHOD
		asset.userData.updateCollisionWireframes = () => {
			if (asset.userData.collisionWireframes) {
				asset.userData.collisionWireframes.forEach(wireframe => {
					if (wireframe.userData.actualCollisionMesh) {
						const collisionMesh = wireframe.userData.actualCollisionMesh;
						
						// Force matrix updates through the entire hierarchy
						let current = collisionMesh;
						while (current) {
							current.updateMatrixWorld(true);
							current = current.parent;
						}
						
						// Get the actual world transform
						const worldPosition = new THREE.Vector3();
						const worldQuaternion = new THREE.Quaternion();
						const worldScale = new THREE.Vector3();
						
						collisionMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
						
						wireframe.position.copy(worldPosition);
						wireframe.quaternion.copy(worldQuaternion);
						wireframe.scale.copy(worldScale);
					}
				});
			}
		};

		asset.userData.setCollisionWireframeColor = (color) => {
			if (asset.userData.collisionWireframes) {
				asset.userData.collisionWireframes.forEach(wireframe => {
					if (wireframe.material) {
						wireframe.material.color.setHex(color);
						wireframe.userData.debugColor = color;
					}
				});
				console.log(`[Asset] Set collision wireframe color to 0x${color.toString(16)} for ${asset.name}`);
			}
		};

		asset.userData.setCollisionWireframeOpacity = (opacity) => {
			if (asset.userData.collisionWireframes) {
				asset.userData.collisionWireframes.forEach(wireframe => {
					if (wireframe.material) {
						wireframe.material.opacity = Math.max(0, Math.min(1, opacity));
					}
				});
				console.log(`[Asset] Set collision wireframe opacity to ${opacity} for ${asset.name}`);
			}
		};

		asset.userData.disposeCollisionWireframes = () => {
			if (asset.userData.collisionWireframes) {
				asset.userData.collisionWireframes.forEach(wireframe => {
					if (wireframe.parent) {
						wireframe.parent.remove(wireframe);
					}
					if (wireframe.geometry) {
						wireframe.geometry.dispose();
					}
					if (wireframe.material) {
						wireframe.material.dispose();
					}
				});
				asset.userData.collisionWireframes = [];
				asset.userData.collisionWireframesEnabled = false;
				console.log(`[Asset] Disposed collision wireframes for ${asset.name}`);
			}
		};

		asset.userData.collisionWireframesEnabled = false;
	}

	async createWireframeForMesh(collisionMeshInfo, parentMesh, assetType) {
		try {
			const wireframeGeometry = collisionMeshInfo.geometry.clone();
			
			const randomColor = this.getRandomDebugColor();
			const wireframeMaterial = new THREE.MeshBasicMaterial({
				color: randomColor,
				wireframe: true,
				transparent: true,
				opacity: 0.7,
				side: THREE.DoubleSide
			});

			const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
			
			let actualCollisionMesh = null;
			parentMesh.traverse((child) => {
				if (child.isMesh && child.name === collisionMeshInfo.name) {
					actualCollisionMesh = child;
				}
			});

			if (actualCollisionMesh) {
				// Force matrix updates through hierarchy
				let current = actualCollisionMesh;
				while (current) {
					current.updateMatrixWorld(true);
					current = current.parent;
				}
				
				const worldPosition = new THREE.Vector3();
				const worldQuaternion = new THREE.Quaternion();
				const worldScale = new THREE.Vector3();
				
				actualCollisionMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
				
				wireframeMesh.position.copy(worldPosition);
				wireframeMesh.quaternion.copy(worldQuaternion);
				wireframeMesh.scale.copy(worldScale);
			} else {
				parentMesh.updateMatrixWorld(true);
				const parentWorldMatrix = parentMesh.matrixWorld.clone();
				
				const collisionMatrix = new THREE.Matrix4();
				collisionMatrix.compose(
					collisionMeshInfo.position,
					new THREE.Quaternion().setFromEuler(collisionMeshInfo.rotation),
					collisionMeshInfo.scale
				);
				
				const worldMatrix = parentWorldMatrix.clone().multiply(collisionMatrix);
				
				const worldPosition = new THREE.Vector3();
				const worldQuaternion = new THREE.Quaternion();
				const worldScale = new THREE.Vector3();
				worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);
				
				wireframeMesh.position.copy(worldPosition);
				wireframeMesh.quaternion.copy(worldQuaternion);
				wireframeMesh.scale.copy(worldScale);
			}
			
			wireframeMesh.renderOrder = 999;
			wireframeMesh.visible = false;
			
			wireframeMesh.userData.isCollisionWireframe = true;
			wireframeMesh.userData.parentAsset = parentMesh;
			wireframeMesh.userData.assetType = assetType;
			wireframeMesh.userData.collisionMeshName = collisionMeshInfo.name;
			wireframeMesh.userData.collisionType = collisionMeshInfo.type;
			wireframeMesh.userData.debugColor = randomColor;
			wireframeMesh.userData.actualCollisionMesh = actualCollisionMesh;

			console.log(`[CollisionSpawner] Created wireframe for collision mesh: ${collisionMeshInfo.name} (type: ${collisionMeshInfo.type}, color: 0x${randomColor.toString(16)})`);
			
			return wireframeMesh;
		} catch (error) {
			console.error(`[CollisionSpawner] Error creating wireframe for mesh ${collisionMeshInfo.name}:`, error);
			return null;
		}
	}

	removeWireframesForAsset(parentMesh) {
		if (parentMesh.userData.disposeCollisionWireframes) {
			parentMesh.userData.disposeCollisionWireframes();
		}
		this.collisionWireframes.delete(parentMesh.uuid);
	}

	// FIXED GLOBAL UPDATE METHOD
	updateWireframes() {
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset && parentAsset.userData.updateCollisionWireframes) {
					parentAsset.userData.updateCollisionWireframes();
				}
			});
		});
	}

	getWireframesForAsset(parentMesh) {
		return parentMesh.userData.collisionWireframes || [];
	}

	setWireframeVisibility(visible) {
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset) {
					if (visible) {
						parentAsset.userData.enableCollisionWireframes();
					} else {
						parentAsset.userData.disableCollisionWireframes();
					}
				}
			});
		});
		console.log(`[CollisionSpawner] Set wireframe visibility to: ${visible}`);
	}

	enableAllCollisionWireframes() {
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset && parentAsset.userData.enableCollisionWireframes) {
					parentAsset.userData.enableCollisionWireframes();
				}
			});
		});
		console.log('[CollisionSpawner] Enabled wireframes for all assets');
	}

	disableAllCollisionWireframes() {
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset && parentAsset.userData.disableCollisionWireframes) {
					parentAsset.userData.disableCollisionWireframes();
				}
			});
		});
		console.log('[CollisionSpawner] Disabled wireframes for all assets');
	}

	regenerateWireframeColors() {
		this.shuffleColors();
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset && parentAsset.userData.setCollisionWireframeColor) {
					const newColor = this.getRandomDebugColor();
					parentAsset.userData.setCollisionWireframeColor(newColor);
				}
			});
		});
		console.log(`[CollisionSpawner] Regenerated random colors for all wireframes`);
	}

	setWireframeColor(color) {
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset && parentAsset.userData.setCollisionWireframeColor) {
					parentAsset.userData.setCollisionWireframeColor(color);
				}
			});
		});
		console.log(`[CollisionSpawner] Set wireframe color to: 0x${color.toString(16)}`);
	}

	setWireframeOpacity(opacity) {
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset && parentAsset.userData.setCollisionWireframeOpacity) {
					parentAsset.userData.setCollisionWireframeOpacity(opacity);
				}
			});
		});
		console.log(`[CollisionSpawner] Set wireframe opacity to: ${opacity}`);
	}

	getWireframeStats() {
		let totalWireframes = 0;
		let assetsWithWireframes = 0;
		const colorDistribution = {};
		
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			totalWireframes += wireframes.length;
			assetsWithWireframes++;
			
			wireframes.forEach(wireframe => {
				const color = wireframe.userData.debugColor;
				if (color !== undefined) {
					const colorHex = `0x${color.toString(16)}`;
					colorDistribution[colorHex] = (colorDistribution[colorHex] || 0) + 1;
				}
			});
		});
		
		return {
			totalWireframes,
			assetsWithWireframes,
			averageWireframesPerAsset: assetsWithWireframes > 0 ? totalWireframes / assetsWithWireframes : 0,
			colorDistribution
		};
	}

	clearAllWireframes() {
		let totalCleared = 0;
		this.collisionWireframes.forEach((wireframes, parentUuid) => {
			wireframes.forEach(wireframe => {
				const parentAsset = wireframe.userData.parentAsset;
				if (parentAsset && parentAsset.userData.disposeCollisionWireframes) {
					parentAsset.userData.disposeCollisionWireframes();
				}
				totalCleared++;
			});
		});
		this.collisionWireframes.clear();
		console.log(`[CollisionSpawner] Cleared ${totalCleared} wireframes`);
	}

	dispose() {
		this.clearAllWireframes();
		this.scene = null;
		this.world = null;
		CollisionSpawner.#disposed = true;
		CollisionSpawner.#instance = null;
	}

	static dispose_instance() {
		if (CollisionSpawner.#instance) {
			CollisionSpawner.#instance.dispose();
		}
	}
}