import * as THREE from 'three';
import { rigOptions } from './rig/rig-manager';
import { getIsDragging } from './drag-util';
import { getState } from './state';
// These variables need to be exported so they're available to both modules
export let bones = [];
export let boneVisualsGroup = null;
export let boneMaterial = null;
export let boneJointMaterial = null;
export let boneSideMaterial = null;
export let furthestBoneHandle = null;

// IK settings
const IK_CHAIN_LENGTH = 3; // Maximum bones in IK chain
const IK_ITERATIONS = 10; // Number of IK solving iterations
const IK_WEIGHT = 0.1; // Weight of each iteration adjustment (changed from 0.5 to 0.1 to match rig_debugger)

// Map to track locked bones
export let lockedBones = new Map(); // Maps bone.uuid to {bone, originalRotation}

/**
 * Find bone by name in the scene
 * @param {string} name - The name of the bone to find
 * @returns {Object|null} The bone object or null if not found
 */
export function findBoneByName(name) {
    return bones.find(bone => bone.name === name) || null;
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
 * Reset the bone visual group
 * @param {Object} scene - The Three.js scene
 */
export function resetBoneVisualGroup(scene) {
    boneVisualsGroup = new THREE.Group();
    boneVisualsGroup.name = "BoneVisualizations";
    boneVisualsGroup.visible = rigOptions.displayRig;
    scene.add(boneVisualsGroup);
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
 * Restore locked bone rotations
 */
export function restoreLockedBoneRotations() {
    // Iterate through all locked bones and restore their rotations
    lockedBones.forEach((data, uuid) => {
        if (data.bone && data.rotation) {
            // Restore the exact rotation values that were stored
            data.bone.rotation.x = data.rotation.x;
            data.bone.rotation.y = data.rotation.y;
            data.bone.rotation.z = data.rotation.z;
            
            // Force update of the bone's matrix
            data.bone.updateMatrix();
        }
    });
    
    // Update all bones at once for efficiency
    updateAllBoneMatrices();
}

/**
 * Lock or unlock a bone's rotation
 * @param {Object} bone - The bone to lock/unlock
 * @param {boolean} locked - Whether to lock (true) or unlock (false)
 */
export function toggleBoneLock(bone, locked) {
    if (!bone) return;
    
    if (locked) {
        // Store the bone's current rotation
        const rotationBackup = new THREE.Euler(
            bone.rotation.x,
            bone.rotation.y,
            bone.rotation.z,
            bone.rotation.order
        );
        lockedBones.set(bone.uuid, {
            bone: bone,
            rotation: rotationBackup
        });
        console.log(`Locked rotation for bone: ${bone.name}`);
    } else {
        lockedBones.delete(bone.uuid);
        console.log(`Unlocked rotation for bone: ${bone.name}`);
    }
}

/**
 * Update matrices for all bones in the scene
 */
export function updateAllBoneMatrices() {
    if (!bones || bones.length === 0) return;
    
    // Find the armature/parent object to start update from
    let armature = null;
    
    // First look for a bone that has no bone parent
    for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        if (!bone.parent || !bone.parent.isBone) {
            if (bone.parent) {
                // Parent is not a bone, likely armature
                armature = bone.parent;
                break;
            }
        }
    }
    
    // If no armature found, update each bone individually
    if (!armature) {
        bones.forEach(bone => {
            if (bone && bone.updateMatrixWorld) {
                bone.updateMatrix();
                bone.updateMatrixWorld(true);
            }
        });
    } else {
        // Update from armature to propagate through hierarchy
        armature.updateMatrixWorld(true);
    }
}

/**
 * Update the bone visual meshes to match bone positions and rotations
 */
export function updateBoneVisuals() {
    // Update bone visuals
    if (boneVisualsGroup) {
        boneVisualsGroup.children.forEach(boneGroup => {
            if (boneGroup.userData.updatePosition) {
                boneGroup.userData.updatePosition();
            }
        });
    }
    
    // Update joint labels if they exist
    const state = getState();
    const labelGroup = state.scene ? state.scene.getObjectByName("JointLabels") : null;
    if (labelGroup) {
        labelGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    }
    
    // Update bone labels if they exist
    const boneLabelsGroup = state.scene ? state.scene.getObjectByName("BoneLabels") : null;
    if (boneLabelsGroup) {
        boneLabelsGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    }
}

/**
 * Move a chain of bones to reach a target position
 * @param {Object} targetBone - The target bone being controlled
 * @param {THREE.Vector3} targetPosition - The target world position
 */
export function moveBonesForTarget(targetBone, targetPosition) {
    if (!targetBone) return;
    
    // Find the chain of bones from root to the target bone
    const boneChain = [];
    let currentBone = targetBone;
    
    // Build chain from target to root (will be reversed later)
    while (currentBone && bones.includes(currentBone)) {
        // Add to the start of array to maintain parent->child order
        boneChain.unshift(currentBone);
        currentBone = currentBone.parent;
        
        // Stop when we reach an object that's not a bone
        if (!currentBone || !currentBone.isBone) break;
    }
    
    // If the chain is too short, use the targetBone
    if (boneChain.length === 0) {
        boneChain.push(targetBone);
    }
    
    console.log(`Applying IK to chain of ${boneChain.length} bones`);
    
    // Backup all bone rotations at the start
    const rotationBackups = new Map();
    boneChain.forEach(bone => {
        // Store original rotation for all bones
        rotationBackups.set(bone.uuid, {
            bone: bone,
            rotation: new THREE.Euler(
                bone.rotation.x,
                bone.rotation.y,
                bone.rotation.z,
                bone.rotation.order
            )
        });
    });
    
    // Apply IK to this chain - but we'll modify it to handle locked bones properly
    applyIKToBoneChain(boneChain, targetPosition);
    
    // Now restore only locked bones to their original rotation
    boneChain.forEach(bone => {
        if (lockedBones.has(bone.uuid)) {
            const backup = rotationBackups.get(bone.uuid);
            if (backup) {
                bone.rotation.copy(backup.rotation);
            }
        }
    });
    
    // Update all matrices to ensure the changes are applied
    updateAllBoneMatrices();
}

// TODO Rename to applyIKToBoneChain
/**
 * Apply inverse kinematics to a chain of bones to reach a target
 * @param {Array} boneChain - Array of bones from parent to child
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function applyIKToBoneChain(boneChain, targetPosition) {
    if (boneChain.length === 0) return;
    
    // Use Cyclic Coordinate Descent (CCD) algorithm
    const iterations = 10;
    
    for (let iteration = 0; iteration < iterations; iteration++) {
        // Work backwards from the tip to root
        for (let i = boneChain.length - 1; i >= 0; i--) {
            const bone = boneChain[i];
            
            // Skip locked bones during IK computation
            if (lockedBones.has(bone.uuid)) {
                continue;
            }
            
            // Get current end effector position (last bone in chain)
            const endEffector = new THREE.Vector3();
            boneChain[boneChain.length - 1].getWorldPosition(endEffector);
            
            // Get current bone position
            const bonePos = new THREE.Vector3();
            bone.getWorldPosition(bonePos);
            
            // Direction from bone to end effector
            const dirToEffector = new THREE.Vector3().subVectors(endEffector, bonePos).normalize();
            
            // Direction from bone to target
            const dirToTarget = new THREE.Vector3().subVectors(targetPosition, bonePos).normalize();
            
            // Calculate the angle between these directions
            let rotAngle = Math.acos(Math.min(1, Math.max(-1, dirToEffector.dot(dirToTarget))));
            
            // If the angle is very small, skip this bone
            if (rotAngle < 0.01) continue;
            
            // Limit rotation angle per iteration for smoother movement
            rotAngle = Math.min(rotAngle, 0.1);
            
            // Calculate rotation axis
            const rotAxis = new THREE.Vector3().crossVectors(dirToEffector, dirToTarget).normalize();
            
            // Skip if we can't determine rotation axis
            if (rotAxis.lengthSq() < 0.01) continue;
            
            // Convert world rotation axis to bone local space
            const boneWorldQuat = new THREE.Quaternion();
            bone.getWorldQuaternion(boneWorldQuat);
            const localRotAxis = rotAxis.clone().applyQuaternion(boneWorldQuat.clone().invert()).normalize();
            
            // Apply rotation around local axis
            bone.rotateOnAxis(localRotAxis, rotAngle);
            
            // Update matrices for the entire chain
            updateBoneChainMatrices(boneChain);
            
            // Check if we're close enough to the target
            const newEffectorPos = new THREE.Vector3();
            boneChain[boneChain.length - 1].getWorldPosition(newEffectorPos);
            
            if (newEffectorPos.distanceTo(targetPosition) < 0.1) {
                break;
            }
        }
    }
    
    // Special handling for the last bone in the chain to ensure it bends properly
    if (boneChain.length >= 2) {
        const lastBone = boneChain[boneChain.length - 1];
        const secondLastBone = boneChain[boneChain.length - 2];
        
        // Skip if the last bone is locked
        if (!lockedBones.has(lastBone.uuid)) {
            // Get the positions
            const secondLastPos = new THREE.Vector3();
            secondLastBone.getWorldPosition(secondLastPos);
            
            // Direction from second-last bone to target
            const dirToTarget = new THREE.Vector3().subVectors(targetPosition, secondLastPos).normalize();
            
            // Current direction of the last bone
            const lastBoneDir = new THREE.Vector3(0, 1, 0); // Assuming local Y is forward
            lastBoneDir.applyQuaternion(lastBone.getWorldQuaternion(new THREE.Quaternion()));
            
            // Calculate the rotation needed to align with target
            const alignQuat = new THREE.Quaternion();
            alignQuat.setFromUnitVectors(lastBoneDir, dirToTarget);
            
            // Apply this rotation in world space
            const worldQuatInverse = new THREE.Quaternion();
            secondLastBone.getWorldQuaternion(worldQuatInverse).invert();
            
            // Convert to local space relative to parent
            const localQuat = new THREE.Quaternion().multiplyQuaternions(worldQuatInverse, alignQuat);
            
            // Apply to the last bone's local rotation
            lastBone.quaternion.multiply(localQuat);
            
            // Update matrices for the chain
            updateBoneChainMatrices(boneChain);
        }
    }
}

/**
 * Update matrices for a specific chain of bones
 * This helps avoid unnecessary updates to the entire hierarchy
 * @param {Array} boneChain - The bone chain to update
 */
function updateBoneChainMatrices(boneChain) {
    if (!boneChain || boneChain.length === 0) return;
    
    boneChain.forEach(bone => {
        if (bone.updateMatrix && bone.updateMatrixWorld) {
            bone.updateMatrix();
            bone.updateMatrixWorld(true);
        }
    });
}

/**
 * Clear the bone visuals group reference
 */
export function clearBoneVisualsGroup() {
    boneVisualsGroup = null;
}

/**
 * Clear the furthest bone handle reference
 */
export function clearFurthestBoneHandle() {
    furthestBoneHandle = null;
}