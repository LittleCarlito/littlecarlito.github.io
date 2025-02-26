import { THREE } from "../common";

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
        // Spotlight one
        const spotlight_one = new THREE.SpotLight(
            SPOTLIGHT_COLOR, 
            SPOTLIGHT_INTENSITY, 
            SPOTLIGHT_DISTANCE, 
            SPOTLIGHT_ANGLE, 
            SPOTLIGHT_PENUMBRA, 
            SPOTLIGHT_SHARPNESS
        );
        spotlight_one.position.set(SPOTLIGHT_OFFSET, SPOTLIGHT_HEIGHT, SPOTLIGHT_DISTANCE);
        spotlight_one.castShadow = true;
        // Increase blur and radius for softer shadows
        spotlight_one.shadow.blurSamples = 32;
        spotlight_one.shadow.radius = 4;
        spotlight_one.shadow.mapSize.width = 2048;
        spotlight_one.shadow.mapSize.height = 2048;
        // Adjust shadow camera parameters
        spotlight_one.shadow.camera.near = 10;
        spotlight_one.shadow.camera.far = 100;
        spotlight_one.shadow.camera.fov = 30;
        // Increase bias to prevent self-shadowing artifacts
        spotlight_one.shadow.bias = -0.002;
        spotlight_one.shadow.normalBias = 0.02;  // Add normal bias to help with surface artifacts
        // Position the target directly below the light
        spotlight_one.target.position.set(SPOTLIGHT_OFFSET, 0, SPOTLIGHT_DISTANCE);
        this.lighting_container.add(spotlight_one.target);
        this.lighting_container.add(spotlight_one);
    }
}