/**
 * Asset Debugger - Rig Panel
 * 
 * This module provides rig visualization and control functionality for the Asset Debugger.
 * It implements the same bone/rig/control parsing as the Rig Debugger.
 */
import { getState } from '../core/state.js';

// Global variable to store rig analysis results
let rigDetails = null;

/**
 * Analyze the rig data in a GLTF model
 * @param {Object} gltf - The loaded GLTF model data
 * @returns {Object} Analyzed rig details
 */
function analyzeGltfModel(gltf) {
    if (!gltf || !gltf.scene) return null;
    
    console.log('Analyzing GLTF model for rig information...');
    
    const rawDetails = {
        bones: [],
        rigs: [],
        roots: [],
        controls: [] // Handles/Controls
    };
    
    // Extract scene information
    const scene = gltf.scene;
    
    // Helper function to traverse the scene
    const traverseNode = (node, parentType = null) => {
        // Check if the node is a bone
        if (node.isBone || node.name.toLowerCase().includes('bone')) {
            rawDetails.bones.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                rotation: node.rotation ? [node.rotation.x, node.rotation.y, node.rotation.z] : null,
                parentName: parentType === 'bone' ? node.parent.name : null
            });
            parentType = 'bone';
        }
        
        // Check if the node is a rig
        if (node.name.toLowerCase().includes('rig') || node.name.toLowerCase().includes('armature')) {
            rawDetails.rigs.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                childCount: node.children ? node.children.length : 0
            });
            parentType = 'rig';
        }
        
        // Check if the node is a root
        if (node.name.toLowerCase().includes('root')) {
            rawDetails.roots.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null
            });
            parentType = 'root';
        }
        
        // Check if the node is a control/handle
        if (node.name.toLowerCase().includes('control') || 
            node.name.toLowerCase().includes('ctrl') || 
            node.name.toLowerCase().includes('handle')) {
            rawDetails.controls.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                type: node.name.toLowerCase().includes('control') ? 'control' : 
                      node.name.toLowerCase().includes('ctrl') ? 'ctrl' : 'handle'
            });
            parentType = 'control';
        }
        
        // Traverse children
        if (node.children) {
            node.children.forEach(child => traverseNode(child, parentType));
        }
    };
    
    // Start traversal from the scene
    scene.traverse(node => traverseNode(node));
    
    // Process raw details to deduplicate items
    const result = {
        bones: deduplicateItems(rawDetails.bones),
        rigs: deduplicateItems(rawDetails.rigs),
        roots: deduplicateItems(rawDetails.roots),
        controls: deduplicateItems(rawDetails.controls)
    };
    
    console.log('Rig analysis results:', result);
    return result;
}

/**
 * Deduplicate items by name, counting duplicates
 * @param {Array} items - Array of items to deduplicate
 * @returns {Array} Deduplicated items with count property
 */
function deduplicateItems(items) {
    const uniqueItems = new Map();
    
    items.forEach(item => {
        const key = item.name;
        if (uniqueItems.has(key)) {
            const existingItem = uniqueItems.get(key);
            existingItem.count = (existingItem.count || 1) + 1;
        } else {
            uniqueItems.set(key, {...item, count: 1});
        }
    });
    
    return Array.from(uniqueItems.values());
}

/**
 * Find associated bone for a control by its name
 * @param {String} controlName - Name of the control
 * @param {Array} bones - Array of bones to search
 * @returns {Object|null} Associated bone or null if not found
 */
function findAssociatedBone(controlName, bones) {
    // Try matching by name
    const boneName = controlName.replace('control', 'bone')
                                .replace('ctrl', 'bone')
                                .replace('handle', 'bone');
    
    let matchedBone = null;
    bones.forEach(bone => {
        if (bone.name === boneName || bone.name.includes(boneName) || boneName.includes(bone.name)) {
            matchedBone = bone;
        }
    });
    
    return matchedBone;
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
    
    const createSection = (title, items) => {
        const section = document.createElement('div');
        section.style.marginBottom = '15px';
        
        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = title;
        sectionTitle.style.margin = '5px 0';
        sectionTitle.style.fontSize = '14px';
        sectionTitle.style.borderBottom = '1px solid var(--border-color)';
        section.appendChild(sectionTitle);
        
        if (!items || items.length === 0) {
            const noItems = document.createElement('p');
            noItems.textContent = 'None found';
            noItems.style.fontSize = '12px';
            noItems.style.color = '#aaa';
            noItems.style.margin = '5px 0';
            section.appendChild(noItems);
        } else {
            items.forEach(item => {
                const itemElem = document.createElement('div');
                itemElem.style.fontSize = '12px';
                itemElem.style.margin = '5px 0';
                itemElem.style.padding = '3px';
                itemElem.style.backgroundColor = 'rgba(0,0,0,0.02)';
                itemElem.style.borderRadius = '3px';
                itemElem.style.position = 'relative';
                
                // Create name element
                const nameElem = document.createElement('div');
                nameElem.textContent = `Name: ${item.name}`;
                nameElem.style.paddingRight = item.count > 1 ? '40px' : '0';
                itemElem.appendChild(nameElem);
                
                // Add count as a separate styled element if more than one
                if (item.count > 1) {
                    const countElem = document.createElement('div');
                    countElem.textContent = `x${item.count}`;
                    countElem.style.position = 'absolute';
                    countElem.style.right = '5px';
                    countElem.style.top = '50%';
                    countElem.style.transform = 'translateY(-50%)';
                    countElem.style.fontSize = '14px';
                    countElem.style.fontWeight = '600';
                    countElem.style.color = '#4CAF50';
                    countElem.style.backgroundColor = 'rgba(0,0,0,0.1)';
                    countElem.style.borderRadius = '3px';
                    countElem.style.padding = '0 4px';
                    itemElem.appendChild(countElem);
                }
                
                // Add position info if available
                if (item.position) {
                    const posElem = document.createElement('div');
                    posElem.style.fontSize = '10px';
                    posElem.style.color = '#666';
                    posElem.textContent = `Pos: [${item.position.map(p => 
                        typeof p === 'number' ? p.toFixed(2) : 'undefined').join(', ')}]`;
                    itemElem.appendChild(posElem);
                }
                
                // Add type info if available
                if (item.type) {
                    const typeElem = document.createElement('div');
                    typeElem.style.fontSize = '10px';
                    typeElem.style.color = '#666';
                    typeElem.textContent = `Type: ${item.type}`;
                    itemElem.appendChild(typeElem);
                }
                
                // Add bone associations for control points
                if (title === 'Controls/Handles') {
                    const associatedBone = findAssociatedBone(item.name, details.bones);
                    if (associatedBone) {
                        const boneElem = document.createElement('div');
                        boneElem.style.fontSize = '10px';
                        boneElem.style.color = '#0066cc';
                        boneElem.textContent = `Controls bone: ${associatedBone.name}`;
                        itemElem.appendChild(boneElem);
                    }
                }
                
                section.appendChild(itemElem);
            });
        }
        
        return section;
    };
    
    // Create sections for each type of element
    container.appendChild(createSection('Bones', details.bones));
    container.appendChild(createSection('Rigs', details.rigs));
    container.appendChild(createSection('Roots', details.roots));
    container.appendChild(createSection('Controls/Handles', details.controls));
}

/**
 * Update the rig panel with current state
 */
export function updateRigPanel() {
    const state = getState();
    const rigContent = document.getElementById('rig-content');
    
    if (!rigContent) return;
    
    // If we don't have rig details yet, try to analyze the model
    if (!rigDetails && state.model) {
        const model = { scene: state.model };
        rigDetails = analyzeGltfModel(model);
    }
    
    // Create the rig details content
    createRigDetailsContent(rigContent, rigDetails);
}

// Export analyzeGltfModel function for potential external use
export { analyzeGltfModel }; 