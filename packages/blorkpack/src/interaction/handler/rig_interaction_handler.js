import { InteractionManager } from '../interaction_manager';
import { InteractionHelper } from '../interaction_helper';
import { THREE } from '../../index';

const RIG_INTERACTION_CONFIG = {
    normalColor: 0xFF0000,
    hoverColor: 0x00FF00,
    activeColor: 0x0000FF
};

let rigInteractionEnabled = true;
let hoveredHandle = null;
let interactionHelper = null;
let bones = [];
let lockedBones = new Set();

export function setupRigInteractionHandling(controlHandles, scene) {
    if (!controlHandles || controlHandles.length === 0) {
        return;
    }

    interactionHelper = InteractionHelper.getInstance();
    
    const interactionManager = InteractionManager.getInstance();
    interactionHelper.setInteractionManager(interactionManager);
    
    interactionManager.rigControlHandles = controlHandles;
    
    const originalHandleIntersections = interactionManager.handle_intersections;
    
    interactionManager.handle_intersections = function(e) {
        if (originalHandleIntersections) {
            originalHandleIntersections.call(this, e);
        }
        handleRigIntersections.call(this, e);
    };
    
    const originalHandleMouseDown = interactionManager.handle_mouse_down;
    
    interactionManager.handle_mouse_down = function(e) {
        const rigHandled = handleRigMouseDown.call(this, e);
        if (!rigHandled && originalHandleMouseDown) {
            originalHandleMouseDown.call(this, e);
        }
    };
    
    const originalHandleMouseUp = interactionManager.handle_mouse_up;
    
    interactionManager.handle_mouse_up = function(e) {
        handleRigMouseUp.call(this, e);
        if (originalHandleMouseUp) {
            originalHandleMouseUp.call(this, e);
        }
    };

    const originalHandleMouseMove = interactionManager.handle_mouse_move;
    
    interactionManager.handle_mouse_move = function(e) {
        if (this.window.renderer) {
            interactionHelper.updateMousePosition(e.clientX, e.clientY, this.window.renderer);
            
            if (this.window.viewable_container && this.window.viewable_container.get_camera()) {
                interactionHelper.updateRaycaster(this.window.viewable_container.get_camera());
            }
        }
        
        if (interactionHelper.getDragState().isDragging) {
            handleRigDrag.call(this);
        }
        
        if (originalHandleMouseMove) {
            originalHandleMouseMove.call(this, e);
        }
    };
}

function handleRigIntersections(e) {
    if (!rigInteractionEnabled) return;
    
    const intersections = this.get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);
    
    let rigHandleHovered = false;
    
    for (const intersection of intersections) {
        const object = intersection.object;
        
        if (object.userData && object.userData.isControlHandle) {
            rigHandleHovered = true;
            
            if (interactionHelper.getDragState().isDragging && interactionHelper.getDragState().dragTarget === object) {
                break;
            }
            
            if (hoveredHandle !== object) {
                if (hoveredHandle && hoveredHandle.material && hoveredHandle !== interactionHelper.getDragState().dragTarget) {
                    hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
                    hoveredHandle.material.needsUpdate = true;
                }
                
                hoveredHandle = object;
                hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.hoverColor);
                hoveredHandle.material.needsUpdate = true;
                
                document.body.style.cursor = 'pointer';
            }
            break;
        }
    }
    
    if (!rigHandleHovered && hoveredHandle && !interactionHelper.getDragState().isDragging) {
        hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
        hoveredHandle.material.needsUpdate = true;
        hoveredHandle = null;
        document.body.style.cursor = 'auto';
    }
}

function handleRigMouseDown(e) {
    if (!rigInteractionEnabled || e.button !== 0) return false;
    
    const intersections = this.get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);
    
    for (const intersection of intersections) {
        const object = intersection.object;
        
        if (object.userData && object.userData.isControlHandle) {
            if (bones.length === 0) {
                populateBonesFromRig(object);
            }
            
            const camera = this.window.viewable_container.get_camera();
            
            const dragStarted = interactionHelper.startDrag(object, intersection, camera, {
                onDragStart: (draggedObject, worldPosition) => {
                    if (draggedObject.material) {
                        draggedObject.material.color.setHex(RIG_INTERACTION_CONFIG.activeColor);
                        draggedObject.material.needsUpdate = true;
                    }
                }
            });
            
            if (dragStarted) {
                e.preventDefault();
                return true;
            }
        }
    }
    
    return false;
}

function handleRigMouseUp(e) {
    if (interactionHelper.getDragState().isDragging) {
        interactionHelper.stopDrag({
            onDragEnd: (draggedObject, finalPosition) => {
                if (draggedObject.material) {
                    const isHovered = draggedObject === hoveredHandle;
                    draggedObject.material.color.setHex(isHovered ? RIG_INTERACTION_CONFIG.hoverColor : RIG_INTERACTION_CONFIG.normalColor);
                    draggedObject.material.needsUpdate = true;
                }
                
                if (this.window.viewable_container && this.window.viewable_container.controls) {
                    this.window.viewable_container.controls.enabled = true;
                    document.body.style.cursor = 'auto';
                }
            }
        });
        
        e.preventDefault();
    }
}

function handleRigDrag() {
    const dragState = interactionHelper.getDragState();
    if (!dragState.isDragging || !dragState.dragTarget) return;
    
    interactionHelper.updateDrag({
        onDragUpdate: (dragTarget, localPosition, worldPosition, oldPosition) => {
            if (dragTarget.userData.controlledBone) {
                const controlledBone = dragTarget.userData.controlledBone;
                
                restoreLockedBoneRotations();
                moveBonesForTarget(controlledBone, worldPosition);
                restoreLockedBoneRotations();
                updateBoneVisuals();
            }
        }
    });
}

function moveBonesForTarget(targetBone, targetPosition) {
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

function updateBoneChainMatrices(boneChain) {
    if (!boneChain || boneChain.length === 0) return;
    
    boneChain.forEach(bone => {
        if (bone.updateMatrix && bone.updateMatrixWorld) {
            bone.updateMatrix();
            bone.updateMatrixWorld(true);
        }
    });
}

function updateAllBoneMatrices(forceUpdate = false) {
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

function restoreLockedBoneRotations() {
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

function updateBoneVisuals() {
    updateAllBoneMatrices();
}

function populateBonesFromRig(handle) {
    if (!handle.userData.controlledBone) return;
    
    let currentBone = handle.userData.controlledBone;
    
    while (currentBone.parent && currentBone.parent.isBone) {
        currentBone = currentBone.parent;
    }
    
    function collectBones(bone) {
        if (bone.isBone) {
            bones.push(bone);
        }
        
        if (bone.children) {
            bone.children.forEach(child => {
                if (child.isBone) {
                    collectBones(child);
                }
            });
        }
    }
    
    collectBones(currentBone);
    
    const controlledBone = handle.userData.controlledBone;
    if (controlledBone) {
        const rotationBackup = new THREE.Euler(
            controlledBone.rotation.x,
            controlledBone.rotation.y,
            controlledBone.rotation.z,
            controlledBone.rotation.order
        );
        
        lockedBones.add({
            bone: controlledBone,
            rotation: rotationBackup,
            uuid: controlledBone.uuid
        });
    }
}

export function setRigInteractionEnabled(enabled) {
    rigInteractionEnabled = enabled;
    
    if (!enabled && hoveredHandle) {
        hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
        hoveredHandle.material.needsUpdate = true;
        hoveredHandle = null;
        document.body.style.cursor = 'auto';
    }
}

export function updateRigInteractionConfig(newConfig) {
    Object.assign(RIG_INTERACTION_CONFIG, newConfig);
}

export function getHoveredHandle() {
    return hoveredHandle;
}

export function getDragTarget() {
    return interactionHelper ? interactionHelper.getDragState().dragTarget : null;
}

export function getIsDragging() {
    return interactionHelper ? interactionHelper.getDragState().isDragging : false;
}

export function setIsDragging(dragging) {
    if (interactionHelper && !dragging) {
        interactionHelper.stopDrag();
    }
}

export function cleanupRigInteractionHandling() {
    if (interactionHelper) {
        interactionHelper.stopDrag();
    }
    
    if (hoveredHandle && hoveredHandle.material) {
        hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
        hoveredHandle.material.needsUpdate = true;
    }
    
    hoveredHandle = null;
    bones = [];
    lockedBones.clear();
    
    document.body.style.cursor = 'auto';
}