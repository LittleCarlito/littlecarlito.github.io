import { THREE, RAPIER } from "../../index.js";
import { BaseCollisionSpawner } from "./base_collision_spawner.js";

/**
 * Spawner class for sphere-shaped colliders
 */
export class SphereCollisionSpawner extends BaseCollisionSpawner {
    /**
     * Creates a sphere collider
     * @param {Object} properties - The properties for the sphere collider
     * @param {number} properties.radius - The radius of the sphere
     * @param {Object} [properties.position] - The position of the collider
     * @param {Object} [properties.rotation] - The rotation of the collider
     * @param {number} [properties.mass] - The mass of the collider
     * @param {number} [properties.restitution] - The restitution (bounciness) of the collider
     * @param {number} [properties.friction] - The friction of the collider
     * @param {RAPIER.RigidBody} [properties.body] - The rigid body to attach the collider to
     * @returns {RAPIER.Collider} The created collider
     */
    create_collider(properties) {
        const { radius, position, rotation, mass, restitution, friction, body } = properties;
        const collider_desc = RAPIER.ColliderDesc.ball(radius);
        
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
     * Gets the dimensions of the sphere collider
     * @param {Object} properties - The properties for the sphere collider
     * @returns {Object} The dimensions of the collider
     */
    get_dimensions(properties) {
        return {
            radius: properties.radius
        };
    }
} 