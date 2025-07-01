import * as THREE from 'three';
import { bones } from './bone-kinematics';
import { jointPreviousValues } from '../../panels/asset-panel/rig-heading/rig-heading';
import { disableApplyButton, enableApplyButton } from './rig-ui-factory';

// Add debug flag
export let jointSettingsDebug = true;

/**
 * Store current bone world positions and rotations
 * @returns {Map} Map of bone states keyed by bone name
 */
export function storeBoneCurrentState() {
    const boneCurrentState = new Map();
    
    bones.forEach(bone => {
        if (bone) {
            bone.updateWorldMatrix(true, false);
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            bone.getWorldPosition(worldPosition);
            bone.getWorldQuaternion(worldQuaternion);
            
            boneCurrentState.set(bone.name, {
                position: worldPosition.clone(),
                quaternion: worldQuaternion.clone()
            });
        }
    });
    
    return boneCurrentState;
}

/**
 * Update previous values for all constraint dropdowns
 * @param {NodeList} constraintSelects - List of constraint select elements
 */
export function updatePreviousValues(constraintSelects) {
    constraintSelects.forEach(select => {
        const boneName = select.getAttribute('data-bone-name');
        jointPreviousValues.set(boneName, select.value);
    });
}

/**
 * Update the state of all bone constraint settings
 */
export function updateConstraintSettingsState() {
    const constraintSelects = document.querySelectorAll('select[data-bone-constraint]');
    let allConstraintsInPreviousState = true;
    
    constraintSelects.forEach(select => {
        const boneName = select.getAttribute('data-bone-name');
        const previousValue = jointPreviousValues.get(boneName);
        const currentValue = select.value;
        
        if (previousValue !== currentValue) {
            allConstraintsInPreviousState = false;
        }
        
        // Also check constraint parameters (for advanced constraints)
        if (currentValue === 'SINGLE_AXIS_ROTATION') {
            // Check hinge parameters
            const itemElem = select.closest('.rig-item');
            if (itemElem) {
                const minInput = itemElem.querySelector('.rig-min-input');
                const maxInput = itemElem.querySelector('.rig-max-input');
                const axisSelect = itemElem.querySelector('.rig-axis-select');
                
                if (minInput && maxInput && axisSelect) {
                    // Get stored values (default if not stored)
                    const storedConfig = jointPreviousValues.get(`${boneName}:hinge-config`);
                    
                    // If no stored config, this is the first time, so store current values
                    if (!storedConfig) {
                        jointPreviousValues.set(`${boneName}:hinge-config`, {
                            axis: axisSelect.value,
                            min: parseInt(minInput.value),
                            max: parseInt(maxInput.value)
                        });
                    } else {
                        // Check if current values match stored values
                        if (storedConfig.axis !== axisSelect.value || 
                            storedConfig.min !== parseInt(minInput.value) || 
                            storedConfig.max !== parseInt(maxInput.value)) {
                            allConstraintsInPreviousState = false;
                        }
                    }
                }
            }
        } else if (currentValue === 'LIMIT_ROTATION_XYZ') {
            // Check rotation limits
            const itemElem = select.closest('.rig-item');
            if (itemElem) {
                const rotLimitContainers = itemElem.querySelectorAll('.rig-axis-limits');
                const storedConfig = jointPreviousValues.get(`${boneName}:rotation-limits`);
                
                // Create a new config object from current values
                const currentConfig = { x: {}, y: {}, z: {} };
                let hasChanges = false;
                
                rotLimitContainers.forEach((container, index) => {
                    const axis = ['x', 'y', 'z'][index];
                    const minInput = container.querySelector('.rig-min-limit input');
                    const maxInput = container.querySelector('.rig-max-limit input');
                    
                    if (minInput && maxInput) {
                        currentConfig[axis].min = parseInt(minInput.value);
                        currentConfig[axis].max = parseInt(maxInput.value);
                    }
                });
                
                // If no stored config, store current values
                if (!storedConfig) {
                    jointPreviousValues.set(`${boneName}:rotation-limits`, JSON.parse(JSON.stringify(currentConfig)));
                } else {
                    // Check each axis for changes
                    ['x', 'y', 'z'].forEach(axis => {
                        if (storedConfig[axis]?.min !== currentConfig[axis]?.min || 
                            storedConfig[axis]?.max !== currentConfig[axis]?.max) {
                            hasChanges = true;
                        }
                    });
                    
                    if (hasChanges) {
                        allConstraintsInPreviousState = false;
                    }
                }
            }
        } else if (currentValue === 'DYNAMIC_SPRING') {
            // Check spring parameters
            const itemElem = select.closest('.rig-item');
            if (itemElem) {
                const stiffnessInput = itemElem.querySelector('.rig-stiffness-input');
                const dampingInput = itemElem.querySelector('.rig-damping-input');
                const gravityInput = itemElem.querySelector('.rig-gravity-input');
                
                // Get stored values
                const storedConfig = jointPreviousValues.get(`${boneName}:spring-config`);
                
                // If no stored config, store current values
                if (!storedConfig && stiffnessInput && dampingInput && gravityInput) {
                    jointPreviousValues.set(`${boneName}:spring-config`, {
                        stiffness: parseInt(stiffnessInput.value),
                        damping: parseInt(dampingInput.value),
                        gravity: parseFloat(gravityInput.value)
                    });
                } else if (stiffnessInput && dampingInput && gravityInput) {
                    // Check if current values match stored values
                    if (storedConfig.stiffness !== parseInt(stiffnessInput.value) || 
                        storedConfig.damping !== parseInt(dampingInput.value) || 
                        storedConfig.gravity !== parseFloat(gravityInput.value)) {
                        allConstraintsInPreviousState = false;
                    }
                }
            }
        }
    });
    
    if (jointSettingsDebug) {
        console.log(`All Bone Constraints in previous state: ${allConstraintsInPreviousState}`);
    }
    
    // Control Apply Changes button state based on changes
    const applyButton = document.getElementById('apply-bone-constraints-button');
    if (applyButton) {
        if (allConstraintsInPreviousState) {
            disableApplyButton(applyButton);
        } else {
            enableApplyButton(applyButton);
        }
    }
    
    return allConstraintsInPreviousState;
}