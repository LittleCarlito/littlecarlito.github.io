import { THREE, RAPIER } from "../../index.js";
import { AssetUtils } from "../../index.js";
import CustomTypeManager from "../../custom_type_manager.js";
import { AssetStorage } from "../../asset_storage.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";
import { IdGenerator } from "../util/id_generator.js";

/**
 * Factory class responsible for spawning custom assets in the scene.
 * Handles loading and spawning of custom 3D models with physics.
 */
export class CustomFactory {
    static instance = null;
    storage;
    scene;
    world;
    
    // Cache the types and configs from CustomTypeManager
    #assetTypes = null;
    #assetConfigs = null;
    
    /**
     * Constructor
     * @param {THREE.Scene} scene - The Three.js scene to add objects to
     * @param {RAPIER.World} world - The physics world
     */
    constructor(scene = null, world = null) {
        // Singleton pattern
        if (CustomFactory.instance) {
            // Update references if provided
            if (scene) this.scene = scene;
            if (world) this.world = world;
            return CustomFactory.instance;
        }
        
        // Initialize properties
        this.storage = AssetStorage.get_instance();
        this.scene = scene;
        this.world = world;
        
        // Cache asset types and configs
        this.#assetTypes = CustomTypeManager.getTypes();
        this.#assetConfigs = CustomTypeManager.getConfigs();
        
        // Store the instance
        CustomFactory.instance = this;
    }

    /**
     * Gets or creates the singleton instance of CustomFactory
     * @param {THREE.Scene} scene - The Three.js scene to add objects to
     * @param {RAPIER.World} world - The physics world
     * @returns {CustomFactory} The singleton instance
     */
    static get_instance(scene, world) {
        if (!CustomFactory.instance) {
            CustomFactory.instance = new CustomFactory(scene, world);
        } else {
            // Update scene and world if provided
            if (scene) CustomFactory.instance.scene = scene;
            if (world) CustomFactory.instance.world = world;
        }
        return CustomFactory.instance;
    }

    /**
     * Spawns a custom asset of the specified type at the given position with the given rotation
     * @param {string} asset_type - The type of asset to spawn
     * @param {THREE.Vector3} position - The position to spawn the asset at
     * @param {THREE.Quaternion} rotation - The rotation of the asset
     * @param {Object} options - Additional options for spawning
     * @returns {Promise<Object>} A promise that resolves with the spawned asset details
     */
    async spawn_custom_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
        try {
            // Check if custom types have been loaded
            if (!CustomTypeManager.hasLoadedCustomTypes()) {
                console.error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
                console.error(`Failed to spawn asset type: "${asset_type}"`);
                return null;
            }

            // Check if the type exists
            if (!CustomTypeManager.hasType(asset_type)) {
                console.error(`Unsupported asset type: "${asset_type}". Cannot spawn asset.`);
                console.error(`Available types:`, Object.keys(CustomTypeManager.getTypes()));
                return null;
            }

            // Get the actual asset type key from the custom type manager
            const customTypeKey = CustomTypeManager.getType(asset_type);
            
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Spawning custom asset type: ${asset_type} (key: ${customTypeKey})`);
            }
            
            // Load the asset with the resolved custom type key
            const gltfData = await this.storage.load_asset_type(customTypeKey);
            if (!gltfData) {
                console.error(`Failed to load custom asset type: ${customTypeKey}`);
                return null;
            }

            // Get asset configuration from cache or CustomTypeManager
            let asset_config = this.#assetConfigs[customTypeKey];
            if (!asset_config) {
                // Try to get it from CustomTypeManager
                asset_config = CustomTypeManager.getConfig(customTypeKey);
                if (asset_config) {
                    // Cache it for future use
                    this.#assetConfigs[customTypeKey] = asset_config;
                } else {
                    console.error(`No configuration found for custom asset type: ${customTypeKey}`);
                    return null;
                }
            }

            // Clone the model and continue with regular asset loading flow
            const originalModel = gltfData.scene;
            const model = AssetUtils.cloneSkinnedMesh(originalModel);
            
            // Apply scaling based on asset_config
            const scale = asset_config.scale || 1.0;
            model.scale.set(scale, scale, scale);
            
            // Apply position and rotation
            model.position.copy(position);
            model.quaternion.copy(rotation);
            
            // Add interactable_ prefix to the model name to make it grabbable
            const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            model.name = `interactable_${customTypeKey}_${uniqueId}`;
            
            // Hide collision meshes (objects with names starting with "col_")
            // And collect them for potential physics use
            const collisionMeshes = [];
            const displayMeshes = [];
            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.name.startsWith('col_')) {
                        // This is a collision mesh - hide it and collect for physics
                        child.visible = false;
                        collisionMeshes.push(child);
                    } else if (child.name.startsWith('display_')) {
                        // This is a display mesh - make it visible but transparent by default
                        child.visible = true;
                        
                        if (BLORKPACK_FLAGS.ASSET_LOGS) {
                            console.log(`Setting display mesh ${child.name} to transparent by default`);
                        }
                        
                        // Create a transparent material as the default for display meshes
                        const displayMaterial = this.createDisplayMeshMaterial(0); // 0 = transparent
                        
                        // Apply the material to the display mesh
                        child.material = displayMaterial;
                        
                        // Explicitly set display state to transparent (0) in userData
                        // This ensures the debug UI will recognize it as transparent
                        if (model.userData) {
                            model.userData.currentDisplayImage = 0;
                            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                                console.log(`Set userData.currentDisplayImage to 0 (transparent) for ${model.name}`);
                            }
                        }
                        
                        if (BLORKPACK_FLAGS.ASSET_LOGS) {
                            console.log(`Applied transparent material to display mesh: ${child.name} in ${customTypeKey}`);
                        }
                        
                        // Keep track of display meshes
                        displayMeshes.push(child);
                        
                        if (BLORKPACK_FLAGS.ASSET_LOGS) {
                            console.log(`Found display mesh: ${child.name} in ${customTypeKey}`);
                        }
                    } else {
                        // Add interactable_ prefix to all visible meshes to make them grabbable
                        // Use the same naming convention for child meshes
                        const childId = child.id || Math.floor(Math.random() * 10000);
                        child.name = `interactable_${customTypeKey}_${child.name || 'part'}_${childId}`;
                    }
                }
            });
            
            // Store reference to display meshes in model's userData if available
            if (displayMeshes.length > 0) {
                model.userData.displayMeshes = displayMeshes;
                
                // Add a helper function to switch between atlas images
                model.userData.switchDisplayImage = (imageIndex) => {
                    if (imageIndex < 0 || imageIndex > 2) {
                        console.error(`Invalid image index: ${imageIndex}. Must be between 0 and 2.`);
                        return;
                    }
                    
                    displayMeshes.forEach(mesh => {
                        if (mesh.material && mesh.material.map) {
                            const texture = mesh.material.map;
                            // Set offset based on the selected image (0, 1, or 2)
                            texture.offset.x = imageIndex / 3;
                            // Ensure the texture is updated
                            texture.needsUpdate = true;
                        }
                    });
                };
            }
            
            // Add objects to scene in next frame to prevent stuttering
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Add to scene
            this.scene.add(model);
            
            // Make the model and all its children accessible for physics
            model.userData.assetType = customTypeKey;
            
            let physicsBody = null;
            
            // Add physics if enabled
            if (options.enablePhysics !== false && this.world) {
                // Create a basic physics body
                const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(position.x, position.y, position.z)
                    .setLinearDamping(0.5)
                    .setAngularDamping(0.6);
                
                // Explicitly set gravity scale to ensure gravity affects this object
                rigidBodyDesc.setGravityScale(1.0);
                
                // Set initial rotation if provided
                if (rotation) {
                    rigidBodyDesc.setRotation(rotation);
                }
                
                physicsBody = this.world.createRigidBody(rigidBodyDesc);
                
                // Check if we have collision meshes to use for more accurate colliders
                if (collisionMeshes.length > 0) {
                    // Use the collision meshes for physics
                    for (const collisionMesh of collisionMeshes) {
                        await this.create_collider_from_mesh(collisionMesh, physicsBody, asset_config, options);
                    }
                } else {
                    // Fallback to simple cuboid collider
                    const halfScale = asset_config.scale / 2;
                    let collider_desc;
                    
                    // Use different collider shapes based on asset type or configuration
                    if (options.colliderType === 'sphere') {
                        collider_desc = RAPIER.ColliderDesc.ball(halfScale);
                    } else if (options.colliderType === 'capsule') {
                        collider_desc = RAPIER.ColliderDesc.capsule(halfScale, halfScale * 0.5);
                    } else {
                        // Default to cuboid
                        collider_desc = RAPIER.ColliderDesc.cuboid(halfScale, halfScale, halfScale);
                    }
                    
                    // Set physics materials
                    collider_desc.setRestitution(asset_config.restitution || 0.5);
                    collider_desc.setFriction(asset_config.friction || 0.5);
                    
                    // Create the collider and attach it to the rigid body
                    this.world.createCollider(collider_desc, physicsBody);
                    
                    // Create debug wireframe if debug is enabled
                    if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
                        try {
                            await this.create_debug_wireframe(
                                'box',
                                { width: halfScale * 2, height: halfScale * 2, depth: halfScale * 2 },
                                position,
                                rotation,
                                { color: 0x00ff00, opacity: 0.3, body: physicsBody }
                            );
                        } catch (error) {
                            console.warn('Failed to create debug wireframe:', error);
                        }
                    }
                }
                
                if (BLORKPACK_FLAGS.PHYSICS_LOGS) {
                    console.log(`Created physics body for ${customTypeKey} with mass: ${asset_config.mass || 1.0}, scale: ${scale}`);
                }
            }
            
            // Register with asset storage
            const instance_id = this.storage.add_object(model, physicsBody);
            
            return {
                mesh: model,
                body: physicsBody,
                instance_id
            };
        } catch (error) {
            console.error(`Error spawning custom asset ${asset_type}:`, error);
            return null;
        }
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
     * Creates a material for display meshes based on the specified display mode
     * @param {number} displayMode - 0: Transparent, 1: Black Screen, 2: White Screen
     * @returns {THREE.Material} The created material
     */
    createDisplayMeshMaterial(displayMode = 0) {
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
        
        // Add objects to scene in next frame to prevent stuttering
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Only add to scene and store if debug is enabled
        if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
            this.scene.add(mesh);
            this.debugMeshes.set(mesh.uuid, mesh);
        }
        
        return mesh;
    }
}
