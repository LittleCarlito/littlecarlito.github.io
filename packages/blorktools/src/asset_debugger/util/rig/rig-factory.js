/**
 * Asset Debugger - Rig Factory
 * 
 * This module provides rig creation and initialization functionality.
 * Code moved from rig-heading.js to create a separate factory module.
 */
import * as THREE from 'three';
import { getState } from '../state/scene-state';
import { getIsDragging, setupMouseListeners } from './rig-mouse-handler';
import { 
    clearRigVisualization,
    rigDetails, 
    updateRigDetails,
    rigOptions,
    updateLabelPosition
 } from './rig-controller.js'
 import { 
    bones,
    boneJointMaterial,
    boneMaterial,
    boneSideMaterial,
    boneVisualsGroup, 
    findFarthestBone,
    setBoneMaterial,
    setBoneSideMaterial,
    setBoneJointMaterial,
    resetBoneVisualGroup,
    resetBones
  } from './bone-kinematics.js';
import { createAxisIndicator } from '../../axis-indicator/axis-indicator';
import { createLabels } from './rig-label-factory';
import { applyJointConstraints } from './rig-constraint-manager';
import { parseJointConstraints } from '../data/glb-classifier';
import { addControlHandleToObject, primaryRigHandle } from './rig-handle-factory';

/**
 * Create a rig system with visualization, controls and interactions
 * @param {Object} model - The model to create a rig for
 * @param {Object} scene - The Three.js scene
 * @returns {Object} The created rig
 */
export function createRig(model, scene) {
    console.log('Creating rig...');
    
    // Clear any existing rig visualization
    clearRigVisualization(scene);
    resetBones();
    
    // Initialize rigDetails.joints if needed
    if (!rigDetails) {
        updateRigDetails({ bones: [], rigs: [], roots: [], controls: [], joints: [], constraints: [] });
    } else if (!rigDetails.joints) {
        rigDetails.joints = [];
    }
    
    // Add constraints array if not present
    if (!rigDetails.constraints) {
        rigDetails.constraints = [];
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
                
                // Look for constraint data
                const constraints = parseJointConstraints(node);
                if (constraints) {
                    console.log(`Found constraints for bone ${node.name}:`, constraints);
                    // Apply constraints to the bone
                    applyJointConstraints(node, constraints);
                    
                    // Store constraint information
                    if (rigDetails && rigDetails.constraints) {
                        rigDetails.constraints.push({
                            boneName: node.name,
                            type: constraints.type,
                            data: constraints
                        });
                    }
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
                
                // Look for constraint data
                const constraints = parseJointConstraints(node);
                if (constraints) {
                    console.log(`Found constraints for bone ${node.name}:`, constraints);
                    // Apply constraints to the bone
                    applyJointConstraints(node, constraints);
                    
                    // Store constraint information
                    if (rigDetails && rigDetails.constraints) {
                        rigDetails.constraints.push({
                            boneName: node.name,
                            type: constraints.type,
                            data: constraints
                        });
                    }
                }
                
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
    setBoneMaterial(new THREE.MeshBasicMaterial({
        color: rigOptions.primaryColor,
        side: THREE.DoubleSide,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Increased opacity for better visibility
    }));
    
    setBoneSideMaterial(new THREE.MeshBasicMaterial({
        color: rigOptions.secondaryColor,
        side: THREE.DoubleSide,
        wireframe: rigOptions.wireframe,
        transparent: true,
        opacity: 0.8  // Increased opacity for better visibility
    }));
    
    // Joint material (now separate from primary/secondary colors)
    setBoneJointMaterial(new THREE.MeshBasicMaterial({
        color: rigOptions.jointColor,
        side: THREE.DoubleSide,
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
        addControlHandleToObject(furthestBone, scene, modelScale);
    }
    
    // Create labels for joints and bones
    createLabels(scene);
    
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
        
        if (primaryRigHandle && primaryRigHandle.material) {
            primaryRigHandle.renderOrder = 1030;
            primaryRigHandle.material.depthTest = false;
            primaryRigHandle.material.needsUpdate = true;
        }
    }
    
    // At the end of createRig, log summary of constraints found
    if (rigDetails && rigDetails.constraints && rigDetails.constraints.length > 0) {
        console.log('=== JOINT CONSTRAINT SUMMARY ===');
        console.log(`Found ${rigDetails.constraints.length} joint constraints:`);
        
        // Group by constraint type
        const constraintsByType = {};
        rigDetails.constraints.forEach(constraint => {
            if (!constraintsByType[constraint.type]) {
                constraintsByType[constraint.type] = [];
            }
            constraintsByType[constraint.type].push(constraint.boneName);
        });
        
        // Log summary by type
        Object.keys(constraintsByType).forEach(type => {
            console.log(`  - ${type}: ${constraintsByType[type].length} joints`);
            constraintsByType[type].forEach(boneName => {
                console.log(`      - ${boneName}`);
            });
        });
        
        console.log('================================');
    } else {
        console.log('No joint constraints found in model');
    }
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
    console.log(`Creating ${jointType} joint`);
    
    // Create joint based on joint type
    let geometry, material, joint, jointColor, opacity;
    
    // Set default radius if not provided
    radius = radius || 1.0;
    
    // Prepare for a top-of-bone or bottom-of-bone joint
    switch (jointType) {
        case 'top':
            // For top of bone (connects to child bone)
            jointColor = options.jointColor || rigOptions.jointColor;
            geometry = new THREE.SphereGeometry(radius, 16, 16);
            opacity = 0.8;
            break;
        case 'bottom':
            // For bottom of bone (connects to parent bone)
            jointColor = options.jointColor || rigOptions.jointColor;
            geometry = new THREE.SphereGeometry(radius, 16, 16);
            opacity = 0.8;
            break;
        case 'root':
            // Root bone puck
            jointColor = 0xFF0000; // Red for root
            geometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.2, radius * 0.5, 32);
            opacity = 0.9;
            break;
        default:
            // Default to a sphere
            jointColor = options.jointColor || rigOptions.jointColor;
            geometry = new THREE.SphereGeometry(radius, 16, 16);
            opacity = 0.8;
    }
    
    // Create the material - make sure it matches our bone material settings
    material = new THREE.MeshBasicMaterial({
        color: jointColor,
        side: THREE.DoubleSide,
        wireframe: options.wireframe || rigOptions.wireframe,
        transparent: true,
        opacity: opacity
    });
    
    // Create the mesh
    joint = new THREE.Mesh(geometry, material);
    joint.userData.bonePart = 'cap';
    joint.userData.jointType = jointType;
    
    // For top/bottom joints, add bone reference
    if (boneData) {
        if (jointType === 'top') {
            joint.userData.childBone = boneData.childBone;
        } else if (jointType === 'bottom') {
            joint.userData.parentBone = boneData.parentBone;
        } else if (jointType === 'root') {
            joint.userData.rootBone = boneData.parentBone;
        }
    }
    
    return joint;
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
