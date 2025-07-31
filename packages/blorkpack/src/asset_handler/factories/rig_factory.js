import { THREE } from '../../index';
import { setupRigInteractionHandling, cleanupRigInteractionHandling } from '../../interaction/handler/rig_interaction_handler'

let RIG_VISUALIZATION_ENABLED = false;

const RIG_CONFIG = {
    displayRig: true,
    forceZ: true,
    wireframe: false,
    primaryColor: 0x4CAF50,
    secondaryColor: 0xFFFF00,
    jointColor: 0x00FFFF,
    rootColor: 0xFF0000,
    handleColor: 0xFF0000,
    opacity: 0.8
};

let rigVisualizationsByAsset = new Map();

export function setRigVisualizationEnabled(enabled) {
    RIG_VISUALIZATION_ENABLED = enabled;
    
    rigVisualizationsByAsset.forEach((rigData, assetId) => {
        if (rigData.group) {
            rigData.group.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
        }
        
        rigData.handles.forEach(handle => {
            handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
        });
    });
}

export function createRigVisualization(rigDetails, scene, asset) {
    if (!rigDetails || !rigDetails.hasRig || rigDetails.bones.length === 0) {
        return null;
    }
        
    if (!rigDetails.joints) {
        rigDetails.joints = [];
    }
    
    let targetContainer = scene;
    let currentParent = asset.parent;
    
    while (currentParent && currentParent !== scene) {
        if (currentParent.name === 'asset_container' || 
            currentParent.userData && currentParent.userData.isAssetContainer) {
            targetContainer = currentParent;
            break;
        }
        currentParent = currentParent.parent;
    }
        
    const rigVisualsGroup = new THREE.Group();
    rigVisualsGroup.name = "RigVisualization";
    rigVisualsGroup.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    targetContainer.add(rigVisualsGroup);
    
    const bones = [];
    asset.traverse(node => {
        if (node.isBone || node.name.toLowerCase().includes('bone')) {
            bones.push(node);
        }
    });
        
    if (bones.length === 0) {
        console.warn('[RigFactory] No bones found in asset');
        return null;
    }
    
    const bbox = new THREE.Box3().setFromObject(asset);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const modelScale = size.length() * 0.02;
    const boneRadius = Math.max(0.02, modelScale * 0.3);
    
    const bonesByParent = new Map();
    
    const visualizableBones = bones.filter(bone => 
        !(bone.name.toLowerCase().includes('control') || 
          bone.name.toLowerCase().includes('ctrl') || 
          bone.name.toLowerCase().includes('handle'))
    );
    
    const rootBones = visualizableBones.filter(bone => 
        bone.name.toLowerCase().includes('root')
    );
    
    visualizableBones.forEach(bone => {
        if (bone.parent && bone.parent.isBone) {
            const parentId = bone.parent.uuid;
            if (!bonesByParent.has(parentId)) {
                bonesByParent.set(parentId, []);
            }
            bonesByParent.get(parentId).push(bone);
        }
    });
    
    const controlHandles = [];
    
    createBoneStructureWithJoints(visualizableBones, bonesByParent, boneRadius, rigDetails, rigVisualsGroup);
    
    createRootBoneVisualizationsWithJoints(rootBones, boneRadius, rigDetails, rigVisualsGroup);
    
    const furthestBone = findFarthestBone(bones);
    if (furthestBone) {
        createControlHandle(furthestBone, targetContainer, modelScale, controlHandles);
    }
    
    if (RIG_CONFIG.forceZ) {
        applyForceZSettings(rigVisualsGroup, controlHandles);
    }
    
    if (controlHandles.length > 0) {
        setupRigInteractionHandling(controlHandles, scene);
    }
    
    const assetId = asset.uuid;
    rigVisualizationsByAsset.set(assetId, {
        group: rigVisualsGroup,
        bones: bones,
        handles: controlHandles,
        joints: rigDetails.joints,
        asset: asset,
        targetContainer: targetContainer
    });
    return {
        group: rigVisualsGroup,
        bones: bones,
        handles: controlHandles,
        joints: rigDetails.joints
    };
}

function createBoneStructureWithJoints(bones, bonesByParent, boneRadius, rigDetails, rigVisualsGroup) {    
    bones.forEach(bone => {
        const childBones = bonesByParent.get(bone.uuid) || [];        
        childBones.forEach(childBone => {
            if (childBone.name.toLowerCase().includes('control') || 
                childBone.name.toLowerCase().includes('ctrl') || 
                childBone.name.toLowerCase().includes('handle')) {
                return;
            }
            
            const boneGroup = createBoneConnectionWithJoints(bone, childBone, boneRadius, rigDetails, rigVisualsGroup);
            rigVisualsGroup.add(boneGroup);
        });
    });
}

function createBoneConnectionWithJoints(parentBone, childBone, radius, rigDetails, rigVisualsGroup) {    
    const boneGroup = new THREE.Group();
    
    boneGroup.userData.parentBone = parentBone;
    boneGroup.userData.childBone = childBone;
    boneGroup.userData.isVisualBone = true;
    boneGroup.userData.updatePosition = () => updateBonePosition(boneGroup, rigVisualsGroup);
    
    const distance = 1;
    
    for (let i = 0; i < 8; i++) {
        const segmentGeometry = new THREE.CylinderGeometry(
            radius, radius, distance, 1, 1, false,
            (Math.PI * 2 * i) / 8,
            Math.PI * 2 / 8
        );
        
        const color = (i % 2 === 0) ? RIG_CONFIG.primaryColor : RIG_CONFIG.secondaryColor;
        const material = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            wireframe: RIG_CONFIG.wireframe,
            transparent: true,
            opacity: RIG_CONFIG.opacity,
            depthTest: false,
            depthWrite: false
        });
        
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.userData.bonePart = 'side';
        segment.userData.sideType = (i % 2 === 0) ? 'primary' : 'secondary';
        segment.position.y = distance / 2;
        segment.renderOrder = 10000;
        
        boneGroup.add(segment);
    }
    
    const jointMaterial = new THREE.MeshBasicMaterial({
        color: RIG_CONFIG.jointColor,
        side: THREE.DoubleSide,
        wireframe: RIG_CONFIG.wireframe,
        transparent: true,
        opacity: RIG_CONFIG.opacity,
        depthTest: false,
        depthWrite: false
    });
    
    const bottomJoint = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        jointMaterial.clone()
    );
    bottomJoint.userData.bonePart = 'cap';
    bottomJoint.userData.jointType = 'bottom';
    bottomJoint.userData.parentBone = parentBone;
    bottomJoint.position.y = 0;
    bottomJoint.renderOrder = 10020;
    boneGroup.add(bottomJoint);
    
    const topJoint = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        jointMaterial.clone()
    );
    topJoint.userData.bonePart = 'cap';
    topJoint.userData.jointType = 'top';
    topJoint.userData.childBone = childBone;
    topJoint.position.y = distance;
    topJoint.renderOrder = 10020;
    boneGroup.add(topJoint);
    
    if (rigDetails && rigDetails.joints) {
        rigDetails.joints.push({
            name: `Joint_${parentBone.name}_to_${childBone.name}`,
            parentBone: parentBone.name,
            childBone: childBone.name,
            position: [0, 0, 0],
            count: 1
        });
    }
    
    updateBonePosition(boneGroup, rigVisualsGroup);
    
    return boneGroup;
}

function createRootBoneVisualizationsWithJoints(rootBones, radius, rigDetails, rigVisualsGroup) {    
    rootBones.forEach(rootBone => {        
        const rootGroup = new THREE.Group();
        rigVisualsGroup.add(rootGroup);
        
        const puckRadius = radius * 2.5;
        const puckHeight = radius * 0.5;
        const puckGeometry = new THREE.CylinderGeometry(puckRadius, puckRadius, puckHeight, 32);
        const puckMaterial = new THREE.MeshBasicMaterial({
            color: RIG_CONFIG.rootColor,
            side: THREE.DoubleSide,
            wireframe: RIG_CONFIG.wireframe,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false
        });
        
        const puck = new THREE.Mesh(puckGeometry, puckMaterial);
        puck.userData.bonePart = 'root';
        puck.userData.rootBone = rootBone;
        puck.renderOrder = 10015;
        rootGroup.add(puck);
        
        if (rigDetails && rigDetails.joints) {
            rigDetails.joints.push({
                name: `Root_Joint_${rootBone.name}`,
                parentBone: "Scene Root",
                childBone: rootBone.name,
                position: [0, 0, 0],
                count: 1,
                isRoot: true
            });
        }
        
        rootGroup.userData.rootBone = rootBone;
        rootGroup.userData.isVisualBone = true;
        rootGroup.userData.updatePosition = () => updateRootPosition(rootGroup, rigVisualsGroup);
        
        updateRootPosition(rootGroup, rigVisualsGroup);
    });
}

function createControlHandle(bone, container, modelScale, controlHandles) {
    const handleSize = modelScale * 2.6;
    const geometry = new THREE.SphereGeometry(handleSize, 16, 16);
    const material = new THREE.MeshBasicMaterial({
        color: RIG_CONFIG.handleColor,
        transparent: true,
        opacity: 0.7,
        wireframe: false,
        depthTest: false,
        depthWrite: false
    });
    
    const handle = new THREE.Mesh(geometry, material);
    handle.name = "RigControlHandle";
    handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    handle.renderOrder = 10030;
    
    container.add(handle);
        
    handle.userData.controlledBone = bone;
    handle.userData.isControlHandle = true;
    handle.userData.updatePosition = () => updateHandlePosition(handle);
    
    controlHandles.push(handle);
    
    updateHandlePosition(handle);
}

function findFarthestBone(bones) {
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
        return endBones[0];
    }
    
    return bones[bones.length - 1];
}

function updateBonePosition(boneGroup, rigVisualsGroup) {
    if (!boneGroup.userData.parentBone || !boneGroup.userData.childBone) return;
    
    const parentBone = boneGroup.userData.parentBone;
    const childBone = boneGroup.userData.childBone;
    
    parentBone.updateMatrixWorld(true);
    childBone.updateMatrixWorld(true);
    
    const parentPos = new THREE.Vector3();
    const childPos = new THREE.Vector3();
    
    parentBone.getWorldPosition(parentPos);
    childBone.getWorldPosition(childPos);
    
    rigVisualsGroup.worldToLocal(parentPos);
    rigVisualsGroup.worldToLocal(childPos);
    
    boneGroup.position.copy(parentPos);
    
    const direction = new THREE.Vector3().subVectors(childPos, parentPos);
    const distance = direction.length();
    
    if (distance > 0.001) {
        boneGroup.children.forEach(child => {
            if (child.userData.bonePart === 'side') {
                child.scale.y = distance;
                child.position.y = distance / 2;
            } else if (child.userData.bonePart === 'cap') {
                if (child.userData.jointType === 'top') {
                    child.position.y = distance;
                }
            }
        });
        
        const targetDirection = direction.clone().normalize();
        const upVector = new THREE.Vector3(0, 1, 0);
        
        const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, targetDirection);
        boneGroup.setRotationFromQuaternion(quaternion);
    }
}

function updateRootPosition(rootGroup, rigVisualsGroup) {
    if (!rootGroup.userData.rootBone) return;
    
    const rootBone = rootGroup.userData.rootBone;
    rootBone.updateMatrixWorld(true);
    
    const pos = new THREE.Vector3();
    rootBone.getWorldPosition(pos);
    
    rigVisualsGroup.worldToLocal(pos);
    rootGroup.position.copy(pos);
}

function updateHandlePosition(handle) {
    if (!handle.userData.controlledBone || !handle.parent) return;
    
    const bone = handle.userData.controlledBone;
    bone.updateMatrixWorld(true);
    
    const bonePos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    
    handle.parent.worldToLocal(bonePos);
    handle.position.copy(bonePos);
}

function applyForceZSettings(rigVisualsGroup, controlHandles) {
    if (!rigVisualsGroup) return;
    
    rigVisualsGroup.renderOrder = 10000;
    rigVisualsGroup.onBeforeRender = function() {
        this.traverse(object => {
            if (object.material) {
                object.material.depthTest = false;
                object.material.depthWrite = false;
            }
        });
    };
    
    rigVisualsGroup.traverse(object => {
        if (object.isMesh) {
            if (object.userData.bonePart === 'cap') {
                object.renderOrder = 10020;
            } else if (object.userData.bonePart === 'side') {
                object.renderOrder = 10010;
            } else if (object.userData.bonePart === 'root') {
                object.renderOrder = 10015;
            } else {
                object.renderOrder = 10000;
            }
            
            if (object.material) {
                object.material.depthTest = false;
                object.material.depthWrite = false;
                object.material.needsUpdate = true;
            }
        }
    });
    
    controlHandles.forEach(handle => {
        handle.renderOrder = 10030;
        if (handle.material) {
            handle.material.depthTest = false;
            handle.material.depthWrite = false;
            handle.material.needsUpdate = true;
        }
    });
}

export function updateRigVisualization() {
    if (!RIG_CONFIG.displayRig || !RIG_VISUALIZATION_ENABLED) return;
    
    rigVisualizationsByAsset.forEach((rigData, assetId) => {
        if (!rigData.group || !rigData.group.parent) return;
        
        rigData.group.children.forEach(boneGroup => {
            if (boneGroup.userData.updatePosition) {
                boneGroup.userData.updatePosition();
            }
        });
        
        rigData.handles.forEach(handle => {
            if (handle.userData.updatePosition) {
                handle.userData.updatePosition();
            }
        });
    });
}

export function clearRigVisualization(scene) {
    cleanupRigInteractionHandling();
    
    rigVisualizationsByAsset.forEach((rigData, assetId) => {
        if (rigData.group && rigData.group.parent) {
            rigData.group.parent.remove(rigData.group);
        }
        
        rigData.handles.forEach(handle => {
            if (handle.parent) {
                handle.parent.remove(handle);
            }
        });
    });
    
    rigVisualizationsByAsset.clear();
}

export function updateRigConfig(newConfig) {
    Object.assign(RIG_CONFIG, newConfig);
    
    rigVisualizationsByAsset.forEach((rigData, assetId) => {
        if (rigData.group) {
            rigData.group.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
        }
        
        rigData.handles.forEach(handle => {
            handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
        });
    });
}