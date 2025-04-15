import * as THREE from 'three';
import { checkHandleHover, getIsDragging } from '../drag-util';
import { getState } from '../state';
import { restoreLockedBoneRotations } from '../../ui/rig-panel';

// These variables need to be exported so they're available to both modules
export let bones = [];
export let boneVisualsGroup = null;
export let boneMaterial = null;
export let boneJointMaterial = null;
export let boneSideMaterial = null;
export let furthestBoneHandle = null;
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
 * Find bone by name in the scene
 * @param {string} name - The name of the bone to find
 * @returns {Object|null} The bone object or null if not found
 */
export function findBoneByName(name) {
    return bones.find(bone => bone.name === name) || null;
}

/**
 * Find associated bone for a control by its name
 * @param {String} controlName - Name of the control
 * @param {Array} bones - Array of bones to search
 * @returns {Object|null} Associated bone or null if not found
 */
export function findAssociatedBone(controlName, bones) {
    // Try matching by name
    const boneName = controlName.replace('control', 'bone')
                                .replace('ctrl', 'bone')
                                .replace('handle', 'bone');
    
    let matchedBone = null;
    bones.forEach(bone => {
        if (bone.name === boneName || bone.name.includes(boneName) || boneName.includes(bone.name)) {
            matchedBone = bone;
        }
    });
    
    return matchedBone;
}


/**
 * Find the furthest bone from the root
 * @returns {Object} The furthest bone
 */
export function findFarthestBone() {
    if (!bones.length) return null;
    
    // Find bones with no children (end effectors)
    const endBones = [];
    
    bones.forEach(bone => {
        let isEndBone = true;
        // Check if this bone has any child bones
        for (let i = 0; i < bone.children.length; i++) {
            const child = bone.children[i];
            if (child.isBone || child.name.toLowerCase().includes('bone')) {
                isEndBone = false;
                break;
            }
        }
        
        if (isEndBone) {
            endBones.push(bone);
        }
    });
    
    // If we found end bones, return the first one
    if (endBones.length > 0) {
        console.log('Found end bone:', endBones[0].name);
        return endBones[0];
    }
    
    // If we couldn't identify end bones, just return the last bone in the array
    console.log('No end bones found, using last bone:', bones[bones.length - 1].name);
    return bones[bones.length - 1];
}

/**
 * Update the rig details object with new values
 * @param {Object} newDetails - The new rig details object
 */
export function updateRigDetails(newDetails) {
    rigDetails = newDetails;
}

/**
 * Reset the bones array to empty
 * This function clears all stored bone references, effectively resetting the rig state
 * @returns {void}
 */
export function resetBones() {
    bones = [];
}

/**
 * Set the bone material
 * @param {Object} material - The material to set
 */
export function setBoneMaterial(material) {
    boneMaterial = material;
}

/**
 * Set the bone side material
 * @param {Object} material - The material to set
 */
export function setBoneSideMaterial(material) {
    boneSideMaterial = material;
}

/**
 * Set the bone joint material
 * @param {Object} material - The material to set
 */
export function setBoneJointMaterial(material) {
    boneJointMaterial = material;
}

/**
 * Set the furthest bone handle
 * @param {Object} handle - The handle to set
 */
export function setFurthestBoneHandle(handle, name, scene, incomingBone) {
    furthestBoneHandle = handle;
    furthestBoneHandle.name = name;
    scene.add(furthestBoneHandle);
    // Position at the furthest bone
    const bonePos = new THREE.Vector3();
    incomingBone.getWorldPosition(bonePos);
    furthestBoneHandle.position.copy(bonePos);
    // Add information about which bone it controls
    furthestBoneHandle.userData.controlledBone = incomingBone;
    furthestBoneHandle.userData.isControlHandle = true;
    furthestBoneHandle.userData.updatePosition = () => {
        if (furthestBoneHandle.userData.controlledBone && !getIsDragging()) {
            const controlledBonePos = new THREE.Vector3();
            furthestBoneHandle.userData.controlledBone.getWorldPosition(controlledBonePos);
            furthestBoneHandle.position.copy(controlledBonePos);
        }
    };
}

/**
 * Reset the bone visual group
 * @param {Object} scene - The Three.js scene
 */
export function resetBoneVisualGroup(scene) {
    boneVisualsGroup = new THREE.Group();
    boneVisualsGroup.name = "BoneVisualizations";
    boneVisualsGroup.visible = rigOptions.displayRig;
    scene.add(boneVisualsGroup);
}