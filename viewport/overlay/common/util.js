import * as THREE from 'three';

export const TEXTURE_LOADER = new THREE.TextureLoader();
// Constants
export const PAN_SPEED = 800;
export const ROTATE_SPEED = 300;
export const FOCUS_ROTATION = .7;
export const LINK_RADIUS = .44;
export const HIDE_WIDTH = 1;
export const HIDE_HEIGHT = 1;

/**
 * Takes a named object and returns the substring before '_' character
 * @param {*} incoming_object any named object
 * @returns Extracts the substring before '_' character
 */
export function extract_type(incoming_object) {
    const split_intersected_name = incoming_object.name.split("_");
    const name_type = split_intersected_name[0] + "_";
    if(name_type != "") {
        return name_type;
    }
}

// Mouse detection
const raycaster = new THREE.Raycaster();
const mouse_location = new THREE.Vector2();/** Retrieves objects mouse is intersecting with from the given event */
export function get_intersect_list(e, incoming_camera, incoming_scene) {
    mouse_location.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse_location.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse_location, incoming_camera);
    return raycaster.intersectObject(incoming_scene, true);
}