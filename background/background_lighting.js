import * as THREE from 'three';

export const SPOTLIGHT_HEIGHT = 7;
export const SPOTLIGHT_COLOR = 0xfff9d8;
export const HEMISPHERE_SKY_COLOR = 0xffffff;
export const HEMISPHERE_GROUND_COLOR = 0x663c1f;

export class BackgroundLighting {

    constructor(incoming_parent) {
        this.parent = incoming_parent;
        this.lighting_container = new THREE.Object3D();
        this.parent.add(this.lighting_container);
        // Light focus position
        const light_focus = new THREE.Object3D();
        light_focus.position.set(0, -9, 0);
        this.lighting_container.add(light_focus);
        // Spotlights
        const spotlight_one = new THREE.SpotLight(SPOTLIGHT_COLOR, 150);
        spotlight_one.position.set(2.5, SPOTLIGHT_HEIGHT, -5);
        spotlight_one.angle = -Math.PI / 2;
        spotlight_one.penumbra = 0.5;
        spotlight_one.castShadow = true;
        spotlight_one.shadow.blurSamples = 10;
        spotlight_one.shadow.radius = 5;
        this.lighting_container.add(spotlight_one);
        const spotlight_two = spotlight_one.clone();
        spotlight_two.position.set(-2.5, SPOTLIGHT_HEIGHT, -1);
        this.lighting_container.add(spotlight_two);
        // TODO OOOOO
        // TODO Hemisphere light
        const hemisphere_light = new THREE.HemisphereLight(HEMISPHERE_SKY_COLOR, HEMISPHERE_GROUND_COLOR, 2);
        hemisphere_light.position.z = 50;
        hemisphere_light.position.y = 500;
        this.lighting_container.add(hemisphere_light);
    }
}