/**
 * Asset Debugger - Rig Panel
 * 
 * This module provides rig visualization and control functionality for the Asset Debugger.
 * It implements the same bone/rig/control parsing as the Rig Debugger.
 */
import * as THREE from 'three';
import { 
    rigDetails,
    updateRigDetails,
    rigOptions,
    updateRigVisualization,
    resetRig
 } from '../../../util/rig/rig-controller.js';
import { createRig } from '../../../util/rig/rig-factory.js';
import { setIsDragging, getIsDragging, checkHandleHover } from '../../../util/rig/rig-mouse-handler.js';
import { bones, findAssociatedBone } from '../../../util/rig/bone-kinematics.js';
import { saveSettings, loadSettings } from '../../../util/data/localstorage-manager.js';
import { getState } from '../../../util/state/scene-state.js';
import { hideTooltip, setupTruncationTooltips } from '../../../util/rig/rig-tooltip-manager.js';
import { addBoneConstraintControls, disableApplyButton } from '../../../util/rig/rig-ui-factory.js';
import { handleApplyConstraints } from '../../../util/rig/rig-constraint-manager.js';
import { analyzeGltfModel } from '../../../util/data/glb-classifier.js';
import { primaryRigHandle } from '../../../util/rig/rig-handle-factory.js';



// Add global state tracking for joint settings
export let jointPreviousValues = new Map(); // Map of joint name to previous value

/**
 * Create a section with items for rig details
 * @param {string} title - Section title
 * @param {Array} items - Array of items to display
 * @param {Object} details - Rig details object for constraints
 * @returns {HTMLElement} Section element
 */
function createSection(title, items, details) {
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
            
            const nameElem = document.createElement('div');
            nameElem.textContent = `Name: ${item.name}`;
            nameElem.dataset.rawName = item.name;
            nameElem.className = 'rig-item-name';
            itemElem.appendChild(nameElem);
            
            if (item.count > 1) {
                const countElem = document.createElement('div');
                countElem.textContent = `x${item.count}`;
                countElem.className = 'rig-item-count';
                itemElem.appendChild(countElem);
            }
            
            if (item.position) {
                const posElem = document.createElement('div');
                posElem.className = 'rig-item-position';
                posElem.textContent = `Pos: [${item.position.map(p => 
                    typeof p === 'number' ? p.toFixed(2) : 'undefined').join(', ')}]`;
                itemElem.appendChild(posElem);
            }
            
            if (item.type) {
                const typeElem = document.createElement('div');
                typeElem.className = 'rig-item-type';
                typeElem.textContent = `Type: ${item.type}`;
                itemElem.appendChild(typeElem);
            }
            
            if (item.constraintType) {
                const constraintElem = document.createElement('div');
                constraintElem.className = 'rig-constraint-type';
                constraintElem.textContent = `Constraint: ${item.constraintType}`;
                itemElem.appendChild(constraintElem);
            }
            
            if (title === 'Bones') {
                addBoneConstraintControls(itemElem, item, details);
            }
            
            if (title === 'Joints') {
                addJointRelationships(itemElem, item);
            }
            
            if (title === 'Controls/Handles') {
                addControlBoneAssociations(itemElem, item, details);
            }
            
            section.appendChild(itemElem);
        });
        
        if (title === 'Joints' && details.constraints && details.constraints.length > 0) {
            addConstraintsSummary(section, details);
        }
        
        if (title === 'Bones' && items.length > 0) {
            addApplyConstraintsButton(section);
        }
    }
    
    return section;
}



/**
 * Add joint relationship information to a joint item element
 * @param {HTMLElement} itemElem - The joint item element
 * @param {Object} item - The joint item data
 */
function addJointRelationships(itemElem, item) {
    if (item.isRoot) {
        const rootElem = document.createElement('div');
        rootElem.className = 'rig-root-joint';
        rootElem.textContent = 'Root Joint';
        itemElem.appendChild(rootElem);
    }
    
    if (item.parentBone) {
        const parentElem = document.createElement('div');
        parentElem.textContent = `Parent: ${item.parentBone}`;
        parentElem.dataset.rawName = item.parentBone;
        parentElem.className = 'rig-parent-bone';
        itemElem.appendChild(parentElem);
    }
    
    if (item.childBone) {
        const childElem = document.createElement('div');
        childElem.textContent = `Child: ${item.childBone}`;
        childElem.dataset.rawName = item.childBone;
        childElem.className = 'rig-child-bone';
        itemElem.appendChild(childElem);
    }
}

/**
 * Add bone associations for control points
 * @param {HTMLElement} itemElem - The control item element
 * @param {Object} item - The control item data
 * @param {Object} details - Rig details object
 */
function addControlBoneAssociations(itemElem, item, details) {
    const associatedBone = findAssociatedBone(item.name, details.bones);
    if (associatedBone) {
        const boneElem = document.createElement('div');
        boneElem.textContent = `Controls bone: ${associatedBone.name}`;
        boneElem.dataset.rawName = associatedBone.name;
        boneElem.className = 'rig-associated-bone';
        itemElem.appendChild(boneElem);
    }
    
    const state = getState();
    if (state.model && primaryRigHandle && primaryRigHandle.userData.controlledBone) {
        const controlElem = document.createElement('div');
        controlElem.textContent = `Connected: ${primaryRigHandle.userData.controlledBone.name}`;
        controlElem.dataset.rawName = primaryRigHandle.userData.controlledBone.name;
        controlElem.className = 'rig-connected-bone';
        itemElem.appendChild(controlElem);
    }
}

/**
 * Add constraints summary to joints section
 * @param {HTMLElement} section - The section element to add summary to
 * @param {Object} details - Rig details object containing constraints
 */
function addConstraintsSummary(section, details) {
    const constraintsSummary = document.createElement('div');
    constraintsSummary.className = 'rig-constraints-summary';
    
    const summaryTitle = document.createElement('h5');
    summaryTitle.textContent = 'Detected Constraints';
    summaryTitle.className = 'rig-summary-title';
    constraintsSummary.appendChild(summaryTitle);
    
    const constraintsByType = {};
    details.constraints.forEach(constraint => {
        if (!constraintsByType[constraint.type]) {
            constraintsByType[constraint.type] = [];
        }
        constraintsByType[constraint.type].push(constraint.boneName || constraint.nodeName);
    });
    
    Object.keys(constraintsByType).forEach(type => {
        const typeElem = document.createElement('div');
        typeElem.className = 'rig-constraint-group';
        typeElem.innerHTML = `<strong>${type}</strong>: ${constraintsByType[type].join(', ')}`;
        constraintsSummary.appendChild(typeElem);
    });
    
    section.appendChild(constraintsSummary);
}

/**
 * Add Apply Constraints button to bones section
 * @param {HTMLElement} section - The section element to add button to
 */
function addApplyConstraintsButton(section) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'rig-apply-button-container';
    
    const applyButton = document.createElement('button');
    applyButton.id = 'apply-bone-constraints-button';
    applyButton.textContent = 'Apply Constraints';
    applyButton.className = 'rig-apply-button';
    
    disableApplyButton(applyButton);
    
    applyButton.addEventListener('click', () => {
        handleApplyConstraints(applyButton);
    });
    
    buttonContainer.appendChild(applyButton);
    section.appendChild(buttonContainer);
}

/**
 * Create the rig controls section with checkboxes and reset button
 * @returns {HTMLElement} Controls section element
 */
function createRigControlsSection() {
    const controlsSection = document.createElement('div');
    controlsSection.className = 'rig-controls-section';
    
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.className = 'rig-checkbox-wrapper';
    controlsSection.appendChild(checkboxWrapper);
    
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
        
        const settingsModalCheckbox = document.getElementById('display-rig');
        if (settingsModalCheckbox && settingsModalCheckbox.checked !== e.target.checked) {
            settingsModalCheckbox.checked = e.target.checked;
        }
        
        saveRigOptionToLocalStorage('displayRig', e.target.checked);
    });
    
    displayRigLabel.setAttribute('for', 'display-rig-tab');
    displayRigContainer.appendChild(displayRigLabel);
    displayRigContainer.appendChild(displayRigCheckbox);
    
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
        
        const settingsModalCheckbox = document.getElementById('force-z');
        if (settingsModalCheckbox && settingsModalCheckbox.checked !== e.target.checked) {
            settingsModalCheckbox.checked = e.target.checked;
        }
        
        saveRigOptionToLocalStorage('forceZ', e.target.checked);
    });
    
    forceZLabel.setAttribute('for', 'force-z-tab');
    forceZContainer.appendChild(forceZLabel);
    forceZContainer.appendChild(forceZCheckbox);
    
    checkboxWrapper.appendChild(displayRigContainer);
    checkboxWrapper.appendChild(forceZContainer);
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Physics';
    resetButton.className = 'rig-reset-button';
    
    resetButton.addEventListener('click', () => {
        resetRig();
    });
    
    controlsSection.appendChild(resetButton);
    
    return controlsSection;
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
    
    container.innerHTML = '';
    
    const controlsSection = createRigControlsSection();
    container.appendChild(controlsSection);
    
    const detailsSection = document.createElement('div');
    detailsSection.className = 'rig-details-section';
    
    const detailsTitle = document.createElement('h3');
    detailsTitle.textContent = 'Rig Details';
    detailsTitle.className = 'rig-details-title';
    detailsSection.appendChild(detailsTitle);
    
    const detailsContent = document.createElement('div');
    detailsSection.appendChild(detailsContent);
    
    detailsContent.appendChild(createSection('Bones', details.bones, details));
    
    const jointsData = details.joints || [];
    detailsContent.appendChild(createSection('Joints', jointsData, details));
    
    detailsContent.appendChild(createSection('Rigs', details.rigs, details));
    detailsContent.appendChild(createSection('Roots', details.roots, details));
    detailsContent.appendChild(createSection('Controls/Handles', details.controls, details));
    
    container.appendChild(detailsSection);
    
    setTimeout(() => {
        setupTruncationTooltips(container);
    }, 50);
}

/**
 * Update the rig panel with the latest model information
 */
export function updateRigPanel() {
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
                createRig(state.model, state.scene);
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
    
    // Process truncated text elements for tooltips
    setupTruncationTooltips(rigContent);
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
        
        // Special handling for joint labels
        if (e.detail.showJointLabels !== undefined) {
            console.log(`Updating showJointLabels from ${rigOptions.showJointLabels} to ${e.detail.showJointLabels}`);
            rigOptions.showJointLabels = e.detail.showJointLabels;
            
            // Update any checkbox in the UI
            const jointLabelsCheckbox = document.getElementById('show-joint-labels-tab');
            if (jointLabelsCheckbox && jointLabelsCheckbox.checked !== e.detail.showJointLabels) {
                jointLabelsCheckbox.checked = e.detail.showJointLabels;
            }
        }
        
        // Special handling for bone labels - handle from settings modal only
        if (e.detail.showBoneLabels !== undefined) {
            console.log(`Updating showBoneLabels from ${rigOptions.showBoneLabels} to ${e.detail.showBoneLabels}`);
            rigOptions.showBoneLabels = e.detail.showBoneLabels;
        }
        
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

// Cleanup tooltips when page unloads
window.addEventListener('beforeunload', () => {
    // Clear all tooltip timers if they exist
    if (typeof tooltipTimers !== 'undefined' && tooltipTimers) {
        tooltipTimers.forEach(timerId => clearTimeout(timerId));
        tooltipTimers.clear();
    }
    
    // Remove tooltip element if it exists
    if (typeof tooltipElement !== 'undefined' && tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
    }
});
