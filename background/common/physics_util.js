import * as THREE from 'three';

const SHOVE_FORCE = 4; // Adjust this value to control the force of the shove
const ZOOM_AMOUNT = 2;  // Amount to move per scroll event
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
    const cube_name = incoming_object.name;
    const dynamic_bodies = primary_container.dynamic_bodies;
    const body_pair = dynamic_bodies.find(([mesh]) => mesh.name === cube_name);
    if (!body_pair) return;
    const [_, body] = body_pair;

    // Get ray from camera through mouse point
    const ray_start = new THREE.Vector3();
    const ray_end = new THREE.Vector3();
    const ray_dir = new THREE.Vector3();
    ray_start.setFromMatrixPosition(incoming_camera.matrixWorld);
    ray_end.set(current_mouse_pos.x, current_mouse_pos.y, 1).unproject(incoming_camera);
    ray_dir.subVectors(ray_end, ray_start).normalize();

    // Get camera's forward vector
    const camera_forward = new THREE.Vector3(0, 0, -1);
    camera_forward.applyQuaternion(incoming_camera.quaternion);

    // Use fixed distance from camera
    const fixed_distance = 15; // We can adjust this value
    const new_position = ray_start.clone().add(ray_dir.multiplyScalar(fixed_distance));
    
    // Lock rotation when grabbed
    const current_rot = body.rotation();
    body.setTranslation(new_position);
    body.setRotation(current_rot);
}

export function zoom_object_in(incoming_object, primary_container) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
    if (!body_pair) return;
    const [mesh, _] = body_pair;
    mesh.position.z += ZOOM_AMOUNT;
}

export function zoom_object_out(incoming_object, primary_container) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
    if (!body_pair) return;
    const [mesh, _] = body_pair;
    mesh.position.z -= ZOOM_AMOUNT;
}

export function grab_object(incoming_object, primary_container, RAPIER) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
    if (!body_pair) return;
    const [_, body] = body_pair;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
}

export function release_object(incoming_object, primary_container, RAPIER) {
    const body_pair = primary_container.dynamic_bodies.find(([mesh]) => mesh.name === incoming_object.name);
    if (!body_pair) return;
    const [_, body] = body_pair;
    body.setBodyType(RAPIER.RigidBodyType.Dynamic);
}
