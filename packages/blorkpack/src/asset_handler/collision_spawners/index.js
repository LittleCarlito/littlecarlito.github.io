import { BoxCollisionSpawner } from "./box_collision_spawner.js";
import { SphereCollisionSpawner } from "./sphere_collision_spawner.js";
import { CapsuleCollisionSpawner } from "./capsule_collision_spawner.js";

/**
 * Gets the appropriate collision spawner based on the shape type
 * @param {string} shape_type - The type of shape to create
 * @param {RAPIER.World} world - The physics world
 * @returns {BaseCollisionSpawner} The appropriate collision spawner
 */
export function get_collision_spawner(shape_type, world) {
	switch (shape_type.toLowerCase()) {
	case 'sphere':
		return new SphereCollisionSpawner(world);
	case 'capsule':
		return new CapsuleCollisionSpawner(world);
	case 'box':
	default:
		return new BoxCollisionSpawner(world);
	}
}

export { BoxCollisionSpawner } from "./box_collision_spawner.js";
export { SphereCollisionSpawner } from "./sphere_collision_spawner.js";
export { CapsuleCollisionSpawner } from "./capsule_collision_spawner.js"; 