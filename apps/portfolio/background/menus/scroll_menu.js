import { THREE, FLAGS } from "../../common";
import { AssetStorage, CustomTypeManager, BLORKPACK_FLAGS }  from '@littlecarlito/blorkpack';
import { TYPES } from "../../viewport/overlay/overlay_common";
import { RAPIER } from '../../common';
import { AssetSpawner } from '@littlecarlito/blorkpack';
import { SystemAssetType } from '@littlecarlito/blorkpack';

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
    // Object state
    is_grabbed = false;
    is_animating = false;
    animation_start_time = 0;
    animation_duration = 100.0; // seconds - changed from 1.0 to 100.0 to slow down animation by 100x
    initial_offset = 15; // How far to the right to spawn
    // NEW: Flag to track if container has been rotated
    container_rotation_set = false;
    // Chain settings
    CHAIN_CONFIG = {
        POSITION: {
            X: 0,
            Y: 5,
            Z: 0
        },
        SEGMENTS: {
            COUNT: 4,             // Reduced from 6 to 4 segments
            LENGTH: 0.5,          // Keep original size
            RADIUS: 0.1,
            DAMPING: 1,
            MASS: 1,
            RESTITUTION: 0.01,    // Keep low restitution to prevent bouncing
            FRICTION: 1.0,
            LINEAR_DAMPING: 1.2,  // Reduced from 2.0 to allow more natural movement
            ANGULAR_DAMPING: 1.5, // Reduced from 2.0 to allow more natural rotation
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
    spawner = null;

    // Cache asset types
    #ASSET_TYPE = CustomTypeManager.getTypes();

    constructor(incoming_parent, incoming_camera, incoming_world, incoming_container, spawn_position) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.dynamic_bodies = incoming_container.dynamic_bodies;
        this.spawner = AssetSpawner.get_instance(this.parent);

        // Store initial camera state
        this.initial_camera_position.copy(this.camera.position);
        this.initial_camera_quaternion.copy(this.camera.quaternion);

        if(BLORKPACK_FLAGS.ANIMATION_LOGS) {
            // Log initial spawn position before any modifications
            console.log("📦 INITIAL SPAWN POSITION (before offset):");
            console.log(`X: ${spawn_position.x.toFixed(2)}, Y: ${spawn_position.y.toFixed(2)}, Z: ${spawn_position.z.toFixed(2)}`);
        }

        // Calculate the right vector in local space
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        
        // Offset the spawn position to the right
        spawn_position.x += right.x * this.initial_offset;
        spawn_position.y += right.y * this.initial_offset;
        spawn_position.z += right.z * this.initial_offset;

        if(BLORKPACK_FLAGS.ANIMATION_LOGS) {
            // Log modified spawn position after offset
            console.log("📌 ACTUAL SPAWN POSITION (after offset):");
            console.log(`X: ${spawn_position.x.toFixed(2)}, Y: ${spawn_position.y.toFixed(2)}, Z: ${spawn_position.z.toFixed(2)}`);
        }
        // Store target position (original spawn position before offset)
        this.target_position = {
            x: spawn_position.x - right.x * this.initial_offset,
            y: spawn_position.y - right.y * this.initial_offset,
            z: spawn_position.z - right.z * this.initial_offset
        };

        if(BLORKPACK_FLAGS.ANIMATION_LOGS) {
            // Log calculated target position
            console.log("🎯 TARGET POSITION (spawn minus offset):");
            console.log(`X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);
        }

        // Use spawn position
        this.CHAIN_CONFIG.POSITION.X = spawn_position.x;
        this.CHAIN_CONFIG.POSITION.Y = spawn_position.y;
        this.CHAIN_CONFIG.POSITION.Z = spawn_position.z;

        if(BLORKPACK_FLAGS.ANIMATION_LOGS) {
            // Log animation start position
            console.log("🏁 ANIMATION START POSITION (CHAIN_CONFIG.POSITION):");
            console.log(`X: ${this.CHAIN_CONFIG.POSITION.X.toFixed(2)}, Y: ${this.CHAIN_CONFIG.POSITION.Y.toFixed(2)}, Z: ${this.CHAIN_CONFIG.POSITION.Z.toFixed(2)}`);
        }

        this.animation_start_time = performance.now();
        this.is_animating = true;

        return this.initialize(spawn_position);
    }

    async createChainSegment(index, previous_body, rotation) {
        // Calculate spawn position
        const spawnY = this.CHAIN_CONFIG.POSITION.Y - (index + 1) * this.CHAIN_CONFIG.SEGMENTS.LENGTH;
        
        // Create the rigid body - changed from dynamic to kinematicPositionBased
        const chain_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(
                this.CHAIN_CONFIG.POSITION.X,
                spawnY,
                this.CHAIN_CONFIG.POSITION.Z
            )
            .setRotation(rotation)
            // These properties are not needed for kinematic bodies but kept for reference
            // .setLinearDamping(this.CHAIN_CONFIG.SEGMENTS.LINEAR_DAMPING)
            // .setAngularDamping(this.CHAIN_CONFIG.SEGMENTS.ANGULAR_DAMPING)
            // .setAdditionalMass(this.CHAIN_CONFIG.SEGMENTS.MASS)
            // .setGravityScale(this.CHAIN_CONFIG.SEGMENTS.GRAVITY_SCALE)
            .setCanSleep(false) // Kinematic bodies shouldn't sleep
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
        joint_desc.limits = [-Math.PI/2, Math.PI/2]; // Increased from PI/12 to allow more stretching
        joint_desc.stiffness = 250.0; // Increased from 150.0 to make it more resistant to initial stretching
        joint_desc.damping = 15.0;   // Reduced from 30.0 to make it less "underwater" feeling but still absorb energy

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

        // Get actual body position for debug meshes
        const bodyPos = chain_body.translation();
        
        // Create debug mesh for the segment - DIRECTLY using the physics body position
        const debugSegment = new THREE.Mesh(
            segmentGeometry.clone(),
            new THREE.MeshBasicMaterial({
                color: 0x0000ff,
                wireframe: true,
                depthTest: false,
                transparent: true,
                opacity: 0.8
            })
        );
        // Use EXACT physics body position
        debugSegment.position.set(bodyPos.x, bodyPos.y, bodyPos.z);
        const bodyRot = chain_body.rotation();
        debugSegment.quaternion.set(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
        debugSegment.visible = FLAGS.SIGN_VISUAL_DEBUG; // Set initial visibility based on flag
        this.debug_meshes.segments.push(debugSegment);
        this.assembly_container.add(debugSegment);

        // Add debug mesh for joint if not last segment and NOT before joint creation
        if (index > 0) {
            // Get previous body position for proper joint positioning
            const prevPos = previous_body.translation();
            const currentPos = chain_body.translation();
            
            // Create joint visualization mesh
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
            
            // Use calculated joint position based on physics bodies
            jointDebug.position.set(
                (prevPos.x + currentPos.x) / 2,
                prevPos.y - this.CHAIN_CONFIG.SEGMENTS.LENGTH/2,
                (prevPos.z + currentPos.z) / 2
            );
            
            jointDebug.visible = FLAGS.SIGN_VISUAL_DEBUG; // Set initial visibility based on flag
            this.debug_meshes.joints.push(jointDebug);
            this.assembly_container.add(jointDebug);
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

        // Add debug mesh for anchor (always create, control visibility with flag)
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
        this.debug_meshes.anchor.renderOrder = 999;
        this.debug_meshes.anchor.visible = FLAGS.SIGN_VISUAL_DEBUG; // Set initial visibility based on flag
        this.assembly_container.add(this.debug_meshes.anchor);

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
                this.sign_mesh.name = `${TYPES.INTERACTABLE}${this.#ASSET_TYPE.SECONDARY}_SCROLL_MENU`;
                
                // Add a reference to this ScrollMenu instance in the userData
                this.sign_mesh.userData.scrollMenu = this;
                
                // Adjust rotation to match our coordinate system
                this.sign_mesh.rotation.x = Math.PI / 2;
                
                this.assembly_container.add(this.sign_mesh);
                
                // Calculate sign spawn position
                const sign_spawn_y = this.CHAIN_CONFIG.POSITION.Y - 
                    (this.CHAIN_CONFIG.SEGMENTS.COUNT * this.CHAIN_CONFIG.SEGMENTS.LENGTH) - 
                    (this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT / 2);

                this.sign_body = this.world.createRigidBody(
                    RAPIER.RigidBodyDesc.kinematicPositionBased() // Changed from dynamic to kinematicPositionBased
                    .setTranslation(
                        this.CHAIN_CONFIG.POSITION.X,
                        sign_spawn_y,
                        this.CHAIN_CONFIG.POSITION.Z
                    )
                    .setRotation(rotation)
                    // These properties are not needed for kinematic bodies but kept for reference
                    // .setLinearDamping(this.CHAIN_CONFIG.SIGN.DAMPING)
                    // .setAngularDamping(this.CHAIN_CONFIG.SIGN.ANGULAR_DAMPING)
                    // .setAdditionalMass(this.CHAIN_CONFIG.SIGN.MASS)
                    // .setGravityScale(this.CHAIN_CONFIG.SIGN.GRAVITY_SCALE)
                    .setCanSleep(false) // Kinematic bodies shouldn't sleep
                );
                const sign_collider = RAPIER.ColliderDesc.cuboid(
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH/2,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2,
                    this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH/2
                )
                    .setRestitution(this.CHAIN_CONFIG.SIGN.RESTITUTION)
                    .setFriction(this.CHAIN_CONFIG.SIGN.FRICTION);
                this.world.createCollider(sign_collider, this.sign_body);
                
                // Set initial velocities not needed for kinematic bodies
                // this.sign_body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                // this.sign_body.setAngvel({ x: 0, y: 0, z: 0 }, true);
                
                // Force the sign to sleep initially - not needed for kinematic bodies
                // this.sign_body?.sleep();
                
                // Connect sign to last chain segment with adjusted joint positions and spacing
                const finalJointDesc = RAPIER.JointData.spherical(
                    {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2 - 0.15, z: 0},  // Match chain segment spacing
                    {x: 0, y: this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2 + 0.15, z: 0}   // Match chain segment spacing
                );
                
                // Apply the same joint properties to the sign joint
                finalJointDesc.limitsEnabled = true;
                finalJointDesc.limits = [-Math.PI/8, Math.PI/8];
                finalJointDesc.stiffness = 250.0;
                finalJointDesc.damping = 15.0;
                
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
                
                // Get EXACT physics body positions
                const lastChainPos = previous_body.translation();
                const signPos = this.sign_body.translation();
                const signRot = this.sign_body.rotation();
                
                // Create debug visual for the sign RIGHT AFTER physics body creation
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
                
                // Set to EXACT physics body position and rotation
                this.debug_meshes.sign.position.set(signPos.x, signPos.y, signPos.z);
                this.debug_meshes.sign.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
                
                this.debug_meshes.sign.visible = FLAGS.SIGN_VISUAL_DEBUG;
                this.assembly_container.add(this.debug_meshes.sign);
                
                // Debug mesh for final joint - create directly with exact positions
                const signJointGeometry = new THREE.SphereGeometry(0.1);
                const signJointMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    wireframe: true,
                    depthTest: false,
                    transparent: true,
                    opacity: 0.8
                });
                const finalJointMesh = new THREE.Mesh(signJointGeometry, signJointMaterial);
                
                // EXACT final joint position - use the EXACT same point as the joint itself
                finalJointMesh.position.set(
                    lastChainPos.x,
                    lastChainPos.y - this.CHAIN_CONFIG.SEGMENTS.LENGTH/2,
                    lastChainPos.z
                );
                
                finalJointMesh.visible = FLAGS.SIGN_VISUAL_DEBUG;
                this.debug_meshes.joints.push(finalJointMesh);
                this.assembly_container.add(finalJointMesh);

                // Now create a chain container for common use
                this.createAssemblyContainer();

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
            try {
                // Calculate direction vector
                const direction = new THREE.Vector3().subVectors(this.sign_mesh.position, spotlightPosition);
                const rotationY = Math.atan2(direction.x, direction.z);
                const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));                
                // Create a spotlight with smaller radius and sharper edge
                // Use white light with higher intensity
                const circle_radius = 3; // Smaller radius for scroll menu
                this.menu_spotlight = await this.spawner.spawn_asset(
                    SystemAssetType.SPOTLIGHT, 
                    spotlightPosition,
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, rotationY, 0)),
                    {
                        id: "scroll_menu_spotlight",
                        circle_radius: circle_radius,
                        color: "0xFFFFFF", // Standard white light
                        intensity: 1.2,    // Much higher intensity to draw attention
                        angle: Math.PI / 20, // Even narrower angle for clearer edge
                        penumbra: 0.02,    // Very low penumbra for sharp edge
                        cast_shadow: false,
                    },
                    {} // empty asset_data
                );
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log("Scroll menu spotlight created:", this.menu_spotlight ? "success" : "failed");
                }
            } catch (error) {
                console.error("Error creating scroll menu spotlight:", error);
            }
        }

        this.last_log_time = 0;
        this.log_interval = 500;

        return this;
    }

    /**
     * Creates an assembly container with a red wireframe mesh to represent the bounds of the assembly
     */
    createAssemblyContainer() {
        // Create the assembly container as a Group
        this.assembly_container = new THREE.Group();
        this.assembly_container.name = "assembly_container";
        
        // Add a reference to this ScrollMenu instance in the userData
        this.assembly_container.userData.scrollMenu = this;
        
        // Create a placeholder geometry that will be properly sized in updateAssemblyContainerBounds
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Create a red wireframe material
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        
        // Create the wireframe mesh
        this.assembly_wireframe = new THREE.Mesh(geometry, material);
        this.assembly_wireframe.name = "assembly_wireframe";
        
        // Set initial visibility based on debug flags
        this.assembly_wireframe.visible = FLAGS.DEBUG_UI && FLAGS.COLLISION_VISUAL_DEBUG;
        
        // Add wireframe to the container
        this.assembly_container.add(this.assembly_wireframe);
        
        // Add to the scene
        this.parent.add(this.assembly_container);
        
        if (FLAGS.PHYSICS_LOGS) {
            console.log("Created assembly container for entire chain and sign assembly");
        }
        
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

            // Convert sign body from kinematic to dynamic if it exists
            if (this.sign_body && this.world && !this.is_grabbed) {
                try {
                    // Change body type to dynamic
                    this.sign_body.setBodyType(RAPIER.RigidBodyType.Dynamic);
                    
                    // Use the configured values from CHAIN_CONFIG instead of defaults but with increased gravity
                    this.sign_body.setLinearDamping(this.CHAIN_CONFIG.SIGN.DAMPING);           // Use configured damping
                    this.sign_body.setAngularDamping(this.CHAIN_CONFIG.SIGN.ANGULAR_DAMPING);  // Use configured angular damping
                    this.sign_body.setGravityScale(5.0);                                       // Increased gravity scale to 5.0
                    
                    // Set mass if supported by the physics engine
                    if (typeof this.sign_body.setAdditionalMass === 'function') {
                        this.sign_body.setAdditionalMass(this.CHAIN_CONFIG.SIGN.MASS);
                    }
                    
                    // Wake up the body to ensure it starts simulating
                    this.sign_body.wakeUp();
                    
                    if (FLAGS.PHYSICS_LOGS) {
                        console.log("Converted sign from kinematic to dynamic with increased gravity");
                    }
                } catch (e) {
                    console.warn('Failed to convert sign to dynamic:', e);
                }
            }

            // If sign mesh exists, move it to the parent before removing assembly container
            if (this.sign_mesh && this.assembly_container && this.assembly_container.children.includes(this.sign_mesh)) {
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
            if (this.debug_meshes.sign && this.assembly_container && this.assembly_container.children.includes(this.debug_meshes.sign)) {
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

            // Remove all chain segment meshes from scene
            this.dynamic_bodies.forEach(data => {
                if (data.type === 'scroll_menu_chain' && data.mesh) {
                    // Remove from scene hierarchy regardless of parent
                    if (data.mesh.parent) {
                        data.mesh.parent.remove(data.mesh);
                    }
                    
                    // Dispose of geometry and material
                    if (data.mesh.geometry) {
                        data.mesh.geometry.dispose();
                    }
                    if (data.mesh.material) {
                        data.mesh.material.dispose();
                    }
                    
                    if (FLAGS.PHYSICS_LOGS) {
                        console.log("Removed chain segment mesh from scene");
                    }
                }
            });

            // Clean up assembly container if it exists
            if (this.assembly_container) {
                if (FLAGS.PHYSICS_LOGS) {
                    console.log("Cleaning up assembly container when chains break");
                }
                
                // Remove all children from assembly container before removing it
                while (this.assembly_container.children && this.assembly_container.children.length > 0) {
                    const child = this.assembly_container.children[0];
                    
                    // Dispose of geometry and material if they exist
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                if (mat) mat.dispose();
                            });
                        } else if (child.material) {
                            child.material.dispose();
                        }
                    }
                    
                    this.assembly_container.remove(child);
                }
                
                if (this.assembly_container.parent) {
                    this.assembly_container.parent.remove(this.assembly_container);
                } else if (this.parent) {
                    this.parent.remove(this.assembly_container);
                }
                
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
            if (this.debug_meshes.anchor) {
                if (this.debug_meshes.anchor.parent) {
                    this.debug_meshes.anchor.parent.remove(this.debug_meshes.anchor);
                }
                if (this.debug_meshes.anchor.geometry) {
                    this.debug_meshes.anchor.geometry.dispose();
                }
                if (this.debug_meshes.anchor.material) {
                    this.debug_meshes.anchor.material.dispose();
                }
                this.debug_meshes.anchor = null;
            }
            
            // Dispose of segment debug meshes
            if (this.debug_meshes.segments) {
                this.debug_meshes.segments.forEach(segment => {
                    if (segment && segment.parent) {
                        segment.parent.remove(segment);
                    }
                    if (segment && segment.geometry) {
                        segment.geometry.dispose();
                    }
                    if (segment && segment.material) {
                        segment.material.dispose();
                    }
                });
                this.debug_meshes.segments = [];
            }
            
            // Dispose of joint debug meshes
            if (this.debug_meshes.joints) {
                this.debug_meshes.joints.forEach(joint => {
                    if (joint && joint.parent) {
                        joint.parent.remove(joint);
                    }
                    if (joint && joint.geometry) {
                        joint.geometry.dispose();
                    }
                    if (joint && joint.material) {
                        joint.material.dispose();
                    }
                });
                this.debug_meshes.joints = [];
            }

            // Remove all joints with null check
            if (this.chain_joints) {
                for (let i = 0; i < this.chain_joints.length; i++) {
                    const joint = this.chain_joints[i];
                    if (joint && this.world && this.world.getImpulseJoint && this.world.getImpulseJoint(joint.handle)) {
                        try {
                            this.world.removeImpulseJoint(joint);
                        } catch (e) {
                            console.warn('Failed to remove joint:', e);
                        }
                    }
                }
                this.chain_joints = [];
            }

            // Dispose of the anchor body
            if (this.anchor_body && this.world) {
                try {
                    this.world.removeRigidBody(this.anchor_body);
                    this.anchor_body = null;
                } catch (e) {
                    console.warn('Failed to remove anchor body:', e);
                }
            }
            
            // Dispose of chain segment bodies
            if (this.dynamic_bodies) {
                const segmentsToRemove = [];
                this.dynamic_bodies.forEach((data, index) => {
                    if (data.type === 'scroll_menu_chain' && data.body && this.world) {
                        try {
                            // Remove the body from the physics world
                            this.world.removeRigidBody(data.body);
                            
                            // Mark for removal from dynamic_bodies
                            segmentsToRemove.push(index);
                        } catch (e) {
                            console.warn('Failed to remove chain segment body:', e);
                        }
                    }
                });
                
                // Remove the segments from dynamic_bodies (in reverse order to avoid index issues)
                for (let i = segmentsToRemove.length - 1; i >= 0; i--) {
                    this.dynamic_bodies.splice(segmentsToRemove[i], 1);
                }
            }

            // Remove spotlight
            if (this.menu_spotlight) {
                // First remove helpers if any
                await this.spawner.despawn_spotlight_helpers(this.menu_spotlight.mesh);
                // Then remove the spotlight itself
                await this.spawner.despawn_spotlight(this.menu_spotlight.mesh);
                this.menu_spotlight = null;
            }

            // Force a garbage collection when done (recommendation only, JS decides when to actually collect)
            if (FLAGS.PHYSICS_LOGS) {
                console.log("Chains break completed, all components disposed except sign and its debug mesh");
            }

            this.chains_broken = true;
        }
    }

    async update() {
        const currentTime = performance.now();
        
        // Update assembly container to match the bounds of the assembly
        if (this.assembly_container) {
            this.updateAssemblyContainerBounds();
            
            // Only rotate the container once, when animation completes or on first frame if not animating
            if (!this.container_rotation_set && 
                (!this.is_animating || (this.is_animating && currentTime - this.animation_start_time >= this.animation_duration * 1000))) {
                
                // Calculate rotation based on camera position to make it face the camera
                const direction = new THREE.Vector3();
                direction.subVectors(this.camera.position, this.assembly_container.position);
                
                // Only apply Y rotation (yaw) to avoid messing with position
                const yaw = Math.atan2(direction.x, direction.z);
                
                // Apply the yaw rotation to the entire container
                this.assembly_container.rotation.y = yaw + Math.PI; // Add PI to face outward
                
                // Mark that we've set the rotation
                this.container_rotation_set = true;
                
                if(FLAGS.PHYSICS_LOGS) {
                    console.log("Container rotation set once - no more camera tracking");
                }
            }
        }
        
        // Always ensure sign mesh is visible regardless of where it is in the scene hierarchy
        if (this.sign_mesh) {
            this.sign_mesh.visible = true;
        }
        
        // Update debug mesh positions every frame to match physics
        this.updateDebugMeshPositions();
        
        // Log animation start position on first update after animation begins
        if (this.is_animating && this.anchor_body && 
            currentTime - this.animation_start_time < 100) { // Only log in the first 100ms of animation
            
            const anchorPos = this.anchor_body.translation();
            if (FLAGS.PHYSICS_LOGS) {
                console.log("🚀 ANIMATION ACTUALLY STARTING FROM:");
                console.log(`Anchor X: ${anchorPos.x.toFixed(2)}, Y: ${anchorPos.y.toFixed(2)}, Z: ${anchorPos.z.toFixed(2)}`);
                console.log(`Start Config X: ${this.CHAIN_CONFIG.POSITION.X.toFixed(2)}, Y: ${this.CHAIN_CONFIG.POSITION.Y.toFixed(2)}, Z: ${this.CHAIN_CONFIG.POSITION.Z.toFixed(2)}`);
                console.log(`Target X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);
            }
        }
        
        // Position logging during animation
        if (this.is_animating && this.sign_body && currentTime - this.last_position_log_time > this.position_log_interval) {
            this.last_position_log_time = currentTime;
            
            // Add log to show current target position
            if (FLAGS.PHYSICS_LOGS) {
                console.log("🎯 CURRENT TARGET POSITION:");
                console.log(`X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);
            }
            
            const signPos = this.sign_body.translation();
            const signVel = this.sign_body.linvel ? this.sign_body.linvel() : { x: 0, y: 0, z: 0 };
            const rotation = this.sign_body.rotation();
            const euler = new THREE.Euler().setFromQuaternion(
                new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
            );
            
            if (FLAGS.PHYSICS_LOGS) {
                console.log("🔄 SCROLL SIGN - ANIMATING");
                console.log(`⏱️ Animation progress: ${((currentTime - this.animation_start_time) / 1000 / this.animation_duration * 100).toFixed(1)}%`);
                console.log(`📍 Position X: ${signPos.x.toFixed(2)}, Y: ${signPos.y.toFixed(2)}, Z: ${signPos.z.toFixed(2)}`);
                if (this.sign_body.linvel) {
                    console.log(`🏃 Velocity X: ${signVel.x.toFixed(2)}, Y: ${signVel.y.toFixed(2)}, Z: ${signVel.z.toFixed(2)}`);
                }
                console.log(`🔄 Rotation (deg) X: ${(euler.x * 180/Math.PI).toFixed(1)}°, Y: ${(euler.y * 180/Math.PI).toFixed(1)}°, Z: ${(euler.z * 180/Math.PI).toFixed(1)}°`);
                
                // Also log anchor position
                const anchorPos = this.anchor_body.translation();
                console.log(`⚓ Anchor Position X: ${anchorPos.x.toFixed(2)}, Y: ${anchorPos.y.toFixed(2)}, Z: ${anchorPos.z.toFixed(2)}`);
                console.log("-------------------");
            }
        }
        
        // Handle animation
        if (this.is_animating) {
            const elapsed = (currentTime - this.animation_start_time) / 1000; // Convert to seconds
            if (elapsed >= this.animation_duration) {
                // Animation complete
                this.is_animating = false;
                
                // Reset container rotation flag so it updates one more time
                this.container_rotation_set = false;
                
                // Set final position
                if (this.anchor_body) {
                    // Log the expected delta movement before setting final position
                    if (FLAGS.PHYSICS_LOGS) {
                        console.log("📏 EXPECTED DELTA MOVEMENT:");
                        const deltaX = this.target_position.x - this.CHAIN_CONFIG.POSITION.X;
                        const deltaY = this.target_position.y - this.CHAIN_CONFIG.POSITION.Y;
                        const deltaZ = this.target_position.z - this.CHAIN_CONFIG.POSITION.Z;
                        console.log(`Delta X: ${deltaX.toFixed(2)}, Y: ${deltaY.toFixed(2)}, Z: ${deltaZ.toFixed(2)}`);
                    }
                    
                    this.anchor_body.setTranslation(this.target_position);
                    
                    // Now update the positions of kinematic chain segments and sign
                    this.updateKinematicChainPositions();
                    
                    // Log final position
                    if (this.sign_body) {
                        const finalPos = this.sign_body.translation();
                        const finalRot = this.sign_body.rotation();
                        const finalEuler = new THREE.Euler().setFromQuaternion(
                            new THREE.Quaternion(finalRot.x, finalRot.y, finalRot.z, finalRot.w)
                        );
                        
                        if (FLAGS.PHYSICS_LOGS) {
                            console.log("✅ SCROLL SIGN - ANIMATION COMPLETE");
                            console.log(`📍 Final Position X: ${finalPos.x.toFixed(2)}, Y: ${finalPos.y.toFixed(2)}, Z: ${finalPos.z.toFixed(2)}`);
                            console.log(`🔄 Final Rotation (deg) X: ${(finalEuler.x * 180/Math.PI).toFixed(1)}°, Y: ${(finalEuler.y * 180/Math.PI).toFixed(1)}°, Z: ${(finalEuler.z * 180/Math.PI).toFixed(1)}°`);
                            
                            // Log final positions again
                            console.log("🎯 FINAL TARGET POSITION:");
                            console.log(`X: ${this.target_position.x.toFixed(2)}, Y: ${this.target_position.y.toFixed(2)}, Z: ${this.target_position.z.toFixed(2)}`);
                            console.log("📌 FINAL CHAIN CONFIG POSITION (spawn):");
                            console.log(`X: ${this.CHAIN_CONFIG.POSITION.X.toFixed(2)}, Y: ${this.CHAIN_CONFIG.POSITION.Y.toFixed(2)}, Z: ${this.CHAIN_CONFIG.POSITION.Z.toFixed(2)}`);
                            console.log("====================");
                        }
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
                        if (FLAGS.PHYSICS_LOGS) {
                            console.log(`⏱️ Progress: ${progress.toFixed(2)}, Eased: ${eased_progress.toFixed(2)}`);
                            console.log(`📐 Current: ${current.x.toFixed(2)}, Target: ${this.target_position.x.toFixed(2)}, Step: ${((this.target_position.x - current.x) * 0.05).toFixed(2)}`);
                        }
                        this.last_log_time = currentTime;
                    }
                    
                    const current = this.anchor_body.translation();
                    const new_x = current.x + (this.target_position.x - current.x) * 0.05; // Smooth interpolation
                    const new_y = current.y;
                    const new_z = current.z + (this.target_position.z - current.z) * 0.05;
                    this.anchor_body.setTranslation({ x: new_x, y: new_y, z: new_z });
                    
                    // Now update the positions of kinematic chain segments and sign
                    this.updateKinematicChainPositions();
                }
            }
        }

        // Update only spotlight direction if it exists, position stays fixed
        if (this.menu_spotlight && !this.chains_broken && this.sign_mesh) {
            // Ensure menu_spotlight has needed properties
            if (!this.menu_spotlight.position && !this.menu_spotlight.mesh) {
                console.warn('ScrollMenu: menu_spotlight is missing position property and mesh property');
                // Log the entire spotlight object to see what it contains
                console.log("menu_spotlight object:", this.menu_spotlight);
                return;
            }
            
            // Check specifically for position
            if (!this.menu_spotlight.position && this.menu_spotlight.mesh) {
                console.log("Using menu_spotlight.mesh.position instead of direct position");
                this.menu_spotlight.position = this.menu_spotlight.mesh.position;
            }
            
            // Ensure menu_spotlight.position exists before proceeding
            if (!this.menu_spotlight.position) {
                console.warn('ScrollMenu: menu_spotlight.position is undefined');
                return;
            }
            // Update spotlight direction to point at sign
            const targetPosition = new THREE.Vector3();
            targetPosition.copy(this.sign_mesh.position);
            try {
                const direction = new THREE.Vector3().subVectors(targetPosition, this.menu_spotlight.position);
                const rotationY = Math.atan2(direction.x, direction.z);
                const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
    
                // Update spotlight rotation
                if (this.menu_spotlight.rotation) {
                    this.menu_spotlight.rotation.set(rotationX, rotationY, 0);
                } else if (this.menu_spotlight.mesh) {
                    this.menu_spotlight.mesh.rotation.set(rotationX, rotationY, 0);
                }
                
                // Update target
                if (this.menu_spotlight.target) {
                    this.menu_spotlight.target.position.copy(targetPosition);
                    this.menu_spotlight.target.updateMatrixWorld();
                } else if (this.menu_spotlight.mesh && this.menu_spotlight.mesh.target) {
                    this.menu_spotlight.mesh.target.position.copy(targetPosition);
                    this.menu_spotlight.mesh.target.updateMatrixWorld();
                }
            } catch (error) {
                console.error("Error updating scroll menu spotlight:", error);
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
    }

    /**
     * Updates all debug mesh positions to match their physics counterparts
     */
    updateDebugMeshPositions() {
        // Skip if not using debug visuals
        if (!FLAGS.SIGN_VISUAL_DEBUG) return;
        
        // Update anchor debug mesh
        if (this.debug_meshes.anchor && this.anchor_body) {
            const anchorPos = this.anchor_body.translation();
            const anchorRot = this.anchor_body.rotation();
            this.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
            this.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
        }
        
        // Get all chain segment bodies
        const chainBodies = this.dynamic_bodies
            .filter(data => data.type === 'scroll_menu_chain' && data.body && typeof data.body.translation === 'function')
            .map(data => data.body);
            
        // Update chain segment debug meshes
        this.debug_meshes.segments.forEach((debugMesh, index) => {
            if (debugMesh && index < chainBodies.length) {
                const body = chainBodies[index];
                if (body && typeof body.translation === 'function') {
                    const pos = body.translation();
                    const rot = body.rotation();
                    debugMesh.position.set(pos.x, pos.y, pos.z);
                    debugMesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
                }
            }
        });
        
        // Update sign debug mesh
        if (this.debug_meshes.sign && this.sign_body && typeof this.sign_body.translation === 'function') {
            const signPos = this.sign_body.translation();
            const signRot = this.sign_body.rotation();
            this.debug_meshes.sign.position.set(signPos.x, signPos.y, signPos.z);
            this.debug_meshes.sign.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
        }
        
        // Update joint debug meshes - each segment connection
        for (let i = 0; i < this.debug_meshes.joints.length - 1; i++) {
            if (i < chainBodies.length - 1) {
                const debugMesh = this.debug_meshes.joints[i];
                const body1 = chainBodies[i];
                const body2 = chainBodies[i+1];
                
                if (debugMesh && body1 && body2) {
                    const pos1 = body1.translation();
                    const pos2 = body2.translation();
                    
                    // Position joint at the EXACT connection point
                    debugMesh.position.set(
                        (pos1.x + pos2.x) / 2,
                        pos1.y - this.CHAIN_CONFIG.SEGMENTS.LENGTH/2,
                        (pos1.z + pos2.z) / 2
                    );
                }
            }
        }
        
        // Update final joint (between last chain segment and sign)
        if (this.debug_meshes.joints.length > 0 && chainBodies.length > 0 && this.sign_body) {
            const lastJointMesh = this.debug_meshes.joints[this.debug_meshes.joints.length - 1];
            const lastChainBody = chainBodies[chainBodies.length - 1];
            
            if (lastJointMesh && lastChainBody) {
                const chainPos = lastChainBody.translation();
                
                // EXACT final joint position - static vertical offset from last chain segment
                lastJointMesh.position.set(
                    chainPos.x,
                    chainPos.y - this.CHAIN_CONFIG.SEGMENTS.LENGTH/2,
                    chainPos.z
                );
            }
        }
    }

    /**
     * Updates the debug visualization for all signs based on the current flag state
     */
    updateDebugVisualizations() {
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
     * Updates the assembly container dimensions to match the current bounds of the entire assembly
     */
    updateAssemblyContainerBounds() {
        if (!this.assembly_container) {
            return;
        }
        
        // Update wireframe visibility based on debug flags
        this.assembly_wireframe.visible = FLAGS.DEBUG_UI && FLAGS.COLLISION_VISUAL_DEBUG;
        
        // Ensure the sign mesh is always visible regardless of debug settings
        if (this.sign_mesh) {
            this.sign_mesh.visible = true;
        }
        
        // Skip further updates if wireframe isn't visible
        if (!this.assembly_wireframe.visible) {
            return;
        }
        
        // Initialize bounds with infinite min and -infinite max
        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        
        // Include anchor position in bounds
        if (this.anchor_body) {
            const pos = this.anchor_body.translation();
            min.x = Math.min(min.x, pos.x);
            min.y = Math.min(min.y, pos.y);
            min.z = Math.min(min.z, pos.z);
            max.x = Math.max(max.x, pos.x);
            max.y = Math.max(max.y, pos.y);
            max.z = Math.max(max.z, pos.z);
        }
        
        // Include all chain segments in bounds
        const chainBodies = this.dynamic_bodies
            .filter(data => data.type === 'scroll_menu_chain' && data.body)
            .map(data => data.body);
            
        chainBodies.forEach(body => {
            if (body) {
                const pos = body.translation();
                const radius = this.CHAIN_CONFIG.SEGMENTS.RADIUS;
                
                min.x = Math.min(min.x, pos.x - radius);
                min.y = Math.min(min.y, pos.y - radius);
                min.z = Math.min(min.z, pos.z - radius);
                max.x = Math.max(max.x, pos.x + radius);
                max.y = Math.max(max.y, pos.y + radius);
                max.z = Math.max(max.z, pos.z + radius);
            }
        });
        
        // Include sign dimensions in bounds
        if (this.sign_body) {
            const pos = this.sign_body.translation();
            const halfWidth = this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH / 2;
            const halfHeight = this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT / 2;
            const halfDepth = this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH / 2;
            
            min.x = Math.min(min.x, pos.x - halfWidth);
            min.y = Math.min(min.y, pos.y - halfHeight);
            min.z = Math.min(min.z, pos.z - halfDepth);
            max.x = Math.max(max.x, pos.x + halfWidth);
            max.y = Math.max(max.y, pos.y + halfHeight);
            max.z = Math.max(max.z, pos.z + halfDepth);
        }
        
        // Calculate size and center of bounds
        const size = new THREE.Vector3().subVectors(max, min);
        const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
        
        // Ensure minimum size to avoid zero dimensions
        size.x = Math.max(0.1, size.x);
        size.y = Math.max(0.1, size.y);
        size.z = Math.max(0.1, size.z);
        
        // Update container position to center of bounds
        this.assembly_container.position.copy(center);
        
        // Dispose of old geometry
        if (this.assembly_wireframe.geometry) {
            this.assembly_wireframe.geometry.dispose();
        }
        
        // Create new geometry with calculated size
        this.assembly_wireframe.geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        
        // Reset wireframe position relative to container
        this.assembly_wireframe.position.set(0, 0, 0);
        
        // Preserve rotation to match sign
        if (this.sign_body) {
            const signRot = this.sign_body.rotation();
            this.assembly_wireframe.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
        }
    }

    // New method to update kinematic chain segments and sign positions
    updateKinematicChainPositions() {
        if (!this.anchor_body) return;
        
        // Get anchor position
        const anchorPos = this.anchor_body.translation();
        const anchorRot = this.anchor_body.rotation();
        
        // Get chain segment bodies
        const chainBodies = this.dynamic_bodies
            .filter(data => data.type === 'scroll_menu_chain' && data.body && typeof data.body.translation === 'function')
            .map(data => data.body);
            
        // Update chain segment positions
        chainBodies.forEach((body, index) => {
            // Calculate new position based on index and segment length
            const segmentY = anchorPos.y - (index + 1) * this.CHAIN_CONFIG.SEGMENTS.LENGTH;
            
            // Move the kinematic body
            if (body.setNextKinematicTranslation) {
                // For newer versions of Rapier
                body.setNextKinematicTranslation({
                    x: anchorPos.x,
                    y: segmentY,
                    z: anchorPos.z
                });
                
                // Keep the same rotation as the anchor
                body.setNextKinematicRotation(anchorRot);
            } else {
                // For older versions of Rapier
                body.setTranslation({
                    x: anchorPos.x,
                    y: segmentY,
                    z: anchorPos.z
                });
                
                // Keep the same rotation as the anchor
                body.setRotation(anchorRot);
            }
        });
        
        // Update sign position at the end of the chain
        const signData = this.dynamic_bodies.find(data => data.type === 'scroll_menu_sign' && data.body);
        if (signData && signData.body) {
            // Calculate sign position at the end of the chain
            const signY = anchorPos.y - 
                (this.CHAIN_CONFIG.SEGMENTS.COUNT * this.CHAIN_CONFIG.SEGMENTS.LENGTH) - 
                (this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT / 2);
                
            // Move the kinematic sign body
            if (signData.body.setNextKinematicTranslation) {
                // For newer versions of Rapier
                signData.body.setNextKinematicTranslation({
                    x: anchorPos.x,
                    y: signY,
                    z: anchorPos.z
                });
                
                // Keep the same rotation as the anchor
                signData.body.setNextKinematicRotation(anchorRot);
            } else {
                // For older versions of Rapier
                signData.body.setTranslation({
                    x: anchorPos.x,
                    y: signY,
                    z: anchorPos.z
                });
                
                // Keep the same rotation as the anchor
                signData.body.setRotation(anchorRot);
            }
        }
    }

    // New method to make all chain segments dynamic when the sign is released
    makeEntireChainDynamic() {
        // Make all chain segments dynamic
        const chainBodies = this.dynamic_bodies
            .filter(data => data.type === 'scroll_menu_chain' && data.body)
            .map(data => data.body);
            
        // Convert all chain segments to dynamic bodies
        chainBodies.forEach(body => {
            // Only convert if it's not already dynamic
            if (body.bodyType() !== RAPIER.RigidBodyType.Dynamic) {
                body.setBodyType(RAPIER.RigidBodyType.Dynamic);
                
                // Optional: Apply appropriate physics properties that were previously commented out
                body.setLinearDamping(this.CHAIN_CONFIG.SEGMENTS.LINEAR_DAMPING);
                body.setAngularDamping(this.CHAIN_CONFIG.SEGMENTS.ANGULAR_DAMPING);
                body.setGravityScale(this.CHAIN_CONFIG.SEGMENTS.GRAVITY_SCALE);
            }
        });
        
        // Also convert the anchor body to dynamic if it exists and isn't already dynamic
        if (this.anchor_body && this.anchor_body.bodyType() !== RAPIER.RigidBodyType.Dynamic) {
            this.anchor_body.setBodyType(RAPIER.RigidBodyType.Dynamic);
            
            // Apply default physics properties for the anchor since CHAIN_CONFIG.ANCHOR doesn't exist
            this.anchor_body.setLinearDamping(0.5);  // Default value
            this.anchor_body.setAngularDamping(0.5); // Default value
            this.anchor_body.setGravityScale(1.0);   // Default value
        }
        
        // Log the conversion if physics logs are enabled
        if (FLAGS.PHYSICS_LOGS) {
            console.log(`Converted ${chainBodies.length} chain segments and anchor to dynamic bodies`);
        }
    }
}