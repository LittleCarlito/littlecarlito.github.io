import { jointPreviousValues } from "../../panels/asset-panel/rig-heading/rig-heading";
import { findBoneByName, updateAllBoneMatrices } from "./bone-kinematics";
import { rigDetails } from "./rig-controller";
import { applyJointConstraints } from "./rig-factory";
import { storeBoneCurrentState, updateConstraintSettingsState, updatePreviousValues } from "./rig-state-manager";
import { disableApplyButton } from "./rig-ui-component-factory";

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
