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

let rigVisualsGroup = null;
let bones = [];
let controlHandles = [];

export function setRigVisualizationEnabled(enabled) {
    RIG_VISUALIZATION_ENABLED = enabled;
    
    if (rigVisualsGroup) {
        rigVisualsGroup.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    }
    
    controlHandles.forEach(handle => {
        handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    });
}

export function createRigVisualization(rigDetails, scene, asset) {
    if (!rigDetails || !rigDetails.hasRig || rigDetails.bones.length === 0) {
        console.log('[RigFactory] No actual rig to visualize (bones required)');
        return null;
    }
    
    console.log('[RigFactory] Creating rig visualization for:', rigDetails);
    
    clearRigVisualization(scene);
    
    if (!rigDetails.joints) {
        rigDetails.joints = [];
    }
    
    let targetContainer = scene;
    let currentParent = asset.parent;
    console.log('[RigFactory] Looking for asset container, asset parent:', asset.parent?.name);
    
    while (currentParent && currentParent !== scene) {
        console.log('[RigFactory] Checking parent:', currentParent.name, 'userData:', currentParent.userData);
        if (currentParent.name === 'asset_container' || 
            currentParent.userData && currentParent.userData.isAssetContainer) {
            targetContainer = currentParent;
            console.log('[RigFactory] Found asset container:', targetContainer.name);
            break;
        }
        currentParent = currentParent.parent;
    }
    
    console.log('[RigFactory] Using target container:', targetContainer.name || 'scene');
    console.log('[RigFactory] Target container rotation:', targetContainer.rotation);
    
    rigVisualsGroup = new THREE.Group();
    rigVisualsGroup.name = "RigVisualization";
    rigVisualsGroup.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    targetContainer.add(rigVisualsGroup);
    
    bones = [];
    asset.traverse(node => {
        if (node.isBone || node.name.toLowerCase().includes('bone')) {
            bones.push(node);
        }
    });
    
    console.log(`[RigFactory] Found ${bones.length} bones in asset`);
    
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
    
    createBoneStructureWithJoints(visualizableBones, bonesByParent, boneRadius, rigDetails);
    
    createRootBoneVisualizationsWithJoints(rootBones, boneRadius, rigDetails);
    
    const furthestBone = findFarthestBone(bones);
    if (furthestBone) {
        createControlHandle(furthestBone, targetContainer, modelScale);
    }
    
    if (RIG_CONFIG.forceZ) {
        applyForceZSettings();
    }
    
    if (controlHandles.length > 0) {
        setupRigInteractionHandling(controlHandles, scene);
    }
    
    console.log('[RigFactory] Rig visualization created successfully');
    console.log(`[RigFactory] Created ${rigDetails.joints.length} joints`);
    
    return {
        group: rigVisualsGroup,
        bones: bones,
        handles: controlHandles,
        joints: rigDetails.joints
    };
}

function createBoneStructureWithJoints(bones, bonesByParent, boneRadius, rigDetails) {
    console.log('[RigFactory] Creating bone structure with', bones.length, 'bones');
    
    bones.forEach(bone => {
        const bonePos = new THREE.Vector3();
        bone.getWorldPosition(bonePos);
        
        rigVisualsGroup.worldToLocal(bonePos);
        
        console.log('[RigFactory] Bone', bone.name, 'local position:', bonePos);
        
        const childBones = bonesByParent.get(bone.uuid) || [];
        console.log('[RigFactory] Bone', bone.name, 'has', childBones.length, 'children');
        
        childBones.forEach(childBone => {
            if (childBone.name.toLowerCase().includes('control') || 
                childBone.name.toLowerCase().includes('ctrl') || 
                childBone.name.toLowerCase().includes('handle')) {
                console.log('[RigFactory] Skipping control bone:', childBone.name);
                return;
            }
            
            const childPos = new THREE.Vector3();
            childBone.getWorldPosition(childPos);
            rigVisualsGroup.worldToLocal(childPos);
            
            console.log('[RigFactory] Child bone', childBone.name, 'local position:', childPos);
            
            const distance = bonePos.distanceTo(childPos);
            console.log('[RigFactory] Distance between', bone.name, 'and', childBone.name, ':', distance);
            
            if (distance > 0.001) {
                const boneGroup = createBoneConnectionWithJoints(bonePos, childPos, boneRadius, bone, childBone, rigDetails);
                rigVisualsGroup.add(boneGroup);
                console.log('[RigFactory] Created bone connection from', bone.name, 'to', childBone.name);
            }
        });
    });
}

function createBoneConnectionWithJoints(startPos, endPos, radius, parentBone, childBone, rigDetails) {
    console.log(`[RigFactory] Creating bone connection from ${parentBone.name} to ${childBone.name}`);
    console.log(`[RigFactory] Start pos (local):`, startPos);
    console.log(`[RigFactory] End pos (local):`, endPos);
    
    const boneGroup = new THREE.Group();
    
    boneGroup.position.copy(startPos);
    
    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    
    console.log(`[RigFactory] Direction vector:`, direction);
    console.log(`[RigFactory] Distance:`, distance);
    
    if (distance < 0.001) {
        console.log(`[RigFactory] Distance too small, skipping bone connection`);
        return boneGroup;
    }
    
    const boneGeometry = new THREE.CylinderGeometry(radius, radius, distance, 8);
    
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
    
    const targetDirection = direction.clone().normalize();
    const upVector = new THREE.Vector3(0, 1, 0);
    
    const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, targetDirection);
    boneGroup.setRotationFromQuaternion(quaternion);
    
    console.log(`[RigFactory] Applied rotation quaternion:`, quaternion);
    console.log(`[RigFactory] Final bone group position:`, boneGroup.position);
    console.log(`[RigFactory] Final bone group rotation:`, boneGroup.rotation);
    
    if (rigDetails && rigDetails.joints) {
        rigDetails.joints.push({
            name: `Joint_${parentBone.name}_to_${childBone.name}`,
            parentBone: parentBone.name,
            childBone: childBone.name,
            position: [startPos.x, startPos.y, startPos.z],
            count: 1
        });
    }
    
    boneGroup.userData.parentBone = parentBone;
    boneGroup.userData.childBone = childBone;
    boneGroup.userData.isVisualBone = true;
    boneGroup.userData.updatePosition = () => updateBonePosition(boneGroup);
    
    return boneGroup;
}

function createRootBoneVisualizationsWithJoints(rootBones, radius, rigDetails) {
    console.log('[RigFactory] Creating root visualizations for', rootBones.length, 'root bones');
    
    rootBones.forEach(rootBone => {
        const rootPos = new THREE.Vector3();
        rootBone.getWorldPosition(rootPos);
        
        rigVisualsGroup.worldToLocal(rootPos);
        
        console.log(`[RigFactory] Creating root visualization for: ${rootBone.name} at local position:`, rootPos);
        
        const rootGroup = new THREE.Group();
        rootGroup.position.copy(rootPos);
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
                position: [rootPos.x, rootPos.y, rootPos.z],
                count: 1,
                isRoot: true
            });
        }
        
        rootGroup.userData.rootBone = rootBone;
        rootGroup.userData.isVisualBone = true;
        rootGroup.userData.updatePosition = () => updateRootPosition(rootGroup);
        
        console.log(`[RigFactory] Created root puck for ${rootBone.name} at position:`, rootGroup.position);
    });
}

function createControlHandle(bone, container, modelScale) {
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
    
    const bonePos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    
    container.worldToLocal(bonePos);
    handle.position.copy(bonePos);
    
    container.add(handle);
    
    console.log(`[RigFactory] Created control handle for bone: ${bone.name} at local position:`, handle.position);
    console.log(`[RigFactory] Container rotation:`, container.rotation);
    
    handle.userData.controlledBone = bone;
    handle.userData.isControlHandle = true;
    handle.userData.updatePosition = () => updateHandlePosition(handle);
    
    controlHandles.push(handle);
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
        console.log('[RigFactory] Found end bone:', endBones[0].name);
        return endBones[0];
    }
    
    console.log('[RigFactory] No end bones found, using last bone:', bones[bones.length - 1].name);
    return bones[bones.length - 1];
}

function updateBonePosition(boneGroup) {
    if (boneGroup.userData.parentBone && boneGroup.userData.childBone) {
        const parentPos = new THREE.Vector3();
        const childPos = new THREE.Vector3();
        
        boneGroup.userData.parentBone.getWorldPosition(parentPos);
        boneGroup.userData.childBone.getWorldPosition(childPos);
        
        rigVisualsGroup.worldToLocal(parentPos);
        rigVisualsGroup.worldToLocal(childPos);
        
        boneGroup.position.copy(parentPos);
        
        const direction = new THREE.Vector3().subVectors(childPos, parentPos);
        const distance = direction.length();
        
        if (distance > 0.001) {
            const targetDirection = direction.clone().normalize();
            const upVector = new THREE.Vector3(0, 1, 0);
            
            const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, targetDirection);
            boneGroup.setRotationFromQuaternion(quaternion);
        }
    }
}

function updateRootPosition(rootGroup) {
    if (rootGroup.userData.rootBone) {
        const pos = new THREE.Vector3();
        rootGroup.userData.rootBone.getWorldPosition(pos);
        
        rigVisualsGroup.worldToLocal(pos);
        rootGroup.position.copy(pos);
    }
}

function updateHandlePosition(handle) {
    if (handle.userData.controlledBone && handle.parent) {
        const bonePos = new THREE.Vector3();
        handle.userData.controlledBone.getWorldPosition(bonePos);
        
        handle.parent.worldToLocal(bonePos);
        handle.position.copy(bonePos);
    }
}

function applyForceZSettings() {
    if (!rigVisualsGroup) return;
    
    console.log('[RigFactory] Applying Force Z settings');
    
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
    if (!rigVisualsGroup || !RIG_CONFIG.displayRig || !RIG_VISUALIZATION_ENABLED) return;
    
    rigVisualsGroup.children.forEach(boneGroup => {
        if (boneGroup.userData.updatePosition) {
            boneGroup.userData.updatePosition();
        }
    });
    
    controlHandles.forEach(handle => {
        if (handle.userData.updatePosition) {
            handle.userData.updatePosition();
        }
    });
}

export function clearRigVisualization(scene) {
    cleanupRigInteractionHandling();
    
    if (rigVisualsGroup && rigVisualsGroup.parent) {
        rigVisualsGroup.parent.remove(rigVisualsGroup);
        rigVisualsGroup = null;
    }
    
    controlHandles.forEach(handle => {
        if (handle.parent) {
            handle.parent.remove(handle);
        }
    });
    controlHandles = [];
    
    bones = [];
}

export function updateRigConfig(newConfig) {
    Object.assign(RIG_CONFIG, newConfig);
    console.log('[RigFactory] Rig config updated:', RIG_CONFIG);
    
    if (rigVisualsGroup) {
        rigVisualsGroup.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    }
    
    controlHandles.forEach(handle => {
        handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    });
}