import { FLAGS, RAPIER, THREE } from "../../common";
import { AssetStorage, AssetSpawner } from 'asset-management';

const THROW_MULTIPLIER = 0.1; // Adjust this to control throw strength
const SHOVE_FORCE = 4; // Adjust this value to control the force of the shove
const ZOOM_AMOUNT = 2;  // Amount to move per scroll event
let current_mouse_pos = new THREE.Vector2();
let initial_grab_distance = 15; // Store initial distance when grabbed
let last_position = new THREE.Vector3();
let current_velocity = new THREE.Vector3();
let last_time = 0;

export function shove_object(incoming_object, incoming_source) {
    // Get the body pair from AssetManager using the instance_id
    const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
    if (body_pair){
        const [mesh, body] = body_pair;
        // Calculate direction from camera to interactable
        const camera_position = new THREE.Vector3();
        incoming_source.getWorldPosition(camera_position);
        const interactable_position = new THREE.Vector3();
        incoming_object.getWorldPosition(interactable_position);
        const direction = new THREE.Vector3()
            .subVectors(interactable_position, camera_position)
            .normalize();
        // Apply the impulse force in the calculated direction
        body.applyImpulse(
            { x: direction.x * SHOVE_FORCE, y: direction.y * SHOVE_FORCE, z: direction.z * SHOVE_FORCE },
            true
        );
    }
}

// Update this in the mousemove handler
export function update_mouse_position(e) {
    current_mouse_pos.x = (e.clientX / window.innerWidth) * 2 - 1;
    current_mouse_pos.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

export function translate_object(incoming_object, incoming_camera) {
    const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
    if (!body_pair) return;
    const [_, body] = body_pair;
    // Get ray from camera through mouse point
    const ray_start = new THREE.Vector3();
    const ray_end = new THREE.Vector3();
    const ray_dir = new THREE.Vector3();
    ray_start.setFromMatrixPosition(incoming_camera.matrixWorld);
    ray_end.set(current_mouse_pos.x, current_mouse_pos.y, 1).unproject(incoming_camera);
    ray_dir.subVectors(ray_end, ray_start).normalize();
    // Use stored initial distance
    const new_position = ray_start.clone().add(ray_dir.multiplyScalar(initial_grab_distance));
    // Calculate velocity
    const current_time = performance.now();
    const delta_time = (current_time - last_time) / 1000; // Convert to seconds
    current_velocity.subVectors(new_position, last_position).divideScalar(delta_time);
    // Update tracking variables
    last_position.copy(new_position);
    last_time = current_time;
    // Lock rotation when grabbed
    const current_rot = body.rotation();
    body.setTranslation(new_position);
    body.setRotation(current_rot);
}

export function zoom_object_in(incoming_object) {
    const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
    if (!body_pair) return;
    // Adjust the grab distance
    initial_grab_distance += ZOOM_AMOUNT;
}

export function zoom_object_out(incoming_object) {
    const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
    if (!body_pair) return;
    // Adjust the grab distance
    initial_grab_distance -= ZOOM_AMOUNT;
}

export function grab_object(incoming_object, incoming_camera) {
    const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
    if(FLAGS.ACTIVATE_LOGS) console.log(`Grabbing ${incoming_object.name}`);
    if (!body_pair) return;
    const [_, body] = body_pair;
    
    // Store initial distance from camera when grabbed
    const camera_pos = new THREE.Vector3();
    incoming_camera.getWorldPosition(camera_pos);
    const object_pos = new THREE.Vector3();
    object_pos.copy(body.translation());
    initial_grab_distance = camera_pos.distanceTo(object_pos);
    
    // Reset velocity tracking
    last_position.copy(object_pos);
    last_time = performance.now();
    
    // Store the current velocity if physics is paused
    // This will be used when physics is resumed
    if (window.isPhysicsPaused) {
        // Store linear and angular velocity on the object's userData
        const linvel = body.linvel();
        const angvel = body.angvel();
        
        incoming_object.userData.pausedState = {
            linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
            angvel: { x: angvel.x, y: angvel.y, z: angvel.z }
        };
    }
    
    current_velocity.set(0, 0, 0);
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
    
    // Check if this is a scroll menu sign and make the entire chain dynamic
    // First, check if this is a scroll menu component by looking at its parent hierarchy
    let currentObject = incoming_object;
    let scrollMenuInstance = null;
    
    // Navigate up the parent hierarchy to find the ScrollMenu instance
    while (currentObject && !scrollMenuInstance) {
        // Check if the current object has a scrollMenu reference
        if (currentObject.userData && currentObject.userData.scrollMenu) {
            scrollMenuInstance = currentObject.userData.scrollMenu;
        } else if (currentObject.parent) {
            currentObject = currentObject.parent;
        } else {
            break;
        }
    }
    
    // If we found a ScrollMenu instance, make the entire chain dynamic
    if (scrollMenuInstance && typeof scrollMenuInstance.makeEntireChainDynamic === 'function') {
        scrollMenuInstance.makeEntireChainDynamic();
        scrollMenuInstance.is_grabbed = true;
    }
}

export function release_object(incoming_object) {
    const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
    if (!body_pair) return;
    const [_, body] = body_pair;
    
    // Change back to dynamic body
    body.setBodyType(RAPIER.RigidBodyType.Dynamic);
    
    if (window.isPhysicsPaused) {
        // If physics is paused, store the current state to be restored when physics resumes
        // We'll still show the object at its new position, but won't apply impulses until physics resumes
        
        // If the object had a previous paused state, blend with new position
        const pausedState = incoming_object.userData.pausedState || { 
            linvel: { x: 0, y: 0, z: 0 }, 
            angvel: { x: 0, y: 0, z: 0 } 
        };
        
        // Store the current position and planned impulse for when physics resumes
        // Mark that this object has been moved during pause
        incoming_object.userData.pausedState = {
            ...pausedState,
            position: body.translation(),
            wasMoved: true, // Add this flag to indicate it was explicitly moved
            plannedImpulse: { 
                x: current_velocity.x * THROW_MULTIPLIER, 
                y: current_velocity.y * THROW_MULTIPLIER, 
                z: current_velocity.z * THROW_MULTIPLIER 
            }
        };
        
        // When physics is paused, we don't actually apply impulses
        // But we need to explicitly disable gravity and damping to keep it in place
        body.setGravityScale(0, true);
        body.setLinearDamping(999, true); // High damping to prevent movement
        body.setAngularDamping(999, true);
        body.sleep(); // Force the body to sleep until physics is resumed
    } else {
        // If physics is active, apply impulse as normal
        body.applyImpulse(
            { 
                x: current_velocity.x * THROW_MULTIPLIER, 
                y: current_velocity.y * THROW_MULTIPLIER, 
                z: current_velocity.z * THROW_MULTIPLIER 
            },
            true
        );
    }
    
    // Check if this is a scroll menu sign and make the entire chain dynamic if so
    // First, check if this is a scroll menu component by looking at its parent hierarchy
    let currentObject = incoming_object;
    let scrollMenuInstance = null;
    
    // Navigate up the parent hierarchy to find the ScrollMenu instance
    while (currentObject && !scrollMenuInstance) {
        // Check if the current object is the scroll_menu's assembly_container or if it has a scrollMenu reference
        if (currentObject.userData && currentObject.userData.scrollMenu) {
            scrollMenuInstance = currentObject.userData.scrollMenu;
            scrollMenuInstance.is_grabbed = false;
        } else if (currentObject.parent) {
            currentObject = currentObject.parent;
        } else {
            break;
        }
    }
    
    // If we found a ScrollMenu instance, make the entire chain dynamic
    if (scrollMenuInstance && typeof scrollMenuInstance.makeEntireChainDynamic === 'function') {
        scrollMenuInstance.makeEntireChainDynamic();
    }
}
