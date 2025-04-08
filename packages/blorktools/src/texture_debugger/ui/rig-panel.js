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

/**
 * Initialize the rig panel and cache DOM elements
 */
export function initRigPanel() {
    // Cache DOM elements
    rigStatus = document.getElementById('rig-status');
    rigVisualizationControls = document.getElementById('rig-visualization-controls');
    toggleRigButton = document.getElementById('toggle-rig-button');
    boneHierarchy = document.getElementById('bone-hierarchy');
    
    // Set up toggle button handler
    if (toggleRigButton) {
        toggleRigButton.onclick = () => toggleRigVisualization();
    }
    
    // Initial update
    updateRigVisualization();
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
            }
            
            // Collect bones
            if (object.isBone) {
                bones.push(object);
            }
        });
    }
    
    // Update state
    updateState('bones', bones);
    updateState('skeleton', skeleton);
    
    return {
        bones,
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
    }
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
    
    // Create a visualization for each bone
    state.bones.forEach(bone => {
        // Create a bone representation
        const boneVisual = createBoneVisual(bone, modelSize);
        if (boneVisual) {
            boneGroup.add(boneVisual);
        }
    });
    
    // Add the group to the scene
    if (state.scene) {
        state.scene.add(boneGroup);
    }
    
    // Update state
    updateState('boneVisualization', boneGroup);
}

/**
 * Create a visual representation of a bone
 * @param {THREE.Bone} bone - The bone to visualize
 * @param {number} baseSize - Base size for visualization
 * @returns {THREE.Group} Group containing the bone visualization
 */
function createBoneVisual(bone, baseSize) {
    if (!bone) return null;
    
    // Create a group for this bone
    const boneGroup = new THREE.Group();
    boneGroup.name = `BoneVisual_${bone.name || 'unnamed'}`;
    
    // Position at the bone's world position
    bone.updateWorldMatrix(true, false);
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(bone.matrixWorld);
    boneGroup.position.copy(position);
    
    // Create a sphere to represent the bone joint
    const sphereGeometry = new THREE.SphereGeometry(baseSize, 8, 8);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff9900,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    boneGroup.add(sphere);
    
    // If bone has a parent, create a line to it
    if (bone.parent && bone.parent.isBone) {
        bone.parent.updateWorldMatrix(true, false);
        const parentPosition = new THREE.Vector3();
        parentPosition.setFromMatrixPosition(bone.parent.matrixWorld);
        
        // Create line geometry
        const points = [
            new THREE.Vector3(0, 0, 0), // Local origin
            new THREE.Vector3().subVectors(parentPosition, position) // Vector to parent
        ];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Create line material
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 1,
            transparent: true,
            opacity: 0.6
        });
        
        // Create line
        const line = new THREE.Line(lineGeometry, lineMaterial);
        boneGroup.add(line);
    }
    
    return boneGroup;
}

export default {
    initRigPanel,
    updateRigVisualization,
    toggleRigVisualization
}; 