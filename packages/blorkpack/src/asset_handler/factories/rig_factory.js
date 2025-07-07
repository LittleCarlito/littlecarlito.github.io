import { THREE } from '../../index';
import { setupRigInteractionHandling, cleanupRigInteractionHandling } from '../../rig_interaction_handler';

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
 * Creates rig visualization from analyzed rig data
 * @param {Object} rigDetails - Analyzed rig data from RigAnalyzer
 * @param {Object} scene - Three.js scene
 * @param {Object} asset - The asset mesh containing the rig
 * @returns {Object} Created rig visualization data
 */
export function createRigVisualization(rigDetails, scene, asset) {
    console.log('[RigFactory] Creating rig visualization for:', rigDetails);
    
    // Clear any existing rig visualization
    clearRigVisualization(scene);
    
    // Create main rig group
    rigVisualsGroup = new THREE.Group();
    rigVisualsGroup.name = "RigVisualization";
    rigVisualsGroup.visible = RIG_CONFIG.displayRig;
    scene.add(rigVisualsGroup);
    
    // Extract bones from the asset
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
    
    // Calculate model scale for appropriate bone visualization size
    const bbox = new THREE.Box3().setFromObject(asset);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const modelScale = size.length() * 0.02;
    const boneRadius = Math.max(0.02, modelScale * 0.3);
    
    // Create bone visualizations
    createBoneStructure(bones, boneRadius);
    
    // Create root bone visualizations
    createRootBoneVisualizations(bones, boneRadius);
    
    // Create control handle at furthest bone
    const furthestBone = findFarthestBone(bones);
    if (furthestBone) {
        createControlHandle(furthestBone, scene, modelScale);
    }
    
    // Apply Force Z settings if enabled
    if (RIG_CONFIG.forceZ) {
        applyForceZSettings();
    }
    
    // Set up interaction handling for control handles
    if (controlHandles.length > 0) {
        setupRigInteractionHandling(controlHandles, scene);
    }
    
    console.log('[RigFactory] Rig visualization created successfully');
    
    return {
        group: rigVisualsGroup,
        bones: bones,
        handles: controlHandles
    };
}

/**
 * Creates bone structure visualization with cylinders and joints
 * @param {Array} bones - Array of bone objects
 * @param {Number} boneRadius - Radius for bone visualization
 */
function createBoneStructure(bones, boneRadius) {
    // Group bones by parent for easier bone pair creation
    const bonesByParent = new Map();
    
    // Filter out control bones that we don't want to visualize
    const visualizableBones = bones.filter(bone => 
        !(bone.name.toLowerCase().includes('control') || 
          bone.name.toLowerCase().includes('ctrl') || 
          bone.name.toLowerCase().includes('handle'))
    );
    
    // Group bones by parent
    visualizableBones.forEach(bone => {
        if (bone.parent && bone.parent.isBone) {
            const parentId = bone.parent.uuid;
            if (!bonesByParent.has(parentId)) {
                bonesByParent.set(parentId, []);
            }
            bonesByParent.get(parentId).push(bone);
        }
    });
    
    // Create visual bones between parent-child bone pairs
    visualizableBones.forEach(bone => {
        // Get current bone position
        const bonePos = new THREE.Vector3();
        bone.getWorldPosition(bonePos);
        
        // Check if this bone has children in our bone list
        const childBones = bonesByParent.get(bone.uuid) || [];
        
        // Create a visual bone for each child connection
        childBones.forEach(childBone => {
            // Skip control bones
            if (childBone.name.toLowerCase().includes('control') || 
                childBone.name.toLowerCase().includes('ctrl') || 
                childBone.name.toLowerCase().includes('handle')) {
                return;
            }
            
            // Get child bone position
            const childPos = new THREE.Vector3();
            childBone.getWorldPosition(childPos);
            
            // Calculate distance
            const distance = bonePos.distanceTo(childPos);
            
            // Only create visual bone if distance is significant
            if (distance > 0.001) {
                createBoneConnection(bonePos, childPos, boneRadius, bone, childBone);
            }
        });
    });
}

/**
 * Creates a bone connection between two points
 * @param {THREE.Vector3} startPos - Start position
 * @param {THREE.Vector3} endPos - End position  
 * @param {Number} radius - Bone radius
 * @param {Object} parentBone - Parent bone object
 * @param {Object} childBone - Child bone object
 */
function createBoneConnection(startPos, endPos, radius, parentBone, childBone) {
    // Create bone group
    const boneGroup = new THREE.Group();
    rigVisualsGroup.add(boneGroup);
    
    // Position at start
    boneGroup.position.copy(startPos);
    
    // Calculate direction and distance
    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    
    // Orient bone towards end position
    boneGroup.lookAt(endPos);
    boneGroup.rotateX(Math.PI / 2);
    
    // Create bone cylinder with 8 segments for alternating colors
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
        segment.position.y = distance / 2;
        
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
    
    // Bottom joint
    const bottomJoint = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        jointMaterial.clone()
    );
    bottomJoint.userData.bonePart = 'cap';
    bottomJoint.userData.jointType = 'bottom';
    boneGroup.add(bottomJoint);
    
    // Top joint
    const topJoint = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        jointMaterial.clone()
    );
    topJoint.userData.bonePart = 'cap';
    topJoint.userData.jointType = 'top';
    topJoint.position.y = distance;
    boneGroup.add(topJoint);
    
    // Store references for updates
    boneGroup.userData.parentBone = parentBone;
    boneGroup.userData.childBone = childBone;
    boneGroup.userData.isVisualBone = true;
    boneGroup.userData.updatePosition = () => updateBonePosition(boneGroup);
}

/**
 * Creates root bone visualizations as horizontal pucks
 * @param {Array} bones - Array of bone objects
 * @param {Number} radius - Base radius for puck
 */
function createRootBoneVisualizations(bones, radius) {
    const rootBones = bones.filter(bone => 
        bone.name.toLowerCase().includes('root')
    );
    
    rootBones.forEach(rootBone => {
        const rootPos = new THREE.Vector3();
        rootBone.getWorldPosition(rootPos);
        
        console.log(`[RigFactory] Creating root visualization for: ${rootBone.name}`);
        
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
        
        // Store references
        rootGroup.userData.rootBone = rootBone;
        rootGroup.userData.isVisualBone = true;
        rootGroup.userData.updatePosition = () => updateRootPosition(rootGroup);
    });
}

/**
 * Creates control handle at the furthest bone
 * @param {Object} bone - Target bone
 * @param {Object} scene - Three.js scene
 * @param {Number} modelScale - Model scale factor
 */
function createControlHandle(bone, scene, modelScale) {
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
    scene.add(handle);
    
    // Position at bone
    const bonePos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    handle.position.copy(bonePos);
    
    // Store references for interaction system
    handle.userData.controlledBone = bone;
    handle.userData.isControlHandle = true;
    handle.userData.updatePosition = () => updateHandlePosition(handle);
    
    controlHandles.push(handle);
    
    console.log(`[RigFactory] Created control handle for bone: ${bone.name}`);
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
        
        // Update position and orientation
        boneGroup.position.copy(parentPos);
        
        const direction = new THREE.Vector3().subVectors(childPos, parentPos);
        if (direction.lengthSq() > 0.001) {
            boneGroup.lookAt(childPos);
            boneGroup.rotateX(Math.PI / 2);
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
        rootGroup.position.copy(pos);
    }
}

/**
 * Updates control handle position
 * @param {Object} handle - Control handle mesh
 */
function updateHandlePosition(handle) {
    if (handle.userData.controlledBone) {
        const bonePos = new THREE.Vector3();
        handle.userData.controlledBone.getWorldPosition(bonePos);
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
    if (!rigVisualsGroup || !RIG_CONFIG.displayRig) return;
    
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
    
    if (rigVisualsGroup) {
        scene.remove(rigVisualsGroup);
        rigVisualsGroup = null;
    }
    
    // Clear control handles
    controlHandles.forEach(handle => {
        scene.remove(handle);
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
}