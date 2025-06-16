import * as THREE from 'three';
import { rigOptions, getLabelGroup } from './rig-controller';
import { restoreLockedBoneRotations, updateBoneVisuals, moveBonesForTarget } from './bone-kinematics';
import { getState } from '../state/scene-state';
import { primaryRigHandle } from './rig-handle-factory';

// Raycaster for mouse interaction
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredHandle = null;
let hoveredLabelHeader = null; // Track which label header is currently hovered
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
        
        // Since we're removing label header click handling, just check for control handle clicks
        raycaster.setFromCamera(mouse, state.camera);
        const intersects = raycaster.intersectObject(primaryRigHandle);
        if (intersects.length > 0) {
            console.log('Starting drag on handle:', primaryRigHandle.name);
            startDrag(intersects[0], primaryRigHandle);
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
        
        // Reset any hover states when mouse leaves the canvas
        resetHoveredStates();
    });
}

/**
 * Reset all hovered states when mouse leaves canvas or on other events
 */
function resetHoveredStates() {
    // Reset control handle hover state
    if (hoveredHandle && hoveredHandle.material) {
        hoveredHandle.material.color.setHex(rigOptions.normalColor);
        hoveredHandle.material.needsUpdate = true;
        hoveredHandle = null;
    }
    
    // Reset label header hover state
    if (hoveredLabelHeader && hoveredLabelHeader.material) {
        hoveredLabelHeader.material.opacity = 0.8; // Default opacity
        hoveredLabelHeader.material.needsUpdate = true;
        hoveredLabelHeader = null;
    }
    
    // Reset mouse cursor and controls
    document.body.style.cursor = 'auto';
    const state = getState();
    if (state.controls && !state.controls.enabled && !getIsDragging()) {
        state.controls.enabled = true;
    }
}

/**
 * Get all label sprites from the scene
 * @returns {Array} Array of label sprites
 */
function getAllLabels() {
    const labels = [];
    
    // Add joint labels if they exist
    const jointLabelGroup = getLabelGroup('joint');
    if (jointLabelGroup) {
        jointLabelGroup.children.forEach(label => {
            if (label.userData && (label.userData.isJointLabel || label.userData.isBoneLabel)) {
                labels.push(label);
            }
        });
    }
    
    // Add bone labels if they exist
    const boneLabelGroup = getLabelGroup('bone');
    if (boneLabelGroup) {
        boneLabelGroup.children.forEach(label => {
            if (label.userData && label.userData.isBoneLabel) {
                labels.push(label);
            }
        });
    }
    
    return labels;
}

/**
 * Check if mouse is hovering over the control handle or any label headers
 */
export function checkHandleHover() {
    // Don't check for hover if rig display is disabled
    if (!rigOptions.displayRig) return;
    
    const state = getState();
    const camera = state.camera;
    const controls = state.controls; // Get orbit controls reference
    if (!camera) return;
    
    // Skip hover processing if we're dragging
    if (getIsDragging()) return;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, state.camera);
    
    // Track if any hover was detected in this cycle
    let hoverDetected = false;
    
    // First check the furthest bone handle
    if (primaryRigHandle) {
        const handleIntersects = raycaster.intersectObject(primaryRigHandle);
        
        if (handleIntersects.length > 0) {
            // We hit the handle
            hoverDetected = true;
            
            // Set or update hover state
            if (hoveredHandle !== primaryRigHandle) {
                // Reset any previously hovered label header
                if (hoveredLabelHeader) {
                    hoveredLabelHeader.material.opacity = 0.8; // Default opacity
                    hoveredLabelHeader.material.needsUpdate = true;
                    hoveredLabelHeader = null;
                }
                
                // Set the handle as hovered
                hoveredHandle = primaryRigHandle;
                hoveredHandle.material.color.setHex(rigOptions.hoverColor);
                hoveredHandle.material.needsUpdate = true;
            }
            
            // Update cursor and controls
            document.body.style.cursor = 'pointer';
            if (controls && controls.enabled) {
                controls.enabled = false;
            }
        } 
        else if (hoveredHandle === primaryRigHandle) {
            // We had the handle hovered but no longer
            hoveredHandle.material.color.setHex(rigOptions.normalColor);
            hoveredHandle.material.needsUpdate = true;
            hoveredHandle = null;
        }
    }
    
    // Now check label headers if nothing else is hovered
    if (!hoverDetected) {
        const allLabels = getAllLabels();
        const labelIntersects = raycaster.intersectObjects(allLabels);
        
        if (labelIntersects.length > 0) {
            for (let i = 0; i < labelIntersects.length; i++) {
                const label = labelIntersects[i].object;
                
                // Skip if the label doesn't have header hover checking
                if (!label.userData || !label.userData.checkHeaderHover) continue;
                
                // Convert intersection point to local coordinates
                const localPoint = label.worldToLocal(labelIntersects[i].point.clone());
                
                // Check if over header area
                if (label.userData.checkHeaderHover(localPoint)) {
                    // Hovering over a header
                    hoverDetected = true;
                    
                    // Update hover state
                    if (hoveredLabelHeader !== label) {
                        // Reset previous hover states
                        if (hoveredHandle) {
                            hoveredHandle.material.color.setHex(rigOptions.normalColor);
                            hoveredHandle.material.needsUpdate = true;
                            hoveredHandle = null;
                        }
                        
                        if (hoveredLabelHeader) {
                            hoveredLabelHeader.material.opacity = 0.8; // Default opacity
                            hoveredLabelHeader.material.needsUpdate = true;
                        }
                        
                        // Set new hover state
                        hoveredLabelHeader = label;
                        hoveredLabelHeader.material.opacity = 1.0; // Full opacity on hover
                        hoveredLabelHeader.material.needsUpdate = true;
                        
                        // Store the hover state
                        label.userData.isMouseOverHeader = true;
                    }
                    
                    // Update cursor and controls
                    document.body.style.cursor = 'pointer';
                    if (controls && controls.enabled) {
                        controls.enabled = false;
                    }
                    
                    break; // Found a header hover, no need to check more
                }
                else if (hoveredLabelHeader === label) {
                    // We were hovering this label but now we're not over the header
                    hoveredLabelHeader.material.opacity = 0.8; // Reset to default opacity
                    hoveredLabelHeader.material.needsUpdate = true;
                    hoveredLabelHeader.userData.isMouseOverHeader = false;
                    hoveredLabelHeader = null;
                }
            }
        }
    }
    
    // If no hover detected anywhere, reset everything
    if (!hoverDetected) {
        // Reset control handle hover
        if (hoveredHandle) {
            hoveredHandle.material.color.setHex(rigOptions.normalColor);
            hoveredHandle.material.needsUpdate = true;
            hoveredHandle = null;
        }
        
        // Reset label header hover
        if (hoveredLabelHeader) {
            hoveredLabelHeader.material.opacity = 0.8; // Reset to default opacity
            hoveredLabelHeader.material.needsUpdate = true;
            hoveredLabelHeader.userData.isMouseOverHeader = false;
            hoveredLabelHeader = null;
        }
        
        // Reset cursor and controls
        document.body.style.cursor = 'auto';
        if (controls && !controls.enabled) {
            controls.enabled = true;
        }
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
        if (dragTarget === primaryRigHandle && dragTarget.userData.controlledBone) {
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