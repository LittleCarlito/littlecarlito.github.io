import * as THREE from 'three';

export class CameraController {
    constructor(camera, distance = 15) {
        this.camera = camera;
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
        // Set camera target and udpate
        this.camera.lookAt(this.target);
        this.camera.updateMatrix();

        // TODO OOOOO
        // TODO Confirmed by disabling some random layering that movement has the label column tween back to its position on rotation
        //          Assuming the other objects are doing the same
        // TODO Fix it so that on rotation the overlay objects don't tween back to their pre-hidden positions
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