import * as THREE from 'three';
import { TYPES } from '../viewport/overlay/common';

export class ScrollMenu {
    parent;
    camera;
    world;

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
            DAMPING: 1.0
        },
        SIGN: {
            LOCAL_OFFSET: {
                X: 0,    // Centered with chain
                Y: 2,    // No vertical offset
                Z: 0     // No depth offset
            },
            DIMENSIONS: {
                WIDTH: 2,
                HEIGHT: 2,
                DEPTH: 0.01
            },
            DAMPING: 0.7,
            IMAGE_PATH: 'images/ScrollControlMenu.svg'
        }
    };

    constructor(incoming_parent, incoming_camera, incoming_world, primary_container, incoming_RAPIER) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.RAPIER = incoming_RAPIER;
        // Chain configuration constants
        this.CHAIN_CONFIG.POSITION.Z = this.camera.position.z - 10;
        // Create anchor point
        const anchor_body = this.world.createRigidBody(
            this.RAPIER.RigidBodyDesc.fixed()
            .setTranslation(
                this.CHAIN_CONFIG.POSITION.X,
                this.CHAIN_CONFIG.POSITION.Y,
                this.CHAIN_CONFIG.POSITION.Z
            )
        );
        // Create chain segments with visible links
        const segments = [];
        for(let i = 0; i < this.CHAIN_CONFIG.SEGMENTS.COUNT; i++) {
            const segment_body = this.world.createRigidBody(
                this.RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(
                    this.CHAIN_CONFIG.POSITION.X,
                    this.CHAIN_CONFIG.POSITION.Y - (i * this.CHAIN_CONFIG.SEGMENTS.LENGTH),
                    this.CHAIN_CONFIG.POSITION.Z
                )
                .setLinearDamping(this.CHAIN_CONFIG.SEGMENTS.DAMPING)
                .setAngularDamping(this.CHAIN_CONFIG.SEGMENTS.DAMPING)
            );
            const collider = this.RAPIER.ColliderDesc.ball(this.CHAIN_CONFIG.SEGMENTS.RADIUS);
            this.world.createCollider(collider, segment_body);
            segments.push(segment_body);

            // Create visible chain link
            const link_geometry = new THREE.CylinderGeometry(
                this.CHAIN_CONFIG.SEGMENTS.RADIUS,
                this.CHAIN_CONFIG.SEGMENTS.RADIUS,
                this.CHAIN_CONFIG.SEGMENTS.LENGTH * 0.8,
                8
            );
            const link_material = new THREE.MeshStandardMaterial({ color: 0x888888 });
            const link_mesh = new THREE.Mesh(link_geometry, link_material);
            link_mesh.rotation.x = Math.PI / 2;
            this.parent.add(link_mesh);
            primary_container.dynamic_bodies.push([link_mesh, segment_body]);
            // Create spherical joint between segments
            if (i > 0) {
                const joint_desc = this.RAPIER.JointData.spherical(
                    {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0},
                    {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0}
                );
                this.world.createImpulseJoint(
                    joint_desc,
                    segments[i-1],
                    segment_body,
                    true
                );
            } else {
                // Connect first segment to anchor
                const joint_desc = this.RAPIER.JointData.spherical(
                    {x: 0, y: 0, z: 0},
                    {x: 0, y: this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0}
                );
                this.world.createImpulseJoint(
                    joint_desc,
                    anchor_body,
                    segment_body,
                    true
                );
            }
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
            const sign_spawn_y = this.CHAIN_CONFIG.POSITION.Y - 
                (this.CHAIN_CONFIG.SEGMENTS.COUNT * this.CHAIN_CONFIG.SEGMENTS.LENGTH);
            const sign_body = this.world.createRigidBody(
                this.RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(
                    this.CHAIN_CONFIG.POSITION.X + this.CHAIN_CONFIG.SIGN.LOCAL_OFFSET.X,
                    sign_spawn_y + this.CHAIN_CONFIG.SIGN.LOCAL_OFFSET.Y,
                    this.CHAIN_CONFIG.POSITION.Z + this.CHAIN_CONFIG.SIGN.LOCAL_OFFSET.Z
                )
                .setLinearDamping(this.CHAIN_CONFIG.SIGN.DAMPING)
                .setAngularDamping(this.CHAIN_CONFIG.SIGN.DAMPING)
            );
            const sign_collider = this.RAPIER.ColliderDesc.cuboid(
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH/2,
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2,
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH/2
            );
            this.world.createCollider(sign_collider, sign_body);
            const sign_geometry = new THREE.BoxGeometry(
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH,
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT,
                this.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH
            );
            const sign_mesh = new THREE.Mesh(sign_geometry, sign_material);
            sign_mesh.castShadow = true;
            sign_mesh.name = `${TYPES.SIGN}${TYPES.SECONDARY}`;
            this.parent.add(sign_mesh);
            // Connect sign to last chain segment
            const finalJointDesc = this.RAPIER.JointData.spherical(
                {x: 0, y: -this.CHAIN_CONFIG.SEGMENTS.LENGTH/2, z: 0},
                {x: 0, y: this.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2, z: 0}
            );
            this.world.createImpulseJoint(
                finalJointDesc,
                segments[segments.length - 1],
                sign_body,
                true
            );
            primary_container.dynamic_bodies.push([sign_mesh, sign_body]);
        };
        sign_image.src = this.CHAIN_CONFIG.SIGN.IMAGE_PATH;
    }
}