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
     * @returns {THREE.Mesh} The created wireframe mesh.
     */
    createDebugWireframe(type, dimensions, position, rotation) {
        if (!FLAGS.COLLISION_VISUAL_DEBUG) return null;
        
        let geometry;
        const size = dimensions || { x: 1, y: 1, z: 1 };
        
        switch (type) {
            case 'cuboid':
                geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(size.radius || 1, 16, 16);
                break;
            case 'capsule':
                // Approximate capsule with cylinder and two spheres
                geometry = new THREE.CylinderGeometry(size.radius, size.radius, size.height, 16);
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }
        
        // Create wireframe material with cycling colors for distinction
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        const color = colors[this.debugColorIndex % colors.length];
        this.debugColorIndex++;
        
        const material = new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.quaternion.copy(rotation);
        
        this.scene.add(mesh);
        this.debugMeshes.set(mesh.uuid, mesh);
        
        return mesh;
    }

    /**
     * Updates the positions of debug wireframes based on physics bodies.
     */
    update_debug_wireframes() {
        if (!FLAGS.COLLISION_VISUAL_DEBUG) return;
        
        // Update wireframe positions based on physics bodies
        this.debugMeshes.forEach((mesh) => {
            const bodyPair = this.storage.get_body_pair_by_mesh(mesh);
            if (bodyPair && bodyPair.body) {
                const position = bodyPair.body.translation();
                mesh.position.set(position.x, position.y, position.z);
                
                const rotation = bodyPair.body.rotation();
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
        
        mesh.updateMatrixWorld();
        mesh.matrixWorld.decompose(position, quaternion, meshScale);
        
        // Adjust position for physics (since we're adding a collider to an existing body)
        const bodyPos = body.translation();
        const relativePos = {
            x: position.x - bodyPos.x,
            y: position.y - bodyPos.y,
            z: position.z - bodyPos.z
        };
        
        let colliderDesc;
        
        // Detect shape from name (often models use naming conventions)
        if (mesh.name.includes('sphere') || mesh.name.includes('ball')) {
            // Create a sphere collider
            // Estimate radius from geometry bounds
            geometry.computeBoundingSphere();
            const radius = geometry.boundingSphere.radius * scale;
            colliderDesc = RAPIER.ColliderDesc.ball(radius);
            
        } else if (mesh.name.includes('capsule')) {
            // Create a capsule collider
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            const height = (box.max.y - box.min.y) * scale;
            const radius = Math.max(
                (box.max.x - box.min.x), 
                (box.max.z - box.min.z)
            ) * scale * 0.5;
            
            colliderDesc = RAPIER.ColliderDesc.capsule(height * 0.5, radius);
            
        } else {
            // Default to cuboid
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            const hx = (box.max.x - box.min.x) * scale * 0.5 * meshScale.x;
            const hy = (box.max.y - box.min.y) * scale * 0.5 * meshScale.y;
            const hz = (box.max.z - box.min.z) * scale * 0.5 * meshScale.z;
            
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
        
        return collider;
    }
} 