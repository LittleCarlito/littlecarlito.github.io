/**
 * Asset Debugger - Rig Panel
 * 
 * This module provides rig visualization and control functionality for the Asset Debugger.
 * It implements the same bone/rig/control parsing as the Rig Debugger.
 */
import * as THREE from 'three';
import { getState } from '../core/state.js';

// Global variables
let rigDetails = null;
let bones = [];
let boneVisualsGroup = null;
let furthestBoneHandle = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredHandle = null;

// Reusable objects for position and rotation operations
let worldPos = new THREE.Vector3();
let worldRot = new THREE.Quaternion();

// Drag state tracking
let isDragging = false;
let dragStartPosition = new THREE.Vector3();
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();
let dragTarget = null;
let dragTargetPosition = new THREE.Vector3();

// Map to track locked bones
const lockedBones = new Map();

// Material colors
const normalColor = 0xff0000; // Red
const hoverColor = 0x00ff00;  // Green
const activeColor = 0x0000ff; // Blue - for when dragging

// Rig options
const rigOptions = {
    displayRig: false, // Default to not visible
    forceZ: false,
    wireframe: true,
    primaryColor: 0xFF00FF, // Magenta
    secondaryColor: 0xFFFF00, // Yellow
    jointColor: 0x00FFFF, // Cyan
    showJointLabels: false // Default to hidden
};

// Material references
let boneMaterial = null;
let boneSideMaterial = null;

// IK settings
const IK_CHAIN_LENGTH = 3; // Maximum bones in IK chain
const IK_ITERATIONS = 10; // Number of IK solving iterations
const IK_WEIGHT = 0.1; // Weight of each iteration adjustment (changed from 0.5 to 0.1 to match rig_debugger)

/**
 * Analyze the rig data in a GLTF model
 * @param {Object} gltf - The loaded GLTF model data
 * @returns {Object} Analyzed rig details
 */
function analyzeGltfModel(gltf) {
    console.log('analyzeGltfModel called with:', gltf);
    
    if (!gltf || !gltf.scene) {
        console.error('Invalid GLTF model:', gltf);
        return null;
    }
    
    console.log('Analyzing GLTF model for rig information...');
    console.log('GLTF scene structure:', gltf.scene);
    
    const rawDetails = {
        bones: [],
        rigs: [],
        roots: [],
        controls: [] // Handles/Controls
    };
    
    // Extract scene information
    const scene = gltf.scene;
    
    // Helper function to traverse the scene
    const traverseNode = (node, parentType = null) => {
        console.log('Traversing node:', node.name, 'type:', node.type, 'isBone:', node.isBone);
        
        // Check if the node is a bone
        if (node.isBone || node.name.toLowerCase().includes('bone')) {
            console.log('Found bone:', node.name);
            rawDetails.bones.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                rotation: node.rotation ? [node.rotation.x, node.rotation.y, node.rotation.z] : null,
                parentName: parentType === 'bone' ? node.parent.name : null
            });
            parentType = 'bone';
        }
        
        // Check if the node is a rig
        if (node.name.toLowerCase().includes('rig') || node.name.toLowerCase().includes('armature')) {
            console.log('Found rig:', node.name);
            rawDetails.rigs.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                childCount: node.children ? node.children.length : 0
            });
            parentType = 'rig';
        }
        
        // Check if the node is a root
        if (node.name.toLowerCase().includes('root')) {
            console.log('Found root:', node.name);
            rawDetails.roots.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null
            });
            parentType = 'root';
        }
        
        // Check if the node is a control/handle
        if (node.name.toLowerCase().includes('control') || 
            node.name.toLowerCase().includes('ctrl') || 
            node.name.toLowerCase().includes('handle')) {
            console.log('Found control:', node.name);
            rawDetails.controls.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                type: node.name.toLowerCase().includes('control') ? 'control' : 
                      node.name.toLowerCase().includes('ctrl') ? 'ctrl' : 'handle'
            });
            parentType = 'control';
        }
        
        // Traverse children
        if (node.children) {
            node.children.forEach(child => traverseNode(child, parentType));
        }
    };
    
    // Start traversal from the scene
    console.log('Starting scene traversal');
    scene.traverse(node => traverseNode(node));
    
    // Process raw details to deduplicate items
    const result = {
        bones: deduplicateItems(rawDetails.bones),
        rigs: deduplicateItems(rawDetails.rigs),
        roots: deduplicateItems(rawDetails.roots),
        controls: deduplicateItems(rawDetails.controls)
    };
    
    console.log('Rig analysis results:', result);
    return result;
}

/**
 * Deduplicate items by name, counting duplicates
 * @param {Array} items - Array of items to deduplicate
 * @returns {Array} Deduplicated items with count property
 */
function deduplicateItems(items) {
    const uniqueItems = new Map();
    
    items.forEach(item => {
        const key = item.name;
        if (uniqueItems.has(key)) {
            const existingItem = uniqueItems.get(key);
            existingItem.count = (existingItem.count || 1) + 1;
        } else {
            uniqueItems.set(key, {...item, count: 1});
        }
    });
    
    return Array.from(uniqueItems.values());
}

/**
 * Find associated bone for a control by its name
 * @param {String} controlName - Name of the control
 * @param {Array} bones - Array of bones to search
 * @returns {Object|null} Associated bone or null if not found
 */
function findAssociatedBone(controlName, bones) {
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
 * Create a visualization of bones in the 3D scene
 * @param {Object} model - The 3D model to visualize
 * @param {Object} scene - The Three.js scene
 */
function createRigVisualization(model, scene) {
    if (!model || !scene) return;
    
    console.log('Creating rig visualization...');
    
    // Clear any existing rig visualization
    clearRigVisualization(scene);
    
    // Reset arrays
    bones = [];
    
    // Find all bones
    let armature = null;
    
    // Find armature first
    model.traverse(node => {
        if ((node.name.toLowerCase().includes('rig') || 
             node.name.toLowerCase().includes('armature')) && !armature) {
            armature = node;
            console.log('Found armature:', node.name);
        }
    });
    
    // First pass: collect all bones from armature if found
    if (armature) {
        armature.traverse(node => {
            if (node.isBone || node.name.toLowerCase().includes('bone')) {
                // Store initial rotation for reset functionality
                node.userData.initialRotation = {
                    x: node.rotation.x,
                    y: node.rotation.y,
                    z: node.rotation.z,
                    order: node.rotation.order
                };
                // Log whether this is a root bone
                if (node.name.toLowerCase().includes('root')) {
                    console.log('Found ROOT bone:', node.name);
                } else {
                    console.log('Found bone:', node.name);
                }
                bones.push(node);
            }
        });
    }
    
    // If no bones were found in the armature, search the entire model
    if (bones.length === 0) {
        console.log('No bones found in armature, searching entire model');
        model.traverse(node => {
            if (node.isBone || node.name.toLowerCase().includes('bone')) {
                // Store initial rotation for reset functionality
                node.userData.initialRotation = {
                    x: node.rotation.x,
                    y: node.rotation.y,
                    z: node.rotation.z,
                    order: node.rotation.order
                };
                // Log whether this is a root bone
                if (node.name.toLowerCase().includes('root')) {
                    console.log('Found ROOT bone in model:', node.name);
                } else {
                    console.log('Found bone in model:', node.name);
                }
                bones.push(node);
            }
        });
    }
    
    // If still no bones, exit
    if (bones.length === 0) {
        console.log('No bones found in model');
        return;
    }
    
    // Create materials for bone visualization
    boneMaterial = new THREE.MeshPhongMaterial({
        color: rigOptions.primaryColor,
        emissive: 0x072534,
        side: THREE.DoubleSide,
        flatShading: true,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Increased opacity for better visibility
    });
    
    boneSideMaterial = new THREE.MeshPhongMaterial({
        color: rigOptions.secondaryColor,
        emissive: 0x072534,
        side: THREE.DoubleSide,
        flatShading: true,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Increased opacity for better visibility
    });
    
    // Joint material (now separate from primary/secondary colors)
    const jointMaterial = new THREE.MeshPhongMaterial({
        color: rigOptions.jointColor,
        emissive: 0x072534,
        side: THREE.DoubleSide,
        flatShading: true,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Slightly more opaque for better visibility
    });
    
    // Create a group to hold all bone visualizations
    boneVisualsGroup = new THREE.Group();
    boneVisualsGroup.name = "BoneVisualizations";
    boneVisualsGroup.visible = rigOptions.displayRig;
    scene.add(boneVisualsGroup);
    
    // Group bones by parent for easier bone pair creation
    const bonesByParent = new Map();
    
    // Filter out control bones that we don't want to visualize
    const visualizableBones = bones.filter(bone => 
        !(bone.name.toLowerCase().includes('control') || 
          bone.name.toLowerCase().includes('ctrl') || 
          bone.name.toLowerCase().includes('handle'))
    );
    
    // Identify root bones
    const rootBones = visualizableBones.filter(bone => 
        bone.name.toLowerCase().includes('root')
    );
    
    // Group bones by parent for easier bone pair creation
    visualizableBones.forEach(bone => {
        if (bone.parent) {
            const parentId = bone.parent.uuid;
            if (!bonesByParent.has(parentId)) {
                bonesByParent.set(parentId, []);
            }
            bonesByParent.get(parentId).push(bone);
        }
    });
    
    // Calculate model scale for appropriate bone visualization size
    const bbox = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const modelScale = size.length() * 0.02;
    const boneRadius = Math.max(0.02, modelScale * 0.3);
    
    // Create visual bone meshes between parent-child bone pairs
    visualizableBones.forEach(bone => {
        // Skip if this bone is not in our scene
        if (!scene.getObjectById(bone.id)) return;
        
        // Get current bone position
        const bonePos = new THREE.Vector3();
        bone.getWorldPosition(bonePos);
        
        // Check if this bone has children in our bone list
        const childBones = bonesByParent.get(bone.uuid) || [];
        
        // If this bone has child bones, create a visual bone for each connection
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
            
            // Calculate distance and direction
            const distance = bonePos.distanceTo(childPos);
            
            // Only create visual bone if distance is not zero
            if (distance > 0.001) {
                // Create a group for the bone mesh
                const boneGroup = new THREE.Group();
                boneVisualsGroup.add(boneGroup);
                
                // Position bone group at parent bone position
                boneGroup.position.copy(bonePos);
                
                // Make the bone look at the child
                const direction = new THREE.Vector3().subVectors(childPos, bonePos);
                boneGroup.lookAt(childPos);
                
                // Rotate to align with standard Three.js cylinder orientation
                boneGroup.rotateX(Math.PI/2);
                
                // Pass both materials (primary and secondary) for alternating sides
                createBoneMesh(boneGroup, boneRadius, boneRadius, distance, jointMaterial, boneMaterial, boneSideMaterial);
                
                // Store reference to the bone connection
                boneGroup.userData.parentBone = bone;
                boneGroup.userData.childBone = childBone;
                
                // Add update function
                boneGroup.userData.isVisualBone = true;
                boneGroup.userData.updatePosition = createBoneUpdateFunction(boneGroup);
            }
        });
    });
    
    // Create root bone visualization (as a standalone puck)
    rootBones.forEach(rootBone => {
        // Get root bone position
        const rootPos = new THREE.Vector3();
        rootBone.getWorldPosition(rootPos);
        
        console.log(`Creating standalone root visualization for: ${rootBone.name} at position:`, rootPos);
        
        // Create a group for the root visualization
        const rootGroup = new THREE.Group();
        rootGroup.position.copy(rootPos);
        boneVisualsGroup.add(rootGroup);
        
        // Create a standalone puck for the root
        const rootPuckSize = boneRadius * 2.5;
        // Use a disk-like geometry (short, wide cylinder)
        const puckGeometry = new THREE.CylinderGeometry(rootPuckSize, rootPuckSize, rootPuckSize * 0.2, 32);
        const puckMaterial = jointMaterial.clone();
        
        const rootPuck = new THREE.Mesh(puckGeometry, puckMaterial);
        // No rotation needed - by default the cylinder is already oriented with Y-axis up
        // which means the flat sides will be parallel to the ground
        rootPuck.userData.isRootJoint = true;
        rootPuck.userData.bonePart = 'cap';
        rootPuck.userData.isJoint = true;
        rootPuck.userData.boneName = rootBone.name;
        
        // Make root puck render on top
        rootPuck.renderOrder = 25; // Higher than normal joints (10-15) but lower than handle (30)
        
        // Add to root group
        rootGroup.add(rootPuck);
        
        // Store reference to the bone
        rootGroup.userData.rootBone = rootBone;
        
        // Add update function
        rootGroup.userData.isVisualBone = true;
        rootGroup.userData.updatePosition = () => {
            if (rootGroup.userData.rootBone) {
                const pos = new THREE.Vector3();
                rootGroup.userData.rootBone.getWorldPosition(pos);
                rootGroup.position.copy(pos);
            }
        };
        
        console.log(`Root visualization created for ${rootBone.name}`);
    });
    
    // Find the furthest bone from the root and add a control handle
    const furthestBone = findFarthestBone();
    if (furthestBone) {
        addControlHandleToFurthestBone(furthestBone, scene, modelScale);
    }
    
    // Create labels for all joints
    if (rigOptions.showJointLabels) {
        console.log('Setting up joint labels');
        createJointLabels(scene);
    }
    
    // Set up mouse event listeners for hover effect
    setupMouseListeners(scene);
    
    console.log('Rig visualization created with', bones.length, 'bones');
}

/**
 * Create bone mesh with joints
 * @param {Object} parent - Parent THREE.Group to add the bone to
 * @param {Number} radiusTop - Top radius of the bone
 * @param {Number} radiusBottom - Bottom radius of the bone
 * @param {Number} height - Height of the bone
 * @param {Material} capMaterial - Material for bone caps
 * @param {Material} sideMaterial - Material for bone sides
 * @param {Material} alternateSideMaterial - Material for alternate sides
 */
function createBoneMesh(parent, radiusTop, radiusBottom, height, capMaterial, sideMaterial, alternateSideMaterial) {
    // First create a cylinder with 8 segments
    const cylinderGeometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8, 1, false);
    
    // Create all sides in one group
    const sidesGroup = new THREE.Group();
    sidesGroup.position.y = height / 2;
    parent.add(sidesGroup);
    
    // Split the cylinder into 8 segments for alternating colors
    for (let i = 0; i < 8; i++) {
        // Create a segment
        const segmentGeometry = new THREE.CylinderGeometry(
            radiusTop, radiusBottom, height, 1, 1, false,
            (Math.PI * 2 * i) / 8,
            Math.PI * 2 / 8
        );
        
        // Use alternating materials based on segment index
        const material = (i % 2 === 0) ? sideMaterial.clone() : alternateSideMaterial.clone();
        
        // Create the segment mesh
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.userData.bonePart = 'side';
        segment.userData.sideType = (i % 2 === 0) ? 'primary' : 'secondary';
        segment.userData.segmentIndex = i;
        
        sidesGroup.add(segment);
    }
    
    // Check if this is a root bone - either through parent/child data or name
    let isRootBone = false;
    
    // Check for root in parent data
    if (parent.userData.childBone && parent.userData.childBone.name.toLowerCase().includes('root')) {
        isRootBone = true;
    }
    
    // Check for root in parent data (parent bone)
    if (parent.userData.parentBone && parent.userData.parentBone.name.toLowerCase().includes('root')) {
        isRootBone = true;
    }
    
    // Create top joint sphere or puck
    let topSphere;
    
    if (isRootBone) {
        console.log("Creating ROOT PUCK for joint at top of bone connection");
        // Create a puck for root joints - shorter and wider for a flatter appearance
        const puckGeometry = new THREE.CylinderGeometry(radiusTop * 2.2, radiusTop * 2.2, radiusTop * 0.2, 32);
        topSphere = new THREE.Mesh(puckGeometry, capMaterial.clone());
        // No rotation - default cylinder orientation has the flat sides parallel to the ground
    } else {
        // Normal sphere for regular joints
        const sphereGeometry = new THREE.SphereGeometry(radiusTop * 1.2, 8, 8);
        topSphere = new THREE.Mesh(sphereGeometry, capMaterial.clone());
    }
    
    topSphere.position.y = height;
    topSphere.userData.bonePart = 'cap';
    topSphere.userData.isJoint = true;
    topSphere.userData.isRootJoint = isRootBone;
    
    // Ensure material settings
    topSphere.material.wireframe = capMaterial.wireframe;
    topSphere.material.transparent = true;
    topSphere.material.opacity = 0.9;
    topSphere.material.color.setHex(rigOptions.jointColor);
    
    // Make sure joint spheres render on top of bones
    topSphere.renderOrder = isRootBone ? 15 : 10; // Higher render order for root pucks
    parent.add(topSphere);
    
    // Store child bone name for label reference
    if (parent.userData.childBone) {
        topSphere.userData.boneName = parent.userData.childBone.name;
    }
    
    // Create bottom joint - sphere or puck based on whether it's a root
    let bottomSphere;
    
    if (isRootBone) {
        console.log("Creating ROOT PUCK for joint at bottom of bone connection");
        // Create a puck for root joints - flatter for better horizontal appearance
        const puckGeometry = new THREE.CylinderGeometry(radiusBottom * 2.2, radiusBottom * 2.2, radiusBottom * 0.2, 32);
        bottomSphere = new THREE.Mesh(puckGeometry, capMaterial.clone());
        // No rotation - cylinder's default orientation has flat sides parallel to ground
    } else {
        // Normal sphere for regular joints
        const sphereGeometry = new THREE.SphereGeometry(radiusBottom * 1.2, 8, 8);
        bottomSphere = new THREE.Mesh(sphereGeometry, capMaterial.clone());
    }
    
    bottomSphere.userData.bonePart = 'cap';
    bottomSphere.userData.isJoint = true;
    bottomSphere.userData.isRootJoint = isRootBone;
    
    // Ensure material settings 
    bottomSphere.material.wireframe = capMaterial.wireframe;
    bottomSphere.material.transparent = true;
    bottomSphere.material.opacity = 0.9;
    bottomSphere.material.color.setHex(rigOptions.jointColor);
    
    // Make sure joint spheres render on top of bones
    bottomSphere.renderOrder = isRootBone ? 15 : 10; // Higher render order for root pucks
    parent.add(bottomSphere);
    
    // Store parent bone name for label reference
    if (parent.userData.parentBone) {
        bottomSphere.userData.boneName = parent.userData.parentBone.name;
    }
}

/**
 * Create a function to update bone visuals based on bone movement
 * @param {Object} boneGroup - The visual bone group to update
 * @returns {Function} Update function for the bone
 */
function createBoneUpdateFunction(boneGroup) {
    return () => {
        if (boneGroup.userData.parentBone && boneGroup.userData.childBone) {
            const parentPos = new THREE.Vector3();
            const childPos = new THREE.Vector3();
            
            boneGroup.userData.parentBone.getWorldPosition(parentPos);
            boneGroup.userData.childBone.getWorldPosition(childPos);
            
            // Update position and orientation
            boneGroup.position.copy(parentPos);
            
            // Make the bone look at the child
            const direction = new THREE.Vector3().subVectors(childPos, parentPos);
            if (direction.lengthSq() > 0.001) {
                boneGroup.lookAt(childPos);
                boneGroup.rotateX(Math.PI/2);
                
                // Update scale to match new length
                const distance = parentPos.distanceTo(childPos);
                const children = boneGroup.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i].userData.bonePart === 'side') {
                        children[i].scale.set(1, distance / children[i].geometry.parameters.height, 1);
                        children[i].position.y = distance / 2;
                    } else if (children[i].userData.bonePart === 'cap' && children[i].position.y > 0) {
                        children[i].position.y = distance;
                    }
                }
            }
        }
    };
}

/**
 * Find the furthest bone from the root
 * @returns {Object} The furthest bone
 */
function findFarthestBone() {
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
 * Set up mouse listeners for handle interaction
 * @param {Object} scene - The Three.js scene
 */
function setupMouseListeners(scene) {
    const state = getState();
    const renderer = state.renderer;
    
    if (!renderer) return;
    
    const domElement = renderer.domElement;
    
    // Mouse move handler
    domElement.addEventListener('mousemove', (event) => {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster with the new mouse position
        if (state.camera) {
            raycaster.setFromCamera(mouse, state.camera);
        }
        
        // Check for handle hover
        checkHandleHover();
        
        // Handle dragging
        if (isDragging && dragTarget) {
            handleDrag();
        }
    });
    
    // Mouse down handler
    domElement.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return; // Only handle left mouse button
        
        const state = getState();
        if (!state.camera) return;
        
        // Check if we're clicking on a handle
        raycaster.setFromCamera(mouse, state.camera);
        const intersects = raycaster.intersectObject(furthestBoneHandle);
        
        if (intersects.length > 0) {
            console.log('Starting drag on handle:', furthestBoneHandle.name);
            startDrag(intersects[0], furthestBoneHandle);
            event.preventDefault();
        }
    });
    
    // Mouse up handler
    domElement.addEventListener('mouseup', (event) => {
        if (isDragging) {
            stopDrag();
            event.preventDefault();
        }
    });
    
    // Mouse leave handler
    domElement.addEventListener('mouseleave', (event) => {
        if (isDragging) {
            stopDrag();
        }
    });
}

/**
 * Start dragging a control handle
 * @param {Object} intersection - The intersection data from raycaster
 * @param {Object} handle - The handle being dragged
 */
function startDrag(intersection, handle) {
    const state = getState();
    
    isDragging = true;
    dragTarget = handle;
    
    // Change handle color to active
    handle.material.color.setHex(activeColor);
    
    // Store the initial position
    dragTargetPosition.copy(handle.position);
    
    // Create a drag plane perpendicular to the camera
    const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(state.camera.quaternion);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, dragTargetPosition);
    
    // Calculate offset for precise dragging
    const dragIntersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, dragIntersectionPoint);
    dragOffset.subVectors(dragTargetPosition, dragIntersectionPoint);
    
    console.log('Drag started at', dragTargetPosition);
}

/**
 * Handle dragging logic
 */
function handleDrag() {
    if (!isDragging || !dragTarget) return;
    
    const state = getState();
    
    // Get current intersection point with drag plane
    const planeIntersection = new THREE.Vector3();
    
    // Check if ray intersects plane
    if (raycaster.ray.intersectPlane(dragPlane, planeIntersection)) {
        // Apply the offset to maintain the grab point
        planeIntersection.add(dragOffset);
        
        // Move handle to new position
        dragTarget.position.copy(planeIntersection);
        
        // Apply IK if this is the furthest bone handle
        if (dragTarget === furthestBoneHandle && dragTarget.userData.controlledBone) {
            const controlledBone = dragTarget.userData.controlledBone;
            
            // Even if the controlled bone is locked, we still want to move other bones in the chain
            // This is different from before - we don't check if the target bone is locked here
            
            // Store current locked bone rotations
            restoreLockedBoneRotations();
            
            // Use the moveBonesForTarget function to handle IK chain properly
            moveBonesForTarget(controlledBone, planeIntersection);
            
            // Restore locked bone rotations again
            restoreLockedBoneRotations();
            
            // Force immediate update of visual bone meshes during drag
            updateBoneVisuals();
        }
    }
}

/**
 * Stop dragging operation
 */
function stopDrag() {
    if (!isDragging) return;
    
    console.log('Drag ended');
    
    isDragging = false;
    
    // Reset handle color
    if (dragTarget) {
        dragTarget.material.color.setHex(normalColor);
        dragTarget = null;
    }
    
    // Re-enable orbit controls
    const state = getState();
    if (state.controls && !state.controls.enabled) {
        state.controls.enabled = true;
        document.body.style.cursor = 'auto';
    }
}

/**
 * Apply inverse kinematics to bone chain
 * @param {Object} targetBone - The bone being controlled
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function applyInverseKinematics(targetBone, targetPosition) {
    if (!targetBone) return;
    
    try {
        // Get bone positions with fallbacks in case worldPos is not working
        let bonePosition = worldPos || new THREE.Vector3();
        targetBone.getWorldPosition(bonePosition);
        
        // Direction from current bone to target
        let targetDir = new THREE.Vector3().subVectors(targetPosition, bonePosition).normalize();
        
        // Get rotation with fallback
        let boneRotation = worldRot || new THREE.Quaternion();
        targetBone.getWorldQuaternion(boneRotation);
        
        // Current bone forward direction (assuming Y)
        let boneDir = new THREE.Vector3(0, 1, 0).applyQuaternion(boneRotation).normalize();
        
        // Cross product to get rotation axis
        let rotationAxis = new THREE.Vector3().crossVectors(boneDir, targetDir).normalize();
        
        // Calculate rotation angle (use MathUtils.clamp to fix the bug)
        const dotProduct = boneDir.dot(targetDir);
        const rotationAngle = Math.acos(Math.min(1, Math.max(-1, dotProduct))) * IK_WEIGHT;
        
        // Only rotate if we have a valid rotation
        if (rotationAxis.lengthSq() > 0.0001 && !isNaN(rotationAngle)) {
            // Create rotation quaternion
            const q = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
            
            // Apply to bone local rotation
            targetBone.quaternion.premultiply(q);
            
            // Update all bones to ensure proper propagation
            updateAllBoneMatrices();
        }
    } catch (error) {
        console.error('Error in applyInverseKinematics:', error);
    }
}

/**
 * Check if mouse is hovering over the control handle
 */
function checkHandleHover() {
    if (!furthestBoneHandle || isDragging) return;
    
    const state = getState();
    const camera = state.camera;
    const controls = state.controls; // Get orbit controls reference
    
    if (!camera) return;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObject(furthestBoneHandle);
    
    // Handle hover state
    if (intersects.length > 0) {
        if (hoveredHandle !== furthestBoneHandle) {
            hoveredHandle = furthestBoneHandle;
            furthestBoneHandle.material.color.setHex(hoverColor);
            
            // Disable orbit controls when hovering over handle
            if (controls && controls.enabled) {
                controls.enabled = false;
                document.body.style.cursor = 'pointer'; // Change cursor to indicate interactivity
                console.log('Disabled camera controls for handle interaction');
            }
        }
    } else if (hoveredHandle === furthestBoneHandle) {
        hoveredHandle = null;
        furthestBoneHandle.material.color.setHex(normalColor);
        
        // Re-enable orbit controls when not hovering over handle
        if (controls && !controls.enabled && !isDragging) {
            controls.enabled = true;
            document.body.style.cursor = 'auto'; // Reset cursor
            console.log('Re-enabled camera controls');
        }
    }
}

/**
 * Clear existing rig visualization from the scene
 * @param {Object} scene - The Three.js scene
 */
function clearRigVisualization(scene) {
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
 * Update animation for rig visuals
 */
function updateRigAnimation() {
    // Update bone visuals even during drag operations - changed this to update during drags too
    // Update bone visuals
    if (boneVisualsGroup) {
        boneVisualsGroup.children.forEach(boneGroup => {
            if (boneGroup.userData.updatePosition) {
                boneGroup.userData.updatePosition();
            }
        });
    }
    
    // Update furthest bone handle
    if (furthestBoneHandle && furthestBoneHandle.userData.updatePosition && !isDragging) {
        // Only update handle position when not dragging
        furthestBoneHandle.userData.updatePosition();
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
 * Restore locked bone rotations
 */
function restoreLockedBoneRotations() {
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
 * Update the rig visualization based on option changes
 */
function updateRigVisualization() {
    if (!boneVisualsGroup) return;
    
    console.log('Updating rig visualization with options:', JSON.stringify(rigOptions));
    
    // Toggle rig visibility
    if (boneVisualsGroup) {
        boneVisualsGroup.visible = rigOptions.displayRig;
    }
    
    if (furthestBoneHandle) {
        furthestBoneHandle.visible = rigOptions.displayRig;
    }
    
    // Update joint labels visibility
    const state = getState();
    const labelGroup = state.scene ? state.scene.getObjectByName("JointLabels") : null;
    
    if (labelGroup) {
        console.log('Updating joint labels visibility to:', rigOptions.showJointLabels && rigOptions.displayRig);
        labelGroup.visible = rigOptions.showJointLabels && rigOptions.displayRig;
        
        // Update individual label positions
        labelGroup.children.forEach(label => {
            if (label.userData && label.userData.updatePosition) {
                label.userData.updatePosition();
            }
        });
    } else if (rigOptions.showJointLabels && rigOptions.displayRig && state.scene) {
        // If we don't have labels but should, create them
        console.log('No label group found, creating new joint labels');
        createJointLabels(state.scene);
    }
    
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
    
    // Update all bone meshes
    boneVisualsGroup.traverse(object => {
        // Update bone sides
        if (object.isMesh && object.userData.bonePart === 'side') {
            // Handle material based on wireframe setting
            if (rigOptions.wireframe) {
                // In wireframe mode - ALL sides use primary color
                object.material.color.setHex(rigOptions.primaryColor);
            } else {
                // In filled mode - use alternating colors
                if (object.userData.sideType === 'primary') {
                    object.material.color.setHex(rigOptions.primaryColor);
                } else {
                    object.material.color.setHex(rigOptions.secondaryColor);
                }
            }
            
            // Apply wireframe setting to all sides
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
    
    // Apply force Z-index to make rig appear on top
    if (boneVisualsGroup) {
        if (rigOptions.forceZ) {
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
            
            if (furthestBoneHandle && furthestBoneHandle.material) {
                // Control handle gets highest renderOrder
                furthestBoneHandle.renderOrder = 1030;
                furthestBoneHandle.material.depthTest = false;
                furthestBoneHandle.material.needsUpdate = true;
            }
        } else {
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
            
            if (furthestBoneHandle && furthestBoneHandle.material) {
                // Control handle should still be above everything else
                furthestBoneHandle.renderOrder = 20;
                furthestBoneHandle.material.depthTest = true;
                furthestBoneHandle.material.needsUpdate = true;
            }
        }
    }
}

/**
 * Find bone by name in the scene
 * @param {string} name - The name of the bone to find
 * @returns {Object|null} The bone object or null if not found
 */
function findBoneByName(name) {
    return bones.find(bone => bone.name === name) || null;
}

/**
 * Lock or unlock a bone's rotation
 * @param {Object} bone - The bone to lock/unlock
 * @param {boolean} locked - Whether to lock (true) or unlock (false)
 */
function toggleBoneLock(bone, locked) {
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
 * Create the rig details content
 * @param {HTMLElement} container - Container to append rig details to
 * @param {Object} details - Rig details object from analyzeGltfModel
 */
function createRigDetailsContent(container, details) {
    if (!details) {
        container.innerHTML = '<p>No rig data found.</p>';
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create Rig Options section
    const optionsSection = document.createElement('div');
    optionsSection.className = 'rig-options-section';
    optionsSection.style.marginBottom = '20px';
    optionsSection.style.padding = '10px';
    optionsSection.style.backgroundColor = 'rgba(0,0,0,0.03)';
    optionsSection.style.borderRadius = '5px';
    
    const optionsTitle = document.createElement('h3');
    optionsTitle.textContent = 'Rig Options';
    optionsTitle.style.margin = '0 0 10px 0';
    optionsTitle.style.fontSize = '16px';
    optionsTitle.style.borderBottom = '1px solid var(--border-color)';
    optionsSection.appendChild(optionsTitle);
    
    // Display Rig checkbox
    const displayRigOption = createOptionToggle(
        'Display Rig', 
        rigOptions.displayRig, 
        (checked) => {
            rigOptions.displayRig = checked;
            updateRigVisualization();
            
            // Show/hide other options based on the Display Rig setting
            const optionsToToggle = optionsSection.querySelectorAll('.toggle-with-rig');
            optionsToToggle.forEach(option => {
                // Special handling for secondaryColorOption - only show when both displayRig is true AND wireframe is false
                if (option === secondaryColorOption) {
                    option.style.display = (checked && !rigOptions.wireframe) ? 'flex' : 'none';
                } else {
                    option.style.display = checked ? 'flex' : 'none';
                }
            });
        }
    );
    optionsSection.appendChild(displayRigOption);
    
    // Force Z checkbox (toggled with rig visibility)
    const forceZOption = createOptionToggle(
        'Force Z-index', 
        rigOptions.forceZ, 
        (checked) => {
            rigOptions.forceZ = checked;
            updateRigVisualization();
        }
    );
    forceZOption.classList.add('toggle-with-rig');
    forceZOption.style.display = rigOptions.displayRig ? 'flex' : 'none';
    optionsSection.appendChild(forceZOption);
    
    // Fill wireframe checkbox (toggled with rig visibility)
    const wireframeOption = createOptionToggle(
        'Fill wireframe', 
        !rigOptions.wireframe, 
        (checked) => {
            rigOptions.wireframe = !checked;
            updateRigVisualization();
            
            // Toggle visibility of secondary color option - MUST be completely gone when wireframe is enabled
            // The secondaryColorOption is only relevant when we're showing filled cylinders (wireframe=false)
            if (secondaryColorOption) {
                secondaryColorOption.style.display = (checked && rigOptions.displayRig) ? 'flex' : 'none';
            }
        }
    );
    wireframeOption.classList.add('toggle-with-rig');
    wireframeOption.style.display = rigOptions.displayRig ? 'flex' : 'none';
    optionsSection.appendChild(wireframeOption);
    
    // Primary Color picker (toggled with rig visibility)
    const primaryColorOption = createColorOption(
        'Primary Color', 
        rigOptions.primaryColor, 
        (colorHex) => {
            rigOptions.primaryColor = parseInt(colorHex.replace('#', '0x'), 16);
            updateRigVisualization();
        }
    );
    primaryColorOption.classList.add('toggle-with-rig');
    primaryColorOption.style.display = rigOptions.displayRig ? 'flex' : 'none';
    optionsSection.appendChild(primaryColorOption);
    
    // Secondary Color picker (only visible if Fill wireframe is checked AND rig is visible)
    const secondaryColorOption = createColorOption(
        'Secondary Color', 
        rigOptions.secondaryColor, 
        (colorHex) => {
            rigOptions.secondaryColor = parseInt(colorHex.replace('#', '0x'), 16);
            updateRigVisualization();
        }
    );
    secondaryColorOption.classList.add('toggle-with-rig');
    
    // Explicitly hide Secondary Color when not in filled mode
    // It should ONLY be visible when wireframe is false (filled) AND rig is visible
    secondaryColorOption.style.display = 'none'; // Start hidden by default
    
    // Only show if wireframe is false AND rig is visible
    if (!rigOptions.wireframe && rigOptions.displayRig) {
        secondaryColorOption.style.display = 'flex';
    }
    
    optionsSection.appendChild(secondaryColorOption);
    
    // Joint Color picker (toggled with rig visibility)
    const jointColorOption = createColorOption(
        'Joint Color', 
        rigOptions.jointColor, 
        (colorHex) => {
            rigOptions.jointColor = parseInt(colorHex.replace('#', '0x'), 16);
            updateRigVisualization();
        }
    );
    jointColorOption.classList.add('toggle-with-rig');
    jointColorOption.style.display = rigOptions.displayRig ? 'flex' : 'none';
    optionsSection.appendChild(jointColorOption);
    
    // Add joint labels toggle after joint color picker
    const jointLabelsOption = createOptionToggle(
        'Show Joint Labels', 
        rigOptions.showJointLabels, 
        (checked) => {
            rigOptions.showJointLabels = checked;
            updateRigVisualization();
        }
    );
    jointLabelsOption.classList.add('toggle-with-rig');
    jointLabelsOption.style.display = rigOptions.displayRig ? 'flex' : 'none';
    optionsSection.appendChild(jointLabelsOption);
    
    // Add Reset Rig button at the bottom of rig options
    const resetContainer = document.createElement('div');
    resetContainer.style.marginTop = '15px';
    resetContainer.style.textAlign = 'center';
    resetContainer.classList.add('toggle-with-rig');
    resetContainer.style.display = rigOptions.displayRig ? 'block' : 'none';
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Rig';
    resetButton.style.padding = '6px 12px';
    resetButton.style.backgroundColor = '#4CAF50';
    resetButton.style.color = 'white';
    resetButton.style.border = 'none';
    resetButton.style.borderRadius = '4px';
    resetButton.style.cursor = 'pointer';
    resetButton.style.fontWeight = 'bold';
    
    // Add hover effect
    resetButton.addEventListener('mouseover', () => {
        resetButton.style.backgroundColor = '#45a049';
    });
    
    resetButton.addEventListener('mouseout', () => {
        resetButton.style.backgroundColor = '#4CAF50';
    });
    
    resetButton.addEventListener('click', () => {
        resetRig();
    });
    
    resetContainer.appendChild(resetButton);
    optionsSection.appendChild(resetContainer);
    
    container.appendChild(optionsSection);
    
    // Create Rig Details title
    const detailsTitle = document.createElement('h3');
    detailsTitle.textContent = 'Rig Details';
    detailsTitle.style.margin = '20px 0 10px 0';
    detailsTitle.style.fontSize = '16px';
    detailsTitle.style.borderBottom = '1px solid var(--border-color)';
    container.appendChild(detailsTitle);
    
    const createSection = (title, items) => {
        const section = document.createElement('div');
        section.style.marginBottom = '15px';
        
        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = title;
        sectionTitle.style.margin = '5px 0';
        sectionTitle.style.fontSize = '14px';
        sectionTitle.style.borderBottom = '1px solid var(--border-color)';
        section.appendChild(sectionTitle);
        
        if (!items || items.length === 0) {
            const noItems = document.createElement('p');
            noItems.textContent = 'None found';
            noItems.style.fontSize = '12px';
            noItems.style.color = '#aaa';
            noItems.style.margin = '5px 0';
            section.appendChild(noItems);
        } else {
            items.forEach(item => {
                const itemElem = document.createElement('div');
                itemElem.style.fontSize = '12px';
                itemElem.style.margin = '5px 0';
                itemElem.style.padding = '3px';
                itemElem.style.backgroundColor = 'rgba(0,0,0,0.02)';
                itemElem.style.borderRadius = '3px';
                itemElem.style.position = 'relative';
                
                // Create name element
                const nameElem = document.createElement('div');
                nameElem.textContent = `Name: ${item.name}`;
                nameElem.style.paddingRight = item.count > 1 ? '40px' : '0';
                itemElem.appendChild(nameElem);
                
                // Add count as a separate styled element if more than one
                if (item.count > 1) {
                    const countElem = document.createElement('div');
                    countElem.textContent = `x${item.count}`;
                    countElem.style.position = 'absolute';
                    countElem.style.right = '5px';
                    countElem.style.top = '50%';
                    countElem.style.transform = 'translateY(-50%)';
                    countElem.style.fontSize = '14px';
                    countElem.style.fontWeight = '600';
                    countElem.style.color = '#4CAF50';
                    countElem.style.backgroundColor = 'rgba(0,0,0,0.1)';
                    countElem.style.borderRadius = '3px';
                    countElem.style.padding = '0 4px';
                    itemElem.appendChild(countElem);
                }
                
                // Add position info if available
                if (item.position) {
                    const posElem = document.createElement('div');
                    posElem.style.fontSize = '10px';
                    posElem.style.color = '#666';
                    posElem.textContent = `Pos: [${item.position.map(p => 
                        typeof p === 'number' ? p.toFixed(2) : 'undefined').join(', ')}]`;
                    itemElem.appendChild(posElem);
                }
                
                // Add type info if available
                if (item.type) {
                    const typeElem = document.createElement('div');
                    typeElem.style.fontSize = '10px';
                    typeElem.style.color = '#666';
                    typeElem.textContent = `Type: ${item.type}`;
                    itemElem.appendChild(typeElem);
                }
                
                // Add bone associations for control points
                if (title === 'Controls/Handles') {
                    const associatedBone = findAssociatedBone(item.name, details.bones);
                    if (associatedBone) {
                        const boneElem = document.createElement('div');
                        boneElem.style.fontSize = '10px';
                        boneElem.style.color = '#ffcc00'; // Yellow color as requested
                        boneElem.style.fontWeight = 'bold';
                        boneElem.textContent = `Controls bone: ${associatedBone.name}`;
                        itemElem.appendChild(boneElem);
                    }
                    
                    // Add info for furthest bone control
                    const state = getState();
                    if (state.model && furthestBoneHandle && furthestBoneHandle.userData.controlledBone) {
                        const controlElem = document.createElement('div');
                        controlElem.style.fontSize = '10px';
                        controlElem.style.color = '#ffcc00'; // Yellow color
                        controlElem.style.fontWeight = 'bold';
                        controlElem.textContent = `Connected: ${furthestBoneHandle.userData.controlledBone.name}`;
                        itemElem.appendChild(controlElem);
                    }
                }
                
                // Add Lock Rotation checkbox for bones
                if (title === 'Bones') {
                    const boneName = item.name;
                    const bone = findBoneByName(boneName);
                    
                    if (bone) {
                        const lockContainer = document.createElement('div');
                        lockContainer.style.display = 'flex';
                        lockContainer.style.alignItems = 'center';
                        lockContainer.style.marginTop = '5px';
                        
                        const lockLabel = document.createElement('label');
                        lockLabel.textContent = 'Lock Rotation:';
                        lockLabel.style.fontSize = '10px';
                        lockLabel.style.marginRight = '5px';
                        lockLabel.style.color = '#666';
                        
                        const lockCheckbox = document.createElement('input');
                        lockCheckbox.type = 'checkbox';
                        lockCheckbox.style.cursor = 'pointer';
                        
                        // Initialize checkbox state
                        lockCheckbox.checked = lockedBones.has(bone.uuid);
                        
                        lockCheckbox.addEventListener('change', (e) => {
                            toggleBoneLock(bone, e.target.checked);
                        });
                        
                        lockContainer.appendChild(lockLabel);
                        lockContainer.appendChild(lockCheckbox);
                        itemElem.appendChild(lockContainer);
                    }
                }
                
                section.appendChild(itemElem);
            });
        }
        
        return section;
    };
    
    // Create sections for each type of element
    container.appendChild(createSection('Bones', details.bones));
    container.appendChild(createSection('Rigs', details.rigs));
    container.appendChild(createSection('Roots', details.roots));
    container.appendChild(createSection('Controls/Handles', details.controls));
}

/**
 * Create a toggle option element
 * @param {String} label - Label for the toggle
 * @param {Boolean} initialValue - Initial value
 * @param {Function} onChange - Change handler
 * @returns {HTMLElement} Toggle option element
 */
function createOptionToggle(label, initialValue, onChange) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.marginBottom = '10px';
    
    const labelElem = document.createElement('span');
    labelElem.textContent = label;
    labelElem.style.fontSize = '13px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initialValue;
    checkbox.style.width = '18px';
    checkbox.style.height = '18px';
    checkbox.style.cursor = 'pointer';
    
    checkbox.addEventListener('change', () => {
        onChange(checkbox.checked);
    });
    
    container.appendChild(labelElem);
    container.appendChild(checkbox);
    
    return container;
}

/**
 * Create a color picker option element
 * @param {String} label - Label for the color picker
 * @param {Number} initialColor - Initial color as hex number
 * @param {Function} onChange - Change handler
 * @returns {HTMLElement} Color option element
 */
function createColorOption(label, initialColor, onChange) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.marginBottom = '10px';
    
    const labelElem = document.createElement('span');
    labelElem.textContent = label;
    labelElem.style.fontSize = '13px';
    
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    
    // Convert number to hex string for the color input
    const hexColor = '#' + initialColor.toString(16).padStart(6, '0');
    colorPicker.value = hexColor;
    
    colorPicker.style.width = '30px';
    colorPicker.style.height = '30px';
    colorPicker.style.cursor = 'pointer';
    colorPicker.style.border = 'none';
    colorPicker.style.padding = '0';
    colorPicker.style.backgroundColor = 'transparent';
    
    colorPicker.addEventListener('change', () => {
        onChange(colorPicker.value);
    });
    
    container.appendChild(labelElem);
    container.appendChild(colorPicker);
    
    return container;
}

/**
 * Update the rig panel with current state
 */
function updateRigPanel() {
    console.log('updateRigPanel called');
    const state = getState();
    console.log('State in updateRigPanel:', state);
    console.log('model in state:', state.model);
    
    const rigContent = document.getElementById('rig-content');
    
    if (!rigContent) {
        console.error('No rig-content element found');
        return;
    }
    
    // Clear any existing analysis if we're explicitly updating
    if (rigDetails) {
        console.log('Clearing existing rig details for fresh analysis');
        rigDetails = null;
    }
    
    // If we don't have rig details yet, try to analyze the model
    if (!rigDetails && state.model) {
        console.log('Analyzing model:', state.model);
        
        try {
            // Create a proper GLTF-like structure that analyzeGltfModel expects
            const gltfData = { scene: state.model };
            console.log('Created GLTF-like object for analysis:', gltfData);
            
            // Analyze the model to extract rig information
            rigDetails = analyzeGltfModel(gltfData);
            console.log('Rig analysis complete, results:', rigDetails);
            
            // Create the rig visualization if we have bones
            if (rigDetails && rigDetails.bones && rigDetails.bones.length > 0) {
                console.log('Creating rig visualization with', rigDetails.bones.length, 'bones');
                createRigVisualization(state.model, state.scene);
            } else {
                console.log('No bones found in rigDetails, not creating visualization');
                // Even if no bones are found, display what we did find
                if (rigDetails) {
                    console.log('Showing rig details even though no bones found');
                    createRigDetailsContent(rigContent, rigDetails);
                } else {
                    // If analysis completely failed, show error
                    console.error('Rig analysis failed completely');
                    rigContent.innerHTML = '<p>Error analyzing rig data. No rig information found.</p>';
                }
                return;
            }
        } catch (error) {
            console.error('Error analyzing rig:', error);
            rigContent.innerHTML = '<p>Error analyzing rig: ' + error.message + '</p>';
            return;
        }
    } else if (!state.model) {
        console.log('No model available for rig analysis');
        rigContent.innerHTML = '<p>No model loaded. Please load a GLB model with a rig.</p>';
        return;
    } else {
        console.log('Using existing rig details:', rigDetails);
    }
    
    // Create the rig details content
    createRigDetailsContent(rigContent, rigDetails);
}

/**
 * Add a control handle to the furthest bone
 * @param {Object} bone - The bone to add the handle to
 * @param {Object} scene - The Three.js scene
 * @param {Number} modelScale - Scale factor for the handle size
 */
function addControlHandleToFurthestBone(bone, scene, modelScale) {
    const handleSize = modelScale * 2.6; // Double the size (from 1.3 to 2.6)
    const geometry = new THREE.SphereGeometry(handleSize, 16, 16);
    const material = new THREE.MeshPhongMaterial({
        color: normalColor,
        transparent: true,
        opacity: 0.7,
        wireframe: false
    });
    
    furthestBoneHandle = new THREE.Mesh(geometry, material);
    furthestBoneHandle.name = "FurthestBoneHandle";
    scene.add(furthestBoneHandle);
    
    // Position at the furthest bone
    const bonePos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    furthestBoneHandle.position.copy(bonePos);
    
    // Add information about which bone it controls
    furthestBoneHandle.userData.controlledBone = bone;
    furthestBoneHandle.userData.isControlHandle = true;
    furthestBoneHandle.userData.updatePosition = () => {
        if (furthestBoneHandle.userData.controlledBone && !isDragging) {
            const controlledBonePos = new THREE.Vector3();
            furthestBoneHandle.userData.controlledBone.getWorldPosition(controlledBonePos);
            furthestBoneHandle.position.copy(controlledBonePos);
        }
    };
    
    console.log('Added control handle to furthest bone:', bone.name);
}

/**
 * Update matrices for all bones in the scene
 */
function updateAllBoneMatrices() {
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
 * Apply inverse kinematics to a chain of bones to reach a target
 * @param {Array} boneChain - Array of bones from parent to child
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function applyIKToChain(boneChain, targetPosition) {
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
 * Move a chain of bones to reach a target position
 * @param {Object} targetBone - The target bone being controlled
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function moveBonesForTarget(targetBone, targetPosition) {
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
    applyIKToChain(boneChain, targetPosition);
    
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

/**
 * Reset the rig to its initial position
 */
function resetRig() {
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
    if (furthestBoneHandle && furthestBoneHandle.userData.updatePosition) {
        furthestBoneHandle.userData.updatePosition();
    }
    
    console.log('Rig reset complete');
}

/**
 * Create joint labels for all joints in the scene
 * @param {Object} scene - The Three.js scene
 */
function createJointLabels(scene) {
    console.log('Creating joint labels...');
    
    // Remove any existing labels first
    clearJointLabels(scene);
    
    // Create a group to hold all labels
    const labelGroup = new THREE.Group();
    labelGroup.name = "JointLabels";
    labelGroup.visible = rigOptions.showJointLabels && rigOptions.displayRig;
    scene.add(labelGroup);
    
    // Keep track of the labels created
    const labelCount = {total: 0, added: 0};
    
    // Find all bone meshes
    boneVisualsGroup.traverse((object) => {
        if (object.userData && object.userData.bonePart === 'cap') {
            labelCount.total++;
            
            // Determine which bone name to use
            let boneName = "";
            if (object.parent && object.parent.userData) {
                if (object.position.y > 0 && object.parent.userData.childBone) {
                    // Top sphere - use child bone name
                    boneName = object.parent.userData.childBone.name;
                } else if (object.position.y === 0 && object.parent.userData.parentBone) {
                    // Bottom sphere - use parent bone name
                    boneName = object.parent.userData.parentBone.name;
                }
            }
            
            if (boneName) {
                // Create a label for this joint
                const label = createSimpleLabel(boneName, object, scene);
                if (label) {
                    labelGroup.add(label);
                    labelCount.added++;
                }
            }
        }
    });
    
    console.log(`Created ${labelCount.added} labels out of ${labelCount.total} joint spheres found`);
    return labelGroup;
}

/**
 * Create a simple text label as a sprite
 * @param {string} text - Text to display
 * @param {Object} joint - Joint object to attach to
 * @param {Object} scene - Three.js scene
 * @returns {Object} The created label sprite
 */
function createSimpleLabel(text, joint, scene) {
    console.log(`Creating label for joint: ${text}`);

    // Create a canvas for the label
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 256;
    canvas.height = 64;
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Text
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Truncate text if too long
    const displayText = text.length > 20 ? text.substring(0, 17) + '...' : text;
    ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);
    
    // Create sprite material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.userData.isJointLabel = true;
    sprite.userData.targetJoint = joint;
    
    // Set initial position
    updateLabelPosition(sprite, joint);
    
    // Set proper scale (fixed size regardless of distance)
    const jointRadius = joint.geometry.parameters.radius || 0.1;
    sprite.scale.set(jointRadius * 8, jointRadius * 2, 1);
    
    // Set initial visibility
    sprite.visible = rigOptions.showJointLabels;
    
    // Set up the update function
    sprite.userData.updatePosition = () => {
        updateLabelPosition(sprite, joint);
    };
    
    // Make sure the sprite renders on top
    sprite.renderOrder = 1000;
    
    return sprite;
}

/**
 * Update the position of a joint label
 * @param {Object} label - The label sprite
 * @param {Object} joint - The joint the label is attached to
 */
function updateLabelPosition(label, joint) {
    if (!label || !joint) return;
    
    // Get the joint's world position
    const jointPos = new THREE.Vector3();
    joint.getWorldPosition(jointPos);
    
    // Position the label slightly above the joint
    label.position.copy(jointPos);
    
    // Add offset based on joint position (top or bottom)
    if (joint.position && joint.position.y > 0) {
        // Top joint - place above
        label.position.y += joint.geometry.parameters.radius * 2;
    } else {
        // Bottom joint - place to the side
        label.position.x += joint.geometry.parameters.radius * 2;
    }
}

/**
 * Clear all joint labels from the scene
 * @param {Object} scene - The Three.js scene
 */
function clearJointLabels(scene) {
    const existingLabels = scene.getObjectByName("JointLabels");
    if (existingLabels) {
        scene.remove(existingLabels);
    }
}

/**
 * Update the bone visual meshes to match bone positions and rotations
 */
function updateBoneVisuals() {
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
}

// Export functions
export { analyzeGltfModel, updateRigAnimation, updateAllBoneMatrices, updateRigPanel }; 