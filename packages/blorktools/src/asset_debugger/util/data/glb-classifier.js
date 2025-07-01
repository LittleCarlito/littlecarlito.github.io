import { deduplicateItemsByName } from "./duplicate-handler";

export function validateGLBHeader(dataView) {
    if (dataView.byteLength < 12) {
        throw new Error('Invalid GLB: File too small');
    }
    
    const magic = dataView.getUint32(0, true);
    const expectedMagic = 0x46546C67;
    if (magic !== expectedMagic) {
        throw new Error('Invalid GLB: Incorrect magic bytes');
    }
    
    const version = dataView.getUint32(4, true);
    if (version !== 2) {
        throw new Error(`Unsupported GLB version: ${version}`);
    }
}

export function validateJSONChunk(dataView, jsonChunkLength) {
    const jsonChunkType = dataView.getUint32(16, true);
    
    if (jsonChunkType !== 0x4E4F534A) {
        throw new Error('Invalid GLB: First chunk is not JSON');
    }
    
    const jsonStart = 20;
    const jsonEnd = jsonStart + jsonChunkLength;
    
    if (jsonEnd > dataView.byteLength) {
        throw new Error('Invalid GLB: JSON chunk extends beyond file size');
    }
}

export function validateBinaryChunk(dataView, binaryChunkOffset) {
    if (dataView.byteLength <= binaryChunkOffset + 8) {
        return false;
    }
    
    const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
    if (binaryChunkType !== 0x004E4942) {
        throw new Error('Invalid GLB: Second chunk is not BIN');
    }
    
    return true;
}

export function isRemovalOperation(binaryData) {
    return !binaryData || binaryData.byteLength === 0;
}

export function hasExtension(gltf, extensionName) {
    return gltf.extensions && gltf.extensions[extensionName];
}

export function hasBufferURI(buffer) {
    return buffer.uri;
}

export function isDataURI(uri) {
    return uri.startsWith('data:');
}

export function getChunkInfo(dataView) {
    const jsonChunkLength = dataView.getUint32(12, true);
    const jsonChunkType = dataView.getUint32(16, true);
    
    return {
        jsonChunkLength,
        jsonChunkType,
        jsonStart: 20,
        jsonEnd: 20 + jsonChunkLength,
        binaryChunkOffset: 20 + jsonChunkLength
    };
}

/**
 * Analyze the rig data in a GLTF model
 * @param {Object} gltf - The loaded GLTF model data
 * @returns {Object} Analyzed rig details
 */
export function analyzeGltfModel(gltf) {
    console.log('analyzeGltfModel called with:', gltf);
    
    if (!gltf || !gltf.scene) {
        console.error('Invalid GLTF model:', gltf);
        return null;
    }
    
    console.log('Analyzing GLTF model for rig information...');
    console.log('GLTF scene structure:', gltf.scene);
    
    const rawDetails = {
        bones: [],
        rigs: [],
        roots: [],
        controls: [],
        joints: [],
        constraints: [] // Add a new array to track constraints
    };
    
    // Extract scene information
    const scene = gltf.scene;
    
    // Helper function to traverse the scene
    const traverseNode = (node, parentType = null) => {       
        // Look for joint constraints in this node
        const constraints = parseJointConstraints(node);
        if (constraints) {
            rawDetails.constraints.push({
                nodeName: node.name,
                nodeType: node.type,
                constraintType: constraints.type,
                constraintData: constraints
            });
        }
        
        // Check if the node is a bone
        if (node.isBone || node.name.toLowerCase().includes('bone')) {
            rawDetails.bones.push({
                name: node.name,
                position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
                rotation: node.rotation ? [node.rotation.x, node.rotation.y, node.rotation.z] : null,
                parentName: parentType === 'bone' ? node.parent.name : null,
                constraintType: constraints ? constraints.type : 'none' // Add constraint type
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
        bones: deduplicateItemsByName(rawDetails.bones),
        rigs: deduplicateItemsByName(rawDetails.rigs),
        roots: deduplicateItemsByName(rawDetails.roots),
        controls: deduplicateItemsByName(rawDetails.controls),
        joints: deduplicateItemsByName(rawDetails.joints),
        constraints: rawDetails.constraints // Don't deduplicate constraints
    };
    
    console.log('Rig analysis results:', result);
    return result;
}

/**
 * Parse joint constraint data from node extras or userData
 * @param {Object} node - Bone/joint node to examine
 * @returns {Object|null} - Constraint data if found, null otherwise
 */
export function parseJointConstraints(node) {   
    // Initialize constraint object
    let constraints = null;
    
    // Check for constraints in userData
    if (node.userData) {
        // Look for Blender constraint data in userData
        if (node.userData.constraints || node.userData.boneConstraints) {
            constraints = node.userData.constraints || node.userData.boneConstraints;
            return constraints;
        }
        
        // Check for limit_rotation type constraints
        if (node.userData.limitRotation || node.userData.rotationLimits) {
            constraints = {
                type: 'limitRotation',
                limits: node.userData.limitRotation || node.userData.rotationLimits
            };
            return constraints;
        }
    }
    
    // Look for GLTF extras (where custom data is often stored)
    if (node.extras) {
        if (node.extras.constraints || node.extras.jointType) {
            constraints = node.extras.constraints || { type: node.extras.jointType };
            return constraints;
        }
    }
    
    // Infer constraints from bone properties
    // Check if bone has locked rotation axes
    if (node.rotation && node.userData.initialRotation) {
        // Look for zero initial rotations that might indicate locked axes
        const lockedAxes = [];
        const epsilon = 0.0001; // Small threshold for floating point comparison
        
        if (Math.abs(node.userData.initialRotation.x) < epsilon) lockedAxes.push('x');
        if (Math.abs(node.userData.initialRotation.y) < epsilon) lockedAxes.push('y');
        if (Math.abs(node.userData.initialRotation.z) < epsilon) lockedAxes.push('z');
        
        // If we have 2+ locked axes, this might be a hinge joint
        if (lockedAxes.length >= 2) {
            const freeAxis = ['x', 'y', 'z'].find(axis => !lockedAxes.includes(axis));
            if (freeAxis) {
                constraints = {
                    type: 'hinge',
                    axis: freeAxis
                };
                return constraints;
            }
        }
        
        // If all axes are locked, this might be a fixed joint
        if (lockedAxes.length === 3) {
            constraints = {
                type: 'fixed'
            };
            return constraints;
        }
    }
    
    // Check naming conventions that might indicate constraint types
    const lowerName = node.name.toLowerCase();
    if (lowerName.includes('fixed') || lowerName.includes('rigid')) {
        constraints = {
            type: 'fixed'
        };
        return constraints;
    }
    
    if (lowerName.includes('hinge') || lowerName.includes('elbow') || lowerName.includes('knee')) {
        // Default to Y axis for hinge if not specified
        constraints = {
            type: 'hinge',
            axis: lowerName.includes('_x') ? 'x' : (lowerName.includes('_z') ? 'z' : 'y')
        };
        return constraints;
    }
    
    if (lowerName.includes('spring') || lowerName.includes('bounce')) {
        constraints = {
            type: 'spring',
            stiffness: 50,  // Default stiffness
            damping: 5      // Default damping
        };
        return constraints;
    }
    
    // No constraints found
    return null;
}

// TODO Create a function for determining if a glb has a display mesh

// TODO Create a function for getting the mesh index of the display mesh

// TODO Create a function that calls the two above and then uses that info to get the binary buffer for the display mesh
//          Then checks to see if Rig Control Node is true in the buffer
//          If it is calls new method to make the display mesh a control node
//              Stub it out for now that will be next task
