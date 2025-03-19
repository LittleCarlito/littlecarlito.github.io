import { THREE } from "../../../index.js";
import { BLORKPACK_FLAGS } from "../../../blorkpack_flags.js";
import { SystemAssetType } from "../system_asset_types.js";
import { IdGenerator } from "../../util/id_generator.js";

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

    // Create spotlight
    const spotlight = new THREE.SpotLight(
        options.color || 0xffffff,
        options.intensity || 1,
        options.distance || 0,
        options.angle || Math.PI / 3,
        options.penumbra || 0.1,
        options.decay || 2,
        options.distance || 0
    );

    // Set position and rotation
    spotlight.position.copy(position);
    spotlight.rotation.copy(rotation);

    // Set spotlight properties
    spotlight.castShadow = options.cast_shadow !== false;
    spotlight.shadow.mapSize.width = options.shadow_map_size || 1024;
    spotlight.shadow.mapSize.height = options.shadow_map_size || 1024;
    spotlight.shadow.camera.near = options.shadow_near || 0.5;
    spotlight.shadow.camera.far = options.shadow_far || 500;
    spotlight.shadow.bias = options.shadow_bias || -0.0001;

    // Add to scene
    scene.add(spotlight);

    // Store references for later cleanup
    const asset_object = {
        mesh: spotlight,
        body: null, // No physics for lights
        objects: [spotlight],
        type: SystemAssetType.SPOTLIGHT.value,
        instance_id: IdGenerator.get_instance().generate_asset_id()
    };
    
    return asset_object;
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