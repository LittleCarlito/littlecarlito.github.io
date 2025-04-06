// Rig Visualization module
// Creates a panel to display rig and bone data from 3D models
import * as THREE from 'three';
import { createMovablePanel, createButton, createLabel } from '../utils/uiComponents.js';

// Keep track of created rig visualization container
let rigVisualizationContainer = null;
// Keep track of bone visualization objects
let boneVisualizationGroup = null;

// Variables for drag handling - moved to module scope to be accessible by all functions
let dragStartPoint = new THREE.Vector3();
let dragStartPosition = new THREE.Vector3();

/**
 * Create or toggle a visualization of the rig and bone data
 * @param {Object} state - Global state object
 */
export function createRigVisualization(state) {
    // Clean up any rogue visualization containers
    const existingContainers = document.querySelectorAll('#rig-visualization');
    if (existingContainers.length > 1) {
        // Keep only the first one if multiple exist
        for (let i = 1; i < existingContainers.length; i++) {
            if (document.body.contains(existingContainers[i])) {
                document.body.removeChild(existingContainers[i]);
            }
        }
    }
    
    // If visualization already exists, ensure it's visible
    if (rigVisualizationContainer) {
        if (rigVisualizationContainer.style.display === 'none') {
            rigVisualizationContainer.style.display = 'block';
        }
        // Update visualization with current model state if available
        if (state.modelObject) {
            updateRigData(state.modelObject);
        }
        return;
    }

    // Create panel using the utility function - position at top right
    const { container, contentContainer } = createMovablePanel({
        id: 'rig-visualization',
        title: 'Rig & Bone Visualization',
        position: { top: '20px', right: '20px' },
        width: '300px'
    });
    
    // Store the container for future reference
    rigVisualizationContainer = container;
    
    // Create content for the panel - use more compact styling
    const rigInfoContainer = document.createElement('div');
    rigInfoContainer.className = 'rig-info-container';
    rigInfoContainer.style.fontSize = '12px';
    rigInfoContainer.style.fontFamily = 'monospace';
    rigInfoContainer.style.color = '#ddd';
    rigInfoContainer.style.whiteSpace = 'nowrap';
    rigInfoContainer.style.overflowX = 'hidden';
    rigInfoContainer.style.maxHeight = '500px';
    // Make more compact
    rigInfoContainer.style.lineHeight = '1.2';
    rigInfoContainer.style.padding = '5px';
    
    // Add the info container to the content container
    contentContainer.appendChild(rigInfoContainer);
    
    // Create a collapsible tree view for bones
    const boneTreeContainer = document.createElement('div');
    boneTreeContainer.className = 'bone-tree-container';
    boneTreeContainer.style.marginTop = '5px'; // Reduced margin
    contentContainer.appendChild(boneTreeContainer);
    
    // Add toggle button for bone visualization
    const visualizeButton = createButton({
        text: 'Toggle Bone Visualization',
        color: '#2a6496',
        onClick: () => toggleBoneVisualization(state)
    });
    visualizeButton.style.marginTop = '8px';
    contentContainer.appendChild(visualizeButton);
    
    // Add visualization controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.style.marginTop = '5px';
    controlsContainer.style.padding = '5px';
    controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    controlsContainer.style.borderRadius = '3px';
    
    // Add Force Z Override checkbox
    const zOverrideContainer = document.createElement('div');
    zOverrideContainer.style.display = 'flex';
    zOverrideContainer.style.alignItems = 'center';
    zOverrideContainer.style.marginBottom = '5px';
    
    const zOverrideCheckbox = document.createElement('input');
    zOverrideCheckbox.type = 'checkbox';
    zOverrideCheckbox.id = 'force-z-override';
    zOverrideCheckbox.style.marginRight = '5px';
    zOverrideCheckbox.addEventListener('change', (e) => {
        if (boneVisualizationGroup) {
            setZOverride(boneVisualizationGroup, e.target.checked);
        }
    });
    
    const zOverrideLabel = document.createElement('label');
    zOverrideLabel.htmlFor = 'force-z-override';
    zOverrideLabel.textContent = 'Force Z Override';
    zOverrideLabel.style.fontSize = '11px';
    zOverrideLabel.style.color = '#ddd';
    
    zOverrideContainer.appendChild(zOverrideCheckbox);
    zOverrideContainer.appendChild(zOverrideLabel);
    controlsContainer.appendChild(zOverrideContainer);
    
    // Add Customize Visualizations checkbox
    const customizeContainer = document.createElement('div');
    customizeContainer.style.display = 'flex';
    customizeContainer.style.alignItems = 'center';
    customizeContainer.style.marginBottom = '5px';
    
    const customizeCheckbox = document.createElement('input');
    customizeCheckbox.type = 'checkbox';
    customizeCheckbox.id = 'customize-visualizations';
    customizeCheckbox.style.marginRight = '5px';
    
    const customizeLabel = document.createElement('label');
    customizeLabel.htmlFor = 'customize-visualizations';
    customizeLabel.textContent = 'Customize Visualizations';
    customizeLabel.style.fontSize = '11px';
    customizeLabel.style.color = '#ddd';
    
    customizeContainer.appendChild(customizeCheckbox);
    customizeContainer.appendChild(customizeLabel);
    controlsContainer.appendChild(customizeContainer);
    
    // Create customization options (initially hidden)
    const customizeOptions = document.createElement('div');
    customizeOptions.style.marginLeft = '15px';
    customizeOptions.style.marginTop = '5px';
    customizeOptions.style.display = 'none';
    
    // Add Fill Meshes checkbox
    const fillContainer = document.createElement('div');
    fillContainer.style.display = 'flex';
    fillContainer.style.alignItems = 'center';
    fillContainer.style.marginBottom = '5px';
    
    const fillCheckbox = document.createElement('input');
    fillCheckbox.type = 'checkbox';
    fillCheckbox.id = 'fill-visualization-meshes';
    fillCheckbox.style.marginRight = '5px';
    fillCheckbox.addEventListener('change', (e) => {
        if (boneVisualizationGroup) {
            setFillMeshes(boneVisualizationGroup, e.target.checked);
        }
    });
    
    const fillLabel = document.createElement('label');
    fillLabel.htmlFor = 'fill-visualization-meshes';
    fillLabel.textContent = 'Fill Visualization Meshes';
    fillLabel.style.fontSize = '11px';
    fillLabel.style.color = '#ddd';
    
    fillContainer.appendChild(fillCheckbox);
    fillContainer.appendChild(fillLabel);
    customizeOptions.appendChild(fillContainer);
    
    // Add Color Picker
    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'flex';
    colorContainer.style.alignItems = 'center';
    colorContainer.style.marginBottom = '5px';
    
    const colorLabel = document.createElement('label');
    colorLabel.htmlFor = 'visualization-color';
    colorLabel.textContent = 'Visualization Color: ';
    colorLabel.style.fontSize = '11px';
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
    colorPicker.addEventListener('change', (e) => {
        if (boneVisualizationGroup) {
            setVisualizationColor(boneVisualizationGroup, e.target.value);
        }
    });
    
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorPicker);
    customizeOptions.appendChild(colorContainer);
    
    // Add customizeOptions to controlsContainer
    controlsContainer.appendChild(customizeOptions);
    
    // Toggle display of customization options
    customizeCheckbox.addEventListener('change', (e) => {
        customizeOptions.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Add controls container to main content
    contentContainer.appendChild(controlsContainer);
    
    // Add container to the document
    document.body.appendChild(container);
    
    // Show initial state
    if (state.modelObject) {
        updateRigData(state.modelObject);
    } else {
        showNoModelState(rigInfoContainer);
    }
    
    console.log('Rig visualization panel created');
    
    return container;
}

/**
 * Show a "No model loaded" message in the panel
 * @param {HTMLElement} container - The container to update
 */
function showNoModelState(container) {
    container.innerHTML = `<div style="color: #aaa; text-align: center; padding: 10px;">
        <div style="font-size: 14px; margin-bottom: 5px;">No model loaded</div>
        <div style="font-size: 12px;">Load a GLB to view rig data</div>
    </div>`;
    
    // Also clear the bone tree if it exists
    if (rigVisualizationContainer) {
        const boneTreeContainer = rigVisualizationContainer.querySelector('.bone-tree-container');
        if (boneTreeContainer) {
            boneTreeContainer.innerHTML = '';
        }
    }
    
    // Remove any existing bone visualization
    removeBoneVisualization();
}

/**
 * Update the rig visualization with new model data
 * @param {Object} modelObject - The loaded model object
 */
function updateRigData(modelObject) {
    if (!rigVisualizationContainer || !modelObject) return;
    
    const rigInfoContainer = rigVisualizationContainer.querySelector('.rig-info-container');
    const boneTreeContainer = rigVisualizationContainer.querySelector('.bone-tree-container');
    
    if (!rigInfoContainer || !boneTreeContainer) return;
    
    // Extract rig data
    const rigData = extractRigData(modelObject);
    
    if (!rigData || Object.keys(rigData).length === 0 || rigData.totalBones === 0) {
        // No rig data found - show a simple message instead of empty sections
        rigInfoContainer.innerHTML = `<div style="color: #aaa; text-align: center; padding: 10px;">
            <div style="font-size: 14px;">No rigging found</div>
        </div>`;
        boneTreeContainer.innerHTML = '';
        
        // Remove any existing bone visualization
        removeBoneVisualization();
        return;
    }
    
    // Display rig summary with bullet points and constraint information
    rigInfoContainer.innerHTML = `
        <div style="padding: 3px; border-bottom: 1px solid #444;">
            <strong>Rig Summary:</strong>
            <ul style="margin: 2px 0; padding-left: 18px; line-height: 1.2;">
                <li>Total bones: ${rigData.totalBones}</li>
                <li>Root bones: ${rigData.rootBones.length}</li>
                <li>Max depth: ${rigData.maxDepth}</li>
                <li>Constraints: ${rigData.constraints.length}</li>
            </ul>
            ${rigData.constraints.length > 0 ? 
                `<div style="margin-top: 4px;">
                    <strong>Constraint Data:</strong>
                    <div style="font-size: 10px; max-height: 60px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 3px; margin-top: 2px; border-radius: 2px;">
                        ${formatConstraintsData(rigData.constraints)}
                    </div>
                </div>` 
                : ''}
        </div>
    `;
    
    // Create collapsible tree view for bones
    createBoneTreeView(boneTreeContainer, rigData.boneHierarchy);
    
    // Store rig data for visualization
    if (boneVisualizationGroup && boneVisualizationGroup.visible) {
        // If bone visualization is already visible, update it
        createBoneVisualization(modelObject, rigData);
    }
    
    // Store constraint data in the state for use in manipulation
    if (modelObject.userData) {
        modelObject.userData.rigConstraints = rigData.constraints;
    }
}

/**
 * Extract rig and bone data from a model
 * @param {Object} modelObject - The loaded model object
 * @returns {Object} Extracted rig data
 */
function extractRigData(modelObject) {
    if (!modelObject) return null;
    
    const rigData = {
        totalBones: 0,
        rootBones: [],
        boneHierarchy: {},
        maxDepth: 0,
        allBones: [],  // Store all bones for visualization
        constraints: [] // Store bone constraints
    };
    
    // Find all bones in the model
    const bones = [];
    let skeletons = [];
    
    // Function to recursively traverse scene and find bones
    function traverseForBones(object) {
        // Check if this is a bone (by name or userData)
        if (object.isBone || object.name.toLowerCase().includes('bone_') || 
            (object.userData && object.userData.type === 'bone')) {
            bones.push(object);
            
            // Extract bone constraints if available
            extractBoneConstraints(object, rigData.constraints);
        }
        
        // Check if this is a skeleton
        if (object.isSkeletonHelper || object.isSkeleton || 
            (object.userData && object.userData.type === 'skeleton')) {
            skeletons.push(object);
            
            // Extract skeleton constraint data if available
            if (object.userData && object.userData.constraints) {
                rigData.constraints.push(...object.userData.constraints);
            }
        }
        
        // Check if this is a SkinnedMesh (will have skeleton)
        if (object.isSkinnedMesh && object.skeleton) {
            skeletons.push(object.skeleton);
            // Add all bones from the skeleton
            if (object.skeleton.bones && object.skeleton.bones.length > 0) {
                bones.push(...object.skeleton.bones);
                
                // Check for constraints in the skeleton userData
                if (object.skeleton.userData && object.skeleton.userData.constraints) {
                    rigData.constraints.push(...object.skeleton.userData.constraints);
                }
            }
        }
        
        // Traverse children
        if (object.children && object.children.length > 0) {
            object.children.forEach(child => traverseForBones(child));
        }
    }
    
    // Traverse the model to find bones
    traverseForBones(modelObject);
    
    // Check model's userData for any constraint information
    if (modelObject.userData) {
        // Look for constraint data in various possible locations
        if (modelObject.userData.constraints) {
            rigData.constraints.push(...modelObject.userData.constraints);
        }
        
        if (modelObject.userData.boneConstraints) {
            rigData.constraints.push(...modelObject.userData.boneConstraints);
        }
        
        // Some exporters might nest this data deeply
        if (modelObject.userData.animation && modelObject.userData.animation.constraints) {
            rigData.constraints.push(...modelObject.userData.animation.constraints);
        }
    }
    
    // Deduplicate bones by uuid
    const uniqueBones = {};
    bones.forEach(bone => {
        if (!uniqueBones[bone.uuid]) {
            uniqueBones[bone.uuid] = bone;
        }
    });
    
    // Convert back to array
    const uniqueBoneArray = Object.values(uniqueBones);
    rigData.totalBones = uniqueBoneArray.length;
    rigData.allBones = uniqueBoneArray;  // Store all bones for visualization
    
    // Build bone hierarchy
    uniqueBoneArray.forEach(bone => {
        // Check if this is a root bone (no parent that is a bone)
        const isRoot = !bone.parent || 
                      !uniqueBones[bone.parent.uuid];
        
        if (isRoot) {
            rigData.rootBones.push(bone);
            // Start building hierarchy from root
            rigData.boneHierarchy[bone.uuid] = {
                name: bone.name,
                position: [bone.position.x, bone.position.y, bone.position.z],
                rotation: [bone.rotation.x, bone.rotation.y, bone.rotation.z],
                scale: [bone.scale.x, bone.scale.y, bone.scale.z],
                children: {},
                object: bone,  // Store reference to actual bone object
                constraints: extractBoneConstraintsData(bone)
            };
            
            // Recursively build child hierarchy
            buildBoneChildHierarchy(bone, rigData.boneHierarchy[bone.uuid].children, uniqueBones, 1, rigData);
        }
    });
    
    // Search for constraints in userdata of armature (Blender typically exports IK here)
    if (modelObject.type === "Group" || modelObject.name.toLowerCase().includes("armature")) {
        if (modelObject.userData) {
            if (modelObject.userData.constraints) {
                rigData.constraints.push(...modelObject.userData.constraints);
            }
            if (modelObject.userData.iks) {
                rigData.constraints.push(...modelObject.userData.iks.map(ik => ({
                    type: "IK",
                    target: ik.target,
                    bone: ik.bone,
                    chainLength: ik.chainLength
                })));
            }
        }
    }
    
    return rigData;
}

/**
 * Extract constraint data from a bone object
 * @param {Object} bone - The bone object
 * @returns {Array} Array of constraint objects
 */
function extractBoneConstraintsData(bone) {
    const constraints = [];
    
    // Check for constraint data in userData
    if (bone.userData) {
        // Direct constraints array
        if (bone.userData.constraints) {
            constraints.push(...bone.userData.constraints);
        }
        
        // IK constraints
        if (bone.userData.ik) {
            constraints.push({
                type: 'IK',
                ...bone.userData.ik
            });
        }
        
        // Limit constraints
        if (bone.userData.limits) {
            constraints.push({
                type: 'Limit',
                ...bone.userData.limits
            });
        }
        
        // Copy constraints
        if (bone.userData.copyRotation) {
            constraints.push({
                type: 'CopyRotation',
                ...bone.userData.copyRotation
            });
        }
        
        if (bone.userData.copyLocation) {
            constraints.push({
                type: 'CopyLocation',
                ...bone.userData.copyLocation
            });
        }
        
        // Check for THREE.js extensions or GLTF extensions
        if (bone.userData.gltfExtensions) {
            if (bone.userData.gltfExtensions.KHR_animation_constraint) {
                constraints.push({
                    type: 'GLTF',
                    ...bone.userData.gltfExtensions.KHR_animation_constraint
                });
            }
        }
    }
    
    return constraints;
}

/**
 * Extract constraints from bone and add to constraints array
 * @param {Object} bone - The bone object
 * @param {Array} constraintsArray - Array to add constraints to
 */
function extractBoneConstraints(bone, constraintsArray) {
    const boneConstraints = extractBoneConstraintsData(bone);
    
    if (boneConstraints.length > 0) {
        // Add bone name to each constraint and add to array
        boneConstraints.forEach(constraint => {
            constraintsArray.push({
                ...constraint,
                boneName: bone.name
            });
        });
    }
}

/**
 * Recursively build bone child hierarchy
 * @param {Object} parentBone - The parent bone object
 * @param {Object} parentEntry - The parent entry in the hierarchy object
 * @param {Object} uniqueBones - Map of all unique bones by uuid
 * @param {number} depth - Current depth in the hierarchy
 * @param {Object} rigData - The rig data object to update
 */
function buildBoneChildHierarchy(parentBone, parentEntry, uniqueBones, depth, rigData) {
    // Update max depth
    rigData.maxDepth = Math.max(rigData.maxDepth, depth);
    
    // Check each child
    parentBone.children.forEach(child => {
        // If child is a bone in our unique bones list
        if (uniqueBones[child.uuid]) {
            parentEntry[child.uuid] = {
                name: child.name,
                position: [child.position.x, child.position.y, child.position.z],
                rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
                scale: [child.scale.x, child.scale.y, child.scale.z],
                children: {},
                object: child,  // Store reference to actual bone object
                constraints: extractBoneConstraintsData(child)
            };
            
            // Recursively process this child's children
            buildBoneChildHierarchy(child, parentEntry[child.uuid].children, uniqueBones, depth + 1, rigData);
        }
    });
}

/**
 * Create a collapsible tree view for the bone hierarchy
 * @param {HTMLElement} container - The container to add the tree to
 * @param {Object} boneHierarchy - The bone hierarchy object
 */
function createBoneTreeView(container, boneHierarchy) {
    container.innerHTML = '<div style="border-bottom: 1px solid #444; padding: 3px;"><strong>Bone Hierarchy:</strong></div>';
    
    // Create tree root
    const treeRoot = document.createElement('ul');
    treeRoot.style.listStyle = 'none';
    treeRoot.style.paddingLeft = '3px';
    treeRoot.style.margin = '3px 0';
    treeRoot.style.lineHeight = '1.2';  // More compact line height
    
    // Add bones to tree
    Object.keys(boneHierarchy).forEach(boneUuid => {
        const bone = boneHierarchy[boneUuid];
        const boneItem = createBoneTreeItem(bone, boneUuid);
        treeRoot.appendChild(boneItem);
    });
    
    container.appendChild(treeRoot);
}

/**
 * Create a tree item for a bone
 * @param {Object} bone - The bone data
 * @param {string} uuid - The bone's UUID
 * @returns {HTMLElement} The created tree item
 */
function createBoneTreeItem(bone, uuid) {
    const item = document.createElement('li');
    item.style.margin = '1px 0';  // Reduced margin
    
    // Create label with collapse/expand functionality
    const hasChildren = Object.keys(bone.children).length > 0;
    
    // Create label container
    const labelContainer = document.createElement('div');
    labelContainer.style.display = 'flex';
    labelContainer.style.alignItems = 'center';
    
    // Add collapse/expand button if has children
    if (hasChildren) {
        const collapseButton = document.createElement('span');
        collapseButton.textContent = '▼';
        collapseButton.style.cursor = 'pointer';
        collapseButton.style.marginRight = '3px';  // Reduced margin
        collapseButton.style.fontSize = '8px';
        collapseButton.style.color = '#aaa';
        collapseButton.style.width = '10px';
        collapseButton.dataset.collapsed = 'false';
        labelContainer.appendChild(collapseButton);
        
        // Add click handler for collapse/expand
        collapseButton.addEventListener('click', () => {
            const childList = item.querySelector('ul');
            if (childList) {
                const isCollapsed = collapseButton.dataset.collapsed === 'true';
                childList.style.display = isCollapsed ? 'block' : 'none';
                collapseButton.textContent = isCollapsed ? '▼' : '►';
                collapseButton.dataset.collapsed = isCollapsed ? 'false' : 'true';
            }
        });
    } else {
        // Add spacer if no children
        const spacer = document.createElement('span');
        spacer.style.marginRight = '13px';  // Match with triangle indent
        labelContainer.appendChild(spacer);
    }
    
    // Add bone name label
    const label = document.createElement('span');
    label.textContent = bone.name || `Bone_${uuid.substring(0, 6)}`;
    label.style.cursor = 'pointer';
    label.title = `Position: (${bone.position.map(v => v.toFixed(2)).join(', ')})`;
    labelContainer.appendChild(label);
    
    // Add click handler to show bone details
    label.addEventListener('click', () => {
        const detailsElem = item.querySelector('.bone-details');
        if (detailsElem) {
            detailsElem.style.display = detailsElem.style.display === 'none' ? 'block' : 'none';
        } else {
            // Create details element if it doesn't exist
            const details = document.createElement('div');
            details.className = 'bone-details';
            details.style.fontSize = '10px';
            details.style.marginLeft = '15px';
            details.style.padding = '3px';  // Reduced padding
            details.style.backgroundColor = 'rgba(0,0,0,0.2)';
            details.style.borderLeft = '1px solid #555';
            details.innerHTML = `
                <div>Position: (${bone.position.map(v => v.toFixed(2)).join(', ')})</div>
                <div>Rotation: (${bone.rotation.map(v => v.toFixed(2)).join(', ')})</div>
                <div>Scale: (${bone.scale.map(v => v.toFixed(2)).join(', ')})</div>
            `;
            item.appendChild(details);
        }
    });
    
    item.appendChild(labelContainer);
    
    // Add children if any
    if (hasChildren) {
        const childList = document.createElement('ul');
        childList.style.listStyle = 'none';
        childList.style.paddingLeft = '15px';  // Reduced padding
        childList.style.margin = '1px 0';  // Reduced margin
        
        // Add each child bone
        Object.keys(bone.children).forEach(childUuid => {
            const childBone = bone.children[childUuid];
            const childItem = createBoneTreeItem(childBone, childUuid);
            childList.appendChild(childItem);
        });
        
        item.appendChild(childList);
    }
    
    return item;
}

/**
 * Toggle visibility of bone visualization
 * @param {Object} state - Global state object
 */
function toggleBoneVisualization(state) {
    if (!state.modelObject) {
        console.warn('No model loaded - cannot visualize bones');
        return;
    }
    
    if (boneVisualizationGroup) {
        // Toggle existing visualization
        boneVisualizationGroup.visible = !boneVisualizationGroup.visible;
        console.log(`Bone visualization ${boneVisualizationGroup.visible ? 'shown' : 'hidden'}`);
        
        // Apply current checkbox states if visualization is being shown
        if (boneVisualizationGroup.visible) {
            // Ensure root nodes are properly colored on toggle
            boneVisualizationGroup.traverse(child => {
                if (child.userData && child.userData.isRoot && child.material) {
                    child.material.color.copy(child.userData.originalColor);
                }
            });
            
            const zOverrideCheckbox = document.getElementById('force-z-override');
            const fillCheckbox = document.getElementById('fill-visualization-meshes');
            const colorPicker = document.getElementById('visualization-color');
            
            if (zOverrideCheckbox && zOverrideCheckbox.checked) {
                setZOverride(boneVisualizationGroup, true);
            }
            
            if (fillCheckbox && fillCheckbox.checked) {
                setFillMeshes(boneVisualizationGroup, true);
            }
            
            if (colorPicker) {
                setVisualizationColor(boneVisualizationGroup, colorPicker.value);
            }
        }
    } else {
        // Create new visualization
        const rigData = extractRigData(state.modelObject);
        if (rigData) {
            // Store state in model for interactions
            state.modelObject.userData.state = state;
            createBoneVisualization(state.modelObject, rigData);
            
            // Ensure root nodes are properly colored
            boneVisualizationGroup.traverse(child => {
                if (child.userData && child.userData.isRoot && child.material) {
                    child.material.color.copy(child.userData.originalColor);
                }
            });
            
            // Apply current checkbox states to new visualization
            const zOverrideCheckbox = document.getElementById('force-z-override');
            const fillCheckbox = document.getElementById('fill-visualization-meshes');
            const colorPicker = document.getElementById('visualization-color');
            
            if (zOverrideCheckbox && zOverrideCheckbox.checked) {
                setZOverride(boneVisualizationGroup, true);
            }
            
            if (fillCheckbox && fillCheckbox.checked) {
                setFillMeshes(boneVisualizationGroup, true);
            }
            
            if (colorPicker) {
                setVisualizationColor(boneVisualizationGroup, colorPicker.value);
            }
        }
    }
}

/**
 * Create a 3D visualization of bones
 * @param {Object} modelObject - The loaded model object
 * @param {Object} rigData - The extracted rig data
 */
function createBoneVisualization(modelObject, rigData) {
    // Remove any existing visualization
    removeBoneVisualization();
    
    // Create a group to hold all visualization objects
    boneVisualizationGroup = new THREE.Group();
    boneVisualizationGroup.name = 'boneVisualization';
    
    // Add the group to the scene root instead of the model
    // This ensures transforms are applied correctly
    if (modelObject.parent) {
        modelObject.parent.add(boneVisualizationGroup);
    } else {
        modelObject.add(boneVisualizationGroup);
    }
    
    // Base bone size - adjust based on model scale
    const modelScale = getAverageScale(modelObject);
    const boneBaseSize = 0.05 * modelScale;
    
    // Update all world matrices to ensure positions are correct
    if (modelObject.updateWorldMatrix) {
        modelObject.updateWorldMatrix(true, true);
    }
    
    // Create visualizations for each bone
    rigData.allBones.forEach(bone => {
        // Skip if this is not actually a bone object
        if (!bone.isBone && !bone.isObject3D) return;
        
        // Special handling for different bone types
        if (bone.name) {
            const lowercaseName = bone.name.toLowerCase();
            
            if (lowercaseName.includes('_handle') || lowercaseName.includes('_control')) {
                // Create handle visualization for handles and controls
                createHandleBoneVisual(bone, boneBaseSize);
            } else if (lowercaseName.includes('_root')) {
                // Create root visualization for root bones
                createRootBoneVisual(bone, boneBaseSize);
            } else {
                // Create regular bone visualization
                createBoneVisual(bone, boneBaseSize);
            }
        } else {
            // Create regular bone visualization for unnamed bones
            createBoneVisual(bone, boneBaseSize);
        }
    });
    
    console.log(`Created bone visualization with ${rigData.allBones.length} bones`);
    
    // Setup mouse hover interaction
    if (modelObject.userData && modelObject.userData.state) {
        setupBoneInteractions(modelObject.userData.state);
    }
}

/**
 * Create a visual representation of a handle bone (as a sphere)
 * @param {Object} bone - The handle bone object
 * @param {number} baseSize - Base size for scaling the visualization
 */
function createHandleBoneVisual(bone, baseSize) {
    if (!bone || !boneVisualizationGroup) return;
    
    // Ensure the bone's world matrix is up to date
    bone.updateWorldMatrix(true, false);
    
    // Get bone's world position
    const worldPosition = new THREE.Vector3();
    bone.getWorldPosition(worldPosition);
    
    // Create sphere geometry for handle
    const sphereGeometry = new THREE.SphereGeometry(baseSize * 1.2, 16, 16);
    
    // Create material - gray and solid
    const handleMaterial = new THREE.MeshPhongMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.7,
        depthTest: true,
        depthWrite: true
    });
    
    // Create the sphere mesh
    const handleMesh = new THREE.Mesh(sphereGeometry, handleMaterial);
    handleMesh.name = `handle_visual_${bone.name}`;
    handleMesh.userData.boneRef = bone;
    handleMesh.userData.originalColor = new THREE.Color(0x888888);
    handleMesh.userData.hoverColor = new THREE.Color(0x00ff00);
    handleMesh.userData.isVisualization = true;
    handleMesh.userData.isHandle = true;
    
    // Position at bone's world position
    handleMesh.position.copy(worldPosition);
    
    // Always make handles appear on top of other visualization elements
    handleMesh.renderOrder = 1000; // Higher than regular bones
    
    // Add to visualization group
    boneVisualizationGroup.add(handleMesh);
    
    // Add connection to parent if it exists
    if (bone.parent && (bone.parent.isBone || bone.parent.name.toLowerCase().includes('bone_'))) {
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
            transparent: false,
            opacity: 1.0,
            depthTest: true
        });
        
        const connectionLine = new THREE.Line(connectionGeometry, connectionMaterial);
        connectionLine.name = `handle_connection_${bone.parent.name}_to_${bone.name}`;
        connectionLine.userData.isVisualization = true;
        connectionLine.userData.isHandleConnection = true;
        
        boneVisualizationGroup.add(connectionLine);
    }
}

/**
 * Create a visual representation of a root bone (as a sphere)
 * @param {Object} bone - The root bone object
 * @param {number} baseSize - Base size for scaling the visualization
 */
function createRootBoneVisual(bone, baseSize) {
    if (!bone || !boneVisualizationGroup) return;
    
    // Ensure the bone's world matrix is up to date
    bone.updateWorldMatrix(true, false);
    
    // Get bone's world position
    const worldPosition = new THREE.Vector3();
    bone.getWorldPosition(worldPosition);
    
    // Find direction toward child if available
    let directionVector = new THREE.Vector3(0, 1, 0); // Default direction if no children
    
    // Check if any children are bones to determine direction
    if (bone.children && bone.children.length > 0) {
        // Find the first bone child for direction vector
        for (const child of bone.children) {
            if (child.isBone || child.name.toLowerCase().includes('bone_')) {
                const childWorldPosition = new THREE.Vector3();
                child.updateWorldMatrix(true, false);
                child.getWorldPosition(childWorldPosition);
                
                // Get direction from root to child
                directionVector = new THREE.Vector3().subVectors(childWorldPosition, worldPosition).normalize();
                break;
            }
        }
    }
    
    // Create sphere geometry for root - make it slightly larger than handles
    const sphereGeometry = new THREE.SphereGeometry(baseSize * 1.3, 16, 16);
    
    // Create material - darker gray and solid
    const rootMaterial = new THREE.MeshPhongMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.7,
        depthTest: true,
        depthWrite: true
    });
    
    // Create the sphere mesh
    const rootMesh = new THREE.Mesh(sphereGeometry, rootMaterial);
    rootMesh.name = `root_visual_${bone.name}`;
    rootMesh.userData.boneRef = bone;
    rootMesh.userData.originalColor = new THREE.Color(0x555555);
    rootMesh.userData.hoverColor = new THREE.Color(0xff0000); // Red hover color
    rootMesh.userData.isVisualization = true;
    rootMesh.userData.isRoot = true; // Mark as root
    
    // Explicitly set the material color to the original color (gray)
    rootMesh.material.color.set(0x555555);
    
    // Position at bone's world position
    rootMesh.position.copy(worldPosition);
    
    // Always make roots appear on top of other visualization elements
    rootMesh.renderOrder = 1000; // Same as handles
    
    // Add to visualization group
    boneVisualizationGroup.add(rootMesh);
    
    // Create a directional caret/arrow pointing in the direction of root's children
    const caretLength = baseSize * 1.5;
    const rootSphereRadius = baseSize * 1.3; // Same as the sphere radius above
    const caretOffset = rootSphereRadius + (baseSize * 0.5); // Offset from sphere edge
    
    // Create cone for caret
    const caretGeometry = new THREE.ConeGeometry(baseSize * 0.6, caretLength, 8);
    const caretMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333, // Red caret
        wireframe: true,
        transparent: false
    });
    
    // Rotate cone to point along +Z (forward)
    caretGeometry.rotateX(Math.PI / 2);
    
    // Create a container for the caret to manage its position and orientation separately
    const caretContainer = new THREE.Object3D();
    caretContainer.name = `root_caret_container_${bone.name}`;
    caretContainer.userData.isVisualization = true;
    
    // Position the container at the root's position
    caretContainer.position.copy(worldPosition);
    
    // Add the container to the visualization group
    boneVisualizationGroup.add(caretContainer);
    
    // Create the caret mesh
    const caretMesh = new THREE.Mesh(caretGeometry, caretMaterial);
    caretMesh.name = `root_caret_${bone.name}`;
    caretMesh.userData.isVisualization = true;
    caretMesh.userData.isRootCaret = true;
    
    // Position caret at an offset in the direction of bone's children
    caretMesh.position.copy(directionVector.clone().multiplyScalar(caretOffset));
    
    // Orient caret to point in the same direction
    const caretQuaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 0, 1); // Cone points along +Z after our rotation
    
    // Special case for when direction is parallel to up vector
    if (Math.abs(upVector.dot(directionVector)) > 0.999) {
        if (upVector.dot(directionVector) < 0) {
            caretQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        }
    } else {
        caretQuaternion.setFromUnitVectors(upVector, directionVector);
    }
    
    caretMesh.quaternion.copy(caretQuaternion);
    
    // Add the caret mesh to the container instead of directly to the visualization group
    caretContainer.add(caretMesh);
    
    // No longer store caret reference in root mesh
    // rootMesh.userData.caret = caretMesh; -- REMOVED
    
    // Add connection to parent if it exists
    if (bone.parent && (bone.parent.isBone || bone.parent.name.toLowerCase().includes('bone_'))) {
        const parentPosition = new THREE.Vector3();
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldPosition(parentPosition);
        
        // Create a connecting line
        const connectionGeometry = new THREE.BufferGeometry().setFromPoints([
            parentPosition,
            worldPosition
        ]);
        
        const connectionMaterial = new THREE.LineBasicMaterial({
            color: 0x666666,
            transparent: false,
            opacity: 1.0,
            depthTest: true
        });
        
        const connectionLine = new THREE.Line(connectionGeometry, connectionMaterial);
        connectionLine.name = `root_connection_${bone.parent.name}_to_${bone.name}`;
        connectionLine.userData.isVisualization = true;
        connectionLine.userData.isRootConnection = true;
        
        boneVisualizationGroup.add(connectionLine);
    }
    
    // Add connections to children
    bone.children.forEach(child => {
        if (child.isBone || child.name.toLowerCase().includes('bone_')) {
            const childPosition = new THREE.Vector3();
            child.updateWorldMatrix(true, false);
            child.getWorldPosition(childPosition);
            
            // Create a connecting line
            const connectionGeometry = new THREE.BufferGeometry().setFromPoints([
                worldPosition,
                childPosition
            ]);
            
            const connectionMaterial = new THREE.LineBasicMaterial({
                color: 0x666666,
                transparent: false,
                opacity: 1.0,
                depthTest: true
            });
            
            const connectionLine = new THREE.Line(connectionGeometry, connectionMaterial);
            connectionLine.name = `root_connection_${bone.name}_to_${child.name}`;
            connectionLine.userData.isVisualization = true;
            connectionLine.userData.isRootConnection = true;
            
            boneVisualizationGroup.add(connectionLine);
        }
    });
}

/**
 * Set up hover interaction for bone visualization
 * @param {Object} state - Global state object
 */
function setupBoneInteractions(state) {
    if (!state.renderer || !state.camera || !boneVisualizationGroup) return;
    
    // Create raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Current hovered object
    let hoveredObject = null;
    
    // Dragging state
    let isDragging = false;
    let draggedObject = null;
    let dragPlane = new THREE.Plane();
    
    // Store original orbital controls state to restore later
    let orbitControlsEnabled = true;
    
    // Helper function to temporarily disable/enable orbit controls
    const setOrbitControlsEnabled = (enabled) => {
        if (state.controls && state.controls.enabled !== enabled) {
            // Save original state before disabling (only if we're disabling)
            if (!enabled) {
                orbitControlsEnabled = state.controls.enabled;
            }
            
            // Update controls state
            state.controls.enabled = enabled;
        }
    };
    
    // DOM element that receives events
    const domElement = state.renderer.domElement;
    
    // Add mousemove listener to renderer's DOM element
    const onMouseMove = (event) => {
        // Only process if bone visualization is visible
        if (!boneVisualizationGroup || !boneVisualizationGroup.visible) return;
        
        // Get canvas-relative mouse position
        const canvas = domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, state.camera);
        
        // If dragging, update the object position
        if (isDragging && draggedObject) {
            handleDragMovement(draggedObject, raycaster, dragPlane, state.camera);
            return;
        }
        
        // Find intersections with handle and root objects
        const interactiveObjects = [];
        boneVisualizationGroup.traverse(child => {
            if (child.userData && (child.userData.isHandle || child.userData.isRoot)) {
                interactiveObjects.push(child);
            }
        });
        
        const intersects = raycaster.intersectObjects(interactiveObjects, false);
        
        // Reset previously hovered object color
        if (hoveredObject && (!intersects.length || intersects[0].object !== hoveredObject)) {
            hoveredObject.material.color.copy(hoveredObject.userData.originalColor);
            hoveredObject = null;
            
            // Re-enable orbit controls if not dragging
            if (!isDragging) {
                setOrbitControlsEnabled(true);
            }
            
            // Reset cursor
            domElement.style.cursor = 'auto';
        }
        
        // Set new hovered object color
        if (intersects.length > 0 && intersects[0].object !== hoveredObject) {
            hoveredObject = intersects[0].object;
            hoveredObject.material.color.copy(hoveredObject.userData.hoverColor);
            
            // Disable orbit controls when hovering over an interactive element
            setOrbitControlsEnabled(false);
            
            // Change cursor to indicate interactivity
            domElement.style.cursor = 'pointer';
        }
    };
    
    // Add mousedown listener for initiating drag
    const onMouseDown = (event) => {
        // Only process left button clicks on hovered object
        if (event.button !== 0 || !hoveredObject || !boneVisualizationGroup.visible) return;
        
        // Stop event from reaching other handlers
        event.stopPropagation();
        
        // Ensure orbit controls are disabled during dragging
        setOrbitControlsEnabled(false);
        
        // Start dragging
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
        
        // Find the point on the plane where the ray intersects
        const planeIntersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane, planeIntersection);
        dragStartPoint.copy(planeIntersection);
        
        // Change cursor to indicate dragging
        domElement.style.cursor = 'grabbing';
    };
    
    // Add mouseup listener for ending drag
    const onMouseUp = (event) => {
        if (event.button !== 0 || !isDragging) return;
        
        // End dragging
        isDragging = false;
        draggedObject = null;
        
        // Reset cursor
        domElement.style.cursor = hoveredObject ? 'pointer' : 'auto';
        
        // If still hovering over an interactive object, keep orbit controls disabled
        // Otherwise, restore orbit controls to original state
        if (!hoveredObject) {
            setOrbitControlsEnabled(orbitControlsEnabled);
        }
    };
    
    // Add mouseleave listener to ensure we clean up properly if mouse leaves canvas
    const onMouseLeave = (event) => {
        // Reset hover state
        if (hoveredObject) {
            hoveredObject.material.color.copy(hoveredObject.userData.originalColor);
            hoveredObject = null;
        }
        
        // End any active dragging
        isDragging = false;
        draggedObject = null;
        
        // Reset cursor
        domElement.style.cursor = 'auto';
        
        // Restore orbit controls
        setOrbitControlsEnabled(orbitControlsEnabled);
    };
    
    // Properly scope and bind events to prevent interfering with drop zones
    const attachScopedListener = (element, event, handler) => {
        // Create a wrapper that checks if we're dealing with the visualization
        const wrappedHandler = (e) => {
            // Only handle events if our visualization exists and is visible
            if (boneVisualizationGroup && boneVisualizationGroup.visible) {
                // Check if the event target is within our renderer canvas
                // This prevents our handlers from capturing drop zone events
                if (element === e.target || element.contains(e.target)) {
                    handler(e);
                }
            }
        };
        element.addEventListener(event, wrappedHandler);
        return wrappedHandler; // Return so we can remove it later
    };
    
    // Add and store event listeners with proper scoping
    const boundMouseMove = attachScopedListener(domElement, 'mousemove', onMouseMove);
    const boundMouseDown = attachScopedListener(domElement, 'mousedown', onMouseDown);
    const boundMouseUp = attachScopedListener(domElement, 'mouseup', onMouseUp);
    const boundMouseLeave = attachScopedListener(domElement, 'mouseleave', onMouseLeave);
    
    // Store event listener references for cleanup
    boneVisualizationGroup.userData.mouseListener = boundMouseMove;
    boneVisualizationGroup.userData.mouseDownListener = boundMouseDown;
    boneVisualizationGroup.userData.mouseUpListener = boundMouseUp;
    boneVisualizationGroup.userData.mouseLeaveListener = boundMouseLeave;
    boneVisualizationGroup.userData.listenerTarget = domElement;
}

/**
 * Handle movement during drag operations
 * @param {THREE.Object3D} object - The object being dragged
 * @param {THREE.Raycaster} raycaster - Current raycaster
 * @param {THREE.Plane} plane - The drag plane
 * @param {THREE.Camera} camera - The scene camera
 */
function handleDragMovement(object, raycaster, plane, camera) {
    if (!object || !object.userData || !object.userData.boneRef) return;
    
    // Find the new intersection point on the plane
    const planeIntersection = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, planeIntersection)) return;
    
    // Calculate the movement delta in world space
    const movementDelta = new THREE.Vector3().subVectors(planeIntersection, dragStartPoint);
    
    // Update the visual representation position
    object.position.copy(dragStartPosition).add(movementDelta);
    
    // Get the bone reference
    const bone = object.userData.boneRef;
    if (!bone) return;
    
    // Different handling for root bones vs. handle/control bones
    if (object.userData.isRoot) {
        // For root bones, just update the connections without modifying the actual bone
        updateRootConnections(object);
    } else {
        // For handle/control bones, update the actual bone position
        // Find the root model object to access constraints
        let rootObject = findRootObject(bone);
        let constraints = [];
        
        if (rootObject && rootObject.userData && rootObject.userData.rigConstraints) {
            constraints = rootObject.userData.rigConstraints;
        }
        
        // Store original bone matrices if needed for IK solving
        const originalMatrices = new Map();
        if (bone.skeleton) {
            bone.skeleton.bones.forEach(b => {
                originalMatrices.set(b.uuid, b.matrix.clone());
            });
        }
        
        // Calculate how to move the bone in its parent's space
        if (bone.parent) {
            // Convert world space movement to local space of the bone's parent
            const parentWorldMatrix = bone.parent.matrixWorld.clone();
            const worldToLocal = new THREE.Matrix4().copy(parentWorldMatrix).invert();
            const localDelta = movementDelta.clone().applyMatrix4(worldToLocal);
            
            // Apply the movement to the bone's local position
            bone.position.add(localDelta);
            bone.updateMatrix();
            
            // Force update of world matrix to propagate changes
            bone.updateWorldMatrix(true, true);
            
            // Find and apply any constraints affecting this bone
            applyBoneConstraints(bone, constraints);
            
            // Signal that the skeleton needs to be updated
            if (bone.skeleton) {
                bone.skeleton.update();
                
                // Apply IK constraints
                applyIKConstraints(bone, constraints, bone.skeleton);
            }
        } else {
            // For root bones, just apply the world space movement directly
            bone.position.add(movementDelta);
            bone.updateMatrix();
            bone.updateWorldMatrix(true, true);
            
            // Find and apply any constraints affecting this bone
            applyBoneConstraints(bone, constraints);
        }
        
        // Update any connecting lines
        updateHandleConnections(object);
    }
}

/**
 * Update connection lines for a root bone that has moved
 * @param {THREE.Object3D} rootMesh - The root mesh that moved
 */
function updateRootConnections(rootMesh) {
    if (!rootMesh || !boneVisualizationGroup) return;
    
    // Get the bone reference
    const bone = rootMesh.userData.boneRef;
    if (!bone) return;
    
    // Update parent connection if it exists
    if (bone.parent) {
        const parentConnectionLine = boneVisualizationGroup.children.find(child => 
            child.name === `root_connection_${bone.parent.name}_to_${bone.name}`
        );
        
        if (parentConnectionLine) {
            // Get parent world position
            const parentWorldPosition = new THREE.Vector3();
            bone.parent.updateWorldMatrix(true, false);
            bone.parent.getWorldPosition(parentWorldPosition);
            
            // Update the line geometry
            const points = [
                parentWorldPosition,
                rootMesh.position.clone()
            ];
            
            // Create new geometry with updated points
            const newGeometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Dispose old geometry and replace
            parentConnectionLine.geometry.dispose();
            parentConnectionLine.geometry = newGeometry;
        }
    }
    
    // Update all child connections
    bone.children.forEach(child => {
        if (child.isBone || child.name.toLowerCase().includes('bone_')) {
            const childConnectionLine = boneVisualizationGroup.children.find(line => 
                line.name === `root_connection_${bone.name}_to_${child.name}`
            );
            
            if (childConnectionLine) {
                // Get child world position
                const childWorldPosition = new THREE.Vector3();
                child.updateWorldMatrix(true, false);
                child.getWorldPosition(childWorldPosition);
                
                // Update the line geometry
                const points = [
                    rootMesh.position.clone(),
                    childWorldPosition
                ];
                
                // Create new geometry with updated points
                const newGeometry = new THREE.BufferGeometry().setFromPoints(points);
                
                // Dispose old geometry and replace
                childConnectionLine.geometry.dispose();
                childConnectionLine.geometry = newGeometry;
            }
        }
    });
}

/**
 * Set visualization objects to render on top (Z-override)
 * @param {THREE.Object3D} group - The visualization group
 * @param {boolean} override - Whether to enable Z-override
 */
function setZOverride(group, override) {
    if (!group) return;
    
    group.traverse(object => {
        if (object.userData && object.userData.isVisualization) {
            if (override) {
                // Make object render on top by disabling depth test or using renderOrder
                if (object.userData.isHandle || object.userData.isRoot) {
                    // Handles and roots should be at ultimate top Z
                    object.renderOrder = 2000;
                } else {
                    object.renderOrder = 999;
                }
                if (object.material) {
                    object.material.depthTest = false;
                }
            } else {
                // Reset to normal depth behavior but keep handles/roots on top
                if (object.userData.isHandle || object.userData.isRoot) {
                    object.renderOrder = 1000; // Keep on top of other visualization
                } else {
                    object.renderOrder = 0;
                }
                if (object.material) {
                    object.material.depthTest = true;
                }
            }
        }
    });
}

/**
 * Toggle fill/wireframe mode for visualization meshes
 * @param {THREE.Object3D} group - The visualization group
 * @param {boolean} fill - Whether to use fill mode instead of wireframe
 */
function setFillMeshes(group, fill) {
    if (!group) return;
    
    group.traverse(object => {
        if (object.material && (object.userData.isBone || object.userData.isHead)) {
            object.material.wireframe = !fill;
        }
    });
}

/**
 * Set visualization color
 * @param {THREE.Object3D} group - The visualization group
 * @param {string} colorHex - Hex color string (e.g., '#ff0000')
 */
function setVisualizationColor(group, colorHex) {
    if (!group) return;
    
    const color = new THREE.Color(colorHex);
    
    group.traverse(object => {
        if (object.material && object.userData.isVisualization) {
            // Don't change color of handle objects or root objects which should stay gray
            if ((!object.name || !object.name.includes('handle_')) && !object.userData.isRoot) {
                object.material.color.copy(color);
            }
        }
    });
}

/**
 * Format constraint data for display
 * @param {Array} constraints - Array of constraint objects
 * @returns {string} HTML formatted constraint data
 */
function formatConstraintsData(constraints) {
    if (!constraints || constraints.length === 0) {
        return 'No constraint data found';
    }
    
    return constraints.map(c => {
        // Format each constraint based on its type
        const boneName = c.boneName ? `<span style="color:#f99;">${c.boneName}</span>: ` : '';
        const type = c.type ? `${c.type}` : 'Unknown';
        let details = '';
        
        if (c.type === 'IK') {
            details = `Target: ${c.target || 'Unknown'}, Chain: ${c.chainLength || 0}`;
        } else if (c.type === 'Limit') {
            details = `Limits applied to ${c.axis || 'unknown axis'}`;
        } else if (c.type === 'CopyRotation' || c.type === 'CopyLocation') {
            details = `Source: ${c.source || 'Unknown'}, Influence: ${c.influence || 1.0}`;
        } else {
            // Generic object formatting for other constraint types
            details = Object.entries(c)
                .filter(([key]) => key !== 'type' && key !== 'boneName')
                .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
                .join(', ');
        }
        
        return `${boneName}${type} (${details})`;
    }).join('<br>');
}

/**
 * Remove the bone visualization
 */
function removeBoneVisualization() {
    if (boneVisualizationGroup) {
        // Remove event listeners
        if (boneVisualizationGroup.userData.listenerTarget) {
            const target = boneVisualizationGroup.userData.listenerTarget;
            
            if (boneVisualizationGroup.userData.mouseListener) {
                target.removeEventListener('mousemove', boneVisualizationGroup.userData.mouseListener);
            }
            
            if (boneVisualizationGroup.userData.mouseDownListener) {
                target.removeEventListener('mousedown', boneVisualizationGroup.userData.mouseDownListener);
            }
            
            if (boneVisualizationGroup.userData.mouseUpListener) {
                target.removeEventListener('mouseup', boneVisualizationGroup.userData.mouseUpListener);
            }
            
            if (boneVisualizationGroup.userData.mouseLeaveListener) {
                target.removeEventListener('mouseleave', boneVisualizationGroup.userData.mouseLeaveListener);
            }
            
            // Reset cursor
            target.style.cursor = 'auto';
            
            // Re-enable orbit controls (if they exist)
            if (boneVisualizationGroup.userData.state && 
                boneVisualizationGroup.userData.state.controls) {
                boneVisualizationGroup.userData.state.controls.enabled = true;
            }
        }
        
        // Remove each mesh and geometry
        boneVisualizationGroup.traverse(child => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Remove from parent
        if (boneVisualizationGroup.parent) {
            boneVisualizationGroup.parent.remove(boneVisualizationGroup);
        }
        
        boneVisualizationGroup = null;
    }
}

/**
 * Find the root object of a bone's hierarchy
 * @param {THREE.Object3D} bone - The bone object
 * @returns {THREE.Object3D} The root object
 */
function findRootObject(bone) {
    let current = bone;
    let previous = null;
    
    while (current) {
        previous = current;
        current = current.parent;
    }
    
    return previous;
}

/**
 * Apply bone constraints to a bone
 * @param {THREE.Bone} bone - The bone to apply constraints to
 * @param {Array} constraints - Array of constraint objects
 */
function applyBoneConstraints(bone, constraints) {
    if (!bone || !constraints || constraints.length === 0) return;
    
    // Find constraints affecting this bone
    const boneConstraints = constraints.filter(c => 
        (c.boneName && c.boneName === bone.name) || 
        (c.bone && c.bone === bone.name)
    );
    
    if (boneConstraints.length === 0) return;
    
    // Apply each constraint based on type
    boneConstraints.forEach(constraint => {
        if (constraint.type === 'Limit') {
            applyLimitConstraint(bone, constraint);
        } else if (constraint.type === 'CopyRotation') {
            applyCopyRotationConstraint(bone, constraint);
        } else if (constraint.type === 'CopyLocation') {
            applyCopyLocationConstraint(bone, constraint);
        }
    });
}

/**
 * Apply IK constraints to a bone
 * @param {THREE.Bone} bone - The end effector bone
 * @param {Array} constraints - Array of constraint objects
 * @param {THREE.Skeleton} skeleton - The skeleton object
 */
function applyIKConstraints(bone, constraints, skeleton) {
    if (!bone || !constraints || !skeleton) return;
    
    // Find IK constraints where this bone is the end effector
    const ikConstraints = constraints.filter(c => 
        c.type === 'IK' && 
        ((c.boneName && c.boneName === bone.name) || 
        (c.bone && c.bone === bone.name) ||
        (c.target && c.target === bone.name))
    );
    
    if (ikConstraints.length === 0) return;
    
    // Simple IK solver for each constraint
    ikConstraints.forEach(constraint => {
        // Find the chain length
        const chainLength = constraint.chainLength || 2;
        
        // Collect bones in the chain
        const boneChain = [];
        let currentBone = bone;
        
        // Collect chain bones, starting with the end effector
        boneChain.push(currentBone);
        
        // Get parent bones up the chain
        for (let i = 0; i < chainLength - 1; i++) {
            currentBone = currentBone.parent;
            if (!currentBone || !currentBone.isBone) break;
            boneChain.push(currentBone);
        }
        
        // Simple FABRIK IK solving would go here
        // For now, just log the constraint
        console.log(`IK constraint found for bone ${bone.name}`, constraint);
        console.log(`Bone chain:`, boneChain.map(b => b.name));
    });
}

/**
 * Apply limit constraint to a bone
 * @param {THREE.Bone} bone - The bone to constrain
 * @param {Object} constraint - The constraint object
 */
function applyLimitConstraint(bone, constraint) {
    if (!bone || !constraint) return;
    
    // Apply rotation limits if defined
    if (constraint.rotationMin && constraint.rotationMax) {
        // X rotation limits
        if (constraint.rotationMin.x !== undefined && constraint.rotationMax.x !== undefined) {
            bone.rotation.x = Math.max(constraint.rotationMin.x, Math.min(constraint.rotationMax.x, bone.rotation.x));
        }
        
        // Y rotation limits
        if (constraint.rotationMin.y !== undefined && constraint.rotationMax.y !== undefined) {
            bone.rotation.y = Math.max(constraint.rotationMin.y, Math.min(constraint.rotationMax.y, bone.rotation.y));
        }
        
        // Z rotation limits
        if (constraint.rotationMin.z !== undefined && constraint.rotationMax.z !== undefined) {
            bone.rotation.z = Math.max(constraint.rotationMin.z, Math.min(constraint.rotationMax.z, bone.rotation.z));
        }
    }
    
    // Apply position limits if defined
    if (constraint.positionMin && constraint.positionMax) {
        // X position limits
        if (constraint.positionMin.x !== undefined && constraint.positionMax.x !== undefined) {
            bone.position.x = Math.max(constraint.positionMin.x, Math.min(constraint.positionMax.x, bone.position.x));
        }
        
        // Y position limits
        if (constraint.positionMin.y !== undefined && constraint.positionMax.y !== undefined) {
            bone.position.y = Math.max(constraint.positionMin.y, Math.min(constraint.positionMax.y, bone.position.y));
        }
        
        // Z position limits
        if (constraint.positionMin.z !== undefined && constraint.positionMax.z !== undefined) {
            bone.position.z = Math.max(constraint.positionMin.z, Math.min(constraint.positionMax.z, bone.position.z));
        }
    }
}

/**
 * Apply copy rotation constraint to a bone
 * @param {THREE.Bone} bone - The bone to apply the constraint to
 * @param {Object} constraint - The constraint object
 */
function applyCopyRotationConstraint(bone, constraint) {
    if (!bone || !constraint || !constraint.source) return;
    
    // Find the source bone
    const sourceBone = findBoneByName(bone, constraint.source);
    if (!sourceBone) return;
    
    // Calculate influence factor (default to 1.0 if not specified)
    const influence = constraint.influence !== undefined ? constraint.influence : 1.0;
    
    // Apply rotation based on influence
    if (influence >= 1.0) {
        // Full influence - direct copy
        bone.quaternion.copy(sourceBone.quaternion);
    } else if (influence > 0) {
        // Partial influence - interpolate
        const originalQuat = bone.quaternion.clone();
        bone.quaternion.copy(sourceBone.quaternion);
        bone.quaternion.slerp(originalQuat, 1.0 - influence);
    }
}

/**
 * Apply copy location constraint to a bone
 * @param {THREE.Bone} bone - The bone to apply the constraint to
 * @param {Object} constraint - The constraint object
 */
function applyCopyLocationConstraint(bone, constraint) {
    if (!bone || !constraint || !constraint.source) return;
    
    // Find the source bone
    const sourceBone = findBoneByName(bone, constraint.source);
    if (!sourceBone) return;
    
    // Calculate influence factor (default to 1.0 if not specified)
    const influence = constraint.influence !== undefined ? constraint.influence : 1.0;
    
    // Original position for interpolation
    const originalPos = bone.position.clone();
    
    // Apply position based on influence
    if (influence >= 1.0) {
        // Full influence - direct copy
        bone.position.copy(sourceBone.position);
    } else if (influence > 0) {
        // Partial influence - interpolate
        bone.position.lerpVectors(originalPos, sourceBone.position, influence);
    }
}

/**
 * Find a bone by name in the bone hierarchy
 * @param {THREE.Object3D} startBone - The bone to start searching from
 * @param {string} name - The name of the bone to find
 * @returns {THREE.Object3D|null} The found bone or null
 */
function findBoneByName(startBone, name) {
    if (!startBone || !name) return null;
    
    // Start from the root object
    const rootObject = findRootObject(startBone);
    if (!rootObject) return null;
    
    // Search for the bone by name
    let foundBone = null;
    rootObject.traverse(object => {
        if (object.name === name) {
            foundBone = object;
        }
    });
    
    return foundBone;
}

/**
 * Get average scale of a model for sizing bone visualizations appropriately
 * @param {Object} model - The model object
 * @returns {number} Average scale factor
 */
function getAverageScale(model) {
    if (!model) return 1;
    
    // Default scale if we can't calculate
    let scale = 1;
    
    // Try to get model bounding box to determine appropriate scale
    const box = new THREE.Box3();
    try {
        box.setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        // Use average dimension as scale reference
        scale = (size.x + size.y + size.z) / 3;
        
        // Normalize to a reasonable range
        if (scale < 0.1) scale = 0.1;
        if (scale > 10) scale = 10;
    } catch (e) {
        console.warn('Could not calculate model scale, using default', e);
    }
    
    return scale;
}

/**
 * Update the rig visualization with new model
 * @param {Object} state - Global state object
 */
export function updateRigVisualization(state) {
    console.log('updateRigVisualization called with state:', {
        modelObject: state.modelObject ? 'Model loaded' : 'No model',
        modelLoaded: state.modelLoaded
    });
    
    if (!rigVisualizationContainer) {
        console.log('No rig visualization container exists - creating one');
        createRigVisualization(state);
        return;
    }
    
    // Clean up any existing bone visualization
    removeBoneVisualization();
    
    // If no model, show the "no data" state
    if (!state.modelObject) {
        console.log('No model object available - showing no data state');
        const container = rigVisualizationContainer.querySelector('.rig-info-container');
        if (container) {
            showNoModelState(container);
        }
        return;
    }
    
    // Update with model data
    updateRigData(state.modelObject);
    
    // Make sure the visualization is visible
    if (rigVisualizationContainer.style.display === 'none') {
        rigVisualizationContainer.style.display = 'block';
    }
    
    console.log('Rig visualization updated with new model');
}

/**
 * Remove rig visualization
 */
export function removeRigVisualization() {
    // Remove 3D visualization
    removeBoneVisualization();
    
    // Remove HTML container
    if (rigVisualizationContainer) {
        if (document.body.contains(rigVisualizationContainer)) {
            document.body.removeChild(rigVisualizationContainer);
        }
        rigVisualizationContainer = null;
    }
}

/**
 * Create a visual representation of a regular bone
 * @param {Object} bone - The bone object
 * @param {number} baseSize - Base size for scaling the visualization
 */
function createBoneVisual(bone, baseSize) {
    if (!bone || !boneVisualizationGroup) return;
    
    // Ensure the bone's world matrix is up to date
    bone.updateWorldMatrix(true, false);
    
    // Get bone's world position and world quaternion
    const boneWorldPosition = new THREE.Vector3();
    const boneWorldQuaternion = new THREE.Quaternion();
    const boneWorldScale = new THREE.Vector3();
    
    // Extract the bone's world transform components
    bone.matrixWorld.decompose(boneWorldPosition, boneWorldQuaternion, boneWorldScale);
    
    // Find the tail position (end of the bone)
    // In THREE.js bones, the tail is determined by the position of its child bones
    let tailWorldPosition = null;
    let hasChildBone = false;
    
    // Check if any children are bones to determine tail position
    if (bone.children && bone.children.length > 0) {
        // For simplicity, use the first bone child's position as the tail
        for (const child of bone.children) {
            if (child.isBone || child.name.toLowerCase().includes('bone_')) {
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
    // This is simpler than our custom bone shape and easier to align correctly
    const boneGeometry = new THREE.CylinderGeometry(
        baseSize * 1.5,  // head radius (wider)
        baseSize * 0.5,  // tail radius (narrower)
        boneLength,      // bone length
        8,               // radial segments
        1,               // height segments
        false            // open ended
    );
    
    // By default, cylinder geometry is centered on the origin and aligned with Y-axis
    // Move it so that one end is at the origin, and it extends along positive Y
    boneGeometry.translate(0, boneLength/2, 0);
    
    // Create wireframe material for the bone - use red as default
    const boneMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Red
        wireframe: true,
        transparent: false,
        opacity: 1.0,
        depthTest: true,
        depthWrite: true
    });
    
    // Create the bone mesh
    const boneMesh = new THREE.Mesh(boneGeometry, boneMaterial);
    boneMesh.name = `bone_visual_${bone.name}`;
    boneMesh.userData.boneRef = bone;
    boneMesh.userData.isVisualization = true;
    boneMesh.userData.isBone = true;
    
    // Add to visualization group
    boneVisualizationGroup.add(boneMesh);
    
    // Position the bone mesh
    boneMesh.position.copy(boneWorldPosition);
    
    // Orient the mesh to point from head to tail
    // We need to create a quaternion that rotates from the cylinder's default orientation (Y-axis)
    // to the actual bone direction
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
    
    // Add head point as a small sphere for visual clarity
    const headGeometry = new THREE.SphereGeometry(baseSize * 0.8, 8, 8);
    const headMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333, // Slightly different red
        wireframe: true,
        transparent: false,
        opacity: 1.0,
        depthTest: true
    });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.copy(boneWorldPosition);
    headMesh.userData.isVisualization = true;
    headMesh.userData.isHead = true;
    boneVisualizationGroup.add(headMesh);
    
    // Add connection line to parent bone for visualization clarity
    if (bone.parent && (bone.parent.isBone || bone.parent.name.toLowerCase().includes('bone_'))) {
        const parentWorldPosition = new THREE.Vector3();
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldPosition(parentWorldPosition);
        
        // Create a connecting line
        const connectionGeometry = new THREE.BufferGeometry().setFromPoints([
            parentWorldPosition,
            boneWorldPosition
        ]);
        
        const connectionMaterial = new THREE.LineBasicMaterial({
            color: 0xff5555, // Lighter red
            transparent: false,
            opacity: 1.0,
            depthTest: true
        });
        
        const connectionLine = new THREE.Line(connectionGeometry, connectionMaterial);
        connectionLine.name = `connection_${bone.parent.name}_to_${bone.name}`;
        connectionLine.userData.isVisualization = true;
        connectionLine.userData.isConnection = true;
        
        boneVisualizationGroup.add(connectionLine);
    }
} 