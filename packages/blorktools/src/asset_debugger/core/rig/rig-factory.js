/**
 * Asset Debugger - Rig Factory
 * 
 * This module provides rig creation and initialization functionality.
 * Code moved from rig-panel.js to create a separate factory module.
 */
import * as THREE from 'three';
import { getState } from '../state.js';
import { createAxisIndicator } from '../../ui/axis-indicator.js';
import { getIsDragging, setupMouseListeners } from '../drag-util.js';
import { 
    clearRigVisualization,
    rigDetails, 
    updateRigDetails,
    rigOptions,
    clearJointLabels,
    updateLabelPosition,
    setLabelGroup,
    hideRigLabels,
    labelGroup
 } from './rig-manager.js'
 import { 
    bones,
    boneJointMaterial,
    boneMaterial,
    boneSideMaterial,
    boneVisualsGroup, 
    furthestBoneHandle,
    findFarthestBone,
    setFurthestBoneHandle,
    setBoneMaterial,
    setBoneSideMaterial,
    setBoneJointMaterial,
    resetBoneVisualGroup,
    resetBones
  } from '../bone-util.js';



/**
 * Create joint labels for all joints in the scene
 * @param {Object} scene - The Three.js scene
 */
export function createJointLabels(scene) {
    console.log('Creating joint labels...');
    
    // Remove any existing labels first
    clearJointLabels(scene);
    
    // Create a group to hold all labels
    setLabelGroup("JointLabels", scene);
    
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
    return scene.getObjectByName("JointLabels");
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
    
    // Set initial visibility - explicitly check options
    sprite.visible = rigOptions.showJointLabels;
    if (!sprite.visible) {
        console.log(`Label for ${text} is initially hidden`);
    }
    
    // Set up the update function
    sprite.userData.updatePosition = () => {
        updateLabelPosition(sprite, joint);
    };
    
    // Make sure the sprite renders on top
    sprite.renderOrder = 1000;
    
    return sprite;
}

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
 * Create a bone joint with consistent styling and properties
 * @param {String} jointType - Type of joint ('regular', 'root')
 * @param {Object} boneData - Object containing bone references
 * @param {Number} radius - Radius size for the joint
 * @param {Object} options - Additional options for joint customization
 * @returns {Object} - The created joint mesh
 */
function createBoneJoint(jointType, boneData, radius, options = {}) {
    // Default options
    const defaultOptions = {
        position: new THREE.Vector3(0, 0, 0),
        renderOrder: 10,
        opacity: 0.9,
        color: rigOptions.jointColor,
        wireframe: rigOptions.wireframe,
        boneName: '',
        isTop: false  // Whether this is the top or bottom joint of a bone
    };
    
    // Merge with provided options
    const jointOptions = { ...defaultOptions, ...options };
    
    // Create joint geometry based on type
    let jointMesh;
    
    if (jointType === 'root') {
        // Root joints use flat puck geometry (cylinder)
        const puckGeometry = new THREE.CylinderGeometry(
            radius * 2.2,             // Wider for better visibility
            radius * 2.2,
            radius * 0.2,             // Short height for flatness
            32                        // More segments for smoother appearance
        );
        jointMesh = new THREE.Mesh(puckGeometry, boneJointMaterial.clone());
        jointOptions.renderOrder = 15; // Higher render order for root pucks
        
        console.log(`Creating ROOT PUCK joint${jointOptions.boneName ? ' for ' + jointOptions.boneName : ''}`);
    } else {
        // Regular joints use spheres
        const sphereGeometry = new THREE.SphereGeometry(radius * 1.2, 8, 8);
        jointMesh = new THREE.Mesh(sphereGeometry, boneJointMaterial.clone());
        
        console.log(`Creating regular joint${jointOptions.boneName ? ' for ' + jointOptions.boneName : ''}`);
    }
    
    // Set position
    jointMesh.position.copy(jointOptions.position);
    
    // Set common properties
    jointMesh.userData.bonePart = 'cap';
    jointMesh.userData.isJoint = true;
    jointMesh.userData.isRootJoint = (jointType === 'root');
    
    // Set bone name for label reference if provided
    if (jointOptions.boneName) {
        jointMesh.userData.boneName = jointOptions.boneName;
    } else if (boneData) {
        // Set appropriate bone reference based on top/bottom
        if (jointOptions.isTop && boneData.childBone) {
            jointMesh.userData.boneName = boneData.childBone.name;
        } else if (!jointOptions.isTop && boneData.parentBone) {
            jointMesh.userData.boneName = boneData.parentBone.name;
        }
    }
    
    // Configure material settings
    jointMesh.material.wireframe = jointOptions.wireframe;
    jointMesh.material.transparent = true;
    jointMesh.material.opacity = jointOptions.opacity;
    jointMesh.material.color.setHex(jointOptions.color);
    
    // Set render order to ensure joints render on top of bones
    jointMesh.renderOrder = jointOptions.renderOrder;
    
    return jointMesh;
}

/**
 * Create a bone mesh with joints
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
    
    // Create top joint
    const jointType = isRootBone ? 'root' : 'regular';
    
    // Create top joint using the new consolidated function
    const topJoint = createBoneJoint(
        jointType,
        parent.userData,
        radiusTop,
        {
            position: new THREE.Vector3(0, height, 0),
            isTop: true
        }
    );
    parent.add(topJoint);
    
    // Create bottom joint using the new consolidated function
    const bottomJoint = createBoneJoint(
        jointType,
        parent.userData,
        radiusBottom,
        {
            position: new THREE.Vector3(0, 0, 0),
            isTop: false
        }
    );
    parent.add(bottomJoint);
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
                
                // Update the children
                const children = boneGroup.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i].userData.bonePart === 'side') {
                        children[i].scale.y = distance / children[i].geometry.parameters.height;
                    } else if (children[i].userData.bonePart === 'cap' && children[i].position.y > 0) {
                        children[i].position.y = distance;
                    }
                }
            }
        }
    };
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
        color: rigOptions.normalColor, // Use color from rigOptions
        transparent: true,
        opacity: 0.7,
        wireframe: false
    });
    // Set the furthest bone handle
    setFurthestBoneHandle(new THREE.Mesh(geometry, material), "FurthestBoneHandle", scene, bone);
    console.log('Added control handle to furthest bone:', bone.name);
}

/**
 * Create a rig system with visualization, controls and interactions
 * @param {Object} model - The model to create a rig for
 * @param {Object} scene - The Three.js scene
 * @returns {Object} The created rig
 */
function createRig(model, scene) {
    console.log('Creating rig...');
    
    // Clear any existing rig visualization
    clearRigVisualization(scene);
    resetBones();
    
    // Initialize rigDetails.joints if needed
    if (!rigDetails) {
        updateRigDetails({ bones: [], rigs: [], roots: [], controls: [], joints: [] });
    } else if (!rigDetails.joints) {
        rigDetails.joints = [];
    }
    
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
    setBoneMaterial(new THREE.MeshPhongMaterial({
        color: rigOptions.primaryColor,
        emissive: 0x072534,
        side: THREE.DoubleSide,
        flatShading: true,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Increased opacity for better visibility
    }));
    
    setBoneSideMaterial( new THREE.MeshPhongMaterial({
        color: rigOptions.secondaryColor,
        emissive: 0x072534,
        side: THREE.DoubleSide,
        flatShading: true,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Increased opacity for better visibility
    }));
    
    // Joint material (now separate from primary/secondary colors)
    setBoneJointMaterial(new THREE.MeshPhongMaterial({
        color: rigOptions.jointColor,
        emissive: 0x072534,
        side: THREE.DoubleSide,
        flatShading: true,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Slightly more opaque for better visibility
    }));
    
    // Create a group to hold all bone visualizations
    resetBoneVisualGroup(scene);
    
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
    
    // Create visual bones between parent-child bone pairs
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
                createBoneMesh(boneGroup, boneRadius, boneRadius, distance, boneJointMaterial, boneMaterial, boneSideMaterial);
                
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
        
        // Use the new createBoneJoint function
        const rootPuckSize = boneRadius * 2.5;
        const rootPuck = createBoneJoint('root', 
            { rootBone: rootBone }, 
            rootPuckSize, 
            {
                boneName: rootBone.name,
                renderOrder: 25 // Higher than normal joints (10-15) but lower than handle (30)
            }
        );
        
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
    
    // Always create labels for all joints
    console.log('Setting up joint labels');
    createJointLabels(scene);
    
    // Check if joint labels should be visible based on option
    if (!rigOptions.showJointLabels) {
        hideRigLabels();
    }
    
    // Set up mouse event listeners for hover effect
    setupMouseListeners(scene);
    
    console.log('Rig visualization created with', bones.length, 'bones');
    
    // Explicitly check if ForceZ is enabled and apply it
    // This ensures it gets applied even during initialization to avoid race conditions
    if (rigOptions.forceZ && boneVisualsGroup) {
        console.log('Force Z is enabled - applying immediately during rig creation');
        
        // Apply ForceZ settings directly to the rig (similar to updateRigVisualization)
        boneVisualsGroup.renderOrder = 1000;
        
        if (boneMaterial) {
            boneMaterial.depthTest = false;
            boneMaterial.needsUpdate = true;
        }
        
        if (boneSideMaterial) {
            boneSideMaterial.depthTest = false;
            boneSideMaterial.needsUpdate = true;
        }
        
        // Set renderOrder and disable depth test for all meshes
        boneVisualsGroup.traverse(object => {
            if (object.isMesh) {
                if (object.userData.bonePart === 'cap') {
                    object.renderOrder = 1020;
                } else if (object.userData.bonePart === 'side') {
                    object.renderOrder = 1010;
                } else {
                    object.renderOrder = 1000;
                }
                
                if (object.material) {
                    object.material.depthTest = false;
                    object.material.needsUpdate = true;
                }
            }
        });
        
        if (furthestBoneHandle && furthestBoneHandle.material) {
            furthestBoneHandle.renderOrder = 1030;
            furthestBoneHandle.material.depthTest = false;
            furthestBoneHandle.material.needsUpdate = true;
        }
    }
}

// Export functions
export {
    analyzeGltfModel,
    deduplicateItems,
    createRig,
    createBoneMesh,
    createBoneUpdateFunction,
    addControlHandleToFurthestBone,
    createBoneJoint
};
