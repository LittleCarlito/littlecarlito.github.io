import * as THREE from 'three';
import { BackgroundLighting } from '../background_lighting';

/**
 * Manages the spotlight functionality for the ScrollMenu
 */
export class SpotlightManager {
    menu;
    lighting;
    menu_spotlight = null;

    constructor(scrollMenu, lighting) {
        this.menu = scrollMenu;
        this.lighting = lighting || BackgroundLighting.getInstance(this.menu.parent);
    }

    /**
     * Creates a spotlight focused on the sign
     */
    async createSpotlight() {
        // Skip spotlight creation if chains are broken
        if (this.menu.chainManager.chains_broken) {
            console.log("Chains are broken, not creating spotlight");
            return null;
        }
        
        // Skip if we already have a spotlight
        if (this.menu_spotlight) {
            console.log("Spotlight already exists");
            return this.menu_spotlight;
        }
        
        // Skip if sign mesh doesn't exist
        if (!this.menu.chainManager.sign_mesh) {
            console.log("Sign mesh doesn't exist, can't create spotlight");
            return null;
        }
        
        try {
            console.log("Creating spotlight");
            
            // Get sign position in WORLD coordinates
            const signWorldPosition = new THREE.Vector3();
            this.menu.chainManager.sign_mesh.getWorldPosition(signWorldPosition);
            
            // Calculate spotlight position based on camera
            const cameraPosition = this.menu.camera.position.clone();
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(this.menu.camera.quaternion);
            cameraDirection.multiplyScalar(5); // 5 units behind camera
            
            const spotlightPosition = new THREE.Vector3(
                cameraPosition.x - cameraDirection.x,
                cameraPosition.y + 10, // 10 units up
                cameraPosition.z - cameraDirection.z
            );
            
            // Calculate direction for rotation (using world coordinates)
            const direction = new THREE.Vector3().subVectors(signWorldPosition, spotlightPosition);
            direction.normalize();
            
            // Calculate rotation angles
            const rotationY = Math.atan2(direction.x, direction.z);
            const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
            
            // Create spotlight with these values
            const spotlight = await this.lighting.create_spotlight(
                spotlightPosition,
                rotationX,
                rotationY,
                5, // circle radius
                0, // unlimited distance
                0x00FFFF // Cyan color for scroll menu
            );
            
            // Double-check that chains weren't broken during spotlight creation
            if (this.menu.chainManager.chains_broken) {
                console.log("Chains were broken during spotlight creation - despawning immediately");
                await this.lighting.despawn_spotlight(spotlight);
                return null;
            }
            
            console.log("Spotlight created successfully");
            this.menu_spotlight = spotlight;
            
            // Set target to sign's WORLD position immediately
            const worldPos = new THREE.Vector3();
            this.menu.chainManager.sign_mesh.getWorldPosition(worldPos);
            this.menu_spotlight.target.position.copy(worldPos);
            this.menu_spotlight.target.updateMatrixWorld(true);
            this.menu_spotlight.updateMatrixWorld(true);
            
            return this.menu_spotlight;
        } catch (error) {
            console.error("Error creating spotlight:", error);
            return null;
        }
    }

    /**
     * Updates the spotlight position and target
     */
    updateSpotlight(spotlight) {
        if (!spotlight || !this.menu.chainManager.sign_mesh) return;
        
        // Get sign position in WORLD coordinates
        const signWorldPosition = new THREE.Vector3();
        this.menu.chainManager.sign_mesh.getWorldPosition(signWorldPosition);
        
        // Update target to sign WORLD position
        spotlight.target.position.copy(signWorldPosition);
        spotlight.target.updateMatrixWorld(true);
        
        if (this.menu.is_animating) {
            // During animation, have the spotlight follow the camera
            const cameraPosition = this.menu.camera.position.clone();
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(this.menu.camera.quaternion);
            cameraDirection.multiplyScalar(5); // 5 units behind camera
            
            spotlight.position.set(
                cameraPosition.x - cameraDirection.x,
                cameraPosition.y + 10, // 10 units above
                cameraPosition.z - cameraDirection.z
            );
        } else if (!spotlight.positionFixed) {
            // Animation is complete - fix the spotlight position
            const cameraPosition = this.menu.camera.position.clone();
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(this.menu.camera.quaternion);
            cameraDirection.multiplyScalar(5);
            
            spotlight.position.set(
                cameraPosition.x - cameraDirection.x,
                cameraPosition.y + 10,
                cameraPosition.z - cameraDirection.z
            );
            
            // Mark that we've fixed the position
            spotlight.positionFixed = true;
        }
        
        // Force spotlight update
        spotlight.updateMatrixWorld(true);
    }

    /**
     * Removes the spotlight
     */
    async removeSpotlight(spotlight) {
        if (!spotlight) return;
        
        try {
            // Check if lighting object is properly initialized
            if (!this.lighting) {
                console.error("Lighting object is not initialized!");
                this.lighting = BackgroundLighting.getInstance(this.menu.parent);
            }
            
            // Ensure the spotlight is actually in the scene before trying to remove it
            if (spotlight.parent) {
                await this.lighting.despawn_spotlight(spotlight);
                console.log("Spotlight successfully removed");
            } else {
                console.warn("Spotlight has no parent, may have been removed already");
            }
            
            // Always reset the reference
            if (spotlight === this.menu_spotlight) {
                this.menu_spotlight = null;
            }
        } catch (error) {
            console.error("Error removing spotlight:", error);
        }
    }
} 