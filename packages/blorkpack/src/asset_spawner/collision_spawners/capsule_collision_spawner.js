import { THREE, RAPIER } from "../../index.js";
import { BaseCollisionSpawner } from "./base_collision_spawner.js";

/**
 * Spawner class for capsule-shaped colliders
 */
export class CapsuleCollisionSpawner extends BaseCollisionSpawner {
    /**
     * Creates a capsule collider
     * @param {Object} properties - The properties for the capsule collider
     * @param {number} properties.height - The height of the capsule
     * @param {number} properties.radius - The radius of the capsule
     * @param {Object} [properties.position] - The position of the collider
     * @param {Object} [properties.rotation] - The rotation of the collider
     * @param {number} [properties.mass] - The mass of the collider
     * @param {number} [properties.restitution] - The restitution (bounciness) of the collider
     * @param {number} [properties.friction] - The friction of the collider
     * @param {RAPIER.RigidBody} [properties.body] - The rigid body to attach the collider to
     * @returns {RAPIER.Collider} The created collider
     */
    create_collider(properties) {
        const { height, radius, position, rotation, mass, restitution, friction, body } = properties;
        const collider_desc = RAPIER.ColliderDesc.capsule(height * 0.5, radius);
        
        if (position) {
            collider_desc.setTranslation(position.x, position.y, position.z);
        }
        if (rotation) {
            collider_desc.setRotation(rotation);
        }
        if (mass) {
            collider_desc.setMass(mass);
        }
        if (restitution) {
            collider_desc.setRestitution(restitution);
        }
        collider_desc.setFriction(friction || 0.7);

        return this.world.createCollider(collider_desc, body);
    }

    /**
     * Gets the dimensions of the capsule collider
     * @param {Object} properties - The properties for the capsule collider
     * @returns {Object} The dimensions of the collider
     */
    get_dimensions(properties) {
        return {
            height: properties.height,
            radius: properties.radius
        };
    }
} 