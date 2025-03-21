import { THREE, RAPIER, BLORKPACK_FLAGS, SystemAssetType, IdGenerator } from './index.js';
/**
 * Creates a primitive sphere with the specified properties.
 * 
 * @param {THREE.Scene} scene - The Three.js scene to add objects to
 * @param {RAPIER.World} world - The Rapier physics world
 * @param {string} id - The ID of the sphere
 * @param {number} radius - Radius of the sphere
 * @param {THREE.Vector3} position - Position of the sphere
 * @param {THREE.Quaternion} rotation - Rotation of the sphere
 * @param {Object} options - Additional options for the sphere
 * @returns {Promise<Object>} The created sphere with mesh and physics body
 */
export async function create_primitive_sphere(scene, world, id, radius, position, rotation, options = {}) {
	// Make sure position and rotation are valid
	position = position || new THREE.Vector3();
	rotation = rotation || new THREE.Quaternion();
	if (BLORKPACK_FLAGS.ASSET_LOGS) {
		console.log(`Creating primitive sphere for ${id} with radius: ${radius}`);
	}
	// Create geometry and material
	const geometry = new THREE.SphereGeometry(radius, 32, 24);
	// Convert color from string to number if needed
	let color_value = options.color || 0x808080;
	if (typeof color_value === 'string') {
		if (color_value.startsWith('0x')) {
			color_value = parseInt(color_value, 16);
		} else if (color_value.startsWith('#')) {
			color_value = parseInt(color_value.substring(1), 16);
		}
	}
	const material = new THREE.MeshStandardMaterial({ 
		color: color_value,
		transparent: options.opacity < 1.0,
		opacity: options.opacity || 1.0
	});
	// Create mesh
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.copy(position);
	mesh.quaternion.copy(rotation);
	// Set shadow properties
	mesh.castShadow = options.cast_shadow || false;
	mesh.receiveShadow = options.receive_shadow || false;
	// Add objects to scene in next frame to prevent stuttering
	await new Promise(resolve => setTimeout(resolve, 0));
	// Add to scene
	scene.add(mesh);
	// Disable raycasting if specified
	if (options.raycast_disabled) {
		mesh.raycast = () => null;
	}
	// Create physics body if collidable
	let body = null;
	if (options.collidable !== false && world) {
		// Determine body type based on mass and options
		let body_desc;
		if (options.mass <= 0 || options.gravity === false) {
			body_desc = RAPIER.RigidBodyDesc.fixed();
		} else {
			body_desc = RAPIER.RigidBodyDesc.dynamic()
				.setMass(options.mass)
				.setCanSleep(options.sleeping !== false);
		}
		// Set position and rotation
		body_desc.setTranslation(position.x, position.y, position.z);
		body_desc.setRotation({
			x: rotation.x,
			y: rotation.y,
			z: rotation.z,
			w: rotation.w
		});
		// Create body
		body = world.createRigidBody(body_desc);
		// Create sphere collider
		const collider_desc = RAPIER.ColliderDesc.ball(radius);
		// Set restitution and friction
		collider_desc.setRestitution(options.restitution || 0.5);
		collider_desc.setFriction(options.friction || 0.5);
		// Create collider and attach to body
		const collider = world.createCollider(collider_desc, body);
	}
	// Generate a unique ID for this asset
	const instance_id = IdGenerator.get_instance().generate_asset_id();
	// Return the result
	return {
		mesh,
		body,
		instance_id,
		type: SystemAssetType.PRIMITIVE_SPHERE.value,
		options
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