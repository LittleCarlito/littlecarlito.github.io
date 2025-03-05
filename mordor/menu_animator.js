import { THREE } from '../../common';

/**
 * MenuAnimator - Handles animation and movement logic for the menu
 */
export class MenuAnimator {
    // The menu element being animated
    menu;
    
    // Animation state
    animation_target = null;
    animation_start_position = null;
    animation_start_time = 0;
    animation_duration = 0;
    animation_easing_function = null;
    animation_callback = null;
    
    /**
     * Creates a new MenuAnimator
     * @param {THREE.Object3D} menu - The menu object to animate
     */
    constructor(menu) {
        this.menu = menu;
        this.animation_easing_function = this.easeInOutCubic;
    }
    
    /**
     * Animates the menu to a target position
     * @param {Object} target_position - The target position {x, y, z}
     * @param {number} duration - The duration of the animation in seconds
     * @param {Function} callback - Callback to execute when animation completes
     */
    animateToPosition(target_position, duration = 1.0, callback = null) {
        // Store animation parameters
        this.animation_target = { ...target_position };
        this.animation_start_position = { 
            x: this.menu.position.x,
            y: this.menu.position.y,
            z: this.menu.position.z
        };
        this.animation_start_time = performance.now();
        this.animation_duration = duration * 1000; // Convert to milliseconds
        this.animation_callback = callback;
    }
    
    /**
     * Animates the menu to a position in front of the camera
     * @param {THREE.Camera} camera - The camera to position in front of
     * @param {number} distance - Distance from camera
     * @param {number} duration - Duration of animation in seconds
     * @param {Function} callback - Callback to execute when animation completes
     */
    animateToCenter(camera, distance = 5, duration = 1.0, callback = null) {
        // Calculate position in front of camera
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);
        cameraDirection.normalize();
        cameraDirection.multiplyScalar(distance);
        
        const target_position = {
            x: camera.position.x + cameraDirection.x,
            y: camera.position.y + cameraDirection.y,
            z: camera.position.z + cameraDirection.z
        };
        
        // Animate to this position
        this.animateToPosition(target_position, duration, callback);
    }
    
    /**
     * Updates the animation each frame
     * @returns {boolean} - True if animation is still in progress, false if complete
     */
    updateAnimation() {
        // Skip if no animation is in progress
        if (!this.animation_target) return false;
        
        // Calculate elapsed time
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.animation_start_time;
        
        // Check if animation is complete
        if (elapsedTime >= this.animation_duration) {
            // Set final position
            this.menu.position.set(
                this.animation_target.x,
                this.animation_target.y,
                this.animation_target.z
            );
            
            // Clear animation state
            const callback = this.animation_callback;
            this.animation_target = null;
            this.animation_start_position = null;
            this.animation_start_time = 0;
            this.animation_duration = 0;
            this.animation_callback = null;
            
            // Execute callback if provided
            if (callback) callback();
            
            return false;
        }
        
        // Calculate progress with easing
        const progress = this.animation_easing_function(
            Math.min(elapsedTime / this.animation_duration, 1.0)
        );
        
        // Interpolate position
        this.menu.position.set(
            this.animation_start_position.x + (this.animation_target.x - this.animation_start_position.x) * progress,
            this.animation_start_position.y + (this.animation_target.y - this.animation_start_position.y) * progress,
            this.animation_start_position.z + (this.animation_target.z - this.animation_start_position.z) * progress
        );
        
        return true;
    }
    
    /**
     * Sets the menu position immediately without animation
     * @param {Object} target_position - The target position {x, y, z}
     */
    setDirectPosition(target_position) {
        // Clear any existing animation
        this.animation_target = null;
        this.animation_start_position = null;
        this.animation_start_time = 0;
        this.animation_duration = 0;
        this.animation_callback = null;
        
        // Set position directly
        this.menu.position.set(
            target_position.x,
            target_position.y,
            target_position.z
        );
    }
    
    /**
     * Sets the menu position directly in front of the camera
     * @param {THREE.Camera} camera - The camera to position in front of
     * @param {number} distance - Distance from camera
     */
    setCenterPosition(camera, distance = 5) {
        // Calculate position in front of camera
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);
        cameraDirection.normalize();
        cameraDirection.multiplyScalar(distance);
        
        const target_position = {
            x: camera.position.x + cameraDirection.x,
            y: camera.position.y + cameraDirection.y,
            z: camera.position.z + cameraDirection.z
        };
        
        // Set position directly
        this.setDirectPosition(target_position);
    }
    
    /**
     * Cubic easing function (ease in/out)
     * @param {number} t - Progress from 0 to 1
     * @returns {number} - Eased value
     */
    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    /**
     * "Elastic" back easing function
     * @param {number} t - Progress from 0 to 1
     * @returns {number} - Eased value
     */
    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    
    /**
     * Cleans up resources
     */
    cleanup() {
        // Reset animation state
        this.animation_target = null;
        this.animation_start_position = null;
        this.animation_start_time = 0;
        this.animation_duration = 0;
        this.animation_easing_function = null;
        this.animation_callback = null;
    }
} 