import * as THREE from 'three';
import { checkHandleHover, getIsDragging } from './rig-mouse-handler';
import { getState } from '../state/scene-state';
import {
    bones,
    boneMaterial,
    lockedBones,
    boneSideMaterial, 
    boneVisualsGroup,
    updateAllBoneMatrices,
    restoreLockedBoneRotations,
    clearBoneVisualsGroup
} from './bone-kinematics';
import { createBoneLabels, createJointLabels } from './rig-label-factory';
import { deduplicateItemsByName } from '../data/duplicate-handler';
import { clearPrimaryRigHandle, primaryRigHandle } from './rig-handle-factory';

export let rigDetails = null;
export const labelGroups = new Map(); // Map to store different types of label groups (joint, bone)

// Variables used for rig visualization 
export const rigOptions = {
    displayRig: true,
    forceZ: true,
    wireframe: false,
    primaryColor: 0x4CAF50,
    secondaryColor: 0xFFFF00,
    jointColor: 0x00FFFF,
    showJointLabels: false,
    showBoneLabels: false,
    normalColor: 0xFF0000,
    hoverColor: 0x00FF00,
    activeColor: 0x0000FF,
    worldGravity: 1.0
};

/**
 * Update one or multiple rig options
 * @param {Object} options - Object containing the options to update
 */
export function updateRigOptions(options) {
    if (!options) return;
    
    // Update each property
    if (options.displayRig !== undefined) rigOptions.displayRig = options.displayRig;
    if (options.forceZ !== undefined) rigOptions.forceZ = options.forceZ;
    if (options.wireframe !== undefined) rigOptions.wireframe = options.wireframe;
    if (options.primaryColor !== undefined) rigOptions.primaryColor = options.primaryColor;
    if (options.secondaryColor !== undefined) rigOptions.secondaryColor = options.secondaryColor;
    if (options.jointColor !== undefined) rigOptions.jointColor = options.jointColor;
    if (options.showJointLabels !== undefined) rigOptions.showJointLabels = options.showJointLabels;
    if (options.showBoneLabels !== undefined) rigOptions.showBoneLabels = options.showBoneLabels;
    if (options.normalColor !== undefined) rigOptions.normalColor = options.normalColor;
    if (options.hoverColor !== undefined) rigOptions.hoverColor = options.hoverColor;
    if (options.activeColor !== undefined) rigOptions.activeColor = options.activeColor;
    if (options.worldGravity !== undefined) rigOptions.worldGravity = options.worldGravity;
    
    console.log('Rig options updated:', rigOptions);
    
    // Dispatch an event to notify other components of the change
    const event = new CustomEvent('rigOptionsChange', {
        detail: rigOptions
    });
    document.dispatchEvent(event);
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
    
    if (primaryRigHandle) {
        primaryRigHandle.visible = rigOptions.displayRig;
    }
    
    // Update joint labels visibility using the dedicated functions
    if (rigOptions.showJointLabels && rigOptions.displayRig) {
        console.log('Showing joint labels');
        showLabels('joint');
    } else {
        console.log('Hiding joint labels');
        hideLabels('joint');
    }
    
    // Update bone labels visibility using the dedicated functions
    if (rigOptions.showBoneLabels && rigOptions.displayRig) {
        console.log('Showing bone labels');
        showLabels('bone');
    } else {
        console.log('Hiding bone labels');
        hideLabels('bone');
    }
    
    // Create labels if needed but don't exist yet
    const state = getState();
    
    // Joint labels
    const jointLabelGroup = state.scene ? state.scene.getObjectByName("JointLabels") : null;
    
    if (jointLabelGroup) {
        console.log('Updating joint labels visibility to:', rigOptions.showJointLabels && rigOptions.displayRig);
        
        // Update individual label positions
        jointLabelGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    } else if (rigOptions.displayRig && state.scene) {
        // If we don't have labels but rig is displayed, create them
        console.log('No joint label group found, creating new joint labels');
        createJointLabels(state.scene);
        
        // Set visibility based on showJointLabels option
        if (rigOptions.showJointLabels) {
            showLabels('joint');
        } else {
            hideLabels('joint');
        }
    }
    
    // Bone labels
    const boneLabelGroup = state.scene ? state.scene.getObjectByName("BoneLabels") : null;
    
    if (boneLabelGroup) {
        console.log('Updating bone labels visibility to:', rigOptions.showBoneLabels && rigOptions.displayRig);
        
        // Update individual label positions
        boneLabelGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    } else if (rigOptions.displayRig && state.scene) {
        // If we don't have bone labels but rig is displayed, create them
        console.log('No bone label group found, creating new bone labels');
        createBoneLabels(state.scene);
        
        // Set visibility based on showBoneLabels option
        if (rigOptions.showBoneLabels) {
            showLabels('bone');
        } else {
            hideLabels('bone');
        }
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
            
            if (primaryRigHandle && primaryRigHandle.material) {
                // Control handle gets highest renderOrder
                primaryRigHandle.renderOrder = 1030;
                primaryRigHandle.material.depthTest = false;
                primaryRigHandle.material.needsUpdate = true;
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
            
            if (primaryRigHandle && primaryRigHandle.material) {
                // Control handle should still be above everything else
                primaryRigHandle.renderOrder = 20;
                primaryRigHandle.material.depthTest = true;
                primaryRigHandle.material.needsUpdate = true;
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
    if (primaryRigHandle && primaryRigHandle.userData.updatePosition) {
        primaryRigHandle.userData.updatePosition();
    }
    
    console.log('Rig reset complete');
}

/**
 * Update a label's position to follow its joint
 * @param {Object} label - The label to update
 * @param {Object} joint - The joint the label is attached to
 */
export function updateLabelPosition(label, joint) {
    if (!label || !joint) return;
    
    // Get the joint's world position
    const jointPos = new THREE.Vector3();
    joint.getWorldPosition(jointPos);
    
    // Position the label slightly above the joint
    label.position.copy(jointPos);
    
    // Get default offset in case geometry is missing
    let offset = 0.2;
    
    // Add offset based on joint position and geometry if available
    if (joint.geometry && joint.geometry.parameters) {
        // Use the joint's geometry parameters when available
        if (joint.geometry.parameters.radius) {
            offset = joint.geometry.parameters.radius * 2;
        } else if (joint.geometry.parameters.radiusTop) {
            offset = joint.geometry.parameters.radiusTop * 2;
        }
    }
    
    // Apply offset based on joint position (top or bottom)
    if (joint.position && joint.position.y > 0) {
        // Top joint - place above
        label.position.y += offset;
    } else {
        // Bottom joint - place to the side
        label.position.x += offset;
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
        if (primaryRigHandle) {
            primaryRigHandle.visible = false;
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
    if (primaryRigHandle) {
        primaryRigHandle.visible = true;
        if (primaryRigHandle.userData.updatePosition && !getIsDragging()) {
            // Only update handle position when not dragging
            primaryRigHandle.userData.updatePosition();
        }
    }
    
    // Update joint labels
    const state = getState();
    
    // Update all label groups
    for (const [type, group] of labelGroups) {
        if (group) {
            group.children.forEach(label => {
                if (label.userData && label.userData.updatePosition) {
                    label.userData.updatePosition();
                }
            });
        }
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
        clearBoneVisualsGroup();
    }
    if (primaryRigHandle) {
        scene.remove(primaryRigHandle);
        clearPrimaryRigHandle();
    }
}

/**
 * Refresh the joints data based on current bone visualizations
 */
function refreshJointsData() {
    // Clear existing joints data
    if (rigDetails && rigDetails.joints) {
        rigDetails.joints = [];
        
        // Collect joint data from all bone visualizations
        if (boneVisualsGroup) {
            boneVisualsGroup.traverse(object => {
                if (object.userData && object.userData.isVisualBone) {
                    // Get the parent and child bones
                    const parentBone = object.userData.parentBone;
                    const childBone = object.userData.childBone;
                    
                    if (parentBone && childBone) {
                        // Regular joint between parent and child
                        const jointName = `Joint_${parentBone.name}_to_${childBone.name}`;
                        
                        // Create joint data (without constraint type)
                        const jointData = {
                            name: jointName,
                            parentBone: parentBone.name,
                            childBone: childBone.name,
                            position: [object.position.x, object.position.y, object.position.z],
                            count: 1
                        };
                        
                        rigDetails.joints.push(jointData);
                    } else if (object.userData.rootBone) {
                        // Root joint
                        const rootBone = object.userData.rootBone;
                        const jointName = `Root_Joint_${rootBone.name}`;
                        
                        // Create joint data (without constraint type)
                        const jointData = {
                            name: jointName,
                            parentBone: "Scene Root",
                            childBone: rootBone.name,
                            position: [object.position.x, object.position.y, object.position.z],
                            count: 1,
                            isRoot: true
                        };
                        
                        rigDetails.joints.push(jointData);
                    }
                }
            });
        }
        
        // Deduplicate the joints data
        rigDetails.joints = deduplicateItemsByName(rigDetails.joints);
    }
}

/**
 * Set a label group
 * @param {string|Object} typeOrName - The type of label group ('joint' or 'bone') or the name for backward compatibility
 * @param {string|Object} nameOrScene - The name of the label group or the scene for backward compatibility
 * @param {Object} [sceneParam] - The Three.js scene (optional for backward compatibility)
 */
export function setLabelGroup(typeOrName, nameOrScene, sceneParam) {
    // Handle backward compatibility with old function signature
    let type, name, scene;
    
    if (typeof typeOrName === 'string' && (typeOrName === 'joint' || typeOrName === 'bone')) {
        // New signature: (type, name, scene)
        type = typeOrName;
        name = nameOrScene;
        scene = sceneParam;
    } else {
        // Old signature: (name, scene)
        type = 'joint';
        name = typeOrName;
        scene = nameOrScene;
    }
    
    const group = new THREE.Group();
    group.name = name;
    
    // Initialize visibility based on current settings
    const isVisible = type === 'joint' 
        ? rigOptions.showJointLabels && rigOptions.displayRig
        : rigOptions.showBoneLabels && rigOptions.displayRig;
        
    group.visible = isVisible;
    console.log(`Creating ${type} label group with initial visibility:`, group.visible);
    
    scene.add(group);
    labelGroups.set(type, group);
}



/**
 * Update the rig details object with new values
 * @param {Object} newDetails - The new rig details object
 */
export function updateRigDetails(newDetails) {
    rigDetails = newDetails;
}

/**
 * Clear all labels of a specific type from the scene
 * @param {string} type - The type of labels to clear ('joint' or 'bone')
 * @param {Object} scene - The Three.js scene
 */
export function clearLabels(type, scene) {
    const name = type === 'joint' ? "JointLabels" : "BoneLabels";
    const existingLabels = scene.getObjectByName(name);
    if (existingLabels) {
        scene.remove(existingLabels);
        if (labelGroups.has(type)) {
            labelGroups.delete(type);
        }
    }
}

/**
 * Show labels of a specific type
 * @param {string} type - The type of labels to show ('joint' or 'bone')
 */
export function showLabels(type) {
    const group = labelGroups.get(type);
    if (group) {
        console.log(`Explicitly showing ${type} labels`);
        group.visible = true; // Force visibility regardless of other settings
        
        // Also ensure each individual label is visible
        group.children.forEach(label => {
            if (label) {
                label.visible = true;
            }
        });
    }
}

/**
 * Hide labels of a specific type
 * @param {string} type - The type of labels to hide ('joint' or 'bone')
 */
export function hideLabels(type) {
    const group = labelGroups.get(type);
    if (group) {
        console.log(`Explicitly hiding ${type} labels`);
        group.visible = false;
    }
}

/**
 * Get a specific label group
 * @param {string} type - The type of label group to retrieve ('joint' or 'bone')
 * @returns {Object} The requested label group or null if not found
 */
export function getLabelGroup(type) {
    return labelGroups.get(type);
}
