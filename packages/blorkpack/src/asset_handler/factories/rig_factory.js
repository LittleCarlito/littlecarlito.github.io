import { THREE } from '../../index';
import { setupRigInteractionHandling, cleanupRigInteractionHandling } from '../../rig_interaction_handler';

// Global rig visualization state - controlled by external systems
let RIG_VISUALIZATION_ENABLED = false;

// Rig visualization configuration
const RIG_CONFIG = {
    displayRig: true,
    forceZ: true,
    wireframe: false,
    primaryColor: 0x4CAF50,      // Green
    secondaryColor: 0xFFFF00,    // Yellow  
    jointColor: 0x00FFFF,        // Cyan
    rootColor: 0xFF0000,         // Red
    handleColor: 0xFF0000,       // Red for control handles
    opacity: 0.8
};

let rigVisualsGroup = null;
let bones = [];
let controlHandles = [];

/**
 * Sets the global rig visualization state
 * @param {boolean} enabled - Whether rig visualization should be enabled
 */
export function setRigVisualizationEnabled(enabled) {
    RIG_VISUALIZATION_ENABLED = enabled;
    
    // Update visibility of existing rig visualizations
    if (rigVisualsGroup) {
        rigVisualsGroup.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    }
    
    // Update control handles visibility
    controlHandles.forEach(handle => {
        handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    });
}

/**
 * Creates rig visualization from analyzed rig data
 * @param {Object} rigDetails - Analyzed rig data from RigAnalyzer
 * @param {Object} scene - Three.js scene
 * @param {Object} asset - The asset mesh containing the rig
 * @returns {Object} Created rig visualization data
 */
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

/**
 * Creates bone structure visualization with cylinders and joints, storing joint data
 * @param {Array} bones - Array of bone objects
 * @param {Map} bonesByParent - Map of bones grouped by parent
 * @param {Number} boneRadius - Radius for bone visualization
 * @param {Object} rigDetails - Rig details object to store joint data
 */
function createBoneStructureWithJoints(bones, bonesByParent, boneRadius, rigDetails) {
    console.log('[RigFactory] Creating bone structure with', bones.length, 'bones');
    
    // Create visual bones between parent-child bone pairs
    bones.forEach(bone => {
        // Get current bone position in LOCAL space relative to the rig container
        const bonePos = new THREE.Vector3();
        bone.getWorldPosition(bonePos);
        
        // Convert world position to local position relative to rig container
        rigVisualsGroup.worldToLocal(bonePos);
        
        console.log('[RigFactory] Bone', bone.name, 'local position:', bonePos);
        
        // Check if this bone has children in our bone list
        const childBones = bonesByParent.get(bone.uuid) || [];
        console.log('[RigFactory] Bone', bone.name, 'has', childBones.length, 'children');
        
        // Create a visual bone for each child connection
        childBones.forEach(childBone => {
            // Skip control bones
            if (childBone.name.toLowerCase().includes('control') || 
                childBone.name.toLowerCase().includes('ctrl') || 
                childBone.name.toLowerCase().includes('handle')) {
                console.log('[RigFactory] Skipping control bone:', childBone.name);
                return;
            }
            
            // Get child bone position in LOCAL space relative to the rig container
            const childPos = new THREE.Vector3();
            childBone.getWorldPosition(childPos);
            rigVisualsGroup.worldToLocal(childPos);
            
            console.log('[RigFactory] Child bone', childBone.name, 'local position:', childPos);
            
            // Calculate distance
            const distance = bonePos.distanceTo(childPos);
            console.log('[RigFactory] Distance between', bone.name, 'and', childBone.name, ':', distance);
            
            // Only create visual bone if distance is significant
            if (distance > 0.001) {
                const boneGroup = createBoneConnectionWithJoints(bonePos, childPos, boneRadius, bone, childBone, rigDetails);
                rigVisualsGroup.add(boneGroup);
                console.log('[RigFactory] Created bone connection from', bone.name, 'to', childBone.name);
            }
        });
    });
}

/**
 * Creates a bone connection between two points with joints, storing joint data
 * @param {THREE.Vector3} startPos - Start position (local coordinates)
 * @param {THREE.Vector3} endPos - End position (local coordinates)
 * @param {Number} radius - Bone radius
 * @param {Object} parentBone - Parent bone object
 * @param {Object} childBone - Child bone object
 * @param {Object} rigDetails - Rig details object to store joint data
 * @returns {THREE.Group} The created bone group
 */
function createBoneConnectionWithJoints(startPos, endPos, radius, parentBone, childBone, rigDetails) {
    console.log(`[RigFactory] Creating bone connection from ${parentBone.name} to ${childBone.name}`);
    console.log(`[RigFactory] Start pos (local):`, startPos);
    console.log(`[RigFactory] End pos (local):`, endPos);
    
    // Create bone group
    const boneGroup = new THREE.Group();
    
    // Position at start
    boneGroup.position.copy(startPos);
    
    // Calculate direction and distance in local space
    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    
    console.log(`[RigFactory] Direction vector:`, direction);
    console.log(`[RigFactory] Distance:`, distance);
    
    // Skip if distance is too small
    if (distance < 0.001) {
        console.log(`[RigFactory] Distance too small, skipping bone connection`);
        return boneGroup;
    }
    
    // Create the bone cylinder oriented along Y axis (Three.js default)
    const boneGeometry = new THREE.CylinderGeometry(radius, radius, distance, 8);
    
    // Create alternating colored segments
    for (let i = 0; i < 8; i++) {
        const segmentGeometry = new THREE.CylinderGeometry(
            radius, radius, distance, 1, 1, false,
            (Math.PI * 2 * i) / 8,
            Math.PI * 2 / 8
        );
        
        // Alternate between primary and secondary colors
        const color = (i % 2 === 0) ? RIG_CONFIG.primaryColor : RIG_CONFIG.secondaryColor;
        const material = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            wireframe: RIG_CONFIG.wireframe,
            transparent: true,
            opacity: RIG_CONFIG.opacity
        });
        
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.userData.bonePart = 'side';
        segment.userData.sideType = (i % 2 === 0) ? 'primary' : 'secondary';
        segment.position.y = distance / 2; // Position in center of cylinder
        
        boneGroup.add(segment);
    }
    
    // Create joint spheres at both ends
    const jointMaterial = new THREE.MeshBasicMaterial({
        color: RIG_CONFIG.jointColor,
        side: THREE.DoubleSide,
        wireframe: RIG_CONFIG.wireframe,
        transparent: true,
        opacity: RIG_CONFIG.opacity
    });
    
    // Bottom joint (parent connection) - at origin of boneGroup
    const bottomJoint = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        jointMaterial.clone()
    );
    bottomJoint.userData.bonePart = 'cap';
    bottomJoint.userData.jointType = 'bottom';
    bottomJoint.userData.parentBone = parentBone;
    bottomJoint.position.y = 0; // At start of cylinder
    boneGroup.add(bottomJoint);
    
    // Top joint (child connection) - at end of cylinder
    const topJoint = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        jointMaterial.clone()
    );
    topJoint.userData.bonePart = 'cap';
    topJoint.userData.jointType = 'top';
    topJoint.userData.childBone = childBone;
    topJoint.position.y = distance; // At end of cylinder
    boneGroup.add(topJoint);
    
    // Now orient the entire bone group to point from start to end
    // We need to rotate the group so its Y axis points toward the end position
    const targetDirection = direction.clone().normalize();
    const upVector = new THREE.Vector3(0, 1, 0); // Y axis
    
    // Calculate rotation to align Y axis with target direction
    const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, targetDirection);
    boneGroup.setRotationFromQuaternion(quaternion);
    
    console.log(`[RigFactory] Applied rotation quaternion:`, quaternion);
    console.log(`[RigFactory] Final bone group position:`, boneGroup.position);
    console.log(`[RigFactory] Final bone group rotation:`, boneGroup.rotation);
    
    // Store joint data in rigDetails.joints
    if (rigDetails && rigDetails.joints) {
        rigDetails.joints.push({
            name: `Joint_${parentBone.name}_to_${childBone.name}`,
            parentBone: parentBone.name,
            childBone: childBone.name,
            position: [startPos.x, startPos.y, startPos.z],
            count: 1
        });
    }
    
    // Store references for updates
    boneGroup.userData.parentBone = parentBone;
    boneGroup.userData.childBone = childBone;
    boneGroup.userData.isVisualBone = true;
    boneGroup.userData.updatePosition = () => updateBonePosition(boneGroup);
    
    return boneGroup;
}

/**
 * Creates root bone visualizations as horizontal pucks with joint data
 * @param {Array} rootBones - Array of root bone objects
 * @param {Number} radius - Base radius for puck
 * @param {Object} rigDetails - Rig details object to store joint data
 */
function createRootBoneVisualizationsWithJoints(rootBones, radius, rigDetails) {
    console.log('[RigFactory] Creating root visualizations for', rootBones.length, 'root bones');
    
    rootBones.forEach(rootBone => {
        const rootPos = new THREE.Vector3();
        rootBone.getWorldPosition(rootPos);
        
        // Convert world position to local position relative to rig container
        rigVisualsGroup.worldToLocal(rootPos);
        
        console.log(`[RigFactory] Creating root visualization for: ${rootBone.name} at local position:`, rootPos);
        
        // Create root group
        const rootGroup = new THREE.Group();
        rootGroup.position.copy(rootPos);
        rigVisualsGroup.add(rootGroup);
        
        // Create horizontal puck
        const puckRadius = radius * 2.5;
        const puckHeight = radius * 0.5;
        const puckGeometry = new THREE.CylinderGeometry(puckRadius, puckRadius, puckHeight, 32);
        const puckMaterial = new THREE.MeshBasicMaterial({
            color: RIG_CONFIG.rootColor,
            side: THREE.DoubleSide,
            wireframe: RIG_CONFIG.wireframe,
            transparent: true,
            opacity: 0.9
        });
        
        const puck = new THREE.Mesh(puckGeometry, puckMaterial);
        puck.userData.bonePart = 'root';
        puck.userData.rootBone = rootBone;
        rootGroup.add(puck);
        
        // Store root joint data in rigDetails.joints (exactly like reference system)
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
        
        // Store references
        rootGroup.userData.rootBone = rootBone;
        rootGroup.userData.isVisualBone = true;
        rootGroup.userData.updatePosition = () => updateRootPosition(rootGroup);
        
        console.log(`[RigFactory] Created root puck for ${rootBone.name} at position:`, rootGroup.position);
    });
}

/**
 * Creates control handle at the furthest bone
 * @param {Object} bone - Target bone
 * @param {Object} container - Container to add handle to (instead of scene)
 * @param {Number} modelScale - Model scale factor
 */
function createControlHandle(bone, container, modelScale) {
    const handleSize = modelScale * 2.6;
    const geometry = new THREE.SphereGeometry(handleSize, 16, 16);
    const material = new THREE.MeshBasicMaterial({
        color: RIG_CONFIG.handleColor,
        transparent: true,
        opacity: 0.7,
        wireframe: false
    });
    
    const handle = new THREE.Mesh(geometry, material);
    handle.name = "RigControlHandle";
    handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    
    // Position at bone in LOCAL space relative to container
    const bonePos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    
    // Convert to local coordinates relative to the container
    container.worldToLocal(bonePos);
    handle.position.copy(bonePos);
    
    container.add(handle);  // Add to container instead of scene
    
    console.log(`[RigFactory] Created control handle for bone: ${bone.name} at local position:`, handle.position);
    console.log(`[RigFactory] Container rotation:`, container.rotation);
    
    // Store references for interaction system
    handle.userData.controlledBone = bone;
    handle.userData.isControlHandle = true;
    handle.userData.updatePosition = () => updateHandlePosition(handle);
    
    controlHandles.push(handle);
}

/**
 * Finds the furthest bone from root (end effector)
 * @param {Array} bones - Array of bones
 * @returns {Object} Furthest bone
 */
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

/**
 * Updates bone visual position to match actual bone
 * @param {Object} boneGroup - Bone visualization group
 */
function updateBonePosition(boneGroup) {
    if (boneGroup.userData.parentBone && boneGroup.userData.childBone) {
        const parentPos = new THREE.Vector3();
        const childPos = new THREE.Vector3();
        
        boneGroup.userData.parentBone.getWorldPosition(parentPos);
        boneGroup.userData.childBone.getWorldPosition(childPos);
        
        // Convert to local coordinates relative to the rig container
        rigVisualsGroup.worldToLocal(parentPos);
        rigVisualsGroup.worldToLocal(childPos);
        
        // Update position
        boneGroup.position.copy(parentPos);
        
        // Calculate direction and distance in local space
        const direction = new THREE.Vector3().subVectors(childPos, parentPos);
        const distance = direction.length();
        
        if (distance > 0.001) {
            // Normalize direction
            const targetDirection = direction.clone().normalize();
            const upVector = new THREE.Vector3(0, 1, 0); // Y axis
            
            // Calculate rotation to align Y axis with target direction
            const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, targetDirection);
            boneGroup.setRotationFromQuaternion(quaternion);
        }
    }
}

/**
 * Updates root bone position
 * @param {Object} rootGroup - Root visualization group
 */
function updateRootPosition(rootGroup) {
    if (rootGroup.userData.rootBone) {
        const pos = new THREE.Vector3();
        rootGroup.userData.rootBone.getWorldPosition(pos);
        
        // Convert to local coordinates relative to the rig container
        rigVisualsGroup.worldToLocal(pos);
        rootGroup.position.copy(pos);
    }
}

/**
 * Updates control handle position
 * @param {Object} handle - Control handle mesh
 */
function updateHandlePosition(handle) {
    if (handle.userData.controlledBone && handle.parent) {
        const bonePos = new THREE.Vector3();
        handle.userData.controlledBone.getWorldPosition(bonePos);
        
        // Convert to local coordinates relative to the handle's parent container
        handle.parent.worldToLocal(bonePos);
        handle.position.copy(bonePos);
    }
}

/**
 * Applies Force Z settings to render rig on top
 */
function applyForceZSettings() {
    if (!rigVisualsGroup) return;
    
    console.log('[RigFactory] Applying Force Z settings');
    
    rigVisualsGroup.renderOrder = 1000;
    
    rigVisualsGroup.traverse(object => {
        if (object.isMesh) {
            if (object.userData.bonePart === 'cap') {
                object.renderOrder = 1020;
            } else if (object.userData.bonePart === 'side') {
                object.renderOrder = 1010;
            } else if (object.userData.bonePart === 'root') {
                object.renderOrder = 1015;
            } else {
                object.renderOrder = 1000;
            }
            
            if (object.material) {
                object.material.depthTest = false;
                object.material.needsUpdate = true;
            }
        }
    });
    
    // Apply to control handles
    controlHandles.forEach(handle => {
        handle.renderOrder = 1030;
        if (handle.material) {
            handle.material.depthTest = false;
            handle.material.needsUpdate = true;
        }
    });
}

/**
 * Updates rig visualization animation frame
 */
export function updateRigVisualization() {
    if (!rigVisualsGroup || !RIG_CONFIG.displayRig || !RIG_VISUALIZATION_ENABLED) return;
    
    // Update all bone positions
    rigVisualsGroup.children.forEach(boneGroup => {
        if (boneGroup.userData.updatePosition) {
            boneGroup.userData.updatePosition();
        }
    });
    
    // Update control handles
    controlHandles.forEach(handle => {
        if (handle.userData.updatePosition) {
            handle.userData.updatePosition();
        }
    });
}

/**
 * Clears existing rig visualization from scene
 * @param {Object} scene - Three.js scene
 */
export function clearRigVisualization(scene) {
    // Clean up interaction handling first
    cleanupRigInteractionHandling();
    
    if (rigVisualsGroup && rigVisualsGroup.parent) {
        rigVisualsGroup.parent.remove(rigVisualsGroup);
        rigVisualsGroup = null;
    }
    
    // Clear control handles
    controlHandles.forEach(handle => {
        if (handle.parent) {
            handle.parent.remove(handle);
        }
    });
    controlHandles = [];
    
    bones = [];
}

/**
 * Updates rig configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateRigConfig(newConfig) {
    Object.assign(RIG_CONFIG, newConfig);
    console.log('[RigFactory] Rig config updated:', RIG_CONFIG);
    
    // Update visibility of existing rig visualizations
    if (rigVisualsGroup) {
        rigVisualsGroup.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    }
    
    // Update control handles visibility
    controlHandles.forEach(handle => {
        handle.visible = RIG_CONFIG.displayRig && RIG_VISUALIZATION_ENABLED;
    });
}