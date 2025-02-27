import { BackgroundLighting } from "../background/background_lighting";
import { FLAGS, THREE } from "../common";

// Utility functions for angle conversion
const ANGLES = {
    toRadians: degrees => degrees * (Math.PI / 180),
    toDegrees: radians => radians * (180 / Math.PI)
};

// Spotlight configuration constants
const SPOTLIGHT_CONFIG = {
    LEFT: {
        POSITION: {
            X: -3,
            Y: 2.5,
            Z: 40
        },
        ROTATION: {
            PITCH: 190,  // Point straight down (was Math.PI)
            YAW: 0      // No rotation around Y
        },
        ANGLE: 80,      // Was Math.PI / 4 (45 degrees)
        MAX_DISTANCE: 0, // Unlimited distance
        INTENSITY: 2    // Adding intensity configuration
    },
    RIGHT: {
        POSITION: {
            X: 3,
            Y: 2.5,
            Z: 40
        },
        ROTATION: {
            PITCH: 190,  // Point straight down (was Math.PI)
            YAW: 0      // No rotation around Y
        },
        ANGLE: 80,      // Was Math.PI / 4 (45 degrees)
        MAX_DISTANCE: 0, // Unlimited distance
        INTENSITY: 2    // Adding intensity configuration
    }
};

export class CameraManager {
    constructor(incoming_parent, incoming_camera, distance = 15) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.lighting = BackgroundLighting.getInstance(this.parent);
        this.distance = distance;
        this.target = new THREE.Vector3(0, 0, 0);
        // Spherical coordinates (starting position)
        this.phi = 0;    // vertical angle (degrees)
        this.theta = 0;  // horizontal angle (degrees)
        // Add constraints
        this.min_phi = -60;  // minimum vertical angle
        this.max_phi = 60;   // maximum vertical angle
        this.min_dist = 5;
        this.max_dist = 30;
        // Add callback for position updates
        this.on_update_callbacks = new Set();
        // Add reference to overlay container
        this.overlay_container = null;
        // Update the camera
        this.update_camera();

        // Create left shoulder spotlight
        (async () => {
            this.left_shoulder_light = await this.lighting.create_spotlight(
                new THREE.Vector3(
                    SPOTLIGHT_CONFIG.LEFT.POSITION.X,
                    SPOTLIGHT_CONFIG.LEFT.POSITION.Y,
                    SPOTLIGHT_CONFIG.LEFT.POSITION.Z
                ),
                ANGLES.toRadians(SPOTLIGHT_CONFIG.LEFT.ROTATION.PITCH),
                ANGLES.toRadians(SPOTLIGHT_CONFIG.LEFT.ROTATION.YAW),
                SPOTLIGHT_CONFIG.LEFT.POSITION.Y * Math.tan(ANGLES.toRadians(SPOTLIGHT_CONFIG.LEFT.ANGLE)),
                SPOTLIGHT_CONFIG.LEFT.MAX_DISTANCE,
                null,  // Default color
                SPOTLIGHT_CONFIG.LEFT.INTENSITY
            );

            // Create debug visualization if enabled
            if (FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
                await this.lighting.create_spotlight_helper(this.left_shoulder_light);
            }
        })();

        // Create right shoulder spotlight
        (async () => {
            this.right_shoulder_light = await this.lighting.create_spotlight(
                new THREE.Vector3(
                    SPOTLIGHT_CONFIG.RIGHT.POSITION.X,
                    SPOTLIGHT_CONFIG.RIGHT.POSITION.Y,
                    SPOTLIGHT_CONFIG.RIGHT.POSITION.Z
                ),
                ANGLES.toRadians(SPOTLIGHT_CONFIG.RIGHT.ROTATION.PITCH),
                ANGLES.toRadians(SPOTLIGHT_CONFIG.RIGHT.ROTATION.YAW),
                SPOTLIGHT_CONFIG.RIGHT.POSITION.Y * Math.tan(ANGLES.toRadians(SPOTLIGHT_CONFIG.RIGHT.ANGLE)),
                SPOTLIGHT_CONFIG.RIGHT.MAX_DISTANCE,
                null,  // Default color
                SPOTLIGHT_CONFIG.RIGHT.INTENSITY
            );

            // Create debug visualization if enabled
            if (FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
                await this.lighting.create_spotlight_helper(this.right_shoulder_light);
            }
        })();
    }

    add_update_callback(callback) {
        this.on_update_callbacks.add(callback);
    }

    remove_update_callback(callback) {
        this.on_update_callbacks.delete(callback);
    }

    rotate(delta_x, delta_y) {
        // Convert the input to degrees (assuming input is in screen pixels)
        this.theta -= delta_x;
        this.phi = Math.max(this.min_phi, Math.min(this.max_phi, this.phi + delta_y));
        
        this.update_camera();
    }

    // Add zoom capability
    zoom(delta) {
        this.distance = Math.max(
            this.min_dist,
            Math.min(this.max_dist, this.distance + delta)
        );
        this.update_camera();
    }

    set_overlay_container(container) {
        this.overlay_container = container;
    }

    update_camera() {
        // Convert spherical coordinates to Cartesian
        const phi_rad = THREE.MathUtils.degToRad(this.phi);
        const theta_rad = THREE.MathUtils.degToRad(this.theta);
        
        // Update camera position
        this.camera.position.x = this.distance * Math.cos(phi_rad) * Math.sin(theta_rad);
        this.camera.position.y = this.distance * Math.sin(phi_rad);
        this.camera.position.z = this.distance * Math.cos(phi_rad) * Math.cos(theta_rad);
        
        if(FLAGS.PHYSICS_LOGS) {
            console.log('Camera Update:');
            console.log(`Position: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
            console.log(`Angles: phi=${this.phi.toFixed(2)}°, theta=${this.theta.toFixed(2)}°`);
        }
        
        // Set camera target and udpate
        this.camera.lookAt(this.target);
        this.camera.updateMatrix();
        // Update overlay position
        if (this.overlay_container) {
            // Calculate the position in front of the camera
            const forward = new THREE.Vector3(0, 0, -15);
            forward.applyQuaternion(this.camera.quaternion);
            // Position overlay at camera position + forward vector
            this.overlay_container.overlay_container.position.copy(this.camera.position);
            this.overlay_container.overlay_container.position.add(forward);
            // Make overlay face the camera
            this.overlay_container.overlay_container.lookAt(this.camera.position);
        }
        // Notify callbacks
        this.on_update_callbacks.forEach(callback => callback());
    }
} 