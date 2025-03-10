import { FLAGS, RAPIER, THREE } from "../../common";
import { AssetStorage, AssetSpawner } from 'blorkpack';
import { BLORKPACK_FLAGS } from "../../packages/blorkpack/src";

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
    if (!incoming_object) return;
    
    // First, try to get the physics body directly from the object as a property
    let physicsBody = incoming_object.physicsBody || null;
    
    // If not found, check userData
    if (!physicsBody && incoming_object.userData && incoming_object.userData.physicsBody) {
        physicsBody = incoming_object.userData.physicsBody;
    } 
    
    // Try getting it from the root model
    if (!physicsBody && incoming_object.userData && incoming_object.userData.rootModel) {
        const rootModel = incoming_object.userData.rootModel;
        // Check root model direct property
        physicsBody = rootModel.physicsBody;
        // If not found, check root model userData
        if (!physicsBody && rootModel.userData && rootModel.userData.physicsBody) {
            physicsBody = rootModel.userData.physicsBody;
        }
    }
    
    // Last resort - try the asset storage lookup
    if (!physicsBody) {
        const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
        if (body_pair) {
            physicsBody = body_pair[1]; // Extract the body from [mesh, body]
        }
    }
    
    // If we still don't have a physics body, try to find it by traversing up the object hierarchy
    if (!physicsBody) {
        let current = incoming_object;
        let depth = 0;
        const MAX_DEPTH = 10;
        
        while (current && !physicsBody && depth < MAX_DEPTH) {
            // Try direct property
            if (current.physicsBody) {
                physicsBody = current.physicsBody;
                break;
            }
            
            // Try userData
            if (current.userData && current.userData.physicsBody) {
                physicsBody = current.userData.physicsBody;
                break;
            }
            
            // Move up in hierarchy
            if (current.parent) {
                current = current.parent;
                depth++;
            } else {
                break;
            }
        }
    }
    
    if (!physicsBody) {
        console.warn(`No physics body found for translating: ${incoming_object.name}`);
        return;
    }
    
    // Get ray from camera through mouse point
    const ray_start = new THREE.Vector3();
    const ray_end = new THREE.Vector3();
    const ray_dir = new THREE.Vector3();
    ray_start.setFromMatrixPosition(incoming_camera.matrixWorld);
    ray_end.set(current_mouse_pos.x, current_mouse_pos.y, 1).unproject(incoming_camera);
    ray_dir.subVectors(ray_end, ray_start).normalize();
    
    // Calculate the target position at the desired distance along the ray
    const target_pos = new THREE.Vector3();
    target_pos.copy(ray_start).addScaledVector(ray_dir, initial_grab_distance);
    
    // Update physics body position
    physicsBody.setTranslation(
        { 
            x: target_pos.x, 
            y: target_pos.y, 
            z: target_pos.z 
        }, 
        true
    );
    
    // Store current position for velocity calculation on release
    const current_time = performance.now();
    
    // Only update last position if enough time has passed to avoid jitter
    if (current_time - last_time > 16) {  // Roughly 60fps
        const current_pos = physicsBody.translation();
        last_position.set(current_pos.x, current_pos.y, current_pos.z);
        last_time = current_time;
    }
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
    if (!incoming_object) return;
    
    if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`Grabbing ${incoming_object.name}`);
    
    // First, try to get the physics body directly from the object as a property
    let physicsBody = incoming_object.physicsBody || null;
    
    // If not found, check userData
    if (!physicsBody && incoming_object.userData && incoming_object.userData.physicsBody) {
        physicsBody = incoming_object.userData.physicsBody;
    } 
    
    // Try getting it from the root model
    if (!physicsBody && incoming_object.userData && incoming_object.userData.rootModel) {
        const rootModel = incoming_object.userData.rootModel;
        // Check root model direct property
        physicsBody = rootModel.physicsBody;
        // If not found, check root model userData
        if (!physicsBody && rootModel.userData && rootModel.userData.physicsBody) {
            physicsBody = rootModel.userData.physicsBody;
        }
    }
    
    // Last resort - try the asset storage lookup
    if (!physicsBody) {
        const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
        if (body_pair) {
            physicsBody = body_pair[1]; // Extract the body from [mesh, body]
        }
    }
    
    // If we still don't have a physics body, try to find it by traversing up the object hierarchy
    if (!physicsBody) {
        let current = incoming_object;
        let depth = 0;
        const MAX_DEPTH = 10;
        
        while (current && !physicsBody && depth < MAX_DEPTH) {
            // Try direct property
            if (current.physicsBody) {
                physicsBody = current.physicsBody;
                break;
            }
            
            // Try userData
            if (current.userData && current.userData.physicsBody) {
                physicsBody = current.userData.physicsBody;
                break;
            }
            
            // Move up in hierarchy
            if (current.parent) {
                current = current.parent;
                depth++;
            } else {
                break;
            }
        }
    }
    
    // If no physics body found after all attempts, log and return
    if (!physicsBody) {
        console.warn(`No physics body found for ${incoming_object.name}`, incoming_object);
        // Debug - print what the object has
        console.log("Object properties:", Object.keys(incoming_object));
        console.log("Object userData:", incoming_object.userData);
        return;
    }
    
    if(BLORKPACK_FLAGS.ACTIVATE_LOGS) {
        // We successfully found a physics body, proceed with grabbing
        console.log(`Successfully found physics body for ${incoming_object.name}`, physicsBody);
    }
    
    // Store initial distance from camera when grabbed
    const camera_pos = new THREE.Vector3();
    incoming_camera.getWorldPosition(camera_pos);
    const object_pos = new THREE.Vector3();
    object_pos.copy(physicsBody.translation());
    initial_grab_distance = camera_pos.distanceTo(object_pos);
    
    // Reset velocity tracking
    last_position.copy(object_pos);
    last_time = performance.now();
    
    // Change to kinematic while grabbed to prevent forces from acting on it
    physicsBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
    
    // Mark object as being moved
    incoming_object.userData.isMoving = true;
    
    // Make sure the body is awake
    physicsBody.wakeUp();
}

export function release_object(incoming_object) {
    if (!incoming_object) return;
    
    // First, try to get the physics body directly from the object as a property
    let physicsBody = incoming_object.physicsBody || null;
    
    // If not found, check userData
    if (!physicsBody && incoming_object.userData && incoming_object.userData.physicsBody) {
        physicsBody = incoming_object.userData.physicsBody;
    } 
    
    // Try getting it from the root model
    if (!physicsBody && incoming_object.userData && incoming_object.userData.rootModel) {
        const rootModel = incoming_object.userData.rootModel;
        // Check root model direct property
        physicsBody = rootModel.physicsBody;
        // If not found, check root model userData
        if (!physicsBody && rootModel.userData && rootModel.userData.physicsBody) {
            physicsBody = rootModel.userData.physicsBody;
        }
    }
    
    // Last resort - try the asset storage lookup
    if (!physicsBody) {
        const body_pair = AssetStorage.get_instance().get_body_pair_by_mesh(incoming_object);
        if (body_pair) {
            physicsBody = body_pair[1]; // Extract the body from [mesh, body]
        }
    }
    
    // If we still don't have a physics body, try to find it by traversing up the object hierarchy
    if (!physicsBody) {
        let current = incoming_object;
        let depth = 0;
        const MAX_DEPTH = 10;
        
        while (current && !physicsBody && depth < MAX_DEPTH) {
            // Try direct property
            if (current.physicsBody) {
                physicsBody = current.physicsBody;
                break;
            }
            
            // Try userData
            if (current.userData && current.userData.physicsBody) {
                physicsBody = current.userData.physicsBody;
                break;
            }
            
            // Move up in hierarchy
            if (current.parent) {
                current = current.parent;
                depth++;
            } else {
                break;
            }
        }
    }
    
    // If no physics body found after all attempts, return
    if (!physicsBody) {
        console.warn(`No physics body found for release: ${incoming_object.name}`);
        return;
    }
    
    if(BLORKPACK_FLAGS.ACTIVATE_LOGS) {
        // We successfully found a physics body, proceed with releasing
        console.log(`Successfully releasing physics body for ${incoming_object.name}`);
    }
    
    // Change back to dynamic body
    physicsBody.setBodyType(RAPIER.RigidBodyType.Dynamic);
    
    // Calculate impulse based on recent movement
    const current_time = performance.now();
    const time_diff = (current_time - last_time) / 1000; // Convert to seconds
    
    if (time_diff > 0) {
        const current_pos = physicsBody.translation();
        const vel = new THREE.Vector3(
            (current_pos.x - last_position.x) / time_diff,
            (current_pos.y - last_position.y) / time_diff,
            (current_pos.z - last_position.z) / time_diff
        );
        
        // Apply calculated impulse
        physicsBody.applyImpulse({ x: vel.x * THROW_MULTIPLIER, y: vel.y * THROW_MULTIPLIER, z: vel.z * THROW_MULTIPLIER }, true);
    }
    
    // Make sure gravity is properly applied
    physicsBody.setGravityScale(1.0);
    
    // Mark object as no longer moving
    incoming_object.userData.isMoving = false;
}
