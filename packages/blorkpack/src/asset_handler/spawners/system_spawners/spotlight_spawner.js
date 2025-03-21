import { THREE, BLORKPACK_FLAGS, SystemAssetType, IdGenerator, AssetStorage } from './index.js';
// Configuration constant for unlimited spotlight debug visualization
const UNLIMITED_SPOTLIGHT_DEBUG_LENGTH = 400;
/**
 * Creates a spotlight with the specified properties.
 * 
 * @param {THREE.Scene} scene - The Three.js scene to add objects to
 * @param {string} id - The ID of the spotlight
 * @param {THREE.Vector3} position - Position of the spotlight
 * @param {THREE.Euler} rotation - Rotation of the spotlight
 * @param {Object} options - Additional options for the spotlight
 * @param {Object} asset_data - The complete asset data from the manifest
 * @returns {Promise<Object>} The created spotlight
 */
export async function create_spotlight(scene, id, position, rotation, options = {}, asset_data = {}) {
	if (BLORKPACK_FLAGS.ASSET_LOGS) {
		console.log(`Creating spotlight for ${id}`);
	}
	// Get spotlight specific properties from additional_properties
	const color = parseInt(options.color || "0xffffff", 16);
	const intensity = asset_data?.additional_properties?.intensity || options.intensity || 0.3;
	const max_distance = asset_data?.additional_properties?.max_distance || options.max_distance || 0;
	const angle = asset_data?.additional_properties?.angle || options.angle || Math.PI / 8;
	const penumbra = asset_data?.additional_properties?.penumbra || options.penumbra || 0.1;
	const sharpness = asset_data?.additional_properties?.sharpness || options.sharpness || 0.5;
	if (BLORKPACK_FLAGS.ASSET_LOGS) {
		console.log(`Spotlight properties: color=${color.toString(16)}, intensity=${intensity}, max_distance=${max_distance}, angle=${angle}, penumbra=${penumbra}, sharpness=${sharpness}`);
	}
	try {
		// Create the spotlight
		const spotlight = new THREE.SpotLight(
			color,
			intensity,
			max_distance,
			angle,
			penumbra,
			sharpness
		);
		// Set the spotlight's position
		spotlight.position.copy(position);
		// Set shadow properties if the spotlight should cast shadows
		if (options.cast_shadow) {
			spotlight.castShadow = true;
			// Set shadow quality settings if provided
			if (asset_data?.additional_properties?.shadow) {
				const shadow_props = asset_data.additional_properties.shadow;
				// Shadow map size
				if (shadow_props.map_size) {
					spotlight.shadow.mapSize.width = shadow_props.map_size.width || 2048;
					spotlight.shadow.mapSize.height = shadow_props.map_size.height || 2048;
				}
				// Shadow blur
				if (shadow_props.blur_samples) {
					spotlight.shadow.blurSamples = shadow_props.blur_samples;
				}
				if (shadow_props.radius !== undefined) {
					spotlight.shadow.radius = shadow_props.radius;
				}
				// Camera settings
				if (shadow_props.camera) {
					spotlight.shadow.camera.near = shadow_props.camera.near || 10;
					spotlight.shadow.camera.far = shadow_props.camera.far || 100;
					spotlight.shadow.camera.fov = shadow_props.camera.fov || 30;
				}
				// Bias settings
				if (shadow_props.bias !== undefined) {
					spotlight.shadow.bias = shadow_props.bias;
				}
				if (shadow_props.normal_bias !== undefined) {
					spotlight.shadow.normalBias = shadow_props.normal_bias;
				}
			} else {
				// Default shadow settings
				spotlight.shadow.blurSamples = 32;
				spotlight.shadow.radius = 4;
				spotlight.shadow.mapSize.width = 2048;
				spotlight.shadow.mapSize.height = 2048;
				spotlight.shadow.camera.near = 10;
				spotlight.shadow.camera.far = 100;
				spotlight.shadow.camera.fov = 30;
				spotlight.shadow.bias = -0.002;
				spotlight.shadow.normalBias = 0.02;
			}
		}
		// Create and position target
		const target = new THREE.Object3D();
		let hasCustomTarget = false;
		// If target data is provided in the asset data, use that
		if (asset_data?.target && asset_data.target.position) {
			target.position.set(
				asset_data.target.position.x || 0, 
				asset_data.target.position.y || 0, 
				asset_data.target.position.z || 0
			);
			hasCustomTarget = true;
		} else {
			// Otherwise calculate target position based on rotation
			const targetDistance = 100; // Use a fixed distance for the target
			let rotX, rotY;
			if (rotation instanceof THREE.Euler) {
				rotX = rotation.x || 0;
				rotY = rotation.y || 0;
			} else {
				rotX = rotation.x || 0;
				rotY = rotation.y || 0;
			}
			// Calculate target position based on spherical coordinates
			const x = Math.sin(rotY) * Math.cos(rotX) * targetDistance;
			const y = Math.sin(rotX) * targetDistance;
			const z = Math.cos(rotY) * Math.cos(rotX) * targetDistance;
			target.position.set(
				position.x + x,
				position.y + y,
				position.z + z
			);
			hasCustomTarget = false;
		}
		// Set the target
		spotlight.target = target;
		// Add objects to scene in next frame to prevent stuttering
		await new Promise(resolve => setTimeout(resolve, 0));
		// Add the spotlight and target to the scene
		try {
			scene.add(spotlight);
			scene.add(target);
		} catch (sceneError) {
			console.error(`Error adding spotlight to scene:`, sceneError);
		}
		// Set type in userData for later identification
		spotlight.userData = { 
			...spotlight.userData,
			type: SystemAssetType.SPOTLIGHT.value,
			hasCustomTarget: hasCustomTarget
		};
		// Create debug visualization
		if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
			const debugMeshes = await create_spotlight_debug_mesh(scene, spotlight);
			spotlight.userData.debugMeshes = debugMeshes;
		}
		// Store references for later cleanup
		const asset_object = {
			mesh: spotlight,
			body: null, // No physics for lights
			objects: [spotlight, target],
			type: SystemAssetType.SPOTLIGHT.value
		};
		// Store in asset storage
		try {
			const storage = AssetStorage.get_instance();
			const spotlight_id = storage.get_new_instance_id();
			storage.store_static_mesh(spotlight_id, spotlight);
			// Ensure the spotlight is properly marked with its type for future queries
			spotlight.userData.type = SystemAssetType.SPOTLIGHT.value;
			spotlight.userData.id = id;
			spotlight.userData.instanceId = spotlight_id;
		} catch (storageError) {
			console.error(`Error storing spotlight in asset storage:`, storageError);
		}
		return asset_object;
	} catch (spotlightError) {
		console.error(`ERROR CREATING SPOTLIGHT: ${id}`, spotlightError);
		return null;
	}
}

/**
 * Creates a debug mesh for visualizing the spotlight
 * @param {THREE.Scene} scene - The scene to add the debug mesh to
 * @param {Object} spotlight - The spotlight object
 * @returns {THREE.Group} The debug mesh group
 */
export async function create_spotlight_debug_mesh(scene, spotlight) {
	if (!spotlight) {
		console.error(`Cannot create debug mesh: spotlight is null or undefined`);
		return null;
	}
	// Create shared materials for debug visualization
	const sharedDebugMaterials = {
		debugMesh: new THREE.LineBasicMaterial({ color: 0x00FF00 }),
		cone: new THREE.MeshBasicMaterial({ 
			color: 0x00FF00,
			wireframe: true,
			transparent: true,
			opacity: 0.6
		})
	};
	// Create the standard debug mesh
	const debugMesh = new THREE.SpotLightHelper(spotlight);
	debugMesh.material = sharedDebugMaterials.debugMesh;
	debugMesh.visible = BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG;
	// Store original update method
	const originalUpdate = debugMesh.update;
	debugMesh.update = () => {
		originalUpdate.call(debugMesh);
		debugMesh.traverse(child => {
			if (child.material && child !== debugMesh) {
				child.material = sharedDebugMaterials.debugMesh;
			}
		});
	};
	// Make debug mesh and all its children non-interactive
	debugMesh.raycast = () => null;
	debugMesh.traverse(child => {
		child.raycast = () => null;
	});
	// Add debug mesh in next frame
	await new Promise(resolve => setTimeout(resolve, 0));
	scene.add(debugMesh);
	// Create the cone visualization
	const spotlightToTarget = new THREE.Vector3().subVectors(
		spotlight.target.position,
		spotlight.position
	);
	// Calculate distance to target
	const distanceToTarget = spotlightToTarget.length();
	// Set the height of the cone based on the spotlight's distance property
	let height;
	if (spotlight.distance > 0) {
		height = spotlight.distance;
	} else {
		height = UNLIMITED_SPOTLIGHT_DEBUG_LENGTH;
	}
	const radius = Math.tan(spotlight.angle) * height;
	// Create cone geometry
	const geometry = new THREE.ConeGeometry(radius, height, 32, 32, true);
	geometry.translate(0, -height/2, 0);
	// Create cone mesh
	const cone = new THREE.Mesh(geometry, sharedDebugMaterials.cone);
	cone.visible = BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG;
	cone.raycast = () => null;
	cone.traverse(child => {
		child.raycast = () => null;
	});
	// Set cone position and orientation
	cone.position.copy(spotlight.position);
	const direction = spotlightToTarget.normalize();
	const quaternion = new THREE.Quaternion();
	quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
	cone.quaternion.copy(quaternion);
	// Add cone in next frame
	await new Promise(resolve => setTimeout(resolve, 0));
	scene.add(cone);
	return {
		debugMesh,
		cone
	};
}

/**
 * Generates a unique asset ID for spawned assets.
 * @returns {string} A unique ID string
 */
function generate_asset_id() {
	// Simple implementation using timestamp and random numbers
	const timestamp = Date.now();
	const random = Math.floor(Math.random() * 10000);
	return `asset_${timestamp}_${random}`;
}

/**
 * Updates all debug mesh visualizations for spotlights.
 * Called from the main animation loop.
 * 
 * @param {THREE.Scene} scene - The Three.js scene
 */
export async function update_debug_meshes(scene) {
	if (!scene) return;
	// Get all spotlights from the scene
	scene.traverse(object => {
		if (object.isSpotLight && object.userData.debugMeshes) {
			const { debugMesh, cone } = object.userData.debugMeshes;
			if (debugMesh) debugMesh.update();
			if (cone) {
				// Update cone position and orientation
				const direction = new THREE.Vector3()
					.subVectors(object.target.position, object.position)
					.normalize();
				const quaternion = new THREE.Quaternion();
				quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
				cone.quaternion.copy(quaternion);
				cone.position.copy(object.position);
			}
		}
	});
}

/**
 * Forces a refresh of all spotlight debug meshes.
 * This is useful when spotlight debug visualization settings change.
 * 
 * @param {THREE.Scene} scene - The Three.js scene
 */
export async function forceSpotlightDebugUpdate(scene) {
	if (!scene) return;
	
	// Find all spotlights in the scene
	scene.traverse(object => {
		if (object.isSpotLight) {
			// Remove existing debug meshes
			if (object.userData.debugMeshes) {
				const { debugMesh, cone } = object.userData.debugMeshes;
				if (debugMesh && debugMesh.parent) debugMesh.parent.remove(debugMesh);
				if (cone && cone.parent) cone.parent.remove(cone);
				object.userData.debugMeshes = null;
			}

			// Create new debug meshes if debug visualization is enabled
			if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
				create_spotlight_debug_mesh(scene, object).then(debugMeshes => {
					object.userData.debugMeshes = debugMeshes;
				});
			}
		}
	});
} 