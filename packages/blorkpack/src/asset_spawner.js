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
function generateIndices(geometry) {
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
            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.name.startsWith('col_')) {
                        // This is a collision mesh - hide it and collect for physics
                        child.visible = false;
                        collisionMeshes.push(child);
                    } else {
                        // Add interactable_ prefix to all visible meshes to make them grabbable
                        // Use the same naming convention for child meshes
                        const childId = child.id || Math.floor(Math.random() * 10000);
                        child.name = `interactable_${asset_type}_${child.name || 'part'}_${childId}`;
                    }
                }
            });
            
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
                        this.createColliderFromMesh(collisionMesh, physicsBody, asset_config);
                    }
                } else {
                    // Fallback to simple cuboid collider
                    const halfScale = asset_config.scale / 2;
                    let colliderDesc;
                    
                    // Use different collider shapes based on asset type or configuration
                    if (options.colliderType === 'sphere') {
                        colliderDesc = RAPIER.ColliderDesc.ball(halfScale);
                    } else if (options.colliderType === 'capsule') {
                        colliderDesc = RAPIER.ColliderDesc.capsule(halfScale, halfScale * 0.5);
                    } else {
                        // Default to cuboid
                        colliderDesc = RAPIER.ColliderDesc.cuboid(halfScale, halfScale, halfScale);
                    }
                    
                    // Set mass and material properties
                    if (asset_config.mass) {
                        colliderDesc.setMass(asset_config.mass);
                    } else {
                        // Default mass if not specified
                        colliderDesc.setMass(1.0);
                    }
                    
                    if (asset_config.restitution) {
                        colliderDesc.setRestitution(asset_config.restitution);
                    } else {
                        // Default restitution (bounciness) if not specified
                        colliderDesc.setRestitution(0.2);
                    }
                    
                    // Set friction
                    colliderDesc.setFriction(0.7);
                    
                    // Create the collider and attach it to the physics body
                    this.world.createCollider(colliderDesc, physicsBody);
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
                    if (collisionMeshes.length > 0) {
                        // Create wireframes for each collision mesh
                        collisionMeshes.forEach((colMesh) => {
                            // Get the world transform of the collision mesh
                            const worldPosition = new THREE.Vector3();
                            const worldQuaternion = new THREE.Quaternion();
                            const worldScale = new THREE.Vector3();
                            
                            colMesh.updateWorldMatrix(true, false);
                            colMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
                            
                            // Clone the geometry to create an exact wireframe representation
                            const clonedGeometry = colMesh.geometry.clone();
                            
                            console.log(`Creating asset wireframe for: ${colMesh.name}`);
                            
                            // Create a wireframe using the actual collision mesh geometry
                            this.createDebugWireframe(
                                'mesh',
                                null,  // Dimensions not needed when using actual geometry
                                worldPosition,
                                worldQuaternion,
                                { 
                                    bodyId: physicsBody.handle,
                                    geometry: clonedGeometry,
                                    originalObject: colMesh,
                                    objectId: colMesh.id,
                                    scale: worldScale,
                                    isStatic: false // Explicitly mark as NOT static
                                }
                            );
                        });
                    } else {
                        // No collision meshes, create wireframe based on object bounds
                        const boundingBox = new THREE.Box3().setFromObject(model);
                        const size = boundingBox.getSize(new THREE.Vector3());
                        const center = boundingBox.getCenter(new THREE.Vector3());
                        
                        console.log(`Creating fallback asset wireframe for: ${model.name}`);
                        
                        // Create the debug wireframe
                        this.createDebugWireframe(
                            'cuboid', 
                            { 
                                x: size.x * 0.5, 
                                y: size.y * 0.5, 
                                z: size.z * 0.5 
                            }, 
                            center, 
                            model.quaternion,
                            { 
                                bodyId: physicsBody.handle,
                                originalObject: model,
                                objectId: model.id,
                                isStatic: false // Explicitly mark as NOT static
                            }
                        );
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
     * @returns {THREE.Mesh} The created wireframe mesh.
     */
    createDebugWireframe(type, dimensions, position, rotation, options = {}) {
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
        
        // Reset instance
        AssetSpawner.instance = null;
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
        
        // Any other periodic cleanup tasks can be added here
    }

    /**
     * Creates a collider based on a mesh's geometry.
     * @param {THREE.Mesh} mesh - The mesh to create a collider from
     * @param {RAPIER.RigidBody} body - The rigid body to attach the collider to
     * @param {Object} asset_config - Configuration for the asset
     */
    createColliderFromMesh(mesh, body, asset_config) {
        if (!mesh || !body) return null;
        
        // Get the geometry
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
        
        let colliderDesc;
        
        // Detect shape from name (often models use naming conventions)
        if (mesh.name.includes('sphere') || mesh.name.includes('ball')) {
            // Create a sphere collider
            // Estimate radius from geometry bounds
            geometry.computeBoundingSphere();
            const radius = geometry.boundingSphere.radius * meshScale.x;
            colliderDesc = RAPIER.ColliderDesc.ball(radius);
            
        } else if (mesh.name.includes('capsule')) {
            // Create a capsule collider
            const height = (box.max.y - box.min.y) * meshScale.y;
            const radius = Math.max(
                (box.max.x - box.min.x), 
                (box.max.z - box.min.z)
            ) * meshScale.x * 0.5;
            
            colliderDesc = RAPIER.ColliderDesc.capsule(height * 0.5, radius);
            
        } else {
            // Default to cuboid
            // Use exact dimensions from mesh's bounding box, scaled by the mesh's world scale
            const hx = (box.max.x - box.min.x) * meshScale.x * 0.5;
            const hy = (box.max.y - box.min.y) * meshScale.y * 0.5;
            const hz = (box.max.z - box.min.z) * meshScale.z * 0.5;
            
            colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
        }
        
        // Apply position offset (for standard colliders)
        colliderDesc.setTranslation(relativePos.x, relativePos.y, relativePos.z);
        
        // Apply rotation
        colliderDesc.setRotation(quaternion);
        
        // Set physical properties
        if (asset_config.mass) {
            colliderDesc.setMass(asset_config.mass);
        }
        
        if (asset_config.restitution) {
            colliderDesc.setRestitution(asset_config.restitution);
        }
        
        colliderDesc.setFriction(0.7);
        
        // Create the collider
        const collider = this.world.createCollider(colliderDesc, body);
        
        // Store reference to the collider on the mesh for debugging
        mesh.userData.physicsCollider = collider;
        
        return collider;
    }

    /**
     * Sets the collision debug state for this spawner.
     * This allows the main application to control debug visualization.
     * @param {boolean} enabled - Whether collision debug should be enabled
     */
    setCollisionDebug(enabled) {
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
        this.createDebugWireframesForAllBodies();
    }
    
    /**
     * Creates debug wireframes for all physics bodies.
     * This is used when enabling debug visualization after objects are already created.
     */
    createDebugWireframesForAllBodies() {
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
        dynamicBodies.forEach(([mesh, body]) => {
            if (!body) return;
            
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
                collisionMeshes.forEach((colMesh) => {
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
                    this.createDebugWireframe(
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
                });
            } else {
                // No collision meshes, create wireframe based on object bounds
                const boundingBox = new THREE.Box3().setFromObject(mesh);
                const size = boundingBox.getSize(new THREE.Vector3());
                const center = boundingBox.getCenter(new THREE.Vector3());
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log(`Creating fallback dynamic wireframe for: ${mesh.name}`);
                }
                
                // Create the debug wireframe
                this.createDebugWireframe(
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
        });
        
        // Also check for static bodies that might have physics
        const staticMeshes = this.storage.get_all_static_meshes();
        staticMeshes.forEach((mesh) => {
            if (!mesh) return;
            
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
                
                this.createDebugWireframe(
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
        });
    }
} 