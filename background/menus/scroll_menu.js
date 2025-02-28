import { TYPES } from '../../viewport/overlay/overlay_common';
import { FLAGS, NAMES, RAPIER, THREE } from '../../common';
import { AssetManager } from '../../common';
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
    // Chain settings
    CHAIN_CONFIG = {
        POSITION: {
            X: 0,
            Y: 10,
            Z: 0
        },
        SEGMENTS: {
            COUNT: 5,
            LENGTH: 0.5,
            RADIUS: 0.1,
            DAMPING: 1,
            MASS: 1,
            RESTITUTION: 0.01,
            FRICTION: 1.0,
            LINEAR_DAMPING: 1.0,    // Lighter damping for more natural chain movement
            ANGULAR_DAMPING: 1.5,   // Lighter angular damping
            GRAVITY_SCALE: 0.3      // Back to moderate gravity
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
            DAMPING: 1.0,          // Much lighter damping for responsive movement
            MASS: 2,               // Back to original mass
            RESTITUTION: 0.01,
            FRICTION: 1.0,
            ANGULAR_DAMPING: 1.5,   // Lighter angular damping
            GRAVITY_SCALE: 2,     // Moderate gravity scale
            IMAGE_PATH: 'images/ScrollControlMenu.svg'
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

    constructor(incoming_parent, incoming_camera, incoming_world, incoming_container, spawn_position) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.dynamic_bodies = incoming_container.dynamic_bodies;
        this.lighting = BackgroundLighting.getInstance(this.parent);

        // Use spawn position
        this.CHAIN_CONFIG.POSITION.X = spawn_position.x;
        this.CHAIN_CONFIG.POSITION.Y = spawn_position.y;
        this.CHAIN_CONFIG.POSITION.Z = spawn_position.z;

        return this.initialize(spawn_position);
    }

    async initialize(spawn_position) {
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

        // Create anchor with rotation
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
                color: 0xffff00,  // Bright yellow
                wireframe: true,
                transparent: true,
                opacity: 1.0,     // Full opacity
                depthTest: false, // Always render on top
                depthWrite: false // Don't write to depth buffer
            });
            this.debug_meshes.anchor = new THREE.Mesh(anchorGeometry, anchorMaterial);
            const anchorPos = this.anchor_body.translation();
            const anchorRot = this.anchor_body.rotation();
            this.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
            this.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
            this.debug_meshes.anchor.renderOrder = 999; // Ensure it renders last
            this.parent.add(this.debug_meshes.anchor);
        }

        // Create chain segments with same rotation
        let previous_body = this.anchor_body;
        for(let i = 0; i < this.CHAIN_CONFIG.SEGMENTS.COUNT; i++) {
            const chain_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(
                    this.CHAIN_CONFIG.POSITION.X,
                    this.CHAIN_CONFIG.POSITION.Y - (i + 1) * this.CHAIN_CONFIG.SEGMENTS.LENGTH,
                    this.CHAIN_CONFIG.POSITION.Z
                )
                .setRotation(rotation)
                .setLinearDamping(this.CHAIN_CONFIG.SEGMENTS.LINEAR_DAMPING)
                .setAngularDamping(this.CHAIN_CONFIG.SEGMENTS.ANGULAR_DAMPING)
                .setAdditionalMass(this.CHAIN_CONFIG.SEGMENTS.MASS)
                .setGravityScale(this.CHAIN_CONFIG.SEGMENTS.GRAVITY_SCALE)
                .setCanSleep(false)
            );
            const collider = RAPIER.ColliderDesc.ball(this.CHAIN_CONFIG.SEGMENTS.RADIUS)
                .setRestitution(this.CHAIN_CONFIG.SEGMENTS.RESTITUTION)
                .setFriction(this.CHAIN_CONFIG.SEGMENTS.FRICTION);
            this.world.createCollider(collider, chain_body);

            // Create visual mesh for chain segment (completely invisible)
            const segmentGeometry = new THREE.SphereGeometry(this.CHAIN_CONFIG.SEGMENTS.RADIUS);
            const segmentMaterial = new THREE.MeshBasicMaterial({ 
                visible: false
            });
            const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
            segmentMesh.name = `scroll_menu_chain_segment_${i}`;
            this.parent.add(segmentMesh);
            
            // Store both mesh and body with identifier
            this.dynamic_bodies.push({
                type: 'scroll_menu_chain',
                mesh: segmentMesh,
                body: chain_body
            });

            // Create spherical joint between segments with softer constraints
            const joint_desc = i === 0 
                ? RAPIER.JointData.spherical(
                    {x: 0, y: 0, z: 0},  // Anchor point
                    {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0}  // Local point on chain segment
                )
                : RAPIER.JointData.spherical(
                    {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0},  // Point on previous segment
                    {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0}    // Point on current segment
                );
            
            // Moderate joint constraints
            joint_desc.limitsEnabled = true;
            joint_desc.limits = [-Math.PI/12, Math.PI/12];  // ±15° for balanced movement
            
            // Moderate stiffness and damping
            joint_desc.stiffness = 150.0;    // Moderate stiffness
            joint_desc.damping = 30.0;       // Moderate damping
            
            const created_joint = this.world.createImpulseJoint(
                joint_desc,
                previous_body,
                chain_body,
                true
            );

            // Set initial velocities to zero to prevent startup bounce
            chain_body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            chain_body.setAngvel({ x: 0, y: 0, z: 0 }, true);

            this.chain_joints.push(created_joint);
            previous_body = chain_body;

            // Add debug mesh for segment if debug is enabled
            if (FLAGS.SIGN_VISUAL_DEBUG) {
                // Log segment creation for debugging
                if (FLAGS.PHYSICS_LOGS) {
                    console.log(`Creating chain segment ${i} at Y: ${this.CHAIN_CONFIG.POSITION.Y - (i + 1) * this.CHAIN_CONFIG.SEGMENTS.LENGTH}`);
                }

                const segmentGeometry = new THREE.SphereGeometry(this.CHAIN_CONFIG.SEGMENTS.RADIUS);
                const segmentMaterial = new THREE.MeshBasicMaterial({
                    color: 0x0000ff,  // Blue
                    wireframe: true,
                    depthTest: false,  // Make sure it's always visible
                    transparent: true,
                    opacity: 0.8
                });
                const debugSegment = new THREE.Mesh(segmentGeometry, segmentMaterial);
                debugSegment.position.copy(segmentMesh.position);
                debugSegment.quaternion.copy(segmentMesh.quaternion);
                this.debug_meshes.segments.push(debugSegment);
                this.parent.add(debugSegment);

                // Add debug mesh for joint - ONLY if not the last joint
                if (i < this.CHAIN_CONFIG.SEGMENTS.COUNT - 1) {
                    const jointGeometry = new THREE.SphereGeometry(0.1);
                    const jointMaterial = new THREE.MeshBasicMaterial({
                        color: 0xff0000,  // Red
                        wireframe: true,
                        depthTest: false,
                        transparent: true,
                        opacity: 0.8
                    });
                    const debugJoint = new THREE.Mesh(jointGeometry, jointMaterial);
                    
                    // Set initial joint position between current and next segments
                    const currentPos = chain_body.translation();
                    const prevPos = previous_body.translation();
                    debugJoint.position.set(
                        (prevPos.x + currentPos.x) / 2,
                        (prevPos.y + currentPos.y) / 2,
                        (prevPos.z + currentPos.z) / 2
                    );
                    
                    this.debug_meshes.joints.push(debugJoint);
                    this.parent.add(debugJoint);
                }
            }
        }

        // Create and load the sign asynchronously
        await new Promise((resolve, reject) => {
            this.sign_image = new Image();
            this.sign_image.onload = () => {
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
                this.sign_mesh.name = `${TYPES.INTERACTABLE}${NAMES.SECONDARY}_SCROLL_MENU`;
                
                // Rotate the sign 90 degrees around X axis
                this.sign_mesh.rotation.x = Math.PI / 2;
                
                this.parent.add(this.sign_mesh);
                
                const sign_spawn_y = this.CHAIN_CONFIG.POSITION.Y - 
                    (this.CHAIN_CONFIG.SEGMENTS.COUNT * this.CHAIN_CONFIG.SEGMENTS.LENGTH) - 
                    (this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT / 2);
                const theta_rad = Math.atan2(
                    this.camera.position.x,
                    this.camera.position.z
                );
                const halfAngle = theta_rad / 2;
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
                    .setCanSleep(false)
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
                
                // Connect sign to last chain segment with adjusted joint positions
                const finalJointDesc = RAPIER.JointData.spherical(
                    {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0},  // Bottom of last chain segment
                    {x: 0, y: this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, z: 0}   // Top of sign
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

                // Add debug mesh for sign
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
                    this.parent.add(this.debug_meshes.sign);
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
                    this.parent.add(signJointDebug);
                }

                resolve();
            };
            this.sign_image.onerror = reject;
            this.sign_image.src = this.CHAIN_CONFIG.SIGN.IMAGE_PATH;
        });

        this.last_log_time = 0;
        this.log_interval = 500;

        return this;
    }

    async break_chains() {
        if (!this.chains_broken) {
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
                if (this.debug_meshes.sign) {
                    this.parent.remove(this.debug_meshes.sign);
                }
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
        
        // Create spotlight if it doesn't exist and we have a sign
        if (!this.menu_spotlight && !this.chains_broken && this.sign_mesh) {
            // Calculate spotlight position 15 units behind camera
            const spotlightPosition = new THREE.Vector3();
            spotlightPosition.copy(this.camera.position);
            const backVector = new THREE.Vector3(0, 0, 15);
            backVector.applyQuaternion(this.camera.quaternion);
            spotlightPosition.add(backVector);

            // Calculate direction to sign
            const targetPosition = new THREE.Vector3();
            targetPosition.copy(this.sign_mesh.position);

            // Calculate angles for spotlight
            const direction = new THREE.Vector3().subVectors(targetPosition, spotlightPosition);
            const rotationY = Math.atan2(direction.x, direction.z);
            const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));

            // Create spotlight using the stored lighting instance
            this.menu_spotlight = await this.lighting.create_spotlight(
                spotlightPosition,
                rotationX,
                rotationY,
                5, // circle radius
                0, // unlimited distance
                0x00FFFF // Cyan color for scroll menu
            );
        }
        
        // Update sign rotation based on camera angles
        if (this.parent.children) {
            const sign = this.parent.children.find(child => 
                child.name === `${TYPES.INTERACTABLE}${NAMES.SECONDARY}_SCROLL_MENU`
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
}