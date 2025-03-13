import { TYPES } from '../../viewport/overlay/overlay_common';
import { FLAGS, RAPIER, THREE } from '../../common';
import { ASSET_TYPE, AssetSpawner }  from '@littlecarlito/blorkpack';
import { BLORKPACK_FLAGS } from '../../packages/blorkpack/src';

export const IMAGE_PATH = 'images/MouseControlMenu.svg';

// Combined configuration object for better organization
export const MENU_CONFIG = {
    BEAM: {
        DIMENSIONS: {
            WIDTH: 10,
            HEIGHT: 0.5,
            DEPTH: 0.2
        },
        PHYSICS: {
            MASS: 0,
            RESTITUTION: 0.3
        }
    },
    SIGN: {
        DIMENSIONS: {
            WIDTH: 10,
            HEIGHT: 10,
            DEPTH: 0.01
        },
        PHYSICS: {
            LINEAR_DAMPING: 0.7,
            ANGULAR_DAMPING: 0.7,
            MASS: 5,
            RESTITUTION: 0.2,
            USE_CCD: false
        }
    },
    SPACING: 1.5,
    JOINT: {
        SPREAD: 5,
        LENGTH: 1,
        LIMITS: {
            MIN: -Math.PI / 6,  // -30 degrees in radians
            MAX: Math.PI / 6    // +30 degrees in radians
        }
    },
    POSITION: {
        OFFSET: {
            X: 0,
            Y: 100,  // Spawn high above the camera
            Z: 13    // Initial Z offset
        },
        Z_TARGET: 13,  // Target Z position
        Y_TARGET: 8,   // Target Y position
    },
    ANIMATION: {
        DURATION: 2.0,  // Animation duration in seconds
        EASING: 0.05    // Easing factor (lower = smoother, higher = faster)
    }
};

// Joint anchor points - derived from configuration
export const JOINT_ANCHORS = {
    BEAM: {
        LEFT: { x: -MENU_CONFIG.JOINT.SPREAD, y: 0, z: 0 },
        RIGHT: { x: MENU_CONFIG.JOINT.SPREAD, y: 0, z: 0 },
        BOTTOM: { x: 0, y: -MENU_CONFIG.BEAM.DIMENSIONS.HEIGHT/2, z: 0 }
    },
    SIGN: {
        LEFT: { x: -MENU_CONFIG.JOINT.SPREAD, y: MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, z: 0 },
        RIGHT: { x: MENU_CONFIG.JOINT.SPREAD, y: MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, z: 0 },
        BOTTOM: { x: 0, y: -MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, z: 0 },
        TOP: { x: 0, y: MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, z: 0 }
    }
};
export const DEFAULT_SPEED = 250;
export const GRAVITY_DELAY = 266;

// Physics configuration for the sign
export const SIGN_PHYSICS = {
    LINEAR_DAMPING: 0.2,
    ANGULAR_DAMPING: 0.7,
    GRAVITY_SCALE: 2.0,    // Increased for better falling
    MASS: 10,
    RESTITUTION: 0.3,
    INITIAL_VELOCITY: {
        LINEAR: { x: 0, y: 0, z: 0 },
        ANGULAR: { x: 0, y: 0, z: 0 }
    },
    USE_CCD: false
};

export class ControlMenu {
    parent;
    camera;
    world;
    primary_container;
    // Top beam variables
    top_beam_geometry;
    top_beam_material;
    top_beam_mesh;
    top_beam_body;
    top_beam_shape;
    // Sign variables
    sign_image;
    sign_canvas;
    sign_context;
    sign_texture;
    sign_material;
    sign_geometry;
    sign_mesh;
    sign_body;
    sign_shape;
    // Debug meshes
    debug_meshes = {
        beam: null
    };
    // Assembly position
    assembly_position;
    target_position;
    sign_joint;
    chains_broken = false;
    reached_target = false;
    last_log_time = 0;
    log_interval = 500;
    menu_spotlight = null;
    spawner = null;
    // Animation variables
    animation_start_time = 0;
    is_animating = false;
    // Store initial camera state
    initial_camera_position = new THREE.Vector3();
    initial_camera_quaternion = new THREE.Quaternion();

    constructor(incoming_parent, incoming_camera, incoming_world, primary_container, incoming_speed = DEFAULT_SPEED) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.primary_container = primary_container;
        this.spawner = AssetSpawner.get_instance(this.parent);
        
        // Store initial camera state
        this.initial_camera_position.copy(this.camera.position);
        this.initial_camera_quaternion.copy(this.camera.quaternion);
        
        // Calculate assembly position based on camera using MENU_CONFIG
        this.assembly_position = {
            x: this.camera.position.x + MENU_CONFIG.POSITION.OFFSET.X,
            y: this.camera.position.y + MENU_CONFIG.POSITION.OFFSET.Y,
            z: this.camera.position.z - MENU_CONFIG.POSITION.OFFSET.Z
        };
        
        // Calculate target position
        this.target_position = {
            x: this.camera.position.x + MENU_CONFIG.POSITION.OFFSET.X,
            y: this.camera.position.y + MENU_CONFIG.POSITION.Y_TARGET,
            z: this.camera.position.z - MENU_CONFIG.POSITION.Z_TARGET
        };
        
        return this.initialize(primary_container, incoming_speed);
    }

    async initialize(primary_container, incoming_speed) {
        // Create only the beam debug mesh, not the sign debug mesh
        // Debug mesh for beam
        const beamDebugGeometry = new THREE.BoxGeometry(
            MENU_CONFIG.BEAM.DIMENSIONS.WIDTH,
            MENU_CONFIG.BEAM.DIMENSIONS.HEIGHT,
            MENU_CONFIG.BEAM.DIMENSIONS.DEPTH
        );
        const beamDebugMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        this.debug_meshes.beam = new THREE.Mesh(beamDebugGeometry, beamDebugMaterial);
        this.debug_meshes.beam.renderOrder = 999;
        this.debug_meshes.beam.visible = true;
        this.parent.add(this.debug_meshes.beam);

        // Now create the actual objects
        // Top beam creation
        this.top_beam_geometry = new THREE.BoxGeometry(
            MENU_CONFIG.BEAM.DIMENSIONS.WIDTH, 
            MENU_CONFIG.BEAM.DIMENSIONS.HEIGHT, 
            MENU_CONFIG.BEAM.DIMENSIONS.DEPTH
        );
        this.top_beam_material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        this.top_beam_mesh = new THREE.Mesh(this.top_beam_geometry, this.top_beam_material);
        this.parent.add(this.top_beam_mesh);
        
        // Create kinematic body instead of dynamic for smooth movement
        this.top_beam_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc
            .kinematicPositionBased()  // Use kinematic instead of dynamic
            .setTranslation(
                this.assembly_position.x,
                this.assembly_position.y,
                this.assembly_position.z
            )
            .setCanSleep(false)
        );
        
        this.top_beam_shape = RAPIER.ColliderDesc.cuboid(
            MENU_CONFIG.BEAM.DIMENSIONS.WIDTH/2, 
            MENU_CONFIG.BEAM.DIMENSIONS.HEIGHT/2, 
            MENU_CONFIG.BEAM.DIMENSIONS.DEPTH/2
        )
            .setMass(MENU_CONFIG.BEAM.PHYSICS.MASS)
            .setRestitution(MENU_CONFIG.BEAM.PHYSICS.RESTITUTION);
        this.world.createCollider(this.top_beam_shape, this.top_beam_body);
        primary_container.dynamic_bodies.push([this.top_beam_mesh, this.top_beam_body]);

        // Update beam debug mesh position
        this.debug_meshes.beam.position.copy(this.top_beam_mesh.position);
        this.debug_meshes.beam.quaternion.copy(this.top_beam_mesh.quaternion);

        // Create and load the sign asynchronously
        await new Promise((resolve) => {
            this.sign_image = new Image();
            this.sign_image.onload = () => {
                // Create canvas and context
                this.sign_canvas = document.createElement('canvas');
                this.sign_canvas.width = this.sign_image.width;
                this.sign_canvas.height = this.sign_image.height;
                this.sign_context = this.sign_canvas.getContext('2d');
                // Draw SVG to canvas
                this.sign_context.drawImage(this.sign_image, 0, 0);
                // Create texture from canvas
                this.sign_texture = new THREE.CanvasTexture(this.sign_canvas);
                // Create material with texture
                this.sign_material = new THREE.MeshStandardMaterial({
                    map: this.sign_texture,
                    side: THREE.DoubleSide,
                    roughness: 1.0,
                    metalness: 0.0,
                    envMapIntensity: 0.0,
                    normalScale: new THREE.Vector2(0, 0),
                    emissiveIntensity: 0.0,
                    aoMapIntensity: 0.0,
                    displacementScale: 0.0,
                    flatShading: true
                });
                // Create test object
                this.sign_geometry = new THREE.BoxGeometry(
                    MENU_CONFIG.SIGN.DIMENSIONS.WIDTH, 
                    MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT, 
                    MENU_CONFIG.SIGN.DIMENSIONS.DEPTH
                );
                this.sign_mesh = new THREE.Mesh(this.sign_geometry, this.sign_material);
                this.sign_mesh.castShadow = true;
                this.sign_mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.PRIMARY}`;
                this.parent.add(this.sign_mesh);
                // Create test physics object with initial rotation
                const initialRotation = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0),
                    -Math.PI/2  // Start at 90 degrees down
                );
                this.sign_body = this.world.createRigidBody(
                    RAPIER.RigidBodyDesc
                    .dynamic()
                    .setTranslation(
                        this.assembly_position.x,
                        this.top_beam_mesh.position.y - (MENU_CONFIG.SPACING + MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT/2),
                        this.top_beam_mesh.position.z
                    )
                    .setRotation(initialRotation)
                    .setAngvel({ x: 0, y: 0, z: 0 })
                    .setLinearDamping(MENU_CONFIG.SIGN.PHYSICS.LINEAR_DAMPING)
                    .setAngularDamping(2.0)
                    .setCcdEnabled(false)
                    .setCanSleep(false)     // Sign should never sleep to ensure it falls when chains break
                );
                this.sign_shape = RAPIER.ColliderDesc.cuboid(
                    MENU_CONFIG.SIGN.DIMENSIONS.WIDTH/2, 
                    MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, 
                    MENU_CONFIG.SIGN.DIMENSIONS.DEPTH/2
                )
                    .setMass(MENU_CONFIG.SIGN.PHYSICS.MASS)
                    .setRestitution(MENU_CONFIG.SIGN.PHYSICS.RESTITUTION);
                this.world.createCollider(this.sign_shape, this.sign_body);
                // Create revolute joint
                const sign_joint = RAPIER.JointData.revolute(
                    JOINT_ANCHORS.BEAM.BOTTOM,
                    {
                        x: JOINT_ANCHORS.SIGN.TOP.x,
                        y: JOINT_ANCHORS.SIGN.TOP.y + MENU_CONFIG.SPACING,
                        z: JOINT_ANCHORS.SIGN.TOP.z
                    },
                    { x: 1, y: 0, z: 0 }
                );
                // Set limits for straight down
                sign_joint.limits = [0, 0];
                // Create joint with correct method
                this.sign_joint = this.world.createImpulseJoint(sign_joint, this.top_beam_body, this.sign_body);
                // Configure the motor after joint creation
                if (this.sign_joint) {
                    this.sign_joint.configureMotorPosition(0, 10000.0, 1000.0);
                }
                if(FLAGS.PHYSICS_LOGS) {
                    console.log("Joint created with motor configuration");
                }
                primary_container.dynamic_bodies.push([this.sign_mesh, this.sign_body]);
                
                // If collision debug is enabled, manually create a debug wireframe for the sign
                if (FLAGS.COLLISION_VISUAL_DEBUG || BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
                    // Get the current sign position from the physics body
                    const position = this.sign_body.translation();
                    const rotation = this.sign_body.rotation();
                    
                    // Create a debug wireframe for the sign through the asset spawner
                    this.spawner.create_debug_wireframe(
                        'cuboid',
                        { 
                            x: MENU_CONFIG.SIGN.DIMENSIONS.WIDTH/2, 
                            y: MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, 
                            z: MENU_CONFIG.SIGN.DIMENSIONS.DEPTH/2 
                        },
                        new THREE.Vector3(position.x, position.y, position.z),
                        new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
                        { 
                            bodyId: this.sign_body.handle,
                            originalObject: this.sign_mesh,
                            objectId: this.sign_mesh.id,
                            isStatic: false
                        }
                    ).catch(error => {
                        console.warn('Failed to create debug wireframe for sign:', error);
                    });
                }
                
                resolve();
            };
            this.sign_image.src = IMAGE_PATH;
        });

        // Create spotlight immediately after control menu is initialized
        if (!this.menu_spotlight && this.sign_mesh) {
            const spotlightPosition = this.calculate_spotlight_position(this.camera.position, this.camera.quaternion);
            
            // Make sure we have valid positions before calculating direction
            if (spotlightPosition) {
                // Use the target position instead of the current sign position
                const targetPosition = new THREE.Vector3(
                    this.target_position.x,
                    this.target_position.y - 7, // Offset downward to aim lower
                    this.target_position.z
                );
                
                try {
                    const direction = new THREE.Vector3().subVectors(targetPosition, spotlightPosition);
                    const rotationY = Math.atan2(direction.x, direction.z);
                    const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
                    
                    // Adjust properties for a clearer edge but keep a larger radius
                    // Larger radius for control menu (white with higher intensity)
                    this.spawner.create_spotlight(
                        "control_menu_spotlight",
                        spotlightPosition,
                        { x: rotationX, y: rotationY },
                        {
                            circle_radius: 6,
                            color: "0xFFFFFF", // Standard white light instead of yellow
                            intensity: 1.2,    // Much higher intensity to draw attention
                            angle: Math.PI / 15, // Narrower angle for clearer edge
                            penumbra: 0.05,    // Lower penumbra for sharper edge
                            cast_shadow: false
                        },
                        {} // empty asset_data
                    ).then(spotlight => {
                        this.menu_spotlight = spotlight;
                        if(BLORKPACK_FLAGS.ASSET_LOGS) {
                            console.log("Control menu spotlight created:", this.menu_spotlight ? "success" : "failed");
                        }
                    }).catch(error => {
                        console.error("Error creating control menu spotlight:", error);
                    });
                } catch (error) {
                    console.error("Error creating control menu spotlight:", error);
                }
            } else {
                console.warn('ControlMenu: spotlightPosition is undefined');
            }
        }

        // Start the animation
        this.animation_start_time = performance.now();
        this.is_animating = true;

        this.reached_target = false;
        this.last_log_time = 0;
        this.log_interval = 5000;

        // Set initial visibility based on flag after everything is created
        this.updateDebugVisualizations();

        return this;
    }

    async break_chains() {
        if (this.chains_broken) {
            console.warn("Attempted to break chains again, but they were already broken.");
            return;
        }
        
        // Remove joint with null check
        if (this.sign_joint && this.world.getImpulseJoint(this.sign_joint.handle)) {
            try {
                this.world.removeImpulseJoint(this.sign_joint);
            } catch (e) {
                console.warn('Failed to remove joint:', e);
            }
        }
        this.sign_joint = null;

        // Remove spotlight if it exists
        if (this.menu_spotlight) {
            await this.spawner.despawn_spotlight(this.menu_spotlight.mesh);
            this.menu_spotlight = null;
        }

        // Dispose of beam mesh and physics body
        if (this.top_beam_mesh) {
            // Remove from scene
            this.parent.remove(this.top_beam_mesh);
            // Dispose of geometry and material
            if (this.top_beam_geometry) this.top_beam_geometry.dispose();
            if (this.top_beam_material) this.top_beam_material.dispose();
            this.top_beam_mesh = null;
        }

        // Remove beam physics body
        if (this.top_beam_body) {
            try {
                // Remove all colliders attached to this body
                const colliders = this.world.getBodyColliders(this.top_beam_body);
                for (let i = 0; i < colliders.length; i++) {
                    this.world.removeCollider(colliders[i]);
                }
                // Remove the body itself
                this.world.removeRigidBody(this.top_beam_body);
            } catch (e) {
                console.warn('Failed to remove beam physics body:', e);
            }
            this.top_beam_body = null;
        }

        // Dispose of beam debug mesh
        if (this.debug_meshes.beam) {
            this.parent.remove(this.debug_meshes.beam);
            this.debug_meshes.beam.geometry.dispose();
            this.debug_meshes.beam.material.dispose();
            this.debug_meshes.beam = null;
        }

        // Set gravity scale and wake up sign body
        if (this.sign_body) {
            this.sign_body.setGravityScale(2.0);  // Increased gravity for better falling
            this.sign_body.wakeUp();
            // Remove the tiny initial velocity and let gravity do its job
        }

        this.chains_broken = true;
    }

    // Smooth easing function (ease-out cubic)
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * Updates the spotlight to point at the sign
     */
    updateSpotlight() {
        // Removed spotlight tracking implementation since we want it to remain fixed
        // pointing at the final destination of the control menu
        // The spotlight is now set up at initialization and points at the target_position
    }

    async update() {
        // Get current time for logging
        const currentTime = performance.now();
        
        // Only log occasionally to avoid spamming the console
        if (currentTime - this.last_log_time > this.log_interval) {
            this.last_log_time = currentTime;
            
            if (FLAGS.PHYSICS_LOGS) {
                console.log(`Control menu update at ${currentTime.toFixed(0)}ms`);
            }
        }
        
        // Update spotlight if it exists
        this.updateSpotlight();

        // Remove update of sign debug mesh since we removed it

        // Update beam debug mesh if it still exists and chains are not broken
        if (!this.chains_broken && this.debug_meshes.beam && this.top_beam_mesh) {
            this.debug_meshes.beam.position.copy(this.top_beam_mesh.position);
            this.debug_meshes.beam.quaternion.copy(this.top_beam_mesh.quaternion);
        }
        
        // If we're animating, update the animation
        if (this.is_animating) {
            // Skip joint check if chains are broken, but continue updating
            if (!this.chains_broken && (!this.sign_joint)) return;
            
            // Log positions periodically
            if (currentTime - this.last_log_time > this.log_interval) {
                if (!this.chains_broken && this.top_beam_mesh && this.top_beam_body) {
                    const beamPos = this.top_beam_mesh.position;
                    const beamVel = this.top_beam_body.linvel();
                    if(FLAGS.PHYSICS_LOGS) {
                        console.log('=== Position Update ===');
                        console.log(`Top Beam - Position: (${beamPos.x.toFixed(2)}, ${beamPos.y.toFixed(2)}, ${beamPos.z.toFixed(2)})`);
                        console.log(`Top Beam - Velocity: (${beamVel.x.toFixed(2)}, ${beamVel.y.toFixed(2)}, ${beamVel.z.toFixed(2)})`);
                    }
                }
                
                if (this.sign_mesh && this.sign_body) {
                    const signPos = this.sign_body.translation();
                    const signVel = this.sign_body.linvel();
                    const signRot = this.sign_body.rotation();
                    const euler = new THREE.Euler().setFromQuaternion(
                        new THREE.Quaternion(signRot.x, signRot.y, signRot.z, signRot.w)
                    );
                    
                    if(FLAGS.PHYSICS_LOGS) {
                        console.log(`Sign - Position: (${signPos.x.toFixed(2)}, ${signPos.y.toFixed(2)}, ${signPos.z.toFixed(2)})`);
                        console.log(`Sign - Velocity: (${signVel.x.toFixed(2)}, ${signVel.y.toFixed(2)}, ${signVel.z.toFixed(2)})`);
                        console.log(`Sign - Rotation (rad): x:${euler.x.toFixed(2)}, y:${euler.y.toFixed(2)}, z:${euler.z.toFixed(2)}`);
                        console.log(`Sign - Rotation (deg): x:${(euler.x * 180/Math.PI).toFixed(2)}°, y:${(euler.y * 180/Math.PI).toFixed(2)}°, z:${(euler.z * 180/Math.PI).toFixed(2)}°`);
                    }
                }
                this.last_log_time = currentTime;
            }

            // Skip the rest if chains are broken
            if (this.chains_broken) return;

            // Handle smooth animation if still animating and objects exist
            if (this.is_animating && this.top_beam_body) {
                const elapsed = (currentTime - this.animation_start_time) / 1000; // Convert to seconds
                
                if (elapsed >= MENU_CONFIG.ANIMATION.DURATION) {
                    // Animation complete, set final position
                    this.top_beam_body.setNextKinematicTranslation({
                        x: this.target_position.x,
                        y: this.target_position.y,
                        z: this.target_position.z
                    });
                    
                    this.is_animating = false;
                    this.reached_target = true;
                    if(FLAGS.PHYSICS_LOGS) {
                        console.log(`Control Menu animation complete final Position: (${this.target_position.x.toFixed(2)}, ${this.target_position.y.toFixed(2)}, ${this.target_position.z.toFixed(2)})`);
                    }
                } else {
                    // Calculate progress with easing
                    const progress = this.easeOutCubic(Math.min(elapsed / MENU_CONFIG.ANIMATION.DURATION, 1.0));
                    
                    // Interpolate position
                    const newPosition = {
                        x: this.assembly_position.x,
                        y: this.assembly_position.y + (this.target_position.y - this.assembly_position.y) * progress,
                        z: this.assembly_position.z
                    };
                    
                    // Update the kinematic body position
                    this.top_beam_body.setNextKinematicTranslation(newPosition);
                }
            }
        }
    }

    /**
     * Updates the debug visualization for the control menu based on the current flag state
     */
    updateDebugVisualizations() {
        // Toggle visibility of beam debug mesh based on collision mesh toggle
        if (this.debug_meshes.beam) {
            this.debug_meshes.beam.visible = FLAGS.COLLISION_VISUAL_DEBUG;
        }
    }

    // Add this method to calculate spotlight position
    calculate_spotlight_position(camera_position, camera_quaternion) {
        const spotlightPosition = new THREE.Vector3();
        spotlightPosition.copy(camera_position);
        const backVector = new THREE.Vector3(0, 0, 15);
        backVector.applyQuaternion(camera_quaternion);
        spotlightPosition.add(backVector);
        return spotlightPosition;
    }
}