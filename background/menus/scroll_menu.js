import { TYPES } from '../../viewport/overlay/overlay_common';
import { FLAGS, NAMES, RAPIER, THREE } from '../../common';
import { AssetManager } from '../../common/asset_manager';

export class ScrollMenu {
    parent;
    camera;
    world;
    dynamic_bodies;
    // Chain settings
    CHAIN_CONFIG = {
        POSITION: {
            X: 0,
            Y: 4,
            Z: 0
        },
        SEGMENTS: {
            COUNT: 6,
            LENGTH: 0.5,
            RADIUS: 0.1,
            DAMPING: 1.5,
            MASS: 0.05,
            RESTITUTION: 0.1,
            FRICTION: 0.8,
            ANGULAR_DAMPING: 1.5,
            GRAVITY_SCALE: 5.0
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
            MASS: 1,
            RESTITUTION: 0.1,
            FRICTION: 0.8,
            ANGULAR_DAMPING: 0.8,
            GRAVITY_SCALE: 1.5,
            IMAGE_PATH: 'images/ScrollControlMenu.svg'
        }
    };
    chain_joints = [];
    chains_broken = false;
    last_log_time = 0;
    log_interval = 500;

    constructor(incoming_parent, incoming_camera, incoming_world, incoming_container, spawn_position) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.dynamic_bodies = incoming_container.dynamic_bodies;

        // Use spawn position
        this.CHAIN_CONFIG.POSITION.X = spawn_position.x;
        this.CHAIN_CONFIG.POSITION.Y = spawn_position.y;
        this.CHAIN_CONFIG.POSITION.Z = spawn_position.z;

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
        const anchor_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
            .setTranslation(
                this.CHAIN_CONFIG.POSITION.X,
                this.CHAIN_CONFIG.POSITION.Y,
                this.CHAIN_CONFIG.POSITION.Z
            )
            .setRotation(rotation)  // Apply same rotation to anchor
        );

        // Create chain segments with same rotation
        let previous_body = anchor_body;
        for(let i = 0; i < this.CHAIN_CONFIG.SEGMENTS.COUNT; i++) {
            const chain_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(
                    this.CHAIN_CONFIG.POSITION.X,
                    this.CHAIN_CONFIG.POSITION.Y - (i + 1) * this.CHAIN_CONFIG.SEGMENTS.LENGTH,
                    this.CHAIN_CONFIG.POSITION.Z
                )
                .setRotation(rotation)  // Apply same rotation to each chain segment
                .setLinearDamping(this.CHAIN_CONFIG.SEGMENTS.DAMPING)
                .setAngularDamping(this.CHAIN_CONFIG.SEGMENTS.ANGULAR_DAMPING)
                .setAdditionalMass(this.CHAIN_CONFIG.SEGMENTS.MASS)
                .setGravityScale(this.CHAIN_CONFIG.SEGMENTS.GRAVITY_SCALE)
                .setCanSleep(false)
            );
            const collider = RAPIER.ColliderDesc.ball(this.CHAIN_CONFIG.SEGMENTS.RADIUS)
                .setRestitution(this.CHAIN_CONFIG.SEGMENTS.RESTITUTION)
                .setFriction(this.CHAIN_CONFIG.SEGMENTS.FRICTION);
            this.world.createCollider(collider, chain_body);
            this.dynamic_bodies.push([chain_body]);
            let created_joint;
            // Create spherical joint between segments
            if (i > 0) {
                const joint_desc = RAPIER.JointData.spherical(
                    {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0},
                    {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0}
                );
                created_joint = this.world.createImpulseJoint(
                    joint_desc,
                    previous_body,
                    chain_body,
                    true
                );
            } else {
                // Connect first segment to anchor
                const joint_desc = RAPIER.JointData.spherical(
                    {x: 0, y: 0, z: 0},
                    {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0}
                );
                created_joint = this.world.createImpulseJoint(
                    joint_desc,
                    anchor_body,
                    chain_body,
                    true
                );
            }
            this.chain_joints.push(created_joint);
            previous_body = chain_body;
        }
        // Create and load the sign
        const sign_image = new Image();
        sign_image.onload = () => {
            const sign_canvas = document.createElement('canvas');
            sign_canvas.width = sign_image.width;
            sign_canvas.height = sign_image.height;
            const signContext = sign_canvas.getContext('2d');
            signContext.drawImage(sign_image, 0, 0);
            
            const sign_texture = new THREE.CanvasTexture(sign_canvas);
            const sign_material = new THREE.MeshStandardMaterial({
                map: sign_texture,
                side: THREE.DoubleSide
            });
            
            const sign_geometry = new THREE.BoxGeometry(
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH,
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT,
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH
            );
            const sign_mesh = new THREE.Mesh(sign_geometry, sign_material);
            sign_mesh.castShadow = true;
            sign_mesh.name = `${TYPES.INTERACTABLE}${NAMES.SECONDARY}`;
            
            // Rotate the sign 90 degrees around X axis
            sign_mesh.rotation.x = Math.PI / 2;
            
            this.parent.add(sign_mesh);
            
            const sign_spawn_y = this.CHAIN_CONFIG.POSITION.Y - 
                (this.CHAIN_CONFIG.SEGMENTS.COUNT * this.CHAIN_CONFIG.SEGMENTS.LENGTH);
            const theta_rad = Math.atan2(
                this.camera.position.x,
                this.camera.position.z
            );
            const halfAngle = theta_rad / 2;
            const sign_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(
                    this.CHAIN_CONFIG.POSITION.X + this.CHAIN_CONFIG.SIGN.LOCAL_OFFSET.X,
                    sign_spawn_y + this.CHAIN_CONFIG.SIGN.LOCAL_OFFSET.Y,
                    this.CHAIN_CONFIG.POSITION.Z + this.CHAIN_CONFIG.SIGN.LOCAL_OFFSET.Z
                )
                .setRotation({
                    x: 0,
                    y: Math.sin(halfAngle),
                    z: 0,
                    w: Math.cos(halfAngle)
                })
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
            this.world.createCollider(sign_collider, sign_body);
            
            // Connect sign to last chain segment
            const finalJointDesc = RAPIER.JointData.spherical(
                {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0},
                {x: 0, y: this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, z: 0}
            );
            this.world.createImpulseJoint(
                finalJointDesc,
                previous_body,
                sign_body,
                true
            );
            const asset_loader = AssetManager.get_instance();
            asset_loader.add_object(sign_mesh, sign_body);
        };
        sign_image.src = this.CHAIN_CONFIG.SIGN.IMAGE_PATH;
        this.last_log_time = 0;
        this.log_interval = 500;
    }

    break_chains() {
        if (!this.chains_broken) {
            // Remove all joints
            this.chain_joints.forEach(joint => {
                this.world.removeImpulseJoint(joint);
            });
            this.chain_joints = [];

            // Find and update all chain segments and sign in dynamic_bodies
            if (this.parent.children) {
                // Handle chain segments
                const chain_links = this.parent.children.filter(child => 
                    child.geometry instanceof THREE.CylinderGeometry
                );
                chain_links.forEach((link, index) => {
                    // Find corresponding rigid body
                    const bodyPair = this.dynamic_bodies.find(([mesh]) => mesh === link);
                    if (bodyPair) {
                        const [_, body] = bodyPair;
                        body.setGravityScale(this.CHAIN_CONFIG.SEGMENTS.GRAVITY_SCALE);
                    }
                });

                // Handle sign
                const sign = this.parent.children.find(child => 
                    child.name === `${TYPES.INTERACTABLE}${NAMES.SECONDARY}`
                );
                if (sign) {
                    const signBodyPair = this.dynamic_bodies.find(([mesh]) => mesh === sign);
                    if (signBodyPair) {
                        const [_, body] = signBodyPair;
                        body.setGravityScale(this.CHAIN_CONFIG.SIGN.GRAVITY_SCALE);
                    }
                }
            }

            this.chains_broken = true;
        }
    }

    update() {
        const currentTime = performance.now();
        
        // Update sign rotation based on camera angles
        if (this.parent.children) {
            const sign = this.parent.children.find(child => 
                child.name === `${TYPES.INTERACTABLE}${NAMES.SECONDARY}`
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
        
        // Log positions periodically
        if (currentTime - this.last_log_time > this.log_interval) {
            if(FLAGS.PHYSICS_LOGS) {
                console.log('=== Position Update (Scroll Menu) ===');
                // Log chain segment positions if they exist
                if (this.parent.children) {
                    const chainLinks = this.parent.children.filter(child => 
                        child.geometry instanceof THREE.CylinderGeometry
                    );
                    chainLinks.forEach((link, index) => {
                        const linkPos = link.position;
                        console.log(`Chain Link ${index} - Position: (${linkPos.x.toFixed(2)}, ${linkPos.y.toFixed(2)}, ${linkPos.z.toFixed(2)})`);
                    });
                }
                // Log sign position if it exists
                const sign = this.parent.children.find(child => 
                    child.name === `${TYPES.INTERACTABLE}${NAMES.SECONDARY}`
                );
                if (sign) {
                    const signPos = sign.position;
                    console.log(`Sign - Position: (${signPos.x.toFixed(2)}, ${signPos.y.toFixed(2)}, ${signPos.z.toFixed(2)})`);
                }
            }
            this.last_log_time = currentTime;
        }
    }
}