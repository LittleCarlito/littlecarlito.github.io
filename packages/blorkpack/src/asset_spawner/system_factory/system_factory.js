import { THREE, RAPIER } from "../../index.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";

/**
 * Factory class responsible for creating and managing system-level assets.
 * Implements singleton pattern for global access.
 */
export class SystemFactory {
    static instance = null;

    constructor(scene, world) {
        if (SystemFactory.instance) {
            return SystemFactory.instance;
        }
        this.scene = scene;
        this.world = world;
        SystemFactory.instance = this;
    }

    /**
     * Gets or creates the singleton instance of SystemFactory.
     * @param {THREE.Scene} scene - The Three.js scene to add objects to.
     * @param {RAPIER.World} world - The Rapier physics world.
     * @returns {SystemFactory} The singleton instance.
     */
    static get_instance(scene, world) {
        if (!SystemFactory.instance) {
            SystemFactory.instance = new SystemFactory(scene, world);
        } else {
            // Update scene and world if provided
            if (scene) SystemFactory.instance.scene = scene;
            if (world) SystemFactory.instance.world = world;
        }
        return SystemFactory.instance;
    }

    /**
     * Spawns assets from the manifest's system_assets array.
     * This method handles system-level assets defined in the manifest.
     * 
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of spawned system assets
     */
    async spawn_system_assets(manifest_manager, progress_callback = null) {
        const spawned_assets = [];
        
        try {
            // Get all system assets from manifest
            const system_assets = manifest_manager.get_system_assets();
            if (!system_assets || system_assets.length === 0) {
                if (BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log("No system assets found in manifest");
                }
                return spawned_assets;
            }

            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Found ${system_assets.length} system assets to spawn`);
            }
            
            // Process each system asset
            for (const asset_data of system_assets) {
                if (progress_callback) {
                    progress_callback(`Loading system asset: ${asset_data.id}...`);
                }
                
                // Get asset type information
                const asset_type = asset_data.asset_type;
                
                // Extract position and rotation from asset data
                const position = new THREE.Vector3(
                    asset_data.position?.x || 0, 
                    asset_data.position?.y || 0, 
                    asset_data.position?.z || 0
                );
                
                // Create rotation from Euler angles
                const rotation = new THREE.Euler(
                    asset_data.rotation?.x || 0,
                    asset_data.rotation?.y || 0,
                    asset_data.rotation?.z || 0
                );
                const quaternion = new THREE.Quaternion().setFromEuler(rotation);
                
                // Prepare options based on the asset's configuration
                const options = {
                    // Asset configuration
                    collidable: asset_data.config?.collidable !== undefined ? asset_data.config.collidable : true,
                    hidden: asset_data.config?.hidden !== undefined ? asset_data.config.hidden : false,
                    disabled: asset_data.config?.disabled !== undefined ? asset_data.config.disabled : false,
                    sleeping: asset_data.config?.sleeping !== undefined ? asset_data.config.sleeping : true,
                    gravity: asset_data.config?.gravity !== undefined ? asset_data.config.gravity : true,
                    interactable: asset_data.config?.interactable !== undefined ? asset_data.config.interactable : true,
                    selectable: asset_data.config?.selectable !== undefined ? asset_data.config.selectable : true,
                    highlightable: asset_data.config?.highlightable !== undefined ? asset_data.config.highlightable : true,
                    
                    // Properties from additional_properties
                    color: asset_data.additional_properties?.color || "0xffffff",
                    cast_shadow: asset_data.additional_properties?.cast_shadows !== undefined ? 
                        asset_data.additional_properties.cast_shadows : false,
                    receive_shadow: asset_data.additional_properties?.receive_shadows !== undefined ? 
                        asset_data.additional_properties.receive_shadows : true,
                    
                    // Physics properties
                    mass: asset_data.additional_properties?.mass !== undefined ? asset_data.additional_properties.mass : 1.0,
                    restitution: asset_data.additional_properties?.restitution !== undefined ? 
                        asset_data.additional_properties.restitution : 0.5,
                    friction: asset_data.additional_properties?.friction !== undefined ? 
                        asset_data.additional_properties.friction : 0.5,
                    
                    // Size properties
                    dimensions: asset_data.additional_properties?.physical_dimensions || {
                        width: 1.0,
                        height: 1.0,
                        depth: 1.0
                    },
                    
                    // Collider dimensions if specified
                    collider_dimensions: asset_data.additional_properties?.collider_dimensions,
                    
                    // Additional properties
                    custom_data: asset_data.additional_properties,
                    raycast_disabled: asset_data.additional_properties?.raycast_disabled
                };

                // Log the asset being created for debugging
                if (BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log(`Creating system asset: ${asset_data.id} (${asset_type})`, {
                        position,
                        dimensions: options.dimensions,
                        color: options.color
                    });
                }

                // Handle different system asset types
                let result = null;
                
                if (asset_type === 'primitive_box') {
                    // Create a primitive box with the specified dimensions and properties
                    result = await this.create_primitive_box(
                        options.dimensions.width, 
                        options.dimensions.height, 
                        options.dimensions.depth, 
                        position, 
                        quaternion, 
                        options
                    );
                } 
                // Handle spotlight asset type
                else if (asset_type === 'spotlight') {
                    result = await this.create_spotlight(
                        asset_data.id,
                        position,
                        rotation,
                        options,
                        asset_data
                    );
                }
                // Handle primitive sphere asset type
                else if (asset_type === 'primitive_sphere') {
                    const radius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
                    result = await this.create_primitive_sphere(
                        asset_data.id,
                        radius,
                        position, 
                        quaternion,
                        options
                    );
                }
                // Handle primitive capsule asset type
                else if (asset_type === 'primitive_capsule') {
                    const radius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
                    const height = options.dimensions?.height || 1.0;
                    result = await this.create_primitive_capsule(
                        asset_data.id,
                        radius,
                        height,
                        position,
                        quaternion,
                        options
                    );
                }
                // Handle primitive cylinder asset type
                else if (asset_type === 'primitive_cylinder') {
                    const radius = options.dimensions?.radius || options.dimensions?.width / 2 || 0.5;
                    const height = options.dimensions?.height || 1.0;
                    result = await this.create_primitive_cylinder(
                        asset_data.id,
                        radius,
                        height,
                        position,
                        quaternion,
                        options
                    );
                }
                
                if (result) {
                    // Store the asset ID and type with the spawned asset data
                    result.id = asset_data.id;
                    result.asset_type = asset_type;
                    spawned_assets.push(result);
                    
                    if (BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Spawned system asset: ${asset_data.id} (${asset_type})`);
                    }
                }
            }
            
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Spawned ${spawned_assets.length} system assets from manifest`);
            }
            
            return spawned_assets;
        } catch (error) {
            console.error("Error spawning system assets:", error);
            return spawned_assets;
        }
    }

    /**
     * Creates a primitive box with the specified dimensions and properties.
     * This is used for simple assets that don't require a full 3D model.
     * 
     * @param {number} width - Width of the box
     * @param {number} height - Height of the box
     * @param {number} depth - Depth of the box
     * @param {THREE.Vector3} position - Position of the box
     * @param {THREE.Quaternion} rotation - Rotation of the box
     * @param {Object} options - Additional options for the box
     * @returns {Promise<Object>} The created box with mesh and body
     */
    async create_primitive_box(width, height, depth, position, rotation, options = {}) {
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
        this.scene.add(mesh);
        
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
            body = this.world.createRigidBody(body_desc);
            
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
            const collider = this.world.createCollider(collider_desc, body);
        }
        
        // Generate a unique ID for this asset
        const instance_id = this.generate_asset_id();
        
        // Return the result
        return {
            mesh,
            body,
            instance_id,
            type: 'primitive_box',
            options
        };
    }

    /**
     * Creates a primitive sphere with the specified properties.
     * 
     * @param {string} id - The ID of the sphere
     * @param {number} radius - Radius of the sphere
     * @param {THREE.Vector3} position - Position of the sphere
     * @param {THREE.Quaternion} rotation - Rotation of the sphere
     * @param {Object} options - Additional options for the sphere
     * @returns {Promise<Object>} The created sphere with mesh and physics body
     */
    async create_primitive_sphere(id, radius, position, rotation, options = {}) {
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
        this.scene.add(mesh);
        
        // Disable raycasting if specified
        if (options.raycast_disabled) {
            mesh.raycast = () => null;
        }
        
        // Create physics body if collidable
        let body = null;
        
        if (options.collidable !== false && this.world) {
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
            body = this.world.createRigidBody(body_desc);
            
            // Create sphere collider
            const collider_desc = RAPIER.ColliderDesc.ball(radius);
            
            // Set restitution and friction
            collider_desc.setRestitution(options.restitution || 0.5);
            collider_desc.setFriction(options.friction || 0.5);
            
            // Create collider and attach to body
            const collider = this.world.createCollider(collider_desc, body);
        }
        
        // Generate a unique ID for this asset
        const instance_id = this.generate_asset_id();
        
        // Return the result
        return {
            mesh,
            body,
            instance_id,
            type: 'primitive_sphere',
            options
        };
    }

    /**
     * Creates a primitive capsule with the specified properties.
     * 
     * @param {string} id - The ID of the capsule
     * @param {number} radius - Radius of the capsule
     * @param {number} height - Height of the capsule (not including the hemispherical caps)
     * @param {THREE.Vector3} position - Position of the capsule
     * @param {THREE.Quaternion} rotation - Rotation of the capsule
     * @param {Object} options - Additional options for the capsule
     * @returns {Promise<Object>} The created capsule with mesh and physics body
     */
    async create_primitive_capsule(id, radius, height, position, rotation, options = {}) {
        // Make sure position and rotation are valid
        position = position || new THREE.Vector3();
        rotation = rotation || new THREE.Quaternion();
        
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
            console.log(`Creating primitive capsule for ${id} with radius: ${radius}, height: ${height}`);
        }
        
        // Create geometry (use cylinder for now)
        const geometry = new THREE.CapsuleGeometry(radius, height, 16, 32);
        
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
        this.scene.add(mesh);
        
        // Disable raycasting if specified
        if (options.raycast_disabled) {
            mesh.raycast = () => null;
        }
        
        // Create physics body if collidable
        let body = null;
        
        if (options.collidable !== false && this.world) {
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
            body = this.world.createRigidBody(body_desc);
            
            // Create capsule collider
            const collider_desc = RAPIER.ColliderDesc.capsule(height / 2, radius);
            
            // Set restitution and friction
            collider_desc.setRestitution(options.restitution || 0.5);
            collider_desc.setFriction(options.friction || 0.5);
            
            // Create collider and attach to body
            const collider = this.world.createCollider(collider_desc, body);
        }
        
        // Generate a unique ID for this asset
        const instance_id = this.generate_asset_id();
        
        // Return the result
        return {
            mesh,
            body,
            instance_id,
            type: 'primitive_capsule',
            options
        };
    }

    /**
     * Creates a primitive cylinder with the specified properties.
     * 
     * @param {string} id - The ID of the cylinder
     * @param {number} radius - Radius of the cylinder
     * @param {number} height - Height of the cylinder
     * @param {THREE.Vector3} position - Position of the cylinder
     * @param {THREE.Quaternion} rotation - Rotation of the cylinder
     * @param {Object} options - Additional options for the cylinder
     * @returns {Promise<Object>} The created cylinder with mesh and physics body
     */
    async create_primitive_cylinder(id, radius, height, position, rotation, options = {}) {
        // Make sure position and rotation are valid
        position = position || new THREE.Vector3();
        rotation = rotation || new THREE.Quaternion();
        
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
            console.log(`Creating primitive cylinder for ${id} with radius: ${radius}, height: ${height}`);
        }
        
        // Create geometry
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
        
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
        this.scene.add(mesh);
        
        // Disable raycasting if specified
        if (options.raycast_disabled) {
            mesh.raycast = () => null;
        }
        
        // Create physics body if collidable
        let body = null;
        
        if (options.collidable !== false && this.world) {
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
            body = this.world.createRigidBody(body_desc);
            
            // Create cylinder collider
            const collider_desc = RAPIER.ColliderDesc.cylinder(height / 2, radius);
            
            // Set restitution and friction
            collider_desc.setRestitution(options.restitution || 0.5);
            collider_desc.setFriction(options.friction || 0.5);
            
            // Create collider and attach to body
            const collider = this.world.createCollider(collider_desc, body);
        }
        
        // Generate a unique ID for this asset
        const instance_id = this.generate_asset_id();
        
        // Return the result
        return {
            mesh,
            body,
            instance_id,
            type: 'primitive_cylinder',
            options
        };
    }

    /**
     * Generates a unique asset ID for spawned assets.
     * @returns {string} A unique ID string
     */
    generate_asset_id() {
        // Simple implementation using timestamp and random numbers
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `asset_${timestamp}_${random}`;
    }
}
