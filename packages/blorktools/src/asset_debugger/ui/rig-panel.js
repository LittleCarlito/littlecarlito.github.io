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
    boneVisualsGroup,
    findAssociatedBone,
    findBoneByName, 
    furthestBoneHandle,
    findFarthestBone,
    boneSideMaterial,
    boneMaterial,
    rigDetails,
    updateRigDetails,
    rigOptions,
    bones
 } from '../core/rig/rig-manager.js';

// Reusable objects for position and rotation operations
let worldPos = new THREE.Vector3();
let worldRot = new THREE.Quaternion();

// Map to track locked bones
let lockedBones = new Map(); // Maps bone.uuid to {bone, originalRotation}
let labelGroup = null;

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

// Add debug flag
let jointSettingsDebug = true;

// Add global state tracking for joint settings
let allJointsInPreviousState = true;
let jointPreviousValues = new Map(); // Map of joint name to previous value

// TODO Move to bone-util.js and a lot of rig manager stuff along with it.
/**
 * Restore locked bone rotations
 */
export function restoreLockedBoneRotations() {
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
export function moveBonesForTarget(targetBone, targetPosition) {
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
    labelGroup = new THREE.Group();
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
export function updateBoneVisuals() {
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
 * Refresh the joints data based on current bone visualizations
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
    let isHeaderDragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        isHeaderDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(axisContainer.style.left);
        startTop = parseInt(axisContainer.style.top);
        header.style.cursor = 'grabbing';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isHeaderDragging) return;
        
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
        if (isHeaderDragging) {
            isHeaderDragging = false;
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
                linewidth: 45,
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
                linewidth: 45,
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
        
        // Create a smaller center reference point (MAKE INVISIBLE)
        const embeddedCenterGeometry = new THREE.SphereGeometry(0.05 * axisScale, 16, 16);
        const embeddedCenterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0, // Set opacity to 0 to make it invisible
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
            active: true, // Mark as active
            intensity: 0.7 // Default intensity
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
                        // Use the stored intensity value
                        const intensity = state.embeddedAxisIndicator.intensity || 0.7;
                        obj.material.opacity = obj.material.originalOpacity * intensity;
                    }
                    if (obj.children) {
                        obj.children.forEach(child => applyBackgroundOpacity(child));
                    }
                };
                
                // Save original opacity values first time
                if (!state.embeddedAxisIndicator.opacitySaved) {
                    state.embeddedAxisIndicator.scene.traverse(obj => {
                        if (obj.material && obj.material.opacity !== undefined) {
                            obj.material.originalOpacity = obj.material.opacity;
                        }
                    });
                    state.embeddedAxisIndicator.opacitySaved = true;
                }
                
                // Apply transparency to all objects in embedded axis scene
                state.embeddedAxisIndicator.scene.traverse(applyBackgroundOpacity);
                
                // Special settings for background rendering
                renderer.autoClear = false;
                renderer.autoClearDepth = true;
                renderer.autoClearColor = false;
                renderer.autoClearStencil = false;
                
                // Render the axis scene first (as background)
                originalRender.call(this, embeddedAxisScene, embeddedAxisCamera);
                
                // Restore original material opacity
                const restoreOpacity = (obj) => {
                    if (obj.material && obj.material.originalOpacity !== undefined) {
                        obj.material.opacity = obj.material.originalOpacity;
                    }
                    if (obj.children) {
                        obj.children.forEach(child => restoreOpacity(child));
                    }
                };
                
                state.embeddedAxisIndicator.scene.traverse(restoreOpacity);
                
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

// Export functions needed by other modules
export {
    updateRigPanel,
    updateAllBoneMatrices,
    rigOptions,
    createRigDetailsContent,
    createAxisIndicator,
    createJointLabels
};