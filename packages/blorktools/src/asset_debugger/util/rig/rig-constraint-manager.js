import * as THREE from 'three';
import { jointPreviousValues } from "../../panels/asset-panel/rig-heading/rig-heading";
import { findBoneByName, updateAllBoneMatrices } from "./bone-kinematics";
import { rigDetails, rigOptions } from "./rig-controller";
import { storeBoneCurrentState, updateConstraintSettingsState, updatePreviousValues } from "./rig-state-manager";
import { disableApplyButton } from "./rig-ui-factory";

/**
 * Create a none constraint (removes constraint)
 * @param {Object} currentState - Current bone state
 * @returns {Object} None constraint
 */
function createNoneConstraint(currentState) {
    return {
        type: 'none',
        preservePosition: currentState ? true : false
    };
}

/**
 * Create a dynamic spring constraint
 * @param {Object} item - Bone item data
 * @param {Object} currentState - Current bone state
 * @param {HTMLElement} select - Constraint select element
 * @param {string} boneName - Bone name
 * @returns {Object} Spring constraint
 */
function createSpringConstraint(item, currentState, select, boneName) {
    const constraint = {
        type: 'spring',
        stiffness: item?.spring?.stiffness || 50,
        damping: item?.spring?.damping || 5,
        gravity: item?.spring?.gravity || 1.0,
        preservePosition: currentState ? true : false
    };
    
    const springItemElem = select.closest('.rig-item');
    if (springItemElem) {
        const stiffnessInput = springItemElem.querySelector('.rig-stiffness-input');
        const dampingInput = springItemElem.querySelector('.rig-damping-input');
        const gravityInput = springItemElem.querySelector('.rig-gravity-input');
        
        if (stiffnessInput && dampingInput && gravityInput) {
            jointPreviousValues.set(`${boneName}:spring-config`, {
                stiffness: parseInt(stiffnessInput.value),
                damping: parseInt(dampingInput.value),
                gravity: parseFloat(gravityInput.value)
            });
        }
    }
    
    return constraint;
}

/**
 * Create a limit rotation constraint
 * @param {Object} item - Bone item data
 * @param {Object} currentState - Current bone state
 * @param {HTMLElement} select - Constraint select element
 * @param {string} boneName - Bone name
 * @returns {Object} Limit rotation constraint
 */
function createLimitRotationConstraint(item, currentState, select, boneName) {
    const constraint = {
        type: 'limitRotation',
        limits: item?.rotationLimits || {
            x: { min: -Math.PI/4, max: Math.PI/4 },
            y: { min: -Math.PI/4, max: Math.PI/4 },
            z: { min: -Math.PI/4, max: Math.PI/4 }
        },
        preservePosition: currentState ? true : false
    };
    
    const rotItemElem = select.closest('.rig-item');
    if (rotItemElem) {
        const currentConfig = { x: {}, y: {}, z: {} };
        const rotLimitContainers = rotItemElem.querySelectorAll('.rig-axis-limits');
        
        rotLimitContainers.forEach((container, index) => {
            const axis = ['x', 'y', 'z'][index];
            const minInput = container.querySelector('.rig-min-limit input');
            const maxInput = container.querySelector('.rig-max-limit input');
            
            if (minInput && maxInput) {
                currentConfig[axis].min = parseInt(minInput.value);
                currentConfig[axis].max = parseInt(maxInput.value);
            }
        });
        
        jointPreviousValues.set(`${boneName}:rotation-limits`, JSON.parse(JSON.stringify(currentConfig)));
    }
    
    return constraint;
}

/**
 * Create a single axis rotation (hinge) constraint
 * @param {Object} item - Bone item data
 * @param {Object} currentState - Current bone state
 * @param {HTMLElement} select - Constraint select element
 * @param {string} boneName - Bone name
 * @returns {Object} Hinge constraint
 */
function createHingeConstraint(item, currentState, select, boneName) {
    const constraint = {
        type: 'hinge',
        axis: item?.hingeAxis || 'y',
        min: item?.hingeMin || -Math.PI/2,
        max: item?.hingeMax || Math.PI/2,
        preservePosition: currentState ? true : false
    };
    
    const itemElem = select.closest('.rig-item');
    if (itemElem) {
        const minInput = itemElem.querySelector('.rig-min-input');
        const maxInput = itemElem.querySelector('.rig-max-input');
        const axisSelect = itemElem.querySelector('.rig-axis-select');
        
        if (minInput && maxInput && axisSelect) {
            jointPreviousValues.set(`${boneName}:hinge-config`, {
                axis: axisSelect.value,
                min: parseInt(minInput.value),
                max: parseInt(maxInput.value)
            });
        }
    }
    
    return constraint;
}

/**
 * Create a fixed position constraint
 * @param {Object} currentState - Current bone state
 * @returns {Object} Fixed position constraint
 */
function createFixedPositionConstraint(currentState) {
    return {
        type: 'fixed',
        preservePosition: currentState ? true : false
    };
}

/**
 * Create constraint object based on constraint type
 * @param {string} constraintType - Type of constraint
 * @param {Object} item - Bone item data
 * @param {Object} currentState - Current bone state
 * @param {HTMLElement} select - Constraint select element
 * @param {string} boneName - Bone name
 * @returns {Object} Constraint object
 */
function createConstraintByType(constraintType, item, currentState, select, boneName) {
    switch (constraintType) {
        case 'FIXED_POSITION':
            return createFixedPositionConstraint(currentState);
        case 'SINGLE_AXIS_ROTATION':
            return createHingeConstraint(item, currentState, select, boneName);
        case 'LIMIT_ROTATION_XYZ':
            return createLimitRotationConstraint(item, currentState, select, boneName);
        case 'DYNAMIC_SPRING':
            return createSpringConstraint(item, currentState, select, boneName);
        case 'NONE':
        default:
            return createNoneConstraint(currentState);
    }
}

/**
 * Apply constraint to a bone and update rig details
 * @param {Object} bone - Three.js bone object
 * @param {Object} constraint - Constraint object
 * @param {Object} currentState - Current bone state
 * @param {string} boneName - Bone name
 */
function applyConstraintToBone(bone, constraint, currentState, boneName) {
    console.log(`Applying ${constraint.type} constraint to ${boneName}`);
    
    if (currentState && constraint.preservePosition) {
        constraint.currentPosition = currentState.position;
        constraint.currentQuaternion = currentState.quaternion;
    }
    
    applyJointConstraints(bone, constraint);
    
    if (rigDetails.constraints) {
        const existingIndex = rigDetails.constraints.findIndex(c => 
            c.boneName === boneName || c.nodeName === boneName);
        
        if (existingIndex >= 0) {
            rigDetails.constraints[existingIndex] = {
                boneName: boneName,
                type: constraint.type,
                data: constraint
            };
        } else {
            rigDetails.constraints.push({
                boneName: boneName,
                type: constraint.type,
                data: constraint
            });
        }
    }
}

/**
 * Process a single bone constraint
 * @param {HTMLElement} select - Constraint select element
 * @param {Map} boneCurrentState - Map of current bone states
 */
export function processBoneConstraint(select, boneCurrentState) {
    const boneName = select.getAttribute('data-bone-name');
    const constraintType = select.value;
    
    console.log(`Processing bone ${boneName}, constraint type: ${constraintType}`);
    
    const bone = findBoneByName(boneName);
    if (!bone) return;
    
    let item = null;
    if (rigDetails && rigDetails.bones) {
        item = rigDetails.bones.find(b => b.name === boneName);
    }
    
    const currentState = boneCurrentState.get(boneName);
    
    const constraint = createConstraintByType(constraintType, item, currentState, select, boneName);
    
    if (constraint) {
        applyConstraintToBone(bone, constraint, currentState, boneName);
    }
}

/**
 * Handle the Apply Constraints button click
 * @param {HTMLElement} button - The Apply Constraints button element
 */
export function handleApplyConstraints(button) {
    console.log('Applying bone constraint changes...');
    
    const constraintSelects = document.querySelectorAll('select[data-bone-constraint]');
    const boneCurrentState = storeBoneCurrentState();
    
    constraintSelects.forEach(select => {
        processBoneConstraint(select, boneCurrentState);
    });
    
    updateAllBoneMatrices(true);
    updatePreviousValues(constraintSelects);
    updateConstraintSettingsState();
    disableApplyButton(button);
    
    console.log('Bone constraints applied successfully');
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
function enforceJointConstraints(bone) {
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

