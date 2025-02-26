import { THREE } from "../common";
import { FLAGS } from "../common/flags";

export const SPOTLIGHT_HEIGHT = 50;
export const SPOTLIGHT_DISTANCE = 0; // Light position on z-axis
export const SPOTLIGHT_OFFSET = 0;
export const SPOTLIGHT_COLOR = 0xffffff;
export const SPOTLIGHT_INTENSITY = 5;
export const SPOTLIGHT_ANGLE = Math.PI / 16; // Even narrower angle
export const SPOTLIGHT_PENUMBRA = 0.05; // Sharper edge
export const SPOTLIGHT_SHARPNESS = 0.5;

export class BackgroundLighting {

    constructor(incoming_parent) {
        this.parent = incoming_parent;
        this.lighting_container = new THREE.Object3D();
        this.parent.add(this.lighting_container);

        // Create main spotlight pointing straight down
        const main = this.createSpotlight(
            new THREE.Vector3(SPOTLIGHT_OFFSET, SPOTLIGHT_HEIGHT, SPOTLIGHT_DISTANCE),
            -Math.PI/2, // Point straight down
            0,          // No rotation around Y
            5,         // Circle radius
            0          // Unlimited distance
        );

        // Create debug visualization if enabled
        if (FLAGS.VISUAL_DEBUG) {
            this.createEnhancedSpotlightHelper(main, 0x00FF00);
        }
    }

    createSpotlight(origin, rotationX, rotationY, circleRadius, maxDistance) {
        // Use the constant angle instead of calculating from radius
        const angle = SPOTLIGHT_ANGLE;
        
        const spotlight = new THREE.SpotLight(
            SPOTLIGHT_COLOR,
            SPOTLIGHT_INTENSITY,
            maxDistance,
            angle,
            SPOTLIGHT_PENUMBRA,
            SPOTLIGHT_SHARPNESS
        );
        // Set the spotlight's position to the origin
        spotlight.position.copy(origin);
        spotlight.castShadow = true;
        // Shadow quality settings
        spotlight.shadow.blurSamples = 32;
        spotlight.shadow.radius = 4;
        spotlight.shadow.mapSize.width = 2048;
        spotlight.shadow.mapSize.height = 2048;
        // Camera settings
        spotlight.shadow.camera.near = 10;
        spotlight.shadow.camera.far = 100;
        spotlight.shadow.camera.fov = 30;
        // Shadow bias settings
        spotlight.shadow.bias = -0.002;
        spotlight.shadow.normalBias = 0.02;
        // Create target at a point in the direction specified by the rotation angles
        const targetDistance = 100; // Use a fixed distance for the target
        const target = new THREE.Object3D();
        // Calculate target position based on spherical coordinates
        const x = Math.sin(rotationY) * Math.cos(rotationX) * targetDistance;
        const y = Math.sin(rotationX) * targetDistance;
        const z = Math.cos(rotationY) * Math.cos(rotationX) * targetDistance;
        target.position.set(
            origin.x + x,
            origin.y + y,
            origin.z + z
        );
        spotlight.target = target;
        this.lighting_container.add(target);
        this.lighting_container.add(spotlight);
        return spotlight;
    }

    createEnhancedSpotlightHelper(spotlight, color) {
        // Create the standard helper
        const helper = new THREE.SpotLightHelper(spotlight, color);
        this.lighting_container.add(helper);
        // Calculate direction and distance to target
        const spotlightToTarget = new THREE.Vector3().subVectors(
            spotlight.target.position,
            spotlight.position
        );
        const distance = spotlightToTarget.length();
        // Create a cone to visualize the spotlight's beam
        const height = distance;
        const radius = Math.tan(spotlight.angle) * height;
        // Create cone pointing down by default (narrow end at 0,0,0)
        const geometry = new THREE.ConeGeometry(radius, height, 32, 32, true);
        geometry.translate(0, -height/2, 0); // Move pivot to top of cone
        const material = new THREE.MeshBasicMaterial({ 
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const cone = new THREE.Mesh(geometry, material);
        cone.position.copy(spotlight.position);
        // Orient cone to point from spotlight to target
        const direction = spotlightToTarget.normalize();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
        cone.quaternion.copy(quaternion);
        this.lighting_container.add(cone);
        return {
            helper,
            cone
        };
    }

    // Add method to update helpers if spotlights move
    updateHelpers() {
        // The standard helpers will update automatically
        this.lighting_container.children.forEach(child => {
            if (child.isSpotLightHelper) {
                child.update();
            }
        });
    }
}