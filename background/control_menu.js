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
// Position of the entire assembly relative to camera
export const ASSEMBLY_POSITION = {
    X_OFFSET: 10,      // How far right of camera
    Y_OFFSET: 8,     // How high up from camera
    Z_OFFSET: -15     // How far in front of camera
};
// Chain configuration
export const CHAIN_CONFIG = {
    SPREAD: 5,        // How far apart the chains are (half of beam width)
    LENGTH: 0.5       // Minimum length to avoid clipping
};
// Anchor points for joints (shouldn't need to change these)
export const JOINT_ANCHORS = {
    BEAM: {
        LEFT: { x: -CHAIN_CONFIG.SPREAD, y: 0, z: 0 },
        RIGHT: { x: CHAIN_CONFIG.SPREAD, y: 0, z: 0 }
    },
    CHAIN: {
        TOP: { x: 0, y: 1, z: 0 },
        BOTTOM: { x: 0, y: -1, z: 0 }
    },
    SIGN: {
        LEFT: { x: -CHAIN_CONFIG.SPREAD, y: SIGN_DIMENSIONS.HEIGHT/2, z: 0 },
        RIGHT: { x: CHAIN_CONFIG.SPREAD, y: SIGN_DIMENSIONS.HEIGHT/2, z: 0 }
    }
};

// Physics configuration for the sign
export const SIGN_PHYSICS = {
    LINEAR_DAMPING: 1.0,      // Resistance to movement through space
    ANGULAR_DAMPING: 0.8,     // Resistance to rotation
    INITIAL_VELOCITY: {       // Starting velocities
        LINEAR: { x: 0, y: 0, z: -5 },  // Negative y = downward force
        ANGULAR: { x: 0, y: 0, z: 0 }
    },
    USE_CCD: true            // Enable Continuous Collision Detection
};

export class ControlMenu {
    parent;
    camera;
    world;
    // Beam variables
    beam_geometry;
    beam_material;
    beam_mesh;
    beam_body;
    beam_shape;
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
    left_lower_joint;
    left_upper_joint;
    right_lower_joint;
    right_upper_joint;

    constructor(incoming_parent, incoming_camera, incoming_world, primary_container, RAPIER) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        // TODO OOOOO
        // TODO Create a Rigid object in Rapier but fixed() not dynamic()
        //          Will serve as cross beam to hold up sign
        // TODO Once crossbeam exists create joints using rapier to attach the two
        // TODO Then make cross beam invisible
        this.beam_geometry = new THREE.BoxGeometry(
            BEAM_DIMENSIONS.WIDTH, 
            BEAM_DIMENSIONS.HEIGHT, 
            BEAM_DIMENSIONS.DEPTH
        );
        this.beam_material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        this.beam_mesh = new THREE.Mesh(this.beam_geometry, this.beam_material);
        this.parent.add(this.beam_mesh);
        this.beam_body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
            .setTranslation(
                this.camera.position.x + ASSEMBLY_POSITION.X_OFFSET,
                this.camera.position.y + ASSEMBLY_POSITION.Y_OFFSET,
                this.camera.position.z + ASSEMBLY_POSITION.Z_OFFSET
            )
            .setCanSleep(false)
        );
        this.beam_shape = RAPIER.ColliderDesc.cuboid(20, 1.5, 1.5);
        this.world.createCollider(this.beam_shape, this.beam_body);
        primary_container.dynamic_bodies.push([this.beam_mesh, this.beam_body]);
        // Create an SVG image element
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
                    this.camera.position.x + ASSEMBLY_POSITION.X_OFFSET,
                    this.beam_mesh.position.y - (CHAIN_CONFIG.LENGTH + SIGN_DIMENSIONS.HEIGHT/2),
                    this.beam_mesh.position.z
                )
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
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(
                    this.beam_mesh.position.x - CHAIN_CONFIG.SPREAD,
                    this.beam_mesh.position.y - CHAIN_CONFIG.LENGTH,
                    this.beam_mesh.position.z
                )
                .setLinearDamping(0.8)
                .setAngularDamping(0.8)
            );
            this.right_chain = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(
                    this.beam_mesh.position.x + CHAIN_CONFIG.SPREAD,
                    this.beam_mesh.position.y - CHAIN_CONFIG.LENGTH,
                    this.beam_mesh.position.z
                )
                .setLinearDamping(0.8)
                .setAngularDamping(0.8)
            );

            // Create joints from beam to chain pieces
            this.left_upper_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.BEAM.LEFT,
                JOINT_ANCHORS.CHAIN.TOP
            );
            this.world.createImpulseJoint(this.left_upper_joint, this.beam_body, this.left_chain, true);

            this.right_upper_joint = RAPIER.JointData.spherical(
                JOINT_ANCHORS.BEAM.RIGHT,
                JOINT_ANCHORS.CHAIN.TOP
            );
            this.world.createImpulseJoint(this.right_upper_joint, this.beam_body, this.right_chain, true);

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

            primary_container.dynamic_bodies.push([this.sign_mesh, this.sign_body]);
        };
        this.sign_image.src = IMAGE_PATH;
    }

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