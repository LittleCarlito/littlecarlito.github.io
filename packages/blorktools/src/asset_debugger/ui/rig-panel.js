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

// Add global variables to track collapse states
let optionsCollapseState = false; // false = collapsed, true = expanded
let detailsCollapseState = false; // false = collapsed, true = expanded

// Add variables to track axis indicator state
let axisIndicatorCollapsed = false;
let axisIndicatorPosition = { x: null, y: null }; // null means use default position

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
        controls: [], // Handles/Controls
        joints: []    // Add joints array to store joint data
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
        controls: deduplicateItems(rawDetails.controls),
        joints: deduplicateItems(rawDetails.joints)
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
    
    // Create axis indicator
    const state = getState();
    if (state.renderer && state.camera) {
        createAxisIndicator(scene, state.camera, state.renderer);
    }
    
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
                
                // Store the joint data for the rig details panel
                if (rigDetails && rigDetails.joints) {
                    rigDetails.joints.push({
                        name: `Joint_${bone.name}_to_${childBone.name}`,
                        parentBone: bone.name,
                        childBone: childBone.name,
                        position: [bonePos.x, bonePos.y, bonePos.z],
                        count: 1
                    });
                }
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
        
        // Store the root joint data for the rig details panel
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
        
        // Skip if Display Rig is not enabled
        if (!rigOptions.displayRig) return;
        
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
    // Don't check for hover if rig display is disabled or handle doesn't exist
    if (!rigOptions.displayRig || !furthestBoneHandle || isDragging) return;
    
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
        if (furthestBoneHandle.userData.updatePosition && !isDragging) {
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
    
    // Refresh the joints data
    refreshJointsData();
    
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
    
    // Create header with collapse functionality for Rig Options
    const optionsHeader = document.createElement('div');
    optionsHeader.style.display = 'flex';
    optionsHeader.style.alignItems = 'center';
    optionsHeader.style.cursor = 'pointer';
    optionsHeader.style.userSelect = 'none';
    
    // Create collapse indicator
    const optionsCollapseIndicator = document.createElement('span');
    optionsCollapseIndicator.textContent = optionsCollapseState ? '▼' : '▶'; // Use stored state
    optionsCollapseIndicator.style.marginRight = '8px';
    optionsCollapseIndicator.style.fontSize = '12px';
    optionsCollapseIndicator.style.transition = 'transform 0.2s';
    
    const optionsTitle = document.createElement('h3');
    optionsTitle.textContent = 'Rig Options';
    optionsTitle.style.margin = '0 0 10px 0';
    optionsTitle.style.fontSize = '16px';
    optionsTitle.style.flex = '1';
    optionsTitle.style.borderBottom = '1px solid var(--border-color)';
    
    optionsHeader.appendChild(optionsCollapseIndicator);
    optionsHeader.appendChild(optionsTitle);
    optionsSection.appendChild(optionsHeader);
    
    // Create content container for options (use stored collapse state)
    const optionsContent = document.createElement('div');
    optionsContent.style.display = optionsCollapseState ? 'block' : 'none'; // Use stored state
    optionsContent.style.transition = 'height 0.2s';
    optionsContent.style.overflow = 'hidden';
    optionsSection.appendChild(optionsContent);
    
    // Add click handler to toggle collapse
    optionsHeader.addEventListener('click', () => {
        optionsCollapseState = !optionsCollapseState; // Toggle stored state
        if (optionsCollapseState) {
            optionsContent.style.display = 'block';
            optionsCollapseIndicator.textContent = '▼'; // Down arrow (expanded)
        } else {
            optionsContent.style.display = 'none';
            optionsCollapseIndicator.textContent = '▶'; // Right arrow (collapsed)
        }
    });
    
    // Display Rig checkbox
    const displayRigOption = createOptionToggle(
        'Display Rig', 
        rigOptions.displayRig, 
        (checked) => {
            rigOptions.displayRig = checked;
            updateRigVisualization();
            
            // Show/hide other options based on the Display Rig setting
            const optionsToToggle = optionsContent.querySelectorAll('.toggle-with-rig');
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
    optionsContent.appendChild(displayRigOption);
    
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
    optionsContent.appendChild(forceZOption);
    
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
    optionsContent.appendChild(wireframeOption);
    
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
    optionsContent.appendChild(primaryColorOption);
    
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
    
    optionsContent.appendChild(secondaryColorOption);
    
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
    optionsContent.appendChild(jointColorOption);
    
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
    optionsContent.appendChild(jointLabelsOption);
    
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
    optionsContent.appendChild(resetContainer);
    
    container.appendChild(optionsSection);
    
    // Create Rig Details section (collapsible)
    const detailsSection = document.createElement('div');
    detailsSection.className = 'rig-details-section';
    detailsSection.style.marginBottom = '20px';
    detailsSection.style.padding = '10px';
    detailsSection.style.backgroundColor = 'rgba(0,0,0,0.03)';
    detailsSection.style.borderRadius = '5px';
    
    // Create header with collapse functionality for Rig Details
    const detailsHeader = document.createElement('div');
    detailsHeader.style.display = 'flex';
    detailsHeader.style.alignItems = 'center';
    detailsHeader.style.cursor = 'pointer';
    detailsHeader.style.userSelect = 'none';
    detailsHeader.style.marginBottom = '10px';
    
    // Create collapse indicator
    const detailsCollapseIndicator = document.createElement('span');
    detailsCollapseIndicator.textContent = detailsCollapseState ? '▼' : '▶'; // Use stored state
    detailsCollapseIndicator.style.marginRight = '8px';
    detailsCollapseIndicator.style.fontSize = '12px';
    detailsCollapseIndicator.style.transition = 'transform 0.2s';
    
    const detailsTitle = document.createElement('h3');
    detailsTitle.textContent = 'Rig Details';
    detailsTitle.style.margin = '0';
    detailsTitle.style.fontSize = '16px';
    detailsTitle.style.flex = '1';
    detailsTitle.style.borderBottom = '1px solid var(--border-color)';
    
    detailsHeader.appendChild(detailsCollapseIndicator);
    detailsHeader.appendChild(detailsTitle);
    detailsSection.appendChild(detailsHeader);
    
    // Create content container for details (use stored collapse state)
    const detailsContent = document.createElement('div');
    detailsContent.style.display = detailsCollapseState ? 'block' : 'none'; // Use stored state
    detailsContent.style.transition = 'height 0.2s';
    detailsContent.style.overflow = 'hidden';
    detailsSection.appendChild(detailsContent);
    
    // Add click handler to toggle collapse
    detailsHeader.addEventListener('click', () => {
        detailsCollapseState = !detailsCollapseState; // Toggle stored state
        if (detailsCollapseState) {
            detailsContent.style.display = 'block';
            detailsCollapseIndicator.textContent = '▼'; // Down arrow (expanded)
        } else {
            detailsContent.style.display = 'none';
            detailsCollapseIndicator.textContent = '▶'; // Right arrow (collapsed)
        }
    });
    
    container.appendChild(detailsSection);
    
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
                
                // Special handling for Joints section
                if (title === 'Joints') {
                    if (item.isRoot) {
                        const rootElem = document.createElement('div');
                        rootElem.style.fontSize = '10px';
                        rootElem.style.color = '#8800cc'; // Purple color for root joint
                        rootElem.style.fontWeight = 'bold';
                        rootElem.textContent = 'Root Joint';
                        rootElem.style.backgroundColor = 'rgba(136, 0, 204, 0.1)';
                        rootElem.style.padding = '2px 4px';
                        rootElem.style.borderRadius = '3px';
                        rootElem.style.display = 'inline-block';
                        rootElem.style.marginTop = '2px';
                        itemElem.appendChild(rootElem);
                    }
                    
                    if (item.parentBone) {
                        const parentElem = document.createElement('div');
                        parentElem.style.fontSize = '10px';
                        parentElem.style.color = '#0088cc'; // Blue color for parent bone
                        parentElem.style.fontWeight = 'bold';
                        parentElem.textContent = `Parent: ${item.parentBone}`;
                        itemElem.appendChild(parentElem);
                    }
                    
                    if (item.childBone) {
                        const childElem = document.createElement('div');
                        childElem.style.fontSize = '10px';
                        childElem.style.color = '#cc8800'; // Amber color for child bone
                        childElem.style.fontWeight = 'bold';
                        childElem.textContent = `Child: ${item.childBone}`;
                        itemElem.appendChild(childElem);
                    }
                    
                    // Add joint type dropdown
                    const jointTypeContainer = document.createElement('div');
                    jointTypeContainer.style.display = 'flex';
                    jointTypeContainer.style.alignItems = 'center';
                    jointTypeContainer.style.marginTop = '5px';
                    
                    const jointTypeLabel = document.createElement('label');
                    jointTypeLabel.textContent = 'Joint Type:';
                    jointTypeLabel.style.fontSize = '10px';
                    jointTypeLabel.style.marginRight = '5px';
                    jointTypeLabel.style.color = '#666';
                    
                    const jointTypeSelect = document.createElement('select');
                    jointTypeSelect.style.fontSize = '10px';
                    jointTypeSelect.style.backgroundColor = 'rgba(0,0,0,0.05)';
                    jointTypeSelect.style.border = '1px solid #444';
                    jointTypeSelect.style.borderRadius = '3px';
                    jointTypeSelect.style.color = '#ddd';
                    jointTypeSelect.style.padding = '2px 5px';
                    
                    // For now, only one option
                    const sphericalOption = document.createElement('option');
                    sphericalOption.value = 'spherical';
                    sphericalOption.textContent = 'Spherical';
                    jointTypeSelect.appendChild(sphericalOption);
                    
                    // Store the current joint type in the user data
                    jointTypeSelect.value = item.jointType || 'spherical';
                    
                    // Add event listener to update jointType when changed
                    jointTypeSelect.addEventListener('change', () => {
                        // Update the joint type in the item data
                        item.jointType = jointTypeSelect.value;
                    });
                    
                    jointTypeContainer.appendChild(jointTypeLabel);
                    jointTypeContainer.appendChild(jointTypeSelect);
                    itemElem.appendChild(jointTypeContainer);
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
    detailsContent.appendChild(createSection('Bones', details.bones));
    
    // Add Joints section after Bones
    const jointsData = details.joints || [];
    detailsContent.appendChild(createSection('Joints', jointsData));
    
    detailsContent.appendChild(createSection('Rigs', details.rigs));
    detailsContent.appendChild(createSection('Roots', details.roots));
    detailsContent.appendChild(createSection('Controls/Handles', details.controls));
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

/**
 * Refresh the joints data based on the current bone visualizations
 */
function refreshJointsData() {
    // Clear existing joints data
    if (rigDetails && rigDetails.joints) {
        // Keep track of joint types from the existing data
        const jointTypeMap = {};
        rigDetails.joints.forEach(joint => {
            if (joint.name && joint.jointType) {
                jointTypeMap[joint.name] = joint.jointType;
            }
        });
        
        rigDetails.joints = [];
        
        // Collect joint data from all bone visualizations
        if (boneVisualsGroup) {
            boneVisualsGroup.traverse(object => {
                if (object.userData && object.userData.isVisualBone) {
                    // Get the parent and child bones
                    const parentBone = object.userData.parentBone;
                    const childBone = object.userData.childBone;
                    
                    if (parentBone && childBone) {
                        // Regular joint between parent and child
                        const jointName = `Joint_${parentBone.name}_to_${childBone.name}`;
                        rigDetails.joints.push({
                            name: jointName,
                            parentBone: parentBone.name,
                            childBone: childBone.name,
                            position: [object.position.x, object.position.y, object.position.z],
                            count: 1,
                            jointType: jointTypeMap[jointName] || 'spherical' // Preserve existing type or use default
                        });
                    } else if (object.userData.rootBone) {
                        // Root joint
                        const rootBone = object.userData.rootBone;
                        const jointName = `Root_Joint_${rootBone.name}`;
                        rigDetails.joints.push({
                            name: jointName,
                            parentBone: "Scene Root",
                            childBone: rootBone.name,
                            position: [object.position.x, object.position.y, object.position.z],
                            count: 1,
                            isRoot: true,
                            jointType: jointTypeMap[jointName] || 'spherical' // Preserve existing type or use default
                        });
                    }
                }
            });
        }
        
        // Deduplicate the joints data
        rigDetails.joints = deduplicateItems(rigDetails.joints);
    }
}

/**
 * Create a coordinate axis indicator that blends into the scene
 * @param {Object} scene - The Three.js scene
 * @param {Object} camera - The Three.js camera
 * @param {Object} renderer - The Three.js renderer
 */
function createAxisIndicator(scene, camera, renderer) {
    console.log('Creating modern axis indicator');
    
    // Create a new scene for the axis indicator
    const axisScene = new THREE.Scene();
    // Make background transparent to blend with main scene
    axisScene.background = null;
    
    // Create a camera for the axis indicator with wider field of view
    const axisCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 20);
    axisCamera.position.set(0, 0, 5); // Position even further back to ensure all axes visible
    axisCamera.lookAt(0, 0, 0);
    
    // Create modern axes
    const createAxis = (dir, color) => {
        const group = new THREE.Group();
        
        // Create line for positive axis direction
        const lineGeometry = new THREE.BufferGeometry();
        // Make line slightly shorter to leave space for arrow
        const endPoint = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(0.85);
        lineGeometry.setAttribute('position', 
            new THREE.Float32BufferAttribute([0, 0, 0, endPoint.x, endPoint.y, endPoint.z], 3));
        
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: color,
            linewidth: 8,  // Increased from 5 to 8
            depthTest: false,
            transparent: true,
            opacity: 1.0
        });
        
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);
        
        // Create negative axis direction (thicker, more visible dotted line)
        const negLineGeometry = new THREE.BufferGeometry();
        const negDir = new THREE.Vector3(-dir.x, -dir.y, -dir.z).multiplyScalar(0.85); // Increased from 0.7
        negLineGeometry.setAttribute('position', 
            new THREE.Float32BufferAttribute([0, 0, 0, negDir.x, negDir.y, negDir.z], 3));
        
        const dashedLineMaterial = new THREE.LineDashedMaterial({
            color: color,
            linewidth: 10, // Increased from 8
            scale: 1,
            dashSize: 0.18, // Increased from 0.15
            gapSize: 0.07,
            depthTest: false,
            transparent: true,
            opacity: 0.9  // Increased from 0.8
        });
        
        const dashedLine = new THREE.Line(negLineGeometry, dashedLineMaterial);
        dashedLine.computeLineDistances(); // Required for dashed lines
        group.add(dashedLine);
        
        // Create modern arrow head (smaller)
        const arrowGeometry = new THREE.CylinderGeometry(0, 0.1, 0.25, 8, 1); // Reduced from 0.15, 0.35
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 1.0,
            depthTest: false
        });
        
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Position at the end of the line
        arrow.position.copy(dir);
        
        // Rotate arrow to point in the right direction
        if (dir.x === 1) {
            arrow.rotation.z = -Math.PI / 2;
        } else if (dir.y === 1) {
            // Default orientation works for Y
        } else if (dir.z === 1) {
            arrow.rotation.x = Math.PI / 2;
        }
        
        group.add(arrow);
        
        // Create text label
        const text = dir.x === 1 ? 'X' : dir.y === 1 ? 'Y' : 'Z';
        const canvas = document.createElement('canvas');
        canvas.width = 192;  // Increased from 128 to 192
        canvas.height = 192; // Increased from 128 to 192
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw text with a subtle glow effect
        ctx.font = 'bold 90px Arial'; // Increased from 68px to 90px
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add a subtle glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;  // Increased from 8 to 10
        ctx.fillStyle = color;
        ctx.fillText(text, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        // Position text beyond the arrow
        sprite.position.copy(dir).multiplyScalar(1.5); // Increased from 1.4 to 1.5
        sprite.scale.set(0.6, 0.6, 0.6); // Increased from 0.45 to 0.6
        
        group.add(sprite);
        
        return group;
    };
    
    // Create the three axes with modern colors
    const xAxis = createAxis(new THREE.Vector3(1, 0, 0), '#ff4136'); // Vibrant red
    const yAxis = createAxis(new THREE.Vector3(0, 1, 0), '#2ecc40'); // Vibrant green
    const zAxis = createAxis(new THREE.Vector3(0, 0, 1), '#0074d9'); // Vibrant blue
    
    axisScene.add(xAxis);
    axisScene.add(yAxis);
    axisScene.add(zAxis);
    
    // Add a subtle center dot
    const centerGeometry = new THREE.SphereGeometry(0.06, 16, 16); // Increased from 0.04, 12, 12
    const centerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,  // Increased from 0.8
        depthTest: false
    });
    const centerSphere = new THREE.Mesh(centerGeometry, centerMaterial);
    axisScene.add(centerSphere);
    
    // Store references for cleanup later if needed
    const state = getState();
    state.axisScene = axisScene;
    state.axisCamera = axisCamera;
    
    // Find the correct viewport container (using the viewport ID)
    let viewportContainer = document.getElementById('viewport');
    
    // Fallback to direct parent if viewport not found
    if (!viewportContainer) {
        console.log('Viewport element not found, using renderer parent');
        viewportContainer = renderer.domElement.closest('#viewport') || 
                          renderer.domElement.closest('#view-container') ||
                          renderer.domElement.closest('.view-panel') ||
                          renderer.domElement.parentElement;
    }
    
    console.log('Found viewport container:', viewportContainer);
    
    // Size for the axis indicator (proportional to viewport size)
    const size = Math.min(180, viewportContainer.offsetWidth / 4);
    
    // Create container for the entire axis indicator (header + display)
    const axisContainer = document.createElement('div');
    axisContainer.id = 'axis-indicator-container';
    axisContainer.style.position = 'absolute';
    axisContainer.style.width = `${size}px`;
    axisContainer.style.zIndex = '1000';
    axisContainer.style.pointerEvents = 'auto';
    axisContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    axisContainer.style.border = '1px solid rgba(50, 50, 50, 0.7)';
    axisContainer.style.borderRadius = '5px';
    axisContainer.style.overflow = 'hidden';
    
    // Initial position (top-right corner of the viewport)
    const margin = 10;
    if (axisIndicatorPosition.x === null || axisIndicatorPosition.y === null) {
        axisIndicatorPosition.x = viewportContainer.offsetWidth - size - margin;
        axisIndicatorPosition.y = margin;
    }
    
    axisContainer.style.left = `${axisIndicatorPosition.x}px`;
    axisContainer.style.top = `${axisIndicatorPosition.y}px`;
    
    // Create the header
    const header = document.createElement('div');
    header.id = 'axis-indicator-header';
    header.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
    header.style.color = 'white';
    header.style.padding = '5px 10px';
    header.style.cursor = 'grab';
    header.style.userSelect = 'none';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.width = '100%'; // Full width
    header.style.boxSizing = 'border-box'; // Include padding in width calculation
    
    // Add title
    const title = document.createElement('span');
    title.textContent = 'Axis Indicator';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '12px';
    
    // Add collapse/expand button
    const collapseBtn = document.createElement('span');
    collapseBtn.textContent = axisIndicatorCollapsed ? '▼' : '▲';
    collapseBtn.style.fontSize = '12px';
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.style.marginLeft = '10px';
    collapseBtn.style.width = '15px';
    collapseBtn.style.textAlign = 'center';
    
    // Add collapse functionality
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering drag
        axisIndicatorCollapsed = !axisIndicatorCollapsed;
        collapseBtn.textContent = axisIndicatorCollapsed ? '▼' : '▲';
        
        // Toggle display area visibility directly
        const canvasContainer = document.getElementById('axis-indicator-canvas-container');
        if (canvasContainer) {
            canvasContainer.style.display = axisIndicatorCollapsed ? 'none' : 'block';
            // Update container height when collapsed/expanded
            updateContainerHeight();
        }
    });
    
    // Add elements to header
    header.appendChild(title);
    header.appendChild(collapseBtn);
    
    // Create canvas container for the indicator display
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'axis-indicator-canvas-container';
    canvasContainer.style.width = `${size}px`;
    canvasContainer.style.height = `${size}px`;
    canvasContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    canvasContainer.style.display = axisIndicatorCollapsed ? 'none' : 'block';
    
    // Add both elements to the container
    axisContainer.appendChild(header);
    axisContainer.appendChild(canvasContainer);
    
    // Add the container to the viewport
    viewportContainer.appendChild(axisContainer);
    
    // Function to update container height based on collapsed state
    function updateContainerHeight() {
        if (axisIndicatorCollapsed) {
            axisContainer.style.height = `${header.offsetHeight}px`;
        } else {
            axisContainer.style.height = 'auto';
        }
    }
    
    // Call once to set initial height
    updateContainerHeight();
    
    // Store scale factor for axis objects
    let axisScale = 1.0;
    const scaleMin = 0.5;
    const scaleMax = 3.0;
    
    // Add zoom functionality when hovering over the indicator
    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Determine zoom direction
        const delta = Math.sign(-e.deltaY);
        
        // Adjust scale factor
        axisScale += delta * 0.15;
        axisScale = Math.max(scaleMin, Math.min(scaleMax, axisScale));
        
        // Apply scale to all axis objects
        xAxis.scale.set(axisScale, axisScale, axisScale);
        yAxis.scale.set(axisScale, axisScale, axisScale);
        zAxis.scale.set(axisScale, axisScale, axisScale);
        centerSphere.scale.set(axisScale, axisScale, axisScale);
        
        console.log(`Axis scale: ${axisScale.toFixed(2)}`);
    });
    
    // Make the header draggable (moves the entire container)
    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(axisContainer.style.left);
        startTop = parseInt(axisContainer.style.top);
        header.style.cursor = 'grabbing';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const newLeft = startLeft + dx;
        const newTop = startTop + dy;
        
        // Get current viewport container dimensions
        const containerRect = viewportContainer.getBoundingClientRect();
        const maxLeft = containerRect.width - axisContainer.offsetWidth;
        const maxTop = containerRect.height - axisContainer.offsetHeight;
        
        const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
        const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
        
        axisContainer.style.left = `${constrainedLeft}px`;
        axisContainer.style.top = `${constrainedTop}px`;
        
        // Update stored position
        axisIndicatorPosition.x = constrainedLeft;
        axisIndicatorPosition.y = constrainedTop;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';
        }
    });
    
    // Create a separate renderer for the axis scene
    const axisRenderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true 
    });
    axisRenderer.setSize(size, size);
    axisRenderer.setClearColor(0x000000, 0);
    
    // Add the renderer to the container
    canvasContainer.appendChild(axisRenderer.domElement);
    
    // Store renderer reference 
    axisScene.renderer = axisRenderer;
    
    // Add a render callback to draw the axis indicator
    const originalRender = renderer.render;
    renderer.render = function(scene, camera) {
        // Call original render with main scene and camera
        originalRender.call(this, scene, camera);
        
        // Skip rendering if collapsed or container was removed
        const canvasContainer = document.getElementById('axis-indicator-canvas-container');
        if (axisIndicatorCollapsed || !canvasContainer) {
            return;
        }
        
        // Update rotation to match main camera
        if (state.camera) {
            const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.quaternion);
            const distance = axisCamera.position.length();
            axisCamera.position.copy(cameraDir).negate().multiplyScalar(distance);
            axisCamera.lookAt(0, 0, 0);
        }
        
        // Apply semi-transparency when overlaying content
        const applyTransparency = (obj, factor) => {
            if (obj.material) {
                obj.material.opacity = obj.material.opacity * factor;
            }
            if (obj.children) {
                obj.children.forEach(child => applyTransparency(child, factor));
            }
        };
        
        // Apply transparency to all objects in axis scene
        axisScene.children.forEach(obj => applyTransparency(obj, 0.7));
        
        // Render axis scene with its own renderer
        axisRenderer.render(axisScene, axisCamera);
        
        // Reset transparency after rendering
        axisScene.children.forEach(obj => {
            const resetOpacity = (o) => {
                if (o.material && o.material.opacity) {
                    o.material.opacity = o.material.opacity / 0.7;
                }
                if (o.children) {
                    o.children.forEach(child => resetOpacity(child));
                }
            };
            resetOpacity(obj);
        });
    };
    
    console.log('Modern axis indicator created with draggable header');
    
    // Reset transparency after rendering
    axisScene.children.forEach(obj => {
        const resetOpacity = (o) => {
            if (o.material && o.material.opacity) {
                o.material.opacity = o.material.opacity / 0.7;
            }
            if (o.children) {
                o.children.forEach(child => resetOpacity(child));
            }
        };
        resetOpacity(obj);
    });
    
    // Create axis indicator mode event listener
    document.addEventListener('axisIndicatorModeChange', function(e) {
        const mode = e.detail.mode;
        console.log('Axis indicator mode changed to:', mode);
        
        // Toggle between windowed, embedded, and disabled modes
        if (mode === 'embedded') {
            // Hide windowed version if it exists
            const axisContainer = document.getElementById('axis-indicator-container');
            if (axisContainer) {
                axisContainer.style.display = 'none';
            }
            
            // Create embedded version
            createEmbeddedAxisIndicator(scene, camera, renderer);
        } else if (mode === 'disabled') {
            // Hide windowed version if it exists
            const axisContainer = document.getElementById('axis-indicator-container');
            if (axisContainer) {
                axisContainer.style.display = 'none';
            }
            
            // Remove embedded version if it exists
            removeEmbeddedAxisIndicator();
        } else {
            // Show windowed version if it exists
            const axisContainer = document.getElementById('axis-indicator-container');
            if (axisContainer) {
                axisContainer.style.display = 'block';
            }
            
            // Remove embedded version if it exists
            removeEmbeddedAxisIndicator();
        }
    });
    
    // Function to create embedded axis indicator
    function createEmbeddedAxisIndicator(scene, camera, renderer) {
        // Check if we already have an embedded axis indicator
        const state = getState();
        if (state.embeddedAxisIndicator) {
            return;
        }
        
        console.log('Creating embedded axis indicator');
        
        // Create a new scene for the embedded axis indicator
        const embeddedAxisScene = new THREE.Scene();
        embeddedAxisScene.background = null; // Transparent background
        
        // Create a camera for the embedded axis indicator with wide FOV
        const embeddedAxisCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        embeddedAxisCamera.position.set(0, 0, 15); // Scaled back for better visibility
        embeddedAxisCamera.lookAt(0, 0, 0);
        
        // Create appropriately sized axes for background
        const axisScale = 6.0; // Reduced scale by 25% (from 8.0 to 6.0)
        
        // Create a modified axis creation function with thicker lines and smaller cones
        const createEmbeddedAxis = (dir, color) => {
            const group = new THREE.Group();
            
            // Create line for positive axis direction - MUCH THICKER
            const lineGeometry = new THREE.BufferGeometry();
            const endPoint = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(0.92); // Longer line
            lineGeometry.setAttribute('position', 
                new THREE.Float32BufferAttribute([0, 0, 0, endPoint.x, endPoint.y, endPoint.z], 3));
            
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: color,
                linewidth: 20, // Much thicker line (increased from 12)
                depthTest: false,
                transparent: true,
                opacity: 1.0
            });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            group.add(line);
            
            // Create negative axis direction with thicker dashed line
            const negLineGeometry = new THREE.BufferGeometry();
            const negDir = new THREE.Vector3(-dir.x, -dir.y, -dir.z).multiplyScalar(0.92); // Longer line
            negLineGeometry.setAttribute('position', 
                new THREE.Float32BufferAttribute([0, 0, 0, negDir.x, negDir.y, negDir.z], 3));
            
            const dashedLineMaterial = new THREE.LineDashedMaterial({
                color: color,
                linewidth: 25, // Much thicker dashed line (increased from 15)
                scale: 1,
                dashSize: 0.2, // Larger dashes
                gapSize: 0.05, // Smaller gaps
                depthTest: false,
                transparent: true,
                opacity: 0.9
            });
            
            const dashedLine = new THREE.Line(negLineGeometry, dashedLineMaterial);
            dashedLine.computeLineDistances(); // Required for dashed lines
            group.add(dashedLine);
            
            // Create very small arrow head (cone)
            const arrowGeometry = new THREE.CylinderGeometry(0, 0.05, 0.15, 6, 1); // Tiny cone
            const arrowMaterial = new THREE.MeshBasicMaterial({ 
                color: color,
                transparent: true,
                opacity: 1.0,
                depthTest: false
            });
            
            const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
            
            // Position at the end of the line
            arrow.position.copy(dir);
            
            // Rotate arrow to point in the right direction
            if (dir.x === 1) {
                arrow.rotation.z = -Math.PI / 2;
            } else if (dir.y === 1) {
                // Default orientation works for Y
            } else if (dir.z === 1) {
                arrow.rotation.x = Math.PI / 2;
            }
            
            group.add(arrow);
            
            // Create larger and more visible text label
            const text = dir.x === 1 ? 'X' : dir.y === 1 ? 'Y' : 'Z';
            const canvas = document.createElement('canvas');
            canvas.width = 256; // Larger canvas for clearer text
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw text with a stronger glow effect
            ctx.font = 'bold 96px Arial'; // Larger font
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add a stronger glow effect
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = color;
            ctx.fillText(text, canvas.width/2, canvas.height/2);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            // Position text closer to the arrow tip
            sprite.position.copy(dir).multiplyScalar(1.2); // Reduced from 1.6 to bring labels closer
            sprite.scale.set(0.6, 0.6, 0.6); // Reduced label size by 25% (from 0.8 to 0.6)
            
            group.add(sprite);
            
            return group;
        };
        
        // Create the three axes using our embedded axis creation function
        const embeddedXAxis = createEmbeddedAxis(new THREE.Vector3(1, 0, 0), '#ff4136'); // Red
        const embeddedYAxis = createEmbeddedAxis(new THREE.Vector3(0, 1, 0), '#2ecc40'); // Green
        const embeddedZAxis = createEmbeddedAxis(new THREE.Vector3(0, 0, 1), '#0074d9'); // Blue
        
        // Scale up the axes for visibility while keeping proportions reasonable
        embeddedXAxis.scale.set(axisScale, axisScale, axisScale);
        embeddedYAxis.scale.set(axisScale, axisScale, axisScale);
        embeddedZAxis.scale.set(axisScale, axisScale, axisScale);
        
        // Add axes to the embedded scene
        embeddedAxisScene.add(embeddedXAxis);
        embeddedAxisScene.add(embeddedYAxis);
        embeddedAxisScene.add(embeddedZAxis);
        
        // Create a smaller center reference point
        const embeddedCenterGeometry = new THREE.SphereGeometry(0.05 * axisScale, 16, 16);
        const embeddedCenterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });
        const embeddedCenterSphere = new THREE.Mesh(embeddedCenterGeometry, embeddedCenterMaterial);
        embeddedAxisScene.add(embeddedCenterSphere);
        
        // Store references
        state.embeddedAxisIndicator = {
            scene: embeddedAxisScene,
            camera: embeddedAxisCamera,
            xAxis: embeddedXAxis,
            yAxis: embeddedYAxis,
            zAxis: embeddedZAxis,
            centerSphere: embeddedCenterSphere,
            scale: axisScale,
            active: true // Mark as active
        };
        
        // Create a renderer for the embedded axis indicator
        const originalRender = renderer.render;
        
        // Replace the renderer.render method
        renderer.render = function(mainScene, mainCamera) {
            // Check if embedded axis indicator is active
            if (state.embeddedAxisIndicator && state.embeddedAxisIndicator.active) {
                // First clear the renderer with black background
                const oldClearColor = renderer.getClearColor(new THREE.Color());
                const oldClearAlpha = renderer.getClearAlpha();
                
                // Save auto clear settings
                const oldAutoClear = renderer.autoClear;
                const oldAutoClearColor = renderer.autoClearColor;
                const oldAutoClearDepth = renderer.autoClearDepth;
                const oldAutoClearStencil = renderer.autoClearStencil;
                
                // Clear with black background
                renderer.setClearColor(0x000000, 1);
                renderer.clear(); // Clear everything
                
                // Update embedded camera to match main camera rotation
                if (mainCamera) {
                    const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion);
                    const distance = embeddedAxisCamera.position.length();
                    embeddedAxisCamera.position.copy(cameraDir).negate().multiplyScalar(distance);
                    embeddedAxisCamera.lookAt(0, 0, 0);
                    
                    // Match aspect ratio
                    embeddedAxisCamera.aspect = mainCamera.aspect;
                    embeddedAxisCamera.updateProjectionMatrix();
                }
                
                // Adjust opacity for background effect
                const applyBackgroundOpacity = (obj) => {
                    if (obj.material) {
                        obj.material.userData.originalOpacity = obj.material.userData.originalOpacity || obj.material.opacity;
                        obj.material.opacity = obj.material.userData.originalOpacity * 0.3; // More visible
                    }
                    if (obj.children) {
                        obj.children.forEach(child => applyBackgroundOpacity(child));
                    }
                };
                
                // Apply transparency to all axes
                embeddedAxisScene.children.forEach(obj => applyBackgroundOpacity(obj));
                
                // Special settings for background rendering
                renderer.autoClear = false;
                renderer.autoClearDepth = true;
                renderer.autoClearColor = false;
                renderer.autoClearStencil = false;
                
                // Render the axis scene first (as background)
                originalRender.call(this, embeddedAxisScene, embeddedAxisCamera);
                
                // Restore original material opacity
                const restoreOpacity = (obj) => {
                    if (obj.material && obj.material.userData.originalOpacity) {
                        obj.material.opacity = obj.material.userData.originalOpacity;
                    }
                    if (obj.children) {
                        obj.children.forEach(child => restoreOpacity(child));
                    }
                };
                
                embeddedAxisScene.children.forEach(obj => restoreOpacity(obj));
                
                // Reset settings for main scene render
                renderer.autoClear = false; // Don't clear again
                renderer.setClearColor(oldClearColor, oldClearAlpha);
                
                // Now render the main scene on top
                originalRender.call(this, mainScene, mainCamera);
                
                // Restore original settings
                renderer.autoClear = oldAutoClear;
                renderer.autoClearColor = oldAutoClearColor;
                renderer.autoClearDepth = oldAutoClearDepth;
                renderer.autoClearStencil = oldAutoClearStencil;
            } else {
                // If embedded mode not active, just render normally
                originalRender.call(this, mainScene, mainCamera);
            }
        };
        
        console.log('Full-screen embedded axis indicator created successfully');
    }
    
    // Function to remove embedded axis indicator
    function removeEmbeddedAxisIndicator() {
        const state = getState();
        
        if (state.embeddedAxisIndicator) {
            console.log('Removing embedded axis indicator');
            
            // Mark as inactive first (easier than restoring the render function)
            state.embeddedAxisIndicator.active = false;
            
            // Clean up objects
            state.embeddedAxisIndicator.scene = null;
            state.embeddedAxisIndicator.camera = null;
            state.embeddedAxisIndicator = null;
        }
    }
    
    // Check for saved settings to initialize correct mode
    const savedSettings = localStorage.getItem('assetDebuggerSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            if (settings.axisIndicator && settings.axisIndicator.type) {
                const mode = settings.axisIndicator.type;
                
                // Handle saved setting
                if (mode === 'disabled') {
                    // Hide the axis indicator
                    const axisContainer = document.getElementById('axis-indicator-container');
                    if (axisContainer) {
                        axisContainer.style.display = 'none';
                    }
                } else if (mode === 'embedded') {
                    // Create embedded indicator on initialization and make sure the windowed one is hidden
                    const axisContainer = document.getElementById('axis-indicator-container');
                    if (axisContainer) {
                        axisContainer.style.display = 'none';
                    }
                    
                    // Force the creation of the embedded indicator
                    setTimeout(() => {
                        createEmbeddedAxisIndicator(scene, camera, renderer);
                        console.log('Embedded axis indicator created from saved settings');
                    }, 100);
                }
                // Default for 'windowed' is to show the windowed indicator (no action needed)
            } else {
                // Default to disabled if no setting is found
                const axisContainer = document.getElementById('axis-indicator-container');
                if (axisContainer) {
                    axisContainer.style.display = 'none';
                }
            }
        } catch (e) {
            console.error('Error loading saved axis indicator settings:', e);
            // Default to disabled on error
            const axisContainer = document.getElementById('axis-indicator-container');
            if (axisContainer) {
                axisContainer.style.display = 'none';
            }
        }
    } else {
        // No saved settings - default to disabled
        const axisContainer = document.getElementById('axis-indicator-container');
        if (axisContainer) {
            axisContainer.style.display = 'none';
        }
    }
    
    // Draw a debug log to confirm axis indicator creation complete
    console.log('Modern axis indicator setup complete', {
        windowed: savedSettings && JSON.parse(savedSettings)?.axisIndicator?.type === 'windowed',
        embedded: savedSettings && JSON.parse(savedSettings)?.axisIndicator?.type === 'embedded',
        disabled: !savedSettings || !JSON.parse(savedSettings)?.axisIndicator?.type || 
                  JSON.parse(savedSettings)?.axisIndicator?.type === 'disabled'
    });
}

// Export functions
export { analyzeGltfModel, updateRigAnimation, updateAllBoneMatrices, updateRigPanel };

// Global event listener for axis indicator mode changes
document.addEventListener('axisIndicatorModeChange', function(e) {
    const mode = e.detail.mode;
    console.log('Axis indicator mode change event received:', mode);
    
    // Get current scene, camera, and renderer from state
    const state = getState();
    const scene = state.scene;
    const camera = state.camera;
    const renderer = state.renderer;
    
    if (!scene || !camera || !renderer) {
        console.error('Cannot change axis indicator mode: scene, camera or renderer not available', {
            scene: !!scene,
            camera: !!camera,
            renderer: !!renderer,
        });
        return;
    }
    
    // Apply the mode change
    if (mode === 'windowed') {
        // Hide embedded version
        if (state.embeddedAxisIndicator) {
            state.embeddedAxisIndicator.active = false;
        }
        
        // Show windowed version if it exists (or create it)
        if (!state.axisScene) {
            createAxisIndicator(scene, camera, renderer);
        }
        
        // Show the windowed version
        const axisContainer = document.getElementById('axis-indicator-container');
        if (axisContainer) {
            axisContainer.style.display = 'block';
        }
    } else if (mode === 'embedded') {
        // Hide windowed version
        const axisContainer = document.getElementById('axis-indicator-container');
        if (axisContainer) {
            axisContainer.style.display = 'none';
        }
        
        // Check if we need to create the embedded indicator
        if (!state.embeddedAxisIndicator) {
            createEmbeddedAxisIndicator(scene, camera, renderer);
        } else {
            // Just reactivate it
            state.embeddedAxisIndicator.active = true;
        }
    } else if (mode === 'disabled') {
        // Hide windowed version
        const axisContainer = document.getElementById('axis-indicator-container');
        if (axisContainer) {
            axisContainer.style.display = 'none';
        }
        
        // Deactivate embedded version
        if (state.embeddedAxisIndicator) {
            state.embeddedAxisIndicator.active = false;
        }
    }
});