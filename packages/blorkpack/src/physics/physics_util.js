import { RAPIER, THREE, initThree } from '../index.js';
import { AssetStorage } from '../asset_storage.js';
import { BLORKPACK_FLAGS } from '../blorkpack_flags.js';
const THROW_MULTIPLIER = 0.1; // Adjust this to control throw strength
const SHOVE_FORCE = 4; // Adjust this value to control the force of the shove
const ZOOM_AMOUNT = 2;  // Amount to move per scroll event
// Module state (will be initialized in init())
let current_mouse_pos;
let initial_grab_distance = 15; // Store initial distance when grabbed
let last_position;
let current_velocity;
let last_time = 0;
let isInitialized = false;
/**
 * Initialize the physics utility module
 * @returns {Promise<void>}
 */
export async function initPhysicsUtil() {
	if (isInitialized) return;
	// Initialize Three.js
	await initThree();
	// Now we can safely use THREE classes
	current_mouse_pos = new THREE.Vector2();
	last_position = new THREE.Vector3();
	current_velocity = new THREE.Vector3();
	isInitialized = true;
}

/**
 * Helper function to find a physics body for an object
 * @param {Object} object - The object to find a physics body for
 * @returns {Object|null} - The physics body or null if not found
 */
function findPhysicsBody(object) {
	if (!object) return null;
	// 1. Direct property
	if (object.physicsBody) return object.physicsBody;
	// 2. Check userData
	if (object.userData?.physicsBody) return object.userData.physicsBody;
	// 3. Check root model
	if (object.userData?.rootModel) {
		const rootModel = object.userData.rootModel;
		if (rootModel.physicsBody) return rootModel.physicsBody;
		if (rootModel.userData?.physicsBody) return rootModel.userData.physicsBody;
	}
	// 4. Check asset storage
	const bodyPair = AssetStorage.get_instance().get_body_pair_by_mesh(object);
	if (bodyPair) return bodyPair[1]; // Extract the body from [mesh, body]
	// 5. Traverse up the object hierarchy
	let current = object;
	let depth = 0;
	const MAX_DEPTH = 10;
	while (current && depth < MAX_DEPTH) {
		if (current.physicsBody) return current.physicsBody;
		if (current.userData?.physicsBody) return current.userData.physicsBody;
		if (current.parent) {
			current = current.parent;
			depth++;
		} else {
			break;
		}
	}
	// Not found
	return null;
}

/**
 * Apply a shove force to an object
 * @param {Object} incoming_object - The object to shove
 * @param {Object} incoming_source - The camera or other source of the shove direction
 */
export function shove_object(incoming_object, incoming_source) {
	if (!isInitialized) {
		console.warn("Physics utils not initialized. Call initPhysicsUtil() first.");
		return;
	}
	const body = findPhysicsBody(incoming_object);
	if (!body) return;
	// Calculate direction from camera to interactable
	const camera_position = new THREE.Vector3();
	incoming_source.getWorldPosition(camera_position);
	const interactable_position = new THREE.Vector3();
	incoming_object.getWorldPosition(interactable_position);
	const direction = new THREE.Vector3()
		.subVectors(interactable_position, camera_position)
		.normalize();
	// Apply the impulse force in the calculated direction
	body.applyImpulse(
		{ x: direction.x * SHOVE_FORCE, y: direction.y * SHOVE_FORCE, z: direction.z * SHOVE_FORCE },
		true
	);
}
/**
 * Update mouse position for physics interactions
 * @param {MouseEvent} e - The mouse event
 */
export function update_mouse_position(e) {
	if (!isInitialized) return;
	current_mouse_pos.x = (e.clientX / window.innerWidth) * 2 - 1;
	current_mouse_pos.y = -(e.clientY / window.innerHeight) * 2 + 1;
}
/**
 * Translate (move) an object to follow the mouse position
 * @param {Object} incoming_object - The object to translate
 * @param {THREE.Camera} incoming_camera - The camera to use for raycasting
 */
export function translate_object(incoming_object, incoming_camera) {
	if (!isInitialized || !incoming_object) return;
	const physicsBody = findPhysicsBody(incoming_object);
	if (!physicsBody) {
		console.warn(`No physics body found for translating: ${incoming_object.name}`);
		return;
	}
	// Get ray from camera through mouse point
	const ray_start = new THREE.Vector3();
	const ray_end = new THREE.Vector3();
	const ray_dir = new THREE.Vector3();
	ray_start.setFromMatrixPosition(incoming_camera.matrixWorld);
	ray_end.set(current_mouse_pos.x, current_mouse_pos.y, 1).unproject(incoming_camera);
	ray_dir.subVectors(ray_end, ray_start).normalize();
	// Calculate the target position at the desired distance along the ray
	const target_pos = new THREE.Vector3();
	target_pos.copy(ray_start).addScaledVector(ray_dir, initial_grab_distance);
	// Update physics body position
	physicsBody.setTranslation(
		{ 
			x: target_pos.x, 
			y: target_pos.y, 
			z: target_pos.z 
		}, 
		true
	);
	// Store current position for velocity calculation on release
	const current_time = performance.now();
	// Only update last position if enough time has passed to avoid jitter
	if (current_time - last_time > 16) {  // Roughly 60fps
		const current_pos = physicsBody.translation();
		last_position.set(current_pos.x, current_pos.y, current_pos.z);
		last_time = current_time;
	}
}
/**
 * Zoom in (move object closer)
 */
export function zoom_object_in() {
	initial_grab_distance += ZOOM_AMOUNT;
}
/**
 * Zoom out (move object farther)
 */
export function zoom_object_out() {
	initial_grab_distance -= ZOOM_AMOUNT;
}
/**
 * Grab an object to start moving it
 * @param {Object} incoming_object - The object to grab
 * @param {THREE.Camera} incoming_camera - The camera to use for positioning
 */
export function grab_object(incoming_object, incoming_camera) {
	if (!isInitialized || !incoming_object) return;
	if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`Grabbing ${incoming_object.name}`);
	const physicsBody = findPhysicsBody(incoming_object);
	if (!physicsBody) {
		console.warn(`No physics body found for ${incoming_object.name}`, incoming_object);
		if (BLORKPACK_FLAGS.ACTIVATE_LOGS) {
			console.log("Object properties:", Object.keys(incoming_object));
			console.log("Object userData:", incoming_object.userData);
		}
		return;
	}
	if (BLORKPACK_FLAGS.ACTIVATE_LOGS) {
		console.log(`Successfully found physics body for ${incoming_object.name}`, physicsBody);
	}
	// Store initial distance from camera when grabbed
	const camera_pos = new THREE.Vector3();
	incoming_camera.getWorldPosition(camera_pos);
	const object_pos = new THREE.Vector3();
	object_pos.copy(physicsBody.translation());
	initial_grab_distance = camera_pos.distanceTo(object_pos);
	// Reset velocity tracking
	last_position.copy(object_pos);
	last_time = performance.now();
	// Change to kinematic while grabbed to prevent forces from acting on it
	physicsBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
	// Mark object as being moved
	incoming_object.userData.isMoving = true;
	// Make sure the body is awake
	physicsBody.wakeUp();
}
/**
 * Release a grabbed object
 * @param {Object} incoming_object - The object to release
 */
export function release_object(incoming_object) {
	if (!isInitialized || !incoming_object) return;
	const physicsBody = findPhysicsBody(incoming_object);
	if (!physicsBody) {
		console.warn(`No physics body found for release: ${incoming_object.name}`);
		return;
	}
	if (BLORKPACK_FLAGS.ACTIVATE_LOGS) {
		console.log(`Successfully releasing physics body for ${incoming_object.name}`);
	}
	// Change back to dynamic body
	physicsBody.setBodyType(RAPIER.RigidBodyType.Dynamic);
	// Calculate impulse based on recent movement
	const current_time = performance.now();
	const time_diff = (current_time - last_time) / 1000; // Convert to seconds
	if (time_diff > 0) {
		const current_pos = physicsBody.translation();
		const vel = new THREE.Vector3(
			(current_pos.x - last_position.x) / time_diff,
			(current_pos.y - last_position.y) / time_diff,
			(current_pos.z - last_position.z) / time_diff
		);
		// Apply calculated impulse
		physicsBody.applyImpulse({ 
			x: vel.x * THROW_MULTIPLIER, 
			y: vel.y * THROW_MULTIPLIER, 
			z: vel.z * THROW_MULTIPLIER 
		}, true);
	}
	// Make sure gravity is properly applied
	physicsBody.setGravityScale(1.0);
	// Mark object as no longer moving
	incoming_object.userData.isMoving = false;
} 