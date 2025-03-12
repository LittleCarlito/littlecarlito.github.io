import { THREE, RAPIER } from "./index.js";
import { AssetUtils } from "./index.js";
import { ASSET_CONFIGS, ASSET_TYPE } from "./asset_type.js";
import { AssetStorage } from "./asset_storage.js";
import { BLORKPACK_FLAGS } from "./blorkpack_flags.js";

/**
 * Generates triangle indices for a geometry that doesn't have them
 * @param {THREE.BufferGeometry} geometry - The geometry to generate indices for
 * @returns {Uint32Array} The generated indices
 */
function generate_indices(geometry) {
    const vertexCount = geometry.attributes.position.count;
    const indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
    }
    return indices;
}

/**
 * Class responsible for spawning and managing 3D assets in the scene.
 * Handles both static and dynamic (physics-enabled) assets.
 */
export class AssetSpawner {
    static instance = null;

    constructor(scene, world) {
        if (AssetSpawner.instance) {
            return AssetSpawner.instance;
        }
        this.scene = scene;
        this.world = world;
        this.storage = AssetStorage.get_instance();
        this.debugMeshes = new Map(); // Store debug wireframe meshes
        this.debugColorIndex = 0; // Counter for cycling through debug colors
        AssetSpawner.instance = this;
    }

    /**
     * Gets or creates the singleton instance of AssetSpawner.
     * @param {THREE.Scene} scene - The Three.js scene to add objects to.
     * @param {RAPIER.World} world - The Rapier physics world.
     * @returns {AssetSpawner} The singleton instance.
     */
    static get_instance(scene, world) {
        if (!AssetSpawner.instance) {
            AssetSpawner.instance = new AssetSpawner(scene, world);
        } else {
            // Update scene and world if provided
            if (scene) AssetSpawner.instance.scene = scene;
            if (world) AssetSpawner.instance.world = world;
        }
        return AssetSpawner.instance;
    }

    /**
     * Spawns an asset in the scene with optional physics.
     * @param {string} asset_type - The type of asset to spawn.
     * @param {THREE.Vector3} position - The position to spawn the asset at.
     * @param {THREE.Quaternion} rotation - The rotation of the asset.
     * @param {Object} options - Additional options for spawning.
     * @returns {Promise<Object>} A promise that resolves with the spawned asset details.
     */
    async spawn_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
        try {
            // Load the asset
            const gltfData = await this.storage.load_asset_type(asset_type);
            if (!gltfData) {
                console.error(`Failed to load asset type: ${asset_type}`);
                return null;
            }

            // Get asset configuration for scaling
            const asset_config = ASSET_CONFIGS[asset_type];
            if (!asset_config) {
                console.error(`No configuration found for asset type: ${asset_type}`);
                return null;
            }

            // Clone the model
            const originalModel = gltfData.scene;
            const model = AssetUtils.cloneSkinnedMesh(originalModel);
            
            // Apply scaling based on asset_config
            const scale = asset_config.scale || 1.0;
            model.scale.set(scale, scale, scale);
            
            // Apply position and rotation
            model.position.copy(position);
            model.quaternion.copy(rotation);
            
            // Add interactable_ prefix to the model name to make it grabbable
            // Format: interactable_assetType_uniqueId
            const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            model.name = `interactable_${asset_type}_${uniqueId}`;
            
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
                        // This is a display mesh - make it visible and load a texture from atlas-test.jpg
                        child.visible = true;
                        
                        // Create a texture loader
                        const textureLoader = new THREE.TextureLoader();
                        
                        // Load the atlas texture
                        textureLoader.load('/images/atlas-test.jpg', (texture) => {
                            // Set up texture to show just the first image (assuming 3 images arranged horizontally)
                            // Set repeat to 1/3 to only show 1/3 of the texture
                            texture.repeat.set(1/3, 1);
                            // Set offset to 0 to start from the left
                            texture.offset.set(0, 0);
                            // Ensure the texture wrapping is set to ClampToEdge to prevent repeating
                            texture.wrapS = THREE.ClampToEdgeWrapping;
                            texture.wrapT = THREE.ClampToEdgeWrapping;
                            
                            // Create a material with the loaded texture - use MeshStandardMaterial with emissive for better visibility
                            const displayMaterial = new THREE.MeshStandardMaterial({
                                map: texture,
                                side: THREE.DoubleSide,
                                emissive: 0xffffff,       // Add white emissive color
                                emissiveMap: texture,     // Use same texture as emissive map
                                emissiveIntensity: 1.0,   // Full intensity emission
                                color: 0xffffff          // White base color to not affect texture
                            });
                            
                            // Apply the material to the display mesh
                            child.material = displayMaterial;
                            
                            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                                console.log(`Applied atlas texture to display mesh: ${child.name} in ${asset_type}`);
                            }
                        }, 
                        undefined, // onProgress callback not needed
                        (error) => {
                            console.error('Error loading atlas texture:', error);
                            
                            // Fallback to green material if texture loading fails
                            const greenMaterial = new THREE.MeshStandardMaterial({
                                color: 0x00ff00,
                                emissive: 0x00ff00,
                                emissiveIntensity: 0.5
                            });
                            
                            child.material = greenMaterial;
                        });
                        
                        displayMeshes.push(child);
                        
                        if (BLORKPACK_FLAGS.ASSET_LOGS) {
                            console.log(`Found display mesh: ${child.name} in ${asset_type}`);
                        }
                    } else {
                        // Add interactable_ prefix to all visible meshes to make them grabbable
                        // Use the same naming convention for child meshes
                        const childId = child.id || Math.floor(Math.random() * 10000);
                        child.name = `interactable_${asset_type}_${child.name || 'part'}_${childId}`;
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
            model.userData.assetType = asset_type;
            
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
                    
                    // Set mass and material properties
                    if (asset_config.mass) {
                        collider_desc.setMass(asset_config.mass);
                    } else {
                        // Default mass if not specified
                        collider_desc.setMass(1.0);
                    }
                    
                    if (asset_config.restitution) {
                        collider_desc.setRestitution(asset_config.restitution);
                    } else {
                        // Default restitution (bounciness) if not specified
                        collider_desc.setRestitution(0.2);
                    }
                    
                    // Set friction
                    collider_desc.setFriction(0.7);
                    
                    // Create the collider and attach it to the physics body
                    this.world.createCollider(collider_desc, physicsBody);
                }
                
                // Store physics body as a direct property on the model for very direct access
                model.physicsBody = physicsBody;
                
                // Store a reference to the physics body in the model and all its children
                model.userData.physicsBody = physicsBody;
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.userData.physicsBody = physicsBody;
                        child.userData.rootModel = model;
                        // Also store on the child directly for maximum compatibility
                        child.physicsBody = physicsBody;
                    }
                });
                
                // Create debug wireframe if debug is enabled
                if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
                    try {
                        await this.create_debug_wireframe(
                            'box',
                            { width: halfScale * 2, height: halfScale * 2, depth: halfScale * 2 },
                            position,
                            rotation,
                            { color: 0x00ff00, opacity: 0.3, body }
                        );
                    } catch (error) {
                        console.warn('Failed to create debug wireframe:', error);
                    }
                }
                
                if (BLORKPACK_FLAGS.PHYSICS_LOGS) {
                    console.log(`Created physics body for ${asset_type} with mass: ${asset_config.mass || 1.0}, scale: ${scale}`);
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
            console.error(`Error spawning asset ${asset_type}:`, error);
            return null;
        }
    }

    /**
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
     * Cleans up resources and releases memory.
     */
    cleanup() {
        // Remove debug wireframes
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
        
        // Clean up any spotlights
        this.cleanup_spotlights();
        
        // Reset instance
        AssetSpawner.instance = null;
    }
    
    /**
     * Cleans up spotlight resources
     */
    cleanup_spotlights() {
        // Get all assets from storage
        const allAssets = this.storage.get_all_assets();
        
        // Find and clean up spotlight assets
        allAssets.forEach(asset => {
            if (asset && asset.type === 'spotlight') {
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
     * Performs periodic cleanup of unused resources.
     * This is called regularly from the main animation loop.
     */
    performCleanup() {
        // Update debug wireframes if needed
        if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
            this.update_debug_wireframes();
        }
        
        // Update spotlight helpers if needed
        if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
            this.update_spotlight_helpers();
        }
        
        // Any other periodic cleanup tasks can be added here
    }

    /**
     * Creates a physics collider from a mesh.
     * Used for generating colliders from mesh geometry.
     * 
     * @param {THREE.Mesh} mesh - The mesh to create a collider for
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
     * Spawns assets from the manifest's application_assets array.
     * This method handles application-specific assets defined in the manifest.
     * 
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of spawned application assets
     */
    async spawn_application_assets(manifest_manager, progress_callback = null) {
        const spawned_assets = [];
        
        try {
            // Get all application assets from manifest
            const application_assets = manifest_manager.get_application_assets();
            if (!application_assets || application_assets.length === 0) {
                if (BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log("No application assets found in manifest");
                }
                return spawned_assets;
            }

            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Found ${application_assets.length} application assets to spawn`);
            }
            
            // Process each application asset
            for (const asset_data of application_assets) {
                if (progress_callback) {
                    progress_callback(`Loading application asset: ${asset_data.id}...`);
                }
                
                // Get asset type information
                const asset_type = asset_data.asset_type;
                const custom_type = manifest_manager.get_custom_type(asset_type);
                
                if (!custom_type) {
                    console.warn(`Custom type "${asset_type}" not found for application asset ${asset_data.id}`);
                    continue;
                }
                
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
                
                // Prepare options based on the asset's configuration and custom type
                const options = {
                    // Asset configuration
                    collidable: asset_data.config?.collidable !== undefined ? asset_data.config.collidable : true,
                    hidden: asset_data.config?.hidden !== undefined ? asset_data.config.hidden : false,
                    disabled: asset_data.config?.disabled !== undefined ? asset_data.config.disabled : false,
                    sleeping: asset_data.config?.sleeping !== undefined ? asset_data.config.sleeping : true,
                    gravity: asset_data.config?.gravity !== undefined ? asset_data.config.gravity : true,
                    
                    // Visual properties from custom type
                    color: asset_data.additional_properties?.color || custom_type.visual?.emission_color,
                    emission_intensity: custom_type.visual?.emission_intensity || 0,
                    opacity: custom_type.visual?.opacity || 1.0,
                    cast_shadow: asset_data.additional_properties?.cast_shadows !== undefined ? 
                        asset_data.additional_properties.cast_shadows : custom_type.visual?.cast_shadow,
                    receive_shadow: asset_data.additional_properties?.receive_shadows !== undefined ? 
                        asset_data.additional_properties.receive_shadows : custom_type.visual?.receive_shadow,
                    
                    // Physics properties from custom type
                    mass: custom_type.physics?.mass || 1.0,
                    restitution: custom_type.physics?.restitution || 0.5,
                    friction: custom_type.physics?.friction || 0.5,
                    
                    // Size properties
                    dimensions: asset_data.additional_properties?.physical_dimensions || {
                        width: custom_type.size?.width || 1.0,
                        height: custom_type.size?.height || 1.0,
                        depth: custom_type.size?.depth || 1.0
                    },
                    
                    // Collider dimensions if specified
                    collider_dimensions: asset_data.additional_properties?.collider_dimensions,
                    
                    // Additional properties
                    custom_data: asset_data.additional_properties,
                    raycast_disabled: asset_data.additional_properties?.raycast_disabled
                };

                // Log the asset being created for debugging
                if (BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log(`Creating application asset: ${asset_data.id} (${asset_type})`, {
                        position,
                        dimensions: options.dimensions,
                        color: options.color
                    });
                }

                // Determine if we need to create a primitive or load a model
                let result = null;
                
                // Check if this is a primitive (no asset path) or a model-based asset
                if (!custom_type.paths?.asset) {
                    // This is a primitive asset, create it based on size
                    const dimensions = options.dimensions;
                    
                    if (BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Creating primitive box for ${asset_data.id} with dimensions:`, dimensions);
                    }
                    
                    // Create a primitive box with the specified dimensions and color
                    result = await this.create_primitive_box(
                        dimensions.width, 
                        dimensions.height, 
                        dimensions.depth, 
                        position, 
                        quaternion, 
                        options
                    );
                } else {
                    // This is a model-based asset, spawn it using the standard method
                    if (BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Loading model for ${asset_data.id} from path: ${custom_type.paths.asset}`);
                    }
                    
                    result = await this.spawn_asset(
                        asset_type,
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
                        console.log(`Spawned application asset: ${asset_data.id} (${asset_type})`);
                    }
                }
            }
            
            if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Spawned ${spawned_assets.length} application assets from manifest`);
            }
            
            return spawned_assets;
        } catch (error) {
            console.error("Error spawning application assets:", error);
            return spawned_assets;
        }
    }

    /**
     * Creates a spotlight helper to visualize the spotlight cone and direction.
     * Used for debugging purposes.
     * 
     * @param {THREE.SpotLight} spotlight - The spotlight to create helpers for
     * @returns {Promise<Object>} The created helper objects
     */
    async create_spotlight_helper(spotlight) {
        console.log(`==== CREATING SPOTLIGHT HELPER ====`);
        
        if (!spotlight) {
            console.error(`Cannot create helper: spotlight is null or undefined`);
            return null;
        }
        
        console.log(`Creating helper for spotlight at position: x=${spotlight.position.x}, y=${spotlight.position.y}, z=${spotlight.position.z}`);
        console.log(`Spotlight properties: angle=${spotlight.angle}, distance=${spotlight.distance}, intensity=${spotlight.intensity}`);
        console.log(`Spotlight target position: x=${spotlight.target.position.x}, y=${spotlight.target.position.y}, z=${spotlight.target.position.z}`);
        
        // Create shared materials for debug visualization with a single static color
        const sharedDebugMaterials = {
            helper: new THREE.LineBasicMaterial({ color: 0x00FF00 }), // Green for visibility
            cone: new THREE.MeshBasicMaterial({ 
                color: 0x00FF00,
                wireframe: true,
                transparent: true,
                opacity: 0.6
            })
        };
        
        console.log(`Created shared debug materials`);
        
        // Create the standard helper with shared material
        console.log(`Creating SpotLightHelper...`);
        const helper = new THREE.SpotLightHelper(spotlight);
        helper.material = sharedDebugMaterials.helper;
        
        // Store original update method
        const originalUpdate = helper.update;
        helper.update = () => {
            // Call original update
            originalUpdate.call(helper);
            // After update, ensure all children use our shared material
            helper.traverse(child => {
                if (child.material && child !== helper) {
                    child.material = sharedDebugMaterials.helper;
                }
            });
        };
        
        // Make helper and all its children non-interactive
        helper.raycast = () => null;
        helper.traverse(child => {
            child.raycast = () => null;
        });
        
        // Add helper in next frame
        console.log(`Waiting for next frame before adding helper to scene...`);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        console.log(`Adding SpotLightHelper to scene...`);
        this.scene.add(helper);
        console.log(`SpotLightHelper added to scene`);

        // Create the cone visualization with shared material
        console.log(`Calculating cone dimensions...`);
        const spotlightToTarget = new THREE.Vector3().subVectors(
            spotlight.target.position,
            spotlight.position
        );
        
        if (!spotlightToTarget) {
            console.error(`Failed to calculate spotlightToTarget vector`);
            return { helper };
        }
        
        const distance = spotlightToTarget.length();
        const height = distance;
        const radius = Math.tan(spotlight.angle) * height;
        
        console.log(`Cone dimensions: radius=${radius}, height=${height}, distance=${distance}`);
        
        console.log(`Creating cone geometry...`);
        const geometry = new THREE.ConeGeometry(radius, height, 32, 32, true);
        geometry.translate(0, -height/2, 0);
        
        console.log(`Creating cone mesh...`);
        const cone = new THREE.Mesh(geometry, sharedDebugMaterials.cone);
        cone.raycast = () => null;
        cone.traverse(child => {
            child.raycast = () => null;
        });
        
        console.log(`Setting cone position to match spotlight: x=${spotlight.position.x}, y=${spotlight.position.y}, z=${spotlight.position.z}`);
        cone.position.copy(spotlight.position);
        
        console.log(`Calculating cone orientation...`);
        const direction = spotlightToTarget.normalize();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
        
        console.log(`Setting cone quaternion: x=${quaternion.x}, y=${quaternion.y}, z=${quaternion.z}, w=${quaternion.w}`);
        cone.quaternion.copy(quaternion);
        
        console.log(`Waiting for next frame before adding cone to scene...`);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        console.log(`Adding cone to scene...`);
        this.scene.add(cone);
        console.log(`Cone added to scene`);
        
        console.log(`==== SPOTLIGHT HELPER CREATION COMPLETE ====`);
        return {
            helper,
            cone
        };
    }

    /**
     * Despawns a spotlight, removing it and its helpers from the scene.
     * 
     * @param {THREE.SpotLight} spotlight - The spotlight to despawn
     * @returns {Promise<void>}
     */
    async despawn_spotlight(spotlight) {
        if (!spotlight) return;
        
        // Remove the spotlight's target and the spotlight itself
        await new Promise(resolve => setTimeout(resolve, 0));
        this.scene.remove(spotlight.target);
        this.scene.remove(spotlight);

        // Remove debug helpers if they exist
        if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG && spotlight.userData.debugHelpers) {
            const { helper, cone } = spotlight.userData.debugHelpers;
            if (helper) {
                // Remove the helper and its children from the scene
                this.scene.remove(helper);
                if (helper.children) {
                    helper.children.forEach(child => {
                        if (child.geometry) {
                            child.geometry.dispose();
                        }
                    });
                }
                if (helper.geometry) {
                    helper.geometry.dispose();
                }
            }
            if (cone) {
                this.scene.remove(cone);
                if (cone.geometry) {
                    cone.geometry.dispose();
                }
            }
        }

        // Clean up any orphaned helpers that might have been missed
        const helpers = this.scene.children.filter(child => {
            // Only match helpers that belong to this specific spotlight
            if (child.isSpotLightHelper) {
                return child.light === spotlight;
            }
            if (child.isMesh && child.material && child.material.wireframe && 
                child.geometry && child.geometry.type === 'ConeGeometry') {
                // Check if this cone belongs to our spotlight by checking position
                return child.position.equals(spotlight.position);
            }
            return false;
        });
        
        for (const helper of helpers) {
            // Remove from scene
            this.scene.remove(helper);
            
            // Dispose geometries
            if (helper.children) {
                helper.children.forEach(child => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                });
            }
            if (helper.geometry) {
                helper.geometry.dispose();
            }
        }
    }

    /**
     * Removes only the debug helpers for a spotlight, keeping the spotlight itself.
     * 
     * @param {THREE.SpotLight} spotlight - The spotlight whose helpers should be removed
     * @returns {Promise<void>}
     */
    async despawn_spotlight_helpers(spotlight) {
        if (!spotlight || !spotlight.userData.debugHelpers) return;

        const { helper, cone } = spotlight.userData.debugHelpers;
        
        // Remove and dispose helper
        if (helper) {
            this.scene.remove(helper);
            if (helper.children) {
                helper.children.forEach(child => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                });
            }
            if (helper.geometry) {
                helper.geometry.dispose();
            }
        }
        
        // Remove and dispose cone
        if (cone) {
            this.scene.remove(cone);
            if (cone.geometry) {
                cone.geometry.dispose();
            }
        }

        // Clear the debug helpers reference
        spotlight.userData.debugHelpers = null;
    }

    /**
     * Updates all spotlight helpers to match their associated spotlights.
     * Called from the main animation loop.
     */
    update_spotlight_helpers() {
        // Find all spotlights in the scene
        this.scene.children.forEach(child => {
            if (child.isSpotLight && child.userData.debugHelpers) {
                const { helper, cone } = child.userData.debugHelpers;
                // Update the standard helper
                if (helper) {
                    helper.update();
                }
                // Update the cone position and orientation
                if (cone) {
                    // Update position
                    cone.position.copy(child.position);
                    // Update orientation
                    const spotlightToTarget = new THREE.Vector3().subVectors(
                        child.target.position,
                        child.position
                    ).normalize();
                    const quaternion = new THREE.Quaternion();
                    quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), spotlightToTarget);
                    cone.quaternion.copy(quaternion);
                }
            }
        });
    }

    /**
     * Updates the debug visualization for all spotlights based on the current flag state.
     * Shows or hides debug helpers based on the SPOTLIGHT_VISUAL_DEBUG flag.
     */
    async update_spotlight_debug_visualizations() {
        // Find all spotlights in the scene
        const spotlights = this.scene.children.filter(child => child.isSpotLight);
        if(BLORKPACK_FLAGS.ASSET_LOGS) {
            console.log(`Found ${spotlights.length} spotlights in the scene`);
        }
        if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
            console.log(`Debug visualization is enabled - creating or showing helpers`);
            // Create debug helpers for spotlights that don't have them
            for (const spotlight of spotlights) {
                if (!spotlight.userData.debugHelpers) {
                    if(BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Creating new debug helpers for spotlight at position: x=${spotlight.position.x}, y=${spotlight.position.y}, z=${spotlight.position.z}`);
                    }
                    const helpers = await this.create_spotlight_helper(spotlight);
                    spotlight.userData.debugHelpers = helpers;
                    if(BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Debug helpers created: ${helpers ? "success" : "failed"}`);
                    }
                } else {
                    // Show existing helpers
                    if(BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Showing existing debug helpers for spotlight at position: x=${spotlight.position.x}, y=${spotlight.position.y}, z=${spotlight.position.z}`);
                    }
                    if (spotlight.userData.debugHelpers.helper) {
                        spotlight.userData.debugHelpers.helper.visible = true;
                    }
                    if (spotlight.userData.debugHelpers.cone) {
                        spotlight.userData.debugHelpers.cone.visible = true;
                    }
                }
            }
        } else {
            if(BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Debug visualization is disabled - hiding helpers`);
            }
            // Hide all debug helpers
            for (const spotlight of spotlights) {
                if (spotlight.userData.debugHelpers) {
                    if(BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log(`Hiding debug helpers for spotlight at position: x=${spotlight.position.x}, y=${spotlight.position.y}, z=${spotlight.position.z}`);
                    }
                    if (spotlight.userData.debugHelpers.helper) {
                        spotlight.userData.debugHelpers.helper.visible = false;
                    }
                    if (spotlight.userData.debugHelpers.cone) {
                        spotlight.userData.debugHelpers.cone.visible = false;
                    }
                }
            }
        }
    }

    /**
     * Updates the existing create_spotlight method to include helper creation
     * 
     * @param {string} id - The ID of the spotlight
     * @param {THREE.Vector3} position - Position of the spotlight
     * @param {THREE.Euler} rotation - Rotation of the spotlight
     * @param {Object} options - Additional options for the spotlight
     * @param {Object} asset_data - The original asset data from the manifest
     * @returns {Promise<Object>} The created spotlight with all necessary components
     */
    async create_spotlight(id, position, rotation, options, asset_data) {
        // Get spotlight specific properties from additional_properties
        const color = parseInt(options.color || "0xffffff", 16);
        const intensity = asset_data?.additional_properties?.intensity || options.intensity || 0.3; // Lower default intensity
        const max_distance = asset_data?.additional_properties?.max_distance || options.max_distance || 0;
        const angle = asset_data?.additional_properties?.angle || options.angle || Math.PI / 8; // Default to narrower angle
        const penumbra = asset_data?.additional_properties?.penumbra || options.penumbra || 0.1; // Default to sharper edge
        const sharpness = asset_data?.additional_properties?.sharpness || options.sharpness || 0.5; // More sharpness
        if (BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log(`Creating spotlight for ${id}`);
                console.log(`Spotlight properties: color=${color.toString(16)}, 
                intensity=${intensity}, max_distance=${max_distance}, angle=${angle}, 
                penumbra=${penumbra}, sharpness=${sharpness}`);
        }
        // Create the spotlight
        try {
            const spotlight = new THREE.SpotLight(
                color,
                intensity,
                max_distance,
                angle,
                penumbra,
                sharpness
            );
            // Set the spotlight's position
            spotlight.position.copy(position);
            // Set shadow properties if the spotlight should cast shadows
            if (options.cast_shadow) {
                spotlight.castShadow = true;
                
                // Set shadow quality settings if provided
                if (asset_data?.additional_properties?.shadow) {
                    const shadow_props = asset_data.additional_properties.shadow;
                    
                    // Shadow map size
                    if (shadow_props.map_size) {
                        spotlight.shadow.mapSize.width = shadow_props.map_size.width || 2048;
                        spotlight.shadow.mapSize.height = shadow_props.map_size.height || 2048;
                    }
                    
                    // Shadow blur
                    if (shadow_props.blur_samples) {
                        spotlight.shadow.blurSamples = shadow_props.blur_samples;
                    }
                    
                    if (shadow_props.radius !== undefined) {
                        spotlight.shadow.radius = shadow_props.radius;
                    }
                    
                    // Camera settings
                    if (shadow_props.camera) {
                        spotlight.shadow.camera.near = shadow_props.camera.near || 10;
                        spotlight.shadow.camera.far = shadow_props.camera.far || 100;
                        spotlight.shadow.camera.fov = shadow_props.camera.fov || 30;
                    }
                    
                    // Bias settings
                    if (shadow_props.bias !== undefined) {
                        spotlight.shadow.bias = shadow_props.bias;
                    }
                    
                    if (shadow_props.normal_bias !== undefined) {
                        spotlight.shadow.normalBias = shadow_props.normal_bias;
                    }
                } else {
                    // Default shadow settings
                    spotlight.shadow.blurSamples = 32;
                    spotlight.shadow.radius = 4;
                    spotlight.shadow.mapSize.width = 2048;
                    spotlight.shadow.mapSize.height = 2048;
                    spotlight.shadow.camera.near = 10;
                    spotlight.shadow.camera.far = 100;
                    spotlight.shadow.camera.fov = 30;
                    spotlight.shadow.bias = -0.002;
                    spotlight.shadow.normalBias = 0.02;
                }
            }
            // Create and position target
            const target = new THREE.Object3D();
            // If target data is provided in the asset data, use that
            if (asset_data?.target && asset_data.target.position) {
                target.position.set(
                    asset_data.target.position.x || 0, 
                    asset_data.target.position.y || 0, 
                    asset_data.target.position.z || 0
                );
            } else {
                // Otherwise calculate target position based on rotation
                const targetDistance = 100; // Use a fixed distance for the target
                let rotX, rotY;
                
                if (rotation instanceof THREE.Euler) {
                    rotX = rotation.x || 0;
                    rotY = rotation.y || 0;
                } else {
                    // Default values if rotation is not provided as Euler
                    rotX = rotation.x || 0;
                    rotY = rotation.y || 0;
                }
                // Calculate target position based on spherical coordinates
                const x = Math.sin(rotY) * Math.cos(rotX) * targetDistance;
                const y = Math.sin(rotX) * targetDistance;
                const z = Math.cos(rotY) * Math.cos(rotX) * targetDistance;
                target.position.set(
                    position.x + x,
                    position.y + y,
                    position.z + z
                );
            }
            // Set the target
            spotlight.target = target;
            // Add objects to scene in next frame to prevent stuttering
            await new Promise(resolve => setTimeout(resolve, 0));
            // Add the spotlight and target to the scene
            try {
                this.scene.add(spotlight);
                this.scene.add(target);
            } catch (sceneError) {
                console.error(`Error adding spotlight to scene:`, sceneError);
            }
            // Set type in userData for later identification
            spotlight.userData = { 
                ...spotlight.userData,
                type: 'spotlight'
            };
            // Create debug visualization if enabled
            if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
                console.log(`Creating debug visualization for spotlight ${id} (SPOTLIGHT_VISUAL_DEBUG is enabled)`);
                try {
                    const helpers = await this.create_spotlight_helper(spotlight);
                    // Store helpers reference on the spotlight for cleanup
                    spotlight.userData.debugHelpers = helpers;
                    console.log(`Created debug helpers for spotlight ${id}: ${helpers ? JSON.stringify({
                        helper: helpers.helper ? "created" : "missing",
                        cone: helpers.cone ? "created" : "missing"
                    }) : "null"}`);
                } catch (helperError) {
                    console.error(`Error creating spotlight helpers:`, helperError);
                }
            } else {
                console.log(`Skipping debug visualization for spotlight ${id} (SPOTLIGHT_VISUAL_DEBUG is disabled)`);
            }
            // Store references for later cleanup
            const asset_object = {
                mesh: spotlight,
                body: null, // No physics for lights
                objects: [spotlight, target],
                type: 'spotlight'
            };
            // Store in asset storage for proper cleanup
            try {
                const spotlight_id = this.storage.get_new_instance_id();
                this.storage.store_static_mesh(spotlight_id, spotlight);
            } catch (storageError) {
                console.error(`Error storing spotlight in asset storage:`, storageError);
            }
            return asset_object;
        } catch (spotlightError) {
            console.error(`ERROR CREATING SPOTLIGHT: ${id}`, spotlightError);
            return null;
        }
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
                // Add other system asset types here as needed
                // Example: else if (asset_type === 'primitive_cone') { ... }
                
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
            
            // Create debug wireframe if debug is enabled
            if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
                try {
                    await this.create_debug_wireframe(
                        'box',
                        { width: collider_width * 2, height: collider_height * 2, depth: collider_depth * 2 },
                        position,
                        quaternion,
                        { color: 0x00ff00, opacity: 0.3, body }
                    );
                } catch (error) {
                    console.warn('Failed to create debug wireframe:', error);
                }
            }
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
            
            // Create debug wireframe if debug is enabled
            if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
                try {
                    await this.create_debug_wireframe(
                        'sphere',
                        { radius: radius },
                        position,
                        rotation,
                        { color: 0x00ff00, opacity: 0.3, body }
                    );
                } catch (error) {
                    console.warn('Failed to create debug wireframe:', error);
                }
            }
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
            
            // Create debug wireframe if debug is enabled
            if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
                try {
                    await this.create_debug_wireframe(
                        'capsule',
                        { radius: radius, height: height },
                        position,
                        rotation,
                        { color: 0x00ff00, opacity: 0.3, body }
                    );
                } catch (error) {
                    console.warn('Failed to create debug wireframe:', error);
                }
            }
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
            
            // Create debug wireframe if debug is enabled
            if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
                try {
                    await this.create_debug_wireframe(
                        'cylinder',
                        { radius: radius, height: height },
                        position,
                        rotation,
                        { color: 0x00ff00, opacity: 0.3, body }
                    );
                } catch (error) {
                    console.warn('Failed to create debug wireframe:', error);
                }
            }
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

    /**
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
        const camera_id = this.generate_asset_id();
        this.storage.store_static_mesh(camera_id, camera);
        
        return camera;
    }
} 