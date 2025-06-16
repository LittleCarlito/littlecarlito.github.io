import * as THREE from 'three';
import { rigOptions } from './rig-controller';
import { getIsDragging } from './rig-mouse-handler';
import { getState } from '../state/scene-state';

// These variables need to be exported so they're available to both modules
export let bones = [];
export let boneVisualsGroup = null;
export let boneMaterial = null;
export let boneJointMaterial = null;
export let boneSideMaterial = null;

// IK settings
const IK_CHAIN_LENGTH = 3;
const IK_ITERATIONS = 10;
const IK_WEIGHT = 0.1;

// Map to track locked bones - Initialize as Set instead of Map for consistency
export let lockedBones = new Set();

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
    lockedBones = new Set();
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
 * Find the furthest bone from the root
 * @returns {Object} The furthest bone
 */
export function findFarthestBone() {
    if (!bones.length) return null;
    
    const endBones = [];
    
    bones.forEach(bone => {
        let isEndBone = true;
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
    
    if (endBones.length > 0) {
        console.log('Found end bone:', endBones[0].name);
        return endBones[0];
    }
    
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
    lockedBones.forEach((boneData) => {
        if (boneData.bone && boneData.rotation) {
            boneData.bone.rotation.x = boneData.rotation.x;
            boneData.bone.rotation.y = boneData.rotation.y;
            boneData.bone.rotation.z = boneData.rotation.z;
            boneData.bone.updateMatrix();
        }
    });
    
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
        const rotationBackup = new THREE.Euler(
            bone.rotation.x,
            bone.rotation.y,
            bone.rotation.z,
            bone.rotation.order
        );
        
        const existingData = Array.from(lockedBones).find(data => data.bone === bone);
        if (existingData) {
            lockedBones.delete(existingData);
        }
        
        lockedBones.add({
            bone: bone,
            rotation: rotationBackup,
            uuid: bone.uuid
        });
        console.log(`Locked rotation for bone: ${bone.name}`);
    } else {
        const existingData = Array.from(lockedBones).find(data => data.bone === bone);
        if (existingData) {
            lockedBones.delete(existingData);
        }
        console.log(`Unlocked rotation for bone: ${bone.name}`);
    }
}

/**
 * Update matrices for all bones in the scene
 * @param {boolean} forceUpdate - Force update even if no bones
 */
export function updateAllBoneMatrices(forceUpdate = false) {
    if (!bones || bones.length === 0) {
        if (!forceUpdate) return;
    }
    
    let armature = null;
    
    for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        if (!bone.parent || !bone.parent.isBone) {
            if (bone.parent) {
                armature = bone.parent;
                break;
            }
        }
    }
    
    if (!armature) {
        bones.forEach(bone => {
            if (bone && bone.updateMatrixWorld) {
                bone.updateMatrix();
                bone.updateMatrixWorld(true);
            }
        });
    } else {
        armature.updateMatrixWorld(true);
    }
}

/**
 * Update the bone visual meshes to match bone positions and rotations
 */
export function updateBoneVisuals() {
    if (boneVisualsGroup) {
        boneVisualsGroup.children.forEach(boneGroup => {
            if (boneGroup.userData.updatePosition) {
                boneGroup.userData.updatePosition();
            }
        });
    }
    
    const state = getState();
    const labelGroup = state.scene ? state.scene.getObjectByName("JointLabels") : null;
    if (labelGroup) {
        labelGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    }
    
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
    
    const boneChain = [];
    let currentBone = targetBone;
    
    while (currentBone && bones.includes(currentBone)) {
        boneChain.unshift(currentBone);
        currentBone = currentBone.parent;
        
        if (!currentBone || !currentBone.isBone) break;
    }
    
    if (boneChain.length === 0) {
        boneChain.push(targetBone);
    }
    
    console.log(`Applying IK to chain of ${boneChain.length} bones`);
    
    const rotationBackups = new Map();
    boneChain.forEach(bone => {
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
    
    applyIKToBoneChain(boneChain, targetPosition);
    
    boneChain.forEach(bone => {
        const lockedData = Array.from(lockedBones).find(data => data.bone === bone);
        if (lockedData) {
            const backup = rotationBackups.get(bone.uuid);
            if (backup) {
                bone.rotation.copy(backup.rotation);
            }
        }
    });
    
    updateAllBoneMatrices();
}

/**
 * Apply inverse kinematics to a chain of bones to reach a target
 * @param {Array} boneChain - Array of bones from parent to child
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function applyIKToBoneChain(boneChain, targetPosition) {
    if (boneChain.length === 0) return;
    
    const iterations = 10;
    
    for (let iteration = 0; iteration < iterations; iteration++) {
        for (let i = boneChain.length - 1; i >= 0; i--) {
            const bone = boneChain[i];
            
            const lockedData = Array.from(lockedBones).find(data => data.bone === bone);
            if (lockedData) {
                continue;
            }
            
            const endEffector = new THREE.Vector3();
            boneChain[boneChain.length - 1].getWorldPosition(endEffector);
            
            const bonePos = new THREE.Vector3();
            bone.getWorldPosition(bonePos);
            
            const dirToEffector = new THREE.Vector3().subVectors(endEffector, bonePos).normalize();
            const dirToTarget = new THREE.Vector3().subVectors(targetPosition, bonePos).normalize();
            
            let rotAngle = Math.acos(Math.min(1, Math.max(-1, dirToEffector.dot(dirToTarget))));
            
            if (rotAngle < 0.01) continue;
            
            rotAngle = Math.min(rotAngle, 0.1);
            
            const rotAxis = new THREE.Vector3().crossVectors(dirToEffector, dirToTarget).normalize();
            
            if (rotAxis.lengthSq() < 0.01) continue;
            
            const boneWorldQuat = new THREE.Quaternion();
            bone.getWorldQuaternion(boneWorldQuat);
            const localRotAxis = rotAxis.clone().applyQuaternion(boneWorldQuat.clone().invert()).normalize();
            
            bone.rotateOnAxis(localRotAxis, rotAngle);
            
            updateBoneChainMatrices(boneChain);
            
            const newEffectorPos = new THREE.Vector3();
            boneChain[boneChain.length - 1].getWorldPosition(newEffectorPos);
            
            if (newEffectorPos.distanceTo(targetPosition) < 0.1) {
                break;
            }
        }
    }
    
    if (boneChain.length >= 2) {
        const lastBone = boneChain[boneChain.length - 1];
        const secondLastBone = boneChain[boneChain.length - 2];
        
        const lockedData = Array.from(lockedBones).find(data => data.bone === lastBone);
        if (!lockedData) {
            const secondLastPos = new THREE.Vector3();
            secondLastBone.getWorldPosition(secondLastPos);
            
            const dirToTarget = new THREE.Vector3().subVectors(targetPosition, secondLastPos).normalize();
            
            const lastBoneDir = new THREE.Vector3(0, 1, 0);
            lastBoneDir.applyQuaternion(lastBone.getWorldQuaternion(new THREE.Quaternion()));
            
            const alignQuat = new THREE.Quaternion();
            alignQuat.setFromUnitVectors(lastBoneDir, dirToTarget);
            
            const worldQuatInverse = new THREE.Quaternion();
            secondLastBone.getWorldQuaternion(worldQuatInverse).invert();
            
            const localQuat = new THREE.Quaternion().multiplyQuaternions(worldQuatInverse, alignQuat);
            
            lastBone.quaternion.multiply(localQuat);
            
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
