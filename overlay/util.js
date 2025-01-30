import * as THREE from "three";

/** Calculates screen size based off a distance of 15 */
export function get_screen_size(incoming_camera) {
    const screen_size = new THREE.Vector2();
    incoming_camera.getViewSize(15, screen_size);
    return screen_size;
}