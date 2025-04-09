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

// Add these variables to the top of the file after the other variable declarations
let hoveredObject = null;
let raycaster = null;
let mouse = new THREE.Vector2();
let isDragging = false;
let draggedObject = null;
let dragPlane = new THREE.Plane();
let dragStartPoint = new THREE.Vector3();
let dragStartPosition = new THREE.Vector3();
let totalDragDelta = new THREE.Vector3();

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
            // Remove event listeners
            if (state.renderer && state.renderer.domElement) {
                const domElement = state.renderer.domElement;
                
                if (state.boneVisualization.userData.mouseListener) {
                    domElement.removeEventListener('mousemove', state.boneVisualization.userData.mouseListener);
                }
                
                if (state.boneVisualization.userData.mouseDownListener) {
                    domElement.removeEventListener('mousedown', state.boneVisualization.userData.mouseDownListener);
                }
                
                if (state.boneVisualization.userData.mouseUpListener) {
                    domElement.removeEventListener('mouseup', state.boneVisualization.userData.mouseUpListener);
                }
            }
            
            // Reset cursor if needed
            if (state.renderer) {
                state.renderer.domElement.style.cursor = 'auto';
            }
            
            // Re-enable camera controls if they were disabled
            if (state.controls && state.controls.enabled !== undefined) {
                state.controls.enabled = true;
            }
            
            // Reset hovered object if any
            if (hoveredObject) {
                hoveredObject.material.color.copy(hoveredObject.userData.originalColor);
                hoveredObject = null;
            }
            
            // Hide visualization
            state.boneVisualization.visible = false;
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
            state.boneVisualization.visible = true;
            
            // Re-setup interactions
            setupBoneInteractions();
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
        // Only change color for regular bone visualizations, not handles or roots
        if (object.material && 
            !object.userData.isHandle && 
            !object.userData.isRoot) {
            object.material.color.copy(color);
        } else if (object.material && 
                  (object.userData.isHandle || object.userData.isRoot)) {
            // Make sure handles and roots keep their original colors
            if (object.userData.originalColor) {
                object.material.color.copy(object.userData.originalColor);
            }
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
        // Determine bone type by name for special visualization
        if (bone.name) {
            const lowercaseName = bone.name.toLowerCase();
            
            if (lowercaseName.includes('_handle') || lowercaseName.includes('_control')) {
                // Create handle visualization for handles and controls
                createHandleBoneVisual(bone, modelSize, boneGroup);
            } else if (lowercaseName.includes('_root')) {
                // Create root visualization for root bones
                createRootBoneVisual(bone, modelSize, boneGroup);
            } else {
                // Create regular bone visualization
                createBoneVisual(bone, modelSize, boneGroup);
            }
        } else {
            // Create regular bone visualization for unnamed bones
            createBoneVisual(bone, modelSize, boneGroup);
        }
    });
    
    // Create or get the assembly container
    let assemblyContainer = findOrCreateAssemblyContainer(state.model);
    
    // Add the bone visualization group to the assembly container
    assemblyContainer.add(boneGroup);
    
    // If the scene doesn't already contain the assembly container, add it
    if (!state.scene.children.includes(assemblyContainer)) {
        state.scene.add(assemblyContainer);
    }
    
    // Update state with references
    updateState('boneVisualization', boneGroup);
    updateState('assemblyContainer', assemblyContainer);
    
    // Set up hover interactions
    setupBoneInteractions();
    
    // Apply visualization settings
    applyVisualizationSettings();
}

/**
 * Find or create an assembly container that will hold the model and its visualizations
 * @param {THREE.Object3D} model - The model object
 * @returns {THREE.Group} The assembly container
 */
function findOrCreateAssemblyContainer(model) {
    const state = getState();
    
    // Check if we already have an assembly container in the state
    if (state.assemblyContainer) {
        return state.assemblyContainer;
    }
    
    // Check if model already has a parent that could be our container
    if (model.parent && model.parent.isGroup && model.parent.name === 'AssemblyContainer') {
        return model.parent;
    }
    
    // Create a new assembly container
    const assemblyContainer = new THREE.Group();
    assemblyContainer.name = 'AssemblyContainer';
    
    // If model is already in the scene, we need to reparent it
    if (model.parent) {
        // Get model's world position to maintain its position after reparenting
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        
        model.updateWorldMatrix(true, false);
        model.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
        
        // Remove from current parent
        model.parent.remove(model);
        
        // Add to our assembly container
        assemblyContainer.add(model);
        
        // Position the assembly container to keep the model in the same world position
        assemblyContainer.position.copy(worldPosition);
        assemblyContainer.quaternion.copy(worldQuaternion);
        assemblyContainer.scale.copy(worldScale);
        
        // Reset model's position to be relative to assembly container
        model.position.set(0, 0, 0);
        model.quaternion.identity();
        model.scale.set(1, 1, 1);
    } else {
        // If model isn't in the scene yet, just add it to our container
        assemblyContainer.add(model);
    }
    
    return assemblyContainer;
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

/**
 * Create a visual representation of a handle bone (as a sphere)
 * @param {Object} bone - The handle bone object
 * @param {number} baseSize - Base size for visualization
 * @param {THREE.Group} boneGroup - Group to add the visualization to
 */
function createHandleBoneVisual(bone, baseSize, boneGroup) {
    if (!bone || !boneGroup) return;
    
    // Ensure the bone's world matrix is up to date
    bone.updateWorldMatrix(true, false);
    
    // Get bone's world position
    const worldPosition = new THREE.Vector3();
    bone.getWorldPosition(worldPosition);
    
    // Create sphere geometry for handle - increased size multiplier from 1.2 to 2.0
    const sphereGeometry = new THREE.SphereGeometry(baseSize * 2.0, 16, 16);
    
    // Create material - gray and solid
    const handleMaterial = new THREE.MeshBasicMaterial({
        color: 0x888888,
        wireframe: false,
        transparent: true,
        opacity: 0.7,
        depthTest: true,
        depthWrite: true
    });
    
    // Create the sphere mesh
    const handleMesh = new THREE.Mesh(sphereGeometry, handleMaterial);
    handleMesh.name = `handle_visual_${bone.name || 'unnamed'}`;
    handleMesh.userData.boneRef = bone;
    handleMesh.userData.originalColor = new THREE.Color(0x888888);
    handleMesh.userData.hoverColor = new THREE.Color(0x00ff00);
    handleMesh.userData.isHandle = true;
    
    // Position at bone's world position
    handleMesh.position.copy(worldPosition);
    
    // Add to group
    boneGroup.add(handleMesh);
    
    // Add connection to parent if it exists
    if (bone.parent && (bone.parent.isBone || 
        (bone.parent.name && bone.parent.name.toLowerCase().includes('bone_')))) {
        const parentPosition = new THREE.Vector3();
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldPosition(parentPosition);
        
        // Create a connecting line
        const connectionGeometry = new THREE.BufferGeometry().setFromPoints([
            parentPosition,
            worldPosition
        ]);
        
        const connectionMaterial = new THREE.LineBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.6,
            depthTest: true
        });
        
        const connectionLine = new THREE.Line(connectionGeometry, connectionMaterial);
        connectionLine.name = `handle_connection_${bone.parent.name || 'parent'}_to_${bone.name || 'child'}`;
        
        boneGroup.add(connectionLine);
    }
}

/**
 * Create a visual representation of a root bone (as a sphere with direction caret)
 * @param {Object} bone - The root bone object
 * @param {number} baseSize - Base size for visualization
 * @param {THREE.Group} boneGroup - Group to add the visualization to
 */
function createRootBoneVisual(bone, baseSize, boneGroup) {
    if (!bone || !boneGroup) return;
    
    // Ensure the bone's world matrix is up to date
    bone.updateWorldMatrix(true, false);
    
    // Get bone's world position
    const worldPosition = new THREE.Vector3();
    bone.getWorldPosition(worldPosition);
    
    // Find direction toward child if available
    let directionVector = new THREE.Vector3(0, 1, 0); // Default direction
    
    // Check if any children are bones to determine direction
    if (bone.children && bone.children.length > 0) {
        // Find the first bone child for direction vector
        for (const child of bone.children) {
            if (child.isBone || 
                (child.name && child.name.toLowerCase().includes('bone_'))) {
                const childWorldPosition = new THREE.Vector3();
                child.updateWorldMatrix(true, false);
                child.getWorldPosition(childWorldPosition);
                
                // Get direction from root to child
                directionVector = new THREE.Vector3().subVectors(childWorldPosition, worldPosition).normalize();
                break;
            }
        }
    }
    
    // Create sphere for root - increased size multiplier from 1.3 to 2.2
    const sphereGeometry = new THREE.SphereGeometry(baseSize * 2.2, 16, 16);
    
    // Create material - darker gray and solid
    const rootMaterial = new THREE.MeshBasicMaterial({
        color: 0x555555,
        wireframe: false,
        transparent: true,
        opacity: 0.7,
        depthTest: true
    });
    
    // Create the sphere mesh
    const rootMesh = new THREE.Mesh(sphereGeometry, rootMaterial);
    rootMesh.name = `root_visual_${bone.name || 'unnamed'}`;
    rootMesh.userData.boneRef = bone;
    rootMesh.userData.originalColor = new THREE.Color(0x555555);
    rootMesh.userData.hoverColor = new THREE.Color(0xff0000);
    rootMesh.userData.isRoot = true;
    
    // Position at bone's world position
    rootMesh.position.copy(worldPosition);
    
    // Add to group
    boneGroup.add(rootMesh);
    
    // Create a directional caret/arrow pointing toward children - increased size multipliers
    const caretLength = baseSize * 2.5; // Increased from 1.5
    const caretOffset = baseSize * 2.5; // Increased from 1.5
    
    // Create cone for caret - increased width multiplier from 0.6 to 1.0
    const caretGeometry = new THREE.ConeGeometry(baseSize * 1.0, caretLength, 8);
    const caretMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333, // Red caret
        wireframe: true
    });
    
    // Rotate cone to point in the direction vector (cones point along +Y by default)
    caretGeometry.rotateX(Math.PI / 2); // First orient along Z
    
    const caretMesh = new THREE.Mesh(caretGeometry, caretMaterial);
    caretMesh.name = `root_caret_${bone.name || 'unnamed'}`;
    
    // Calculate position for caret (offset from sphere in the direction)
    const caretPosition = worldPosition.clone().add(
        directionVector.clone().multiplyScalar(caretOffset)
    );
    caretMesh.position.copy(caretPosition);
    
    // Orient caret to point in the direction
    const caretQuaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 0, 1); // Cone points along +Z after rotation
    
    // Handle special case for parallel direction
    if (Math.abs(upVector.dot(directionVector)) > 0.999) {
        if (upVector.dot(directionVector) < 0) {
            caretQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        }
    } else {
        caretQuaternion.setFromUnitVectors(upVector, directionVector);
    }
    
    caretMesh.quaternion.copy(caretQuaternion);
    
    // Add caret to the group
    boneGroup.add(caretMesh);
}

/**
 * Setup mouse hover interaction for bone visualizations
 */
function setupBoneInteractions() {
    const state = getState();
    if (!state.renderer || !state.camera || !state.boneVisualization) return;
    
    // Create raycaster if needed
    if (!raycaster) {
        raycaster = new THREE.Raycaster();
    }
    
    // Add mousemove listener to renderer's DOM element
    const domElement = state.renderer.domElement;
    
    // Remove any existing listener to prevent duplicates
    if (state.boneVisualization.userData.mouseListener) {
        domElement.removeEventListener('mousemove', state.boneVisualization.userData.mouseListener);
    }
    
    // Store original controls state to restore when not hovering
    let orbitControlsEnabled = true;
    if (state.controls && state.controls.enabled !== undefined) {
        orbitControlsEnabled = state.controls.enabled;
    }
    
    // Create the mouse move handler
    const onMouseMove = (event) => {
        // Only process if bone visualization is visible
        if (!state.boneVisualization || !state.boneVisualization.visible) return;
        
        // Get canvas-relative mouse position
        const canvas = domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, state.camera);
        
        // If dragging, update the object position temporarily
        if (isDragging && draggedObject) {
            handleDragMovement(event);
            return;
        }
        
        // Find interactive objects (handles and roots)
        const interactiveObjects = [];
        state.boneVisualization.traverse(child => {
            if (child.userData && (child.userData.isHandle || child.userData.isRoot)) {
                interactiveObjects.push(child);
            }
        });
        
        const intersects = raycaster.intersectObjects(interactiveObjects, false);
        
        // Reset previously hovered object color
        if (hoveredObject && (!intersects.length || intersects[0].object !== hoveredObject)) {
            hoveredObject.material.color.copy(hoveredObject.userData.originalColor);
            hoveredObject = null;
            domElement.style.cursor = 'auto';
            
            // Re-enable orbit controls when not hovering
            if (state.controls && state.controls.enabled !== undefined) {
                state.controls.enabled = orbitControlsEnabled;
            }
        }
        
        // Set new hovered object color
        if (intersects.length > 0 && intersects[0].object !== hoveredObject) {
            hoveredObject = intersects[0].object;
            hoveredObject.material.color.copy(hoveredObject.userData.hoverColor);
            domElement.style.cursor = 'pointer';
            
            // Disable camera controls when hovering over interactive elements
            if (state.controls && state.controls.enabled !== undefined) {
                state.controls.enabled = false;
            }
        }
    };
    
    // Add mousedown listener to handle clicks on interactive elements
    const onMouseDown = (event) => {
        // Only process left button clicks when hovering over an interactive element
        if (!hoveredObject || event.button !== 0) return;
        
        // Prevent event from being handled by other listeners
        event.stopPropagation();
        
        // Ensure camera controls are disabled during dragging
        if (state.controls && state.controls.enabled !== undefined) {
            state.controls.enabled = false;
        }
        
        // Start dragging if it's a root node
        if (hoveredObject.userData.isRoot) {
            isDragging = true;
            draggedObject = hoveredObject;
            
            // Get the camera's viewing direction
            const cameraDirection = new THREE.Vector3();
            state.camera.getWorldDirection(cameraDirection);
            
            // Create a plane perpendicular to the camera direction, passing through the object
            dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                cameraDirection,
                draggedObject.position
            );
            
            // Store the starting position of the drag operation
            dragStartPosition.copy(draggedObject.position);
            
            // Reset total drag delta
            totalDragDelta.set(0, 0, 0);
            
            // Find the point on the plane where the ray intersects
            const planeIntersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane, planeIntersection);
            dragStartPoint.copy(planeIntersection);
            
            // Change cursor to indicate dragging
            domElement.style.cursor = 'grabbing';
        }
    };
    
    // Add mouseup listener to handle end of interaction
    const onMouseUp = (event) => {
        // Only process left button releases
        if (event.button !== 0) return;
        
        // If we were dragging a root object, apply the drag delta to the entire model
        if (isDragging && draggedObject && draggedObject.userData.isRoot) {
            applyDragToModel();
        }
        
        // End dragging
        isDragging = false;
        draggedObject = null;
        
        // Reset cursor
        domElement.style.cursor = hoveredObject ? 'pointer' : 'auto';
        
        // If still hovering over an interactive object, keep orbit controls disabled
        // Otherwise, restore orbit controls to original state
        if (!hoveredObject) {
            if (state.controls && state.controls.enabled !== undefined) {
                state.controls.enabled = orbitControlsEnabled;
            }
        }
    };
    
    // Store the listener references
    state.boneVisualization.userData.mouseListener = onMouseMove;
    state.boneVisualization.userData.mouseDownListener = onMouseDown;
    state.boneVisualization.userData.mouseUpListener = onMouseUp;
    
    // Add the event listeners
    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('mousedown', onMouseDown);
    domElement.addEventListener('mouseup', onMouseUp);
}

/**
 * Handle movement during drag operations
 * @param {Event} event - Mouse move event
 */
function handleDragMovement(event) {
    const state = getState();
    if (!isDragging || !draggedObject || !state.camera) return;
    
    // Find the new intersection point on the plane
    const planeIntersection = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlane, planeIntersection)) return;
    
    // Calculate the movement delta in world space
    const movementDelta = new THREE.Vector3().subVectors(planeIntersection, dragStartPoint);
    
    // Update the total drag delta
    totalDragDelta.copy(movementDelta);
    
    // Move the draggedObject temporarily to show preview
    draggedObject.position.copy(dragStartPosition).add(movementDelta);
}

/**
 * Apply the drag movement to the entire assembly container
 */
function applyDragToModel() {
    const state = getState();
    if (!draggedObject || totalDragDelta.length() === 0) return;
    
    // Get the bone reference
    const bone = draggedObject.userData.boneRef;
    if (!bone) return;
    
    // Get the assembly container
    const assemblyContainer = state.assemblyContainer;
    if (!assemblyContainer) {
        console.warn('No assembly container found to move');
        return;
    }
    
    console.log(`Moving assembly by: ${totalDragDelta.x.toFixed(2)}, ${totalDragDelta.y.toFixed(2)}, ${totalDragDelta.z.toFixed(2)}`);
    
    // Move the assembly container by the drag delta
    assemblyContainer.position.add(totalDragDelta);
    
    // Update matrix to propagate changes
    assemblyContainer.updateMatrix();
    
    console.log(`Assembly moved to position: ${assemblyContainer.position.x.toFixed(2)}, ${assemblyContainer.position.y.toFixed(2)}, ${assemblyContainer.position.z.toFixed(2)}`);
    
    // No need to manually update any other elements as they're all in the assembly container
}

export default {
    initRigPanel,
    updateRigVisualization,
    toggleRigVisualization
}; 