import * as THREE from 'three';
import { TYPES } from '../viewport/overlay/common';

export const IMAGE_PATH = 'images/MouseControlMenu.svg';
// Sign and beam constants
export const BEAM_DIMENSIONS = {
    WIDTH: 10,
    HEIGHT: 0.5,
    DEPTH: 0.2
};
export const SIGN_DIMENSIONS = {
    WIDTH: 10,
    HEIGHT: 10,
    DEPTH: 0.01
};
// Distance between sign and beam
export const SIGN_SPACING = 1.5;
// Chain configuration
export const CHAIN_CONFIG = {
    SPREAD: 5,
    LENGTH: 1
};
// Anchor points for joints
export const JOINT_ANCHORS = {
    BEAM: {
        LEFT: { x: -CHAIN_CONFIG.SPREAD, y: 0, z: 0 },
        RIGHT: { x: CHAIN_CONFIG.SPREAD, y: 0, z: 0 },
        BOTTOM: { x: 0, y: -BEAM_DIMENSIONS.HEIGHT/2, z: 0 }
    },
    CHAIN: {
        TOP: { x: 0, y: 1, z: 0 },
        BOTTOM: { x: 0, y: -1, z: 0 }
    },
    SIGN: {
        LEFT: { x: -CHAIN_CONFIG.SPREAD, y: SIGN_DIMENSIONS.HEIGHT/2, z: 0 },
        RIGHT: { x: CHAIN_CONFIG.SPREAD, y: SIGN_DIMENSIONS.HEIGHT/2, z: 0 },
        BOTTOM: { x: 0, y: -SIGN_DIMENSIONS.HEIGHT/2, z: 0 },
        TOP: { x: 0, y: SIGN_DIMENSIONS.HEIGHT/2, z: 0 }
    }
};

// Physics configuration for the sign
export const SIGN_PHYSICS = {
    LINEAR_DAMPING: 1,
    ANGULAR_DAMPING: 1,
    MASS: 50,
    RESTITUTION: 1.1,
    INITIAL_VELOCITY: {
        LINEAR: { x: 0, y: 0, z: -5 },
        ANGULAR: { x: 0, y: 0, z: 0 }
    },
    USE_CCD: true            // Enable Continuous Collision Detection
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
    // Bottom beam variables
    bottom_beam_geometry;
    bottom_beam_material;
    bottom_beam_mesh;
    bottom_beam_body;
    bottom_beam_shape;
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
    // Chains
    left_chain;
    right_chain;
    bottom_chain;
    left_lower_joint;
    left_upper_joint;
    right_lower_joint;
    right_upper_joint;
    bottom_lower_joint;
    bottom_uppwer_join;
    // Assembly position
    assembly_position;
    sign_joint;

    constructor(incoming_parent, incoming_camera, incoming_world, primary_container, RAPIER, incoming_speed = 15) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        
        // Calculate assembly position based on camera
        this.assembly_position = {
            x: this.camera.position.x + 10,
            y: this.camera.position.y + 8,
            z: this.camera.position.z - 50
        };
        // Top beam creation
        this.top_beam_geometry = new THREE.BoxGeometry(
            BEAM_DIMENSIONS.WIDTH, 
            BEAM_DIMENSIONS.HEIGHT, 
            BEAM_DIMENSIONS.DEPTH
        );
        this.top_beam_material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        this.top_beam_mesh = new THREE.Mesh(this.top_beam_geometry, this.top_beam_material);
        this.parent.add(this.top_beam_mesh);
        this.top_beam_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(
                this.assembly_position.x,
                this.assembly_position.y,
                this.assembly_position.z
            )
            .setLinvel(0, 0, incoming_speed)
            .setGravityScale(0)
            .setCanSleep(false)
        );
        this.top_beam_shape = RAPIER.ColliderDesc.cuboid(20, 1.5, 1.5).setMass(0).setRestitution(1.1);
        this.world.createCollider(this.top_beam_shape, this.top_beam_body);
        primary_container.dynamic_bodies.push([this.top_beam_mesh, this.top_beam_body]);
        // Sign creation
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
                side: THREE.DoubleSide
            });
            // Create test object
            this.sign_geometry = new THREE.BoxGeometry(
                SIGN_DIMENSIONS.WIDTH, 
                SIGN_DIMENSIONS.HEIGHT, 
                SIGN_DIMENSIONS.DEPTH
            );
            this.sign_mesh = new THREE.Mesh(this.sign_geometry, this.sign_material);
            this.sign_mesh.castShadow = true;
            this.sign_mesh.name = `${TYPES.SIGN}${TYPES.PRIMARY}`;
            this.parent.add(this.sign_mesh);
            // Create test physics object
            this.sign_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc
                .dynamic()
                .setTranslation(
                    this.assembly_position.x,
                    this.top_beam_mesh.position.y - (SIGN_SPACING + SIGN_DIMENSIONS.HEIGHT/2),
                    this.top_beam_mesh.position.z
                )
                .setLinvel(0, 0, 0)
                .setLinearDamping(SIGN_PHYSICS.LINEAR_DAMPING)
                .setAngularDamping(SIGN_PHYSICS.ANGULAR_DAMPING)
                .setCcdEnabled(SIGN_PHYSICS.USE_CCD)
                .setCanSleep(false)
            );
            // Apply initial velocities
            this.sign_body.setLinvel(SIGN_PHYSICS.INITIAL_VELOCITY.LINEAR, true);
            this.sign_body.setAngvel(SIGN_PHYSICS.INITIAL_VELOCITY.ANGULAR, true);
            this.sign_shape = RAPIER.ColliderDesc.cuboid(5, 5, 0.005).setMass(SIGN_PHYSICS.MASS).setRestitution(SIGN_PHYSICS.RESTITUTION);
            this.world.createCollider(this.sign_shape, this.sign_body);

            // Connect bottom of beam to top of sign with proper spacing
            const sign_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.BEAM.BOTTOM,  // Anchor point on the beam
                {                           // Updated anchor point for the sign
                    x: JOINT_ANCHORS.SIGN.TOP.x,
                    y: JOINT_ANCHORS.SIGN.TOP.y + SIGN_SPACING,  // Add spacing to the Y coordinate
                    z: JOINT_ANCHORS.SIGN.TOP.z
                }
            );
            this.sign_joint = this.world.createImpulseJoint(
                sign_joint, 
                this.top_beam_body, 
                this.sign_body, 
                true
            );

            primary_container.dynamic_bodies.push([this.sign_mesh, this.sign_body]);
        };
        this.sign_image.src = IMAGE_PATH;
    }

    break_chains() {
        if (this.sign_joint) {
            this.world.removeImpulseJoint(this.sign_joint);
            this.sign_joint = null;
        }
    }
}