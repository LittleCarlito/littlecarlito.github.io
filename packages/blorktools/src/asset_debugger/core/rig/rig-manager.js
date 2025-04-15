import * as THREE from 'three';
import { checkHandleHover, getIsDragging } from '../drag-util';
import { getState } from '../state';
import { furthestBoneHandle, boneVisualsGroup, restoreLockedBoneRotations } from '../bone-util';

export let rigDetails = null;

// Variables used for rig visualization 
export const rigOptions = {
    displayRig: false, // Default to not visible
    forceZ: false,
    wireframe: true,
    primaryColor: 0xFF00FF, // Magenta
    secondaryColor: 0xFFFF00, // Yellow
    jointColor: 0x00FFFF, // Cyan
    showJointLabels: false, // Default to hidden
    normalColor: 0xFF0000, // Red - for control handles normal state
    hoverColor: 0x00FF00,  // Green - for control handles hover state
    activeColor: 0x0000FF  // Blue - for control handles active/dragging state
};

/**
 * Update animation for rig visuals
 */
export function updateRigAnimation() {
    // Only update rig visuals if Display Rig is enabled
    if (!rigOptions.displayRig) {
        // Even when displayRig is off, we should ensure handles are not visible
        if (furthestBoneHandle) {
            furthestBoneHandle.visible = false;
        }
        if (boneVisualsGroup) {
            boneVisualsGroup.visible = false;
        }
        return;
    }
    
    // Update bone visuals
    if (boneVisualsGroup) {
        boneVisualsGroup.visible = true;
        boneVisualsGroup.children.forEach(boneGroup => {
            if (boneGroup.userData.updatePosition) {
                boneGroup.userData.updatePosition();
            }
        });
    }
    
    // Update furthest bone handle
    if (furthestBoneHandle) {
        furthestBoneHandle.visible = true;
        if (furthestBoneHandle.userData.updatePosition && !getIsDragging()) {
            // Only update handle position when not dragging
            furthestBoneHandle.userData.updatePosition();
        }
    }
    
    // Update joint labels
    const state = getState();
    const labelGroup = state.scene ? state.scene.getObjectByName("JointLabels") : null;
    if (labelGroup) {
        labelGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    }
    
    // Apply locked rotations to bones
    restoreLockedBoneRotations();
    
    // Check handle hover on each frame
    checkHandleHover();
}

/**
 * Clear existing rig visualization from the scene
 * @param {Object} scene - The Three.js scene
 */
export function clearRigVisualization(scene) {
    if (boneVisualsGroup) {
        scene.remove(boneVisualsGroup);
        boneVisualsGroup = null;
    }
    if (furthestBoneHandle) {
        scene.remove(furthestBoneHandle);
        furthestBoneHandle = null;
    }
}

/**
 * Update the rig details object with new values
 * @param {Object} newDetails - The new rig details object
 */
export function updateRigDetails(newDetails) {
    rigDetails = newDetails;
}