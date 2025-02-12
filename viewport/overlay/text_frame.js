import { CSS2DObject } from "three/examples/jsm/Addons.js";
import { CATEGORIES } from "./common/categories.js";
import * as THREE from 'three';
import { Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';
import { FLAGS } from "../../common/flags.js";

const WIDTH_OFFSET = .5;
const HEIGHT_OFFSET = .5;
const PLACEHOLDER_PATH = '/pages/placeholder.html';
export const IFRAME = "iframe_";
export const DIV = "div_"

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


export class TextFrame {
    camera;
    parent;
    frame_width;
    pixel_width;
    frame_height;
    pixel_height;
    div;
    iframe;
    css_div;
    particles = [];
    
    constructor(incoming_parent, incoming_camera, incoming_width, incoming_height) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.div = document.createElement('div');
        this.div.name = `${DIV}${incoming_parent.simple_name}`;
        this.iframe = document.createElement('iframe');
        this.iframe.name = `${IFRAME}${incoming_parent.simple_name}`;
        // Look up the HTML path from CATEGORIES based on simple_name
        const category = Object.values(CATEGORIES).find(cat => cat.value === incoming_parent.simple_name);
        this.iframe.src = category ? category.html : PLACEHOLDER_PATH;
        this.div.appendChild(this.iframe);
        // Position and add to scene
        this.css_div = new CSS2DObject(this.div);
        this.css_div.simple_name = `${incoming_parent.simple_name}`;
        this.css_div.name = `${IFRAME}${this.css_div.simple_name}`;
        this.parent.add(this.css_div);
        // Set initial size
        this.update_size(incoming_width, incoming_height);
    }

    update_size(incoming_width, incoming_height) {
        this.frame_width = incoming_width - WIDTH_OFFSET;
        this.frame_height = incoming_height - HEIGHT_OFFSET;
        // Convert world units to pixels using the same scale as Three.js
        const fov = this.camera.fov * Math.PI / 180;
        const height_at_distance = 2 * Math.tan(fov / 2) * 15;
        const pixels_per_unit = window.innerHeight / height_at_distance;
        // Apply conversions
        this.pixel_width = Math.round(this.frame_width * pixels_per_unit);
        this.pixel_height = Math.round(this.frame_height * pixels_per_unit);
        // Apply to both div and iframe
        this.div.style.width = `${this.pixel_width}px`;
        this.div.style.height = `${this.pixel_height}px`;
        this.iframe.style.width = `${this.pixel_width}px`;
        this.iframe.style.height = `${this.pixel_height}px`;
        this.iframe.style.border = '0px';
    }

    create_confetti_burst(position) {
        if (this.simple_name !== 'education') return;
        
        const particle_count = 200;
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        
        // Create vectors for both fountains
        const vector = new THREE.Vector3(position.x, position.y, 0.5);
        if(FLAGS.TWEEN_LOGS) {
            console.log('Initial vector:', vector);
        }
        vector.unproject(this.camera);
        if(FLAGS.TWEEN_LOGS) {
            console.log('Vector after unproject:', vector);
        }
        
        // Calculate position and orientation relative to camera
        const camera_direction = new THREE.Vector3(0, 0, -1);
        camera_direction.applyQuaternion(this.camera.quaternion);
        const camera_right = new THREE.Vector3(1, 0, 0);
        camera_right.applyQuaternion(this.camera.quaternion);
        const camera_up = new THREE.Vector3(0, 1, 0);
        camera_up.applyQuaternion(this.camera.quaternion);
        
        const target_position = this.camera.position.clone().add(camera_direction.multiplyScalar(15));
        vector.z = target_position.z;
        
        // Convert angles to radians
        const burst_angles = [
            LEFT_BURST_ANGLE * Math.PI / 180,
            RIGHT_BURST_ANGLE * Math.PI / 180
        ];
        
        burst_angles.forEach((base_rotation, index) => {
            const xOffset = index === 0 ? -1 : 1;
            for (let i = 0; i < particle_count; i++) {
                const geometry = new THREE.PlaneGeometry(0.05, 0.05);
                const material = new THREE.MeshBasicMaterial({
                    color: colors[Math.floor(Math.random() * colors.length)],
                    side: THREE.DoubleSide,
                    depthTest: false,
                    transparent: true,
                    opacity: 1
                });
                const particle = new THREE.Mesh(geometry, material);
                particle.renderOrder = 999;
                particle.position.copy(vector).add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 0.2 - xOffset,
                        (Math.random() - 0.5) * 0.2,
                        (Math.random() - 0.5) * 0.2
                    )
                );
                const spread = (Math.random() - 0.5) * SPREAD_ANGLE * Math.PI / 180;
                const angle = base_rotation + spread;
                
                // Calculate direction relative to camera
                const direction = new THREE.Vector3();
                direction.addScaledVector(camera_right, Math.cos(angle));
                direction.addScaledVector(camera_up, Math.sin(angle));
                
                const speed = 0.08 + Math.random() * 0.12;
                const upward_force = 0.15 + Math.random() * 0.1;
                
                particle.velocity = new THREE.Vector3(
                    direction.x * speed,
                    direction.y * speed + upward_force,
                    direction.z * speed
                );
                particle.rotation.z = Math.random() * Math.PI * 2;
                particle.rotationSpeed = (Math.random() - 0.5) * 0.2;
                particle.acceleration = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.0005,
                    0,
                    (Math.random() - 0.5) * 0.0005
                );
                this.particles.push(particle);
                this.parent.add(particle);
                new Tween(particle.material)
                    .to({ opacity: 0 }, 6000)
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
        for (const particle of this.particles) {
            if (particle.acceleration) {
                particle.velocity.add(particle.acceleration);
            }
            
            particle.position.add(particle.velocity);
            
            particle.velocity.x += Math.sin(Date.now() * 0.0005 + particle.position.y) * 0.0002;
            particle.velocity.z += Math.cos(Date.now() * 0.0005 + particle.position.y) * 0.0002;
            
            particle.rotation.z += particle.rotationSpeed;
            
            particle.velocity.y -= 0.004;
            particle.velocity.multiplyScalar(0.995);
        }
    }
}