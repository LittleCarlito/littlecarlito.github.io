import * as THREE from 'three';

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
        const spotlight_one = new THREE.SpotLight(undefined, 150);
        spotlight_one.position.set(2.5, 5, -5);
        spotlight_one.angle = -Math.PI / 2;
        spotlight_one.penumbra = 0.5;
        spotlight_one.castShadow = true;
        spotlight_one.shadow.blurSamples = 10;
        spotlight_one.shadow.radius = 5;
        this.lighting_container.add(spotlight_one);
        const spotlight_two = spotlight_one.clone();
        spotlight_two.position.set(-2.5, 5, -1);
        this.lighting_container.add(spotlight_two);
        // Directional light
        const direction_light = new THREE.DirectionalLight(0xffffff, 2);
        direction_light.position.set(0, -3, -15);
        direction_light.target = light_focus;
        this.lighting_container.add(direction_light);
        // TODO OOOOO
        // TODO Hemisphere light
    }
}