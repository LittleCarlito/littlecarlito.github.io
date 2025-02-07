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
        this.minPhi = -60;  // minimum vertical angle
        this.maxPhi = 60;   // maximum vertical angle
        this.minDistance = 5;
        this.maxDistance = 30;
        
        // Add callback for position updates
        this.onUpdateCallbacks = new Set();
        
        // Add reference to overlay container
        this.overlayContainer = null;
        
        this.updateCamera();
    }

    addUpdateCallback(callback) {
        this.onUpdateCallbacks.add(callback);
    }

    removeUpdateCallback(callback) {
        this.onUpdateCallbacks.delete(callback);
    }

    rotate(deltaX, deltaY) {
        // Convert the input to degrees (assuming input is in screen pixels)
        this.theta -= deltaX;
        this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi + deltaY));
        
        this.updateCamera();
    }

    // Add zoom capability
    zoom(delta) {
        this.distance = Math.max(
            this.minDistance,
            Math.min(this.maxDistance, this.distance + delta)
        );
        this.updateCamera();
    }

    setOverlayContainer(container) {
        this.overlayContainer = container;
    }

    updateCamera() {
        // Convert spherical coordinates to Cartesian
        const phiRad = THREE.MathUtils.degToRad(this.phi);
        const thetaRad = THREE.MathUtils.degToRad(this.theta);
        
        this.camera.position.x = this.distance * Math.cos(phiRad) * Math.sin(thetaRad);
        this.camera.position.y = this.distance * Math.sin(phiRad);
        this.camera.position.z = this.distance * Math.cos(phiRad) * Math.cos(thetaRad);
        
        this.camera.lookAt(this.target);
        this.camera.updateMatrix();

        // Update overlay position
        if (this.overlayContainer) {
            // Calculate the position in front of the camera
            const forward = new THREE.Vector3(0, 0, -15);
            forward.applyQuaternion(this.camera.quaternion);
            
            // Position overlay at camera position + forward vector
            this.overlayContainer.overlay_container.position.copy(this.camera.position);
            this.overlayContainer.overlay_container.position.add(forward);
            
            // Make overlay face the camera
            this.overlayContainer.overlay_container.lookAt(this.camera.position);
        }

        // Notify callbacks
        this.onUpdateCallbacks.forEach(callback => callback());
    }
} 