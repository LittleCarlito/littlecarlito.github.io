import { THREE } from "../../../common";

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
    if (!incoming_object || !incoming_object.name) {
        return "";
    }
    const split_intersected_name = incoming_object.name.split("_");
    const name_type = split_intersected_name[0] + "_";
    return name_type;
}

// Mouse detection
const raycaster = new THREE.Raycaster();
const mouse_location = new THREE.Vector2();

/** Converts screen coordinates to Normalized Device Coordinates (NDC) */
export function get_ndc_from_event(e) {
    return {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1
    };
}

/** Retrieves objects mouse is intersecting with from the given event */
export function get_intersect_list(e, incoming_camera, incoming_scene) {
    const ndc = get_ndc_from_event(e);
    mouse_location.x = ndc.x;
    mouse_location.y = ndc.y;
    raycaster.setFromCamera(mouse_location, incoming_camera);
    const intersections = raycaster.intersectObject(incoming_scene, true);
    
    // First sort by renderOrder (higher values first)
    // This ensures UI elements with high renderOrder are prioritized
    // Then sort by distance within the same renderOrder group
    return intersections.sort((a, b) => {
        const renderOrderA = a.object.renderOrder || 0;
        const renderOrderB = b.object.renderOrder || 0;
        
        // If renderOrder is different, prioritize higher renderOrder
        if (renderOrderB !== renderOrderA) {
            return renderOrderB - renderOrderA;
        }
        
        // Check if either object is a label or contains "label" in its name
        const isLabelA = a.object.name.includes('label_') || a.object.name.includes('_collision');
        const isLabelB = b.object.name.includes('label_') || b.object.name.includes('_collision');
        
        // If only one is a label, prioritize it
        if (isLabelA && !isLabelB) return -1;
        if (!isLabelA && isLabelB) return 1;
        
        // Otherwise, sort by distance (closer first for UI elements)
        return a.distance - b.distance;
    });
}