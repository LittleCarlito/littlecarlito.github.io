import { THREE, RAPIER } from "../index.js";
import CustomTypeManager from "../custom_type_manager.js";
import { AssetStorage } from "../asset_storage.js";
import { BLORKPACK_FLAGS } from "../blorkpack_flags.js";
import { SystemAssetType } from "./common/system_asset_types.js";
import { SystemFactory } from "./asset_factories/system_factory.js";
import { CustomFactory } from "./asset_factories/custom_factory.js";
import { IdGenerator } from "./common/id_generator.js";

/**
 * Class responsible for spawning and managing 3D assets in the scene.
 * Handles both static and dynamic (physics-enabled) assets.
 */
export class AssetSpawner {
    static #instance = null;
    static #disposed = false;
    storage;
    container;
    world;
    scene;
    
    // Cache the types and configs from CustomTypeManager
    #assetTypes = null;
    #assetConfigs = null;
    
    /**
     * Constructor
     * @param {Object} target_container - The container to spawn assets into
     * @param {Object} target_world - The physics world
     */
    constructor(target_container = null, target_world = null) {
        if (AssetSpawner.#instance) {
            throw new Error('AssetSpawner is a singleton. Use AssetSpawner.get_instance() instead.');
        }
        
        this.storage = AssetStorage.get_instance();
        this.container = target_container;
        this.world = target_world;
        
        // Cache asset types and configs
        this.#assetTypes = CustomTypeManager.getTypes();
        this.#assetConfigs = CustomTypeManager.getConfigs();
        
        AssetSpawner.#instance = this;
        AssetSpawner.#disposed = false;
    }

    /**
     * Gets or creates the singleton instance of AssetSpawner.
     * @param {THREE.Scene} scene - The Three.js scene to add objects to.
     * @param {RAPIER.World} world - The Rapier physics world.
     * @returns {AssetSpawner} The singleton instance.
     */
    static get_instance(scene, world) {
        if (AssetSpawner.#disposed) {
            AssetSpawner.#instance = null;
            AssetSpawner.#disposed = false;
        }
        
        if (!AssetSpawner.#instance) {
            AssetSpawner.#instance = new AssetSpawner(scene, world);
        } else if (scene || world) {
            if (scene) AssetSpawner.#instance.scene = scene;
            if (world) AssetSpawner.#instance.world = world;
        }
        return AssetSpawner.#instance;
    }

    /**
     * Spawns an asset of the specified type at the given position with the given rotation.
     * @param {string} asset_type - The type of asset to spawn.
     * @param {THREE.Vector3} position - The position to spawn the asset at.
     * @param {THREE.Quaternion} rotation - The rotation of the asset.
     * @param {Object} options - Additional options for spawning.
     * @returns {Promise<Object>} A promise that resolves with the spawned asset details.
     */
    async spawn_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
        // Handle SystemAssetType enum objects by extracting the value property
        let type_value = typeof asset_type === 'object' && asset_type.value ? asset_type.value : asset_type;
        
        try {
            // Check if this is a system asset type
            if (SystemAssetType.isSystemAssetType(type_value)) {
                // Handle camera and spotlight in AssetSpawner for now
                if (type_value === SystemAssetType.CAMERA.value) {
                    return this.spawn_scene_camera(options);
                }
                if (type_value === SystemAssetType.SPOTLIGHT.value) {
                    // Delegate spotlight creation to SystemFactory
                    const system_factory = SystemFactory.get_instance(this.scene, this.world);
                    return await system_factory.spawn_asset(asset_type, position, rotation, options);
                }

                // Delegate other system asset types to SystemFactory
                const system_factory = SystemFactory.get_instance(this.scene, this.world);
                return await system_factory.spawn_asset(asset_type, position, rotation, options);
            }
            
            // Check if the asset type exists in custom types
            if (CustomTypeManager.hasLoadedCustomTypes()) {
                // Check if the type exists directly
                if (CustomTypeManager.hasType(type_value)) {
                    // Get CustomFactory instance
                    const custom_factory = CustomFactory.get_instance(this.scene, this.world);
                    
                    // Spawn the custom asset using CustomFactory
                    return await custom_factory.spawn_custom_asset(type_value, position, rotation, options);
                } else {
                    // Not a system asset type or custom asset type - log error and return
                    // Check if custom types have been loaded at all
                    if (!CustomTypeManager.hasLoadedCustomTypes()) {
                        console.error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
                        console.error(`Failed to spawn asset type: "${type_value}"`);
                    } else {
                        console.error(`Unsupported asset type: "${type_value}". Cannot spawn asset.`);
                        console.error(`Available types:`, Object.keys(CustomTypeManager.getTypes()));
                    }
                    
                    return null;
                }
            }
        } catch (error) {
            // Handle the case where type_value might not be defined yet
            if (typeof type_value !== 'undefined') {
                console.error(`Error spawning asset ${type_value}:`, error);
            } else {
                console.error(`Error spawning asset (type unknown):`, error);
                console.error(`Original asset_type:`, asset_type);
            }
            return null;
        }
    }

    /**
     * @deprecated
     * Creates a debug wireframe for visualizing physics shapes.
     * @param {string} type - The type of wireframe to create.
     * @param {Object} dimensions - The dimensions of the wireframe.
     * @param {THREE.Vector3} position - The position of the wireframe.
     * @param {THREE.Quaternion} rotation - The rotation of the wireframe.
     * @param {Object} options - Additional options for the wireframe.
     * @returns {Promise<THREE.Mesh>} The created wireframe mesh.
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
        
        // Add objects to scene in next frame to prevent stuttering
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Only add to scene and store if debug is enabled
        if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
            this.scene.add(mesh);
            this.debugMeshes.set(mesh.uuid, mesh);
        }
        
        return mesh;
    }

    /**
     * @deprecated
     * Updates the positions of debug wireframes based on physics bodies.
     */
    update_debug_wireframes() {
        if (!BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) return;
        
        // Get all dynamic bodies from storage
        const dynamicBodies = this.storage.get_all_dynamic_bodies();
        
        // Update existing wireframes
        this.debugMeshes.forEach((mesh) => {
            // Find the matching body for this wireframe
            let foundBody = null;
            
            // Try to find by physicsBodyId if available
            if (mesh.userData.physicsBodyId) {
                // Find the body with this ID
                for (const [bodyMesh, body] of dynamicBodies) {
                    if (body.handle === mesh.userData.physicsBodyId) {
                        foundBody = body;
                        break;
                    }
                }
            }
            
            // If not found by ID, try to find by mesh
            if (!foundBody) {
                const bodyPair = this.storage.get_body_pair_by_mesh(mesh);
                if (bodyPair) {
                    foundBody = bodyPair[1];
                }
            }
            
            // Update position and rotation if body found
            if (foundBody) {
                const position = foundBody.translation();
                mesh.position.set(position.x, position.y, position.z);
                
                const rotation = foundBody.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
    }

    /**
     * Core cleanup of essential resources.
     */
    cleanup() {
        // Reset singleton instance
        AssetSpawner.#instance = null;

        // Clean up any core asset management resources
        if (this.storage) {
            // Clean up any remaining assets in storage
            const allAssets = this.storage.get_all_assets();
            allAssets.forEach(asset => {
                if (asset && asset.mesh && asset.mesh.parent) {
                    asset.mesh.parent.remove(asset.mesh);
                }
            });
        }

        // Clean up any core physics resources
        if (this.world) {
            // Clean up any remaining physics bodies
            const dynamicBodies = this.storage.get_all_dynamic_bodies();
            dynamicBodies.forEach(([mesh, body]) => {
                if (body) {
                    this.world.removeRigidBody(body);
                }
            });
        }

        // Clear references
        this.storage = null;
        this.container = null;
        this.world = null;
        this.#assetTypes = null;
        this.#assetConfigs = null;
    }

    /**
     * @deprecated
     * Cleanup of debug-specific resources.
     * This will be removed in future refactoring.
     */
    cleanup_debug() {
        // Remove debug wireframes
        if (this.debugMeshes) {
            this.debugMeshes.forEach((mesh) => {
                if (mesh.parent) {
                    mesh.parent.remove(mesh);
                }
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                if (mesh.material) {
                    mesh.material.dispose();
                }
            });
            this.debugMeshes.clear();
        }
        
        // Clean up spotlight debug visualizations
        const allAssets = this.storage.get_all_assets();
        allAssets.forEach(asset => {
            if (asset && asset.type === SystemAssetType.SPOTLIGHT.value) {
                // Remove spotlight and its target from the scene
                if (asset.objects) {
                    asset.objects.forEach(obj => {
                        if (obj && obj.parent) {
                            obj.parent.remove(obj);
                        }
                    });
                }
                
                // Remove the main spotlight mesh
                if (asset.mesh && asset.mesh.parent) {
                    asset.mesh.parent.remove(asset.mesh);
                }
            }
        });
    }
    
    /**
     * Updates all visual elements including debug wireframes and spotlight helpers.
     * This is the new method to use instead of the deprecated performCleanup().
     */
    update_visualizations() {
        // Update debug wireframes if enabled
        if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
            this.update_debug_wireframes();
        }
        
        // Update spotlight helpers
        this.update_helpers();
    }

    /**
     * @deprecated
     * Creates a material for display meshes based on the specified display mode
     * @param {number} displayMode - 0: Transparent, 1: Black Screen, 2: White Screen
     * @returns {THREE.Material} The created material
     */
    static createDisplayMeshMaterial(displayMode = 0) {
        let material;
        
        switch(displayMode) {
            case 0: // Transparent
                material = new THREE.MeshStandardMaterial({
                    color: 0xffffff,            // White base color
                    transparent: true,           // Enable transparency
                    opacity: 0.0,                // Fully transparent
                    side: THREE.DoubleSide
                });
                break;
                
            case 1: // Black Screen
                material = new THREE.MeshStandardMaterial({
                    color: 0x000000,            // Black base color
                    emissive: 0x000000,         // No emission (black)
                    emissiveIntensity: 0,       // No emission intensity
                    side: THREE.DoubleSide
                });
                break;
                
            case 2: // White Screen
                material = new THREE.MeshStandardMaterial({
                    color: 0xffffff,            // White base color
                    emissive: 0xffffff,         // White emission
                    emissiveIntensity: 0.3,     // Moderate emission intensity to avoid too bright
                    side: THREE.DoubleSide
                });
                break;
                
            default: // Default to transparent if invalid mode
                console.warn(`Invalid display mode: ${displayMode}, defaulting to transparent`);
                material = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.0,
                    side: THREE.DoubleSide
                });
        }
        
        return material;
    }
    
    /**
     * @deprecated
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
        
        let collider_desc;
        
        // Detect shape from name (often models use naming conventions)
        if (mesh.name.includes('sphere') || mesh.name.includes('ball')) {
            // Create a sphere collider
            // Estimate radius from geometry bounds
            geometry.computeBoundingSphere();
            const radius = geometry.boundingSphere.radius * meshScale.x;
            collider_desc = RAPIER.ColliderDesc.ball(radius);
            
        } else if (mesh.name.includes('capsule')) {
            // Create a capsule collider
            const height = (box.max.y - box.min.y) * meshScale.y;
            const radius = Math.max(
                (box.max.x - box.min.x), 
                (box.max.z - box.min.z)
            ) * meshScale.x * 0.5;
            
            collider_desc = RAPIER.ColliderDesc.capsule(height * 0.5, radius);
            
        } else {
            // Default to cuboid
            // Use exact dimensions from mesh's bounding box, scaled by the mesh's world scale
            const collider_width = (options.collider_dimensions?.width !== undefined) ? 
                options.collider_dimensions.width : box_width / 2;
            const collider_height = (options.collider_dimensions?.height !== undefined) ? 
                options.collider_dimensions.height : box_height / 2;
            const collider_depth = (options.collider_dimensions?.depth !== undefined) ? 
                options.collider_dimensions.depth : box_depth / 2;
            
            collider_desc = RAPIER.ColliderDesc.cuboid(collider_width, collider_height, collider_depth);
        }
        
        // Apply position offset (for standard colliders)
        collider_desc.setTranslation(relativePos.x, relativePos.y, relativePos.z);
        
        // Apply rotation
        collider_desc.setRotation(quaternion);
        
        // Set physical properties
        if (asset_config.mass) {
            collider_desc.setMass(asset_config.mass);
        }
        
        if (asset_config.restitution) {
            collider_desc.setRestitution(asset_config.restitution);
        }
        
        collider_desc.setFriction(0.7);
        
        // Create the collider
        const collider = this.world.createCollider(collider_desc, body);
        
        // Store reference to the collider on the mesh for debugging
        mesh.userData.physicsCollider = collider;
        
        return collider;
    }

    /**
     * @deprecated
     * Sets the collision debug state for this spawner.
     * This allows the main application to control debug visualization.
     * @param {boolean} enabled - Whether collision debug should be enabled
     */
    async set_collision_debug(enabled) {
        // Note: We're using the internal BLORKPACK_FLAGS but also accepting external control
        BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG = enabled;
        
        // Clear all existing wireframes if disabling
        if (!enabled) {
            this.debugMeshes.forEach((mesh) => {
                if (mesh.parent) {
                    mesh.parent.remove(mesh);
                }
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                if (mesh.material) {
                    mesh.material.dispose();
                }
            });
            this.debugMeshes.clear();
            return;
        }
        
        // If enabling, create wireframes for all bodies
        await this.create_debug_wireframes_for_all_bodies();
    }
    
    /**
     * @deprecated
     * Creates debug wireframes for all physics bodies.
     * This is used when enabling debug visualization after objects are already created.
     */
    async create_debug_wireframes_for_all_bodies() {
        // First clear any existing wireframes
        this.debugMeshes.forEach((mesh) => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
            if (mesh.material) {
                mesh.material.dispose();
            }
        });
        this.debugMeshes.clear();
        if(BLORKPACK_FLAGS.ASSET_LOGS) {
            console.log("Creating all debug wireframes");
        }
        
        // Get all dynamic bodies from storage
        const dynamicBodies = this.storage.get_all_dynamic_bodies();
        
        // Create a debug wireframe for each body
        for (const [mesh, body] of dynamicBodies) {
            if (!body) continue;
            
            // Get the body position and rotation
            const position = body.translation();
            const rotation = body.rotation();
            
            // Try to find collision meshes in the object hierarchy
            const collisionMeshes = [];
            mesh.traverse((child) => {
                if (child.isMesh && child.name.startsWith('col_')) {
                    collisionMeshes.push(child);
                }
            });
            
            if (collisionMeshes.length > 0) {
                // Create wireframes for each collision mesh
                for (const colMesh of collisionMeshes) {
                    // Get the world transform of the collision mesh
                    const worldPosition = new THREE.Vector3();
                    const worldQuaternion = new THREE.Quaternion();
                    const worldScale = new THREE.Vector3();
                    
                    colMesh.updateWorldMatrix(true, false);
                    colMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
                    
                    // Clone the geometry to create an exact wireframe representation
                    const clonedGeometry = colMesh.geometry.clone();
                    if(BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Creating dynamic wireframe for: ${colMesh.name}`);
                    }
                    
                    // Create a wireframe using the actual collision mesh geometry
                    await this.create_debug_wireframe(
                        'mesh',
                        null,  // Dimensions not needed when using actual geometry
                        worldPosition,
                        worldQuaternion,
                        { 
                            bodyId: body.handle,
                            geometry: clonedGeometry,
                            originalObject: colMesh,
                            objectId: colMesh.id,
                            scale: worldScale,
                            isStatic: false // Explicitly mark as NOT static
                        }
                    );
                }
            } else {
                // No collision meshes, create wireframe based on object bounds
                const boundingBox = new THREE.Box3().setFromObject(mesh);
                const size = boundingBox.getSize(new THREE.Vector3());
                const center = boundingBox.getCenter(new THREE.Vector3());
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log(`Creating fallback dynamic wireframe for: ${mesh.name}`);
                }
                
                // Create the debug wireframe
                await this.create_debug_wireframe(
                    'cuboid', 
                    { 
                        x: size.x * 0.5, 
                        y: size.y * 0.5, 
                        z: size.z * 0.5 
                    }, 
                    center, 
                    mesh.quaternion,
                    { 
                        bodyId: body.handle,
                        originalObject: mesh,
                        objectId: mesh.id,
                        isStatic: false // Explicitly mark as NOT static
                    }
                );
            }
        }
        
        // Also check for static bodies that might have physics
        const staticMeshes = this.storage.get_all_static_meshes();
        for (const mesh of staticMeshes) {
            if (!mesh) continue;
            
            // Only process static meshes that might have collision (like rooms)
            if (mesh.name.includes('ROOM') || mesh.name.includes('FLOOR')) {
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log(`Processing static mesh: ${mesh.name}`);
                }
                
                // Create a simple green wireframe for the static mesh
                const boundingBox = new THREE.Box3().setFromObject(mesh);
                const size = boundingBox.getSize(new THREE.Vector3());
                const center = boundingBox.getCenter(new THREE.Vector3());
                
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log(`Creating static wireframe for room: ${mesh.name}`);
                }
                
                await this.create_debug_wireframe(
                    'cuboid', 
                    { 
                        x: size.x * 0.5, 
                        y: size.y * 0.5, 
                        z: size.z * 0.5 
                    }, 
                    center, 
                    mesh.quaternion,
                    { 
                        originalObject: mesh,
                        objectId: mesh.id,
                        isStatic: true  // Explicitly mark as static
                    }
                );
            }
        }
    }

    /**
     * Spawns assets from asset groups defined in the manifest
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of spawned assets
     */
    async spawn_asset_groups(manifest_manager, progress_callback = null) {
        const spawned_assets = [];
        
        try {
            // Get all asset groups from manifest
            const asset_groups = manifest_manager.get_all_asset_groups();
            if (!asset_groups || asset_groups.length === 0) {
                if (BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log("No asset groups found in manifest");
                }
                return spawned_assets;
            }

            // Find active asset groups
            const active_groups = asset_groups.filter(group => group.active);
            
            // Process each active group
            for (const group of active_groups) {
                if (progress_callback) {
                    progress_callback(`Loading asset group: ${group.name}...`);
                }
                
                // Process each asset in the group
                for (const asset_id of group.assets) {
                    const asset_data = manifest_manager.get_asset(asset_id);
                    
                    if (asset_data) {
                        // Get asset type information
                        const asset_type = asset_data.asset_type;
                        const custom_type = manifest_manager.get_custom_type(asset_type);
                        
                        if (custom_type) {
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
                            
                            // Prepare options from asset data
                            const options = {
                                scale: asset_data.scale,
                                material: asset_data.material,
                                collider: asset_data.collider,
                                mass: asset_data.mass,
                                ...asset_data.options
                            };
                            
                            // Spawn the asset using the existing spawn_asset method
                            const result = await this.spawn_asset(
                                asset_type,
                                position,
                                quaternion,
                                options
                            );
                            
                            if (result) {
                                // Store the asset ID with the spawned asset data
                                result.id = asset_id;
                                spawned_assets.push(result);
                            }
                        } else if (BLORKPACK_FLAGS.ASSET_LOGS) {
                            console.warn(`Custom type "${asset_type}" not found for asset ${asset_id}`);
                        }
                    } else if (BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.warn(`Asset with ID "${asset_id}" not found in manifest`);
                    }
                }
            }
            
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Spawned ${spawned_assets.length} assets from manifest`);
            }
        } catch (error) {
            console.error('Error spawning asset groups:', error);
        }
        
        return spawned_assets;
    }

    /**
     * Spawns all assets from the manifest, routing system assets to SystemFactory
     * and handling custom assets directly.
     * 
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of all spawned assets
     */
    async spawn_manifest_assets(manifest_manager, progress_callback = null) {
        const spawned_assets = [];
        
        try {
            // Get all assets from manifest
            const system_assets = manifest_manager.get_system_assets();
            const custom_assets = manifest_manager.get_custom_assets();
            
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Found ${system_assets.length} system assets and ${custom_assets.length} custom assets to spawn`);
            }
            
            // Initialize SystemFactory if we have system assets
            if (system_assets && system_assets.length > 0) {
                if (progress_callback) {
                    progress_callback('Loading system assets...');
                }
                
                // Get SystemFactory instance
                const system_factory = SystemFactory.get_instance(this.scene, this.world);
                
                // Spawn system assets
                const system_results = await system_factory.spawn_system_assets(manifest_manager, progress_callback);
                spawned_assets.push(...system_results);
            }
            
            // Spawn custom assets
            if (custom_assets && custom_assets.length > 0) {
                if (progress_callback) {
                    progress_callback('Loading custom assets...');
                }
                
                // Get CustomFactory instance and spawn custom assets
                const custom_factory = CustomFactory.get_instance(this.scene, this.world);
                const custom_results = await custom_factory.spawn_custom_assets(manifest_manager, progress_callback);
                spawned_assets.push(...custom_results);
            }
            
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Spawned ${spawned_assets.length} total assets from manifest`);
            }
            
            return spawned_assets;
        } catch (error) {
            console.error("Error spawning manifest assets:", error);
            return spawned_assets;
        }
    }

    /**
     * @deprecated
     * Spawns a scene camera based on the camera configuration from the manifest.
     * This method creates a simple camera without any additional functionality.
     * 
     * @param {Object} camera_config - The camera configuration object from manifest
     * @returns {THREE.PerspectiveCamera} The created camera
     */
    spawn_scene_camera(camera_config) {
        if (!camera_config) {
            console.error("No camera configuration provided to spawn_scene_camera");
            return null;
        }

        // Create the camera using the configuration
        const camera = new THREE.PerspectiveCamera(
            // Field of view
            camera_config.fov || 75,
            // Default aspect ratio (will be updated when added to scene)
            window.innerWidth / window.innerHeight,
            // Near and far clipping planes
            camera_config.near || 0.1,
            camera_config.far || 1000
        );

        // Set camera position from config
        camera.position.set(
            camera_config.position?.x || 0,
            camera_config.position?.y || 5,
            camera_config.position?.z || 10
        );

        // Store camera reference in asset storage
        const camera_id = IdGenerator.get_instance().generate_asset_id();
        this.storage.store_static_mesh(camera_id, camera);
        
        return camera;
    }

    /**
     * Creates a helper visualization for the specified asset type.
     * Used for debugging purposes.
     * 
     * @param {string} asset_type - The type of asset to create a helper for
     * @param {THREE.Object3D} asset - The asset to create helpers for
     * @returns {Promise<Object>} The created helper objects
     */
    async create_helper(asset_type, asset) {
        if (!asset) return null;

        switch (asset_type) {
            case SystemAssetType.SPOTLIGHT.value:
                const { create_spotlight_helper } = await import('./asset_factories/system_spawners/spotlight_spawner.js');
                return create_spotlight_helper(this.scene, asset);
            // Add other asset type cases here as needed
            default:
                console.warn(`No helper visualization available for asset type: ${asset_type}`);
                return null;
        }
    }

    /**
     * Removes helper visualizations for the specified asset.
     * 
     * @param {THREE.Object3D} asset - The asset whose helpers should be removed
     * @returns {Promise<void>}
     */
    async despawn_helpers(asset) {
        if (!asset || !asset.userData.debugHelpers) return;
        
        const { helper, cone } = asset.userData.debugHelpers;
        if (helper && helper.parent) helper.parent.remove(helper);
        if (cone && cone.parent) cone.parent.remove(cone);
        
        // Clear the debug helpers reference
        asset.userData.debugHelpers = null;
    }

    /**
     * Updates all helper visualizations to match their associated assets.
     * Called from the main animation loop.
     */
    async update_helpers() {
        const { update_helpers } = await import('./asset_factories/system_spawners/spotlight_spawner.js');
        return update_helpers(this.scene);
    }

    /**
     * Forces a full update of all helper visualizations on next call.
     * Call this when you know assets have been added or removed.
     */
    async forceHelperUpdate() {
        const { forceSpotlightDebugUpdate } = await import('./asset_factories/system_spawners/spotlight_spawner.js');
        return forceSpotlightDebugUpdate(this.scene);
    }

    /**
     * Dispose of the spawner instance and clean up resources
     */
    dispose() {
        if (!AssetSpawner.#instance) return;
        
        // Dispose of factories
        CustomFactory.dispose_instance();
        
        // Clear references
        this.scene = null;
        this.world = null;
        this.storage = null;
        this.container = null;
        
        AssetSpawner.#disposed = true;
        AssetSpawner.#instance = null;
    }
    
    static dispose_instance() {
        if (AssetSpawner.#instance) {
            AssetSpawner.#instance.dispose();
        }
    }
} 