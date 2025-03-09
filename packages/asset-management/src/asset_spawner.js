import { THREE, RAPIER } from "./index.js";
import { AssetUtils } from "./index.js";
import { ASSET_CONFIGS, ASSET_TYPE } from "./asset_type.js";
import { FLAGS } from "./flags.js";
import { AssetStorage } from "./asset_storage.js";

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
            
            // Hide collision meshes (objects with names starting with "col_")
            // And collect them for potential physics use
            const collisionMeshes = [];
            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.name.startsWith('col_')) {
                        // This is a collision mesh - hide it and collect for physics
                        child.visible = false;
                        collisionMeshes.push(child);
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
                        this.createColliderFromMesh(collisionMesh, physicsBody, scale, asset_config);
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
                if (FLAGS.COLLISION_VISUAL_DEBUG) {
                    if (collisionMeshes.length > 0) {
                        // Create wireframes for each collision mesh
                        collisionMeshes.forEach((colMesh) => {
                            // We need to wait for physics to be created before creating wireframes
                            // This is important because we want to visualize the EXACT collider shape
                            // that was created, not just the mesh shape
                            setTimeout(() => {
                                if (!colMesh.userData.physicsCollider) {
                                    console.warn("No collider found for mesh, using approximate wireframe");
                                    
                                    // Get the world transform of the collision mesh
                                    const worldPosition = new THREE.Vector3();
                                    const worldQuaternion = new THREE.Quaternion();
                                    const worldScale = new THREE.Vector3();
                                    
                                    colMesh.updateWorldMatrix(true, false);
                                    colMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
                                    
                                    // Clone the actual geometry for accurate representation
                                    const clonedGeometry = colMesh.geometry.clone();
                                    
                                    // Create a wireframe using the actual collision mesh geometry
                                    this.createDebugWireframe(
                                        'mesh',
                                        null, // dimensions not needed when using the actual geometry
                                        worldPosition,
                                        worldQuaternion,
                                        { 
                                            bodyId: physicsBody.handle,
                                            geometry: clonedGeometry,
                                            originalObject: colMesh,
                                            objectId: colMesh.id,
                                            scale: worldScale
                                        }
                                    );
                                } else {
                                    // Use the exact collider shape and position
                                    const collider = colMesh.userData.physicsCollider;
                                    
                                    // Get the parent body position and rotation
                                    const bodyPos = physicsBody.translation();
                                    const bodyRot = physicsBody.rotation();
                                    
                                    // Get the collider's local position relative to the body
                                    const localPos = collider.translation();
                                    
                                    // Calculate world position by combining body position and local offset
                                    const worldPos = new THREE.Vector3(
                                        bodyPos.x + localPos.x,
                                        bodyPos.y + localPos.y,
                                        bodyPos.z + localPos.z
                                    );
                                    
                                    // Get combined rotation
                                    const worldRot = new THREE.Quaternion(
                                        bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w
                                    );
                                    
                                    // Create wireframe based on collider type and dimensions
                                    const colliderType = collider.shape.type;
                                    
                                    // Log for debugging
                                    console.log(`Creating wireframe for collider`, {
                                        type: colliderType,
                                        position: `${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}`,
                                    });
                                    
                                    if (colliderType === RAPIER.ShapeType.Cuboid) {
                                        const halfExtents = collider.shape.halfExtents;
                                        this.createDebugWireframe(
                                            'cuboid',
                                            { 
                                                x: halfExtents.x, 
                                                y: halfExtents.y, 
                                                z: halfExtents.z 
                                            },
                                            worldPos,
                                            worldRot,
                                            { 
                                                bodyId: physicsBody.handle,
                                                originalObject: colMesh,
                                                objectId: colMesh.id
                                            }
                                        );
                                    } else if (colliderType === RAPIER.ShapeType.Ball) {
                                        const radius = collider.shape.radius;
                                        this.createDebugWireframe(
                                            'sphere',
                                            { radius },
                                            worldPos,
                                            worldRot,
                                            { 
                                                bodyId: physicsBody.handle,
                                                originalObject: colMesh,
                                                objectId: colMesh.id
                                            }
                                        );
                                    } else if (colliderType === RAPIER.ShapeType.Capsule) {
                                        const radius = collider.shape.radius;
                                        const halfHeight = collider.shape.halfHeight;
                                        this.createDebugWireframe(
                                            'capsule',
                                            { 
                                                radius,
                                                height: halfHeight * 2
                                            },
                                            worldPos,
                                            worldRot,
                                            { 
                                                bodyId: physicsBody.handle,
                                                originalObject: colMesh,
                                                objectId: colMesh.id
                                            }
                                        );
                                    } else {
                                        // Fallback to mesh geometry for other types
                                        const worldScale = new THREE.Vector3(1, 1, 1);
                                        const clonedGeometry = colMesh.geometry.clone();
                                        
                                        this.createDebugWireframe(
                                            'mesh',
                                            null,
                                            worldPos,
                                            worldRot,
                                            { 
                                                bodyId: physicsBody.handle,
                                                geometry: clonedGeometry,
                                                originalObject: colMesh,
                                                objectId: colMesh.id,
                                                scale: worldScale
                                            }
                                        );
                                    }
                                }
                            }, 50); // Small delay to ensure physics is initialized
                        });
                    } else {
                        // No collision meshes, create wireframe based on object bounds
                        const boundingBox = new THREE.Box3().setFromObject(model);
                        const size = boundingBox.getSize(new THREE.Vector3());
                        const center = boundingBox.getCenter(new THREE.Vector3());
                        
                        // Calculate the scale based on the object's actual size
                        const modelScale = model.scale.clone();
                        
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
                                scale: modelScale,
                                objectId: model.id
                            }
                        );
                    }
                }
                
                if (FLAGS.PHYSICS_LOGS) {
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
        
        // Handle mesh type (using provided geometry)
        if (type === 'mesh' && options.geometry) {
            geometry = options.geometry;
            
            // If mesh geometry doesn't have a bounding box, compute it
            if (!geometry.boundingBox) {
                geometry.computeBoundingBox();
            }
        } else {
            // Create primitive geometry based on dimensions
            const size = dimensions || { x: 1, y: 1, z: 1 };
            
            switch (type) {
                case 'cuboid':
                    // Create box with FULL dimensions (not half dimensions)
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
        
        // Create wireframe material with randomized colors
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffa500, 0x00ffaa, 0xaaaaff, 0xffaaaa];
        
        // Generate a unique color index based on object's ID or position
        let colorIndex = 0;
        if (options.bodyId) {
            colorIndex = options.bodyId % colors.length;
        } else if (options.objectId) {
            colorIndex = options.objectId % colors.length;
        } else {
            // Generate a hash from position - this ensures different objects get different colors
            const posHash = Math.abs(
                Math.round(position.x * 100) + 
                Math.round(position.y * 10) + 
                Math.round(position.z)
            );
            colorIndex = posHash % colors.length;
        }
        
        const color = colors[colorIndex];
        
        const material = new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Apply position and rotation
        mesh.position.copy(position);
        mesh.quaternion.copy(rotation);
        
        // Handle scale - crucial for correct wireframe size
        if (options.scale) {
            // For mesh type, apply the scale directly
            mesh.scale.copy(options.scale);
        }
        
        mesh.renderOrder = 999; // Ensure wireframes render on top
        
        // Store any references needed to update this wireframe
        mesh.userData.physicsBodyId = options.bodyId;
        mesh.userData.debugType = type;
        mesh.userData.originalObject = options.originalObject;
        
        // Debug logging for scale issues
        const objectName = options.originalObject ? options.originalObject.name : 'unknown';
        const scaleStr = options.scale ? 
            `${options.scale.x.toFixed(2)}, ${options.scale.y.toFixed(2)}, ${options.scale.z.toFixed(2)}` : 
            'none';
        
        console.log(`Creating wireframe for ${objectName} with scale: ${scaleStr} at position: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
        
        // Only add to scene and store if debug is enabled
        if (FLAGS.COLLISION_VISUAL_DEBUG) {
            this.scene.add(mesh);
            this.debugMeshes.set(mesh.uuid, mesh);
        }
        
        return mesh;
    }

    /**
     * Updates the positions of debug wireframes based on physics bodies.
     */
    update_debug_wireframes() {
        if (!FLAGS.COLLISION_VISUAL_DEBUG) return;
        
        // Get all dynamic bodies from storage
        const dynamicBodies = this.storage.get_all_dynamic_bodies();
        
        // Update existing wireframes
        this.debugMeshes.forEach((wireframeMesh) => {
            // Skip if this is a static wireframe (no physics body)
            if (!wireframeMesh.userData.physicsBodyId) return;
            
            // Find the matching body for this wireframe
            let foundBody = null;
            
            // Find the body with this ID
            for (const [bodyMesh, body] of dynamicBodies) {
                if (body.handle === wireframeMesh.userData.physicsBodyId) {
                    foundBody = body;
                    break;
                }
            }
            
            // Update position and rotation if body found
            if (foundBody) {
                const position = foundBody.translation();
                const rotation = foundBody.rotation();
                
                // Apply position and rotation updates
                wireframeMesh.position.set(position.x, position.y, position.z);
                wireframeMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                
                // If we have the original object, update scale if needed
                const originalObject = wireframeMesh.userData.originalObject;
                if (originalObject) {
                    // Check if the original object's world scale has changed
                    const worldScale = new THREE.Vector3();
                    originalObject.updateWorldMatrix(true, false);
                    originalObject.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), worldScale);
                    
                    // If scale has changed, update the wireframe scale
                    if (!wireframeMesh.scale.equals(worldScale)) {
                        wireframeMesh.scale.copy(worldScale);
                    }
                }
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
        if (FLAGS.COLLISION_VISUAL_DEBUG) {
            this.update_debug_wireframes();
        }
        
        // Any other periodic cleanup tasks can be added here
    }

    /**
     * Creates a collider based on a mesh's geometry.
     * @param {THREE.Mesh} mesh - The mesh to create a collider from
     * @param {RAPIER.RigidBody} body - The rigid body to attach the collider to
     * @param {number} scale - The scale factor for the model
     * @param {Object} asset_config - Configuration for the asset
     */
    createColliderFromMesh(mesh, body, scale, asset_config) {
        if (!mesh || !body) return null;
        
        // Get the geometry
        const geometry = mesh.geometry;
        if (!geometry) return null;
        
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
        
        // Log for debugging
        console.log(`Creating collider for ${mesh.name}:`, {
            worldPos: `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`,
            bodyPos: `${bodyPos.x.toFixed(2)}, ${bodyPos.y.toFixed(2)}, ${bodyPos.z.toFixed(2)}`,
            relativePos: `${relativePos.x.toFixed(2)}, ${relativePos.y.toFixed(2)}, ${relativePos.z.toFixed(2)}`,
            meshScale: `${meshScale.x.toFixed(2)}, ${meshScale.y.toFixed(2)}, ${meshScale.z.toFixed(2)}`
        });
        
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
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            const height = (box.max.y - box.min.y) * meshScale.y;
            const radius = Math.max(
                (box.max.x - box.min.x), 
                (box.max.z - box.min.z)
            ) * meshScale.x * 0.5;
            
            colliderDesc = RAPIER.ColliderDesc.capsule(height * 0.5, radius);
            
        } else {
            // Default to cuboid
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            
            // Use exact dimensions from mesh's bounding box, scaled by the mesh's world scale
            const hx = (box.max.x - box.min.x) * meshScale.x * 0.5;
            const hy = (box.max.y - box.min.y) * meshScale.y * 0.5;
            const hz = (box.max.z - box.min.z) * meshScale.z * 0.5;
            
            colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
        }
        
        // Apply position offset
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
        // Note: We're using the internal FLAGS but also accepting external control
        FLAGS.COLLISION_VISUAL_DEBUG = enabled;
        
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
                    
                    // Temporarily update matrices to get world position
                    colMesh.updateWorldMatrix(true, false);
                    colMesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
                    
                    // Scale down the worldScale if needed - adjust this as needed
                    // In some cases, the original scale might be too large for the wireframe
                    const adjustedScale = worldScale.clone();
                    if (adjustedScale.x > 1 || adjustedScale.y > 1 || adjustedScale.z > 1) {
                        adjustedScale.multiplyScalar(0.2); // Scale it down
                    }
                    
                    // Clone the actual geometry for accurate representation
                    const clonedGeometry = colMesh.geometry.clone();
                    
                    // Create a wireframe using the actual collision mesh geometry
                    this.createDebugWireframe(
                        'mesh',
                        null, // dimensions not needed when using the actual geometry
                        worldPosition,
                        worldQuaternion,
                        { 
                            bodyId: body.handle, // Use body.handle NOT physicsBody.handle
                            geometry: clonedGeometry,
                            originalObject: colMesh,
                            objectId: colMesh.id,
                            scale: adjustedScale // Use adjusted scale
                        }
                    );
                });
            } else {
                // No collision meshes, create wireframe based on object bounds
                const boundingBox = new THREE.Box3().setFromObject(mesh);
                const size = boundingBox.getSize(new THREE.Vector3());
                const center = boundingBox.getCenter(new THREE.Vector3());
                
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
                        bodyId: body.handle, // Use body.handle NOT physicsBody.handle
                        originalObject: mesh,
                        objectId: mesh.id,
                        scale: new THREE.Vector3(1, 1, 1) // Use a default scale
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
                // Try to find collision meshes in static objects too
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
                        
                        // Scale down the worldScale if needed
                        const adjustedScale = worldScale.clone();
                        if (adjustedScale.x > 1 || adjustedScale.y > 1 || adjustedScale.z > 1) {
                            adjustedScale.multiplyScalar(0.2); // Scale it down to 20%
                        }
                        
                        // Clone the actual geometry for accurate representation
                        const clonedGeometry = colMesh.geometry.clone();
                        
                        // Create a wireframe using the actual collision mesh geometry
                        this.createDebugWireframe(
                            'mesh',
                            null, // dimensions not needed when using the actual geometry
                            worldPosition,
                            worldQuaternion,
                            { 
                                geometry: clonedGeometry,
                                originalObject: colMesh,
                                objectId: colMesh.id,
                                scale: adjustedScale
                            }
                        );
                    });
                } else {
                    // No collision meshes, fallback to bounding box
                    const boundingBox = new THREE.Box3().setFromObject(mesh);
                    const size = boundingBox.getSize(new THREE.Vector3());
                    const center = boundingBox.getCenter(new THREE.Vector3());
                    
                    this.createDebugWireframe(
                        'cuboid', 
                        { 
                            x: size.x * 0.5 * 0.2, // Scale down by 80%
                            y: size.y * 0.5 * 0.2,
                            z: size.z * 0.5 * 0.2
                        }, 
                        center, 
                        mesh.quaternion,
                        { 
                            originalObject: mesh,
                            objectId: mesh.id,
                            scale: new THREE.Vector3(1, 1, 1) 
                        }
                    );
                }
            }
        });
    }
} 