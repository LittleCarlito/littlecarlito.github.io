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
// Chain configuration
export const CHAIN_CONFIG = {
    SPREAD: 5,
    LENGTH: 0.5
};
// Anchor points for joints
export const JOINT_ANCHORS = {
    BEAM: {
        LEFT: { x: -CHAIN_CONFIG.SPREAD, y: 0, z: 0 },
        RIGHT: { x: CHAIN_CONFIG.SPREAD, y: 0, z: 0 },
        BOTTOM: { x: 0, y: 0, z: 0 }
    },
    CHAIN: {
        TOP: { x: 0, y: 1, z: 0 },
        BOTTOM: { x: 0, y: -1, z: 0 }
    },
    SIGN: {
        LEFT: { x: -CHAIN_CONFIG.SPREAD, y: SIGN_DIMENSIONS.HEIGHT/2, z: 0 },
        RIGHT: { x: CHAIN_CONFIG.SPREAD, y: SIGN_DIMENSIONS.HEIGHT/2, z: 0 },
        BOTTOM: { x: 0, y: -SIGN_DIMENSIONS.HEIGHT/2, z: 0 }
    }
};

// Physics configuration for the sign
export const SIGN_PHYSICS = {
    LINEAR_DAMPING: 400,
    ANGULAR_DAMPING: 400,
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

    constructor(incoming_parent, incoming_camera, incoming_world, primary_container, RAPIER, incoming_speed = 30) {
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
            // transparent: true,
            // opacity: 0
        });
        this.top_beam_mesh = new THREE.Mesh(this.top_beam_geometry, this.top_beam_material);
        this.parent.add(this.top_beam_mesh);
        this.top_beam_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc
            .kinematicVelocityBased()
            .setTranslation(
                this.assembly_position.x,
                this.assembly_position.y,
                this.assembly_position.z
            )
            .setLinvel(0, 0, incoming_speed)
            .setCanSleep(false)
        );
        this.top_beam_shape = RAPIER.ColliderDesc.cuboid(20, 1.5, 1.5);
        this.world.createCollider(this.top_beam_shape, this.top_beam_body);
        primary_container.dynamic_bodies.push([this.top_beam_mesh, this.top_beam_body]);
        // Bottom beam creation
        this.bottom_beam_geometry = new THREE.BoxGeometry(
            BEAM_DIMENSIONS.WIDTH, 
            BEAM_DIMENSIONS.HEIGHT, 
            BEAM_DIMENSIONS.DEPTH
        );
        this.bottom_beam_material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            // transparent: true,
            // opacity: 0
        });
        this.bottom_beam_mesh = new THREE.Mesh(this.bottom_beam_geometry, this.bottom_beam_material);
        this.parent.add(this.bottom_beam_mesh);
        this.bottom_beam_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc
            .kinematicVelocityBased()
            .setTranslation(
                this.assembly_position.x,
                this.assembly_position.y - (SIGN_DIMENSIONS.HEIGHT + 1),
                this.assembly_position.z
            )
            .setLinvel(0, 0, incoming_speed)
            .setCanSleep(false)
        );
        this.bottom_beam_shape = RAPIER.ColliderDesc.cuboid(20, 1.5, 1.5);
        this.world.createCollider(this.bottom_beam_shape, this.bottom_beam_body);
        primary_container.dynamic_bodies.push([this.bottom_beam_mesh, this.bottom_beam_body]);
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
                    this.top_beam_mesh.position.y - (CHAIN_CONFIG.LENGTH + SIGN_DIMENSIONS.HEIGHT/2),
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
            this.sign_shape = RAPIER.ColliderDesc.cuboid(5, 5, 0.005);
            this.world.createCollider(this.sign_shape, this.sign_body);
            // Create intermediate objects for the chain
            this.left_chain = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.kinematicVelocityBased()
                .setTranslation(
                    this.top_beam_mesh.position.x - CHAIN_CONFIG.SPREAD,
                    this.top_beam_mesh.position.y - CHAIN_CONFIG.LENGTH,
                    this.top_beam_mesh.position.z
                )
                .setLinvel(0, 0, incoming_speed)
                .setLinearDamping(SIGN_PHYSICS.LINEAR_DAMPING)    // Moderate damping
                .setAngularDamping(SIGN_PHYSICS.ANGULAR_DAMPING)   // Slightly higher angular damping to reduce spinning
            );
            this.right_chain = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.kinematicVelocityBased()
                .setTranslation(
                    this.top_beam_mesh.position.x + CHAIN_CONFIG.SPREAD,
                    this.top_beam_mesh.position.y - CHAIN_CONFIG.LENGTH,
                    this.top_beam_mesh.position.z
                )
                .setLinvel(0, 0, incoming_speed)
                .setLinearDamping(SIGN_PHYSICS.LINEAR_DAMPING)    // Moderate damping
                .setAngularDamping(SIGN_PHYSICS.ANGULAR_DAMPING)   // Slightly higher angular damping to reduce spinning
            );
            this.bottom_chain = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.kinematicVelocityBased()
                .setTranslation(
                    this.bottom_beam_mesh.position.x,
                    this.bottom_beam_mesh.position.y + CHAIN_CONFIG.LENGTH,
                    this.bottom_beam_mesh.position.z
                )
                .setLinvel(0, 0, incoming_speed)
                .setLinearDamping(SIGN_PHYSICS.LINEAR_DAMPING)
                .setAngularDamping(SIGN_PHYSICS.ANGULAR_DAMPING)
            );
            // TODO OOOOO
            // TODO Attach bottom chain to bottom beam and bottom of sign

            // Create joints from beam to chain pieces
            this.left_upper_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.BEAM.LEFT,
                JOINT_ANCHORS.CHAIN.TOP
            );
            this.world.createImpulseJoint(this.left_upper_joint, this.top_beam_body, this.left_chain, true);
            this.right_upper_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.BEAM.RIGHT,
                JOINT_ANCHORS.CHAIN.TOP
            );
            this.world.createImpulseJoint(this.right_upper_joint, this.top_beam_body, this.right_chain, true);
            this.bottom_upper_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.BEAM.BOTTOM,
                JOINT_ANCHORS.CHAIN.BOTTOM
            );
            this.world.createImpulseJoint(this.bottom_upper_joint, this.bottom_beam_body, this.bottom_chain, true);
            // Create joints from chain pieces to sign
            this.left_lower_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.CHAIN.BOTTOM,
                JOINT_ANCHORS.SIGN.LEFT
            );
            this.world.createImpulseJoint(this.left_lower_joint, this.left_chain, this.sign_body, true);
            this.right_lower_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.CHAIN.BOTTOM,
                JOINT_ANCHORS.SIGN.RIGHT
            );
            this.world.createImpulseJoint(this.right_lower_joint, this.right_chain, this.sign_body, true);
            this.bottom_lower_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.CHAIN.TOP,
                JOINT_ANCHORS.SIGN.BOTTOM
            );
            this.world.createImpulseJoint(this.bottom_lower_joint, this.bottom_chain, this.sign_body, true);
            primary_container.dynamic_bodies.push([this.sign_mesh, this.sign_body]);
        };
        this.sign_image.src = IMAGE_PATH;
    }

    // TODO Refactor break chains methods to be
    //          Break top chains
    //          Break bottom chains
    //          Break chains
    //              Calls both methods above
    break_chains() {
        try {
            // Remove all joints first
            if(this.left_upper_joint) {
                this.world.removeImpulseJoint(this.left_upper_joint);
                this.left_upper_joint = null;
            }
            if(this.right_upper_joint) {
                this.world.removeImpulseJoint(this.right_upper_joint);
                this.right_upper_joint = null;
            }
            if(this.left_lower_joint) {
                this.world.removeImpulseJoint(this.left_lower_joint);
                this.left_lower_joint = null;
            }
            if(this.right_lower_joint) {
                this.world.removeImpulseJoint(this.right_lower_joint);
                this.right_lower_joint = null;
            }

            // Remove the chain rigid bodies
            if(this.left_chain) {
                this.world.removeRigidBody(this.left_chain);
                this.left_chain = null;
            }
            if(this.right_chain) {
                this.world.removeRigidBody(this.right_chain);
                this.right_chain = null;
            }
        } catch(e) {
            console.warn("Error during chain cleanup:", e);
        }
    }
}