/**
 * Asset Debugger - Rig Panel
 * 
 * This module provides rig visualization and control functionality for the Asset Debugger.
 * It implements the same bone/rig/control parsing as the Rig Debugger.
 */
import * as THREE from 'three';
import { getState } from '../core/state.js';
import { 
    analyzeGltfModel, 
    deduplicateItems, 
    createRigVisualization, 
    createBoneMesh, 
    createBoneUpdateFunction, 
    addControlHandleToFurthestBone
} from '../core/rig/rig-factory.js';
import { setIsDragging, getIsDragging, checkHandleHover } from '../core/drag-util.js';
import { 
    rigDetails,
    updateRigDetails,
    rigOptions,
    updateRigVisualization,
    resetRig
 } from '../core/rig/rig-manager.js';
 import {
    bones,
    lockedBones,
    boneVisualsGroup,
    findAssociatedBone,
    findBoneByName, 
    furthestBoneHandle, 
    findFarthestBone, 
    boneSideMaterial, 
    boneMaterial,
    toggleBoneLock,
    updateAllBoneMatrices
 } from '../core/bone-util.js';
 import { saveSettings, loadSettings } from '../data/localstorage-util.js';

// Reusable objects for position and rotation operations
let worldPos = new THREE.Vector3();
let worldRot = new THREE.Quaternion();

// Add global variables to track collapse states
let optionsCollapseState = false; // false = collapsed, true = expanded
let detailsCollapseState = false; // false = collapsed, true = expanded

// Add debug flag
let jointSettingsDebug = true;

// Add global state tracking for joint settings
let allJointsInPreviousState = true;
let jointPreviousValues = new Map(); // Map of joint name to previous value

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
    
    // Create essential controls section
    const controlsSection = document.createElement('div');
    controlsSection.className = 'rig-controls-section';
    
    // Create checkboxes in a wrapper
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.className = 'rig-checkbox-wrapper';
    controlsSection.appendChild(checkboxWrapper);
    
    // Create Display Rig checkbox
    const displayRigContainer = document.createElement('div');
    displayRigContainer.className = 'rig-checkbox-container';
    
    const displayRigLabel = document.createElement('label');
    displayRigLabel.textContent = 'Display Rig';
    displayRigLabel.className = 'rig-checkbox-label';
    
    const displayRigCheckbox = document.createElement('input');
    displayRigCheckbox.type = 'checkbox';
    displayRigCheckbox.id = 'display-rig-tab';
    displayRigCheckbox.checked = rigOptions.displayRig;
    displayRigCheckbox.className = 'rig-checkbox';
    
    displayRigCheckbox.addEventListener('change', (e) => {
        rigOptions.displayRig = e.target.checked;
        updateRigVisualization();
        
        // Sync with settings modal checkbox
        const settingsModalCheckbox = document.getElementById('display-rig');
        if (settingsModalCheckbox && settingsModalCheckbox.checked !== e.target.checked) {
            settingsModalCheckbox.checked = e.target.checked;
        }
        
        // Save settings to localStorage immediately
        saveRigOptionToLocalStorage('displayRig', e.target.checked);
    });
    
    displayRigLabel.setAttribute('for', 'display-rig-tab');
    displayRigContainer.appendChild(displayRigLabel);
    displayRigContainer.appendChild(displayRigCheckbox);
    
    // Create Force Z checkbox
    const forceZContainer = document.createElement('div');
    forceZContainer.className = 'rig-checkbox-container';
    
    const forceZLabel = document.createElement('label');
    forceZLabel.textContent = 'Force Z-index';
    forceZLabel.className = 'rig-checkbox-label';
    
    const forceZCheckbox = document.createElement('input');
    forceZCheckbox.type = 'checkbox';
    forceZCheckbox.id = 'force-z-tab';
    forceZCheckbox.checked = rigOptions.forceZ;
    forceZCheckbox.className = 'rig-checkbox';
    
    forceZCheckbox.addEventListener('change', (e) => {
        rigOptions.forceZ = e.target.checked;
        updateRigVisualization();
        
        // Sync with settings modal checkbox
        const settingsModalCheckbox = document.getElementById('force-z');
        if (settingsModalCheckbox && settingsModalCheckbox.checked !== e.target.checked) {
            settingsModalCheckbox.checked = e.target.checked;
        }
        
        // Save settings to localStorage immediately
        saveRigOptionToLocalStorage('forceZ', e.target.checked);
    });
    
    forceZLabel.setAttribute('for', 'force-z-tab');
    forceZContainer.appendChild(forceZLabel);
    forceZContainer.appendChild(forceZCheckbox);
    
    // Add both checkboxes to controls section
    checkboxWrapper.appendChild(displayRigContainer);
    checkboxWrapper.appendChild(forceZContainer);
    
    // Create Reset Physics button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Physics';
    resetButton.className = 'rig-reset-button';
    
    resetButton.addEventListener('click', () => {
        resetRig();
    });
    
    controlsSection.appendChild(resetButton);
    
    // Add controls section to container
    container.appendChild(controlsSection);
    
    // Create Rig Details section (non-collapsible)
    const detailsSection = document.createElement('div');
    detailsSection.className = 'rig-details-section';
    
    // Create header
    const detailsTitle = document.createElement('h3');
    detailsTitle.textContent = 'Rig Details';
    detailsTitle.className = 'rig-details-title';
    detailsSection.appendChild(detailsTitle);
    
    // Create content container for details (always visible)
    const detailsContent = document.createElement('div');
    detailsSection.appendChild(detailsContent);
    
    // Helper function to create a section with items
    const createSection = (title, items) => {
        const section = document.createElement('div');
        section.className = 'rig-section';
        
        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = title;
        sectionTitle.className = 'rig-section-title';
        section.appendChild(sectionTitle);
        
        if (!items || items.length === 0) {
            const noItems = document.createElement('p');
            noItems.textContent = 'None found';
            noItems.className = 'rig-no-items';
            section.appendChild(noItems);
        } else {
            items.forEach(item => {
                const itemElem = document.createElement('div');
                itemElem.className = 'rig-item';
                
                // Create name element
                const nameElem = document.createElement('div');
                nameElem.textContent = `Name: ${item.name}`;
                nameElem.className = 'rig-item-name';
                if (!(item.count > 1)) {
                    nameElem.style.paddingRight = '0';
                }
                itemElem.appendChild(nameElem);
                
                // Add count as a separate styled element if more than one
                if (item.count > 1) {
                    const countElem = document.createElement('div');
                    countElem.textContent = `x${item.count}`;
                    countElem.className = 'rig-item-count';
                    itemElem.appendChild(countElem);
                }
                
                // Add position info if available
                if (item.position) {
                    const posElem = document.createElement('div');
                    posElem.className = 'rig-item-position';
                    posElem.textContent = `Pos: [${item.position.map(p => 
                        typeof p === 'number' ? p.toFixed(2) : 'undefined').join(', ')}]`;
                    itemElem.appendChild(posElem);
                }
                
                // Add type info if available
                if (item.type) {
                    const typeElem = document.createElement('div');
                    typeElem.className = 'rig-item-type';
                    typeElem.textContent = `Type: ${item.type}`;
                    itemElem.appendChild(typeElem);
                }
                
                // Special handling for Joints section
                if (title === 'Joints') {
                    if (item.isRoot) {
                        const rootElem = document.createElement('div');
                        rootElem.className = 'rig-root-joint';
                        rootElem.textContent = 'Root Joint';
                        itemElem.appendChild(rootElem);
                    }
                    
                    if (item.parentBone) {
                        const parentElem = document.createElement('div');
                        parentElem.className = 'rig-parent-bone';
                        parentElem.textContent = `Parent: ${item.parentBone}`;
                        itemElem.appendChild(parentElem);
                    }
                    
                    if (item.childBone) {
                        const childElem = document.createElement('div');
                        childElem.className = 'rig-child-bone';
                        childElem.textContent = `Child: ${item.childBone}`;
                        itemElem.appendChild(childElem);
                    }
                    
                    // Add joint type dropdown
                    const jointTypeContainer = document.createElement('div');
                    jointTypeContainer.className = 'rig-joint-type-container';
                    
                    const jointTypeLabel = document.createElement('label');
                    jointTypeLabel.className = 'rig-joint-type-label';
                    jointTypeLabel.textContent = 'Joint Type:';
                    
                    const jointTypeSelect = document.createElement('select');
                    jointTypeSelect.className = 'rig-joint-type-select';
                    jointTypeSelect.setAttribute('data-joint-type', 'true');
                    jointTypeSelect.setAttribute('data-joint-name', item.name);
                    
                    // For now, only one option
                    const sphericalOption = document.createElement('option');
                    sphericalOption.value = 'spherical';
                    sphericalOption.textContent = 'Spherical';
                    jointTypeSelect.appendChild(sphericalOption);
                    
                    const fixedOption = document.createElement('option');
                    fixedOption.value = 'fixed';
                    fixedOption.textContent = 'Fixed';
                    jointTypeSelect.appendChild(fixedOption);
                    
                    if (!item.jointType) {
                        item.jointType = 'spherical'; // Default joint type
                    }
                    
                    // Set the select value
                    jointTypeSelect.value = item.jointType;
                    
                    // Store initial value in the global map (single source of truth)
                    jointPreviousValues.set(item.name, item.jointType);
                    
                    // Add event listener to update jointType when changed
                    jointTypeSelect.addEventListener('change', () => {
                        // Update the joint type in the item data
                        item.jointType = jointTypeSelect.value;
                        
                        // Log with updated format if debug is enabled
                        if (jointSettingsDebug) {
                            console.log(`Joint Setting ${item.name} changed to "${jointTypeSelect.value}"`);
                        }
                        
                        // Evaluate overall state instead of individual comparison
                        updateJointSettingsState();
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
                        boneElem.className = 'rig-associated-bone';
                        boneElem.textContent = `Controls bone: ${associatedBone.name}`;
                        itemElem.appendChild(boneElem);
                    }
                    
                    // Add info for furthest bone control
                    const state = getState();
                    if (state.model && furthestBoneHandle && furthestBoneHandle.userData.controlledBone) {
                        const controlElem = document.createElement('div');
                        controlElem.className = 'rig-connected-bone';
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
                        lockContainer.className = 'rig-lock-container';
                        
                        const lockLabel = document.createElement('label');
                        lockLabel.className = 'rig-lock-label';
                        lockLabel.textContent = 'Lock Rotation:';
                        
                        const lockCheckbox = document.createElement('input');
                        lockCheckbox.type = 'checkbox';
                        lockCheckbox.className = 'rig-lock-checkbox';
                        
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
            
            // Add Apply Changes button at the bottom of the Joints section
            if (title === 'Joints' && items.length > 0) {
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'rig-apply-button-container';
                
                const applyButton = document.createElement('button');
                applyButton.id = 'apply-joint-changes-button';
                applyButton.textContent = 'Apply Changes';
                applyButton.className = 'rig-apply-button';
                
                // Disable the button by default
                disableApplyButton(applyButton);
                
                applyButton.addEventListener('click', () => {
                    handleApplyChanges(applyButton);
                });
                
                buttonContainer.appendChild(applyButton);
                section.appendChild(buttonContainer);
            }
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
    
    container.appendChild(detailsSection);
}

/**
 * Handle the Apply Changes button click
 * @param {HTMLElement} button - The Apply Changes button element
 */
function handleApplyChanges(button) {
    // Update previous values for all joint type dropdowns
    const jointTypeSelects = document.querySelectorAll('select[data-joint-type]');
    
    jointTypeSelects.forEach(select => {
        const jointName = select.getAttribute('data-joint-name');
        // Update the previous value in the global map
        jointPreviousValues.set(jointName, select.value);
    });
    
    // Update overall state
    updateJointSettingsState();
    
    // Disable the button
    disableApplyButton(button);
}

/**
 * Disable the Apply Changes button
 * @param {HTMLElement} button - The button to disable
 */
function disableApplyButton(button) {
    button.disabled = true;
    button.style.backgroundColor = 'rgba(0,0,0,0.2)';
    button.style.color = '#ccc';
    button.style.cursor = 'not-allowed';
    button.style.opacity = '0.5';
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
 * Update the rig panel with the latest model information
 */
function updateRigPanel() {
    console.log('updateRigPanel called');
    const state = getState();
    console.log('State in updateRigPanel:', state);
    console.log('model in state:', state.model);
    console.log('Rig options on panel init:', JSON.stringify(rigOptions));
    
    const rigContent = document.getElementById('rig-content');
    
    if (!rigContent) {
        console.error('No rig-content element found');
        return;
    }
    
    // Clear any existing analysis if we're explicitly updating
    if (rigDetails) {
        console.log('Clearing existing rig details for fresh analysis');
        updateRigDetails(null);
    }
    
    // If we don't have rig details yet, try to analyze the model
    if (!rigDetails && state.model) {
        console.log('Analyzing model:', state.model);
        
        try {
            // Create a proper GLTF-like structure that analyzeGltfModel expects
            const gltfData = { scene: state.model };
            console.log('Created GLTF-like object for analysis:', gltfData);
            
            // Analyze the model to extract rig information using the imported function
            const newRigDetails = analyzeGltfModel(gltfData);
            console.log('Rig analysis complete, results:', newRigDetails);
            
            // Update the rig details using the exported function
            updateRigDetails(newRigDetails);
            
            // Create the rig visualization if we have bones
            if (rigDetails && rigDetails.bones && rigDetails.bones.length > 0) {
                console.log('Creating rig visualization with', rigDetails.bones.length, 'bones');
                console.log('Force Z setting before creating rig:', rigOptions.forceZ);
                createRigVisualization(state.model, state.scene);
                console.log('Rig visualization created, Force Z is now:', rigOptions.forceZ);
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
 * Refresh the joints data based on current bone visualizations
 */
export function refreshJointsData() {
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
 * Update the state of allJointsInPreviousState based on current joint type select values
 */
function updateJointSettingsState() {
    const jointTypeSelects = document.querySelectorAll('select[data-joint-type]');
    allJointsInPreviousState = true;
    
    jointTypeSelects.forEach(select => {
        const jointName = select.getAttribute('data-joint-name');
        const previousValue = jointPreviousValues.get(jointName);
        const currentValue = select.value;
        
        if (previousValue !== currentValue) {
            allJointsInPreviousState = false;
        }
    });
    
    if (jointSettingsDebug) {
        console.log(`All Joint Types in previous state: ${allJointsInPreviousState}`);
    }
    
    // Control Apply Changes button state based on allJointsInPreviousState
    const applyButton = document.getElementById('apply-joint-changes-button');
    if (applyButton) {
        if (allJointsInPreviousState) {
            disableApplyButton(applyButton);
        } else {
            enableApplyButton(applyButton);
        }
    }
    
    return allJointsInPreviousState;
}

/**
 * Enable the Apply Changes button
 * @param {HTMLElement} button - The button to enable
 */
function enableApplyButton(button) {
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

// Global event listener for rig options changes
document.addEventListener('rigOptionsChange', function(e) {
    console.log('Rig options change event received:', e.detail);
    
    // Update rig options
    if (e.detail) {
        if (e.detail.displayRig !== undefined) {
            rigOptions.displayRig = e.detail.displayRig;
            
            // Sync with rig tab checkbox
            const rigTabCheckbox = document.getElementById('display-rig-tab');
            if (rigTabCheckbox && rigTabCheckbox.checked !== e.detail.displayRig) {
                rigTabCheckbox.checked = e.detail.displayRig;
            }
        }
        
        if (e.detail.forceZ !== undefined) {
            rigOptions.forceZ = e.detail.forceZ;
            
            // Sync with rig tab checkbox
            const rigTabCheckbox = document.getElementById('force-z-tab');
            if (rigTabCheckbox && rigTabCheckbox.checked !== e.detail.forceZ) {
                rigTabCheckbox.checked = e.detail.forceZ;
            }
        }
        
        if (e.detail.wireframe !== undefined) rigOptions.wireframe = e.detail.wireframe;
        if (e.detail.primaryColor !== undefined) rigOptions.primaryColor = e.detail.primaryColor;
        if (e.detail.secondaryColor !== undefined) rigOptions.secondaryColor = e.detail.secondaryColor;
        if (e.detail.jointColor !== undefined) rigOptions.jointColor = e.detail.jointColor;
        if (e.detail.showJointLabels !== undefined) rigOptions.showJointLabels = e.detail.showJointLabels;
        
        // Update control handle colors
        if (e.detail.normalColor !== undefined) rigOptions.normalColor = e.detail.normalColor;
        if (e.detail.hoverColor !== undefined) rigOptions.hoverColor = e.detail.hoverColor;
        if (e.detail.activeColor !== undefined) rigOptions.activeColor = e.detail.activeColor;
        
        // Apply the changes
        updateRigVisualization();
    }
});

// Event listener for reset rig button
document.addEventListener('resetRig', function() {
    console.log('Reset rig event received');
    resetRig();
});

/**
 * Save a specific rig option to localStorage
 * @param {string} optionName - The name of the rig option to save
 * @param {any} value - The value to save
 */
function saveRigOptionToLocalStorage(optionName, value) {
    // Load current settings from localStorage
    const currentSettings = loadSettings() || {};
    
    // Initialize rigOptions if it doesn't exist
    if (!currentSettings.rigOptions) {
        currentSettings.rigOptions = {};
    }
    
    // Update the specific option
    currentSettings.rigOptions[optionName] = value;
    
    // Save updated settings back to localStorage
    console.log(`Saving ${optionName}=${value} to localStorage`);
    saveSettings(currentSettings);
}

// Export functions needed by other modules
export {
    updateRigPanel,
    rigOptions,
    createRigDetailsContent
};