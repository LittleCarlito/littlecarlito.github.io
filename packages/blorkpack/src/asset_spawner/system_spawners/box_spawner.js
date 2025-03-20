import { THREE, RAPIER, BLORKPACK_FLAGS, SystemAssetType, IdGenerator } from './index.js';
/**
 * Creates a primitive box with the specified dimensions and properties.
 * This is used for simple assets that don't require a full 3D model.
 * 
 * @param {THREE.Scene} scene - The Three.js scene to add objects to
 * @param {RAPIER.World} world - The Rapier physics world
 * @param {number} width - Width of the box
 * @param {number} height - Height of the box
 * @param {number} depth - Depth of the box
 * @param {THREE.Vector3} position - Position of the box
 * @param {THREE.Quaternion} rotation - Rotation of the box
 * @param {Object} options - Additional options for the box
 * @returns {Promise<Object>} The created box with mesh and body
 */
export async function create_primitive_box(scene, world, width, height, depth, position, rotation, options = {}) {
	// Make sure position and rotation are valid
	position = position || new THREE.Vector3();
	// Handle different rotation types or create default
	let quaternion;
	if (rotation instanceof THREE.Quaternion) {
		quaternion = rotation;
	} else if (rotation instanceof THREE.Euler) {
		quaternion = new THREE.Quaternion().setFromEuler(rotation);
	} else {
		quaternion = new THREE.Quaternion();
	}
	// Create geometry and material
	const geometry = new THREE.BoxGeometry(width, height, depth);
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
	mesh.quaternion.copy(quaternion);
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
	if (options.collidable !== false) {
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
			x: quaternion.x,
			y: quaternion.y,
			z: quaternion.z,
			w: quaternion.w
		});
		// Create body
		body = world.createRigidBody(body_desc);
		// Create collider
		let collider_desc;
		// Use custom collider dimensions if specified, otherwise use mesh dimensions
		const collider_width = (options.collider_dimensions?.width !== undefined) ? 
			options.collider_dimensions.width : width / 2;
		const collider_height = (options.collider_dimensions?.height !== undefined) ? 
			options.collider_dimensions.height : height / 2;
		const collider_depth = (options.collider_dimensions?.depth !== undefined) ? 
			options.collider_dimensions.depth : depth / 2;
		// Create cuboid collider
		collider_desc = RAPIER.ColliderDesc.cuboid(collider_width, collider_height, collider_depth);
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
		type: SystemAssetType.PRIMITIVE_BOX.value,
		options
	};
} 