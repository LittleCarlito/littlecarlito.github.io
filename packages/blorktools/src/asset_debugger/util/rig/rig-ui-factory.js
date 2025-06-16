import { jointPreviousValues } from "../../panels/asset-panel/rig-heading/rig-heading";
import { findBoneByName, lockedBones, toggleBoneLock } from "./bone-kinematics";
import { jointSettingsDebug, updateConstraintSettingsState } from "./rig-state-manager";

/**
 * Add bone constraint controls to a bone item element
 * @param {HTMLElement} itemElem - The bone item element
 * @param {Object} item - The bone item data
 * @param {Object} details - Rig details object
 */
export function addBoneConstraintControls(itemElem, item, details) {
    const boneName = item.name;
    const bone = findBoneByName(boneName);
    
    if (!bone) return;
    
    const constraintContainer = document.createElement('div');
    constraintContainer.className = 'rig-constraint-container';
    
    const constraintLabel = document.createElement('label');
    constraintLabel.className = 'rig-constraint-label';
    constraintLabel.textContent = 'Constraint:';
    
    const constraintSelect = document.createElement('select');
    constraintSelect.className = 'rig-constraint-select';
    constraintSelect.setAttribute('data-bone-constraint', 'true');
    constraintSelect.setAttribute('data-bone-name', boneName);
    
    const constraintOptions = [
        { value: 'NONE', label: 'None' },
        { value: 'FIXED_POSITION', label: 'Fixed Position' },
        { value: 'SINGLE_AXIS_ROTATION', label: 'Single Axis Rotation' },
        { value: 'LIMIT_ROTATION_XYZ', label: 'Limit Rotation (XYZ)' },
        { value: 'DYNAMIC_SPRING', label: 'Dynamic Spring' }
    ];
    
    constraintOptions.forEach(option => {
        const optionElem = document.createElement('option');
        optionElem.value = option.value;
        optionElem.textContent = option.label;
        constraintSelect.appendChild(optionElem);
    });
    
    let initialConstraintType = 'NONE';
    
    if (bone.userData && bone.userData.constraints) {
        const constraintTypeMap = {
            'none': 'NONE',
            'fixed': 'FIXED_POSITION',
            'hinge': 'SINGLE_AXIS_ROTATION',
            'limitRotation': 'LIMIT_ROTATION_XYZ',
            'spring': 'DYNAMIC_SPRING'
        };
        initialConstraintType = constraintTypeMap[bone.userData.constraints.type] || 'NONE';
    } else if (details.constraints) {
        const existingConstraint = details.constraints.find(c => 
            c.boneName === boneName || c.nodeName === boneName);
        if (existingConstraint) {
            const constraintTypeMap = {
                'none': 'NONE',
                'fixed': 'FIXED_POSITION',
                'hinge': 'SINGLE_AXIS_ROTATION',
                'limitRotation': 'LIMIT_ROTATION_XYZ',
                'spring': 'DYNAMIC_SPRING'
            };
            initialConstraintType = constraintTypeMap[existingConstraint.type] || 'NONE';
        }
    }
    
    item.constraintType = initialConstraintType;
    
    if (bone.userData && bone.userData.constraints) {
        if (bone.userData.constraints.type === 'hinge') {
            item.hingeAxis = bone.userData.hinge?.axis || 'y';
            item.hingeMin = bone.userData.hinge?.min || -Math.PI/2;
            item.hingeMax = bone.userData.hinge?.max || Math.PI/2;
        } else if (bone.userData.constraints.type === 'limitRotation') {
            item.rotationLimits = bone.userData.rotationLimits || {
                x: { min: -Math.PI/4, max: Math.PI/4 },
                y: { min: -Math.PI/4, max: Math.PI/4 },
                z: { min: -Math.PI/4, max: Math.PI/4 }
            };
        } else if (bone.userData.constraints.type === 'spring') {
            item.spring = {
                stiffness: bone.userData.spring?.stiffness || 50,
                damping: bone.userData.spring?.damping || 5
            };
        }
    }
    
    constraintSelect.value = initialConstraintType;
    jointPreviousValues.set(boneName, initialConstraintType);
    
    constraintSelect.addEventListener('change', () => {
        item.constraintType = constraintSelect.value;
        
        if (jointSettingsDebug) {
            console.log(`Bone constraint ${boneName} changed to "${constraintSelect.value}"`);
        }
        
        const controlSelectors = [
            '.rig-constraint-controls',
            '.rig-axis-container',
            '.rig-limits-container',
            '.rig-rotation-limits-container',
            '.rig-spring-container'
        ];
        
        controlSelectors.forEach(selector => {
            const existingControls = itemElem.querySelectorAll(selector);
            existingControls.forEach(control => {
                itemElem.removeChild(control);
            });
        });
        
        if (constraintSelect.value === 'SINGLE_AXIS_ROTATION') {
            addHingeAxisSelector(itemElem, item);
        } else if (constraintSelect.value === 'LIMIT_ROTATION_XYZ') {
            addRotationLimitControls(itemElem, item);
        } else if (constraintSelect.value === 'DYNAMIC_SPRING') {
            addSpringControls(itemElem, item);
        }
        
        updateConstraintSettingsState();
    });
    
    constraintContainer.appendChild(constraintLabel);
    constraintContainer.appendChild(constraintSelect);
    itemElem.appendChild(constraintContainer);
    
    if (initialConstraintType === 'SINGLE_AXIS_ROTATION') {
        addHingeAxisSelector(itemElem, item);
    } else if (initialConstraintType === 'LIMIT_ROTATION_XYZ') {
        addRotationLimitControls(itemElem, item);
    } else if (initialConstraintType === 'DYNAMIC_SPRING') {
        addSpringControls(itemElem, item);
    }
    
    const lockContainer = document.createElement('div');
    lockContainer.className = 'rig-lock-container';
    
    const lockLabel = document.createElement('label');
    lockLabel.className = 'rig-lock-label';
    lockLabel.textContent = 'Lock Rotation:';
    
    const lockCheckbox = document.createElement('input');
    lockCheckbox.type = 'checkbox';
    lockCheckbox.className = 'rig-lock-checkbox';
    lockCheckbox.checked = lockedBones.has(bone.uuid);
    
    lockCheckbox.addEventListener('change', (e) => {
        toggleBoneLock(bone, e.target.checked);
    });
    
    lockContainer.appendChild(lockLabel);
    lockContainer.appendChild(lockCheckbox);
    itemElem.appendChild(lockContainer);
}

/**
 * Add hinge axis selector to a joint item
 * @param {HTMLElement} itemElem - The joint item element
 * @param {Object} item - The joint data
 */
function addHingeAxisSelector(itemElem, item) {
    const axisContainer = document.createElement('div');
    axisContainer.className = 'rig-axis-container rig-constraint-controls';
    
    const axisLabel = document.createElement('label');
    axisLabel.className = 'rig-axis-label';
    axisLabel.textContent = 'Locked Axis:';
    
    const axisSelect = document.createElement('select');
    axisSelect.className = 'rig-axis-select';
    
    const axes = [
        { value: 'x', label: 'X Axis' },
        { value: 'y', label: 'Y Axis' },
        { value: 'z', label: 'Z Axis' }
    ];
    
    axes.forEach(axis => {
        const option = document.createElement('option');
        option.value = axis.value;
        option.textContent = axis.label;
        axisSelect.appendChild(option);
    });
    
    // Set initial value or default to Y
    if (!item.hingeAxis) {
        item.hingeAxis = 'y';
    }
    axisSelect.value = item.hingeAxis;
    
    axisSelect.addEventListener('change', () => {
        item.hingeAxis = axisSelect.value;
        updateConstraintSettingsState();
    });
    
    axisContainer.appendChild(axisLabel);
    axisContainer.appendChild(axisSelect);
    itemElem.appendChild(axisContainer);
    
    // Add min/max angle inputs
    const limitsContainer = document.createElement('div');
    limitsContainer.className = 'rig-limits-container';
    
    // Min angle
    const minContainer = document.createElement('div');
    minContainer.className = 'rig-min-container';
    
    const minLabel = document.createElement('label');
    minLabel.textContent = 'Min Angle:';
    minLabel.className = 'rig-min-label';
    
    const minControlWrapper = document.createElement('div');
    minControlWrapper.className = 'rig-angle-control-wrapper';
    
    // Add decrement button
    const minDecBtn = document.createElement('button');
    minDecBtn.className = 'rig-angle-btn';
    minDecBtn.textContent = '−';
    minDecBtn.type = 'button';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'rig-min-input';
    minInput.min = -180;
    minInput.max = 180;
    minInput.step = 5;
    minInput.value = item.hingeMin ? Math.round(item.hingeMin * 180 / Math.PI) : -90;
    
    // Add increment button
    const minIncBtn = document.createElement('button');
    minIncBtn.className = 'rig-angle-btn';
    minIncBtn.textContent = '+';
    minIncBtn.type = 'button';
    
    // Update item data when input changes
    minInput.addEventListener('change', () => {
        item.hingeMin = minInput.value * Math.PI / 180;
        updateConstraintSettingsState();
    });
    
    // Button event listeners
    minDecBtn.addEventListener('click', () => {
        minInput.value = parseInt(minInput.value) - parseInt(minInput.step);
        // Trigger the change event manually
        minInput.dispatchEvent(new Event('change'));
        // Explicitly update constraint settings state for button click
        updateConstraintSettingsState();
    });
    
    minIncBtn.addEventListener('click', () => {
        minInput.value = parseInt(minInput.value) + parseInt(minInput.step);
        // Trigger the change event manually
        minInput.dispatchEvent(new Event('change'));
        // Explicitly update constraint settings state for button click
        updateConstraintSettingsState();
    });
    
    minControlWrapper.appendChild(minDecBtn);
    minControlWrapper.appendChild(minInput);
    minControlWrapper.appendChild(minIncBtn);
    
    minContainer.appendChild(minLabel);
    minContainer.appendChild(minControlWrapper);
    
    // Max angle
    const maxContainer = document.createElement('div');
    maxContainer.className = 'rig-max-container';
    
    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max Angle:';
    maxLabel.className = 'rig-max-label';
    
    const maxControlWrapper = document.createElement('div');
    maxControlWrapper.className = 'rig-angle-control-wrapper';
    
    // Add decrement button
    const maxDecBtn = document.createElement('button');
    maxDecBtn.className = 'rig-angle-btn';
    maxDecBtn.textContent = '−';
    maxDecBtn.type = 'button';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'rig-max-input';
    maxInput.min = -180;
    maxInput.max = 180;
    maxInput.step = 5;
    maxInput.value = item.hingeMax ? Math.round(item.hingeMax * 180 / Math.PI) : 90;
    
    // Add increment button
    const maxIncBtn = document.createElement('button');
    maxIncBtn.className = 'rig-angle-btn';
    maxIncBtn.textContent = '+';
    maxIncBtn.type = 'button';
    
    maxInput.addEventListener('change', () => {
        item.hingeMax = maxInput.value * Math.PI / 180;
        updateConstraintSettingsState();
    });
    
    // Button event listeners
    maxDecBtn.addEventListener('click', () => {
        maxInput.value = parseInt(maxInput.value) - parseInt(maxInput.step);
        // Trigger the change event manually
        maxInput.dispatchEvent(new Event('change'));
        // Explicitly update constraint settings state for button click
        updateConstraintSettingsState();
    });
    
    maxIncBtn.addEventListener('click', () => {
        maxInput.value = parseInt(maxInput.value) + parseInt(maxInput.step);
        // Trigger the change event manually
        maxInput.dispatchEvent(new Event('change'));
        // Explicitly update constraint settings state for button click
        updateConstraintSettingsState();
    });
    
    maxControlWrapper.appendChild(maxDecBtn);
    maxControlWrapper.appendChild(maxInput);
    maxControlWrapper.appendChild(maxIncBtn);
    
    maxContainer.appendChild(maxLabel);
    maxContainer.appendChild(maxControlWrapper);
    
    limitsContainer.appendChild(minContainer);
    limitsContainer.appendChild(maxContainer);
    itemElem.appendChild(limitsContainer);
    
    // Store original values immediately when control is created
    const boneName = itemElem.closest('.rig-item')?.querySelector('select[data-bone-constraint]')?.getAttribute('data-bone-name');
    if (boneName) {
        jointPreviousValues.set(`${boneName}:hinge-config`, {
            axis: axisSelect.value,
            min: parseInt(minInput.value),
            max: parseInt(maxInput.value)
        });
        
        if (jointSettingsDebug) {
            console.log(`Stored initial hinge config for ${boneName}:`, jointPreviousValues.get(`${boneName}:hinge-config`));
        }
    }
}

/**
 * Add rotation limit controls to a joint item
 * @param {HTMLElement} itemElem - The joint item element
 * @param {Object} item - The joint data
 */
function addRotationLimitControls(itemElem, item) {
    // Initialize limits object if not exists
    if (!item.rotationLimits) {
        item.rotationLimits = {
            x: { min: -Math.PI/4, max: Math.PI/4 },
            y: { min: -Math.PI/4, max: Math.PI/4 },
            z: { min: -Math.PI/4, max: Math.PI/4 }
        };
    }
    
    const limitsContainer = document.createElement('div');
    limitsContainer.className = 'rig-rotation-limits-container rig-constraint-controls';
    
    const axisLabels = ['X', 'Y', 'Z'];
    
    // Create a config object to store initial values
    const initialConfig = { x: {}, y: {}, z: {} };
    
    // Create controls for each axis
    axisLabels.forEach(axis => {
        const axisLower = axis.toLowerCase();
        
        const axisContainer = document.createElement('div');
        axisContainer.className = 'rig-axis-limits';
        
        const axisLabel = document.createElement('div');
        axisLabel.className = 'rig-axis-limit-label';
        axisLabel.textContent = `${axis} Axis:`;
        axisContainer.appendChild(axisLabel);
        
        // Min limit
        const minContainer = document.createElement('div');
        minContainer.className = 'rig-min-limit';
        
        const minLabel = document.createElement('label');
        minLabel.textContent = 'Min:';
        
        const minControlWrapper = document.createElement('div');
        minControlWrapper.className = 'rig-angle-control-wrapper';
        
        // Add decrement button
        const minDecBtn = document.createElement('button');
        minDecBtn.className = 'rig-angle-btn';
        minDecBtn.textContent = '−';
        minDecBtn.type = 'button';
        
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.min = -180;
        minInput.max = 180;
        minInput.step = 5;
        minInput.value = Math.round((item.rotationLimits[axisLower]?.min || -45) * 180 / Math.PI);
        
        // Store initial value in config
        initialConfig[axisLower].min = parseInt(minInput.value);
        
        // Add increment button
        const minIncBtn = document.createElement('button');
        minIncBtn.className = 'rig-angle-btn';
        minIncBtn.textContent = '+';
        minIncBtn.type = 'button';
        
        minInput.addEventListener('change', () => {
            if (!item.rotationLimits[axisLower]) {
                item.rotationLimits[axisLower] = {};
            }
            item.rotationLimits[axisLower].min = minInput.value * Math.PI / 180;
            updateConstraintSettingsState();
        });
        
        // Button event listeners
        minDecBtn.addEventListener('click', () => {
            minInput.value = parseInt(minInput.value) - parseInt(minInput.step || 5);
            // Trigger the change event manually
            minInput.dispatchEvent(new Event('change'));
            // Explicitly update constraint settings state for button click
            updateConstraintSettingsState();
        });
        
        minIncBtn.addEventListener('click', () => {
            minInput.value = parseInt(minInput.value) + parseInt(minInput.step || 5);
            // Trigger the change event manually
            minInput.dispatchEvent(new Event('change'));
            // Explicitly update constraint settings state for button click
            updateConstraintSettingsState();
        });
        
        minControlWrapper.appendChild(minDecBtn);
        minControlWrapper.appendChild(minInput);
        minControlWrapper.appendChild(minIncBtn);
        
        minContainer.appendChild(minLabel);
        minContainer.appendChild(minControlWrapper);
        
        // Max limit
        const maxContainer = document.createElement('div');
        maxContainer.className = 'rig-max-limit';
        
        const maxLabel = document.createElement('label');
        maxLabel.textContent = 'Max:';
        
        const maxControlWrapper = document.createElement('div');
        maxControlWrapper.className = 'rig-angle-control-wrapper';
        
        // Add decrement button
        const maxDecBtn = document.createElement('button');
        maxDecBtn.className = 'rig-angle-btn';
        maxDecBtn.textContent = '−';
        maxDecBtn.type = 'button';
        
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.min = -180;
        maxInput.max = 180;
        maxInput.step = 5;
        maxInput.value = Math.round((item.rotationLimits[axisLower]?.max || 45) * 180 / Math.PI);
        
        // Store initial value in config
        initialConfig[axisLower].max = parseInt(maxInput.value);
        
        // Add increment button
        const maxIncBtn = document.createElement('button');
        maxIncBtn.className = 'rig-angle-btn';
        maxIncBtn.textContent = '+';
        maxIncBtn.type = 'button';
        
        maxInput.addEventListener('change', () => {
            if (!item.rotationLimits[axisLower]) {
                item.rotationLimits[axisLower] = {};
            }
            item.rotationLimits[axisLower].max = maxInput.value * Math.PI / 180;
            updateConstraintSettingsState();
        });
        
        // Button event listeners
        maxDecBtn.addEventListener('click', () => {
            maxInput.value = parseInt(maxInput.value) - parseInt(maxInput.step || 5);
            // Trigger the change event manually
            maxInput.dispatchEvent(new Event('change'));
            // Explicitly update constraint settings state for button click
            updateConstraintSettingsState();
        });
        
        maxIncBtn.addEventListener('click', () => {
            maxInput.value = parseInt(maxInput.value) + parseInt(maxInput.step || 5);
            // Trigger the change event manually
            maxInput.dispatchEvent(new Event('change'));
            // Explicitly update constraint settings state for button click
            updateConstraintSettingsState();
        });
        
        maxControlWrapper.appendChild(maxDecBtn);
        maxControlWrapper.appendChild(maxInput);
        maxControlWrapper.appendChild(maxIncBtn);
        
        maxContainer.appendChild(maxLabel);
        maxContainer.appendChild(maxControlWrapper);
        
        axisContainer.appendChild(minContainer);
        axisContainer.appendChild(maxContainer);
        limitsContainer.appendChild(axisContainer);
    });
    
    itemElem.appendChild(limitsContainer);
    
    // Store initial rotation limits immediately when control is created
    const boneName = itemElem.closest('.rig-item')?.querySelector('select[data-bone-constraint]')?.getAttribute('data-bone-name');
    if (boneName) {
        jointPreviousValues.set(`${boneName}:rotation-limits`, JSON.parse(JSON.stringify(initialConfig)));
        
        if (jointSettingsDebug) {
            console.log(`Stored initial rotation limits for ${boneName}:`, jointPreviousValues.get(`${boneName}:rotation-limits`));
        }
    }
}

/**
 * Add spring controls to a joint item
 * @param {HTMLElement} itemElem - The joint item element
 * @param {Object} item - The joint data
 */
function addSpringControls(itemElem, item) {
    // Initialize spring properties if not exists
    if (!item.spring) {
        item.spring = {
            stiffness: 50,
            damping: 5,
            gravity: 1.0
        };
    }
    
    const springContainer = document.createElement('div');
    springContainer.className = 'rig-spring-container rig-constraint-controls';
    
    // Stiffness control
    const stiffnessContainer = document.createElement('div');
    stiffnessContainer.className = 'rig-stiffness-container';
    
    const stiffnessLabel = document.createElement('label');
    stiffnessLabel.textContent = 'Stiffness:';
    stiffnessLabel.className = 'rig-stiffness-label';
    
    // Create slider container
    const stiffnessSliderContainer = document.createElement('div');
    stiffnessSliderContainer.className = 'rig-slider-container';
    
    const stiffnessInput = document.createElement('input');
    stiffnessInput.type = 'range';
    stiffnessInput.min = 1;
    stiffnessInput.max = 100;
    stiffnessInput.value = item.spring.stiffness || 50;
    stiffnessInput.className = 'rig-stiffness-input';
    
    const stiffnessValue = document.createElement('span');
    stiffnessValue.textContent = stiffnessInput.value;
    stiffnessValue.className = 'rig-stiffness-value';
    
    stiffnessInput.addEventListener('input', () => {
        item.spring.stiffness = parseInt(stiffnessInput.value);
        stiffnessValue.textContent = stiffnessInput.value;
        updateConstraintSettingsState();
    });
    
    // Assemble stiffness controls
    stiffnessSliderContainer.appendChild(stiffnessInput);
    stiffnessSliderContainer.appendChild(stiffnessValue);
    stiffnessContainer.appendChild(stiffnessLabel);
    stiffnessContainer.appendChild(stiffnessSliderContainer);
    
    // Damping control
    const dampingContainer = document.createElement('div');
    dampingContainer.className = 'rig-damping-container';
    
    const dampingLabel = document.createElement('label');
    dampingLabel.textContent = 'Damping:';
    dampingLabel.className = 'rig-damping-label';
    
    // Create slider container
    const dampingSliderContainer = document.createElement('div');
    dampingSliderContainer.className = 'rig-slider-container';
    
    const dampingInput = document.createElement('input');
    dampingInput.type = 'range';
    dampingInput.min = 0;
    dampingInput.max = 20;
    dampingInput.value = item.spring.damping || 5;
    dampingInput.className = 'rig-damping-input';
    
    const dampingValue = document.createElement('span');
    dampingValue.textContent = dampingInput.value;
    dampingValue.className = 'rig-damping-value';
    
    dampingInput.addEventListener('input', () => {
        item.spring.damping = parseInt(dampingInput.value);
        dampingValue.textContent = dampingInput.value;
        updateConstraintSettingsState();
    });
    
    // Assemble damping controls
    dampingSliderContainer.appendChild(dampingInput);
    dampingSliderContainer.appendChild(dampingValue);
    dampingContainer.appendChild(dampingLabel);
    dampingContainer.appendChild(dampingSliderContainer);
    
    // Gravity influence control
    const gravityContainer = document.createElement('div');
    gravityContainer.className = 'rig-gravity-container';
    
    const gravityLabel = document.createElement('label');
    gravityLabel.textContent = 'Gravity:';
    gravityLabel.className = 'rig-gravity-label';
    
    // Create slider container
    const gravitySliderContainer = document.createElement('div');
    gravitySliderContainer.className = 'rig-slider-container';
    
    const gravityInput = document.createElement('input');
    gravityInput.type = 'range';
    gravityInput.min = 0;
    gravityInput.max = 20;
    gravityInput.step = 0.1;
    gravityInput.value = item.spring.gravity || 1.0;
    gravityInput.className = 'rig-gravity-input';
    
    const gravityValue = document.createElement('span');
    gravityValue.textContent = gravityInput.value;
    gravityValue.className = 'rig-gravity-value';
    
    gravityInput.addEventListener('input', () => {
        item.spring.gravity = parseFloat(gravityInput.value);
        gravityValue.textContent = gravityInput.value;
        updateConstraintSettingsState();
    });
    
    // Assemble gravity controls
    gravitySliderContainer.appendChild(gravityInput);
    gravitySliderContainer.appendChild(gravityValue);
    gravityContainer.appendChild(gravityLabel);
    gravityContainer.appendChild(gravitySliderContainer);
    
    springContainer.appendChild(stiffnessContainer);
    springContainer.appendChild(dampingContainer);
    springContainer.appendChild(gravityContainer);
    itemElem.appendChild(springContainer);
    
    // Store original values immediately when control is created
    const boneName = itemElem.closest('.rig-item')?.querySelector('select[data-bone-constraint]')?.getAttribute('data-bone-name');
    if (boneName) {
        jointPreviousValues.set(`${boneName}:spring-config`, {
            stiffness: parseInt(stiffnessInput.value),
            damping: parseInt(dampingInput.value),
            gravity: parseFloat(gravityInput.value)
        });
        
        if (jointSettingsDebug) {
            console.log(`Stored initial spring config for ${boneName}:`, jointPreviousValues.get(`${boneName}:spring-config`));
        }
    }
}

/**
 * Disable the Apply Changes button
 * @param {HTMLElement} button - The button to disable
 */
export function disableApplyButton(button) {
    button.disabled = true;
    button.style.backgroundColor = 'rgba(0,0,0,0.2)';
    button.style.color = '#ccc';
    button.style.cursor = 'not-allowed';
    button.style.opacity = '0.5';
}

/**
 * Enable the Apply Changes button
 * @param {HTMLElement} button - The button to enable
 */
export function enableApplyButton(button) {
    if (button) {
        button.removeAttribute('disabled');
        button.classList.remove('disabled');
        
        // Restore visual appearance to match enabled state
        button.style.backgroundColor = '#3f51b5'; // Standard blue button color
        button.style.color = '#ffffff'; // White text
        button.style.cursor = 'pointer';
        button.style.opacity = '1.0';
    }
}
