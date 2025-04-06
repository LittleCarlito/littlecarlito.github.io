// Rig Visualization module
// Creates a panel to display rig and bone data from 3D models
import * as THREE from 'three';
import { createMovablePanel, createButton, createLabel } from '../utils/uiComponents.js';

// Keep track of created rig visualization container
let rigVisualizationContainer = null;
// Keep track of bone visualization objects
let boneVisualizationGroup = null;

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
    rigInfoContainer.style.whiteSpace = 'pre-wrap';
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
    
    // Display rig summary - reverting to previous format with bullet points
    rigInfoContainer.innerHTML = `
        <div style="padding: 3px; border-bottom: 1px solid #444;">
            <strong>Rig Summary:</strong>
            <ul style="margin: 2px 0; padding-left: 18px; line-height: 1.2;">
                <li>Total bones: ${rigData.totalBones}</li>
                <li>Root bones: ${rigData.rootBones.length}</li>
                <li>Max depth: ${rigData.maxDepth}</li>
            </ul>
        </div>
    `;
    
    // Create collapsible tree view for bones
    createBoneTreeView(boneTreeContainer, rigData.boneHierarchy);
    
    // Store rig data for visualization
    if (boneVisualizationGroup && boneVisualizationGroup.visible) {
        // If bone visualization is already visible, update it
        createBoneVisualization(modelObject, rigData);
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
        allBones: []  // Store all bones for visualization
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
        }
        
        // Check if this is a skeleton
        if (object.isSkeletonHelper || object.isSkeleton || 
            (object.userData && object.userData.type === 'skeleton')) {
            skeletons.push(object);
        }
        
        // Check if this is a SkinnedMesh (will have skeleton)
        if (object.isSkinnedMesh && object.skeleton) {
            skeletons.push(object.skeleton);
            // Add all bones from the skeleton
            if (object.skeleton.bones && object.skeleton.bones.length > 0) {
                bones.push(...object.skeleton.bones);
            }
        }
        
        // Traverse children
        if (object.children && object.children.length > 0) {
            object.children.forEach(child => traverseForBones(child));
        }
    }
    
    // Traverse the model to find bones
    traverseForBones(modelObject);
    
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
                object: bone  // Store reference to actual bone object
            };
            
            // Recursively build child hierarchy
            buildBoneChildHierarchy(bone, rigData.boneHierarchy[bone.uuid].children, uniqueBones, 1, rigData);
        }
    });
    
    return rigData;
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
                object: child  // Store reference to actual bone object
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
        
        // Special handling for handle bones
        if (bone.name && bone.name.toLowerCase().includes('_handle')) {
            createHandleBoneVisual(bone, boneBaseSize);
        } else {
            // Create regular bone visualization
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
        color: 0xff0000, // Changed from blue to red
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
        color: 0xff3333, // Changed to red
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
            color: 0xff5555, // Changed to red
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
    
    // Position at bone's world position
    handleMesh.position.copy(worldPosition);
    
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
        
        boneVisualizationGroup.add(connectionLine);
    }
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
    
    // Add mousemove listener to renderer's DOM element
    const onMouseMove = (event) => {
        // Only process if bone visualization is visible
        if (!boneVisualizationGroup.visible) return;
        
        // Get canvas-relative mouse position
        const canvas = state.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, state.camera);
        
        // Find intersections with handle objects only
        const handleObjects = [];
        boneVisualizationGroup.traverse(child => {
            if (child.name && child.name.includes('handle_visual_')) {
                handleObjects.push(child);
            }
        });
        
        const intersects = raycaster.intersectObjects(handleObjects, false);
        
        // Reset previously hovered object color
        if (hoveredObject && (!intersects.length || intersects[0].object !== hoveredObject)) {
            hoveredObject.material.color.copy(hoveredObject.userData.originalColor);
            hoveredObject = null;
        }
        
        // Set new hovered object color
        if (intersects.length > 0 && intersects[0].object !== hoveredObject) {
            hoveredObject = intersects[0].object;
            hoveredObject.material.color.copy(hoveredObject.userData.hoverColor);
        }
    };
    
    // Add and store event listener
    state.renderer.domElement.addEventListener('mousemove', onMouseMove);
    
    // Store event listener reference for cleanup
    boneVisualizationGroup.userData.mouseListener = onMouseMove;
    boneVisualizationGroup.userData.listenerTarget = state.renderer.domElement;
}

/**
 * Remove the bone visualization
 */
function removeBoneVisualization() {
    if (boneVisualizationGroup) {
        // Remove event listeners
        if (boneVisualizationGroup.userData.mouseListener && 
            boneVisualizationGroup.userData.listenerTarget) {
            boneVisualizationGroup.userData.listenerTarget.removeEventListener(
                'mousemove', 
                boneVisualizationGroup.userData.mouseListener
            );
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
                object.renderOrder = 999;
                if (object.material) {
                    object.material.depthTest = false;
                }
            } else {
                // Reset to normal depth behavior
                object.renderOrder = 0;
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
            // Don't change color of handle objects which should stay gray
            if (!object.name || !object.name.includes('handle_')) {
                object.material.color.copy(color);
            }
        }
    });
} 