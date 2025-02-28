import { TitleBlock } from './title_block';
import { TextContainer } from './text_container';
import { LabelContainer } from './label_container';
import { LinkContainer } from './link_container';
import { HideButton } from './hide_button';
import { Easing, FLAGS, THREE, Tween } from '../../common';
import { ArtistBlock } from './artist_block';
import { CATEGORIES } from './overlay_common';

// Confetti constants
const PARTICLE_COUNT = 200;
const COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
const PARTICLE_SIZE = 0.05;
const GRAVITY = 0.004;
const DRAG = 0.995;

// For a fountain effect:
const LEFT_BURST_ANGLE = -80;
const RIGHT_BURST_ANGLE = -100; 
const SPREAD_ANGLE = 45;        // How much the particles can spread from the base angle

// For a v-shaped burst:
// const LEFT_BURST_ANGLE = -45;
// const RIGHT_BURST_ANGLE = -135;

// For a horizontal spray:
// const LEFT_BURST_ANGLE = 0;
// const RIGHT_BURST_ANGLE = 180; 

export class OverlayContainer {
    overlay_container;
    title_block;
    text_box_container;
    label_container;
    link_container;
    hide_button;
    hide_transition_map = new Map();
    party_popped = false;
    particles = [];
    // Set this to true when hide is clicked the first time
    primary_control_trigger = false;
    // Set this to true when the first object is grabbed, camera is frist moved, or first object is pushed
    secondary_control_trigger = false;
    artist_block;
    
    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        // Overlay creation
        this.overlay_container = new THREE.Object3D();
        // Make sure all children also render last so they're on top
        this.overlay_container.renderOrder = 999;
        this.overlay_container.traverse((child) => {
            child.renderOrder = 999;
        });

        this.title_block = new TitleBlock(this.overlay_container, this.camera);
        this.text_box_container = new TextContainer(this.overlay_container, this.camera);
        this.label_container = new LabelContainer(this.overlay_container, this.camera);
        this.link_container = new LinkContainer(this.overlay_container, this.camera);
        this.artist_block = new ArtistBlock(this.overlay_container, this.camera);
        this.hide_button = new HideButton(this.overlay_container, this.camera);
        this.overlay_container.position.z = this.camera.position.z - 15;
        this.parent.add(this.overlay_container);
    }

    create_confetti_burst() {
        if(FLAGS.PHYSICS_LOGS) {
            const cam_pos = this.camera.position;
            const overlay_pos = this.overlay_container.position;
            console.log(`Camera Position: (${cam_pos.x.toFixed(2)}, ${cam_pos.y.toFixed(2)}, ${cam_pos.z.toFixed(2)})`);
            console.log(`Overlay Position: (${overlay_pos.x.toFixed(2)}, ${overlay_pos.y.toFixed(2)}, ${overlay_pos.z.toFixed(2)})`);
        }
        // Calculate burst position in front of camera (similar to overlay positioning)
        const forward = new THREE.Vector3(0, 0, -3);
        forward.applyQuaternion(this.camera.quaternion);
        const burst_position = this.camera.position.clone().add(forward);
        if(FLAGS.PHYSICS_LOGS) {
            console.log(`Burst Position: (${burst_position.x.toFixed(2)}, ${burst_position.y.toFixed(2)}, ${burst_position.z.toFixed(2)})`);
        }
        // Convert angles to radians
        const burst_angles = [
            LEFT_BURST_ANGLE * Math.PI / 180,
            RIGHT_BURST_ANGLE * Math.PI / 180
        ];
        // Create two fountain bursts
        burst_angles.forEach((base_angle, index) => {
            const xOffset = index === 0 ? -1 : 1;  // Offset the bursts slightly left and right
            for (let i = 0; i < PARTICLE_COUNT / 2; i++) {
                const geometry = new THREE.PlaneGeometry(PARTICLE_SIZE, PARTICLE_SIZE);
                const material = new THREE.MeshBasicMaterial({
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    side: THREE.DoubleSide,
                    depthTest: false,
                    transparent: true,
                    opacity: 1
                });
                const particle = new THREE.Mesh(geometry, material);
                // Position particle with slight offset
                const offset_position = burst_position.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 0.2 - xOffset * 0.5,
                        (Math.random() - 0.5) * 0.2,
                        (Math.random() - 0.5) * 0.2
                    )
                );
                particle.position.copy(offset_position);
                this.parent.add(particle);
                particle.renderOrder = 999;
                // Calculate spread from base angle
                const spread = (Math.random() - 0.5) * SPREAD_ANGLE * Math.PI / 180;
                const angle = base_angle + spread;
                // Create velocity relative to camera orientation
                const direction = new THREE.Vector3();
                const camera_right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                const camera_up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
                direction.addScaledVector(camera_right, Math.cos(angle));
                direction.addScaledVector(camera_up, Math.sin(angle));
                const speed = 0.08 + Math.random() * 0.12;
                const upward_force = 0.15 + Math.random() * 0.1;
                particle.velocity = new THREE.Vector3(
                    direction.x * speed,
                    direction.y * speed + upward_force,
                    direction.z * speed
                );
                // Orient particle to face camera
                particle.lookAt(this.camera.position);
                particle.rotation.z = Math.random() * Math.PI * 2;
                particle.rotationSpeed = (Math.random() - 0.5) * 0.2;
                this.particles.push(particle);
                new Tween(particle.material)
                    .to({ opacity: 0 }, 2000)
                    .easing(Easing.Quadratic.Out)
                    .start()
                    .onComplete(() => {
                        this.parent.remove(particle);
                        particle.geometry.dispose();
                        particle.material.dispose();
                        const index = this.particles.indexOf(particle);
                        if (index > -1) {
                            this.particles.splice(index, 1);
                        }
                    });
            }
        });
    }

    update_confetti() {
        if (this.particles.length > 0 && FLAGS.PHYSICS_LOGS) {
            // Only log first particle every 10 frames to reduce spam
            if (Math.random() < 0.1) {
                const particle = this.particles[0];
                console.log(`First Particle - Position: (${particle.position.x.toFixed(2)}, ${particle.position.y.toFixed(2)}, ${particle.position.z.toFixed(2)}), Velocity: (${particle.velocity.x.toFixed(3)}, ${particle.velocity.y.toFixed(3)}, ${particle.velocity.z.toFixed(3)})`);
            }
        }
        for (const particle of this.particles) {
            // Convert velocity to local space for gravity
            const local_velocity = particle.velocity.clone();
            local_velocity.applyQuaternion(this.overlay_container.quaternion.clone().invert());
            // Apply gravity in local space
            local_velocity.y -= GRAVITY;
            local_velocity.multiplyScalar(DRAG);
            // Convert back to world space
            particle.velocity.copy(local_velocity);
            particle.velocity.applyQuaternion(this.overlay_container.quaternion);
            particle.position.add(particle.velocity);
            particle.rotation.z += particle.rotationSpeed;
        }
    }

    trigger_overlay() {
        if(FLAGS.TWEEN_LOGS) {
            console.log(`OverlayContainer - Triggering overlay animation:
                Current Map Size: ${this.hide_transition_map.size}
                Current Position: (${this.overlay_container.position.x.toFixed(2)}, ${this.overlay_container.position.y.toFixed(2)}, ${this.overlay_container.position.z.toFixed(2)})`);
        }
        if(this.hide_transition_map.size == 0) {
            this.hide_button.swap_hide_status();
            if(FLAGS.TWEEN_LOGS) {
                console.log(`OverlayContainer - Starting animations:
                    Is overlay hidden: ${this.hide_button.is_overlay_hidden}
                    Active tweens before: ${this.hide_transition_map.size}`);
            }
            // Move overlay objects
            this.title_block.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map);
            this.label_container.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map);
            this.link_container.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map);
            this.artist_block.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map);
            // Set the control menu to appear in animate
            if(this.primary_control_trigger && !this.secondary_control_trigger && this.hide_button.is_overlay_hidden) {
                this.secondary_control_trigger = true;
            }
            this.primary_control_trigger = true;
            if(FLAGS.TWEEN_LOGS) {
                console.log(`OverlayContainer - Animations started:
                    Active tweens after: ${this.hide_transition_map.size}`);
            }
        } else {
            if(FLAGS.TWEEN_LOGS) {
                console.log(`OverlayContainer - Animation skipped:
                    Current active tweens: ${this.hide_transition_map.size}
                    Active tween names: ${Array.from(this.hide_transition_map.keys()).join(', ')}`);
            }
        }
    }

    swap_column_sides() {
        this.label_container.swap_sides();
        this.hide_button.swap_sides(this.label_container.is_column_left);
    }

    /**
     * Resize and repositions the overlay
     * FOR USE WHEN ONSCREEN ONLY
     */
    resize_reposition() {
        this.text_box_container.resize();
        this.text_box_container.reposition(this.label_container.is_column_left);
        this.label_container.reposition();
        this.link_container.reposition();
        this.title_block.resize();
        this.title_block.reposition();
        this.hide_button.reposition(this.label_container.is_column_left);
        this.artist_block.resize();
        this.artist_block.reposition();
    }

    /**
     * Resize and repositions the overlay
     * FOR USE WHEN OFFSCREEN ONLY
     */
    resize_reposition_offscreen() {
        this.text_box_container.resize();
        this.text_box_container.offscreen_reposition();
        this.label_container.offscreen_reposition();
        this.link_container.offscreen_reposition();
        this.title_block.resize();
        this.title_block.offscreen_reposition();
        this.artist_block.resize();
    }

    handle_hover(intersected_object) {
        this.label_container.handle_hover(intersected_object);
    }

    reset_hover() {
        this.label_container.reset_previous_intersected();
    }

    focus_text_box(incoming_name) {
        const simple_name = incoming_name.split('_')[1];
        if(simple_name == CATEGORIES.EDUCATION.value && !this.party_popped) {
            // Create a dummy object for the delay tween
            const dummy = { value: 0 };
            new Tween(dummy)
                .to({ value: 1 }, 200) // Match the text box tween duration
                .easing(Easing.Sinusoidal.Out)
                .start()
                .onComplete(() => {
                    this.create_confetti_burst();
                });
            this.party_popped = true;
        }
        this.text_box_container.focus_text_box(simple_name, this.label_container.is_column_left);
    }

    lose_focus_text_box(incoming_direction) {
        this.text_box_container.lose_focus_text_box(incoming_direction);
    }

    open_link(incoming_name) {
        this.link_container.open_link(incoming_name);
    }

    // Overlay getters
    is_label_container_left_side() {
        return this.label_container.is_column_left;
    }

    is_intersected() {
        return this.label_container.current_intersected;
    }

    intersected_name() {
        return this.label_container.current_intersected.name;
    }

    is_swapping_sides() {
        return this.label_container.swapping_column_sides;
    }

    is_text_active() {
        return this.text_box_container.is_text_box_active();
    }

    get_active_box() {
        if(this.is_text_active()) {
            return this.text_box_container.get_active_text_box();
        }
    }
}