import * as THREE from 'three';
import { checkHandleHover, getIsDragging } from '../drag-util';
import { getState } from '../state';
import {
    bones,
    boneMaterial,
    lockedBones,
    boneSideMaterial, 
    furthestBoneHandle, 
    boneVisualsGroup,
    updateAllBoneMatrices,
    restoreLockedBoneRotations 
} from '../bone-util';
import { createJointLabels } from './rig-factory';
import { refreshJointsData } from '../../ui/rig-panel';

export let rigDetails = null;

// Variables used for rig visualization 
export let rigOptions = {
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
 * Update one or multiple rig options
 * @param {Object} options - Object containing the options to update
 */
export function updateRigOptions(options) {
    if (!options || typeof options !== 'object') return;
    // Update provided options
    Object.keys(options).forEach(key => {
        if (rigOptions.hasOwnProperty(key)) {
            rigOptions[key] = options[key];
        }
    });
}

/**
 * Update the rig visualization based on option changes
 */
export function updateRigVisualization() {
    if (!boneVisualsGroup) return;
    
    console.log('Updating rig visualization with options:', JSON.stringify(rigOptions));
    
    // Toggle rig visibility without affecting creation or forceZ
    if (boneVisualsGroup) {
        boneVisualsGroup.visible = rigOptions.displayRig;
    }
    
    if (furthestBoneHandle) {
        furthestBoneHandle.visible = rigOptions.displayRig;
    }
    
    // Update joint labels visibility
    const state = getState();
    const labelGroup = state.scene ? state.scene.getObjectByName("JointLabels") : null;
    
    if (labelGroup) {
        console.log('Updating joint labels visibility to:', rigOptions.showJointLabels && rigOptions.displayRig);
        labelGroup.visible = rigOptions.showJointLabels && rigOptions.displayRig;
        
        // Update individual label positions
        labelGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    } else if (rigOptions.showJointLabels && rigOptions.displayRig && state.scene) {
        // If we don't have labels but should, create them
        console.log('No label group found, creating new joint labels');
        createJointLabels(state.scene);
    }
    
    // Refresh the joints data
    refreshJointsData();
    
    // Update primary and secondary colors and wireframe state
    if (boneMaterial) {
        boneMaterial.color.setHex(rigOptions.primaryColor);
        boneMaterial.wireframe = rigOptions.wireframe;
        boneMaterial.needsUpdate = true;
    }
    
    if (boneSideMaterial) {
        boneSideMaterial.color.setHex(rigOptions.secondaryColor);
        boneSideMaterial.wireframe = rigOptions.wireframe;
        boneSideMaterial.needsUpdate = true;
    }
    
    boneVisualsGroup.traverse(object => {
        // Update bone sides
        if (object.isMesh && object.userData.bonePart === 'side') {
            // Update color of alternating sides
            if (!object.userData.sideIndex || object.userData.sideIndex % 2 === 0) {
                // Even sides use primary color
                object.material.color.setHex(rigOptions.primaryColor);
            } else {
                // Odd sides use secondary color
                object.material.color.setHex(rigOptions.secondaryColor);
            }
            
            // Update wireframe setting
            object.material.wireframe = rigOptions.wireframe;
            object.material.needsUpdate = true;
        }
        
        // Update joint materials
        if (object.isMesh && object.userData.bonePart === 'cap') {
            object.material.color.setHex(rigOptions.jointColor);
            object.material.wireframe = rigOptions.wireframe;
            object.material.needsUpdate = true;
            
            // Force update visibility of joint labels
            if (object.userData.label) {
                object.userData.label.visible = rigOptions.showJointLabels && rigOptions.displayRig;
                
                // Make sure the label appears on top when Force Z is enabled
                if (rigOptions.forceZ) {
                    object.userData.label.renderOrder = 1025; // Higher than joint spheres but lower than control handle
                    object.userData.label.material.depthTest = false;
                } else {
                    object.userData.label.renderOrder = 500;
                    object.userData.label.material.depthTest = false; // Always render on top
                }
                object.userData.label.material.needsUpdate = true;
            }
        }
    });
    
    // Apply Force Z settings regardless of rig visibility
    if (boneVisualsGroup) {
        if (rigOptions.forceZ) {
            console.log('Applying Force Z index to rig');
            // Move the rig to render on top by setting renderOrder to a high value
            // and disabling depth test for materials
            boneVisualsGroup.renderOrder = 1000; // High value to render after other objects
            
            if (boneMaterial) {
                boneMaterial.depthTest = false;
                boneMaterial.needsUpdate = true;
            }
            
            if (boneSideMaterial) {
                boneSideMaterial.depthTest = false;
                boneSideMaterial.needsUpdate = true;
            }
            
            // Set renderOrder and disable depth test for EVERY mesh in the group
            boneVisualsGroup.traverse(object => {
                if (object.isMesh) {
                    if (object.userData.bonePart === 'cap') {
                        // Joint spheres get higher renderOrder
                        object.renderOrder = 1020;
                    } else if (object.userData.bonePart === 'side') {
                        // Bone sides get lower renderOrder
                        object.renderOrder = 1010;
                    } else {
                        // Everything else
                        object.renderOrder = 1000;
                    }
                    
                    if (object.material) {
                        object.material.depthTest = false;
                        object.material.needsUpdate = true;
                    }
                }
            });
            
            if (furthestBoneHandle && furthestBoneHandle.material) {
                // Control handle gets highest renderOrder
                furthestBoneHandle.renderOrder = 1030;
                furthestBoneHandle.material.depthTest = false;
                furthestBoneHandle.material.needsUpdate = true;
            }
        } else {
            console.log('Resetting Force Z index for rig');
            // Reset normal depth behavior
            boneVisualsGroup.renderOrder = 0;
            
            if (boneMaterial) {
                boneMaterial.depthTest = true;
                boneMaterial.needsUpdate = true;
            }
            
            if (boneSideMaterial) {
                boneSideMaterial.depthTest = true;
                boneSideMaterial.needsUpdate = true;
            }
            
            // Reset renderOrder and enable depth test for EVERY mesh in the group
            boneVisualsGroup.traverse(object => {
                if (object.isMesh) {
                    if (object.userData.bonePart === 'cap') {
                        // Even without force-Z, joints should be on top of bones
                        object.renderOrder = 10;
                    } else {
                        object.renderOrder = 0;
                    }
                    
                    if (object.material) {
                        object.material.depthTest = true;
                        object.material.needsUpdate = true;
                    }
                }
            });
            
            if (furthestBoneHandle && furthestBoneHandle.material) {
                // Control handle should still be above everything else
                furthestBoneHandle.renderOrder = 20;
                furthestBoneHandle.material.depthTest = true;
                furthestBoneHandle.material.needsUpdate = true;
            }
        }
    }
}


/**
 * Reset the rig to its initial position
 */
export function resetRig() {
    if (!bones.length) return;
    
    console.log('Resetting rig to initial position from GLB');
    
    // Reset all bone rotations to their initial values from when the model was loaded
    bones.forEach(bone => {
        // Skip locked bones
        if (lockedBones.has(bone.uuid)) return;
        
        // If we have stored initial rotation, use it
        if (bone.userData.initialRotation) {
            bone.rotation.set(
                bone.userData.initialRotation.x,
                bone.userData.initialRotation.y,
                bone.userData.initialRotation.z
            );
            bone.rotation.order = bone.userData.initialRotation.order;
        } else {
            // Fallback to identity if no initial rotation stored
            bone.rotation.set(0, 0, 0);
        }
    });
    
    // Update all matrices
    updateAllBoneMatrices();
    
    // If there's a furthest bone handle, update its position
    if (furthestBoneHandle && furthestBoneHandle.userData.updatePosition) {
        furthestBoneHandle.userData.updatePosition();
    }
    
    console.log('Rig reset complete');
}

/**
 * Update the position of a joint label
 * @param {Object} label - The label sprite
 * @param {Object} joint - The joint the label is attached to
 */
export function updateLabelPosition(label, joint) {
    if (!label || !joint) return;
    
    // Get the joint's world position
    const jointPos = new THREE.Vector3();
    joint.getWorldPosition(jointPos);
    
    // Position the label slightly above the joint
    label.position.copy(jointPos);
    
    // Add offset based on joint position (top or bottom)
    if (joint.position && joint.position.y > 0) {
        // Top joint - place above
        label.position.y += joint.geometry.parameters.radius * 2;
    } else {
        // Bottom joint - place to the side
        label.position.x += joint.geometry.parameters.radius * 2;
    }
}

/**
 * Clear all joint labels from the scene
 * @param {Object} scene - The Three.js scene
 */
export function clearJointLabels(scene) {
    const existingLabels = scene.getObjectByName("JointLabels");
    if (existingLabels) {
        scene.remove(existingLabels);
    }
}

/**
 * Update animation for rig visuals
 */
export function updateRigAnimation() {
    // Set visibility based on displayRig flag
    // But keep force Z settings applied regardless of visibility
    if (!rigOptions.displayRig) {
        // When displayRig is off, hide visuals but maintain ForceZ settings
        if (furthestBoneHandle) {
            furthestBoneHandle.visible = false;
        }
        if (boneVisualsGroup) {
            boneVisualsGroup.visible = false;
            
            // Still update positions even when hidden to ensure ForceZ works properly
            // when the rig becomes visible again
            boneVisualsGroup.children.forEach(boneGroup => {
                if (boneGroup.userData.updatePosition) {
                    boneGroup.userData.updatePosition();
                }
            });
        }
        return;
    }
    
    // When displayRig is on, update and show everything
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