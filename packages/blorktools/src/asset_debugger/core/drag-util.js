import * as THREE from 'three';
import { furthestBoneHandle, rigOptions } from './rig/rig-manager';
import { restoreLockedBoneRotations, moveBonesForTarget, updateBoneVisuals } from "../ui/rig-panel";
import { getState } from "./state";

// Raycaster for mouse interaction
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredHandle = null;
// Drag state tracking
let isDragging = false;
let dragStartPosition = new THREE.Vector3();
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();
let dragTarget = null;
let dragTargetPosition = new THREE.Vector3();

/**
 * Set up mouse listeners for handle interaction
 * @param {Object} scene - The Three.js scene
 */
export function setupMouseListeners(scene) {
    const state = getState();
    const renderer = state.renderer;
    if (!renderer) return;
    const domElement = renderer.domElement;
    // Mouse move handler
    domElement.addEventListener('mousemove', (event) => {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        // Update raycaster with the new mouse position
        if (state.camera) {
            raycaster.setFromCamera(mouse, state.camera);
        }
        // Check for handle hover
        checkHandleHover();
        // Handle dragging
        if (getIsDragging() && dragTarget) {
            handleDrag();
        }
    });
    // Mouse down handler
    domElement.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return; // Only handle left mouse button
        // Skip if Display Rig is not enabled
        if (!rigOptions.displayRig) return;
        const state = getState();
        if (!state.camera) return;
        // Check if we're clicking on a handle
        raycaster.setFromCamera(mouse, state.camera);
        const intersects = raycaster.intersectObject(furthestBoneHandle);
        if (intersects.length > 0) {
            console.log('Starting drag on handle:', furthestBoneHandle.name);
            startDrag(intersects[0], furthestBoneHandle);
            event.preventDefault();
        }
    });
    // Mouse up handler
    domElement.addEventListener('mouseup', (event) => {
        if (getIsDragging()) {
            stopDrag();
            event.preventDefault();
        }
    });
    // Mouse leave handler
    domElement.addEventListener('mouseleave', (event) => {
        if (getIsDragging()) {
            stopDrag();
        }
    });
}

/**
 * Check if mouse is hovering over the control handle
 */
export function checkHandleHover() {
    // Don't check for hover if rig display is disabled or handle doesn't exist
    if (!rigOptions.displayRig || !furthestBoneHandle || getIsDragging()) return;
    const state = getState();
    const camera = state.camera;
    const controls = state.controls; // Get orbit controls reference
    if (!camera) return;
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObject(furthestBoneHandle);
    // Handle hover state
    if (intersects.length > 0) {
        if (hoveredHandle !== furthestBoneHandle) {
            // Reset old hovered handle color if it exists and isn't the drag target
            if (hoveredHandle && hoveredHandle.material && hoveredHandle !== dragTarget) {
                hoveredHandle.material.color.setHex(rigOptions.normalColor);
                hoveredHandle.material.needsUpdate = true;
            }
            // Set new hovered handle and update color
            hoveredHandle = furthestBoneHandle;
            // If not currently dragging this handle, highlight it
            if (!getIsDragging() || hoveredHandle !== dragTarget) {
                hoveredHandle.material.color.setHex(rigOptions.hoverColor);
                hoveredHandle.material.needsUpdate = true;
            }
        }
    } else if (hoveredHandle && !getIsDragging()) {
        // No hit and not dragging, reset hovered handle color
        if (hoveredHandle.material) {
            hoveredHandle.material.color.setHex(rigOptions.normalColor);
            hoveredHandle.material.needsUpdate = true;
        }
        hoveredHandle = null;
    }
}


/**
 * Handle dragging logic
 */
function handleDrag() {
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
 * Start dragging a control handle
 * @param {Object} intersection - The intersection data from raycaster
 * @param {Object} handle - The handle being dragged
 */
function startDrag(intersection, handle) {
    // Ensure the handle exists
    if (!handle) return;
    // Set the dragging state to true
    setIsDragging(true);
    dragTarget = handle;
    // Update material to active color
    if (handle.material) {
        handle.material.color.setHex(rigOptions.activeColor);
        handle.material.needsUpdate = true;
    }
    // Store the initial position
    dragTargetPosition.copy(handle.position);
    // Get the state
    const state = getState();
    // Create a drag plane perpendicular to the camera
    const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(state.camera.quaternion);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, dragTargetPosition);
    // Calculate offset for precise dragging
    const dragIntersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, dragIntersectionPoint);
    dragOffset.subVectors(dragTargetPosition, dragIntersectionPoint);
    console.log('Drag started at', dragTargetPosition);
}

/**
 * Stop dragging operation
 */
function stopDrag() {
    if (!getIsDragging() || !dragTarget) return;
    setIsDragging(false);
    // Reset material to normal or hover color based on current state
    if (dragTarget.material) {
        const isHovered = dragTarget === hoveredHandle;
        dragTarget.material.color.setHex(isHovered ? rigOptions.hoverColor : rigOptions.normalColor);
        dragTarget.material.needsUpdate = true;
    }
    // Re-enable orbit controls
    const state = getState();
    if (state.controls && !state.controls.enabled) {
        state.controls.enabled = true;
        document.body.style.cursor = 'auto';
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