/**
 * Texture Debugger - Rig Panel Module
 * 
 * This module handles bone visualization and hierarchy.
 */
import * as THREE from 'three';
import { getState, updateState } from '../core/state.js';

// DOM Elements
let rigStatus = null;
let rigVisualizationControls = null;
let toggleRigButton = null;
let boneHierarchy = null;
let controlsContainer = null;

/**
 * Initialize the rig panel and cache DOM elements
 */
export function initRigPanel() {
    // Cache DOM elements
    rigStatus = document.getElementById('rig-status');
    rigVisualizationControls = document.getElementById('rig-visualization-controls');
    toggleRigButton = document.getElementById('toggle-rig-button');
    boneHierarchy = document.getElementById('bone-hierarchy');
    controlsContainer = document.getElementById('rig-controls-container');
    
    // Set up toggle button handler
    if (toggleRigButton) {
        toggleRigButton.onclick = () => toggleRigVisualization();
    }
    
    // Set up visualization controls
    setupVisualizationControls();
    
    // Initial update
    updateRigVisualization();
}

/**
 * Set up the visualization control checkboxes
 */
function setupVisualizationControls() {
    if (!controlsContainer) {
        controlsContainer = document.getElementById('rig-controls-container');
        if (!controlsContainer && rigVisualizationControls) {
            // Create controls container if it doesn't exist
            controlsContainer = document.createElement('div');
            controlsContainer.id = 'rig-controls-container';
            controlsContainer.style.marginTop = '10px';
            controlsContainer.style.padding = '8px';
            controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            controlsContainer.style.borderRadius = '4px';
            rigVisualizationControls.appendChild(controlsContainer);
        }
    }
    
    if (!controlsContainer) return;
    
    // Clear existing controls
    controlsContainer.innerHTML = '';
    
    // Add Z Override checkbox
    addControlCheckbox(
        'force-z-override', 
        'Force Z Override', 
        'Makes bone visualization appear on top of the model',
        (checked) => setZOverride(checked)
    );
    
    // Add Customize Visualizations checkbox and container for its options
    const customizeContainer = document.createElement('div');
    customizeContainer.style.display = 'flex';
    customizeContainer.style.alignItems = 'center';
    customizeContainer.style.marginBottom = '8px';
    
    const customizeCheckbox = document.createElement('input');
    customizeCheckbox.type = 'checkbox';
    customizeCheckbox.id = 'customize-visualizations';
    customizeCheckbox.style.marginRight = '5px';
    
    const customizeLabel = document.createElement('label');
    customizeLabel.htmlFor = 'customize-visualizations';
    customizeLabel.textContent = 'Customize Visualizations';
    customizeLabel.style.fontSize = '13px';
    customizeLabel.style.color = '#ddd';
    
    customizeContainer.appendChild(customizeCheckbox);
    customizeContainer.appendChild(customizeLabel);
    controlsContainer.appendChild(customizeContainer);
    
    // Create customization options (initially hidden)
    const customizeOptions = document.createElement('div');
    customizeOptions.id = 'customize-options';
    customizeOptions.style.marginLeft = '15px';
    customizeOptions.style.marginTop = '5px';
    customizeOptions.style.display = 'none';
    controlsContainer.appendChild(customizeOptions);
    
    // Add Fill Meshes checkbox to customization options
    const fillContainer = document.createElement('div');
    fillContainer.style.display = 'flex';
    fillContainer.style.alignItems = 'center';
    fillContainer.style.marginBottom = '8px';
    
    const fillCheckbox = document.createElement('input');
    fillCheckbox.type = 'checkbox';
    fillCheckbox.id = 'fill-visualization-meshes';
    fillCheckbox.style.marginRight = '5px';
    fillCheckbox.addEventListener('change', (e) => setFillMeshes(e.target.checked));
    
    const fillLabel = document.createElement('label');
    fillLabel.htmlFor = 'fill-visualization-meshes';
    fillLabel.textContent = 'Fill Visualization Meshes';
    fillLabel.style.fontSize = '13px';
    fillLabel.style.color = '#ddd';
    
    fillContainer.appendChild(fillCheckbox);
    fillContainer.appendChild(fillLabel);
    customizeOptions.appendChild(fillContainer);
    
    // Add Color Picker
    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'flex';
    colorContainer.style.alignItems = 'center';
    colorContainer.style.marginBottom = '8px';
    
    const colorLabel = document.createElement('label');
    colorLabel.htmlFor = 'visualization-color';
    colorLabel.textContent = 'Visualization Color: ';
    colorLabel.style.fontSize = '13px';
    colorLabel.style.color = '#ddd';
    colorLabel.style.marginRight = '5px';
    
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.id = 'visualization-color';
    colorPicker.value = '#ff0000'; // Default to red
    colorPicker.style.width = '30px';
    colorPicker.style.height = '15px';
    colorPicker.style.padding = '0';
    colorPicker.style.border = '1px solid #666';
    colorPicker.addEventListener('change', (e) => setVisualizationColor(e.target.value));
    
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorPicker);
    customizeOptions.appendChild(colorContainer);
    
    // Toggle display of customization options
    customizeCheckbox.addEventListener('change', (e) => {
        customizeOptions.style.display = e.target.checked ? 'block' : 'none';
    });
}

/**
 * Helper function to add a control checkbox
 * @param {string} id - The checkbox ID
 * @param {string} label - The checkbox label
 * @param {string} title - Tooltip text
 * @param {Function} onChange - Change handler function
 */
function addControlCheckbox(id, label, title, onChange) {
    if (!controlsContainer) return;
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.marginBottom = '8px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.style.marginRight = '5px';
    if (onChange) {
        checkbox.addEventListener('change', (e) => onChange(e.target.checked));
    }
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.style.fontSize = '13px';
    labelElement.style.color = '#ddd';
    if (title) {
        labelElement.title = title;
    }
    
    container.appendChild(checkbox);
    container.appendChild(labelElement);
    controlsContainer.appendChild(container);
    
    return checkbox;
}

/**
 * Update the rig visualization panel
 */
export function updateRigVisualization() {
    const state = getState();
    
    // Make sure DOM elements are available
    if (!rigStatus || !rigVisualizationControls || !boneHierarchy) {
        rigStatus = document.getElementById('rig-status');
        rigVisualizationControls = document.getElementById('rig-visualization-controls');
        toggleRigButton = document.getElementById('toggle-rig-button');
        boneHierarchy = document.getElementById('bone-hierarchy');
        
        // Exit if elements still not available
        if (!rigStatus || !rigVisualizationControls || !boneHierarchy) return;
    }
    
    // Setup visualization controls if needed
    if (!controlsContainer) {
        setupVisualizationControls();
    }
    
    // Exit if no model
    if (!state.model) {
        rigStatus.textContent = 'No model loaded.';
        rigVisualizationControls.style.display = 'none';
        return;
    }
    
    // Extract rig data from the model
    const rigData = extractRigData();
    
    if (rigData.bones.length === 0) {
        // No rig data available
        rigStatus.textContent = 'No rig data available in the model.';
        rigVisualizationControls.style.display = 'none';
        return;
    }
    
    // We have rig data, show controls
    rigStatus.textContent = `Rig found: ${rigData.bones.length} bones`;
    rigVisualizationControls.style.display = 'block';
    
    // Display bone hierarchy
    displayBoneHierarchy(rigData);
    
    // Set up toggle button if not already done
    if (toggleRigButton) {
        toggleRigButton.textContent = state.isBoneVisualizationVisible ? 
            'Hide Rig Visualization' : 'Show Rig Visualization';
    }
}

/**
 * Extract rig data from the model
 * @returns {Object} Object containing bones and skeleton
 */
function extractRigData() {
    const state = getState();
    const bones = [];
    let skeleton = null;
    
    // Find skeletons and bones
    if (state.model) {
        state.model.traverse(object => {
            // Find skeleton
            if (object.isSkinnedMesh && object.skeleton && !skeleton) {
                skeleton = object.skeleton;
                
                // Add all bones from the skeleton if available
                if (object.skeleton.bones && object.skeleton.bones.length > 0) {
                    bones.push(...object.skeleton.bones);
                }
            }
            
            // Collect bones (using multiple detection methods)
            if (object.isBone || 
                object.name.toLowerCase().includes('bone_') ||
                (object.userData && object.userData.type === 'bone')) {
                bones.push(object);
            }
        });
    }
    
    // Deduplicate bones by uuid
    const uniqueBones = {};
    bones.forEach(bone => {
        if (!uniqueBones[bone.uuid]) {
            uniqueBones[bone.uuid] = bone;
        }
    });
    
    // Convert back to array and update state
    const uniqueBoneArray = Object.values(uniqueBones);
    updateState('bones', uniqueBoneArray);
    updateState('skeleton', skeleton);
    
    return {
        bones: uniqueBoneArray,
        skeleton
    };
}

/**
 * Display bone hierarchy in the UI
 * @param {Object} rigData - Object containing bones and skeleton
 */
function displayBoneHierarchy(rigData) {
    // Clear existing content
    boneHierarchy.innerHTML = '';
    
    if (rigData.bones.length === 0) {
        boneHierarchy.innerHTML = '<p>No bones found in the model.</p>';
        return;
    }
    
    // Find root bones (bones with no parent or parent outside our bone list)
    const rootBones = rigData.bones.filter(bone => {
        return !bone.parent || !rigData.bones.includes(bone.parent);
    });
    
    // If no root bones found, just display all bones in a flat list
    if (rootBones.length === 0) {
        rigData.bones.forEach(bone => {
            const boneItem = document.createElement('div');
            boneItem.className = 'bone-item';
            boneItem.textContent = bone.name || 'Unnamed bone';
            boneHierarchy.appendChild(boneItem);
        });
        return;
    }
    
    // Build hierarchy for each root bone
    rootBones.forEach(rootBone => {
        const rootItem = createBoneItem(rootBone, rigData.bones);
        boneHierarchy.appendChild(rootItem);
    });
}

/**
 * Create a bone item with its children
 * @param {THREE.Bone} bone - The bone to create an item for
 * @param {Array} allBones - Array of all bones for filtering
 * @param {number} depth - Current depth in the hierarchy
 * @returns {HTMLElement} The created bone item element
 */
function createBoneItem(bone, allBones, depth = 0) {
    const boneItem = document.createElement('div');
    boneItem.className = 'bone-item';
    
    // Create toggle for expandable items
    const toggle = document.createElement('span');
    toggle.className = 'bone-toggle';
    
    // Find bone children that are in our list of bones
    const children = bone.children
        .filter(child => child.isBone && allBones.includes(child));
    
    toggle.innerHTML = children.length > 0 ? '&#9660; ' : '&#9642; ';
    
    // Create name element
    const nameSpan = document.createElement('span');
    nameSpan.textContent = bone.name || 'Unnamed bone';
    
    // Add to bone item
    boneItem.appendChild(toggle);
    boneItem.appendChild(nameSpan);
    
    // If bone has children, create a container for them
    if (children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'bone-children';
        childrenContainer.style.display = 'block'; // Start expanded
        
        // Create items for children
        children.forEach(childBone => {
            const childItem = createBoneItem(childBone, allBones, depth + 1);
            childrenContainer.appendChild(childItem);
        });
        
        // Add click handler to toggle
        toggle.style.cursor = 'pointer';
        toggle.onclick = () => {
            if (childrenContainer.style.display === 'none') {
                childrenContainer.style.display = 'block';
                toggle.innerHTML = '&#9660; ';
            } else {
                childrenContainer.style.display = 'none';
                toggle.innerHTML = '&#9654; ';
            }
        };
        
        // Add children container
        boneItem.appendChild(childrenContainer);
    }
    
    return boneItem;
}

/**
 * Toggle bone visualization
 */
export function toggleRigVisualization() {
    const state = getState();
    
    if (state.isBoneVisualizationVisible) {
        // Hide visualization
        if (state.boneVisualization) {
            state.boneVisualization.traverse(obj => {
                if (obj.visible !== undefined) {
                    obj.visible = false;
                }
            });
        }
        updateState('isBoneVisualizationVisible', false);
        
        if (toggleRigButton) {
            toggleRigButton.textContent = 'Show Rig Visualization';
        }
    } else {
        // Show or create visualization
        if (!state.boneVisualization) {
            createBoneVisualization();
        } else {
            state.boneVisualization.traverse(obj => {
                if (obj.visible !== undefined) {
                    obj.visible = true;
                }
            });
        }
        updateState('isBoneVisualizationVisible', true);
        
        if (toggleRigButton) {
            toggleRigButton.textContent = 'Hide Rig Visualization';
        }
        
        // Apply current visualization settings
        applyVisualizationSettings();
    }
}

/**
 * Apply current visualization settings from checkboxes
 */
function applyVisualizationSettings() {
    const zOverrideCheckbox = document.getElementById('force-z-override');
    const fillCheckbox = document.getElementById('fill-visualization-meshes');
    const colorPicker = document.getElementById('visualization-color');
    
    if (zOverrideCheckbox && zOverrideCheckbox.checked) {
        setZOverride(true);
    }
    
    if (fillCheckbox && fillCheckbox.checked) {
        setFillMeshes(true);
    }
    
    if (colorPicker) {
        setVisualizationColor(colorPicker.value);
    }
}

/**
 * Set visualization objects to render on top (Z-override)
 * @param {boolean} override - Whether to enable Z-override
 */
function setZOverride(override) {
    const state = getState();
    if (!state.boneVisualization) return;
    
    state.boneVisualization.traverse(object => {
        if (object.material) {
            if (override) {
                // Make object render on top by disabling depth test
                object.renderOrder = 999;
                object.material.depthTest = false;
            } else {
                // Reset to normal depth behavior
                object.renderOrder = 0;
                object.material.depthTest = true;
            }
        }
    });
}

/**
 * Toggle fill/wireframe mode for visualization meshes
 * @param {boolean} fill - Whether to use fill mode instead of wireframe
 */
function setFillMeshes(fill) {
    const state = getState();
    if (!state.boneVisualization) return;
    
    state.boneVisualization.traverse(object => {
        if (object.material) {
            object.material.wireframe = !fill;
        }
    });
}

/**
 * Set visualization color
 * @param {string} colorHex - Hex color string (e.g., '#ff0000')
 */
function setVisualizationColor(colorHex) {
    const state = getState();
    if (!state.boneVisualization) return;
    
    const color = new THREE.Color(colorHex);
    
    state.boneVisualization.traverse(object => {
        if (object.material) {
            object.material.color.copy(color);
        }
    });
}

/**
 * Create bone visualization
 */
function createBoneVisualization() {
    const state = getState();
    
    // Exit if no bones
    if (!state.bones || state.bones.length === 0) return;
    
    // Create a group to hold all bone visualizations
    const boneGroup = new THREE.Group();
    boneGroup.name = 'BoneVisualization';
    
    // Calculate a reasonable size for bone visualization
    let modelSize = 1;
    if (state.model) {
        const box = new THREE.Box3().setFromObject(state.model);
        modelSize = box.getSize(new THREE.Vector3()).length() / 100;
    }
    
    // Update all world matrices to ensure positions are correct
    if (state.model) {
        state.model.updateWorldMatrix(true, true);
    }
    
    // Create a visualization for each bone
    state.bones.forEach(bone => {
        // Create a bone representation
        createBoneVisual(bone, modelSize, boneGroup);
    });
    
    // Add the group to the scene
    if (state.scene) {
        state.scene.add(boneGroup);
    }
    
    // Update state
    updateState('boneVisualization', boneGroup);
    
    // Apply visualization settings
    applyVisualizationSettings();
}

/**
 * Create a visual representation of a bone
 * @param {THREE.Bone} bone - The bone to visualize
 * @param {number} baseSize - Base size for visualization
 * @param {THREE.Group} boneGroup - The parent group to add visualizations to
 */
function createBoneVisual(bone, baseSize, boneGroup) {
    if (!bone || !boneGroup) return;
    
    // Ensure the bone's world matrix is up to date
    bone.updateWorldMatrix(true, false);
    
    // Get bone's world position and world quaternion
    const boneWorldPosition = new THREE.Vector3();
    const boneWorldQuaternion = new THREE.Quaternion();
    const boneWorldScale = new THREE.Vector3();
    
    // Extract the bone's world transform components
    bone.matrixWorld.decompose(boneWorldPosition, boneWorldQuaternion, boneWorldScale);
    
    // Find the tail position (end of the bone)
    let tailWorldPosition = null;
    let hasChildBone = false;
    
    // Check if any children are bones to determine tail position
    if (bone.children && bone.children.length > 0) {
        // For simplicity, use the first bone child's position as the tail
        for (const child of bone.children) {
            if (child.isBone || 
                (child.name && child.name.toLowerCase().includes('bone_'))) {
                // Get world position of the child bone
                const childWorldPosition = new THREE.Vector3();
                child.updateWorldMatrix(true, false);
                child.getWorldPosition(childWorldPosition);
                
                tailWorldPosition = childWorldPosition;
                hasChildBone = true;
                break;
            }
        }
    }
    
    // If no bone children, estimate bone length based on model scale
    if (!hasChildBone) {
        // Default bone length
        const defaultLength = baseSize * 4;
        
        // Create direction based on bone's local transform
        const boneDirection = new THREE.Vector3(0, 1, 0);
        boneDirection.applyQuaternion(boneWorldQuaternion);
        boneDirection.normalize();
        
        // Create tail position at defaultLength distance in that direction
        tailWorldPosition = boneWorldPosition.clone().add(
            boneDirection.multiplyScalar(defaultLength)
        );
    }
    
    // Calculate bone direction and length
    const boneDirection = new THREE.Vector3().subVectors(tailWorldPosition, boneWorldPosition);
    const boneLength = boneDirection.length();
    boneDirection.normalize();
    
    // Create a cylinder geometry for the bone
    const boneGeometry = new THREE.CylinderGeometry(
        baseSize * 1.5,  // head radius (wider)
        baseSize * 0.5,  // tail radius (narrower)
        boneLength,      // bone length
        8,               // radial segments
        1,               // height segments
        false            // open ended
    );
    
    // Move it so that one end is at the origin, extending along positive Y
    boneGeometry.translate(0, boneLength/2, 0);
    
    // Create wireframe material for the bone
    const boneMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.8,
        depthTest: true,
        depthWrite: true
    });
    
    // Create the bone mesh
    const boneMesh = new THREE.Mesh(boneGeometry, boneMaterial);
    boneMesh.name = `bone_visual_${bone.name || 'unnamed'}`;
    boneMesh.userData.boneRef = bone;
    
    // Position the bone mesh
    boneMesh.position.copy(boneWorldPosition);
    
    // Orient the mesh to point from head to tail
    const alignmentQuaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0);
    
    // Handle the case where the bone direction is parallel to the up vector
    if (Math.abs(upVector.dot(boneDirection)) > 0.999) {
        // If pointing in the same direction, no rotation needed
        // If pointing in the opposite direction, rotate 180 degrees around X
        if (upVector.dot(boneDirection) < 0) {
            alignmentQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        }
    } else {
        // Calculate the rotation from Y-axis to the bone direction
        alignmentQuaternion.setFromUnitVectors(upVector, boneDirection);
    }
    
    // Apply the rotation to align with bone direction
    boneMesh.quaternion.copy(alignmentQuaternion);
    
    // Add to bone group
    boneGroup.add(boneMesh);
    
    // Add joint point as a small sphere
    const jointGeometry = new THREE.SphereGeometry(baseSize * 0.8, 8, 8);
    const jointMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        wireframe: true,
        transparent: true,
        opacity: 0.8,
        depthTest: true
    });
    const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
    jointMesh.position.copy(boneWorldPosition);
    boneGroup.add(jointMesh);
    
    // Add connection line to parent bone for visualization clarity
    if (bone.parent && (bone.parent.isBone || 
        (bone.parent.name && bone.parent.name.toLowerCase().includes('bone_')))) {
        const parentWorldPosition = new THREE.Vector3();
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldPosition(parentWorldPosition);
        
        // Create a connecting line
        const connectionGeometry = new THREE.BufferGeometry().setFromPoints([
            parentWorldPosition,
            boneWorldPosition
        ]);
        
        const connectionMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            depthTest: true
        });
        
        const connectionLine = new THREE.Line(connectionGeometry, connectionMaterial);
        connectionLine.name = `connection_${bone.parent.name || 'parent'}_to_${bone.name || 'child'}`;
        
        boneGroup.add(connectionLine);
    }
}

export default {
    initRigPanel,
    updateRigVisualization,
    toggleRigVisualization
}; 