/**
 * Analyzes 3D assets for collision meshes with "col_" prefix naming convention
 */
export class CollisionAnalyzer {
	static #instance = null;
	static #disposed = false;

	constructor() {
		if (CollisionAnalyzer.#instance) {
			throw new Error('CollisionAnalyzer is a singleton. Use CollisionAnalyzer.get_instance() instead.');
		}
		CollisionAnalyzer.#instance = this;
		CollisionAnalyzer.#disposed = false;
	}

	static get_instance() {
		if (CollisionAnalyzer.#disposed) {
			CollisionAnalyzer.#instance = null;
			CollisionAnalyzer.#disposed = false;
		}
		if (!CollisionAnalyzer.#instance) {
			CollisionAnalyzer.#instance = new CollisionAnalyzer();
		}
		return CollisionAnalyzer.#instance;
	}

	/**
	 * Analyzes a mesh hierarchy for collision meshes with "col_" prefix
	 * @param {THREE.Object3D} mesh - The root mesh to analyze
	 * @param {string} assetType - The asset type for identification
	 * @returns {Object} Collision analysis results
	 */
	analyze(mesh, assetType) {
		if (!mesh) {
			console.warn('[CollisionAnalyzer] No mesh provided for analysis');
			return null;
		}

		try {
			const collisionMeshes = [];
			const allMeshes = [];
			
			// Traverse the mesh hierarchy to find collision meshes
			mesh.traverse((child) => {
				if (child.isMesh) {
					const meshInfo = {
						name: child.name,
						geometry: child.geometry,
						position: child.position.clone(),
						rotation: child.rotation.clone(),
						scale: child.scale.clone()
					};
					
					allMeshes.push(meshInfo);
					
					// Check if mesh name starts with "col_"
					if (this.isCollisionMesh(child.name)) {
						const collisionInfo = {
							...meshInfo,
							vertices: this.getVertexCount(child.geometry),
							triangles: this.getTriangleCount(child.geometry),
							boundingBox: this.getBoundingBox(child.geometry),
							type: this.inferCollisionType(child.name, child.geometry)
						};
						
						collisionMeshes.push(collisionInfo);
					}
				}
			});

			const collisionDetails = {
				hasCollisionMeshes: collisionMeshes.length > 0,
				collisionMeshes: collisionMeshes,
				totalMeshes: allMeshes.length,
				allMeshes: allMeshes,
				assetType: assetType,
				analyzedAt: Date.now()
			};

			return collisionDetails;
		} catch (error) {
			console.error(`[CollisionAnalyzer] Error analyzing collision meshes for ${assetType}:`, error);
			return null;
		}
	}

	/**
	 * Checks if a mesh name indicates it's a collision mesh
	 * @param {string} meshName - Name of the mesh
	 * @returns {boolean} True if this is a collision mesh
	 */
	isCollisionMesh(meshName) {
		if (!meshName || typeof meshName !== 'string') {
			return false;
		}
		
		const name = meshName.toLowerCase();
		return name.startsWith('col_') || 
			   name.startsWith('collision_') ||
			   name.includes('_col_') ||
			   name.endsWith('_col');
	}

	/**
	 * Gets the vertex count from geometry
	 * @param {THREE.BufferGeometry} geometry - The geometry to analyze
	 * @returns {number} Number of vertices
	 */
	getVertexCount(geometry) {
		if (!geometry || !geometry.attributes || !geometry.attributes.position) {
			return 0;
		}
		return geometry.attributes.position.count;
	}

	/**
	 * Gets the triangle count from geometry
	 * @param {THREE.BufferGeometry} geometry - The geometry to analyze
	 * @returns {number} Number of triangles
	 */
	getTriangleCount(geometry) {
		if (!geometry) {
			return 0;
		}
		
		if (geometry.index) {
			return geometry.index.count / 3;
		} else if (geometry.attributes && geometry.attributes.position) {
			return geometry.attributes.position.count / 3;
		}
		
		return 0;
	}

	/**
	 * Gets the bounding box of the geometry
	 * @param {THREE.BufferGeometry} geometry - The geometry to analyze
	 * @returns {Object} Bounding box information
	 */
	getBoundingBox(geometry) {
		if (!geometry) {
			return null;
		}

		try {
			geometry.computeBoundingBox();
			const box = geometry.boundingBox;
			
			if (!box) {
				return null;
			}

			return {
				min: { x: box.min.x, y: box.min.y, z: box.min.z },
				max: { x: box.max.x, y: box.max.y, z: box.max.z },
				size: {
					x: box.max.x - box.min.x,
					y: box.max.y - box.min.y,
					z: box.max.z - box.min.z
				},
				center: {
					x: (box.min.x + box.max.x) / 2,
					y: (box.min.y + box.max.y) / 2,
					z: (box.min.z + box.max.z) / 2
				}
			};
		} catch (error) {
			console.warn('[CollisionAnalyzer] Error computing bounding box:', error);
			return null;
		}
	}

	/**
	 * Attempts to infer the collision type based on naming and geometry
	 * @param {string} meshName - Name of the collision mesh
	 * @param {THREE.BufferGeometry} geometry - The geometry to analyze
	 * @returns {string} Inferred collision type
	 */
	inferCollisionType(meshName, geometry) {
		const name = meshName.toLowerCase();
		
		// Check for specific collision type indicators in the name
		if (name.includes('box') || name.includes('cube')) {
			return 'box';
		}
		if (name.includes('sphere') || name.includes('ball')) {
			return 'sphere';
		}
		if (name.includes('capsule') || name.includes('cylinder')) {
			return 'capsule';
		}
		if (name.includes('plane') || name.includes('ground') || name.includes('floor')) {
			return 'plane';
		}
		if (name.includes('convex')) {
			return 'convex';
		}
		if (name.includes('trimesh') || name.includes('mesh')) {
			return 'trimesh';
		}

		// Try to infer from geometry properties
		const triangleCount = this.getTriangleCount(geometry);
		const vertexCount = this.getVertexCount(geometry);
		
		if (triangleCount <= 12 && vertexCount <= 8) {
			return 'box';
		}
		if (triangleCount <= 50 && vertexCount <= 30) {
			return 'convex';
		}
		
		return 'trimesh';
	}

	/**
	 * Logs collision analysis results
	 * @param {Object} collisionDetails - Results from analyze()
	 * @param {string} assetType - The asset type being analyzed
	 */
	logResults(collisionDetails, assetType) {
		if (!collisionDetails) {
			console.warn(`[CollisionAnalyzer] No collision details to log for ${assetType}`);
			return;
		}

		if (collisionDetails.hasCollisionMeshes) {
			console.log(`[CollisionAnalyzer] 🔵 COLLISION MESHES DETECTED in ${assetType}:`, {
				collisionMeshCount: collisionDetails.collisionMeshes.length,
				totalMeshCount: collisionDetails.totalMeshes,
				collisionMeshes: collisionDetails.collisionMeshes.map(cm => ({
					name: cm.name,
					type: cm.type,
					vertices: cm.vertices,
					triangles: cm.triangles,
					boundingBox: cm.boundingBox ? {
						size: cm.boundingBox.size,
						center: cm.boundingBox.center
					} : null
				}))
			});
		} else {
			console.log(`[CollisionAnalyzer] ⚪ No collision meshes found in ${assetType} (${collisionDetails.totalMeshes} total meshes)`);
		}
	}

	/**
	 * Gets collision meshes by type
	 * @param {Object} collisionDetails - Results from analyze()
	 * @param {string} type - The collision type to filter by
	 * @returns {Array} Array of collision meshes of the specified type
	 */
	getCollisionMeshesByType(collisionDetails, type) {
		if (!collisionDetails || !collisionDetails.collisionMeshes) {
			return [];
		}
		
		return collisionDetails.collisionMeshes.filter(mesh => mesh.type === type);
	}

	/**
	 * Gets summary statistics for collision meshes
	 * @param {Object} collisionDetails - Results from analyze()
	 * @returns {Object} Summary statistics
	 */
	getSummaryStats(collisionDetails) {
		if (!collisionDetails || !collisionDetails.collisionMeshes) {
			return {
				totalCollisionMeshes: 0,
				totalVertices: 0,
				totalTriangles: 0,
				typeBreakdown: {}
			};
		}

		const stats = {
			totalCollisionMeshes: collisionDetails.collisionMeshes.length,
			totalVertices: 0,
			totalTriangles: 0,
			typeBreakdown: {}
		};

		collisionDetails.collisionMeshes.forEach(mesh => {
			stats.totalVertices += mesh.vertices || 0;
			stats.totalTriangles += mesh.triangles || 0;
			
			const type = mesh.type || 'unknown';
			if (!stats.typeBreakdown[type]) {
				stats.typeBreakdown[type] = 0;
			}
			stats.typeBreakdown[type]++;
		});

		return stats;
	}

	/**
	 * Disposes of the analyzer instance
	 */
	dispose() {
		CollisionAnalyzer.#disposed = true;
		CollisionAnalyzer.#instance = null;
	}

	static dispose_instance() {
		if (CollisionAnalyzer.#instance) {
			CollisionAnalyzer.#instance.dispose();
		}
	}
}