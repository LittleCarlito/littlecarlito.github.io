import { THREE, RAPIER } from "../../index.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";

/**
 * Base class for all collision spawners.
 * Provides common functionality for creating and managing colliders.
 */
export class BaseCollisionSpawner {
	/**
     * Constructor
     * @param {RAPIER.World} world - The physics world
     */
	constructor(world) {
		this.world = world;
	}

	/**
     * Creates a collider with the given properties
     * @param {Object} properties - The properties for the collider
     * @returns {RAPIER.Collider} The created collider
     */
	create_collider(properties) {
		throw new Error('create_collider must be implemented by derived classes');
	}

	/**
     * Creates a debug wireframe for the collider
     * @param {Object} properties - The properties for the collider
     * @returns {THREE.Mesh} The debug wireframe mesh
     */
	create_debug_wireframe(properties) {
		throw new Error('create_debug_wireframe must be implemented by derived classes');
	}

	/**
     * Gets the dimensions of the collider
     * @param {Object} properties - The properties for the collider
     * @returns {Object} The dimensions object
     */
	get_dimensions(properties) {
		throw new Error('get_dimensions must be implemented by derived classes');
	}

	/**
     * Creates a collider from a mesh
     * @param {THREE.Mesh} mesh - The mesh to create a collider from
     * @param {RAPIER.RigidBody} body - The rigid body to attach the collider to
     * @param {Object} asset_config - Asset configuration data
     * @param {Object} [options={}] - Additional options for collider creation
     * @returns {Promise<RAPIER.Collider>} The created collider
     */
	async create_collider_from_mesh(mesh, body, asset_config, options = {}) {
		if (!mesh || !body) return null;
		const geometry = mesh.geometry;
		if (!geometry) return null;

		// Compute geometry bounds if needed
		if (!geometry.boundingBox) {
			geometry.computeBoundingBox();
		}

		// Get mesh world position (relative to the model)
		const position = new THREE.Vector3();
		const quaternion = new THREE.Quaternion();
		const meshScale = new THREE.Vector3();

		// Ensure matrix is updated to get accurate world position
		mesh.updateWorldMatrix(true, false);
		mesh.matrixWorld.decompose(position, quaternion, meshScale);

		// Adjust position for physics (since we're adding a collider to an existing body)
		const bodyPos = body.translation();
		const relativePos = {
			x: position.x - bodyPos.x,
			y: position.y - bodyPos.y,
			z: position.z - bodyPos.z
		};

		// Get the bounding box in local space
		const box = geometry.boundingBox;

		// Calculate dimensions from the bounding box
		const box_width = (box.max.x - box.min.x) * meshScale.x;
		const box_height = (box.max.y - box.min.y) * meshScale.y;
		const box_depth = (box.max.z - box.min.z) * meshScale.z;

		// Check the local center of the bounding box to adjust for offset meshes
		const localCenter = new THREE.Vector3();
		box.getCenter(localCenter);

		// If the local center is not at the origin, we need to account for that
		if (Math.abs(localCenter.x) > 0.001 || Math.abs(localCenter.y) > 0.001 || Math.abs(localCenter.z) > 0.001) {
			// Rotate the local center according to the mesh's world rotation
			const rotatedCenter = localCenter.clone().applyQuaternion(quaternion);
			// Add this offset to the relative position
			relativePos.x += rotatedCenter.x * meshScale.x;
			relativePos.y += rotatedCenter.y * meshScale.y;
			relativePos.z += rotatedCenter.z * meshScale.z;
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Adjusted position for ${mesh.name} due to non-centered geometry:`, {
					localCenter: `${localCenter.x.toFixed(2)}, ${localCenter.y.toFixed(2)}, ${localCenter.z.toFixed(2)}`,
					rotatedCenter: `${rotatedCenter.x.toFixed(2)}, ${rotatedCenter.y.toFixed(2)}, ${rotatedCenter.z.toFixed(2)}`,
					newRelativePos: `${relativePos.x.toFixed(2)}, ${relativePos.y.toFixed(2)}, ${relativePos.z.toFixed(2)}`
				});
			}
		}

		if(BLORKPACK_FLAGS.ASSET_LOGS) {
			// Log for debugging
			console.log(`Creating collider for ${mesh.name}:`, {
				worldPos: `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`,
				bodyPos: `${bodyPos.x.toFixed(2)}, ${bodyPos.y.toFixed(2)}, ${bodyPos.z.toFixed(2)}`,
				relativePos: `${relativePos.x.toFixed(2)}, ${relativePos.y.toFixed(2)}, ${relativePos.z.toFixed(2)}`,
				meshScale: `${meshScale.x.toFixed(2)}, ${meshScale.y.toFixed(2)}, ${meshScale.z.toFixed(2)}`
			});
		}

		// Create the collider using the appropriate shape
		const collider = await this.create_collider({
			width: box_width / 2,
			height: box_height / 2,
			depth: box_depth / 2,
			position: relativePos,
			rotation: quaternion,
			mass: asset_config.mass,
			restitution: asset_config.restitution,
			friction: 0.7,
			body: body
		});

		// Store reference to the collider on the mesh for debugging
		mesh.userData.physicsCollider = collider;

		return collider;
	}

	/**
     * Creates a debug wireframe for visualizing physics shapes
     * @param {string} type - The type of wireframe to create
     * @param {Object} dimensions - The dimensions of the wireframe
     * @param {THREE.Vector3} position - The position of the wireframe
     * @param {THREE.Quaternion} rotation - The rotation of the wireframe
     * @param {Object} options - Additional options for the wireframe
     * @returns {Promise<THREE.Mesh>} The created wireframe mesh
     */
	async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
		let geometry;
		// If we have a mesh geometry provided, use it directly for maximum accuracy
		if (type === 'mesh' && options.geometry) {
			geometry = options.geometry;
		} else {
			// Otherwise create a primitive shape based on dimensions
			const size = dimensions || { x: 1, y: 1, z: 1 };
			switch (type) {
			case 'cuboid':
				geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
				break;
			case 'sphere':
				geometry = new THREE.SphereGeometry(size.radius || 1, 16, 16);
				break;
			case 'capsule':
				// Approximate capsule with cylinder
				geometry = new THREE.CylinderGeometry(size.radius, size.radius, size.height, 16);
				break;
			default:
				geometry = new THREE.BoxGeometry(1, 1, 1);
			}
		}

		// Define the colors we'll use
		const staticColor = 0x00FF00; // Green for static objects
		// Set of blue colors for dynamic objects
		const blueColors = [
			0x0000FF, // Pure blue
			0x4444FF, // Light blue
			0x0088FF, // Sky blue
			0x00AAFF, // Azure
			0x00FFFF, // Cyan
			0x0066CC, // Medium blue
			0x0033AA, // Dark blue
			0x3366FF, // Royal blue
			0x6666FF, // Periwinkle
			0x0099CC  // Ocean blue
		];

		// Choose a color based on position hash to ensure consistent but varied colors
		let color;
		if (options.isStatic === true) {
			// Static objects (like rooms) are green
			color = staticColor;
		} else {
			// Generate a simple hash based on the object's position
			// This ensures the same object gets the same color, but different objects get different colors
			let hash = 0;
			// Use position for a simple hash
			const posX = Math.round(position.x * 10);
			const posY = Math.round(position.y * 10);
			const posZ = Math.round(position.z * 10);
			hash = Math.abs(posX + posY * 31 + posZ * 47) % blueColors.length;
			// Select a blue color using the hash
			color = blueColors[hash];
		}

		const material = new THREE.MeshBasicMaterial({ 
			color: color,
			wireframe: true,
			transparent: true,
			opacity: 0.7
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.copy(position);
		mesh.quaternion.copy(rotation);

		// Apply scale for mesh-type wireframes
		if (options.scale && type === 'mesh') {
			mesh.scale.copy(options.scale);
		}

		mesh.renderOrder = 999; // Ensure wireframes render on top

		// Store any references needed to update this wireframe
		mesh.userData.physicsBodyId = options.bodyId;
		mesh.userData.debugType = type;
		mesh.userData.originalObject = options.originalObject;
		mesh.userData.isStatic = options.isStatic;

		return mesh;
	}
} 