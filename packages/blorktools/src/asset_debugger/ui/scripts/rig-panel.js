/**
 * Asset Debugger - Rig Panel
 * 
 * This module provides rig visualization and control functionality for the Asset Debugger.
 * It implements the same bone/rig/control parsing as the Rig Debugger.
 */
import * as THREE from 'three';
import { getState } from '../../core/state.js';
import { 
    analyzeGltfModel, 
    deduplicateItems, 
    createRig, 
    createBoneMesh, 
    createBoneUpdateFunction, 
    addControlHandleToFurthestBone,
    parseJointConstraints,
    applyJointConstraints
} from '../../core/rig/rig-factory.js';
import { setIsDragging, getIsDragging, checkHandleHover } from '../../core/drag-util.js';
import { 
    rigDetails,
    updateRigDetails,
    rigOptions,
    updateRigVisualization,
    resetRig
 } from '../../core/rig/rig-manager.js';
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
 } from '../../core/bone-util.js';
 import { saveSettings, loadSettings } from '../../data/localstorage-util.js';

// Tooltip related variables
let tooltipElement = null;
let tooltipTimers = new Map();
const TOOLTIP_DELAY = 1500; // 1.5 seconds delay

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

// Track the currently hovered element
let hoveredElement = null;

/**
 * Initialize tooltip element
 */
function initTooltip() {
    // Create tooltip if it doesn't exist
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'text-tooltip';
        document.body.appendChild(tooltipElement);
        
        // Add mouse events to the tooltip itself
        tooltipElement.addEventListener('mouseenter', () => {
            tooltipElement.classList.add('mouse-over');
        });
        
        tooltipElement.addEventListener('mouseleave', (event) => {
            tooltipElement.classList.remove('mouse-over');
            
            // Get the element the mouse is moving to
            const relatedTarget = event.relatedTarget;
            
            // Only keep tooltip visible if moving directly back to the original element
            if (hoveredElement && relatedTarget === hoveredElement) {
                return;
            }
            
            // Otherwise, hide the tooltip and clear reference
            hideTooltip();
            hoveredElement = null;
        });
    }
}

/**
 * Check if element's text is truncated (ellipsis applied)
 * @param {HTMLElement} element - Element to check for truncation
 * @returns {boolean} - True if text is truncated
 */
function isTextTruncated(element) {
    // Basic truncation check - scrollWidth > clientWidth
    const basicTruncation = element.scrollWidth > element.clientWidth;
    
    // If we're dealing with a rig-item-name, perform additional checks
    if (element.classList.contains('rig-item-name')) {
        const item = element.closest('.rig-item');
        if (item) {
            // Check if we have a count element
            const countElement = item.querySelector('.rig-item-count');
            if (countElement) {
                // Get positions
                const nameRect = element.getBoundingClientRect();
                const countRect = countElement.getBoundingClientRect();
                
                // Check if natural text width would overlap with count
                // We'll consider it potentially truncated if the name without truncation
                // would extend into the count element's space
                const textWidth = element.scrollWidth;
                const availableWidth = countRect.left - nameRect.left - 5; // 5px buffer
                
                return textWidth > availableWidth;
            }
        }
    }
    
    return basicTruncation;
}

/**
 * Setup tooltip behavior for an element that might have truncated text
 * @param {HTMLElement} element - Element to add tooltip functionality to
 */
function setupTruncationTooltip(element) {
    // Skip if already processed
    if (element.dataset.tooltipProcessed) return;
    
    // Set flag to avoid reprocessing
    element.dataset.tooltipProcessed = 'true';
    
    // Check if text is actually truncated
    if (isTextTruncated(element)) {
        element.classList.add('is-truncated');
        
        // Add mouse events
        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);
        // Remove mousemove event - we don't want tooltip to follow cursor
    }
}

/**
 * Handle mouse enter event
 * @param {MouseEvent} event - Mouse enter event
 */
function handleMouseEnter(event) {
    const element = event.target;
    const elementId = element.dataset.tooltipId || element.id || Math.random().toString(36).substring(2, 9);
    
    // Store reference to currently hovered element
    hoveredElement = element;
    
    // Store ID for future reference
    element.dataset.tooltipId = elementId;
    
    // Clear any existing timer for this element
    if (tooltipTimers.has(elementId)) {
        clearTimeout(tooltipTimers.get(elementId));
    }
    
    // Start new timer
    const timer = setTimeout(() => {
        showTooltip(element);
    }, TOOLTIP_DELAY);
    
    tooltipTimers.set(elementId, timer);
}

/**
 * Handle mouse leave event
 * @param {MouseEvent} event - Mouse leave event
 */
function handleMouseLeave(event) {
    const element = event.target;
    const elementId = element.dataset.tooltipId;
    
    // Get the element the mouse is moving to
    const relatedTarget = event.relatedTarget;
    
    // Don't hide if moving to the tooltip
    if (relatedTarget === tooltipElement) {
        return;
    }
    
    // Clear reference to hovered element if not moving to tooltip
    hoveredElement = null;
    
    // Clear timer
    if (elementId && tooltipTimers.has(elementId)) {
        clearTimeout(tooltipTimers.get(elementId));
        tooltipTimers.delete(elementId);
    }
    
    // Hide tooltip unless mouse is over it
    if (!tooltipElement || !tooltipElement.classList.contains('mouse-over')) {
        hideTooltip();
    }
}

/**
 * Show tooltip for element
 * @param {HTMLElement} element - Element to show tooltip for
 */
function showTooltip(element) {
    initTooltip();
    
    // Use the raw name from data attribute if available, otherwise use the full text
    const tooltipContent = element.dataset.rawName || element.textContent;
    
    // Set tooltip content
    tooltipElement.textContent = tooltipContent;
    
    // Make tooltip visible
    tooltipElement.classList.add('visible');
    
    // Position tooltip directly above the element with overlap
    positionTooltipWithOverlap(element);
}

/**
 * Position tooltip with slight overlap to prevent gaps
 * @param {HTMLElement} element - Element to position tooltip relative to
 */
function positionTooltipWithOverlap(element) {
    const elementRect = element.getBoundingClientRect();
    const margin = 5; // smaller margin
    
    // Reset any previous positioning to get proper dimensions
    tooltipElement.style.left = '0px';
    tooltipElement.style.top = '0px';
    tooltipElement.style.maxWidth = '300px';
    
    // Get tooltip dimensions after setting content
    const tooltipRect = tooltipElement.getBoundingClientRect();
    
    // Calculate position above the element with slight overlap
    let tooltipX = elementRect.left;
    let tooltipY = elementRect.top - tooltipRect.height + 2; // 2px overlap
    
    // If tooltip would be above viewport, position it below element instead
    if (tooltipY < margin) {
        tooltipY = elementRect.bottom - 2; // 2px overlap at bottom
    }
    
    // If tooltip is wider than element, center it
    if (tooltipRect.width > elementRect.width) {
        tooltipX = elementRect.left - ((tooltipRect.width - elementRect.width) / 2);
    }
    
    // Keep tooltip within viewport
    if (tooltipX < margin) tooltipX = margin;
    if (tooltipX + tooltipRect.width > window.innerWidth - margin) {
        // Align right edge with viewport or constrain width
        if (tooltipRect.width > window.innerWidth - (margin * 2)) {
            // If tooltip is too wide, constrain it
            tooltipElement.style.maxWidth = (window.innerWidth - (margin * 2)) + 'px';
            tooltipX = margin;
        } else {
            tooltipX = window.innerWidth - tooltipRect.width - margin;
        }
    }
    
    tooltipElement.style.left = `${tooltipX}px`;
    tooltipElement.style.top = `${tooltipY}px`;
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.classList.remove('visible');
        tooltipElement.classList.remove('mouse-over');
    }
}

/**
 * Process all elements in a container that might have truncated text
 * @param {HTMLElement} container - Container to search for truncatable elements
 */
function setupTruncationTooltips(container) {
    if (!container) return;
    
    // Find all elements that might have truncated text
    const truncatableElements = container.querySelectorAll('.rig-item-name, .rig-parent-bone, .rig-child-bone, .rig-associated-bone, .rig-connected-bone');
    truncatableElements.forEach(setupTruncationTooltip);
    
    // Log summary of truncated elements for debugging
    const truncatedCount = container.querySelectorAll('.is-truncated').length;
    if (truncatedCount > 0) {
        console.log(`Found ${truncatedCount} truncated elements with tooltips enabled`);
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
                // Store raw name in data attribute for tooltip
                nameElem.dataset.rawName = item.name;
                nameElem.className = 'rig-item-name';
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
                
                // Display constraint type if available
                if (item.constraintType) {
                    const constraintElem = document.createElement('div');
                    constraintElem.className = 'rig-constraint-type';
                    constraintElem.textContent = `Constraint: ${item.constraintType}`;
                    itemElem.appendChild(constraintElem);
                }
                
                // Special handling for Bones section - ADD CONSTRAINT UI HERE
                if (title === 'Bones') {
                    const boneName = item.name;
                    const bone = findBoneByName(boneName);
                    
                    if (bone) {
                        // Add constraint type dropdown
                        const constraintContainer = document.createElement('div');
                        constraintContainer.className = 'rig-constraint-container';
                        
                        const constraintLabel = document.createElement('label');
                        constraintLabel.className = 'rig-constraint-label';
                        constraintLabel.textContent = 'Constraint:';
                        
                        const constraintSelect = document.createElement('select');
                        constraintSelect.className = 'rig-constraint-select';
                        constraintSelect.setAttribute('data-bone-constraint', 'true');
                        constraintSelect.setAttribute('data-bone-name', boneName);
                        
                        // Add all available constraint types
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
                        
                        // Determine initial constraint type
                        let initialConstraintType = 'NONE';
                        
                        // Check if bone has constraints in userData
                        if (bone.userData && bone.userData.constraints) {
                            // Map internal constraint types to UI constraint types
                            const constraintTypeMap = {
                                'none': 'NONE',
                                'fixed': 'FIXED_POSITION',
                                'hinge': 'SINGLE_AXIS_ROTATION',
                                'limitRotation': 'LIMIT_ROTATION_XYZ',
                                'spring': 'DYNAMIC_SPRING'
                            };
                            initialConstraintType = constraintTypeMap[bone.userData.constraints.type] || 'NONE';
                        } 
                        // Check if there's a constraint in rigDetails.constraints
                        else if (details.constraints) {
                            const existingConstraint = details.constraints.find(c => 
                                c.boneName === boneName || c.nodeName === boneName);
                            if (existingConstraint) {
                                // Map internal constraint types to UI constraint types
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
                        
                        // Store constraint data in the bone item for use in UI
                        item.constraintType = initialConstraintType;
                        
                        // Copy constraint data from bone if available
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
                    
                    // Set the select value
                        constraintSelect.value = initialConstraintType;
                    
                    // Store initial value in the global map (single source of truth)
                        jointPreviousValues.set(boneName, initialConstraintType);
                        
                        // Add event listener to update constraintType when changed
                        constraintSelect.addEventListener('change', () => {
                            // Update the constraint type in the item data
                            item.constraintType = constraintSelect.value;
                        
                        // Log with updated format if debug is enabled
                        if (jointSettingsDebug) {
                                console.log(`Bone constraint ${boneName} changed to "${constraintSelect.value}"`);
                            }
                            
                            // Remove any existing constraint-specific controls
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
                            
                            // Add appropriate controls based on selected constraint type
                            if (constraintSelect.value === 'SINGLE_AXIS_ROTATION') {
                                addHingeAxisSelector(itemElem, item);
                            } else if (constraintSelect.value === 'LIMIT_ROTATION_XYZ') {
                                addRotationLimitControls(itemElem, item);
                            } else if (constraintSelect.value === 'DYNAMIC_SPRING') {
                                addSpringControls(itemElem, item);
                            }
                            
                            // Evaluate overall state to enable/disable Apply button
                            updateConstraintSettingsState();
                        });
                        
                        constraintContainer.appendChild(constraintLabel);
                        constraintContainer.appendChild(constraintSelect);
                        itemElem.appendChild(constraintContainer);
                        
                        // Add constraint-specific controls based on initial constraint type
                        if (initialConstraintType === 'SINGLE_AXIS_ROTATION') {
                            addHingeAxisSelector(itemElem, item);
                        } else if (initialConstraintType === 'LIMIT_ROTATION_XYZ') {
                            addRotationLimitControls(itemElem, item);
                        } else if (initialConstraintType === 'DYNAMIC_SPRING') {
                            addSpringControls(itemElem, item);
                        }
                        
                        // Add Lock Rotation checkbox
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
                
                // Special handling for Joints section - NOW SIMPLER, JUST DISPLAY RELATIONSHIPS
                if (title === 'Joints') {
                    if (item.isRoot) {
                        const rootElem = document.createElement('div');
                        rootElem.className = 'rig-root-joint';
                        rootElem.textContent = 'Root Joint';
                        itemElem.appendChild(rootElem);
                    }
                    
                    if (item.parentBone) {
                        const parentElem = document.createElement('div');
                        parentElem.textContent = `Parent: ${item.parentBone}`;
                        // Store raw parent bone name
                        parentElem.dataset.rawName = item.parentBone;
                        parentElem.className = 'rig-parent-bone';
                        itemElem.appendChild(parentElem);
                    }
                    
                    if (item.childBone) {
                        const childElem = document.createElement('div');
                        childElem.textContent = `Child: ${item.childBone}`;
                        // Store raw child bone name
                        childElem.dataset.rawName = item.childBone;
                        childElem.className = 'rig-child-bone';
                        itemElem.appendChild(childElem);
                    }
                }
                
                // Add bone associations for control points
                if (title === 'Controls/Handles') {
                    const associatedBone = findAssociatedBone(item.name, details.bones);
                    if (associatedBone) {
                        const boneElem = document.createElement('div');
                        boneElem.textContent = `Controls bone: ${associatedBone.name}`;
                        // Store raw associated bone name
                        boneElem.dataset.rawName = associatedBone.name;
                        boneElem.className = 'rig-associated-bone';
                        itemElem.appendChild(boneElem);
                    }
                    
                    // Add info for furthest bone control
                    const state = getState();
                    if (state.model && furthestBoneHandle && furthestBoneHandle.userData.controlledBone) {
                        const controlElem = document.createElement('div');
                        controlElem.textContent = `Connected: ${furthestBoneHandle.userData.controlledBone.name}`;
                        // Store raw controlled bone name
                        controlElem.dataset.rawName = furthestBoneHandle.userData.controlledBone.name;
                        controlElem.className = 'rig-connected-bone';
                        itemElem.appendChild(controlElem);
                    }
                }
                
                section.appendChild(itemElem);
            });
            
            // Add Constraints section if we have constraints data
            if (title === 'Joints' && details.constraints && details.constraints.length > 0) {
                const constraintsSummary = document.createElement('div');
                constraintsSummary.className = 'rig-constraints-summary';
                
                const summaryTitle = document.createElement('h5');
                summaryTitle.textContent = 'Detected Constraints';
                summaryTitle.className = 'rig-summary-title';
                constraintsSummary.appendChild(summaryTitle);
                
                // Group constraints by type
                const constraintsByType = {};
                details.constraints.forEach(constraint => {
                    if (!constraintsByType[constraint.type]) {
                        constraintsByType[constraint.type] = [];
                    }
                    constraintsByType[constraint.type].push(constraint.boneName || constraint.nodeName);
                });
                
                // Display each type
                Object.keys(constraintsByType).forEach(type => {
                    const typeElem = document.createElement('div');
                    typeElem.className = 'rig-constraint-group';
                    typeElem.innerHTML = `<strong>${type}</strong>: ${constraintsByType[type].join(', ')}`;
                    constraintsSummary.appendChild(typeElem);
                });
                
                section.appendChild(constraintsSummary);
            }
            
            // Add Apply Changes button at the bottom of the Bones section
            if (title === 'Bones' && items.length > 0) {
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'rig-apply-button-container';
                
                const applyButton = document.createElement('button');
                applyButton.id = 'apply-bone-constraints-button';
                applyButton.textContent = 'Apply Constraints';
                applyButton.className = 'rig-apply-button';
                
                // Disable the button by default
                disableApplyButton(applyButton);
                
                applyButton.addEventListener('click', () => {
                    handleApplyConstraints(applyButton);
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
    
    // After content is created, setup tooltip functionality
    setTimeout(() => {
        setupTruncationTooltips(container);
    }, 50); // Small delay to ensure the DOM has been updated
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
 * Handle the Apply Constraints button click
 * @param {HTMLElement} button - The Apply Constraints button element
 */
function handleApplyConstraints(button) {
    console.log('Applying bone constraint changes...');
    
    // Get all bone constraint selections
    const constraintSelects = document.querySelectorAll('select[data-bone-constraint]');
    
    // Store current bone world positions and rotations before applying constraints
    const boneCurrentState = new Map();
    
    bones.forEach(bone => {
        if (bone) {
            // Get current world position and rotation
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
    
    constraintSelects.forEach(select => {
        const boneName = select.getAttribute('data-bone-name');
        const constraintType = select.value;
        
        console.log(`Processing bone ${boneName}, constraint type: ${constraintType}`);
        
        // Find the corresponding bone
        const bone = findBoneByName(boneName);
        
        if (bone) {
            // Create constraint object based on constraint type
            let constraint = null;
            
            // Find the item data that contains the constraint settings
            let item = null;
            if (rigDetails && rigDetails.bones) {
                item = rigDetails.bones.find(b => b.name === boneName);
            }
            
            // Get current state of this bone (if available)
            const currentState = boneCurrentState.get(boneName);
            
            switch (constraintType) {
                case 'FIXED_POSITION':
                    constraint = {
                        type: 'fixed',
                        // Store current position and rotation if available
                        preservePosition: currentState ? true : false
                    };
                    break;
                    
                case 'SINGLE_AXIS_ROTATION':
                    constraint = {
                        type: 'hinge',
                        axis: item?.hingeAxis || 'y',
                        min: item?.hingeMin || -Math.PI/2,
                        max: item?.hingeMax || Math.PI/2,
                        preservePosition: currentState ? true : false
                    };
                    
                    // Save current hinge parameters
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
                    break;
                    
                case 'LIMIT_ROTATION_XYZ':
                    constraint = {
                        type: 'limitRotation',
                        limits: item?.rotationLimits || {
                            x: { min: -Math.PI/4, max: Math.PI/4 },
                            y: { min: -Math.PI/4, max: Math.PI/4 },
                            z: { min: -Math.PI/4, max: Math.PI/4 }
                        },
                        preservePosition: currentState ? true : false
                    };
                    
                    // Save current rotation limits
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
                    break;
                    
                case 'DYNAMIC_SPRING':
                    constraint = {
                        type: 'spring',
                        stiffness: item?.spring?.stiffness || 50,
                        damping: item?.spring?.damping || 5,
                        gravity: item?.spring?.gravity || 1.0,
                        preservePosition: currentState ? true : false
                    };
                    
                    // Save current spring parameters
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
                    break;
                    
                case 'NONE':
                default:
                    constraint = {
                        type: 'none',
                        preservePosition: currentState ? true : false
                    };
                    break;
            }
            
            // Apply the constraint
            if (constraint) {
                console.log(`Applying ${constraint.type} constraint to ${boneName}`);
                
                // Add current state to the constraint if available
                if (currentState && constraint.preservePosition) {
                    constraint.currentPosition = currentState.position;
                    constraint.currentQuaternion = currentState.quaternion;
                }
                
                applyJointConstraints(bone, constraint);
                
                // Update constraints list if it exists
                if (rigDetails.constraints) {
                    // Check if this bone already has a constraint
                    const existingIndex = rigDetails.constraints.findIndex(c => 
                        c.boneName === boneName || c.nodeName === boneName);
                    
                    if (existingIndex >= 0) {
                        // Update existing constraint
                        rigDetails.constraints[existingIndex] = {
                            boneName: boneName,
                            type: constraint.type,
                            data: constraint
                        };
                    } else {
                        // Add new constraint
                        rigDetails.constraints.push({
                            boneName: boneName,
                            type: constraint.type,
                            data: constraint
                        });
                    }
                }
            }
        }
    });
    
    // After applying all constraints, make sure bone matrices are updated
    // but preserve positions based on the constraint settings
    updateAllBoneMatrices(true);
    
    // Update previous values for all constraint dropdowns
    constraintSelects.forEach(select => {
        const boneName = select.getAttribute('data-bone-name');
        // Update the previous value in the global map
        jointPreviousValues.set(boneName, select.value);
    });
    
    // Update overall state
    updateConstraintSettingsState();
    
    // Disable the button
    disableApplyButton(button);
    
    console.log('Bone constraints applied successfully');
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

/**
 * Refresh the joints data based on current bone visualizations
 */
export function refreshJointsData() {
    // Clear existing joints data
    if (rigDetails && rigDetails.joints) {
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
                        
                        // Create joint data (without constraint type)
                        const jointData = {
                            name: jointName,
                            parentBone: parentBone.name,
                            childBone: childBone.name,
                            position: [object.position.x, object.position.y, object.position.z],
                            count: 1
                        };
                        
                        rigDetails.joints.push(jointData);
                    } else if (object.userData.rootBone) {
                        // Root joint
                        const rootBone = object.userData.rootBone;
                        const jointName = `Root_Joint_${rootBone.name}`;
                        
                        // Create joint data (without constraint type)
                        const jointData = {
                            name: jointName,
                            parentBone: "Scene Root",
                            childBone: rootBone.name,
                            position: [object.position.x, object.position.y, object.position.z],
                            count: 1,
                            isRoot: true
                        };
                        
                        rigDetails.joints.push(jointData);
                    }
                }
            });
        }
        
        // Deduplicate the joints data
        rigDetails.joints = deduplicateItems(rigDetails.joints);
    }
}

/**
 * Update the state of all bone constraint settings
 */
function updateConstraintSettingsState() {
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

// Initialize tooltip when the module loads
document.addEventListener('DOMContentLoaded', () => {
    initTooltip();
    
    // Add document click handler to hide tooltips when clicking elsewhere
    document.addEventListener('click', (event) => {
        // If clicked element is not the hovered element or the tooltip
        if (hoveredElement && event.target !== hoveredElement && 
            event.target !== tooltipElement && 
            !hoveredElement.contains(event.target) && 
            !tooltipElement.contains(event.target)) {
            
            // Hide tooltip and clear hover state
            hideTooltip();
            hoveredElement = null;
        }
    });
});

// Cleanup tooltips when page unloads
window.addEventListener('beforeunload', () => {
    // Clear all tooltip timers
    tooltipTimers.forEach(timerId => clearTimeout(timerId));
    tooltipTimers.clear();
    
    // Remove tooltip element if it exists
    if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
    }
});

// Export functions needed by other modules
export {
    updateRigPanel,
    rigOptions,
    createRigDetailsContent
};