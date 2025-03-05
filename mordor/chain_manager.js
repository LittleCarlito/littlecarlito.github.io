import { THREE, RAPIER, FLAGS } from '../../common';
import { ASSET_TYPE } from '../../common';
import { AssetStorage } from '../../common/asset_management/asset_storage';
import { TYPES } from '../../viewport/overlay/overlay_common';

/**
 * Manages the chain physics for the ScrollMenu
 */
export class ChainManager {
    menu;
    chain_config;
    chain_joints = [];
    chains_broken = false;
    sign_image;
    sign_mesh;
    sign_body;
    anchor_body;
    updateChainPositions = null;
    last_log_time = 0;
    log_interval = 500;

    constructor(scrollMenu, customConfig = null) {
        this.menu = scrollMenu;
        this.chain_config = customConfig || this.menu.CHAIN_CONFIG;
    }

    /**
     * Creates a chain segment with physics
     * @param {number} index - Index of the segment
     * @param {Object} previous_body - Previous body to connect to
     * @param {Object} rotation - Rotation quaternion
     * @returns {Object} The created chain body
     */
    async createChainSegment(index, previous_body, rotation) {
        // Calculate spawn position based on camera's orientation
        // Position Y still follows the chain length pattern but X and Z are relative to camera
        // Add proper vertical spacing between segments to prevent overlap
        const baseY = this.menu.target_position.y - (index + 1) * (this.chain_config.SEGMENTS.LENGTH + this.chain_config.SEGMENTS.RADIUS * 2);
        
        // Create kinematic rigid body - always kinematic as requested
        const chain_body = this.menu.world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(
                this.menu.assembly_position.x,
                baseY,
                this.menu.assembly_position.z
            )
            .setRotation(rotation)
            .setLinearDamping(this.chain_config.SEGMENTS.LINEAR_DAMPING)
            .setAngularDamping(this.chain_config.SEGMENTS.ANGULAR_DAMPING)
            .setAdditionalMass(this.chain_config.SEGMENTS.MASS)
            .setGravityScale(this.chain_config.SEGMENTS.GRAVITY_SCALE)
            .setCanSleep(true)
        );

        // Create collider
        const collider = RAPIER.ColliderDesc.ball(this.chain_config.SEGMENTS.RADIUS)
            .setRestitution(this.chain_config.SEGMENTS.RESTITUTION)
            .setFriction(this.chain_config.SEGMENTS.FRICTION);
        this.menu.world.createCollider(collider, chain_body);

        // Create visual mesh
        const segmentGeometry = new THREE.SphereGeometry(this.chain_config.SEGMENTS.RADIUS);
        // Use invisible material for chain segments - we don't want to see them
        const segmentMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
        segmentMesh.name = `scroll_menu_chain_segment_${index}`;
        
        // Add to our assembly container instead of parent directly
        this.menu.assembly_container.add(segmentMesh);

        // Store in dynamic bodies
        this.menu.dynamic_bodies.push({
            type: 'scroll_menu_chain',
            mesh: segmentMesh,
            body: chain_body
        });

        // Create joint with previous segment - adjust for proper spacing
        const joint_desc = index === 0 
            ? RAPIER.JointData.spherical(
                {x: 0, y: 0, z: 0},  // Anchor point
                {x: 0, y: this.chain_config.SEGMENTS.LENGTH/2 + this.chain_config.SEGMENTS.RADIUS, z: 0}  // Local point with spacing
            )
            : RAPIER.JointData.spherical(
                {x: 0, y: -this.chain_config.SEGMENTS.LENGTH/2 - this.chain_config.SEGMENTS.RADIUS, z: 0},  // Previous point with spacing
                {x: 0, y: this.chain_config.SEGMENTS.LENGTH/2 + this.chain_config.SEGMENTS.RADIUS, z: 0}    // Current point with spacing
            );

        joint_desc.limitsEnabled = true;
        joint_desc.limits = [-Math.PI/12, Math.PI/12];
        joint_desc.stiffness = 150.0;
        joint_desc.damping = 30.0;

        const created_joint = this.menu.world.createImpulseJoint(
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
            this.menu.debug_meshes.segments.push(debugSegment);
            this.menu.assembly_container.add(debugSegment);

            // Add debug mesh for joint if not last segment
            if (index < this.chain_config.SEGMENTS.COUNT - 1) {
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
                this.menu.debug_meshes.joints.push(jointDebug);
                this.menu.assembly_container.add(jointDebug);
            }
        }

        return chain_body;
    }

    /**
     * Creates the anchor point for the chain
     */
    createAnchorPoint() {
        // Calculate rotation based on camera position
        const theta_rad = Math.atan2(
            this.menu.camera.position.x,
            this.menu.camera.position.z
        );
        const halfAngle = theta_rad / 2;
        const rotation = {
            x: 0,
            y: Math.sin(halfAngle),
            z: 0,
            w: Math.cos(halfAngle)
        };

        // Create anchor at the assembly position (off-screen)
        this.anchor_body = this.menu.world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(
                this.menu.assembly_position.x,
                this.menu.target_position.y,
                this.menu.target_position.z
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
            this.menu.debug_meshes.anchor = new THREE.Mesh(anchorGeometry, anchorMaterial);
            const anchorPos = this.anchor_body.translation();
            const anchorRot = this.anchor_body.rotation();
            this.menu.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
            this.menu.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
            this.menu.debug_meshes.anchor.renderOrder = 999;
            this.menu.assembly_container.add(this.menu.debug_meshes.anchor);
        }

        return this.anchor_body;
    }

    /**
     * Creates the sign at the bottom of the chain
     * @param {Object} lastChainBody - The last chain segment to attach to
     */
    async createSign(lastChainBody) {
        // Get the position of the last chain segment
        let lastChainData = this.menu.dynamic_bodies.find(data => 
            data.type === 'scroll_menu_chain' && 
            data.body &&
            this.menu.dynamic_bodies.filter(d => d.type === 'scroll_menu_chain').indexOf(data) === this.chain_config.SEGMENTS.COUNT - 1
        );
        
        // Fallback to previous_body if we can't find the last chain segment
        let lastChainPos;
        if (!lastChainData || !lastChainData.body) {
            console.warn("Using previous_body fallback for sign attachment");
            lastChainPos = lastChainBody.translation();
            lastChainData = { body: lastChainBody };
        } else {
            lastChainPos = lastChainData.body.translation();
        }
        
        // Calculate the exact sign spawn position based on the last chain position
        // Position sign so its top center is exactly at the bottom of the last chain segment
        const sign_spawn_y = lastChainPos.y - 
                            (this.chain_config.SEGMENTS.LENGTH/2) - 
                            (this.chain_config.SIGN.DIMENSIONS.HEIGHT/2);
                                    
        console.log("Last chain position:", lastChainPos);
        console.log("Calculated sign spawn Y:", sign_spawn_y);

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
                    roughness: 1.0,
                    metalness: 0.0,
                    envMapIntensity: 0.0,
                    normalScale: new THREE.Vector2(0, 0),
                    emissiveIntensity: 0.0,
                    aoMapIntensity: 0.0,
                    displacementScale: 0.0,
                    flatShading: true,
                    visible: true,
                    transparent: false,
                    opacity: 1.0
                });
                
                const sign_geometry = new THREE.BoxGeometry(
                    this.chain_config.SIGN.DIMENSIONS.WIDTH,
                    this.chain_config.SIGN.DIMENSIONS.HEIGHT,
                    this.chain_config.SIGN.DIMENSIONS.DEPTH
                );
                this.sign_mesh = new THREE.Mesh(sign_geometry, sign_material);
                this.sign_mesh.castShadow = true;
                this.sign_mesh.name = `${TYPES.INTERACTABLE}${ASSET_TYPE.SECONDARY}_SCROLL_MENU`;
                this.sign_mesh.visible = true;
                
                // Add a reference to the ScrollMenu instance in the userData
                this.sign_mesh.userData.scrollMenu = this.menu;
                
                // Keep the sign upright instead of laying on its back
                // No X-axis rotation needed for an upright sign
                this.sign_mesh.rotation.x = 0; 
                
                // No additional rotation - sign will be upright and 
                // will look at the camera via assembly_container orientation
                
                // Add to our assembly container instead of parent directly
                this.menu.assembly_container.add(this.sign_mesh);
                
                console.log("Created sign mesh:", this.sign_mesh);
                
                // Create the sign rigid body with upright orientation
                const rotation = new THREE.Quaternion()
                    .setFromEuler(new THREE.Euler(0, 0, 0)); // Upright orientation, no rotation
                
                // Use standard upright orientation without rotation
                this.sign_body = this.menu.world.createRigidBody(
                    RAPIER.RigidBodyDesc.kinematicPositionBased()
                    .setTranslation(
                        this.menu.assembly_position.x,
                        sign_spawn_y,
                        this.menu.assembly_position.z
                    )
                    .setRotation({
                        x: rotation.x,
                        y: rotation.y,
                        z: rotation.z,
                        w: rotation.w
                    })
                    .setLinearDamping(this.chain_config.SIGN.DAMPING)
                    .setAngularDamping(this.chain_config.SIGN.ANGULAR_DAMPING)
                    .setAdditionalMass(this.chain_config.SIGN.MASS)
                    .setGravityScale(this.chain_config.SIGN.GRAVITY_SCALE)
                    .setCanSleep(true)
                );
                
                // Explicitly set the sign mesh position to match the body
                const signPos = this.sign_body.translation();
                this.sign_mesh.position.set(signPos.x, signPos.y, signPos.z);
                
                const sign_collider = RAPIER.ColliderDesc.cuboid(
                    this.chain_config.SIGN.DIMENSIONS.WIDTH/2,
                    this.chain_config.SIGN.DIMENSIONS.HEIGHT/2,
                    this.chain_config.SIGN.DIMENSIONS.DEPTH/2
                )
                    .setRestitution(this.chain_config.SIGN.RESTITUTION)
                    .setFriction(this.chain_config.SIGN.FRICTION);
                this.menu.world.createCollider(sign_collider, this.sign_body);
                
                // Set initial velocities to zero for sign
                this.sign_body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                this.sign_body.setAngvel({ x: 0, y: 0, z: 0 }, true);
                
                // Force the sign to sleep initially
                this.sign_body?.sleep();
                
                // Connect sign to last chain segment - adjust connection points for visual continuity
                const finalJointDesc = RAPIER.JointData.spherical(
                    {x: 0, y: -this.chain_config.SEGMENTS.LENGTH/2 - this.chain_config.SEGMENTS.RADIUS, z: 0},  // Bottom of last chain segment
                    {x: 0, y: this.chain_config.SIGN.DIMENSIONS.HEIGHT/2, z: 0}   // Top center of sign
                );
                
                // Configure joint parameters for looser connection to prevent pinching
                finalJointDesc.limitsEnabled = true;
                finalJointDesc.limits = [-Math.PI/6, Math.PI/6]; // Wider angle than chain segments (30 degrees)
                finalJointDesc.stiffness = 100.0;  // Lower stiffness for more freedom
                finalJointDesc.damping = 20.0;    // Lower damping for smoother movement
                
                // Create the joint with the updated parameters
                const signJoint = this.menu.world.createImpulseJoint(
                    finalJointDesc,
                    lastChainData.body,
                    this.sign_body,
                    true
                );
                this.chain_joints.push(signJoint);
                AssetStorage.get_instance().add_object(this.sign_mesh, this.sign_body);

                // Store sign with specific identifier
                this.menu.dynamic_bodies.push({
                    type: 'scroll_menu_sign',
                    mesh: this.sign_mesh,
                    body: this.sign_body
                });

                // Add debug visualization for sign
                if (FLAGS.SIGN_VISUAL_DEBUG) {
                    this.createSignDebugMesh();
                }

                resolve();
            };
            this.sign_image.onerror = reject;
            this.sign_image.src = this.chain_config.SIGN.IMAGE_PATH;
        });
    }

    /**
     * Creates debug meshes for the sign
     */
    createSignDebugMesh() {
        const signDebugGeometry = new THREE.BoxGeometry(
            this.chain_config.SIGN.DIMENSIONS.WIDTH,
            this.chain_config.SIGN.DIMENSIONS.HEIGHT,
            this.chain_config.SIGN.DIMENSIONS.DEPTH
        );
        const signDebugMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,  // Bright magenta for better visibility
            wireframe: true
        });
        this.menu.debug_meshes.sign = new THREE.Mesh(signDebugGeometry, signDebugMaterial);
        this.menu.debug_meshes.sign.position.copy(this.sign_mesh.position);
        this.menu.debug_meshes.sign.quaternion.copy(this.sign_mesh.quaternion);
        this.menu.assembly_container.add(this.menu.debug_meshes.sign);

        // Add debug visualization for sign joint
        const signJointGeometry = new THREE.SphereGeometry(0.1);
        const signJointMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });
        const signJointDebug = new THREE.Mesh(signJointGeometry, signJointMaterial);
        
        // Position the joint at the updated connection point between chain and sign
        const lastChainData = this.menu.dynamic_bodies.find(data => 
            data.type === 'scroll_menu_chain' && 
            data.body &&
            this.menu.dynamic_bodies.filter(d => d.type === 'scroll_menu_chain').indexOf(data) === this.chain_config.SEGMENTS.COUNT - 1
        );
        
        if (lastChainData && lastChainData.body) {
            const lastChainPos = lastChainData.body.translation();
            const signPos = this.sign_body.translation();
            // Set debug at midpoint between chain end and sign top
            signJointDebug.position.set(
                lastChainPos.x,
                (lastChainPos.y - this.chain_config.SEGMENTS.LENGTH/2 - this.chain_config.SEGMENTS.RADIUS + 
                 signPos.y + this.chain_config.SIGN.DIMENSIONS.HEIGHT/2) / 2,
                lastChainPos.z
            );
            
            this.menu.debug_meshes.joints.push(signJointDebug);
            this.menu.assembly_container.add(signJointDebug);
        }
    }

    /**
     * Breaks the chain and handles physics transitions
     */
    async break_chains() {
        // Avoid breaking chains multiple times
        if (this.chains_broken) {
            return; // Exit early if chains are already broken
        }
        
        // Mark chains as broken immediately
        this.chains_broken = true;
        
        console.log("Breaking chains - simplified approach");
        
        // Store whether sign is being held BEFORE clearing updateChainPositions
        const isSignHeld = !!this.updateChainPositions;

        // Clear the chain position update callback first
        this.updateChainPositions = null;
        
        // Remove all joints first
        for (let i = 0; i < this.chain_joints.length; i++) {
            const joint = this.chain_joints[i];
            if (joint && this.menu.world.getImpulseJoint(joint.handle)) {
                this.menu.world.removeImpulseJoint(joint);
            }
        }
        this.chain_joints = [];

        // Remove all segments from dynamic_bodies
        const segmentsToRemove = this.menu.dynamic_bodies.filter(data => 
            data.type === 'scroll_menu_chain'
        );
        
        // Remove bodies first, then meshes to prevent recursive updates
        for (const segmentData of segmentsToRemove) {
            // Remove body from world first
            if (segmentData.body) {
                try {
                    this.menu.world.removeRigidBody(segmentData.body);
                } catch (error) {
                    console.warn("Error removing rigid body:", error);
                }
            }
        }

        // Now safe to remove meshes
        for (const segmentData of segmentsToRemove) {
            // Remove mesh from scene
            if (segmentData.mesh && segmentData.mesh.parent) {
                segmentData.mesh.parent.remove(segmentData.mesh);
                
                // Dispose of geometry and material
                if (segmentData.mesh.geometry) segmentData.mesh.geometry.dispose();
                if (segmentData.mesh.material) segmentData.mesh.material.dispose();
            }
            
            // Remove from dynamic_bodies
            const index = this.menu.dynamic_bodies.indexOf(segmentData);
            if (index !== -1) {
                this.menu.dynamic_bodies.splice(index, 1);
            }
        }
        
        // Handle sign physics based on whether it's being held
        const signData = this.menu.dynamic_bodies.find(data => 
            data.type === 'scroll_menu_sign' && data.body
        );
        
        if (signData && signData.body) {
            try {
                if (isSignHeld) {
                    // If sign is being held, keep it kinematic
                    console.log("Sign is being held, keeping it kinematic");
                    signData.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
                } else {
                    // Only log and convert if it's the first time
                    const currentType = signData.body.bodyType();
                    if (currentType !== RAPIER.RigidBodyType.Dynamic) {
                        console.log("Sign is not being held, converting to dynamic");
                        signData.body.wakeUp();
                        signData.body.setBodyType(RAPIER.RigidBodyType.Dynamic);
                    }
                }
            } catch (error) {
                console.warn("Error setting sign body type:", error);
            }
        }
        
        // Remove debug meshes if they exist
        if (this.menu.debug_meshes.anchor) {
            this.menu.assembly_container.remove(this.menu.debug_meshes.anchor);
            if (this.menu.debug_meshes.anchor.geometry) this.menu.debug_meshes.anchor.geometry.dispose();
            if (this.menu.debug_meshes.anchor.material) this.menu.debug_meshes.anchor.material.dispose();
            this.menu.debug_meshes.anchor = null;
        }
        
        // Use traditional for loop to avoid issues with array modification during iteration
        for (let i = 0; i < this.menu.debug_meshes.segments.length; i++) {
            const segment = this.menu.debug_meshes.segments[i];
            if (segment && segment.parent) {
                segment.parent.remove(segment);
                if (segment.geometry) segment.geometry.dispose();
                if (segment.material) segment.material.dispose();
            }
        }
        this.menu.debug_meshes.segments = [];
        
        for (let i = 0; i < this.menu.debug_meshes.joints.length; i++) {
            const joint = this.menu.debug_meshes.joints[i];
            if (joint && joint.parent) {
                joint.parent.remove(joint);
                if (joint.geometry) joint.geometry.dispose();
                if (joint.material) joint.material.dispose();
            }
        }
        this.menu.debug_meshes.joints = [];
        
        // No longer dispose of sign debug mesh - just update its visibility if needed
        if (this.menu.debug_meshes.sign) {
            this.menu.debug_meshes.sign.visible = FLAGS.SIGN_VISUAL_DEBUG;
        }
        
        // Remove the anchor body last
        if (this.anchor_body) {
            try {
                this.menu.world.removeRigidBody(this.anchor_body);
                this.anchor_body = null;
            } catch (error) {
                console.warn("Error removing anchor body:", error);
            }
        }
    }

    /**
     * Updates the chain each frame
     */
    update() {
        const currentTime = performance.now();
        
        // Skip unnecessary updates if chains are already broken
        if (this.chains_broken && !this.menu.is_animating) {
            // Just make sure the sign is visible if it exists
            if (this.sign_mesh && !this.sign_mesh.visible) {
                this.sign_mesh.visible = true;
            }
            return;
        }
        
        // Always ensure the sign mesh is visible
        if (this.sign_mesh && !this.sign_mesh.visible) {
            this.sign_mesh.visible = true;
        }
        
        // Update chain positions if sign is grabbed
        if (this.updateChainPositions) {
            this.updateChainPositions();
        }
        
        // Handle smooth animation if still animating
        if (this.menu.is_animating && this.anchor_body) {
            const elapsed = (currentTime - this.menu.animation_start_time) / 1000; // Convert to seconds
            
            if (elapsed >= this.chain_config.ANIMATION.DURATION) {
                // Animation complete, set final position
                this.anchor_body.setNextKinematicTranslation({
                    x: this.menu.target_position.x,
                    y: this.menu.target_position.y,
                    z: this.menu.target_position.z
                });
                
                // Also set final positions for all chain segments and sign
                const chainSegments = this.menu.dynamic_bodies.filter(data => 
                    data.type === 'scroll_menu_chain' && data.body
                );
                
                for (let i = 0; i < chainSegments.length; i++) {
                    const segment = chainSegments[i];
                    if (segment.body) {
                        const currentPos = segment.body.translation();
                        segment.body.setNextKinematicTranslation({
                            x: this.menu.target_position.x,
                            y: currentPos.y,
                            z: this.menu.target_position.z
                        });
                    }
                }
                
                // Set final position for sign
                if (this.sign_body) {
                    const currentPos = this.sign_body.translation();
                    this.sign_body.setNextKinematicTranslation({
                        x: this.menu.target_position.x,
                        y: currentPos.y,
                        z: this.menu.target_position.z
                    });
                    
                    // Also update the sign mesh directly
                    if (this.sign_mesh) {
                        this.sign_mesh.position.set(this.menu.target_position.x, currentPos.y, currentPos.z);
                        
                        // Force the sign mesh to be visible
                        this.sign_mesh.visible = true;
                    }
                }
                
                this.menu.is_animating = false;
                console.log('=== Scroll Menu Animation Complete ===');
            } else {
                // Calculate progress with easing
                const progress = this.easeOutCubic(Math.min(elapsed / this.chain_config.ANIMATION.DURATION, 1.0));
                
                // Interpolate position - interpolate in 3D space instead of just X
                const newPosition = {
                    x: this.menu.assembly_position.x + (this.menu.target_position.x - this.menu.assembly_position.x) * progress,
                    y: this.menu.assembly_position.y + (this.menu.target_position.y - this.menu.assembly_position.y) * progress,
                    z: this.menu.assembly_position.z + (this.menu.target_position.z - this.menu.assembly_position.z) * progress
                };
                
                // Update kinematic body position
                this.anchor_body.setNextKinematicTranslation(newPosition);
                
                // Also update all chain segments and sign
                const chainSegments = this.menu.dynamic_bodies.filter(data => 
                    data.type === 'scroll_menu_chain' && data.body
                );
                
                for (let i = 0; i < chainSegments.length; i++) {
                    const segment = chainSegments[i];
                    if (segment.body) {
                        const currentPos = segment.body.translation();
                        segment.body.setNextKinematicTranslation({
                            x: newPosition.x,
                            y: currentPos.y,
                            z: newPosition.z
                        });
                    }
                }
                
                // Update sign position
                if (this.sign_body) {
                    const currentPos = this.sign_body.translation();
                    this.sign_body.setNextKinematicTranslation({
                        x: newPosition.x,
                        y: currentPos.y,
                        z: newPosition.z
                    });
                    
                    // Also update the sign mesh directly
                    if (this.sign_mesh) {
                        this.sign_mesh.position.set(newPosition.x, currentPos.y, newPosition.z);
                        
                        // Force the sign mesh to be visible
                        this.sign_mesh.visible = true;
                    }
                }
            }
        }
        
        // Find the actual sign mesh
        const sign = this.sign_mesh;
        
        // Only update the sign rotation directly - much simpler approach
        if (sign) {
            // Make the sign align EXACTLY with the camera's orientation
            // Get the camera's viewing direction (where it's pointing)
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(this.menu.camera.quaternion);
            
            // Calculate a quaternion that will rotate the sign to face the camera directly
            const signPosition = sign.position.clone();
            const cameraPosition = this.menu.camera.position.clone();
            
            // Create a quaternion that orients the sign perpendicular to the camera's view direction
            // This ensures the sign's normal is pointing at the camera
            const upVector = new THREE.Vector3(0, 1, 0);
            const rightVector = new THREE.Vector3().crossVectors(upVector, cameraDirection).normalize();
            const adjustedUpVector = new THREE.Vector3().crossVectors(cameraDirection, rightVector).normalize();
            
            // Create a rotation matrix from these orthogonal vectors
            const rotationMatrix = new THREE.Matrix4().makeBasis(
                rightVector,                // Right vector (X)
                adjustedUpVector,           // Up vector adjusted to camera orientation (Y)
                cameraDirection.negate()    // Forward vector (Z) - we negate to face the camera
            );
            
            // Set the sign's rotation directly from this matrix
            sign.quaternion.setFromRotationMatrix(rotationMatrix);
            
            // Force visibility
            sign.visible = true;
            
            if (FLAGS.PHYSICS_LOGS && (currentTime - this.last_log_time) > this.log_interval) {
                console.log(`Sign direct update - position: ${sign.position.x.toFixed(2)}, ${sign.position.y.toFixed(2)}, ${sign.position.z.toFixed(2)}`);
                console.log(`Camera direction: ${cameraDirection.x.toFixed(2)}, ${cameraDirection.y.toFixed(2)}, ${cameraDirection.z.toFixed(2)}`);
                this.last_log_time = currentTime;
            }
        }
    }

    /**
     * Cubic easing function (ease-out)
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * Handles the sign being grabbed by user
     */
    handleSignGrabbed() {
        console.log("Sign grabbed - chain follows sign position");
        
        // Make everything kinematic
        const chainSegments = this.menu.dynamic_bodies.filter(data => 
            data.type === 'scroll_menu_chain' && data.body
        );
        
        // Make chain segments and sign kinematic
        for (const segment of chainSegments) {
            if (segment.body) {
                segment.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
            }
        }
        
        // Always make sign kinematic when grabbed, regardless of chain state
        if (this.sign_body) {
            this.sign_body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
        }

        // Set up update function to position chain segments
        this.updateChainPositions = () => {
            if (!this.sign_body) return;

            // If chains are broken, we only need to ensure sign stays kinematic
            if (this.chains_broken) {
                if (this.sign_body) {
                    this.sign_body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
                }
                return;
            }

            // Only update chain positions if chains aren't broken
            if (!this.anchor_body) return;

            const signPos = this.sign_body.translation();
            const anchorPos = this.anchor_body.translation();
            
            // Calculate direction from anchor to sign
            const direction = new THREE.Vector3(
                signPos.x - anchorPos.x,
                signPos.y - anchorPos.y,
                signPos.z - anchorPos.z
            );
            
            // Sort chain segments from anchor to sign
            chainSegments.sort((a, b) => {
                const aPos = a.body.translation();
                const bPos = b.body.translation();
                const aDist = Math.abs(aPos.y - anchorPos.y);
                const bDist = Math.abs(bPos.y - anchorPos.y);
                return aDist - bDist;
            });

            // Position each segment along the direction
            chainSegments.forEach((segment, index) => {
                const t = (index + 1) / (chainSegments.length + 1);
                const segmentPos = {
                    x: anchorPos.x + direction.x * t,
                    y: anchorPos.y + direction.y * t,
                    z: anchorPos.z + direction.z * t
                };
                segment.body.setTranslation(segmentPos);
            });
        };
    }

    /**
     * Handles the sign being released
     */
    handleSignReleased() {
        console.log("Sign released - restoring chain physics");
        
        // Remove the update function first
        this.updateChainPositions = null;
        
        // If chains are broken, just make the sign dynamic and return
        if (this.chains_broken) {
            console.log("Chains are broken, converting sign to dynamic");
            if (this.sign_body) {
                try {
                    this.sign_body.wakeUp();
                    this.sign_body.setBodyType(RAPIER.RigidBodyType.Dynamic);
                } catch (error) {
                    console.warn("Error converting sign to dynamic:", error);
                }
            }
            return;
        }
        
        // Convert chain segments back to dynamic
        const chainSegments = this.menu.dynamic_bodies.filter(data => 
            data.type === 'scroll_menu_chain' && data.body
        );
        
        // Wake up bodies first
        for (const segment of chainSegments) {
            if (segment.body) {
                try {
                    segment.body.wakeUp();
                } catch (error) {
                    console.warn("Error waking up chain segment:", error);
                }
            }
        }
        
        // Then set body types
        for (const segment of chainSegments) {
            if (segment.body) {
                try {
                    segment.body.setBodyType(RAPIER.RigidBodyType.Dynamic);
                } catch (error) {
                    console.warn("Error setting chain segment to dynamic:", error);
                }
            }
        }
        
        // Convert sign back to dynamic last
        if (this.sign_body) {
            try {
                this.sign_body.wakeUp();
                this.sign_body.setBodyType(RAPIER.RigidBodyType.Dynamic);
            } catch (error) {
                console.warn("Error converting sign to dynamic:", error);
            }
        }
    }

    /**
     * Cleans up resources
     */
    async cleanup() {
        // Clean up by breaking chains which handles most resources
        await this.break_chains();
    }
} 