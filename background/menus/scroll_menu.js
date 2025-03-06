import { TYPES } from '../../viewport/overlay/overlay_common';
import { FLAGS, ASSET_TYPE, RAPIER, THREE } from '../../common';
import { BackgroundLighting } from '../background_lighting';
import { AssetStorage } from '../../common/asset_management/asset_storage';

export class ScrollMenu {
    parent;
    camera;
    world;
    dynamic_bodies;
    // Debug meshes
    debug_meshes = {
        segments: [],
        joints: [],
        sign: null,
        anchor: null
    };
    // Animation state
    is_animating = false;
    animation_start_time = 0;
    animation_duration = 1.0; // seconds
    initial_offset = 15; // How far to the right to spawn
    // Chain settings
    CHAIN_CONFIG = {
        POSITION: {
            X: 0,
            Y: 10,
            Z: 0
        },
        SEGMENTS: {
            COUNT: 4,             // Reduced from 6 to 4 segments
            LENGTH: 0.5,          // Keep original size
            RADIUS: 0.1,
            DAMPING: 1,
            MASS: 1,
            RESTITUTION: 0.01,
            FRICTION: 1.0,
            LINEAR_DAMPING: 2.0,  // Increased from 0.8
            ANGULAR_DAMPING: 2.0, // Increased from 1.0
            GRAVITY_SCALE: 0.3,
            SPAWN_DELAY: 100      // Delay between segment spawns in ms
        },
        SIGN: {
            LOCAL_OFFSET: {
                X: 0,    
                Y: 2,    
                Z: 0
            },
            DIMENSIONS: {
                WIDTH: 2,
                HEIGHT: 2,
                DEPTH: 0.01
            },
            DAMPING: 0.8,
            MASS: 2,
            RESTITUTION: 0.01,
            FRICTION: 1.0,
            ANGULAR_DAMPING: 1.0,
            GRAVITY_SCALE: 2.0,
            IMAGE_PATH: 'images/ScrollControlMenu.svg',
            SPAWN_DELAY: 300      // Delay before spawning sign after last segment
        }
    };
    chain_joints = [];
    chains_broken = false;
    last_log_time = 0;
    log_interval = 500;
    menu_spotlight = null;
    lighting = null;
    sign_image;
    sign_mesh;
    sign_body;
    anchor_body;
    // Store initial camera state
    initial_camera_position = new THREE.Vector3();
    initial_camera_quaternion = new THREE.Quaternion();
    // Store target position (original spawn position before offset)
    target_position = {
        x: 0,
        y: 0,
        z: 0
    };
    // Position logging
    last_position_log_time = 0;
    position_log_interval = 500; // 500ms

    constructor(incoming_parent, incoming_camera, incoming_world, incoming_container, spawn_position) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.dynamic_bodies = incoming_container.dynamic_bodies;
        this.lighting = BackgroundLighting.getInstance(this.parent);

        // Store initial camera state
        this.initial_camera_position.copy(this.camera.position);
        this.initial_camera_quaternion.copy(this.camera.quaternion);

        // Log initial spawn position before any modifications
        console.log("📦 INITIAL SPAWN POSITION (before offset):");
        console.log(`X: ${spawn_position.x.toFixed(2)}, Y: ${spawn_position.y.toFixed(2)}, Z: ${spawn_position.z.toFixed(2)}`);

        // Calculate the right vector in local space
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        
        // Offset the spawn position to the right
        spawn_position.x += right.x * this.initial_offset;
        spawn_position.y += right.y * this.initial_offset;
        spawn_position.z += right.z * this.initial_offset;

        // Log modified spawn position after offset
        console.log("📌 ACTUAL SPAWN POSITION (after offset):");
        console.log(`X: ${spawn_position.x.toFixed(2)}, Y: ${spawn_position.y.toFixed(2)}, Z: ${spawn_position.z.toFixed(2)}`);

        // Store target position (original spawn position before offset)
        this.target_position = {
            x: spawn_position.x - right.x * this.initial_offset,
            y: spawn_position.y - right.y * this.initial_offset,
            z: spawn_position.z - right.z * this.initial_offset
        };

        // Log calculated target position
        console.log("🎯 TARGET POSITION (spawn minus offset):");
        console.log(`X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);

        // Use spawn position
        this.CHAIN_CONFIG.POSITION.X = spawn_position.x;
        this.CHAIN_CONFIG.POSITION.Y = spawn_position.y;
        this.CHAIN_CONFIG.POSITION.Z = spawn_position.z;

        // Log animation start position
        console.log("🏁 ANIMATION START POSITION (CHAIN_CONFIG.POSITION):");
        console.log(`X: ${this.CHAIN_CONFIG.POSITION.X.toFixed(2)}, Y: ${this.CHAIN_CONFIG.POSITION.Y.toFixed(2)}, Z: ${this.CHAIN_CONFIG.POSITION.Z.toFixed(2)}`);

        this.animation_start_time = performance.now();
        this.is_animating = true;

        return this.initialize(spawn_position);
    }

    async createChainSegment(index, previous_body, rotation) {
        // Calculate spawn position
        const spawnY = this.CHAIN_CONFIG.POSITION.Y - (index + 1) * this.CHAIN_CONFIG.SEGMENTS.LENGTH;
        
        // Create the rigid body
        const chain_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                this.CHAIN_CONFIG.POSITION.X,
                spawnY,
                this.CHAIN_CONFIG.POSITION.Z
            )
            .setRotation(rotation)
            .setLinearDamping(this.CHAIN_CONFIG.SEGMENTS.LINEAR_DAMPING)
            .setAngularDamping(this.CHAIN_CONFIG.SEGMENTS.ANGULAR_DAMPING)
            .setAdditionalMass(this.CHAIN_CONFIG.SEGMENTS.MASS)
            .setGravityScale(this.CHAIN_CONFIG.SEGMENTS.GRAVITY_SCALE)
            .setCanSleep(true)
        );

        // Create collider
        const collider = RAPIER.ColliderDesc.ball(this.CHAIN_CONFIG.SEGMENTS.RADIUS)
            .setRestitution(this.CHAIN_CONFIG.SEGMENTS.RESTITUTION)
            .setFriction(this.CHAIN_CONFIG.SEGMENTS.FRICTION);
        this.world.createCollider(collider, chain_body);

        // Create visual mesh
        const segmentGeometry = new THREE.SphereGeometry(this.CHAIN_CONFIG.SEGMENTS.RADIUS);
        const segmentMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
        segmentMesh.name = `scroll_menu_chain_segment_${index}`;
        
        // Rotate the segment visualization to match the rigidbody orientation
        segmentMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        
        // Add to the assembly container
        this.assembly_container.add(segmentMesh);
        
        // Store in dynamic bodies
        this.dynamic_bodies.push({
            type: 'scroll_menu_chain',
            mesh: segmentMesh,
            body: chain_body
        });

        // Create joint with previous segment
        const joint_desc = index === 0 
            ? RAPIER.JointData.spherical(
                {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/3 - 0.15, z: 0},  // Add spacing for first joint
                {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2 + 0.15, z: 0}
            )
            : RAPIER.JointData.spherical(
                {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2 - 0.15, z: 0},  // Add spacing between segments
                {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2 + 0.15, z: 0}
            );

        joint_desc.limitsEnabled = true;
        joint_desc.limits = [-Math.PI/12, Math.PI/12];
        joint_desc.stiffness = 150.0;
        joint_desc.damping = 30.0;

        const created_joint = this.world.createImpulseJoint(
            joint_desc,
            previous_body,
            chain_body,
            true
        );

        // Set initial velocities and force sleep
        chain_body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        chain_body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        chain_body.sleep();

        this.chain_joints.push(created_joint);

        // Add debug visualization if enabled
        if (FLAGS.SIGN_VISUAL_DEBUG) {
            // Add debug mesh for segment
            const debugSegment = new THREE.Mesh(
                segmentGeometry,
                new THREE.MeshBasicMaterial({
                    color: 0x0000ff,
                    wireframe: true,
                    depthTest: false,
                    transparent: true,
                    opacity: 0.8
                })
            );
            debugSegment.position.copy(segmentMesh.position);
            debugSegment.quaternion.copy(segmentMesh.quaternion);
            this.debug_meshes.segments.push(debugSegment);
            this.assembly_container.add(debugSegment);

            // Add debug mesh for joint if not last segment
            if (index < this.CHAIN_CONFIG.SEGMENTS.COUNT - 1) {
                const jointDebug = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1),
                    new THREE.MeshBasicMaterial({
                        color: 0xff0000,
                        wireframe: true,
                        depthTest: false,
                        transparent: true,
                        opacity: 0.8
                    })
                );
                const currentPos = chain_body.translation();
                const prevPos = previous_body.translation();
                jointDebug.position.set(
                    (prevPos.x + currentPos.x) / 2,
                    (prevPos.y + currentPos.y) / 2,
                    (prevPos.z + currentPos.z) / 2
                );
                this.debug_meshes.joints.push(jointDebug);
                this.assembly_container.add(jointDebug);
            }
        }

        return chain_body;
    }

    async initialize(spawn_position) {
        // Create the assembly container first
        this.createAssemblyContainer();
        
        // Calculate rotation based on camera position
        const theta_rad = Math.atan2(
            this.camera.position.x,
            this.camera.position.z
        );
        const halfAngle = theta_rad / 2;
        const rotation = {
            x: 0,
            y: Math.sin(halfAngle),
            z: 0,
            w: Math.cos(halfAngle)
        };

        // Create anchor
        this.anchor_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
            .setTranslation(
                this.CHAIN_CONFIG.POSITION.X,
                this.CHAIN_CONFIG.POSITION.Y,
                this.CHAIN_CONFIG.POSITION.Z
            )
            .setRotation(rotation)
        );

        // Add debug mesh for anchor
        if (FLAGS.SIGN_VISUAL_DEBUG) {
            const anchorGeometry = new THREE.SphereGeometry(0.2);
            const anchorMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                wireframe: true,
                transparent: true,
                opacity: 1.0,
                depthTest: false,
                depthWrite: false
            });
            this.debug_meshes.anchor = new THREE.Mesh(anchorGeometry, anchorMaterial);
            const anchorPos = this.anchor_body.translation();
            const anchorRot = this.anchor_body.rotation();
            this.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
            this.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
            this.debug_meshes.anchor.renderOrder = 999;
            this.assembly_container.add(this.debug_meshes.anchor);
        }

        // Sequentially create chain segments
        let previous_body = this.anchor_body;
        for(let i = 0; i < this.CHAIN_CONFIG.SEGMENTS.COUNT; i++) {
            if(FLAGS.PHYSICS_LOGS) {
                console.log(`Creating chain segment ${i}`);
            }
            previous_body = await this.createChainSegment(i, previous_body, rotation);
            // Wait for physics to settle
            await new Promise(resolve => setTimeout(resolve, this.CHAIN_CONFIG.SEGMENTS.SPAWN_DELAY));
        }

        // Wait additional time before spawning sign
        await new Promise(resolve => setTimeout(resolve, this.CHAIN_CONFIG.SIGN.SPAWN_DELAY));

        // Create and load the sign
        await new Promise((resolve, reject) => {
            this.sign_image = new Image();
            this.sign_image.onload = async () => {
                const sign_canvas = document.createElement('canvas');
                sign_canvas.width = this.sign_image.width;
                sign_canvas.height = this.sign_image.height;
                const signContext = sign_canvas.getContext('2d');
                signContext.drawImage(this.sign_image, 0, 0);
                
                const sign_texture = new THREE.CanvasTexture(sign_canvas);
                const sign_material = new THREE.MeshStandardMaterial({
                    map: sign_texture,
                    side: THREE.DoubleSide,
                    roughness: 1.0, // Maximum roughness to disable roughness map
                    metalness: 0.0, // No metalness to disable metalness map
                    envMapIntensity: 0.0, // Disable environment mapping
                    normalScale: new THREE.Vector2(0, 0), // Disable normal mapping
                    emissiveIntensity: 0.0, // Disable emissive by default
                    aoMapIntensity: 0.0, // Disable ambient occlusion
                    displacementScale: 0.0, // Disable displacement mapping
                    flatShading: true // Use flat shading to reduce complexity
                });
                
                const sign_geometry = new THREE.BoxGeometry(
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH
                );
                this.sign_mesh = new THREE.Mesh(sign_geometry, sign_material);
                this.sign_mesh.castShadow = true;
                this.sign_mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.SECONDARY}_SCROLL_MENU`;
                
                // Rotate the sign 90 degrees around X axis
                this.sign_mesh.rotation.x = Math.PI / 2;
                
                this.assembly_container.add(this.sign_mesh);
                
                // Calculate sign spawn position
                const sign_spawn_y = this.CHAIN_CONFIG.POSITION.Y - 
                    (this.CHAIN_CONFIG.SEGMENTS.COUNT * this.CHAIN_CONFIG.SEGMENTS.LENGTH) - 
                    (this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT / 2);

                this.sign_body = this.world.createRigidBody(
                    RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(
                        this.CHAIN_CONFIG.POSITION.X,
                        sign_spawn_y,
                        this.CHAIN_CONFIG.POSITION.Z
                    )
                    .setRotation(rotation)
                    .setLinearDamping(this.CHAIN_CONFIG.SIGN.DAMPING)
                    .setAngularDamping(this.CHAIN_CONFIG.SIGN.ANGULAR_DAMPING)
                    .setAdditionalMass(this.CHAIN_CONFIG.SIGN.MASS)
                    .setGravityScale(this.CHAIN_CONFIG.SIGN.GRAVITY_SCALE)
                    .setCanSleep(true)
                );
                const sign_collider = RAPIER.ColliderDesc.cuboid(
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH/2,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH/2
                )
                    .setRestitution(this.CHAIN_CONFIG.SIGN.RESTITUTION)
                    .setFriction(this.CHAIN_CONFIG.SIGN.FRICTION);
                this.world.createCollider(sign_collider, this.sign_body);
                
                // Set initial velocities to zero for sign
                this.sign_body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                this.sign_body.setAngvel({ x: 0, y: 0, z: 0 }, true);
                
                // Force the sign to sleep initially
                this.sign_body?.sleep();
                
                // Connect sign to last chain segment with adjusted joint positions and spacing
                const finalJointDesc = RAPIER.JointData.spherical(
                    {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2 - 0.15, z: 0},  // Match chain segment spacing
                    {x: 0, y: this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2 + 0.15, z: 0}   // Match chain segment spacing
                );
                const signJoint = this.world.createImpulseJoint(
                    finalJointDesc,
                    previous_body,
                    this.sign_body,
                    true
                );
                this.chain_joints.push(signJoint);
                AssetStorage.get_instance().add_object(this.sign_mesh, this.sign_body);
                
                // Store sign with specific identifier
                this.dynamic_bodies.push({
                    type: 'scroll_menu_sign',
                    mesh: this.sign_mesh,
                    body: this.sign_body
                });
                
                // Create assembly container
                this.createAssemblyContainer();
                
                // Add debug visual if enabled
                if (FLAGS.SIGN_VISUAL_DEBUG) {
                    const signDebugGeometry = new THREE.BoxGeometry(
                        this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH,
                        this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT,
                        this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH
                    );
                    const signDebugMaterial = new THREE.MeshBasicMaterial({
                        color: 0xff00ff,  // Bright magenta for better visibility
                        wireframe: true
                    });
                    this.debug_meshes.sign = new THREE.Mesh(signDebugGeometry, signDebugMaterial);
                    this.debug_meshes.sign.position.copy(this.sign_mesh.position);
                    this.debug_meshes.sign.quaternion.copy(this.sign_mesh.quaternion);
                    this.assembly_container.add(this.debug_meshes.sign);
                }

                // Add debug visualization for sign joint
                if (FLAGS.SIGN_VISUAL_DEBUG) {
                    const signJointGeometry = new THREE.SphereGeometry(0.1);
                    const signJointMaterial = new THREE.MeshBasicMaterial({
                        color: 0xff0000,
                        wireframe: true,
                        depthTest: false,
                        transparent: true,
                        opacity: 0.8
                    });
                    const signJointDebug = new THREE.Mesh(signJointGeometry, signJointMaterial);
                    
                    // Position the joint at the connection point between last chain segment and sign
                    const lastChainPos = previous_body.translation();
                    signJointDebug.position.set(
                        lastChainPos.x,
                        lastChainPos.y - this.CHAIN_CONFIG.SEGMENTS.LENGTH/2,
                        lastChainPos.z
                    );
                    
                    this.debug_meshes.joints.push(signJointDebug);
                    this.assembly_container.add(signJointDebug);
                }

                resolve();
            };
            this.sign_image.onerror = reject;
            this.sign_image.src = this.CHAIN_CONFIG.SIGN.IMAGE_PATH;
        });

        // Create spotlight after sign is initialized
        if (!this.menu_spotlight && this.sign_mesh) {
            // Calculate spotlight position 15 units behind initial camera position
            const spotlightPosition = new THREE.Vector3();
            spotlightPosition.copy(this.initial_camera_position);
            const backVector = new THREE.Vector3(0, 0, 15);
            backVector.applyQuaternion(this.initial_camera_quaternion);
            spotlightPosition.add(backVector);

            // Create spotlight using the stored lighting instance
            this.menu_spotlight = await this.lighting.create_spotlight(
                spotlightPosition,
                0, // Initial rotationX, will be updated immediately
                0, // Initial rotationY, will be updated immediately
                5, // circle radius
                0, // unlimited distance
                0x00FFFF // Cyan color for scroll menu
            );
        }

        this.last_log_time = 0;
        this.log_interval = 500;

        return this;
    }

    /**
     * Creates an assembly container with a red wireframe mesh to represent the bounds of the assembly
     */
    createAssemblyContainer() {
        // Create an initial placeholder geometry (will be updated in updateAssemblyContainerBounds)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Create a red wireframe material
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        
        // Create the assembly container as a Group instead of a Mesh
        this.assembly_container = new THREE.Group();
        this.assembly_container.name = "assembly_container";
        
        // Create a separate wireframe mesh for visualization
        this.assembly_wireframe = new THREE.Mesh(geometry, material);
        this.assembly_wireframe.name = "assembly_wireframe";
        
        // Set initial visibility of wireframe based on debug flags
        this.assembly_wireframe.visible = FLAGS.DEBUG_UI && FLAGS.COLLISION_VISUAL_DEBUG;
        
        // Add wireframe to the container
        this.assembly_container.add(this.assembly_wireframe);
        
        // Add to the scene
        this.parent.add(this.assembly_container);
        
        if (FLAGS.PHYSICS_LOGS) {
            console.log("Created assembly container - dimensions will be updated dynamically");
            console.log("Initial wireframe visibility:", this.assembly_wireframe.visible);
        }
        
        // Initialize bounds immediately
        this.updateAssemblyContainerBounds();
        
        return this.assembly_container;
    }

    async break_chains() {
        if (!this.chains_broken) {
            // Wake up all chain segments and sign
            this.dynamic_bodies.forEach(data => {
                if ((data.type === 'scroll_menu_chain' || data.type === 'scroll_menu_sign') && data.body) {
                    data.body.wakeUp();
                }
            });

            // If sign mesh exists, move it to the parent before removing assembly container
            if (this.sign_mesh) {
                // Save the world position and rotation
                const worldPosition = new THREE.Vector3();
                const worldQuaternion = new THREE.Quaternion();
                
                this.sign_mesh.getWorldPosition(worldPosition);
                this.sign_mesh.getWorldQuaternion(worldQuaternion);
                
                // Remove from assembly container
                this.assembly_container.remove(this.sign_mesh);
                
                // Add to parent with preserved world position
                this.parent.add(this.sign_mesh);
                this.sign_mesh.position.copy(worldPosition);
                this.sign_mesh.quaternion.copy(worldQuaternion);
                
                // Ensure the sign mesh is visible
                this.sign_mesh.visible = true;
                
                if (FLAGS.PHYSICS_LOGS) {
                    console.log("Moved sign mesh to parent scene");
                }
            }

            // If sign debug mesh exists, move it to the parent before removing assembly container
            if (FLAGS.SIGN_VISUAL_DEBUG && this.debug_meshes.sign) {
                // Save the world position and rotation
                const worldPosition = new THREE.Vector3();
                const worldQuaternion = new THREE.Quaternion();
                
                this.debug_meshes.sign.getWorldPosition(worldPosition);
                this.debug_meshes.sign.getWorldQuaternion(worldQuaternion);
                
                // Remove from assembly container
                this.assembly_container.remove(this.debug_meshes.sign);
                
                // Add to parent with preserved world position
                this.parent.add(this.debug_meshes.sign);
                this.debug_meshes.sign.position.copy(worldPosition);
                this.debug_meshes.sign.quaternion.copy(worldQuaternion);
                
                if (FLAGS.PHYSICS_LOGS) {
                    console.log("Moved sign debug mesh to parent scene");
                }
            }

            // Clean up assembly container if it exists
            if (this.assembly_container) {
                if (FLAGS.PHYSICS_LOGS) {
                    console.log("Cleaning up assembly container when chains break");
                }
                this.parent.remove(this.assembly_container);
                
                // Dispose of wireframe geometry and material if they exist
                if (this.assembly_wireframe) {
                    if (this.assembly_wireframe.geometry) {
                        this.assembly_wireframe.geometry.dispose();
                    }
                    if (this.assembly_wireframe.material) {
                        this.assembly_wireframe.material.dispose();
                    }
                }
                
                this.assembly_container = null;
                this.assembly_wireframe = null;
            }

            // Remove debug meshes if they exist
            if (FLAGS.SIGN_VISUAL_DEBUG) {
                if (this.debug_meshes.anchor) {
                    this.parent.remove(this.debug_meshes.anchor);
                }
                this.debug_meshes.segments.forEach(segment => {
                    this.parent.remove(segment);
                });
                this.debug_meshes.joints.forEach(joint => {
                    this.parent.remove(joint);
                });
                // DO NOT REMOVE THE SIGN DEBUG MESH - KEEP IT
                // if (this.debug_meshes.sign) {
                //     this.parent.remove(this.debug_meshes.sign);
                // }
            }

            // Remove all joints with null check
            for (let i = 0; i < this.chain_joints.length; i++) {
                const joint = this.chain_joints[i];
                if (joint && this.world.getImpulseJoint(joint.handle)) {
                    try {
                        this.world.removeImpulseJoint(joint);
                    } catch (e) {
                        console.warn('Failed to remove joint:', e);
                    }
                }
            }
            this.chain_joints = [];

            // Remove spotlight and its debug meshes if they exist
            if (this.menu_spotlight) {
                // First despawn the spotlight helpers
                await this.lighting.despawn_spotlight_helpers(this.menu_spotlight);
                // Then despawn the spotlight itself
                await this.lighting.despawn_spotlight(this.menu_spotlight);
                this.menu_spotlight = null;
            }

            this.chains_broken = true;
        }
    }

    async update() {
        const currentTime = performance.now();
        
        // Update assembly container to match the bounds of the assembly
        if (this.assembly_container) {
            this.updateAssemblyContainerBounds();
        }
        
        // Always ensure sign mesh is visible regardless of where it is in the scene hierarchy
        if (this.sign_mesh) {
            this.sign_mesh.visible = true;
        }
        
        // Log animation start position on first update after animation begins
        if (this.is_animating && this.anchor_body && 
            currentTime - this.animation_start_time < 100) { // Only log in the first 100ms of animation
            
            const anchorPos = this.anchor_body.translation();
            console.log("🚀 ANIMATION ACTUALLY STARTING FROM:");
            console.log(`Anchor X: ${anchorPos.x.toFixed(2)}, Y: ${anchorPos.y.toFixed(2)}, Z: ${anchorPos.z.toFixed(2)}`);
            console.log(`Start Config X: ${this.CHAIN_CONFIG.POSITION.X.toFixed(2)}, Y: ${this.CHAIN_CONFIG.POSITION.Y.toFixed(2)}, Z: ${this.CHAIN_CONFIG.POSITION.Z.toFixed(2)}`);
            console.log(`Target X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);
        }
        
        // Position logging during animation
        if (this.is_animating && this.sign_body && currentTime - this.last_position_log_time > this.position_log_interval) {
            this.last_position_log_time = currentTime;
            
            // Add log to show current target position
            console.log("🎯 CURRENT TARGET POSITION:");
            console.log(`X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);
            
            const signPos = this.sign_body.translation();
            const signVel = this.sign_body.linvel();
            const rotation = this.sign_body.rotation();
            const euler = new THREE.Euler().setFromQuaternion(
                new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
            );
            
            console.log("🔄 SCROLL SIGN - ANIMATING");
            console.log(`⏱️ Animation progress: ${((currentTime - this.animation_start_time) / 1000 / this.animation_duration * 100).toFixed(1)}%`);
            console.log(`📍 Position X: ${signPos.x.toFixed(2)}, Y: ${signPos.y.toFixed(2)}, Z: ${signPos.z.toFixed(2)}`);
            console.log(`🏃 Velocity X: ${signVel.x.toFixed(2)}, Y: ${signVel.y.toFixed(2)}, Z: ${signVel.z.toFixed(2)}`);
            console.log(`🔄 Rotation (deg) X: ${(euler.x * 180/Math.PI).toFixed(1)}°, Y: ${(euler.y * 180/Math.PI).toFixed(1)}°, Z: ${(euler.z * 180/Math.PI).toFixed(1)}°`);
            
            // Also log anchor position
            const anchorPos = this.anchor_body.translation();
            console.log(`⚓ Anchor Position X: ${anchorPos.x.toFixed(2)}, Y: ${anchorPos.y.toFixed(2)}, Z: ${anchorPos.z.toFixed(2)}`);
            console.log("-------------------");
        }
        
        // Handle animation
        if (this.is_animating) {
            const elapsed = (currentTime - this.animation_start_time) / 1000; // Convert to seconds
            if (elapsed >= this.animation_duration) {
                // Animation complete
                this.is_animating = false;
                // Set final position
                if (this.anchor_body) {
                    // Log the expected delta movement before setting final position
                    console.log("📏 EXPECTED DELTA MOVEMENT:");
                    const deltaX = this.target_position.x - this.CHAIN_CONFIG.POSITION.X;
                    const deltaY = this.target_position.y - this.CHAIN_CONFIG.POSITION.Y;
                    const deltaZ = this.target_position.z - this.CHAIN_CONFIG.POSITION.Z;
                    console.log(`Delta X: ${deltaX.toFixed(2)}, Y: ${deltaY.toFixed(2)}, Z: ${deltaZ.toFixed(2)}`);
                    
                    this.anchor_body.setTranslation(this.target_position);
                    
                    // Log final position
                    if (this.sign_body) {
                        const finalPos = this.sign_body.translation();
                        const finalVel = this.sign_body.linvel();
                        const finalRot = this.sign_body.rotation();
                        const finalEuler = new THREE.Euler().setFromQuaternion(
                            new THREE.Quaternion(finalRot.x, finalRot.y, finalRot.z, finalRot.w)
                        );
                        
                        console.log("✅ SCROLL SIGN - ANIMATION COMPLETE");
                        console.log(`📍 Final Position X: ${finalPos.x.toFixed(2)}, Y: ${finalPos.y.toFixed(2)}, Z: ${finalPos.z.toFixed(2)}`);
                        console.log(`🏃 Final Velocity X: ${finalVel.x.toFixed(2)}, Y: ${finalVel.y.toFixed(2)}, Z: ${finalVel.z.toFixed(2)}`);
                        console.log(`🔄 Final Rotation (deg) X: ${(finalEuler.x * 180/Math.PI).toFixed(1)}°, Y: ${(finalEuler.y * 180/Math.PI).toFixed(1)}°, Z: ${(finalEuler.z * 180/Math.PI).toFixed(1)}°`);
                        
                        // Log final positions again
                        console.log("🎯 FINAL TARGET POSITION:");
                        console.log(`X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);
                        console.log("📌 FINAL CHAIN CONFIG POSITION (spawn):");
                        console.log(`X: ${this.CHAIN_CONFIG.POSITION.X.toFixed(2)}, Y: ${this.CHAIN_CONFIG.POSITION.Y.toFixed(2)}, Z: ${this.CHAIN_CONFIG.POSITION.Z.toFixed(2)}`);
                        console.log("====================");
                    }
                }
            } else {
                // Calculate progress with simple easing
                const progress = elapsed / this.animation_duration;
                const eased_progress = progress * (2 - progress); // Simple easing function
                
                if (this.anchor_body) {
                    // Log calculation details periodically
                    if (currentTime - this.last_log_time > this.log_interval) {
                        const current = this.anchor_body.translation();
                        console.log(`⏱️ Progress: ${progress.toFixed(2)}, Eased: ${eased_progress.toFixed(2)}`);
                        console.log(`📐 Current: ${current.x.toFixed(2)}, Target: ${this.target_position.x.toFixed(2)}, Step: ${((this.target_position.x - current.x) * 0.05).toFixed(2)}`);
                        this.last_log_time = currentTime;
                    }
                    
                    const current = this.anchor_body.translation();
                    const new_x = current.x + (this.target_position.x - current.x) * 0.05; // Smooth interpolation
                    const new_y = current.y;
                    const new_z = current.z + (this.target_position.z - current.z) * 0.05;
                    this.anchor_body.setTranslation({ x: new_x, y: new_y, z: new_z });
                }
            }
        }

        // Update only spotlight direction if it exists, position stays fixed
        if (this.menu_spotlight && !this.chains_broken && this.sign_mesh) {
            // Update spotlight direction to point at sign
            const targetPosition = new THREE.Vector3();
            targetPosition.copy(this.sign_mesh.position);
            const direction = new THREE.Vector3().subVectors(targetPosition, this.menu_spotlight.position);
            const rotationY = Math.atan2(direction.x, direction.z);
            const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));

            // Update spotlight rotation
            this.menu_spotlight.rotation.set(rotationX, rotationY, 0);
            this.menu_spotlight.target.position.copy(targetPosition);
            this.menu_spotlight.target.updateMatrixWorld();
        }
        
        // Update sign rotation based on camera angles
        if (this.parent.children) {
            const sign = this.parent.children.find(child => 
                child.name === `${TYPES.INTERACTABLE}${ASSET_TYPE.SECONDARY}_SCROLL_MENU`
            );
            if (sign) {
                // Calculate rotation based on camera position
                const direction = new THREE.Vector3();
                direction.subVectors(this.camera.position, new THREE.Vector3(0, 0, 0));
                direction.normalize();
                
                // Set sign rotation to face center
                sign.position.normalize();
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.lookAt(sign.position, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
                sign.quaternion.setFromRotationMatrix(rotationMatrix);
                // Rotate 180 degrees to face outward instead of inward
                sign.rotateY(Math.PI);
            }
        }
        
        // Track oscillation patterns
        if (FLAGS.PHYSICS_LOGS && currentTime - this.last_log_time > 1000) {  // Check every second
            const chainBodies = this.dynamic_bodies
                .filter(data => data.type === 'scroll_menu_chain' && data.body)
                .map(data => data.body);

            // Track middle segment (most likely to show oscillation)
            const midIndex = Math.floor(this.CHAIN_CONFIG.SEGMENTS.COUNT / 2);
            const midBody = chainBodies[midIndex];
            
            if (midBody) {
                const pos = midBody.translation();
                const vel = midBody.linvel();
                
                // Only log if there's significant Y movement
                if (Math.abs(vel.y) > 0.1) {  // Threshold for movement logging
                    console.log(`=== Chain Movement ===`);
                    console.log(`Middle segment Y position: ${pos.y.toFixed(3)}`);
                    console.log(`Y velocity: ${vel.y.toFixed(3)}`);
                    console.log(`Total velocity magnitude: ${Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z).toFixed(3)}`);
                }
            }

            // Also check sign movement as it might show different oscillation patterns
            const signData = this.dynamic_bodies.find(data => data.type === 'scroll_menu_sign');
            if (signData && signData.body) {
                const signVel = signData.body.linvel();
                const signPos = signData.body.translation();
                
                // Only log if sign is moving significantly
                if (Math.abs(signVel.y) > 0.1) {
                    console.log(`=== Sign Movement ===`);
                    console.log(`Sign Y position: ${signPos.y.toFixed(3)}`);
                    console.log(`Sign Y velocity: ${signVel.y.toFixed(3)}`);
                }
            }

            this.last_log_time = currentTime;
        }
        
        // Update debug mesh positions if enabled
        if (FLAGS.SIGN_VISUAL_DEBUG) {
            // Update anchor debug mesh
            if (this.debug_meshes.anchor) {
                const anchorPos = this.anchor_body.translation();
                const anchorRot = this.anchor_body.rotation();
                this.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
                this.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
            }

            // Get all chain segment bodies
            const chainBodies = this.dynamic_bodies
                .filter(data => data.type === 'scroll_menu_chain' && data.body && typeof data.body.translation === 'function')
                .map(data => data.body);

            // Update segment debug meshes
            this.debug_meshes.segments.forEach((debugMesh, index) => {
                const body = chainBodies[index];
                if (body && typeof body.translation === 'function') {
                    const pos = body.translation();
                    const rot = body.rotation();
                    debugMesh.position.set(pos.x, pos.y, pos.z);
                    debugMesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
                }
            });

            // Update joint debug meshes
            this.debug_meshes.joints.forEach((debugMesh, index) => {
                if (index < chainBodies.length - 1) {
                    // Regular chain joints
                    const body1 = chainBodies[index];
                    const body2 = chainBodies[index + 1];
                    if (body1 && body2 && typeof body1.translation === 'function' && typeof body2.translation === 'function') {
                        const pos1 = body1.translation();
                        const pos2 = body2.translation();
                        debugMesh.position.set(
                            (pos1.x + pos2.x) / 2,
                            (pos1.y + pos2.y) / 2,
                            (pos1.z + pos2.z) / 2
                        );
                    }
                } else if (index === chainBodies.length - 1 && this.sign_body) {
                    // Sign joint
                    const lastChainBody = chainBodies[chainBodies.length - 1];
                    if (lastChainBody && typeof lastChainBody.translation === 'function') {
                        const chainPos = lastChainBody.translation();
                        debugMesh.position.set(
                            chainPos.x,
                            chainPos.y - this.CHAIN_CONFIG.SEGMENTS.LENGTH/2,
                            chainPos.z
                        );
                    }
                }
            });

            // Update sign debug mesh
            if (this.debug_meshes.sign && this.sign_body && typeof this.sign_body.translation === 'function') {
                const signBodyData = this.dynamic_bodies.find(data => data.type === 'scroll_menu_sign');
                if (signBodyData && signBodyData.body && typeof signBodyData.body.translation === 'function') {
                    const signPos = signBodyData.body.translation();
                    const signRot = signBodyData.body.rotation();
                    this.debug_meshes.sign.position.set(signPos.x, signPos.y, signPos.z);
                    this.debug_meshes.sign.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
                }
            }
        }
    }

    /**
     * Updates the debug visualization for all signs based on the current flag state
     */
    updateDebugVisualizations() {
        if (FLAGS.SIGN_VISUAL_DEBUG) {
            // Create and show anchor debug mesh if it doesn't exist
            if (!this.debug_meshes.anchor && this.anchor_body) {
                const anchorGeometry = new THREE.SphereGeometry(0.2);
                const anchorMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffff00,
                    wireframe: true,
                    transparent: true,
                    opacity: 1.0,
                    depthTest: false,
                    depthWrite: false
                });
                this.debug_meshes.anchor = new THREE.Mesh(anchorGeometry, anchorMaterial);
                const anchorPos = this.anchor_body.translation();
                const anchorRot = this.anchor_body.rotation();
                this.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
                this.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
                this.debug_meshes.anchor.renderOrder = 999;
                this.assembly_container.add(this.debug_meshes.anchor);
            }

            // Create and show segment debug meshes if they don't exist
            const chainBodies = this.dynamic_bodies
                .filter(data => data.type === 'scroll_menu_chain' && data.body)
                .map(data => data.body);

            if (this.debug_meshes.segments.length === 0 && chainBodies.length > 0) {
                chainBodies.forEach((body, index) => {
                    const segmentGeometry = new THREE.SphereGeometry(this.CHAIN_CONFIG.SEGMENTS.RADIUS);
                    const debugSegment = new THREE.Mesh(
                        segmentGeometry,
                        new THREE.MeshBasicMaterial({
                            color: 0x0000ff,
                            wireframe: true,
                            depthTest: false,
                            transparent: true,
                            opacity: 0.8
                        })
                    );
                    const pos = body.translation();
                    const rot = body.rotation();
                    debugSegment.position.set(pos.x, pos.y, pos.z);
                    debugSegment.quaternion.set(rot.x, rot.y, rot.z, rot.w);
                    this.debug_meshes.segments.push(debugSegment);
                    this.assembly_container.add(debugSegment);
                });
            }

            // Create and show joint debug meshes if they don't exist
            if (this.debug_meshes.joints.length === 0 && chainBodies.length > 0) {
                for (let i = 0; i < chainBodies.length - 1; i++) {
                    const body1 = chainBodies[i];
                    const body2 = chainBodies[i + 1];
                    const jointDebug = new THREE.Mesh(
                        new THREE.SphereGeometry(0.1),
                        new THREE.MeshBasicMaterial({
                            color: 0xff0000,
                            wireframe: true,
                            depthTest: false,
                            transparent: true,
                            opacity: 0.8
                        })
                    );
                    const pos1 = body1.translation();
                    const pos2 = body2.translation();
                    jointDebug.position.set(
                        (pos1.x + pos2.x) / 2,
                        (pos1.y + pos2.y) / 2,
                        (pos1.z + pos2.z) / 2
                    );
                    this.debug_meshes.joints.push(jointDebug);
                    this.assembly_container.add(jointDebug);
                }

                // Add sign joint if sign exists
                if (this.sign_body) {
                    const lastChainBody = chainBodies[chainBodies.length - 1];
                    const signJointDebug = new THREE.Mesh(
                        new THREE.SphereGeometry(0.1),
                        new THREE.MeshBasicMaterial({
                            color: 0xff0000,
                            wireframe: true,
                            depthTest: false,
                            transparent: true,
                            opacity: 0.8
                        })
                    );
                    const chainPos = lastChainBody.translation();
                    signJointDebug.position.set(
                        chainPos.x,
                        chainPos.y - this.CHAIN_CONFIG.SEGMENTS.LENGTH/2,
                        chainPos.z
                    );
                    this.debug_meshes.joints.push(signJointDebug);
                    this.assembly_container.add(signJointDebug);
                }
            }

            // Create and show sign debug mesh if it doesn't exist
            if (!this.debug_meshes.sign && this.sign_body) {
                const signDebugGeometry = new THREE.BoxGeometry(
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH
                );
                const signDebugMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,
                    wireframe: true
                });
                this.debug_meshes.sign = new THREE.Mesh(signDebugGeometry, signDebugMaterial);
                const signPos = this.sign_body.translation();
                const signRot = this.sign_body.rotation();
                this.debug_meshes.sign.position.set(signPos.x, signPos.y, signPos.z);
                this.debug_meshes.sign.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
                this.assembly_container.add(this.debug_meshes.sign);
            }
        }

        // Toggle visibility for all debug meshes
        if (this.debug_meshes.anchor) {
            this.debug_meshes.anchor.visible = FLAGS.SIGN_VISUAL_DEBUG;
        }
        this.debug_meshes.segments.forEach(mesh => {
            if (mesh) mesh.visible = FLAGS.SIGN_VISUAL_DEBUG;
        });
        this.debug_meshes.joints.forEach(mesh => {
            if (mesh) mesh.visible = FLAGS.SIGN_VISUAL_DEBUG;
        });
        if (this.debug_meshes.sign) {
            this.debug_meshes.sign.visible = FLAGS.SIGN_VISUAL_DEBUG;
        }
    }

    /**
     * Updates the assembly container dimensions and position to match the current bounds of the entire assembly
     */
    updateAssemblyContainerBounds() {
        if (!this.assembly_container) {
            if (FLAGS.PHYSICS_LOGS) {
                console.log("Can't update assembly container - it doesn't exist");
            }
            return;
        }
        
        // Update wireframe visibility based on debug flags - only show when debug UI is enabled and collision debug is on
        this.assembly_wireframe.visible = FLAGS.DEBUG_UI && FLAGS.COLLISION_VISUAL_DEBUG;
        
        // Ensure the sign mesh is always visible regardless of debug settings
        if (this.sign_mesh) {
            this.sign_mesh.visible = true;
        }
        
        // If wireframe is not visible, we don't need to update its geometry
        if (!this.assembly_wireframe.visible) {
            return;
        }
        
        // Initialize min/max values for bounding box
        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        let hasValidBounds = false;

        // If chains are not broken, include anchor and chain positions
        if (!this.chains_broken && this.anchor_body) {
            // Include anchor position
            const anchorPos = this.anchor_body.translation();
            min.x = Math.min(min.x, anchorPos.x);
            min.y = Math.min(min.y, anchorPos.y);
            min.z = Math.min(min.z, anchorPos.z);
            max.x = Math.max(max.x, anchorPos.x);
            max.y = Math.max(max.y, anchorPos.y);
            max.z = Math.max(max.z, anchorPos.z);
            hasValidBounds = true;

            // Include all chain segments
            this.dynamic_bodies.forEach(data => {
                if (data.type === 'scroll_menu_chain' && data.body) {
                    const pos = data.body.translation();
                    min.x = Math.min(min.x, pos.x);
                    min.y = Math.min(min.y, pos.y);
                    min.z = Math.min(min.z, pos.z);
                    max.x = Math.max(max.x, pos.x);
                    max.y = Math.max(max.y, pos.y);
                    max.z = Math.max(max.z, pos.z);
                    hasValidBounds = true;
                }
            });
        }

        // Always include sign dimensions
        if (this.sign_body) {
            const signPos = this.sign_body.translation();
            const halfWidth = this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH / 2;
            const halfHeight = this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT / 2;
            const halfDepth = this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH / 2;
            
            min.x = Math.min(min.x, signPos.x - halfWidth);
            min.y = Math.min(min.y, signPos.y - halfHeight);
            min.z = Math.min(min.z, signPos.z - halfDepth);
            max.x = Math.max(max.x, signPos.x + halfWidth);
            max.y = Math.max(max.y, signPos.y + halfHeight);
            max.z = Math.max(max.z, signPos.z + halfDepth);
            hasValidBounds = true;
        }
        
        // If we don't have any valid bounds, hide the wireframe and return
        if (!hasValidBounds) {
            this.assembly_wireframe.visible = false;
            return;
        }
        
        // Calculate center and size of bounding box
        const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
        const size = new THREE.Vector3().subVectors(max, min);
        
        // Ensure size is never zero or negative (which could cause NaN issues)
        size.x = Math.max(0.1, size.x);
        size.y = Math.max(0.1, size.y);
        size.z = Math.max(0.1, size.z);
        
        // Update assembly container position to match center of bounding box
        this.assembly_container.position.copy(center);
        
        // Update wireframe geometry to match size of bounding box
        this.assembly_wireframe.geometry.dispose(); // Clean up old geometry
        this.assembly_wireframe.geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        
        if (FLAGS.PHYSICS_LOGS) {
            console.log(`Updated assembly container bounds: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
            console.log(`Assembly container position: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);
        }
    }
}