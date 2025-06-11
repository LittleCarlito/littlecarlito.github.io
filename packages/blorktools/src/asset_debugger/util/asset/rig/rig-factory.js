/**
 * Asset Debugger - Rig Factory
 * 
 * This module provides rig creation and initialization functionality.
 * Code moved from rig-panel.js to create a separate factory module.
 */
import * as THREE from 'three';
import { getState } from '../../state/scene-state';
import { getIsDragging, setupMouseListeners } from './rig-mouse-handler';
import { 
    clearRigVisualization,
    rigDetails, 
    updateRigDetails,
    rigOptions,
    clearJointLabels,
    clearBoneLabels,
    updateLabelPosition,
    setJointLabelsGroup,
    setBoneLabelsGroup,
    hideJointLabels,
    hideBoneLabels,
    getJointLabelGroup,
    getBoneLabelGroup
 } from './rig-controller.js'
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
  } from './bone-kinematics.js';
import { createAxisIndicator } from '../../../axis-indicator/axis-indicator';

/**
 * Create joint labels for all joints in the scene
 * @param {Object} scene - The Three.js scene
 */
export function createJointLabels(scene) {
    console.log('Creating joint labels...');
    
    // Remove any existing labels first
    clearJointLabels(scene);
    
    // Create a group to hold all labels
    setJointLabelsGroup("JointLabels", scene);
    
    // Keep track of the labels created
    const labelCount = {total: 0, added: 0};
    
    // Track positions where we've already created labels to prevent duplicates
    const labelPositions = [];
    const positionTolerance = 0.001; // Tolerance for considering positions as identical
    
    // Helper function to check if a position already has a label
    const hasLabelAtPosition = (position) => {
        return labelPositions.some(pos => position.distanceTo(pos) < positionTolerance);
    };
    
    // Find all bone meshes
    boneVisualsGroup.traverse((object) => {
        if (object.userData && object.userData.bonePart === 'cap') {
            labelCount.total++;
            
            // Get world position of this joint
            const worldPos = new THREE.Vector3();
            object.getWorldPosition(worldPos);
            
            // Check if we already have a label at this position
            if (hasLabelAtPosition(worldPos)) {
                console.log('Skipping duplicate joint label at position:', worldPos);
                return;
            }
            
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
                    const jointLabelGroup = getJointLabelGroup();
                    if (jointLabelGroup) {
                        jointLabelGroup.add(label);
                        labelCount.added++;
                        
                        // Record this position as having a label
                        labelPositions.push(worldPos);
                    }
                }
            }
        }
    });
    
    console.log(`Created ${labelCount.added} labels out of ${labelCount.total} joint spheres found`);
    return scene.getObjectByName("JointLabels");
}

/**
 * Create bone labels for all bone segments in the scene
 * @param {Object} scene - The Three.js scene
 */
export function createBoneLabels(scene) {
    console.log('Creating bone labels...');
    
    // Remove any existing bone labels
    clearBoneLabels(scene);
    
    // Create a group to hold all bone labels
    setBoneLabelsGroup("BoneLabels", scene);
    
    // Keep track of the labels created
    const labelCount = {total: 0, added: 0};
    
    // Track bone connections that already have labels to prevent duplicates
    const labeledBoneConnections = new Set();
    
    // Find all bone groups
    boneVisualsGroup.children.forEach((boneGroup) => {
        // Skip if not a bone group
        if (!boneGroup.userData || !boneGroup.userData.isVisualBone) {
            return;
        }
        
        labelCount.total++;
        
        // Get bone name information from the bone group
        let boneName = "";
        if (boneGroup.userData.parentBone && boneGroup.userData.childBone) {
            // Create a connection identifier (both directions to handle differently ordered pairs)
            const parentID = boneGroup.userData.parentBone.id || boneGroup.userData.parentBone.uuid;
            const childID = boneGroup.userData.childBone.id || boneGroup.userData.childBone.uuid;
            const connectionID = `${parentID}_${childID}`;
            const reverseConnectionID = `${childID}_${parentID}`;
            
            // Skip if we already created a label for this connection
            if (labeledBoneConnections.has(connectionID) || labeledBoneConnections.has(reverseConnectionID)) {
                console.log('Skipping duplicate bone label for connection:', 
                           `${boneGroup.userData.parentBone.name} → ${boneGroup.userData.childBone.name}`);
                return;
            }
            
            // Create a name that indicates the connection
            boneName = `${boneGroup.userData.parentBone.name} → ${boneGroup.userData.childBone.name}`;
            
            // Create a label for this bone
            const label = createSimpleLabel(boneName, boneGroup, scene, true); // Pass true to indicate it's a bone label
            if (label) {
                const boneLabelGroup = getBoneLabelGroup();
                if (boneLabelGroup) {
                    boneLabelGroup.add(label);
                    labelCount.added++;
                    
                    // Mark this connection as labeled
                    labeledBoneConnections.add(connectionID);
                    
                    // Calculate the midpoint between parent and child bones immediately
                    const parentPos = new THREE.Vector3();
                    const childPos = new THREE.Vector3();
                    
                    boneGroup.userData.parentBone.getWorldPosition(parentPos);
                    boneGroup.userData.childBone.getWorldPosition(childPos);
                    
                    // Calculate the middle point
                    const midPoint = new THREE.Vector3().addVectors(parentPos, childPos).multiplyScalar(0.5);
                    
                    // Position at the middle point immediately
                    label.position.copy(midPoint);
                    
                    // Position the label at the middle of the bone
                    if (label.userData.updatePosition) {
                        label.userData.updatePosition();
                    }
                }
            }
        }
    });
    
    console.log(`Created ${labelCount.added} labels out of ${labelCount.total} bone segments found`);
    return scene.getObjectByName("BoneLabels");
}

/**
 * Create a simple text label as a sprite
 * @param {string} text - Text to display
 * @param {Object} joint - Joint object to attach to
 * @param {Object} scene - Three.js scene
 * @param {boolean} isBoneLabel - Whether this is a bone label (true) or joint label (false)
 * @returns {Object} The created label sprite
 */
function createSimpleLabel(text, joint, scene, isBoneLabel = false) {
    console.log(`Creating label for ${isBoneLabel ? 'bone' : 'joint'}: ${text}`);

    // Create a canvas for the label
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 256;
    // Increase height for bone labels to accommodate multiple lines
    canvas.height = isBoneLabel ? 96 : 64;
    
    // Different styling for bone vs joint labels - ONLY VISUAL DIFFERENCES HERE
    const labelConfig = {
        bgColor: isBoneLabel ? 'rgba(30, 136, 229, 0.8)' : 'rgba(76, 175, 80, 0.8)',
        gradientStops: isBoneLabel ? 
            [{ pos: 0, color: 'rgba(40, 40, 80, 0.4)' }, { pos: 1, color: 'rgba(20, 20, 40, 0.6)' }] : 
            [{ pos: 0, color: 'rgba(30, 60, 30, 0.4)' }, { pos: 1, color: 'rgba(10, 30, 10, 0.6)' }],
        borderColor: isBoneLabel ? '#88AAFF' : '#AAFFAA',
        scrollThumbColor: isBoneLabel ? '#88AAFF' : '#AAFFAA',
        headerText: isBoneLabel ? 'BONE' : 'JOINT'
    };
    
    // Background fill
    ctx.fillStyle = labelConfig.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    labelConfig.gradientStops.forEach(stop => {
        gradient.addColorStop(stop.pos, stop.color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    ctx.strokeStyle = labelConfig.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Header line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, 18);
    
    // Header text
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#DDDDDD';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelConfig.headerText, 6, 9);
    
    // Main text
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // For bone labels, format as multiple lines if it contains an arrow
    if (isBoneLabel && text.includes('→')) {
        const parts = text.split('→');
        const parent = parts[0].trim();
        const child = parts[1].trim();
        
        // Calculate max width to check if parts need scrolling
        const parentWidth = ctx.measureText(parent).width;
        const childWidth = ctx.measureText(child).width;
        const maxWidth = canvas.width - 20; // 10px padding on each side
        
        // First line: parent
        let parentText = parent;
        if (parentWidth > maxWidth) {
            parentText = parent.length > 25 ? parent.substring(0, 22) + '...' : parent;
        }
        ctx.fillText(parentText, canvas.width / 2, 35);
        
        // Arrow line
        ctx.fillText('↓', canvas.width / 2, 55);
        
        // Third line: child
        let childText = child;
        if (childWidth > maxWidth) {
            childText = child.length > 25 ? child.substring(0, 22) + '...' : child;
        }
        ctx.fillText(childText, canvas.width / 2, 75);
        
        // If either part was truncated, add a scroll indicator
        if (parentWidth > maxWidth || childWidth > maxWidth) {
            // Draw scroll indicator
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(10, canvas.height - 8, canvas.width - 20, 4);
            
            // Draw scrollbar thumb
            const contentWidth = Math.max(parentWidth, childWidth);
            const thumbWidth = Math.max(30, (maxWidth / contentWidth) * (canvas.width - 20));
            ctx.fillStyle = labelConfig.scrollThumbColor;
            ctx.fillRect(10, canvas.height - 8, thumbWidth, 4);
        }
    } else {
        // Regular single-line text handling (for joint labels or non-arrow bone labels)
        // Calculate text width to check if it needs scrolling
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const maxWidth = canvas.width - 20; // 10px padding on each side
        
        // If text is too long, implement scrolling behavior
        if (textWidth > maxWidth) {
            // Indicate text is scrollable with ellipsis
            const displayText = text.length > 25 ? text.substring(0, 22) + '...' : text;
            ctx.fillText(displayText, canvas.width / 2, canvas.height / 2 + 5);
            
            // Draw scroll indicator
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(10, canvas.height - 8, canvas.width - 20, 4);
            
            // Draw scrollbar thumb
            const thumbWidth = Math.max(30, (maxWidth / textWidth) * (canvas.width - 20));
            ctx.fillStyle = labelConfig.scrollThumbColor;
            ctx.fillRect(10, canvas.height - 8, thumbWidth, 4);
        } else {
            // Text fits, just display it
            ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 5);
        }
    }
    
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
    sprite.userData.isBoneLabel = isBoneLabel;
    sprite.userData.isJointLabel = !isBoneLabel;
    sprite.userData.targetJoint = joint;
    sprite.userData.labelText = text; // Store original text
    
    // Add hover handling for label headers
    sprite.userData.isInteractive = true;
    sprite.userData.isLabelHeader = true;
    sprite.userData.headerHeight = 18; // Height of the header section in pixels
    sprite.userData.canvasHeight = canvas.height;
    sprite.userData.canvasWidth = canvas.width;
    
    // Add mouse event handling to prevent propagation when over the header
    sprite.userData.onMouseMove = (event) => {
        // Check if mouse is over the header area
        if (sprite.userData.isMouseOverHeader) {
            // Prevent event propagation to stop camera controls
            event.stopPropagation();
        }
    };
    
    // This function calculates if mouse is over the header or the content area
    sprite.userData.checkHeaderHover = (mousePos) => {
        if (!mousePos) return false;
        
        // The sprite's coordinates go from -0.5 to 0.5 in both dimensions
        // So we need to convert from local sprite coordinates to canvas coordinates
        
        // Calculate the overall dimensions in world units
        const totalHeight = sprite.scale.y;
        
        // Convert mousePos.y from local coordinates (-0.5 to 0.5) to normalized height (0 to 1)
        // In THREE.js, sprite local coords have origin at center, Y+ is up
        // -0.5 is bottom, 0.5 is top, so we need to flip and shift
        const normalizedY = 0.5 - mousePos.y; // Convert to 0 at top, 1 at bottom
        
        // Now convert to canvas pixel coordinates
        const canvasY = normalizedY * canvas.height;
        
        // Check if we're in the header region (top 18px of the canvas)
        const isOverHeader = canvasY >= 0 && canvasY <= sprite.userData.headerHeight;
        
        return isOverHeader;
    };
    
    // Set initial position safely - updateLabelPosition now has defensive coding
    updateLabelPosition(sprite, joint);
    
    // FIXED SIZE FOR ALL LABELS - no dependency on underlying object geometry
    const fixedScale = 0.3;
    // Adjust height for bone labels to accommodate multiple lines
    const heightFactor = isBoneLabel ? 0.4 : 0.25;
    sprite.scale.set(fixedScale, fixedScale * heightFactor, 1);
    
    // Set initial visibility based on appropriate option
    sprite.visible = isBoneLabel ? rigOptions.showBoneLabels : rigOptions.showJointLabels;
    if (!sprite.visible) {
        console.log(`Label for ${text} is initially hidden`);
    }
    
    // Set up the update function - customize for bone labels
    sprite.userData.updatePosition = () => {
        // For bone labels, we want to position them in the middle of the bone
        if (isBoneLabel) {
            // Get the bone group which should have parent and child bone references
            const boneGroup = joint.userData && joint.userData.isVisualBone ? 
                joint : (joint.parent && joint.parent.userData && joint.parent.userData.isVisualBone ? 
                    joint.parent : null);
            
            if (boneGroup && boneGroup.userData && 
                boneGroup.userData.parentBone && boneGroup.userData.childBone) {
                
                // Get world positions of parent and child bones
                const parentPos = new THREE.Vector3();
                const childPos = new THREE.Vector3();
                
                boneGroup.userData.parentBone.getWorldPosition(parentPos);
                boneGroup.userData.childBone.getWorldPosition(childPos);
                
                // Calculate the middle point
                const midPoint = new THREE.Vector3().addVectors(parentPos, childPos).multiplyScalar(0.5);
                
                // Position exactly at the midpoint without any offset
                sprite.position.copy(midPoint);
            } else {
                // Fallback for when we can't find the proper bone references
                const worldPos = new THREE.Vector3();
                joint.getWorldPosition(worldPos);
                sprite.position.copy(worldPos);
            }
        } else {
            // For joint labels, use the standard update function
            updateLabelPosition(sprite, joint);
        }
    };
    
    // Initialize the position
    if (sprite.userData.updatePosition) {
        sprite.userData.updatePosition();
    }
    
    // Make sure the sprite renders on top
    sprite.renderOrder = isBoneLabel ? 990 : 1000; // Joint labels show on top of bone labels
    
    return sprite;
}

/**
 * Parse joint constraint data from node extras or userData
 * @param {Object} node - Bone/joint node to examine
 * @returns {Object|null} - Constraint data if found, null otherwise
 */
export function parseJointConstraints(node) {
    console.log(`Checking for constraints on joint: ${node.name}`);
    
    // Initialize constraint object
    let constraints = null;
    
    // Check for constraints in userData
    if (node.userData) {
        // Look for Blender constraint data in userData
        if (node.userData.constraints || node.userData.boneConstraints) {
            constraints = node.userData.constraints || node.userData.boneConstraints;
            console.log(`Found explicit constraints in userData for ${node.name}:`, constraints);
            return constraints;
        }
        
        // Check for limit_rotation type constraints
        if (node.userData.limitRotation || node.userData.rotationLimits) {
            constraints = {
                type: 'limitRotation',
                limits: node.userData.limitRotation || node.userData.rotationLimits
            };
            console.log(`Found rotation limits for ${node.name}:`, constraints);
            return constraints;
        }
    }
    
    // Look for GLTF extras (where custom data is often stored)
    if (node.extras) {
        if (node.extras.constraints || node.extras.jointType) {
            constraints = node.extras.constraints || { type: node.extras.jointType };
            console.log(`Found constraints in GLTF extras for ${node.name}:`, constraints);
            return constraints;
        }
    }
    
    // Infer constraints from bone properties
    // Check if bone has locked rotation axes
    if (node.rotation && node.userData.initialRotation) {
        // Look for zero initial rotations that might indicate locked axes
        const lockedAxes = [];
        const epsilon = 0.0001; // Small threshold for floating point comparison
        
        if (Math.abs(node.userData.initialRotation.x) < epsilon) lockedAxes.push('x');
        if (Math.abs(node.userData.initialRotation.y) < epsilon) lockedAxes.push('y');
        if (Math.abs(node.userData.initialRotation.z) < epsilon) lockedAxes.push('z');
        
        // If we have 2+ locked axes, this might be a hinge joint
        if (lockedAxes.length >= 2) {
            const freeAxis = ['x', 'y', 'z'].find(axis => !lockedAxes.includes(axis));
            if (freeAxis) {
                constraints = {
                    type: 'hinge',
                    axis: freeAxis
                };
                console.log(`Inferred hinge joint for ${node.name} on ${freeAxis} axis from locked rotations`);
                return constraints;
            }
        }
        
        // If all axes are locked, this might be a fixed joint
        if (lockedAxes.length === 3) {
            constraints = {
                type: 'fixed'
            };
            console.log(`Inferred fixed joint for ${node.name} from locked rotations on all axes`);
            return constraints;
        }
    }
    
    // Check naming conventions that might indicate constraint types
    const lowerName = node.name.toLowerCase();
    if (lowerName.includes('fixed') || lowerName.includes('rigid')) {
        constraints = {
            type: 'fixed'
        };
        console.log(`Inferred fixed joint for ${node.name} from naming convention`);
        return constraints;
    }
    
    if (lowerName.includes('hinge') || lowerName.includes('elbow') || lowerName.includes('knee')) {
        // Default to Y axis for hinge if not specified
        constraints = {
            type: 'hinge',
            axis: lowerName.includes('_x') ? 'x' : (lowerName.includes('_z') ? 'z' : 'y')
        };
        console.log(`Inferred hinge joint for ${node.name} from naming convention`);
        return constraints;
    }
    
    if (lowerName.includes('spring') || lowerName.includes('bounce')) {
        constraints = {
            type: 'spring',
            stiffness: 50,  // Default stiffness
            damping: 5      // Default damping
        };
        console.log(`Inferred spring joint for ${node.name} from naming convention`);
        return constraints;
    }
    
    // No constraints found
    return null;
}

/**
 * Apply joint constraints to a bone
 * @param {Object} bone - The bone to apply constraints to
 * @param {Object} constraints - Constraint data
 */
export function applyJointConstraints(bone, constraints) {
    if (!bone || !constraints) return;
    
    console.log(`Applying ${constraints.type} constraint to ${bone.name}`);
    
    // Store constraint data in bone userData for reference
    bone.userData.constraints = constraints;
    
    // Check if we should preserve the current position
    const preserveCurrentPose = constraints.preservePosition && 
                               constraints.currentPosition && 
                               constraints.currentQuaternion;
    
    // If we're preserving the current position, store it before applying constraints
    if (preserveCurrentPose) {
        console.log(`Preserving current pose for ${bone.name}`);
        bone.userData.preservedPosition = constraints.currentPosition.clone();
        bone.userData.preservedQuaternion = constraints.currentQuaternion.clone();
    }
    
    // Apply different constraint types
    switch (constraints.type) {
        case 'fixed':
            // Fixed joints don't allow rotation - enforce this by marking as locked
            bone.userData.isLocked = true;
            
            // If we're preserving the current pose, store it as the fixed position
            if (preserveCurrentPose) {
                // For fixed constraints, we want to maintain the current world position
                bone.userData.fixedPosition = constraints.currentPosition.clone();
                bone.userData.fixedQuaternion = constraints.currentQuaternion.clone();
                console.log(`Applied fixed constraint to ${bone.name} at current position - joint will be locked`);
            } else {
                console.log(`Applied fixed constraint to ${bone.name} - joint will be locked`);
            }
            break;
            
        case 'hinge':
            // Hinge joints only allow rotation on one axis
            bone.userData.hinge = {
                axis: constraints.axis || 'y',
                min: constraints.min !== undefined ? constraints.min : -Math.PI/2,
                max: constraints.max !== undefined ? constraints.max : Math.PI/2
            };
            
            // If preserving position, store current rotation as the initial state
            if (preserveCurrentPose) {
                bone.userData.initialWorldQuaternion = constraints.currentQuaternion.clone();
            }
            
            console.log(`Applied hinge constraint to ${bone.name} on ${bone.userData.hinge.axis} axis with limits [${bone.userData.hinge.min}, ${bone.userData.hinge.max}]`);
            break;
            
        case 'limitRotation':
            // Limit rotation within specific ranges for each axis
            bone.userData.rotationLimits = {
                x: constraints.limits?.x || { min: -Math.PI/4, max: Math.PI/4 },
                y: constraints.limits?.y || { min: -Math.PI/4, max: Math.PI/4 },
                z: constraints.limits?.z || { min: -Math.PI/4, max: Math.PI/4 }
            };
            
            // If preserving position, store current rotation
            if (preserveCurrentPose) {
                bone.userData.initialWorldQuaternion = constraints.currentQuaternion.clone();
            }
            
            console.log(`Applied rotation limits to ${bone.name}:`, bone.userData.rotationLimits);
            break;
            
        case 'spring':
            // Spring joints try to return to their rest position
            bone.userData.spring = {
                stiffness: constraints.stiffness || 50,
                damping: constraints.damping || 5,
                gravity: constraints.gravity || 1.0,
                // Store the current pose as the rest position without applying immediate forces
                restPosition: preserveCurrentPose 
                    ? new THREE.Vector3().copy(constraints.currentPosition) 
                    : new THREE.Vector3().copy(bone.position),
                restRotation: preserveCurrentPose
                    ? new THREE.Euler().setFromQuaternion(constraints.currentQuaternion)
                    : new THREE.Euler(
                        bone.rotation.x,
                        bone.rotation.y,
                        bone.rotation.z,
                        bone.rotation.order
                    ),
                // Add velocity tracking for proper spring physics
                velocity: new THREE.Vector3(0, 0, 0),
                lastPosition: null, // Will be set during first update
                lastTime: Date.now()
            };
            console.log(`Applied spring constraint to ${bone.name} with stiffness ${bone.userData.spring.stiffness} - rest pose preserved`);
            break;
            
        case 'none':
        default:
            // No constraints (default) - unrestricted rotation
            // No need to do anything special here, allow free movement
            break;
    }
    
    // Add a custom update function to enforce constraints during animation
    const originalUpdateMatrix = bone.updateMatrix;
    bone.updateMatrix = function() {
        // Apply constraints to rotation before updating matrix
        if (this.userData.constraints) {
            enforceJointConstraints(this);
        }
        // Call the original update function
        originalUpdateMatrix.call(this);
    };
    
    // If we're preserving position, apply it now
    if (preserveCurrentPose) {
        // For fixed constraints, directly set the world position and quaternion
        if (constraints.type === 'fixed' && bone.parent) {
            // We need to convert world position back to local
            const worldPos = bone.userData.preservedPosition;
            const worldQuat = bone.userData.preservedQuaternion;
            
            // Convert to parent space
            const parentWorldInverse = new THREE.Matrix4().invert(bone.parent.matrixWorld);
            const localPos = worldPos.clone().applyMatrix4(parentWorldInverse);
            
            const parentQuatInverse = new THREE.Quaternion().copy(bone.parent.quaternion).invert();
            const localQuat = worldQuat.clone().multiply(parentQuatInverse);
            
            // Apply the local position and rotation
            bone.position.copy(localPos);
            bone.quaternion.copy(localQuat);
        }
        
        // Update the bone matrix to reflect these changes
        bone.updateMatrix();
    }
}

/**
 * Enforce joint constraints on a bone
 * @param {Object} bone - The bone to enforce constraints on
 */
export function enforceJointConstraints(bone) {
    if (!bone || !bone.userData.constraints) return;
    
    const constraints = bone.userData.constraints;
    
    switch (constraints.type) {
        case 'fixed':
            // Fixed joints - maintain position and orientation
            if (bone.userData.fixedPosition && bone.userData.fixedQuaternion) {
                // Use the stored fixed position and orientation (world coordinates)
                // We need to convert back to local space relative to the parent
                if (bone.parent) {
                    // Get parent world inverse
                    const parentWorldInverse = new THREE.Matrix4().copy(bone.parent.matrixWorld).invert();
                    const localPos = bone.userData.fixedPosition.clone().applyMatrix4(parentWorldInverse);
                    
                    // Get parent quaternion inverse
                    const parentQuatInverse = new THREE.Quaternion().copy(bone.parent.quaternion).invert();
                    const localQuat = new THREE.Quaternion().copy(bone.userData.fixedQuaternion)
                        .premultiply(parentQuatInverse);
                    
                    // Set local position and rotation
                    bone.position.copy(localPos);
                    bone.quaternion.copy(localQuat);
                }
            }
            // If no fixed position is stored, use initial rotation
            else if (bone.userData.initialRotation) {
                bone.rotation.set(
                    bone.userData.initialRotation.x,
                    bone.userData.initialRotation.y,
                    bone.userData.initialRotation.z
                );
                bone.rotation.order = bone.userData.initialRotation.order;
            }
            break;
            
        case 'hinge':
            // Hinge joints - only allow rotation on one axis, reset others
            if (bone.userData.hinge) {
                const hinge = bone.userData.hinge;
                const initial = bone.userData.initialRotation || { x: 0, y: 0, z: 0 };
                
                // Reset rotation on locked axes
                if (hinge.axis !== 'x') bone.rotation.x = initial.x;
                if (hinge.axis !== 'y') bone.rotation.y = initial.y;
                if (hinge.axis !== 'z') bone.rotation.z = initial.z;
                
                // Clamp rotation on the free axis
                if (hinge.axis === 'x') {
                    bone.rotation.x = Math.max(hinge.min, Math.min(hinge.max, bone.rotation.x));
                } else if (hinge.axis === 'y') {
                    bone.rotation.y = Math.max(hinge.min, Math.min(hinge.max, bone.rotation.y));
                } else if (hinge.axis === 'z') {
                    bone.rotation.z = Math.max(hinge.min, Math.min(hinge.max, bone.rotation.z));
                }
            }
            break;
            
        case 'limitRotation':
            // Apply rotation limits on each axis
            if (bone.userData.rotationLimits) {
                const limits = bone.userData.rotationLimits;
                
                if (limits.x) {
                    bone.rotation.x = Math.max(limits.x.min, Math.min(limits.x.max, bone.rotation.x));
                }
                if (limits.y) {
                    bone.rotation.y = Math.max(limits.y.min, Math.min(limits.y.max, bone.rotation.y));
                }
                if (limits.z) {
                    bone.rotation.z = Math.max(limits.z.min, Math.min(limits.z.max, bone.rotation.z));
                }
            }
            break;
            
        case 'spring':
            // Ragdoll-like spring implementation that respects hierarchy
            if (bone.userData.spring) {
                const spring = bone.userData.spring;
                
                // Initialize tracking if this is the first update
                const now = Date.now();
                if (!spring.lastPosition) {
                    spring.lastPosition = new THREE.Vector3().copy(bone.position);
                    spring.lastTime = now;
                    spring.velocityX = 0;
                    spring.velocityY = 0;
                    spring.velocityZ = 0;
                    spring.lastRotation = new THREE.Euler().copy(bone.rotation);
                    break;
                }
                
                // Calculate time delta with safeguards
                const deltaTime = Math.min((now - spring.lastTime) / 1000, 0.05); // Cap at 50ms for stability
                if (deltaTime <= 0) break;
                
                // Store hierarchy information
                if (!spring.hierarchyFactor) {
                    // Set influence based on depth in hierarchy (1.0 for root, decreases for children)
                    let hierarchyDepth = 0;
                    let parent = bone.parent;
                    while (parent && parent.isBone) {
                        hierarchyDepth++;
                        parent = parent.parent;
                    }
                    // Deeper bones receive less influence to prevent cascading oscillations
                    spring.hierarchyFactor = Math.max(0.2, 1.0 / (hierarchyDepth + 1));
                }
                
                // Calculate rotational differences from rest pose
                const diffX = spring.restRotation.x - bone.rotation.x;
                const diffY = spring.restRotation.y - bone.rotation.y;
                const diffZ = spring.restRotation.z - bone.rotation.z;
                
                // Calculate rotational velocity (change since last frame)
                const rotVelX = (bone.rotation.x - spring.lastRotation.x) / deltaTime;
                const rotVelY = (bone.rotation.y - spring.lastRotation.y) / deltaTime;
                const rotVelZ = (bone.rotation.z - spring.lastRotation.z) / deltaTime;
                
                // Proper spring forces adjusted by hierarchy factor and mass (simulated by bone size)
                const boneSize = bone.scale.length() || 1;
                const massInfluence = 1.0 / (boneSize * 0.5 + 0.5); // Larger bones have more mass
                
                // Apply hierarchy and mass adjustments to spring calculations
                const adjustedStiffness = spring.stiffness * spring.hierarchyFactor * massInfluence;
                const adjustedDamping = spring.damping * (1 + (1 - spring.hierarchyFactor) * 2); // More damping for deeper bones
                
                // Calculate spring force with adjusted parameters
                const springForceX = diffX * adjustedStiffness;
                const springForceY = diffY * adjustedStiffness;
                const springForceZ = diffZ * adjustedStiffness;
                
                // Apply damping force proportional to current velocity
                const dampingForceX = -rotVelX * adjustedDamping;
                const dampingForceY = -rotVelY * adjustedDamping;
                const dampingForceZ = -rotVelZ * adjustedDamping;
                
                // Combine forces
                const totalForceX = springForceX + dampingForceX;
                const totalForceY = springForceY + dampingForceY;
                const totalForceZ = springForceZ + dampingForceZ;
                
                // Update velocities with forces
                spring.velocityX += totalForceX * deltaTime;
                spring.velocityY += totalForceY * deltaTime;
                spring.velocityZ += totalForceZ * deltaTime;
                
                // Apply absolute velocity decay to ensure the motion eventually stops
                // This decay factor is separate from the damping which only affects the instantaneous force
                const velocityDecayFactor = Math.max(0, 1.0 - (spring.damping * 0.01 + 0.05) * deltaTime);
                spring.velocityX *= velocityDecayFactor;
                spring.velocityY *= velocityDecayFactor;
                spring.velocityZ *= velocityDecayFactor;
                
                // Apply velocity threshold to stop tiny movements
                const velocityThreshold = 0.001;
                if (Math.abs(spring.velocityX) < velocityThreshold) spring.velocityX = 0;
                if (Math.abs(spring.velocityY) < velocityThreshold) spring.velocityY = 0;
                if (Math.abs(spring.velocityZ) < velocityThreshold) spring.velocityZ = 0;
                
                // Apply velocity limits to prevent extreme oscillations
                const maxVelocity = 15.0;
                spring.velocityX = Math.max(-maxVelocity, Math.min(maxVelocity, spring.velocityX));
                spring.velocityY = Math.max(-maxVelocity, Math.min(maxVelocity, spring.velocityY));
                spring.velocityZ = Math.max(-maxVelocity, Math.min(maxVelocity, spring.velocityZ));
                
                // Apply velocities to rotation
                bone.rotation.x += spring.velocityX * deltaTime;
                bone.rotation.y += spring.velocityY * deltaTime;
                bone.rotation.z += spring.velocityZ * deltaTime;
                
                // Apply gravity effect based on hierarchy - deeper bones droop more
                // Check if the bone should be affected by gravity
                if (spring.hierarchyFactor < 0.8) { // Only affect non-root bones
                    // Get global gravity value from rigOptions if available, or use a reasonable default
                    const worldGravity = (rigOptions && rigOptions.worldGravity !== undefined) ? 
                        rigOptions.worldGravity : 1.0;
                    
                    // Simple gravity effect that pulls parts downward around local X axis
                    // This creates a more natural ragdoll droop effect
                    // The gravity influence is scaled by hierarchy and the global gravity value
                    const gravityInfluence = (1 - spring.hierarchyFactor) * 0.5 * Math.abs(worldGravity);
                    
                    // Apply gravity with correct direction (positive or negative based on worldGravity sign)
                    const gravityDirection = worldGravity >= 0 ? 1 : -1;
                    bone.rotation.x += gravityInfluence * deltaTime * 2.0 * gravityDirection;
                }
                
                // Store current state for next update
                spring.lastPosition.copy(bone.position);
                spring.lastTime = now;
                spring.lastRotation.copy(bone.rotation);
                
                // If this bone has children, ensure the children also update their constraints
                // This ensures force propagation through the hierarchy
                if (bone.children && bone.children.length > 0) {
                    for (let i = 0; i < bone.children.length; i++) {
                        const child = bone.children[i];
                        if (child.isBone && child.userData.constraints && 
                            child.userData.constraints.type === 'spring') {
                            // Force immediate update of child springs for proper cascade effect
                            enforceJointConstraints(child);
                        }
                    }
                }
            }
            break;
            
        case 'none':
        default:
            // No constraints (default) - unrestricted rotation
            // No need to do anything special here, allow free movement
            break;
    }
}

/**
 * Analyze the rig data in a GLTF model
 * @param {Object} gltf - The loaded GLTF model data
 * @returns {Object} Analyzed rig details
 */
export function analyzeGltfModel(gltf) {
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
        controls: [],
        joints: [],
        constraints: [] // Add a new array to track constraints
    };
    
    // Extract scene information
    const scene = gltf.scene;
    
    // Helper function to traverse the scene
    const traverseNode = (node, parentType = null) => {
        console.log('Traversing node:', node.name, 'type:', node.type, 'isBone:', node.isBone);
        
        // Look for joint constraints in this node
        const constraints = parseJointConstraints(node);
        if (constraints) {
            console.log(`Found constraints for ${node.name}:`, constraints);
            rawDetails.constraints.push({
                nodeName: node.name,
                nodeType: node.type,
                constraintType: constraints.type,
                constraintData: constraints
            });
        }
        
        // Check if the node is a bone
        if (node.isBone || node.name.toLowerCase().includes('bone')) {
            console.log('Found bone:', node.name);
            rawDetails.bones.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                rotation: node.rotation ? [node.rotation.x, node.rotation.y, node.rotation.z] : null,
                parentName: parentType === 'bone' ? node.parent.name : null,
                constraintType: constraints ? constraints.type : 'none' // Add constraint type
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
        joints: deduplicateItems(rawDetails.joints),
        constraints: rawDetails.constraints // Don't deduplicate constraints
    };
    
    console.log('Rig analysis results:', result);
    return result;
}

/**
 * Deduplicate items by name, counting duplicates
 * @param {Array} items - Array of items to deduplicate
 * @returns {Array} Deduplicated items with count property
 */
export function deduplicateItems(items) {
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
export function createBoneJoint(jointType, boneData, radius, options = {}) {
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
export function createBoneMesh(parent, radiusTop, radiusBottom, height, capMaterial, sideMaterial, alternateSideMaterial) {
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
export function createBoneUpdateFunction(boneGroup) {
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
export function addControlHandleToFurthestBone(bone, scene, modelScale) {
    const handleSize = modelScale * 2.6; // Double the size (from 1.3 to 2.6)
    const geometry = new THREE.SphereGeometry(handleSize, 16, 16);
    const material = new THREE.MeshBasicMaterial({
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
 * Create both joint and bone labels and set their visibility
 * @param {Object} scene - The Three.js scene
 */
export function createLabels(scene) {
    // Create joint labels
    console.log('Setting up joint labels');
    createJointLabels(scene);
    
    // Check if joint labels should be visible based on option
    if (!rigOptions.showJointLabels) {
        hideJointLabels();
    }
    
    // Create bone labels
    console.log('Setting up bone labels');
    createBoneLabels(scene);
    
    // Check if bone labels should be visible based on option
    if (!rigOptions.showBoneLabels) {
        hideBoneLabels();
    }
}

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
        addControlHandleToFurthestBone(furthestBone, scene, modelScale);
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
        
        if (furthestBoneHandle && furthestBoneHandle.material) {
            furthestBoneHandle.renderOrder = 1030;
            furthestBoneHandle.material.depthTest = false;
            furthestBoneHandle.material.needsUpdate = true;
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
