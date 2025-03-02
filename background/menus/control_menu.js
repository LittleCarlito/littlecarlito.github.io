import { TYPES } from '../../viewport/overlay/overlay_common';
import { FLAGS, ASSET_TYPE, RAPIER, THREE } from '../../common';
import { BackgroundLighting } from '../background_lighting';

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
        sign: null,
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
    lighting = null;
    // Animation variables
    animation_start_time = 0;
    is_animating = false;

    constructor(incoming_parent, incoming_camera, incoming_world, primary_container, incoming_speed = DEFAULT_SPEED) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.lighting = BackgroundLighting.getInstance(this.parent);
        
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

        // Create debug mesh for beam - always create it, but control visibility with flag
        const beamDebugGeometry = new THREE.BoxGeometry(
            MENU_CONFIG.BEAM.DIMENSIONS.WIDTH,
            MENU_CONFIG.BEAM.DIMENSIONS.HEIGHT,
            MENU_CONFIG.BEAM.DIMENSIONS.DEPTH
        );
        const beamDebugMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,  // Cyan for beam
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        this.debug_meshes.beam = new THREE.Mesh(beamDebugGeometry, beamDebugMaterial);
        this.debug_meshes.beam.position.copy(this.top_beam_mesh.position);
        this.debug_meshes.beam.quaternion.copy(this.top_beam_mesh.quaternion);
        this.debug_meshes.beam.renderOrder = 999; // Ensure it renders on top
        this.debug_meshes.beam.visible = FLAGS.SIGN_VISUAL_DEBUG; // Set initial visibility based on flag
        this.parent.add(this.debug_meshes.beam);

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
                
                // Create debug mesh for sign - always create it, but control visibility with flag
                const signDebugGeometry = new THREE.BoxGeometry(
                    MENU_CONFIG.SIGN.DIMENSIONS.WIDTH,
                    MENU_CONFIG.SIGN.DIMENSIONS.HEIGHT,
                    MENU_CONFIG.SIGN.DIMENSIONS.DEPTH
                );
                const signDebugMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,  // Magenta for sign
                    wireframe: true,
                    transparent: true,
                    opacity: 0.7
                });
                this.debug_meshes.sign = new THREE.Mesh(signDebugGeometry, signDebugMaterial);
                this.debug_meshes.sign.position.copy(this.sign_mesh.position);
                this.debug_meshes.sign.quaternion.copy(this.sign_mesh.quaternion);
                this.debug_meshes.sign.renderOrder = 999; // Ensure it renders on top
                this.debug_meshes.sign.visible = FLAGS.SIGN_VISUAL_DEBUG; // Set initial visibility based on flag
                this.parent.add(this.debug_meshes.sign);
                
                resolve();
            };
            this.sign_image.src = IMAGE_PATH;
        });

        // Start the animation
        this.animation_start_time = performance.now();
        this.is_animating = true;

        this.reached_target = false;
        this.last_log_time = 0;
        this.log_interval = 5000;

        return this;
    }

    async break_chains() {
        if (!this.chains_broken) {
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
                await this.lighting.despawn_spotlight(this.menu_spotlight);
                this.menu_spotlight = null;
            }

            // Set gravity scale for sign body
            if (this.sign_body) {
                this.sign_body.setGravityScale(1.0);
            }

            // Hide beam debug mesh when chains break, but don't remove it
            // This way it can be shown again if debug is toggled
            if (this.debug_meshes.beam) {
                this.debug_meshes.beam.visible = false;
            }

            this.chains_broken = true;
            if (FLAGS.PHYSICS_LOGS) {
                console.log("Control menu chains broken");
            }
        }
    }

    // Smooth easing function (ease-out cubic)
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    async update() {
        // Get current time for logging
        const currentTime = performance.now();
        
        // Skip joint check if chains are broken, but continue updating
        if (!this.chains_broken && (!this.sign_joint)) return;
        
        // Log positions periodically
        if (currentTime - this.last_log_time > this.log_interval) {
            const beamPos = this.top_beam_mesh.position;
            const beamVel = this.top_beam_body.linvel();
            if(FLAGS.PHYSICS_LOGS) {
                console.log('=== Position Update ===');
                console.log(`Top Beam - Position: (${beamPos.x.toFixed(2)}, ${beamPos.y.toFixed(2)}, ${beamPos.z.toFixed(2)})`);
                console.log(`Top Beam - Velocity: (${beamVel.x.toFixed(2)}, ${beamVel.y.toFixed(2)}, ${beamVel.z.toFixed(2)})`);
                if (this.sign_mesh && this.sign_body) {
                    const signPos = this.sign_mesh.position;
                    const signVel = this.sign_body.linvel();
                    const rotation = this.sign_body.rotation();
                    const euler = new THREE.Euler().setFromQuaternion(
                        new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
                    );
                    console.log(`Sign - Position: (${signPos.x.toFixed(2)}, ${signPos.y.toFixed(2)}, ${signPos.z.toFixed(2)})`);
                    console.log(`Sign - Velocity: (${signVel.x.toFixed(2)}, ${signVel.y.toFixed(2)}, ${signVel.z.toFixed(2)})`);
                    console.log(`Sign - Rotation (rad): x:${euler.x.toFixed(2)}, y:${euler.y.toFixed(2)}, z:${euler.z.toFixed(2)}`);
                    console.log(`Sign - Rotation (deg): x:${(euler.x * 180/Math.PI).toFixed(2)}°, y:${(euler.y * 180/Math.PI).toFixed(2)}°, z:${(euler.z * 180/Math.PI).toFixed(2)}°`);
                }
            }
            this.last_log_time = currentTime;
        }

        // Always update debug mesh positions if they exist, regardless of visibility
        // This ensures they're in the right position when the flag is toggled
        if (this.debug_meshes.sign && this.sign_body) {
            const signPos = this.sign_body.translation();
            const signRot = this.sign_body.rotation();
            this.debug_meshes.sign.position.set(signPos.x, signPos.y, signPos.z);
            this.debug_meshes.sign.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
        }

        // Only update beam debug mesh if chains are not broken
        if (!this.chains_broken && this.debug_meshes.beam && this.top_beam_body) {
            const beamPos = this.top_beam_body.translation();
            const beamRot = this.top_beam_body.rotation();
            this.debug_meshes.beam.position.set(beamPos.x, beamPos.y, beamPos.z);
            this.debug_meshes.beam.quaternion.set(beamRot.x, beamRot.y, beamRot.z, beamRot.w);
        }

        // Skip the rest if chains are broken
        if (this.chains_broken) return;

        // Handle smooth animation if still animating
        if (this.is_animating) {
            const elapsed = (currentTime - this.animation_start_time) / 1000; // Convert to seconds
            
            if (elapsed >= MENU_CONFIG.ANIMATION.DURATION) {
                // Animation complete, set final position
                this.top_beam_body.setNextKinematicTranslation({
                    x: this.target_position.x,
                    y: this.target_position.y,
                    z: this.target_position.z
                });
                
                // Create spotlight if needed (but don't wait for it)
                if (!this.menu_spotlight && this.sign_mesh) {
                    const spotlightPosition = new THREE.Vector3();
                    spotlightPosition.copy(this.camera.position);
                    const backVector = new THREE.Vector3(0, 0, 15);
                    backVector.applyQuaternion(this.camera.quaternion);
                    spotlightPosition.add(backVector);

                    const targetPosition = new THREE.Vector3();
                    targetPosition.copy(this.sign_mesh.position);
                    const direction = new THREE.Vector3().subVectors(targetPosition, spotlightPosition);
                    const rotationY = Math.atan2(direction.x, direction.z);
                    const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));

                    this.lighting.create_spotlight(
                        spotlightPosition,
                        rotationX,
                        rotationY,
                        50 * Math.tan(Math.PI / 16),
                        0
                    ).then(spotlight => {
                        this.menu_spotlight = spotlight;
                    });
                }
                
                this.is_animating = false;
                this.reached_target = true;
                
                if(FLAGS.PHYSICS_LOGS) {
                    console.log('=== Animation Complete ===');
                    console.log(`Final Position: (${this.target_position.x.toFixed(2)}, ${this.target_position.y.toFixed(2)}, ${this.target_position.z.toFixed(2)})`);
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
                
                // Update kinematic body position
                this.top_beam_body.setNextKinematicTranslation(newPosition);
                
                if(FLAGS.PHYSICS_LOGS && currentTime - this.last_log_time > 1000) {
                    console.log(`Animation progress: ${(progress * 100).toFixed(1)}%`);
                    console.log(`Current position: (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)}, ${newPosition.z.toFixed(2)})`);
                }
            }
        }
    }

    /**
     * Updates the debug visualization for the control menu based on the current flag state
     */
    updateDebugVisualizations() {
        // Toggle visibility of existing debug meshes based on flag
        if (this.debug_meshes.sign) {
            this.debug_meshes.sign.visible = FLAGS.SIGN_VISUAL_DEBUG;
        }
        
        if (this.debug_meshes.beam) {
            this.debug_meshes.beam.visible = FLAGS.SIGN_VISUAL_DEBUG;
        }
    }
}