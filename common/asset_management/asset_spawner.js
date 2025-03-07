import { RAPIER, THREE } from "..";
import { TYPES } from "../../viewport/overlay/overlay_common";
import { FLAGS } from "../flags";
import { TextureAtlasManager } from '../texture_atlas_manager';
import { AssetStorage } from './asset_storage';
import { ASSET_TYPE, ASSET_CONFIGS } from './asset_type';

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
 * Handles both static and dynamic (physics-enabled) assets, texture atlasing,
 * and material optimization.
 */
export class AssetSpawner {
    static instance = null;
    static instance_counter = 0;
    name = "[AssetSpawner]";
    textureAtlasManager = TextureAtlasManager.getInstance();
    pendingTextures = new Map(); // Track textures waiting to be atlased
    debugMeshes = new Map(); // Store debug wireframe meshes
    debugColorIndex = 0; // Counter for cycling through debug colors
    objectPools = new Map(); // Pool for reusing objects
    materialPool = new Map(); // Pool for reusing materials
    poolSize = 20; // Maximum size for each object pool
    disposalQueue = new Set(); // Queue for objects to be disposed
    lastCleanupTime = 0;
    cleanupInterval = 5000; // Cleanup every 5 seconds
    
    constructor(world) {
        if (AssetSpawner.instance) {
            return AssetSpawner.instance;
        }
        this.world = world;
        this.storage = AssetStorage.get_instance();
        this.textureAtlasManager = TextureAtlasManager.getInstance();
        this.pendingTextures = new Map();
        this.debugMeshes = new Map();
        this.debugColorIndex = 0;
        this.objectPools = new Map();
        this.materialPool = new Map();
        this.poolSize = 20;
        this.disposalQueue = new Set();
        this.lastCleanupTime = 0;
        this.cleanupInterval = 5000;

        // Initialize material pool
        this.initializeMaterialPool();

        // Initialize pools for each asset type
        Object.values(ASSET_TYPE).forEach(type => {
            this.objectPools.set(type, []);
        });
        
        // Initialize pools for special types
        this.objectPools.set('scroll_menu', []);
        this.objectPools.set('main_signs', []);

        // Now initialize the pools with preallocated assets
        this.initializePools();
        AssetSpawner.instance = this;
    }

    /**
     * Initialize the material pool with commonly used materials
     */
    initializeMaterialPool() {
        // Create and cache basic materials for signs and common uses
        const signMaterial = new THREE.MeshBasicMaterial({ 
            visible: false,
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide
        });
        this.materialPool.set('sign', signMaterial);

        const chainMaterial = new THREE.MeshBasicMaterial({ 
            visible: false,
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide
        });
        this.materialPool.set('chain', chainMaterial);

        // Debug materials with different colors
        const debugColors = [
            0xff0000, // Red
            0x00ff00, // Green
            0x0000ff, // Blue
            0xff00ff, // Magenta
            0xffff00, // Yellow
            0x00ffff, // Cyan
            0xff8000, // Orange
            0x8000ff  // Purple
        ];

        // Create debug wireframe materials for each color
        debugColors.forEach((color, index) => {
            const debugMaterial = new THREE.MeshBasicMaterial({
                color: color,
                wireframe: true,
                transparent: true,
                opacity: 0.5,
                depthTest: true,
                side: THREE.DoubleSide
            });
            this.materialPool.set(`debug_${index}`, debugMaterial);
        });

        // Common materials for basic shapes
        const basicWhiteMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        this.materialPool.set('basic_white', basicWhiteMaterial);

        const basicTransparentMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.materialPool.set('basic_transparent', basicTransparentMaterial);
    }

    /**
     * Get a material from the pool or create a new one
     * @param {string} type - Type of material needed
     * @returns {THREE.Material} The pooled material
     */
    getMaterial(type) {
        return this.materialPool.get(type) || new THREE.MeshBasicMaterial({ visible: false });
    }

    /**
     * Initialize object pools for different asset types and preallocate common assets
     */
    initializePools() {
        if (FLAGS.ASSET_LOGS) console.log('Initializing object pools...');
        // Preallocate memory for frequently used assets
        this.preallocateAssets().catch(error => {
            console.error('Error during asset preallocation:', error);
        });
    }

    /**
     * Preallocates memory for frequently used assets like signs and their assemblies
     */
    async preallocateAssets() {
        try {
            // Define preallocation configuration
            const PREALLOC_CONFIG = {
                SCROLL_MENU: {
                    count: 5,
                    components: ['sign', 'chain_segment']
                },
                MAIN_SIGNS: {
                    count: 10,
                    components: ['sign']
                }
            };

            if(FLAGS.ASSET_LOGS) console.log('Starting asset preallocation...');

            // Create shared geometries
            const signGeometry = new THREE.BoxGeometry(2, 2, 0.01);
            const chainGeometry = new THREE.SphereGeometry(0.1);

            // Get shared materials
            const signMaterial = this.getMaterial('sign');
            const chainMaterial = this.getMaterial('chain');

            // Preallocate scroll menu assemblies
            for (let i = 0; i < PREALLOC_CONFIG.SCROLL_MENU.count; i++) {
                // Create sign components using shared resources
                const signMesh = new THREE.Mesh(signGeometry, signMaterial);
                const signBody = this.world?.createRigidBody(
                    RAPIER.RigidBodyDesc.dynamic()
                        .setTranslation(0, 0, 0)
                        .setLinearDamping(0.8)
                        .setAngularDamping(1.0)
                        .setCanSleep(true)  // Enable sleeping for sign
                        .setSleepThreshold(0)  // Make it sleep immediately
                );
                
                // Force the sign to sleep initially
                signBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
                signBody?.setAngvel({ x: 0, y: 0, z: 0 }, true);
                signBody?.sleep();

                // Create chain segments using shared resources
                const chainSegments = [];
                for (let j = 0; j < 6; j++) {
                    const segmentMesh = new THREE.Mesh(chainGeometry, chainMaterial);
                    const segmentBody = this.world?.createRigidBody(
                        RAPIER.RigidBodyDesc.dynamic()
                            .setTranslation(0, 0, 0)
                            .setLinearDamping(0.8)
                            .setAngularDamping(1.0)
                            .setCanSleep(true)  // Enable sleeping
                            .setSleepThreshold(0)  // Make it sleep immediately
                    );
                    // Force the body to sleep initially
                    segmentBody?.sleep();
                    chainSegments.push({ mesh: segmentMesh, body: segmentBody });
                }

                const assembly = {
                    sign: { mesh: signMesh, body: signBody },
                    chainSegments: chainSegments,
                    isAssembly: true
                };
                
                this.objectPools.get('scroll_menu').push(assembly);
            }

            // Preallocate main signs using shared resources
            for (let i = 0; i < PREALLOC_CONFIG.MAIN_SIGNS.count; i++) {
                const signMesh = new THREE.Mesh(signGeometry, signMaterial);
                const signBody = this.world?.createRigidBody(
                    RAPIER.RigidBodyDesc.dynamic()
                        .setTranslation(0, 0, 0)
                        .setLinearDamping(0.5)
                        .setAngularDamping(0.5)
                );
                
                this.objectPools.get('main_signs').push({
                    mesh: signMesh,
                    body: signBody
                });
            }

            if(FLAGS.ASSET_LOGS) console.log('Asset preallocation complete:', {
                scrollMenuAssemblies: this.objectPools.get('scroll_menu').length,
                mainSigns: this.objectPools.get('main_signs').length
            });

        } catch (error) {
            console.error('Error during asset preallocation:', error);
        }
    }

    /**
     * Get a preallocated assembly from the pool
     * @param {string} assemblyType - Type of assembly ('scroll_menu' or 'main_signs')
     * @returns {Object} The assembly object or null if none available
     */
    getPreallocatedAssembly(assemblyType) {
        const pool = this.objectPools.get(assemblyType);
        if (pool && pool.length > 0) {
            const assembly = pool.pop();
            if (assembly.isAssembly) {
                // Reset assembly components
                assembly.sign.mesh.visible = true;
                assembly.chainSegments.forEach(segment => {
                    segment.mesh.visible = true;
                    // Ensure chain segments start sleeping
                    segment.body?.sleep();
                });
            } else {
                assembly.mesh.visible = true;
            }
            return assembly;
        }
        return null;
    }

    /**
     * Return a preallocated assembly to the pool
     * @param {string} assemblyType - Type of assembly
     * @param {Object} assembly - The assembly to return
     */
    returnPreallocatedAssembly(assemblyType, assembly) {
        const pool = this.objectPools.get(assemblyType);
        if (pool && pool.length < this.poolSize) {
            if (assembly.isAssembly) {
                // Reset assembly state
                assembly.sign.mesh.visible = false;
                assembly.sign.mesh.position.set(0, 0, 0);
                assembly.sign.body.setTranslation({ x: 0, y: 0, z: 0 }, true);
                
                assembly.chainSegments.forEach(segment => {
                    segment.mesh.visible = false;
                    segment.mesh.position.set(0, 0, 0);
                    segment.body.setTranslation({ x: 0, y: 0, z: 0 }, true);
                    // Ensure chain segments are sleeping when returned to pool
                    segment.body?.sleep();
                });
            } else {
                assembly.mesh.visible = false;
                assembly.mesh.position.set(0, 0, 0);
                assembly.body.setTranslation({ x: 0, y: 0, z: 0 }, true);
            }
            pool.push(assembly);
        } else {
            this.disposalQueue.add(assembly);
        }
    }

    /**
     * Get an object from the pool or create a new one
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum
     * @returns {Object} The pooled or new object
     */
    getFromPool(asset_type) {
        const pool = this.objectPools.get(asset_type);
        if (pool && pool.length > 0) {
            const object = pool.pop();
            if (FLAGS.ASSET_LOGS) console.log(`Retrieved ${asset_type} from pool`);
            return object;
        }
        return null;
    }

    /**
     * Return an object to the pool
     * @param {string} asset_type - Type of asset
     * @param {Object} object - Object to return to pool
     */
    returnToPool(asset_type, object) {
        const pool = this.objectPools.get(asset_type);
        if (pool && pool.length < this.poolSize) {
            // Reset object state
            if (object.mesh) {
                object.mesh.position.set(0, 0, 0);
                object.mesh.quaternion.set(0, 0, 0, 1);
                object.mesh.visible = false;
            }
            if (object.body) {
                object.body.setTranslation({ x: 0, y: 0, z: 0 }, true);
                object.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                object.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            }
            pool.push(object);
            if (FLAGS.ASSET_LOGS) console.log(`Returned ${asset_type} to pool`);
        } else {
            // Queue for disposal if pool is full
            this.disposalQueue.add(object);
        }
    }

    /**
     * Periodic cleanup of disposed objects
     */
    performCleanup() {
        const currentTime = Date.now();
        if (currentTime - this.lastCleanupTime < this.cleanupInterval) return;
        
        if (this.disposalQueue.size === 0) {
            this.lastCleanupTime = currentTime;
            return;
        }
        
        if (FLAGS.PHYSICS_LOGS) {
            console.log(`${this.name} Cleaning up ${this.disposalQueue.size} objects`);
        }
        
        this.disposalQueue.forEach(object => {
            // Properly dispose of geometries
            if (object.mesh && object.mesh.geometry) {
                object.mesh.geometry.dispose();
            }
            
            // Properly dispose of materials (handle arrays of materials)
            if (object.mesh && object.mesh.material) {
                if (Array.isArray(object.mesh.material)) {
                    object.mesh.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    });
                } else {
                    if (object.mesh.material.map) object.mesh.material.map.dispose();
                    object.mesh.material.dispose();
                }
            }
            
            // Remove from physics world if needed
            if (object.body && this.world) {
                this.world.removeRigidBody(object.body);
            }
            
            // Remove from parent
            if (object.mesh && object.mesh.parent) {
                object.mesh.parent.remove(object.mesh);
            }
        });
        
        // Clear the disposal queue
        this.disposalQueue.clear();
        this.lastCleanupTime = currentTime;
    }

    /**
     * Gets or creates the singleton instance of AssetSpawner.
     * @param {RAPIER.World} world - The physics world instance
     * @returns {AssetSpawner} The singleton instance.
     */
    static get_instance(world) {
        if (!AssetSpawner.instance) {
            AssetSpawner.instance = new AssetSpawner(world);
        }
        return AssetSpawner.instance;
    }

    /**
     * Processes textures for a mesh and creates a texture atlas.
     * @param {THREE.Mesh|THREE.Object3D} mesh - The mesh whose textures need to be processed.
     * @returns {Promise<THREE.Texture|null>} The created texture atlas or null if no textures found.
     */
    async processTexturesForAtlas(mesh) {
        const textures = new Set();
        mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (material.map) textures.add(material.map);
                });
            }
        });
        if (textures.size === 0) return null;
        // Create atlas if we have enough textures or if we're forced to
        if (textures.size > 0) {
            const atlas = await this.textureAtlasManager.createAtlas(Array.from(textures));
            // Update all materials to use the atlas
            mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        if (material.map) {
                            this.textureAtlasManager.updateMaterialWithAtlas(child, atlas, material.map);
                        }
                    });
                }
            });
            return atlas;
        }
        return null;
    }

    /**
     * Get a debug material from the pool
     * @returns {THREE.Material} A pooled debug material
     */
    getDebugMaterial() {
        const index = this.debugColorIndex % 8; // 8 colors in our pool
        this.debugColorIndex++;
        return this.materialPool.get(`debug_${index}`);
    }

    /**
     * Creates a debug wireframe mesh for a collider
     * @param {string} type - Type of collider ('cuboid', 'trimesh', 'sphere')
     * @param {Object} dimensions - Dimensions of the collider
     * @param {THREE.Vector3} position - Position of the collider
     * @param {THREE.Quaternion} rotation - Rotation of the collider
     * @returns {THREE.Mesh} The debug wireframe mesh
     */
    createDebugWireframe(type, dimensions, position, rotation) {
        // Always create the wireframe, but control visibility with the flag
        // if (!FLAGS.COLLISION_VISUAL_DEBUG) return null;

        let geometry;
        switch (type) {
            case 'cuboid':
                geometry = new THREE.BoxGeometry(
                    dimensions.width * 2,
                    dimensions.height * 2,
                    dimensions.depth * 2
                );
                break;
            case 'trimesh':
                // For trimesh, we use the provided geometry
                if (dimensions.geometry) {
                    geometry = dimensions.geometry.clone();
                } else {
                    console.warn('No geometry provided for trimesh debug wireframe');
                    return null;
                }
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(dimensions.radius, 16, 12);
                break;
            default:
                console.warn(`Unknown collider type: ${type}`);
                return null;
        }
        
        // Use pooled debug material
        const material = this.getDebugMaterial();
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Set position and rotation
        if (position) mesh.position.copy(position);
        if (rotation) mesh.quaternion.copy(rotation);
        
        mesh.renderOrder = 999;
        
        // Set initial visibility based on flag
        mesh.visible = FLAGS.COLLISION_VISUAL_DEBUG;
        
        return mesh;
    }

    /**
     * Spawns a physics-enabled asset of the specified type.
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum.
     * @param {THREE.Object3D} parent - Parent object to add the mesh to.
     * @param {RAPIER.World} world - Physics world to create the body in.
     * @param {Object} options - Additional options (e.g., color).
     * @param {THREE.Vector3} position_offset - Position offset from parent.
     * @returns {Promise<Array>} Promise resolving to [mesh, body] pair for physics updates.
     */
    async spawn_asset(asset_type, parent, world, options = {}, position_offset = new THREE.Vector3(0, 0, 0)) {
        try {
            // Check if this is a scroll menu or main sign spawn
            if (asset_type === 'scroll_menu' || asset_type === 'main_signs') {
                const assembly = this.getPreallocatedAssembly(asset_type);
                if (assembly) {
                    if (assembly.isAssembly) {
                        // Position and configure scroll menu assembly
                        assembly.sign.mesh.position.copy(position_offset);
                        assembly.sign.body.setTranslation(position_offset, true);
                        assembly.sign.body?.setLinvel({ x: 0, y: 0, z: 0 }, true);
                        assembly.sign.body?.setAngvel({ x: 0, y: 0, z: 0 }, true);
                        assembly.sign.body?.sleep();
                        
                        // Position chain segments with precise positioning
                        assembly.chainSegments.forEach((segment, index) => {
                            const segmentOffset = new THREE.Vector3(
                                position_offset.x,
                                position_offset.y - (index + 1) * 0.5,
                                position_offset.z
                            );
                            segment.mesh.position.copy(segmentOffset);
                            segment.body.setTranslation(segmentOffset, true);
                            segment.body?.setLinvel({ x: 0, y: 0, z: 0 }, true);
                            segment.body?.setAngvel({ x: 0, y: 0, z: 0 }, true);
                            segment.body?.sleep();
                        });

                        // Add a method to wake up the entire assembly
                        assembly.wakeUp = () => {
                            assembly.sign.body?.wakeUp();
                            assembly.chainSegments.forEach(segment => segment.body?.wakeUp());
                        };

                        parent.add(assembly.sign.mesh);
                        assembly.chainSegments.forEach(segment => parent.add(segment.mesh));
                    } else {
                        // Position and configure main sign
                        assembly.mesh.position.copy(position_offset);
                        assembly.body.setTranslation(position_offset, true);
                        parent.add(assembly.mesh);
                    }
                    return assembly;
                }
            }

            // If not a special assembly or no preallocated assembly available, proceed with normal spawn
            // Check pool first
            const pooledObject = this.getFromPool(asset_type);
            if (pooledObject) {
                const { mesh, body } = pooledObject;
                mesh.visible = true;
                mesh.position.copy(position_offset);
                body.setTranslation(position_offset, true);
                parent.add(mesh);
                return [mesh, body];
            }

            if (!Object.values(ASSET_TYPE).includes(asset_type)) {
                throw new Error(`Invalid asset type: ${asset_type}`);
            }
            const asset_config = ASSET_CONFIGS[asset_type];
            let mesh;
            // Create physics body first
            const body = world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(position_offset.x, position_offset.y, position_offset.z)
                    .setLinearDamping(0.5)  // Add damping to reduce bouncing
                    .setAngularDamping(0.5) // Add angular damping to reduce spinning
                    .setCanSleep(true)      // Allow the body to sleep when it comes to rest
            );

            if(FLAGS.ASSET_LOGS) console.log(`Created rigid body for ${asset_type}:`, body);
                // Normal GLB asset loading path
                if (!this.storage.has_loaded_asset(asset_type)) await this.storage.load_asset_type(asset_type);
                const gltf = this.storage.get_loaded_asset(asset_type);
                mesh = gltf.scene.clone();
                mesh.position.copy(position_offset);
                mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
                // Process textures for atlasing before material optimization
                await this.processTexturesForAtlas(mesh);
                // Look for ALL collision meshes using the 'col_' prefix
                let collision_meshes = [];
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        if (child.name.startsWith('col_')) {
                            collision_meshes.push(child);
                            child.visible = false;  // Hide collision mesh
                            if(FLAGS.ASSET_LOGS) console.log(`Found collision mesh for ${asset_type}:`, {
                                name: child.name,
                                vertices: child.geometry.attributes.position.count,
                                hasIndices: !!child.geometry.index,
                                position: child.position,
                                scale: asset_config.scale
                            });
                        } else {
                            const originalMaterial = child.material;
                            // Create a unique key for material pooling
                            const materialKey = `${asset_type}_${child.name}_${!!originalMaterial.map}_${originalMaterial.color?.getHex() || 0}`;
                            
                            // Try to get material from pool first
                            let material = this.materialPool.get(materialKey);
                            if (!material) {
                                // If not in pool, create and store it
                                material = this.storage.get_material(materialKey, originalMaterial);
                                this.materialPool.set(materialKey, material);
                            }
                            
                            child.material = material;
                            child.name = `${TYPES.INTERACTABLE}${asset_config.name}`;
                            child.castShadow = true;
                        }
                    }
                });
                // Create physics body with all collision meshes if found
                if (collision_meshes.length > 0) {
                    if(FLAGS.ASSET_LOGS) console.log(`Creating compound collider for ${asset_type} with ${collision_meshes.length} collision meshes`);
                    // Create colliders for each collision mesh
                    collision_meshes.forEach((collision_mesh) => {
                        const geometry = collision_mesh.geometry;
                        // Scale the vertices by the asset's scale
                        const originalVertices = geometry.attributes.position.array;
                        const scaledVertices = new Float32Array(originalVertices.length);
                        for (let i = 0; i < originalVertices.length; i++) {
                            scaledVertices[i] = originalVertices[i] * asset_config.scale;
                        }
                        const indices = geometry.index ? geometry.index.array : generateIndices(geometry);
                        if(FLAGS.ASSET_LOGS) console.log(`Creating collider component for ${collision_mesh.name}:`, {
                            vertexCount: scaledVertices.length / 3,
                            indexCount: indices ? indices.length : 'none',
                            scale: asset_config.scale,
                            position: collision_mesh.position
                        });
                        // Always use trimesh for static collision meshes
                        const collider = RAPIER.ColliderDesc.trimesh(scaledVertices, indices)
                            .setMass(asset_config.mass)
                            .setRestitution(0.3)     // Lower restitution to reduce bouncing
                            .setFriction(0.8)        // Higher friction to help objects settle
                            .setCollisionGroups(0x00010001);  // Set collision groups to reduce checks
                        // Get the collision mesh's position relative to the model
                        const meshPosition = new THREE.Vector3();
                        collision_mesh.getWorldPosition(meshPosition);
                        const relativePosition = meshPosition.sub(mesh.position);
                        // Apply the relative position to the collider
                        collider.setTranslation(
                            relativePosition.x * asset_config.scale,
                            relativePosition.y * asset_config.scale,
                            relativePosition.z * asset_config.scale
                        );
                        const created_collider = world.createCollider(collider, body);

                        // Add debug wireframe if enabled
                        // Always create debug wireframes, visibility is controlled by the mesh.visible property
                        // if (FLAGS.COLLISION_VISUAL_DEBUG) {
                        const debugMesh = this.createDebugWireframe(
                            'trimesh',
                            { geometry: collision_mesh.geometry },
                            meshPosition,
                            collision_mesh.quaternion
                        );
                        if (debugMesh) {
                            // Scale the debug mesh to match the asset scale
                            debugMesh.scale.multiplyScalar(asset_config.scale);
                            parent.add(debugMesh);
                            // Store debug mesh with a unique key
                            const debugKey = `${collision_mesh.uuid}_debug`;
                            this.debugMeshes.set(debugKey, {
                                mesh: debugMesh,
                                body: body,
                                type: 'trimesh'
                            });
                        }
                        // }
                    });
                } else {
                    if(FLAGS.ASSET_LOGS) console.warn(`No collision mesh found for ${asset_type}, falling back to bounding box`);
                    let geometry;
                    mesh.traverse((child) => {
                        if (child.isMesh && !child.name.startsWith('col_')) geometry = child.geometry;
                    });
                    if (geometry) {
                        geometry.computeBoundingBox();
                        const bounding_box = geometry.boundingBox;
                        const dimensions = new THREE.Vector3();
                        bounding_box.getSize(dimensions);

                        const half_width = (dimensions.x * asset_config.scale) / 2;
                        const half_height = (dimensions.y * asset_config.scale) / 2;
                        const half_depth = (dimensions.z * asset_config.scale) / 2;

                        const collider = RAPIER.ColliderDesc.cuboid(half_width, half_height, half_depth)
                            .setMass(asset_config.mass)
                            .setRestitution(0.3)     // Lower restitution to reduce bouncing
                            .setFriction(0.8)        // Higher friction to help objects settle
                            .setCollisionGroups(0x00010001);  // Set collision groups to reduce checks

                        const created_collider = world.createCollider(collider, body);

                        // Add debug wireframe if enabled
                        // Always create debug wireframes, visibility is controlled by the mesh.visible property
                        // if (FLAGS.COLLISION_VISUAL_DEBUG) {
                        const debugMesh = this.createDebugWireframe(
                            'cuboid',
                            { 
                                width: half_width,
                                height: half_height,
                                depth: half_depth
                            },
                            mesh.position,
                            mesh.quaternion
                        );
                        if (debugMesh) {
                            parent.add(debugMesh);
                            // Store debug mesh with a unique key
                            const debugKey = `${mesh.uuid}_debug_box`;
                            this.debugMeshes.set(debugKey, {
                                mesh: debugMesh,
                                body: body,
                                type: 'cuboid'
                            });
                        }
                        // }

                        if(FLAGS.ASSET_LOGS) console.log(`Created bounding box collider:`, created_collider);
                        if(FLAGS.ASSET_LOGS) console.log(`Collider dimensions:`, {
                            width: half_width,
                            height: half_height,
                            depth: half_depth,
                            mass: asset_config.mass,
                            restitution: asset_config.restitution
                        });
                    }
                }
            // Add mesh to parent
            parent.add(mesh);
            // Generate a truly unique ID using counter instead of timestamp
            const instance_id = `${asset_type}_${this.get_new_instance_id()}`;
            const body_pair = [mesh, body];
            this.storage.store_dynamic_body(instance_id, body_pair);
            // Add the instance_id to the mesh's userData for reference
            mesh.userData.instance_id = instance_id;

            // After creating new object, check if we should perform cleanup
            this.performCleanup();

            return body_pair;
        } catch (error) {
            console.error(`Error in spawn_asset for ${asset_type}:`, error);
            return null;
        }
    }

    /**
     * Creates a static (non-physics) mesh of the specified asset type.
     * @param {string} asset_type - Type of asset from ASSET_TYPE enum.
     * @param {THREE.Object3D} parent - Parent object to add the mesh to.
     * @param {THREE.Vector3} position_offset - Position offset from parent.
     * @param {THREE.Euler|null} rotation - Optional rotation to apply to the mesh.
     * @returns {Promise<THREE.Object3D>} Promise resolving to the created mesh.
     */
    async create_static_mesh(asset_type, parent, position_offset = new THREE.Vector3(0, 0, 0), rotation = null) {
        if (!Object.values(ASSET_TYPE).includes(asset_type)) throw new Error(`Invalid asset type: ${asset_type}`);
        const asset_config = ASSET_CONFIGS[asset_type];
        let mesh;
        if (!this.storage.has_loaded_asset(asset_type)) await this.storage.load_asset_type(asset_type);
        const gltf = this.storage.get_loaded_asset(asset_type);
        mesh = gltf.scene.clone();
        mesh.position.copy(position_offset);
        mesh.scale.set(asset_config.scale, asset_config.scale, asset_config.scale);
        
        if(FLAGS.ASSET_LOGS) console.log('Creating static mesh for UI:', {
            assetType: asset_type,
            parentType: parent.type,
            parentName: parent.name,
            isOverlay: parent.parent?.parent?.name?.includes('overlay')
        });
        mesh.traverse((child) => {
            if (child.isMesh) {
                const materialKey = `static_${asset_type}_${child.name}`;
                let material = this.materialPool.get(materialKey);
                
                if (!material) {
                    material = new THREE.MeshBasicMaterial({
                        map: child.material.map,
                        color: child.material.color,
                        transparent: true,
                        depthTest: false,
                        side: THREE.DoubleSide,
                        opacity: 1
                    });
                    this.materialPool.set(materialKey, material);
                }
                
                child.material = material;
                child.renderOrder = 999; // Ensure it renders on top
            }
        });
        mesh.position.copy(position_offset);
        if (rotation) mesh.rotation.copy(rotation);
        mesh.renderOrder = 999;
        parent.add(mesh);
        const instance_id = `${asset_type}_static_${Date.now()}`;
        this.storage.store_static_mesh(instance_id, mesh);
        return mesh;
    }

    /**
     * Updates the positions and rotations of debug wireframes to match their physics bodies
     * Should be called each frame during the physics update
     */
    update_debug_wireframes() {
        // Always update the wireframes, but only if they exist
        // if (!FLAGS.COLLISION_VISUAL_DEBUG) return;

        this.debugMeshes.forEach((debugData) => {
            if (debugData.mesh && debugData.body) {
                // Update visibility based on current flag state
                debugData.mesh.visible = FLAGS.COLLISION_VISUAL_DEBUG;
                
                // Only update position if visible (optimization)
                if (debugData.mesh.visible) {
                    const position = debugData.body.translation();
                    const rotation = debugData.body.rotation();
                    
                    debugData.mesh.position.set(position.x, position.y, position.z);
                    debugData.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                }
            }
        });
    }

    /**
     * Enhanced cleanup method with pool management
     */
    cleanup() {
        // Clear object pools
        this.objectPools.forEach((pool, type) => {
            pool.forEach(object => {
                this.disposalQueue.add(object);
            });
            pool.length = 0;
        });

        // Dispose of pooled materials
        this.materialPool.forEach((material, key) => {
            if (material.map) material.map.dispose();
            material.dispose();
        });
        this.materialPool.clear();

        // Perform final cleanup
        this.performCleanup();

        // Existing cleanup code
        this.storage.cleanup();
        this.textureAtlasManager.dispose();
        this.debugMeshes.forEach((debugData) => {
            if (debugData.mesh) {
                debugData.mesh.geometry.dispose();
                // Don't dispose of materials here as they're handled in the material pool cleanup
                debugData.mesh.parent?.remove(debugData.mesh);
            }
        });
        this.debugMeshes.clear();
    }

    // Getters and Setters

    get_new_instance_id() {
        return AssetSpawner.instance_counter++;
    }

    createAsset(asset_config) {
        const model = asset_config.model.clone();
        model.frustumCulled = true;  // Enable frustum culling
        
        // Add LOD (Level of Detail) for complex models
        if (asset_config.geometry && asset_config.geometry.attributes.position.count > 1000) {
            const lod = new THREE.LOD();
            
            // High detail (original)
            lod.addLevel(model, 0);
            
            // Medium detail (50% less geometry)
            const mediumGeo = asset_config.geometry.clone();
            const mediumDetail = THREE.BufferGeometryUtils.mergeVertices(mediumGeo, 0.1);
            const mediumMesh = new THREE.Mesh(mediumDetail, model.material);
            lod.addLevel(mediumMesh, 10);
            
            // Low detail (75% less geometry)
            const lowGeo = asset_config.geometry.clone();
            const lowDetail = THREE.BufferGeometryUtils.mergeVertices(lowGeo, 0.2);
            const lowMesh = new THREE.Mesh(lowDetail, model.material);
            lod.addLevel(lowMesh, 20);
            
            model = lod;
        }
        
        // Rest of the existing createAsset code...
    }
}