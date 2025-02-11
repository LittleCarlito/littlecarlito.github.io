import * as THREE from 'three';

const SHOVE_FORCE = 4; // Adjust this value to control the force of the shove

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