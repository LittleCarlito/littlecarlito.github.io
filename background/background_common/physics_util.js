import { THREE } from "../../common";

const THROW_MULTIPLIER = 0.1; // Adjust this to control throw strength
const SHOVE_FORCE = 4; // Adjust this value to control the force of the shove
const ZOOM_AMOUNT = 2;  // Amount to move per scroll event
let current_mouse_pos = new THREE.Vector2();
let initial_grab_distance = 15; // Store initial distance when grabbed
let last_position = new THREE.Vector3();
let current_velocity = new THREE.Vector3();
let last_time = 0;

export function shove_object(incoming_object, incoming_source, primary_container) {
    // Find the corresponding rigid body for the cube
    const cube_name = incoming_object.name;
    // Get the dynamic_bodies from the primary_container
    const dynamic_bodies = primary_container.dynamic_bodies;
    // Find the matching body for the cube mesh
    const body_pair = dynamic_bodies.find(([mesh]) => mesh.name === cube_name);
    if (!body_pair) return;
    const [_, body] = body_pair;
    // Calculate direction from camera to cube
    const camera_position = new THREE.Vector3();
    incoming_source.getWorldPosition(camera_position);
    const cube_position = new THREE.Vector3();
    incoming_object.getWorldPosition(cube_position);
    const direction = new THREE.Vector3()
        .subVectors(cube_position, camera_position)
        .normalize();
    // Apply the impulse force in the calculated direction
    body.applyImpulse(
        { x: direction.x * SHOVE_FORCE, y: direction.y * SHOVE_FORCE, z: direction.z * SHOVE_FORCE },
        true
    );
}

// Update this in the mousemove handler
export function update_mouse_position(e) {
    current_mouse_pos.x = (e.clientX / window.innerWidth) * 2 - 1;
    current_mouse_pos.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

export function translate_object(incoming_object, incoming_camera, primary_container) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
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

export function zoom_object_in(incoming_object, primary_container, RAPIER) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
    if (!body_pair) return;
    // Adjust the grab distance
    initial_grab_distance += ZOOM_AMOUNT;
}

export function zoom_object_out(incoming_object, primary_container, RAPIER) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
    if (!body_pair) return;
    // Adjust the grab distance
    initial_grab_distance -= ZOOM_AMOUNT;
}

export function grab_object(incoming_object, incoming_camera, primary_container, RAPIER) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
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
    current_velocity.set(0, 0, 0);
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
}

export function release_object(incoming_object, primary_container, RAPIER) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
    if (!body_pair) return;
    const [_, body] = body_pair;
    // Change back to dynamic body
    body.setBodyType(RAPIER.RigidBodyType.Dynamic);
    // Apply velocity as impulse
    body.applyImpulse(
        { 
            x: current_velocity.x * THROW_MULTIPLIER, 
            y: current_velocity.y * THROW_MULTIPLIER, 
            z: current_velocity.z * THROW_MULTIPLIER 
        },
        true
    );
}
