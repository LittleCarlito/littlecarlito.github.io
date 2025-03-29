import { THREE } from "../../../index.js";
import { BLORKPACK_FLAGS } from "../../../blorkpack_flags.js";
import { CollisionFactory } from "../../factories/collision_factory.js";

// Map to track debug meshes - persistent between function calls
const debugMeshes = new Map();

/**
 * Creates a debug wireframe for visualizing physics shapes
 * @param {THREE.Scene} scene - The scene to add the wireframe to
 * @param {RAPIER.World} world - The physics world
 * @param {string} type - The type of wireframe to create
 * @param {Object} dimensions - The dimensions of the wireframe
 * @param {THREE.Vector3} position - The position of the wireframe
 * @param {THREE.Quaternion} rotation - The rotation of the wireframe
 * @param {Object} options - Additional options for the wireframe
 * @returns {Promise<THREE.Mesh>} The created wireframe mesh
 */
export async function create_debug_wireframe(scene, world, type, dimensions, position, rotation, options = {}) {
	const collision_factory = CollisionFactory.get_instance(world);
	const mesh = await collision_factory.create_debug_wireframe(type, dimensions, position, rotation, options);
    
	// Add objects to scene in next frame to prevent stuttering
	await new Promise(resolve => setTimeout(resolve, 0));
    
	// Only add to scene and store if debug is enabled
	if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
		scene.add(mesh);
		debugMeshes.set(mesh.uuid, mesh);
	}
    
	return mesh;
}

/**
 * Updates the positions of debug wireframes based on physics bodies
 * 
 * @param {Object} storage - AssetStorage instance
 */
export function update_debug_wireframes(storage) {
	if (!BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) return;
    
	// Get all dynamic bodies from storage
	const dynamicBodies = storage.get_all_dynamic_bodies();
    
	// Update existing wireframes
	debugMeshes.forEach((mesh) => {
		// Find the matching body for this wireframe
		let foundBody = null;
        
		// Try to find by physicsBodyId if available
		if (mesh.userData.physicsBodyId) {
			// Find the body with this ID
			for (const [bodyMesh, body] of dynamicBodies) {
				if (body.handle === mesh.userData.physicsBodyId) {
					foundBody = body;
					break;
				}
			}
		}
        
		// If not found by ID, try to find by mesh
		if (!foundBody) {
			const bodyPair = storage.get_body_pair_by_mesh(mesh);
			if (bodyPair) {
				foundBody = bodyPair[1];
			}
		}
        
		// Update position and rotation if body found
		if (foundBody) {
			const position = foundBody.translation();
			mesh.position.set(position.x, position.y, position.z);
			const rotation = foundBody.rotation();
			mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
		}
	});
}

/**
 * Sets the collision debug state
 * 
 * @param {THREE.Scene} scene - The scene containing wireframes
 * @param {RAPIER.World} world - The physics world
 * @param {Object} storage - AssetStorage instance
 * @param {boolean} enabled - Whether collision debug should be enabled
 */
export async function set_collision_debug(scene, world, storage, enabled) {
	// Set the flag
	BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG = enabled;
    
	// Clear all existing wireframes if disabling
	if (!enabled) {
		debugMeshes.forEach((mesh) => {
			if (mesh.parent) {
				mesh.parent.remove(mesh);
			}
			if (mesh.geometry) {
				mesh.geometry.dispose();
			}
			if (mesh.material) {
				mesh.material.dispose();
			}
		});
		debugMeshes.clear();
		return;
	}
    
	// If enabling, create wireframes for all bodies
	await create_debug_wireframes_for_all_bodies(scene, world, storage);
}

/**
 * Creates debug wireframes for all physics bodies
 * 
 * @param {THREE.Scene} scene - The scene to add wireframes to
 * @param {RAPIER.World} world - The physics world
 * @param {Object} storage - AssetStorage instance
 */
export async function create_debug_wireframes_for_all_bodies(scene, world, storage) {
	// First clear any existing wireframes
	debugMeshes.forEach((mesh) => {
		if (mesh.parent) {
			mesh.parent.remove(mesh);
		}
		if (mesh.geometry) {
			mesh.geometry.dispose();
		}
		if (mesh.material) {
			mesh.material.dispose();
		}
	});
	debugMeshes.clear();
    
	if(BLORKPACK_FLAGS.ASSET_LOGS) {
		console.log("Creating all debug wireframes");
	}
    
	// Get all dynamic bodies from storage
	const dynamicBodies = storage.get_all_dynamic_bodies();
    
	// Create a debug wireframe for each body
	for (const [mesh, body] of dynamicBodies) {
		if (!body) continue;
        
		// Get the body position and rotation
		const position = body.translation();
		const rotation = body.rotation();
        
		// Try to find collision meshes in the object hierarchy
		const collisionMeshes = [];
		mesh.traverse((child) => {
			if (child.isMesh && child.name.startsWith('col_')) {
				collisionMeshes.push(child);
			}
		});
        
		if (collisionMeshes.length > 0) {
			// Create wireframes for each collision mesh
			for (const colMesh of collisionMeshes) {
				// Get the world transform of the collision mesh
				const worldPosition = new THREE.Vector3();
				const worldQuaternion = new THREE.Quaternion();
				const worldScale = new THREE.Vector3();
				colMesh.updateWorldMatrix(true, false);
				colMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
                
				// Clone the geometry to create an exact wireframe representation
				const clonedGeometry = colMesh.geometry.clone();
                
				if(BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log(`Creating dynamic wireframe for: ${colMesh.name}`);
				}
                
				// Create a wireframe using the actual collision mesh geometry
				await create_debug_wireframe(
					scene,
					world,
					'mesh',
					null,  // Dimensions not needed when using actual geometry
					worldPosition,
					worldQuaternion,
					{ 
						bodyId: body.handle,
						geometry: clonedGeometry,
						originalObject: colMesh,
						objectId: colMesh.id,
						scale: worldScale,
						isStatic: false // Explicitly mark as NOT static
					}
				);
			}
		} else {
			// No collision meshes, create wireframe based on object bounds
			const boundingBox = new THREE.Box3().setFromObject(mesh);
			const size = boundingBox.getSize(new THREE.Vector3());
			const center = boundingBox.getCenter(new THREE.Vector3());
            
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Creating fallback dynamic wireframe for: ${mesh.name}`);
			}
            
			// Create the debug wireframe
			await create_debug_wireframe(
				scene,
				world,
				'cuboid', 
				{ 
					x: size.x * 0.5, 
					y: size.y * 0.5, 
					z: size.z * 0.5 
				}, 
				center, 
				mesh.quaternion,
				{ 
					bodyId: body.handle,
					originalObject: mesh,
					objectId: mesh.id,
					isStatic: false // Explicitly mark as NOT static
				}
			);
		}
	}
    
	// Also check for static bodies that might have physics
	const staticMeshes = storage.get_all_static_meshes();
    
	for (const mesh of staticMeshes) {
		if (!mesh) continue;
        
		// Only process static meshes that might have collision (like rooms)
		if (mesh.name.includes('ROOM') || mesh.name.includes('FLOOR')) {
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Processing static mesh: ${mesh.name}`);
			}
            
			// Create a simple green wireframe for the static mesh
			const boundingBox = new THREE.Box3().setFromObject(mesh);
			const size = boundingBox.getSize(new THREE.Vector3());
			const center = boundingBox.getCenter(new THREE.Vector3());
            
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Creating static wireframe for room: ${mesh.name}`);
			}
            
			await create_debug_wireframe(
				scene,
				world,
				'cuboid', 
				{ 
					x: size.x * 0.5, 
					y: size.y * 0.5, 
					z: size.z * 0.5 
				}, 
				center, 
				mesh.quaternion,
				{ 
					originalObject: mesh,
					objectId: mesh.id,
					isStatic: true  // Explicitly mark as static
				}
			);
		}
	}
}

/**
 * Cleans up all wireframe debug meshes
 * 
 * @param {THREE.Scene} scene - The scene containing wireframes
 */
export function cleanup_wireframes() {
	debugMeshes.forEach((mesh) => {
		if (mesh.parent) {
			mesh.parent.remove(mesh);
		}
		if (mesh.geometry) {
			mesh.geometry.dispose();
		}
		if (mesh.material) {
			if (Array.isArray(mesh.material)) {
				mesh.material.forEach(mat => mat.dispose());
			} else {
				mesh.material.dispose();
			}
		}
	});
	debugMeshes.clear();
}

/**
 * Gets the current set of debug wireframe meshes
 * 
 * @returns {Map<string, THREE.Mesh>} Map of debug wireframe meshes
 */
export function get_debug_wireframes() {
	return debugMeshes;
} 