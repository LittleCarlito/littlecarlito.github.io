import * as THREE from 'three';
import { furthestBoneHandle } from "./rig/rig-factory";
import { dragTarget, raycaster, dragPlane, dragOffset, restoreLockedBoneRotations, moveBonesForTarget, updateBoneVisuals } from "../ui/rig-panel";
import { getState } from "./state";

let isDragging = false;

/**
 * Handle dragging logic
 */
export function handleDrag() {
    if (!isDragging || !dragTarget) return;
    const state = getState();
    // Get current intersection point with drag plane
    const planeIntersection = new THREE.Vector3();
    // Check if ray intersects plane
    if (raycaster.ray.intersectPlane(dragPlane, planeIntersection)) {
        // Apply the offset to maintain the grab point
        planeIntersection.add(dragOffset);
        // Move handle to new position
        dragTarget.position.copy(planeIntersection);
        // Apply IK if this is the furthest bone handle
        if (dragTarget === furthestBoneHandle && dragTarget.userData.controlledBone) {
            const controlledBone = dragTarget.userData.controlledBone;
            // Even if the controlled bone is locked, we still want to move other bones in the chain
            // This is different from before - we don't check if the target bone is locked here
            // Store current locked bone rotations
            restoreLockedBoneRotations();
            // Use the moveBonesForTarget function to handle IK chain properly
            moveBonesForTarget(controlledBone, planeIntersection);
            // Restore locked bone rotations again
            restoreLockedBoneRotations();
            // Force immediate update of visual bone meshes during drag
            updateBoneVisuals();
        }
    }
}

/**
 * Update the isDragging state
 * @param {Boolean} dragging - The new dragging state
 */
export function setIsDragging(dragging) {
    isDragging = dragging;
}

/**
 * Returns the current dragging state
 * @returns {Boolean} The current dragging state
 */
export function getIsDragging() {
    return isDragging;
}