import * as THREE from 'three';
import { rigOptions } from './rig-controller';
import { getIsDragging } from './rig-mouse-handler';

export let primaryRigHandle = null;

/**
 * Add a control handle to the furthest bone
 * @param {Object} targetObject - The bone to add the handle to
 * @param {Object} scene - The Three.js scene
 * @param {Number} modelScale - Scale factor for the handle size
 */
export function addControlHandleToObject(targetObject, scene, modelScale) {
    const handleSize = modelScale * 2.6;
    const geometry = new THREE.SphereGeometry(handleSize, 16, 16);
    const material = new THREE.MeshBasicMaterial({
        color: rigOptions.normalColor,
        transparent: true,
        opacity: 0.7,
        wireframe: false
    });
    
    primaryRigHandle = new THREE.Mesh(geometry, material);
    primaryRigHandle.name = "PrimaryRigHandle";
    scene.add(primaryRigHandle);
    
    const bonePos = new THREE.Vector3();
    targetObject.getWorldPosition(bonePos);
    primaryRigHandle.position.copy(bonePos);
    primaryRigHandle.userData.controlledBone = targetObject;
    primaryRigHandle.userData.isControlHandle = true;
    primaryRigHandle.userData.updatePosition = () => {
        if (primaryRigHandle.userData.controlledBone && !getIsDragging()) {
            const controlledBonePos = new THREE.Vector3();
            primaryRigHandle.userData.controlledBone.getWorldPosition(controlledBonePos);
            primaryRigHandle.position.copy(controlledBonePos);
        }
    };
}

/**
 * Clear the furthest bone handle reference
 */
export function clearPrimaryRigHandle() {
    primaryRigHandle = null;
}
