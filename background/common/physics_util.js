import * as THREE from 'three';

const SHOVE_FORCE = 4; // Adjust this value to control the force of the shove
let current_mouse_pos = new THREE.Vector2();

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
    // Find the corresponding rigid body
    const cube_name = incoming_object.name;
    const dynamic_bodies = primary_container.dynamic_bodies;
    const body_pair = dynamic_bodies.find(([mesh]) => mesh.name === cube_name);
    if (!body_pair) return;
    const [_, body] = body_pair;

    // Create vectors for the ray
    const ray_start = new THREE.Vector3();
    const ray_end = new THREE.Vector3();
    const ray_dir = new THREE.Vector3();

    // Get ray from camera through mouse point
    ray_start.setFromMatrixPosition(incoming_camera.matrixWorld);
    ray_end.set(current_mouse_pos.x, current_mouse_pos.y, 1).unproject(incoming_camera);
    ray_dir.subVectors(ray_end, ray_start).normalize();

    // Get the cube's current z-distance from camera
    const cube_pos = new THREE.Vector3();
    incoming_object.getWorldPosition(cube_pos);
    const camera_pos = new THREE.Vector3();
    incoming_camera.getWorldPosition(camera_pos);
    const z_distance = cube_pos.distanceTo(camera_pos);

    // Calculate new position maintaining z-distance
    const new_position = ray_start.clone().add(ray_dir.multiplyScalar(z_distance));
    
    // Update the rigid body position
    body.setTranslation(new_position);
}