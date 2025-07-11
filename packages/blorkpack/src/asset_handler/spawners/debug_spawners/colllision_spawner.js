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

	/**
	 * Creates wireframe visualization for collision meshes
	 * @param {Object} collisionDetails - Collision analysis results from CollisionAnalyzer
	 * @param {THREE.Object3D} parentMesh - The parent mesh that contains collision meshes
	 * @param {string} assetType - The asset type for identification
	 * @returns {Promise<Array>} Array of created wireframe meshes
	 */
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
				this.collisionWireframes.set(parentMesh.uuid, wireframes);
				console.log(`[CollisionSpawner] ✅ Created ${wireframes.length} wireframes for ${assetType}`);
			}
		} catch (error) {
			console.error(`[CollisionSpawner] Error creating wireframes for ${assetType}:`, error);
		}

		return wireframes;
	}

	/**
	 * Creates wireframe for a single collision mesh
	 * @param {Object} collisionMeshInfo - Information about the collision mesh
	 * @param {THREE.Object3D} parentMesh - The parent mesh
	 * @param {string} assetType - The asset type
	 * @returns {Promise<THREE.Mesh>} The created wireframe mesh
	 */
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
            
            // Find the actual collision mesh in the hierarchy to get its world transform
            let actualCollisionMesh = null;
            parentMesh.traverse((child) => {
                if (child.isMesh && child.name === collisionMeshInfo.name) {
                    actualCollisionMesh = child;
                }
            });

            if (actualCollisionMesh) {
                // Use the actual collision mesh's world transform
                actualCollisionMesh.updateMatrixWorld(true);
                wireframeMesh.position.copy(actualCollisionMesh.getWorldPosition(new THREE.Vector3()));
                wireframeMesh.quaternion.copy(actualCollisionMesh.getWorldQuaternion(new THREE.Quaternion()));
                wireframeMesh.scale.copy(actualCollisionMesh.getWorldScale(new THREE.Vector3()));
            } else {
                // Fallback: manually calculate world transform
                // Get the parent mesh's world transform
                parentMesh.updateMatrixWorld(true);
                const parentWorldMatrix = parentMesh.matrixWorld.clone();
                
                // Create a matrix for the collision mesh's local transform
                const collisionMatrix = new THREE.Matrix4();
                collisionMatrix.compose(
                    collisionMeshInfo.position,
                    new THREE.Quaternion().setFromEuler(collisionMeshInfo.rotation),
                    collisionMeshInfo.scale
                );
                
                // Combine transforms: parent world * collision local
                const worldMatrix = parentWorldMatrix.clone().multiply(collisionMatrix);
                
                // Decompose the final world matrix
                const worldPosition = new THREE.Vector3();
                const worldQuaternion = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);
                
                wireframeMesh.position.copy(worldPosition);
                wireframeMesh.quaternion.copy(worldQuaternion);
                wireframeMesh.scale.copy(worldScale);
            }
            
            wireframeMesh.renderOrder = 999;
            
            wireframeMesh.userData.isCollisionWireframe = true;
            wireframeMesh.userData.parentAsset = parentMesh;
            wireframeMesh.userData.assetType = assetType;
            wireframeMesh.userData.collisionMeshName = collisionMeshInfo.name;
            wireframeMesh.userData.collisionType = collisionMeshInfo.type;
            wireframeMesh.userData.debugColor = randomColor;
            wireframeMesh.userData.actualCollisionMesh = actualCollisionMesh;

            // Add to scene directly since we're using world coordinates
            this.scene.add(wireframeMesh);

            console.log(`[CollisionSpawner] Created wireframe for collision mesh: ${collisionMeshInfo.name} (type: ${collisionMeshInfo.type}, color: 0x${randomColor.toString(16)})`);
            
            return wireframeMesh;
        } catch (error) {
            console.error(`[CollisionSpawner] Error creating wireframe for mesh ${collisionMeshInfo.name}:`, error);
            return null;
        }
    }

	/**
	 * Removes wireframes for a specific asset
	 * @param {THREE.Object3D} parentMesh - The parent mesh whose wireframes should be removed
	 */
	removeWireframesForAsset(parentMesh) {
		const wireframes = this.collisionWireframes.get(parentMesh.uuid);
		if (wireframes) {
			wireframes.forEach(wireframe => {
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
			this.collisionWireframes.delete(parentMesh.uuid);
			console.log(`[CollisionSpawner] Removed ${wireframes.length} wireframes for asset`);
		}
	}

	/**
	 * Updates wireframe positions to match their parent meshes
	 */
    updateWireframes() {
        this.collisionWireframes.forEach((wireframes, parentUuid) => {
            wireframes.forEach(wireframe => {
                if (wireframe.userData.actualCollisionMesh) {
                    // Use the actual collision mesh's current world transform
                    const collisionMesh = wireframe.userData.actualCollisionMesh;
                    collisionMesh.updateMatrixWorld(true);
                    
                    wireframe.position.copy(collisionMesh.getWorldPosition(new THREE.Vector3()));
                    wireframe.quaternion.copy(collisionMesh.getWorldQuaternion(new THREE.Quaternion()));
                    wireframe.scale.copy(collisionMesh.getWorldScale(new THREE.Vector3()));
                } else if (wireframe.userData.parentAsset) {
                    // Fallback to manual calculation
                    const parent = wireframe.userData.parentAsset;
                    parent.updateMatrixWorld(true);
                    
                    // This would need the original collision mesh info stored
                    // For now, keep the wireframe static relative to parent
                    console.warn('[CollisionSpawner] No collision mesh reference found for wireframe update');
                }
            });
        });
    }

	/**
	 * Gets all wireframes for a specific asset
	 * @param {THREE.Object3D} parentMesh - The parent mesh
	 * @returns {Array} Array of wireframe meshes
	 */
	getWireframesForAsset(parentMesh) {
		return this.collisionWireframes.get(parentMesh.uuid) || [];
	}

	/**
	 * Sets the visibility of all collision wireframes
	 * @param {boolean} visible - Whether wireframes should be visible
	 */
	setWireframeVisibility(visible) {
		this.collisionWireframes.forEach(wireframes => {
			wireframes.forEach(wireframe => {
				wireframe.visible = visible;
			});
		});
		console.log(`[CollisionSpawner] Set wireframe visibility to: ${visible}`);
	}

	/**
	 * Regenerates random colors for all existing wireframes
	 */
	regenerateWireframeColors() {
		this.shuffleColors();
		this.collisionWireframes.forEach(wireframes => {
			wireframes.forEach(wireframe => {
				if (wireframe.material) {
					const newColor = this.getRandomDebugColor();
					wireframe.material.color.setHex(newColor);
					wireframe.userData.debugColor = newColor;
				}
			});
		});
		console.log(`[CollisionSpawner] Regenerated random colors for all wireframes`);
	}

	/**
	 * Sets the color of all collision wireframes
	 * @param {number} color - Hex color value (e.g., 0xff0000 for red)
	 */
	setWireframeColor(color) {
		this.collisionWireframes.forEach(wireframes => {
			wireframes.forEach(wireframe => {
				if (wireframe.material) {
					wireframe.material.color.setHex(color);
					wireframe.userData.debugColor = color;
				}
			});
		});
		console.log(`[CollisionSpawner] Set wireframe color to: 0x${color.toString(16)}`);
	}

	/**
	 * Sets the opacity of all collision wireframes
	 * @param {number} opacity - Opacity value between 0 and 1
	 */
	setWireframeOpacity(opacity) {
		this.collisionWireframes.forEach(wireframes => {
			wireframes.forEach(wireframe => {
				if (wireframe.material) {
					wireframe.material.opacity = Math.max(0, Math.min(1, opacity));
				}
			});
		});
		console.log(`[CollisionSpawner] Set wireframe opacity to: ${opacity}`);
	}

	/**
	 * Gets statistics about current wireframes
	 * @returns {Object} Statistics object
	 */
	getWireframeStats() {
		let totalWireframes = 0;
		let assetsWithWireframes = 0;
		const colorDistribution = {};
		
		this.collisionWireframes.forEach(wireframes => {
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

	/**
	 * Clears all wireframes from the scene
	 */
	clearAllWireframes() {
		let totalCleared = 0;
		this.collisionWireframes.forEach(wireframes => {
			wireframes.forEach(wireframe => {
				if (wireframe.parent) {
					wireframe.parent.remove(wireframe);
				}
				if (wireframe.geometry) {
					wireframe.geometry.dispose();
				}
				if (wireframe.material) {
					wireframe.material.dispose();
				}
				totalCleared++;
			});
		});
		this.collisionWireframes.clear();
		console.log(`[CollisionSpawner] Cleared ${totalCleared} wireframes`);
	}

	/**
	 * Disposes of the spawner instance
	 */
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